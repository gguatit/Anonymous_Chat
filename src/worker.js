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
    ALLOWED_ORIGINS: ['https://kalpha.mmv.kr'], // Production domain
    HMAC_SECRET: 'your-secret-key-change-this-in-production', // Should be in env variable
};

// Metrics storage (in-memory, per-worker instance)
const metrics = {
    totalConnections: 0,
    activeConnections: 0,
    totalMessages: 0,
    errors: 0,
};

export default {
    async fetch(request, env, ctx) {
        try {
            const url = new URL(request.url);

            // Force HTTPS redirect in production
            if (url.protocol === 'http:' && !url.hostname.includes('localhost')) {
                return Response.redirect(`https://${url.hostname}${url.pathname}${url.search}`, 301);
            }

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

            // Serve static files from assets binding
            if (env.ASSETS) {
                try {
                    // Try to fetch the requested asset
                    const assetResponse = await env.ASSETS.fetch(request);
                    
                    // If asset found, return it
                    if (assetResponse.status === 200) {
                        return assetResponse;
                    }
                    
                    // For SPA routing: if not found and not an API endpoint, serve index.html
                    if (assetResponse.status === 404 && !url.pathname.startsWith('/api')) {
                        const indexRequest = new Request(new URL('/index.html', request.url), request);
                        return await env.ASSETS.fetch(indexRequest);
                    }
                    
                    return assetResponse;
                } catch (e) {
                    console.log('Asset fetch error:', e);
                }
            }

            // Fallback 404
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

    // Verify Origin header to prevent CSRF attacks
    const origin = request.headers.get('Origin');
    if (origin && SECURITY.ALLOWED_ORIGINS && !isAllowedOrigin(origin)) {
        console.warn('Blocked WebSocket from unauthorized origin:', origin);
        return new Response('Unauthorized Origin', { status: 403 });
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

// Check if origin is allowed
function isAllowedOrigin(origin) {
    try {
        const url = new URL(origin);
        // In development, allow localhost
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            return true;
        }
        // In production, check against allowed origins
        return SECURITY.ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
    } catch {
        return false;
    }
}

// HMAC signature generation for message integrity
async function generateMessageSignature(message, secret) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(JSON.stringify({
        content: message.content,
        sessionId: message.sessionId,
        timestamp: message.timestamp
    }));
    
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    return arrayBufferToHex(signature);
}

// Verify HMAC signature
async function verifyMessageSignature(message, signature, secret) {
    const expectedSignature = await generateMessageSignature(message, secret);
    return signature === expectedSignature;
}

// Helper function to convert ArrayBuffer to hex string
function arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
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
        this.messages = []; // In-memory cache
        this.initialized = false;
        
        // Periodic cleanup of stale data (every 5 minutes)
        this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
    }

    async initializeMessages() {
        if (this.initialized) return;
        
        // Load messages from Durable Object storage
        const stored = await this.state.storage.get('messages');
        if (stored) {
            // Filter out messages older than 12 hours
            const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);
            this.messages = stored.filter(msg => msg.timestamp > twelveHoursAgo);
            
            // Save cleaned messages back if any were removed
            if (this.messages.length !== stored.length) {
                await this.state.storage.put('messages', this.messages);
            }
        }
        
        this.initialized = true;
    }

    async fetch(request) {
        // Initialize messages from storage on first request
        await this.initializeMessages();
        
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

                        // Send welcome message and recent messages
                        this.sendToSession(sessionId, {
                            type: 'system',
                            content: '채팅방에 입장했습니다.'
                        });
                        
                        // Send last 50 messages to new user
                        const recentMessages = this.messages.slice(-50);
                        for (const msg of recentMessages) {
                            this.sendToSession(sessionId, msg);
                        }

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

                        // Verify message signature if provided
                        if (data.signature) {
                            const isValid = await verifyMessageSignature(
                                {
                                    content: data.content,
                                    sessionId: data.sessionId,
                                    timestamp: data.timestamp
                                },
                                data.signature,
                                SECURITY.HMAC_SECRET
                            );
                            
                            if (!isValid) {
                                this.sendToSession(sessionId, {
                                    type: 'error',
                                    content: '메시지 무결성 검증 실패'
                                });
                                console.warn('Invalid message signature from session:', sessionId);
                                return;
                            }
                        }

                        // Verify session ID matches
                        if (data.sessionId !== sessionId) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: '세션 ID가 일치하지 않습니다.'
                            });
                            console.warn('Session ID mismatch:', data.sessionId, '!=', sessionId);
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

                        // Generate unique message ID
                        const messageId = `msg_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;

                        // Create message object with signature
                        const message = {
                            type: 'message',
                            messageId: messageId,
                            content: this.sanitizeInput(data.content),
                            sessionId: sessionId,
                            timestamp: Date.now(),
                            editedAt: null
                        };
                        
                        // Generate server signature
                        message.signature = await generateMessageSignature(message, SECURITY.HMAC_SECRET);

                        // Add to messages array
                        this.messages.push(message);
                        
                        // Clean up messages older than 12 hours and limit to 500 messages
                        const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);
                        this.messages = this.messages
                            .filter(msg => msg.timestamp > twelveHoursAgo)
                            .slice(-500); // Keep max 500 messages
                        
                        // Persist to Durable Object storage (async, non-blocking)
                        this.state.storage.put('messages', this.messages);

                        // Broadcast message to all users
                        this.broadcast(message);
                        break;
                    }

                    case 'edit': {
                        if (!sessionId || !metadata) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: '세션이 유효하지 않습니다.'
                            });
                            return;
                        }

                        // Verify edit request signature
                        if (data.signature) {
                            const isValid = await verifyMessageSignature(
                                {
                                    content: data.newContent,
                                    sessionId: data.sessionId,
                                    timestamp: data.timestamp
                                },
                                data.signature,
                                SECURITY.HMAC_SECRET
                            );
                            
                            if (!isValid) {
                                this.sendToSession(sessionId, {
                                    type: 'error',
                                    content: '메시지 수정 요청 검증 실패'
                                });
                                console.warn('Invalid edit signature from session:', sessionId);
                                return;
                            }
                        }

                        // Verify session ID matches
                        if (data.sessionId !== sessionId) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: '세션 ID가 일치하지 않습니다.'
                            });
                            return;
                        }

                        // Find the original message
                        const messageIndex = this.messages.findIndex(msg => msg.messageId === data.messageId);
                        
                        if (messageIndex === -1) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: '수정할 메시지를 찾을 수 없습니다.'
                            });
                            return;
                        }

                        const originalMessage = this.messages[messageIndex];

                        // Verify ownership
                        if (originalMessage.sessionId !== sessionId) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: '자신의 메시지만 수정할 수 있습니다.'
                            });
                            console.warn('Unauthorized edit attempt:', sessionId, 'tried to edit message from', originalMessage.sessionId);
                            return;
                        }

                        // Verify 10-minute time limit
                        const now = Date.now();
                        const tenMinutes = 10 * 60 * 1000;
                        if (now - originalMessage.timestamp > tenMinutes) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: '메시지는 작성 후 10분 이내에만 수정할 수 있습니다.'
                            });
                            return;
                        }

                        // Validate new content
                        if (!data.newContent || data.newContent.trim().length === 0) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: '수정할 내용이 비어있습니다.'
                            });
                            return;
                        }

                        if (data.newContent.length > SECURITY.MAX_MESSAGE_LENGTH) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: `메시지는 최대 ${SECURITY.MAX_MESSAGE_LENGTH}자까지 입력할 수 있습니다.`
                            });
                            return;
                        }

                        // Update message
                        const editedMessage = {
                            ...originalMessage,
                            content: this.sanitizeInput(data.newContent),
                            editedAt: now
                        };

                        // Generate new server signature for edited message
                        editedMessage.signature = await generateMessageSignature(editedMessage, SECURITY.HMAC_SECRET);

                        // Update in messages array
                        this.messages[messageIndex] = editedMessage;

                        // Persist to Durable Object storage
                        this.state.storage.put('messages', this.messages);

                        // Broadcast edited message to all users
                        this.broadcast({
                            type: 'message_edited',
                            message: editedMessage
                        });

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
        // Generate cryptographically secure session ID with timestamp
        const randomPart = crypto.randomUUID().replace(/-/g, '');
        const timestampPart = Date.now().toString(36);
        return `user_${randomPart.substring(0, 16)}_${timestampPart}`;
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
        const sessionTimeout = 300000; // 5 minutes
        const messageRetention = 12 * 60 * 60 * 1000; // 12 hours

        // Clean up inactive sessions
        for (const [sessionId, metadata] of this.userMetadata) {
            if (now - metadata.lastMessageTime > sessionTimeout && now - metadata.joinTime > sessionTimeout) {
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
        
        // Clean up old messages (older than 12 hours)
        const twelveHoursAgo = now - messageRetention;
        const initialLength = this.messages.length;
        this.messages = this.messages.filter(msg => msg.timestamp > twelveHoursAgo);
        
        // If messages were cleaned, update storage
        if (this.messages.length !== initialLength) {
            this.state.storage.put('messages', this.messages);
        }
    }
}
