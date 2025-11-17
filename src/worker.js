// Cloudflare Worker with Durable Objects for Anonymous Chat

// Rate limiting configuration
const RATE_LIMIT = {
    MAX_MESSAGES_PER_MINUTE: 30,
    MAX_CONNECTIONS_PER_IP: 5,
    MESSAGE_COOLDOWN: 1000, // 1 second between messages
    MAX_FILES_PER_IP_PER_DAY: 50, // 파일 업로드 제한
};

// Security configuration
const SECURITY = {
    MAX_MESSAGE_LENGTH: 500,
    BANNED_IPS: new Set(), // Can be populated from KV or environment
    IP_WHITELIST: null, // null means all IPs allowed
    ALLOWED_ORIGINS: ['https://kalpha.mmv.kr'], // Production domain
};

// File upload configuration (무료 범위 최적화)
const FILE_CONFIG = {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    RETENTION_HOURS: 12, // 12시간 후 자동 삭제
    ALLOWED_TYPES: [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'text/plain', 'text/csv',
        'application/zip',
        'video/mp4', 'video/webm',
    ],
};

// Metrics storage (in-memory, per-worker instance)
const metrics = {
    totalConnections: 0,
    activeConnections: 0,
    totalMessages: 0,
    totalFiles: 0,
    errors: 0,
};

export default {
    async fetch(request, env, ctx) {
        try {
            // Get HMAC secret from environment variable or generate random for development
            const HMAC_SECRET = env.HMAC_SECRET || crypto.randomUUID();
            
            const url = new URL(request.url);

            // Force HTTPS redirect in production
            if (url.protocol === 'http:' && !url.hostname.includes('localhost')) {
                return Response.redirect(`https://${url.hostname}${url.pathname}${url.search}`, 301);
            }

            // CORS headers for API requests
            const corsHeaders = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
                'Access-Control-Allow-Headers': 'Content-Type',
            };

            // Handle CORS preflight
            if (request.method === 'OPTIONS') {
                return new Response(null, { headers: corsHeaders });
            }

            // File upload endpoint
            if (url.pathname === '/api/upload' && request.method === 'POST') {
                return await handleFileUpload(request, env, corsHeaders);
            }

            // File download endpoint
            if (url.pathname.startsWith('/api/file/')) {
                return await handleFileDownload(request, env, corsHeaders);
            }

            // File delete endpoint (optional)
            if (url.pathname.startsWith('/api/file/') && request.method === 'DELETE') {
                return await handleFileDelete(request, env, corsHeaders);
            }

            // WebSocket upgrade request
            if (url.pathname === '/ws') {
                return await handleWebSocket(request, env, HMAC_SECRET);
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
    },

    // Cron Trigger: 12시간마다 만료된 파일 삭제 (무료)
    async scheduled(event, env, ctx) {
        console.log('Cron triggered: Cleaning up expired files');
        await cleanupExpiredFiles(env);
    }
};

async function handleWebSocket(request, env, HMAC_SECRET) {
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

    // Forward the request to the Durable Object with HMAC_SECRET in headers
    const modifiedRequest = new Request(request, {
        headers: {
            ...Object.fromEntries(request.headers),
            'X-HMAC-Secret': HMAC_SECRET
        }
    });
    return room.fetch(modifiedRequest);
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

// 파일 업로드 핸들러 (무료 범위 최적화)
async function handleFileUpload(request, env, corsHeaders) {
    try {
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        
        // Rate limiting check (IP당 하루 50개)
        const uploadKey = `upload_count_${clientIP}_${new Date().toISOString().split('T')[0]}`;
        const uploadCount = await env.FILE_BUCKET.get(uploadKey);
        
        if (uploadCount && parseInt(uploadCount) >= RATE_LIMIT.MAX_FILES_PER_IP_PER_DAY) {
            return new Response(JSON.stringify({ 
                error: '일일 업로드 한도를 초과했습니다. (최대 50개)' 
            }), { 
                status: 429, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
        }

        const formData = await request.formData();
        const file = formData.get('file');
        
        if (!file) {
            return new Response(JSON.stringify({ error: '파일이 없습니다.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 파일 크기 체크 (10MB)
        if (file.size > FILE_CONFIG.MAX_SIZE) {
            return new Response(JSON.stringify({ 
                error: `파일 크기는 ${FILE_CONFIG.MAX_SIZE / 1024 / 1024}MB를 초과할 수 없습니다.` 
            }), {
                status: 413,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 파일 타입 체크
        if (!FILE_CONFIG.ALLOWED_TYPES.includes(file.type)) {
            return new Response(JSON.stringify({ 
                error: '지원하지 않는 파일 형식입니다.' 
            }), {
                status: 415,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 고유 파일 ID 생성
        const fileId = crypto.randomUUID();
        const now = Date.now();
        const expiresAt = now + (FILE_CONFIG.RETENTION_HOURS * 60 * 60 * 1000);

        // R2에 업로드
        await env.FILE_BUCKET.put(fileId, file.stream(), {
            httpMetadata: {
                contentType: file.type,
            },
            customMetadata: {
                originalName: file.name,
                uploadedAt: now.toString(),
                expiresAt: expiresAt.toString(),
                uploaderIP: clientIP,
                size: file.size.toString(),
            }
        });

        // 업로드 카운트 증가
        await env.FILE_BUCKET.put(uploadKey, ((parseInt(uploadCount) || 0) + 1).toString(), {
            expiresIn: 86400 // 24시간
        });

        metrics.totalFiles++;

        return new Response(JSON.stringify({
            success: true,
            fileId,
            fileName: file.name,
            fileSize: file.size,
            downloadUrl: `/api/file/${fileId}`,
            expiresAt,
            expiresIn: `${FILE_CONFIG.RETENTION_HOURS}시간`,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('File upload error:', error);
        return new Response(JSON.stringify({ error: '파일 업로드 중 오류가 발생했습니다.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

// 파일 다운로드 핸들러
async function handleFileDownload(request, env, corsHeaders) {
    try {
        const url = new URL(request.url);
        const fileId = url.pathname.split('/').pop();

        const object = await env.FILE_BUCKET.get(fileId);
        
        if (!object) {
            return new Response('파일을 찾을 수 없습니다.', { 
                status: 404,
                headers: corsHeaders
            });
        }

        // 만료 시간 체크
        const expiresAt = parseInt(object.customMetadata?.expiresAt || '0');
        if (Date.now() > expiresAt) {
            // 만료된 파일 삭제
            await env.FILE_BUCKET.delete(fileId);
            return new Response('파일이 만료되었습니다. (12시간 보관)', { 
                status: 410,
                headers: corsHeaders
            });
        }

        const headers = new Headers(corsHeaders);
        headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
        headers.set('Content-Disposition', `attachment; filename="${object.customMetadata?.originalName || fileId}"`);
        headers.set('Cache-Control', 'public, max-age=3600');
        headers.set('X-File-Size', object.customMetadata?.size || '0');
        headers.set('X-Expires-At', expiresAt.toString());

        return new Response(object.body, { headers });

    } catch (error) {
        console.error('File download error:', error);
        return new Response('파일 다운로드 중 오류가 발생했습니다.', {
            status: 500,
            headers: corsHeaders
        });
    }
}

// 파일 삭제 핸들러 (선택적)
async function handleFileDelete(request, env, corsHeaders) {
    try {
        const url = new URL(request.url);
        const fileId = url.pathname.split('/').pop();

        await env.FILE_BUCKET.delete(fileId);

        return new Response(JSON.stringify({ success: true, message: '파일이 삭제되었습니다.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('File delete error:', error);
        return new Response(JSON.stringify({ error: '파일 삭제 중 오류가 발생했습니다.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

// Cron: 만료된 파일 자동 삭제 (12시간마다 실행)
async function cleanupExpiredFiles(env) {
    try {
        const now = Date.now();
        let deletedCount = 0;

        // R2 버킷의 모든 파일 목록 가져오기
        const listed = await env.FILE_BUCKET.list();
        
        for (const object of listed.objects) {
            // 메타데이터가 없는 파일은 스킵 (업로드 카운트 등)
            if (!object.customMetadata?.expiresAt) continue;

            const expiresAt = parseInt(object.customMetadata.expiresAt);
            
            // 만료된 파일 삭제
            if (now > expiresAt) {
                await env.FILE_BUCKET.delete(object.key);
                deletedCount++;
                console.log(`Deleted expired file: ${object.key}`);
            }
        }

        console.log(`Cleanup completed: ${deletedCount} files deleted`);
        return deletedCount;

    } catch (error) {
        console.error('Cleanup error:', error);
        return 0;
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
        // Get HMAC_SECRET from request headers
        const HMAC_SECRET = request.headers.get('X-HMAC-Secret');
        
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
        await this.handleSession(server, clientIP, HMAC_SECRET);

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }

    async handleSession(websocket, clientIP, HMAC_SECRET) {
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

                        // Verify message signature if provided (server-side only)
                        if (data.signature) {
                            const isValid = await verifyMessageSignature(
                                {
                                    content: data.content,
                                    sessionId: data.sessionId,
                                    timestamp: data.timestamp
                                },
                                data.signature,
                                HMAC_SECRET
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
                        message.signature = await generateMessageSignature(message, HMAC_SECRET);

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

                        // Verify edit request signature (server-side only)
                        if (data.signature) {
                            const isValid = await verifyMessageSignature(
                                {
                                    content: data.newContent,
                                    sessionId: data.sessionId,
                                    timestamp: data.timestamp
                                },
                                data.signature,
                                HMAC_SECRET
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
                        editedMessage.signature = await generateMessageSignature(editedMessage, HMAC_SECRET);

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
