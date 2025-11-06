// Cloudflare Worker with Durable Objects for Anonymous Chat

// Rate limiting configuration
const RATE_LIMIT = {
    MAX_MESSAGES_PER_MINUTE: 30,
    MAX_CONNECTIONS_PER_IP: 5,
    MESSAGE_COOLDOWN: 1000, // 1 second between messages
};

// Security configuration
const SECURITY = {
    MAX_MESSAGE_LENGTH: 500,
    BANNED_IPS: new Set(), // Can be populated from KV or environment
    IP_WHITELIST: null, // null means all IPs allowed
};

// Metrics storage (in-memory, per-worker instance)
const metrics = {
    totalConnections: 0,
    activeConnections: 0,
    totalMessages: 0,
    errors: 0,
};

export default {
    async fetch(request, env, _ctx) {
        try {
            const url = new URL(request.url);

            // CORS headers for API requests
            const corsHeaders = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            };

            // Handle CORS preflight
            if (request.method === 'OPTIONS') {
                return new Response(null, { headers: corsHeaders });
            }

            // WebSocket upgrade request
            if (url.pathname === '/ws') {
                return await handleWebSocket(request, env);
            }

            // Metrics endpoint (minimal anonymous data)
            if (url.pathname === '/metrics') {
                return new Response(JSON.stringify({
                    timestamp: Date.now(),
                    activeConnections: metrics.activeConnections,
                    totalMessages: metrics.totalMessages,
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // Health check endpoint
            if (url.pathname === '/health') {
                return new Response(JSON.stringify({ status: 'healthy' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // Serve static files from Pages (fallback)
            return new Response('Not Found', { status: 404 });

        } catch (error) {
            metrics.errors++;
            console.error('Worker error:', error);
            return new Response('Internal Server Error', { status: 500 });
        }
    }
};

async function handleWebSocket(request, env) {
    // Check for WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    // Get client IP for rate limiting and access control
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    
    // IP-based access control
    if (SECURITY.BANNED_IPS.has(clientIP)) {
        return new Response('Access Denied', { status: 403 });
    }

    if (SECURITY.IP_WHITELIST && !SECURITY.IP_WHITELIST.has(clientIP)) {
        return new Response('Access Denied', { status: 403 });
    }

    // Get or create the Durable Object for the chat room
    const roomId = env.CHAT_ROOM.idFromName('main-room');
    const room = env.CHAT_ROOM.get(roomId);

    // Forward the request to the Durable Object
    return room.fetch(request);
}

// Durable Object for managing chat room state
export class ChatRoom {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        this.sessions = new Map(); // sessionId -> WebSocket
        this.ipConnections = new Map(); // IP -> count
        this.userMetadata = new Map(); // sessionId -> { ip, joinTime, messageCount, lastMessageTime }
        this.typingUsers = new Set();
        this.messages = []; // In-memory message history (not persisted)
        
        // Periodic cleanup of stale data
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }

    async fetch(request) {
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        
        // Check IP-based connection limit
        const currentConnections = this.ipConnections.get(clientIP) || 0;
        if (currentConnections >= RATE_LIMIT.MAX_CONNECTIONS_PER_IP) {
            return new Response('Too many connections from this IP', { status: 429 });
        }

        // Create WebSocket pair
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);

        // Accept the WebSocket connection
        await this.handleSession(server, clientIP);

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }

    async handleSession(websocket, clientIP) {
        websocket.accept();

        let sessionId = null;
        let metadata = null;

        websocket.addEventListener('message', async (event) => {
            try {
                const data = JSON.parse(event.data);

                // Handle different message types
                switch (data.type) {
                    case 'join': {
                        sessionId = data.sessionId || this.generateSessionId();
                        
                        // Initialize user metadata
                        metadata = {
                            ip: clientIP,
                            joinTime: Date.now(),
                            messageCount: 0,
                            lastMessageTime: 0,
                        };

                        this.sessions.set(sessionId, websocket);
                        this.userMetadata.set(sessionId, metadata);
                        
                        // Track IP connections
                        this.ipConnections.set(clientIP, (this.ipConnections.get(clientIP) || 0) + 1);
                        
                        // Update metrics
                        metrics.totalConnections++;
                        metrics.activeConnections++;

                        // Broadcast user count
                        this.broadcastUserCount();

                        // Send welcome message
                        this.sendToSession(sessionId, {
                            type: 'system',
                            content: '채팅방에 입장했습니다.'
                        });

                        break;
                    }

                    case 'message': {
                        if (!sessionId || !metadata) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: '세션이 유효하지 않습니다.'
                            });
                            return;
                        }

                        // Validate message
                        const validationError = this.validateMessage(data, metadata);
                        if (validationError) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: validationError
                            });
                            return;
                        }

                        // Update metadata
                        metadata.messageCount++;
                        metadata.lastMessageTime = Date.now();
                        metrics.totalMessages++;

                        // Broadcast message to all users
                        const message = {
                            type: 'message',
                            content: this.sanitizeInput(data.content),
                            sessionId: sessionId,
                            timestamp: Date.now()
                        };

                        this.messages.push(message);
                        // Keep only last 100 messages in memory
                        if (this.messages.length > 100) {
                            this.messages.shift();
                        }

                        this.broadcast(message);
                        break;
                    }

                    case 'typing':
                        if (!sessionId) return;

                        if (data.typing) {
                            this.typingUsers.add(sessionId);
                        } else {
                            this.typingUsers.delete(sessionId);
                        }

                        // Broadcast typing indicator to others
                        this.broadcast({
                            type: 'typing',
                            sessionId: sessionId,
                            typing: data.typing
                        }, sessionId);
                        break;

                    default:
                        console.log('Unknown message type:', data.type);
                }

            } catch (error) {
                metrics.errors++;
                console.error('Message handling error:', error);
                if (sessionId) {
                    this.sendToSession(sessionId, {
                        type: 'error',
                        content: '메시지 처리 중 오류가 발생했습니다.'
                    });
                }
            }
        });

        websocket.addEventListener('close', () => {
            if (sessionId) {
                this.sessions.delete(sessionId);
                this.userMetadata.delete(sessionId);
                this.typingUsers.delete(sessionId);
                
                // Update IP connection count
                const currentCount = this.ipConnections.get(clientIP) || 0;
                if (currentCount > 1) {
                    this.ipConnections.set(clientIP, currentCount - 1);
                } else {
                    this.ipConnections.delete(clientIP);
                }
                
                metrics.activeConnections--;
                this.broadcastUserCount();
            }
        });

        websocket.addEventListener('error', (error) => {
            metrics.errors++;
            console.error('WebSocket error:', error);
        });
    }

    validateMessage(data, metadata) {
        // Check message length
        if (!data.content || data.content.trim().length === 0) {
            return '메시지 내용이 비어있습니다.';
        }

        if (data.content.length > SECURITY.MAX_MESSAGE_LENGTH) {
            return `메시지는 최대 ${SECURITY.MAX_MESSAGE_LENGTH}자까지 입력할 수 있습니다.`;
        }

        // Rate limiting per user
        const now = Date.now();
        if (now - metadata.lastMessageTime < RATE_LIMIT.MESSAGE_COOLDOWN) {
            return '메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해주세요.';
        }

        // Check messages per minute
        const oneMinuteAgo = now - 60000;
        if (metadata.messageCount > RATE_LIMIT.MAX_MESSAGES_PER_MINUTE && 
            metadata.joinTime > oneMinuteAgo) {
            return '분당 메시지 전송 한도를 초과했습니다.';
        }

        return null;
    }

    sanitizeInput(input) {
        // Basic sanitization - remove control characters
        // eslint-disable-next-line no-control-regex
        return input.replace(/[\x00-\x1F\x7F]/g, '').trim();
    }

    generateSessionId() {
        return 'user_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    }

    broadcast(message, excludeSessionId = null) {
        for (const [sessionId, websocket] of this.sessions) {
            if (sessionId !== excludeSessionId) {
                try {
                    websocket.send(JSON.stringify(message));
                } catch (error) {
                    console.error('Broadcast error:', error);
                }
            }
        }
    }

    sendToSession(sessionId, message) {
        const websocket = this.sessions.get(sessionId);
        if (websocket) {
            try {
                websocket.send(JSON.stringify(message));
            } catch (error) {
                console.error('Send error:', error);
            }
        }
    }

    broadcastUserCount() {
        this.broadcast({
            type: 'user_count',
            count: this.sessions.size
        });
    }

    cleanup() {
        // Clean up stale sessions and connections
        const now = Date.now();
        const timeout = 300000; // 5 minutes

        for (const [sessionId, metadata] of this.userMetadata) {
            if (now - metadata.lastMessageTime > timeout && now - metadata.joinTime > timeout) {
                const websocket = this.sessions.get(sessionId);
                if (websocket) {
                    try {
                        websocket.close(1000, 'Session timeout');
                    } catch (error) {
                        console.error('Cleanup error:', error);
                    }
                }
                this.sessions.delete(sessionId);
                this.userMetadata.delete(sessionId);
            }
        }
    }
}
