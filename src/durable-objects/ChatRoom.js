import { RATE_LIMIT, SECURITY, CHANNEL, metrics, MESSAGE_RETENTION_MS, MAX_STORED_MESSAGES, MAX_AUDIT_LOGS, MESSAGE_EDIT_WINDOW_MS, CLEANUP_INTERVAL_MS, SESSION_TIMEOUT_MS, PUSH_THROTTLE_MS, RECENT_MESSAGES_BATCH, DEFAULT_NICKNAME, MAX_NICKNAME_LENGTH, REACTION_EMOJIS, MAX_REACTIONS_PER_EMOJI, AI_SUMMARY, UPLOAD, SEARCH } from '../config/constants.js';
import { logAuditLog, logErrorLog, logSecurityEvent } from '../utils/logger.js';
import { sendPushToOfflineUsers } from '../handlers/push.js';
import { verifyMessageSignature, sanitizeInput, safeJson, isValidFileUrl, generateMessageSignature } from '../utils/helpers.js';
import { validateClientMessage, validateSessionId } from '../utils/validate.js';

import { dispatchAdminRoute, handleCheckBan, handleBroadcastSummary, notifyAdmin } from './chat-room/admin.js';
import { validateMessage, sanitizeContentForAI, generateSessionId, extractErrorLocation, searchMessages, isLikelyCode } from './chat-room/messages.js';
import { isEmergencyActive } from './chat-room/announcements.js';

export class ChatRoom {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        this.sessions = new Map();
        this.ipConnections = new Map();
        this.userMetadata = new Map();
        this.typingUsers = new Set();
        this.messages = [];
        this.initialized = false;
        this.startTime = Date.now();
        this.bannedIPs = new Map();
        this.bannedSessions = new Map();
        this.bannedTokens = new Map();
        this.observers = new Set();
        this.currentAnnouncement = null;
        this.announcementHistory = [];
        this.auditLogs = [];
        this.errorLogs = [];
        this.logsLoaded = false;
        this.MAX_ERROR_LOGS = MAX_AUDIT_LOGS;
        this.pushThrottleTimer = null;
        this.pushThrottleQueue = [];
        this._searchCache = null;

        this.channelSlug = '0';
        this.emptySince = null;

        this.cleanupInterval = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    }

    addErrorLog(type, error, environment = {}, context = '') {
        const log = {
            timestamp: new Date().toISOString(),
            type,
            message: error instanceof Error ? error.message : String(error),
            stackTrace: error instanceof Error ? error.stack : 'No stack trace',
            location: extractErrorLocation(error),
            environment: environment || {},
            context
        };

        this.errorLogs.unshift(log);
        if (this.errorLogs.length > this.MAX_ERROR_LOGS) {
            this.errorLogs.pop();
        }

        logErrorLog(this.env?.DB_ADMIN, type, log.message, log.stackTrace, log.location, log.environment, log.context).catch(err => {
            console.error('Failed to save error log to D1', err);
        });
    }

    async initializeMessages() {
        if (this.initialized) return;

        const stored = await this.state.storage.get('messages');
        if (stored) {
            const twelveHoursAgo = Date.now() - MESSAGE_RETENTION_MS;
            this.messages = stored.filter(msg => msg.timestamp > twelveHoursAgo);

            if (this.messages.length !== stored.length) {
                await this.state.storage.put('messages', this.messages);
            }
        }

        const bannedData = await this.state.storage.get(['bannedIPs', 'bannedSessions', 'bannedTokens']);
        if (bannedData && bannedData.bannedIPs) {
            this.bannedIPs = new Map(bannedData.bannedIPs);
        }
        if (bannedData && bannedData.bannedSessions) {
            this.bannedSessions = new Map(bannedData.bannedSessions);
        }
        if (bannedData && bannedData.bannedTokens) {
            this.bannedTokens = new Map(bannedData.bannedTokens);
        }

        const announcementData = await this.state.storage.get(['currentAnnouncement', 'announcementHistory']);
        if (announcementData && announcementData.currentAnnouncement) {
            this.currentAnnouncement = announcementData.currentAnnouncement;
        }
        if (announcementData && announcementData.announcementHistory) {
            this.announcementHistory = announcementData.announcementHistory;
        }

        this.initialized = true;
    }

    async ensureLogsLoaded() {
        if (this.logsLoaded) return;
        this.logsLoaded = true;
        if (!this.env?.DB_ADMIN) return;

        try {
            const { results } = await this.env.DB_ADMIN.prepare(
                'SELECT action, details, timestamp, metadata FROM audit_logs ORDER BY timestamp DESC LIMIT ?'
            ).bind(MAX_AUDIT_LOGS).all();
            if (results && results.length > 0) {
                this.auditLogs = results.map(r => ({
                    timestamp: r.timestamp,
                    action: r.action,
                    details: r.details,
                    metadata: r.metadata ? JSON.parse(r.metadata) : {}
                })).reverse();
            }
        } catch (e) {
            console.error('Failed to load audit logs from D1:', e);
        }

        try {
            const { results } = await this.env.DB_ADMIN.prepare(
                'SELECT type, message, stack_trace, location, environment, context, timestamp FROM error_logs ORDER BY timestamp DESC LIMIT ?'
            ).bind(this.MAX_ERROR_LOGS).all();
            if (results && results.length > 0) {
                this.errorLogs = results.map(r => ({
                    timestamp: r.timestamp,
                    type: r.type,
                    message: r.message,
                    stackTrace: r.stack_trace,
                    location: r.location,
                    environment: r.environment ? JSON.parse(r.environment) : {},
                    context: r.context
                }));
            }
        } catch (e) {
            console.error('Failed to load error logs from D1:', e);
        }
    }

    getSessionList() {
        return Array.from(this.userMetadata.entries()).map(([sessionId, metadata]) => ({
            sessionId,
            ip: metadata.ip,
            joinTime: metadata.joinTime,
            messageCount: metadata.messageCount,
            lastMessageTime: metadata.lastMessageTime,
            lastActivityTime: metadata.lastActivityTime,
            nickname: metadata.nickname || DEFAULT_NICKNAME,
            isOnline: this.sessions.has(sessionId),
            country: metadata.environment?.country || '',
            userAgent: metadata.environment?.userAgent || ''
        }));
    }

    async fetch(request) {
        const HMAC_SECRET = request.headers.get('X-HMAC-Secret') || request.headers.get('X-Admin-Internal-Token');

        const channelHeader = request.headers.get('X-Channel-Slug');
        if (channelHeader) {
            this.channelSlug = channelHeader;
        }

        const url = new URL(request.url);

        if (url.pathname.startsWith('/admin/')) {
            if (HMAC_SECRET !== this.env.HMAC_SECRET) {
                this.addErrorLog('SECURITY', 'Unauthorized DO Admin Access Attempt', {}, `Path: ${url.pathname}`);
                return new Response('Forbidden', { status: 403 });
            }
        }

        // Internal DO destruction (called by ChannelRegistry cleanup)
        if (url.pathname === '/destroy') {
            if (request.headers.get('X-HMAC-Secret') !== this.env.HMAC_SECRET) {
                return new Response('Forbidden', { status: 403 });
            }
            await this.deleteChannel();
            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const adminResult = await dispatchAdminRoute(this, url, request, HMAC_SECRET);
        if (adminResult !== null) return adminResult;

        if (url.pathname === '/announcement-history') {
            await this.initializeMessages();
            return new Response(JSON.stringify(this.announcementHistory), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url.pathname === '/emergency-announcement') {
            await this.initializeMessages();
            const now = Date.now();
            const ann = this.currentAnnouncement;
            if (ann && ann.isEmergency && (!ann.emergencyUntil || now < ann.emergencyUntil)) {
                return new Response(JSON.stringify({
                    isEmergency: true,
                    content: ann.content,
                    timestamp: ann.timestamp,
                    emergencyUntil: ann.emergencyUntil || null
                }), { headers: { 'Content-Type': 'application/json' } });
            }
            return new Response(JSON.stringify({ isEmergency: false }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url.pathname === '/search') {
            await this.initializeMessages();
            const query = url.searchParams.get('q') || '';
            const limit = Math.min(parseInt(url.searchParams.get('limit') || String(SEARCH.DEFAULT_LIMIT)), SEARCH.MAX_LIMIT);

            const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
            const cacheKey = `${limit}|${normalizedQuery}`;
            const now = Date.now();
            if (this._searchCache && this._searchCache.key === cacheKey && now - this._searchCache.ts < 5000) {
                return new Response(JSON.stringify(this._searchCache.value), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const result = searchMessages(this.messages, query, limit);
            this._searchCache = { key: cacheKey, value: result, ts: now };

            return new Response(JSON.stringify(result), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url.pathname === '/check-ban') {
            return await handleCheckBan(this, url, request);
        }

        if (url.pathname === '/api/logs/error' && request.method === 'POST') {
            try {
                const logData = await safeJson(request);
                this.addErrorLog('CLIENT_ERROR', new Error(logData.message), logData.environment, logData.context);
                return new Response('OK', { status: 200 });
            } catch (_e) {
                return new Response('Error', { status: 400 });
            }
        }

        if (url.pathname === '/messages/recent') {
            if (request.headers.get('X-HMAC-Secret') !== this.env.HMAC_SECRET) {
                return new Response('Forbidden', { status: 403 });
            }
            await this.initializeMessages();
            const recent = this.messages
                .filter(msg => msg.sessionId !== '_ai_summary')
                .slice(-AI_SUMMARY.RECENT_MESSAGES_COUNT)
                .map(msg => {
                    const sanitized = sanitizeContentForAI(msg.content || '');
                    if (sanitized === null) return null;
                    return {
                        nickname: msg.nickname,
                        content: sanitized,
                        timestamp: msg.timestamp,
                        messageId: msg.messageId
                    };
                })
                .filter(msg => msg !== null);
            return new Response(JSON.stringify(recent), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url.pathname === '/broadcast-summary' && request.method === 'POST') {
            if (request.headers.get('X-HMAC-Secret') !== this.env.HMAC_SECRET) {
                return new Response('Forbidden', { status: 403 });
            }
            return await handleBroadcastSummary(this, request, HMAC_SECRET);
        }

        await this.initializeMessages();

        const clientIP = request.headers.get('CF-Connecting-IP');
        const userAgent = request.headers.get('User-Agent') || 'Unknown';
        const country = request.headers.get('CF-IPCountry') || 'Unknown';
        const maskedIP = clientIP ? clientIP.replace(/\.\d+\.\d+$/, '.***.***') : 'unknown';
        const environment = { ip: maskedIP, country, userAgent };

        if (!clientIP) {
            return new Response(JSON.stringify({ error: 'Invalid request' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const banInfo = this.bannedIPs.get(clientIP);
        if (banInfo) {
            const now = Date.now();
            if (now < banInfo.bannedUntil) {
                const remainingSeconds = Math.ceil((banInfo.bannedUntil - now) / 1000);
                return new Response(JSON.stringify({
                    error: 'banned',
                    message: `이 IP는 ${remainingSeconds}초 동안 차단되었습니다.`,
                    remainingSeconds
                }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                });
            } else {
                this.bannedIPs.delete(clientIP);
                await this.state.storage.put('bannedIPs', Array.from(this.bannedIPs.entries()));
            }
        }

        const wsUrl = new URL(request.url);
        const banToken = wsUrl.searchParams.get('token');
        const isObserver = (wsUrl.searchParams.get('sessionId') || '').startsWith('admin_obs_');
        if (banToken) {
            const tokenBan = this.bannedTokens.get(banToken);
            if (tokenBan) {
                const now = Date.now();
                if (now < tokenBan.bannedUntil) {
                    const remainingSeconds = Math.ceil((tokenBan.bannedUntil - now) / 1000);
                    return new Response(JSON.stringify({
                        error: 'banned',
                        message: `차단되었습니다. ${remainingSeconds}초 후 해제됩니다.`,
                        remainingSeconds,
                        token: banToken,
                    }), {
                        status: 403,
                        headers: { 'Content-Type': 'application/json' }
                    });
                } else {
                    this.bannedTokens.delete(banToken);
                    await this.state.storage.put('bannedTokens', Array.from(this.bannedTokens.entries()));
                }
            }
        }

        const currentConnections = this.ipConnections.get(clientIP) || 0;
        if (currentConnections >= RATE_LIMIT.MAX_CONNECTIONS_PER_IP) {
            await logSecurityEvent(this.env, 'WS_HANDSHAKE_FAIL', {
                ip: clientIP,
                details: `Too many connections: ${currentConnections}`,
            });
            return new Response('Too many connections from this IP', { status: 429 });
        }

        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);

        await this.handleSession(server, clientIP, HMAC_SECRET, environment, isObserver);

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }

    async handleSession(websocket, clientIP, HMAC_SECRET, environment, isObserver = false) {
        websocket.accept();

        if (isObserver) {
            this.observers.add(websocket);
            websocket.addEventListener('close', () => {
                this.observers.delete(websocket);
            });
            websocket.addEventListener('error', () => {
                this.observers.delete(websocket);
            });
            return;
        }

        let sessionId = null;
        let metadata = null;

        websocket.addEventListener('message', async (event) => {
            try {
                if (metadata) {
                    metadata.lastActivityTime = Date.now();
                }

                const data = JSON.parse(event.data);

                switch (data.type) {
                    case 'ping': {
                        try {
                            websocket.send(JSON.stringify({
                                type: 'pong',
                                timestamp: Date.now()
                            }));
                        } catch (error) {
                            console.error('Error sending pong:', error);
                        }
                        break;
                    }

                    case 'join': {
                        await this.handleJoin(data, websocket, clientIP, (sid, meta) => {
                            sessionId = sid;
                            metadata = meta;
                            if (environment) metadata.environment = environment;
                        });
                        break;
                    }

                    case 'message': {
                        await this.handleMessage(data, sessionId, metadata, HMAC_SECRET);
                        break;
                    }

                    case 'edit': {
                        await this.handleEdit(data, sessionId, metadata, HMAC_SECRET);
                        break;
                    }

                    case 'delete': {
                        await this.handleDelete(data, sessionId);
                        break;
                    }

                    case 'typing':
                        this.handleTyping(data, sessionId);
                        break;

                    case 'reaction': {
                        await this.handleReaction(data, sessionId, HMAC_SECRET);
                        break;
                    }

                    default:
                        if (sessionId) {
                            this.sendToSession(sessionId, {
                                type: 'error',
                                content: '알 수 없는 메시지 타입입니다.'
                            });
                        }
                }

            } catch (error) {
                metrics.errors++;
                console.error('Message handling error:', error);
                const errorEnv = metadata?.environment || (environment ? environment : {});
                this.addErrorLog('WS_MESSAGE_PARSE', error, errorEnv, '메시지 처리 중 오류 발생');

                await logSecurityEvent(this.env, 'WS_INVALID_MSG', {
                    ip: clientIP,
                    sessionId,
                    details: `Message parse error: ${error.message}`,
                });
                if (sessionId) {
                    this.sendToSession(sessionId, {
                        type: 'error',
                        content: '메시지 처리 중 오류가 발생했습니다.'
                    });
                } else {
                    try {
                        websocket.send(JSON.stringify({
                            type: 'error',
                            content: '메시지 처리 중 오류가 발생했습니다. 다시 연결해주세요.'
                        }));
                    } catch (_e) {
                        // ignore
                    }
                }
            }
        });

        websocket.addEventListener('close', () => {
            if (sessionId) {
                if (this.sessions.get(sessionId) !== websocket) return;

                this.sessions.delete(sessionId);
                this.typingUsers.delete(sessionId);

                const currentCount = this.ipConnections.get(clientIP) || 0;
                if (currentCount > 1) {
                    this.ipConnections.set(clientIP, currentCount - 1);
                } else {
                    this.ipConnections.delete(clientIP);
                }

                metrics.activeConnections--;
                this.broadcastUserCount();

                this.broadcastToObservers({
                    type: 'admin_event',
                    action: 'user_left',
                    payload: { sessionId, ip: clientIP },
                });

                if (this.channelSlug !== '0' && this.sessions.size === 0) {
                    this.emptySince = Date.now();
                }
            }
        });

        websocket.addEventListener('error', (error) => {
            metrics.errors++;
            console.error('WebSocket error:', error);
            const errorEnv = metadata?.environment || (environment ? environment : {});
            this.addErrorLog('WS_CONNECTION', error, errorEnv, '웹소켓 연결 오류 발생');
        });
    }

    async handleJoin(data, websocket, clientIP, setSession) {
        if (!this.cleanupInterval) {
            this.cleanupInterval = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
        }

        if (this.emptySince !== null && this.channelSlug !== '0') {
            this.emptySince = null;
            await this.touchRegistry();
        }

        const sessionId = data.sessionId || generateSessionId();
        const sessionCheck = validateSessionId(sessionId);
        if (!sessionCheck.valid && data.sessionId) {
            websocket.send(JSON.stringify({ type: 'error', content: sessionCheck.error }));
            websocket.close(1008, 'Invalid session');
            return;
        }

        const sessionBanInfo = this.bannedSessions.get(sessionId);
        if (sessionBanInfo) {
            const now = Date.now();
            if (now < sessionBanInfo.bannedUntil) {
                const remainingSeconds = Math.ceil((sessionBanInfo.bannedUntil - now) / 1000);
                websocket.send(JSON.stringify({
                    type: 'banned',
                    content: `이 세션은 ${remainingSeconds}초 동안 차단되었습니다.`,
                    remainingSeconds
                }));
                websocket.close(1008, 'Session banned');
                return;
            } else {
                this.bannedSessions.delete(sessionId);
                await this.state.storage.put('bannedSessions', Array.from(this.bannedSessions.entries()));
            }
        }

        const banInfo = this.bannedIPs.get(clientIP);
        if (banInfo) {
            const now = Date.now();
            if (now < banInfo.bannedUntil) {
                const remainingSeconds = Math.ceil((banInfo.bannedUntil - now) / 1000);
                websocket.send(JSON.stringify({
                    type: 'banned',
                    content: `이 IP는 ${remainingSeconds}초 동안 차단되었습니다.`,
                    remainingSeconds
                }));
                websocket.close(1008, 'IP banned');
                return;
            } else {
                this.bannedIPs.delete(clientIP);
                await this.state.storage.put('bannedIPs', Array.from(this.bannedIPs.entries()));
            }
        }

        const now = Date.now();
        const existingMetadata = this.userMetadata.get(sessionId);
        if (existingMetadata) {
            existingMetadata.lastActivityTime = now;
        }
        const wasAlreadyConnected = this.sessions.has(sessionId);

        let metadata;
        if (wasAlreadyConnected || existingMetadata) {
            this.sessions.set(sessionId, websocket);

            metadata = existingMetadata || {
                ip: clientIP,
                joinTime: Date.now(),
                messageCount: 0,
                lastMessageTime: 0,
                lastActivityTime: now
            };
            this.userMetadata.set(sessionId, metadata);

            const recentMessages = this.messages.slice(-RECENT_MESSAGES_BATCH);
            if (recentMessages.length > 0) {
                this.sendToSession(sessionId, {
                    type: 'history',
                    messages: this._serializeHistoryMessages(recentMessages, sessionId)
                });
            }

            if (this.currentAnnouncement) {
                this.sendToSession(sessionId, {
                    type: 'announcement',
                    content: this.currentAnnouncement.content,
                    timestamp: this.currentAnnouncement.timestamp,
                    isEmergency: isEmergencyActive(this.currentAnnouncement)
                });
            }

            this.broadcastUserCount();
        } else {
            metadata = {
                ip: clientIP,
                joinTime: Date.now(),
                messageCount: 0,
                lastMessageTime: 0,
                lastActivityTime: now
            };

            this.sessions.set(sessionId, websocket);
            this.userMetadata.set(sessionId, metadata);

            this.ipConnections.set(clientIP, (this.ipConnections.get(clientIP) || 0) + 1);

            metrics.totalConnections++;
            metrics.activeConnections++;

            this.broadcastUserCount();

            const maskedIP = clientIP ? clientIP.replace(/\.\d+\.\d+$/, '.***.***') : 'unknown';
            this.broadcastToObservers({
                type: 'admin_event',
                action: 'user_joined',
                payload: { sessionId, nickname: metadata.nickname || '', ip: maskedIP, timestamp: now },
            });

            if (!existingMetadata) {
                this.sendToSession(sessionId, {
                    type: 'system',
                    content: '채팅방에 입장했습니다.'
                });
            }

            const recentMessages = this.messages.slice(-RECENT_MESSAGES_BATCH);
            if (recentMessages.length > 0) {
                this.sendToSession(sessionId, {
                    type: 'history',
                    messages: this._serializeHistoryMessages(recentMessages, sessionId)
                });
            }

            if (this.currentAnnouncement) {
                this.sendToSession(sessionId, {
                    type: 'announcement',
                    content: this.currentAnnouncement.content,
                    timestamp: this.currentAnnouncement.timestamp,
                    isEmergency: isEmergencyActive(this.currentAnnouncement)
                });
            }
        }

        setSession(sessionId, metadata);
    }

    async handleMessage(data, sessionId, metadata, HMAC_SECRET) {
        if (!sessionId || !metadata) {
            if (sessionId) {
                this.sendToSession(sessionId, {
                    type: 'error',
                    content: '세션이 유효하지 않습니다.'
                });
            }
            return;
        }

        const msgCheck = validateClientMessage(data);
        if (!msgCheck.valid) {
            await logSecurityEvent(this.env, 'WS_INVALID_MSG', {
                ip: metadata.ip,
                sessionId,
                details: `Client message validation failed: ${msgCheck.error}`,
            });
            this.sendToSession(sessionId, {
                type: 'error',
                content: msgCheck.error
            });
            return;
        }

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
                await logSecurityEvent(this.env, 'WS_INVALID_MSG', {
                    ip: metadata.ip,
                    sessionId,
                    details: 'Invalid message signature',
                });
                this.sendToSession(sessionId, {
                    type: 'error',
                    content: '메시지 무결성 검증 실패'
                });
                console.warn('Invalid message signature from session:', sessionId);

                return;
            }
        }

        if (data.sessionId !== sessionId) {
            await logSecurityEvent(this.env, 'WS_INVALID_MSG', {
                ip: metadata.ip,
                sessionId,
                details: `Session ID mismatch: ${data.sessionId} != ${sessionId}`,
            });
            this.sendToSession(sessionId, {
                type: 'error',
                content: '세션 ID가 일치하지 않습니다.'
            });
            console.warn('Session ID mismatch:', data.sessionId, '!=', sessionId);
            return;
        }

        try {
            const nick = sanitizeInput(data.nickname || metadata.nickname || DEFAULT_NICKNAME).substring(0, MAX_NICKNAME_LENGTH);
            metadata.nickname = nick;
            this.userMetadata.set(sessionId, metadata);
        } catch (_e) {
            // ignore nickname sanitization errors
        }

        const validationError = validateMessage(data, metadata);
        if (validationError) {
            await logSecurityEvent(this.env, 'WS_FLOOD', {
                ip: metadata.ip,
                sessionId,
                details: validationError,
            });
            this.sendToSession(sessionId, {
                type: 'error',
                content: validationError
            });
            return;
        }

        metadata.messageCount++;
        metadata._minuteMessageCount = (metadata._minuteMessageCount || 0) + 1;
        metadata.lastMessageTime = Date.now();
        metrics.totalMessages++;

        const messageId = `msg_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;

        const message = {
            type: 'message',
            messageId,
            content: sanitizeInput(data.content),
            sessionId,
            nickname: sanitizeInput(data.nickname || DEFAULT_NICKNAME).substring(0, MAX_NICKNAME_LENGTH),
            timestamp: Date.now(),
            editedAt: null,
            _codeHint: isLikelyCode(typeof data.content === 'string' ? data.content : '')
        };

        if (data.replyTo) {
            message.replyTo = {
                messageId: data.replyTo.messageId,
                content: sanitizeInput(data.replyTo.content),
                isOwnMessage: data.replyTo.isOwnMessage
            };

            if (data.replyTo.isSecret) {
                message.replyTo.isSecret = true;
                message.replyTo.secretId = data.replyTo.secretId;
                message.replyTo.targetSessionId = data.replyTo.targetSessionId;
            }
        }

        if (data.file && data.file.url) {
            if (!isValidFileUrl(data.file.url) && !data.file.url.startsWith('/api/file/')) {
                this.sendToSession(sessionId, {
                    type: 'error',
                    content: 'Invalid file URL'
                });
                return;
            }
            message.file = {
                url: data.file.url,
                filename: sanitizeInput(String(data.file.filename || '')).substring(0, UPLOAD.MAX_FILENAME_LENGTH),
                filesize: typeof data.file.filesize === 'number' ? data.file.filesize : null,
                filetype: sanitizeInput(String(data.file.filetype || '')).substring(0, UPLOAD.MAX_FILETYPE_LENGTH)
            };
        }

        if (data.files && Array.isArray(data.files) && data.files.length > 0) {
            const validFiles = [];
            for (const f of data.files) {
                if (!f.url || (!isValidFileUrl(f.url) && !f.url.startsWith('/api/file/'))) continue;
                validFiles.push({
                    url: f.url,
                    filename: sanitizeInput(String(f.filename || '')).substring(0, UPLOAD.MAX_FILENAME_LENGTH),
                    filesize: typeof f.filesize === 'number' ? f.filesize : null,
                    filetype: sanitizeInput(String(f.filetype || '')).substring(0, UPLOAD.MAX_FILETYPE_LENGTH)
                });
            }
            if (validFiles.length > 0) {
                message.files = validFiles;
            }
        }

        message.signature = await generateMessageSignature(message, HMAC_SECRET);

        this.messages.push(message);

        if (this.messages.length > MAX_STORED_MESSAGES) {
            this.messages = this.messages.slice(-MAX_STORED_MESSAGES);
        }

        await this.state.storage.put('messages', this.messages);

        this.broadcast(message);

        notifyAdmin(this, 'message_created', {
            messageId: message.messageId,
            sessionId: message.sessionId,
            nickname: message.nickname,
            content: message.content ? message.content.substring(0, 200) : null,
            timestamp: message.timestamp,
        });
    }

    async handleEdit(data, sessionId, metadata, HMAC_SECRET) {
        if (!sessionId || !metadata) {
            if (sessionId) {
                this.sendToSession(sessionId, {
                    type: 'error',
                    content: '세션이 유효하지 않습니다.'
                });
            }
            return;
        }

        const editCheck = validateClientMessage(data);
        if (!editCheck.valid) {
            this.sendToSession(sessionId, { type: 'error', content: editCheck.error });
            return;
        }

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

        if (data.sessionId !== sessionId) {
            this.sendToSession(sessionId, {
                type: 'error',
                content: '세션 ID가 일치하지 않습니다.'
            });
            return;
        }

        const messageIndex = this.messages.findIndex(msg => msg.messageId === data.messageId);

        if (messageIndex === -1) {
            this.sendToSession(sessionId, {
                type: 'error',
                content: '수정할 메시지를 찾을 수 없습니다.'
            });
            return;
        }

        const originalMessage = this.messages[messageIndex];

        if (originalMessage.sessionId !== sessionId) {
            this.sendToSession(sessionId, {
                type: 'error',
                content: '자신의 메시지만 수정할 수 있습니다.'
            });
            console.warn('Unauthorized edit attempt:', sessionId, 'tried to edit message from', originalMessage.sessionId);
            return;
        }

        const now = Date.now();
        if (now - originalMessage.timestamp > MESSAGE_EDIT_WINDOW_MS) {
            this.sendToSession(sessionId, {
                type: 'error',
                content: '메시지는 작성 후 10분 이내에만 수정할 수 있습니다.'
            });
            return;
        }

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

        const editedMessage = {
            ...originalMessage,
            content: sanitizeInput(data.newContent),
            editedAt: now
        };

        editedMessage.signature = await generateMessageSignature(editedMessage, HMAC_SECRET);

        this.messages[messageIndex] = editedMessage;

        await this.state.storage.put('messages', this.messages);

        this.broadcast({
            type: 'message_edited',
            message: editedMessage
        });
    }

    async handleDelete(data, sessionId) {
        if (!sessionId) {
            return;
        }

        const deleteCheck = validateClientMessage(data);
        if (!deleteCheck.valid) {
            return;
        }

        if (data.sessionId !== sessionId) {
            this.sendToSession(sessionId, {
                type: 'error',
                content: '세션 ID가 일치하지 않습니다.'
            });
            return;
        }

        const messageIndex = this.messages.findIndex(msg => msg.messageId === data.messageId);

        if (messageIndex === -1) {
            this.sendToSession(sessionId, {
                type: 'error',
                content: '삭제할 메시지를 찾을 수 없습니다.'
            });
            return;
        }

        const messageToDelete = this.messages[messageIndex];

        if (messageToDelete.sessionId !== sessionId) {
            this.sendToSession(sessionId, {
                type: 'error',
                content: '자신의 메시지만 삭제할 수 있습니다.'
            });
            console.warn('Unauthorized delete attempt:', sessionId, 'tried to delete message from', messageToDelete.sessionId);
            return;
        }

        const now = Date.now();
        if (now - messageToDelete.timestamp > MESSAGE_EDIT_WINDOW_MS) {
            this.sendToSession(sessionId, {
                type: 'error',
                content: '메시지는 작성 후 10분 이내에만 삭제할 수 있습니다.'
            });
            return;
        }

        this.messages.splice(messageIndex, 1);

        await this.state.storage.put('messages', this.messages);

        this.broadcast({
            type: 'message_deleted',
            messageId: data.messageId
        });
    }

    async handleReaction(data, sessionId, HMAC_SECRET) {
        if (!sessionId) return;

        const reactionCheck = validateClientMessage(data);
        if (!reactionCheck.valid) {
            this.sendToSession(sessionId, { type: 'error', content: reactionCheck.error });
            return;
        }

        if (data.sessionId !== sessionId) {
            this.sendToSession(sessionId, {
                type: 'error',
                content: '세션 ID가 일치하지 않습니다.'
            });
            return;
        }

        if (!data.messageId || !data.emoji) return;
        if (!REACTION_EMOJIS.includes(data.emoji)) return;

        const messageIndex = this.messages.findIndex(msg => msg.messageId === data.messageId);
        if (messageIndex === -1) return;

        const message = this.messages[messageIndex];
        if (!message.reactions) message.reactions = {};
        if (!message.reactionSessions) message.reactionSessions = {};

        if (!message.reactionSessions[data.emoji]) {
            message.reactionSessions[data.emoji] = [];
        }
        const sessions = message.reactionSessions[data.emoji];

        if (data.action === 'add') {
            if (sessions.includes(sessionId)) return;
            if (sessions.length >= MAX_REACTIONS_PER_EMOJI) return;
            sessions.push(sessionId);
        } else if (data.action === 'remove') {
            const idx = sessions.indexOf(sessionId);
            if (idx === -1) return;
            sessions.splice(idx, 1);
        } else {
            return;
        }

        message.reactions[data.emoji] = sessions.length;

        if (message.reactions[data.emoji] === 0) {
            delete message.reactions[data.emoji];
            delete message.reactionSessions[data.emoji];
        }

        message.signature = await generateMessageSignature(message, HMAC_SECRET);
        await this.state.storage.put('messages', this.messages);

        const count = message.reactions[data.emoji] || 0;
        const reactedSessions = message.reactionSessions[data.emoji] || [];

        for (const [sid] of this.sessions) {
            this.sendToSession(sid, {
                type: 'message_reaction',
                messageId: data.messageId,
                emoji: data.emoji,
                count,
                sessionId,
                reacted: reactedSessions.includes(sid)
            });
        }
    }

    handleTyping(data, sessionId) {
        if (!sessionId) return;

        if (data.typing) {
            this.typingUsers.add(sessionId);
        } else {
            this.typingUsers.delete(sessionId);
        }

        try {
            const meta = this.userMetadata.get(sessionId);
            if (meta) {
                const nick = sanitizeInput(data.nickname || meta.nickname || DEFAULT_NICKNAME).substring(0, MAX_NICKNAME_LENGTH);
                meta.nickname = nick;
                this.userMetadata.set(sessionId, meta);
            }
        } catch (_e) {
            // ignore
        }

        this.broadcast({
            type: 'typing',
            sessionId,
            nickname: sanitizeInput(data.nickname || DEFAULT_NICKNAME).substring(0, MAX_NICKNAME_LENGTH),
            typing: data.typing
        }, sessionId);
    }

    async addAuditLog(action, details, metadata = {}) {
        const log = {
            timestamp: Date.now(),
            action,
            details,
            metadata
        };

        this.auditLogs.push(log);

        if (this.auditLogs.length > MAX_AUDIT_LOGS) {
            this.auditLogs = this.auditLogs.slice(-MAX_AUDIT_LOGS);
        }

        logAuditLog(this.env?.DB_ADMIN, action, details, metadata).catch(err => {
            console.error('Failed to save audit log to D1', err);
        });

        return log;
    }

    broadcast(message, excludeSessionId = null) {
        const deadSessions = [];
        for (const [sessionId, websocket] of this.sessions) {
            if (sessionId !== excludeSessionId) {
                try {
                    websocket.send(JSON.stringify(message));
                } catch (error) {
                    console.error('Broadcast error:', error);
                    deadSessions.push(sessionId);
                }
            }
        }
        for (const sid of deadSessions) {
            this.sessions.delete(sid);
            this.typingUsers.delete(sid);
            const meta = this.userMetadata.get(sid);
            if (meta) {
                const ip = meta.ip;
                const currentCount = this.ipConnections.get(ip) || 0;
                if (currentCount > 1) {
                    this.ipConnections.set(ip, currentCount - 1);
                } else {
                    this.ipConnections.delete(ip);
                }
            }
        }

        if (message.type === 'message' && this.channelSlug === '0' && this.env?.PUSH_SUBSCRIPTIONS) {
            this.throttledPushNotification(message);
        }
    }

    broadcastToObservers(message) {
        const dead = [];
        for (const ws of this.observers) {
            try {
                ws.send(JSON.stringify(message));
            } catch (_e) {
                dead.push(ws);
            }
        }
        for (const ws of dead) {
            this.observers.delete(ws);
        }
    }

    throttledPushNotification(message) {
        this.pushThrottleQueue.push(message);

        if (this.pushThrottleTimer) {
            return;
        }

        this.pushThrottleTimer = setTimeout(() => {
            this.pushThrottleTimer = null;
            const latest = this.pushThrottleQueue[this.pushThrottleQueue.length - 1];
            this.pushThrottleQueue = [];
            this.sendPushNotifications(latest).catch(err => {
                console.error('[Push] Background push error:', err);
            });
        }, PUSH_THROTTLE_MS);
    }

    async sendPushNotifications(message) {
        const onlineSessionIds = new Set(this.sessions.keys());
        await sendPushToOfflineUsers(this.env, onlineSessionIds, message);
    }

    sendToSession(sessionId, message) {
        const websocket = this.sessions.get(sessionId);
        if (websocket) {
            try {
                websocket.send(JSON.stringify(message));
            } catch (error) {
                console.error('Send error:', error);
                this.sessions.delete(sessionId);
                this.typingUsers.delete(sessionId);
            }
        }
    }

    _serializeHistoryMessages(messages, clientSessionId) {
        return messages.map(msg => {
            const clone = { ...msg };
            if (clone.reactionSessions) {
                clone.reacted = {};
                for (const [emoji, sessions] of Object.entries(clone.reactionSessions)) {
                    clone.reacted[emoji] = Array.isArray(sessions) && sessions.includes(clientSessionId);
                }
                delete clone.reactionSessions;
            }
            return clone;
        });
    }

    broadcastUserCount() {
        this.broadcast({
            type: 'user_count',
            count: this.sessions.size
        });
    }

    async cleanup() {
        if (this.pushThrottleTimer) {
            clearTimeout(this.pushThrottleTimer);
            this.pushThrottleTimer = null;
            this.pushThrottleQueue = [];
        }

        const now = Date.now();

        let bansChanged = false;
        for (const [ip, banInfo] of this.bannedIPs.entries()) {
            if (now >= banInfo.bannedUntil) {
                this.bannedIPs.delete(ip);
                bansChanged = true;
            }
        }
        if (bansChanged) {
            await this.state.storage.put('bannedIPs', Array.from(this.bannedIPs.entries()));
            notifyAdmin(this, 'ip_unbanned', { reason: 'expired' });
        }

        let sessionBansChanged = false;
        for (const [sessionId, banInfo] of this.bannedSessions.entries()) {
            if (now >= banInfo.bannedUntil) {
                this.bannedSessions.delete(sessionId);
                sessionBansChanged = true;
            }
        }
        if (sessionBansChanged) {
            await this.state.storage.put('bannedSessions', Array.from(this.bannedSessions.entries()));
            notifyAdmin(this, 'session_unbanned', { reason: 'expired' });
        }

        let tokenBansChanged = false;
        for (const [token, banInfo] of this.bannedTokens.entries()) {
            if (now >= banInfo.bannedUntil) {
                this.bannedTokens.delete(token);
                tokenBansChanged = true;
            }
        }
        if (tokenBansChanged) {
            await this.state.storage.put('bannedTokens', Array.from(this.bannedTokens.entries()));
            notifyAdmin(this, 'token_expired', { reason: 'expired' });
        }

        let sessionsRemoved = false;
        for (const [sessionId, metadata] of this.userMetadata) {
            const lastActivity = metadata.lastActivityTime || metadata.lastMessageTime || metadata.joinTime;
            if (now - lastActivity > SESSION_TIMEOUT_MS && now - metadata.joinTime > SESSION_TIMEOUT_MS) {
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
                sessionsRemoved = true;
            }
        }
        if (sessionsRemoved && this.channelSlug !== '0' && this.sessions.size === 0 && this.emptySince === null) {
            this.emptySince = Date.now();
        }

        const twelveHoursAgo = now - MESSAGE_RETENTION_MS;
        const initialLength = this.messages.length;
        this.messages = this.messages.filter(msg => msg.timestamp > twelveHoursAgo);

        let announcementChanged = false;
        if (this.currentAnnouncement && this.currentAnnouncement.isEmergency && this.currentAnnouncement.emergencyUntil && now >= this.currentAnnouncement.emergencyUntil) {
            this.currentAnnouncement.isEmergency = false;
            this.currentAnnouncement.emergencyUntil = null;
            announcementChanged = true;
            this.broadcast({ type: 'emergency_cleared' });
        }

        if (this.currentAnnouncement && this.currentAnnouncement.scheduleAt && now >= this.currentAnnouncement.scheduleAt) {
            const announcementMessage = {
                type: 'announcement',
                content: this.currentAnnouncement.content,
                timestamp: this.currentAnnouncement.timestamp,
                isEmergency: isEmergencyActive(this.currentAnnouncement),
                emergencyUntil: this.currentAnnouncement.emergencyUntil
            };
            this.broadcast(announcementMessage);
            delete this.currentAnnouncement.scheduleAt;
            announcementChanged = true;
        }

        if (this.currentAnnouncement && !this.currentAnnouncement.isEmergency && this.currentAnnouncement.expiresAt && now >= this.currentAnnouncement.expiresAt) {
            if (this.announcementHistory.length > 0) {
                const next = this.announcementHistory[0];
                if (next.timestamp !== this.currentAnnouncement.timestamp) {
                    this.currentAnnouncement = next;
                } else {
                    this.currentAnnouncement = null;
                }
            } else {
                this.currentAnnouncement = null;
            }
            announcementChanged = true;
        }

        if (announcementChanged) {
            await this.state.storage.put('currentAnnouncement', this.currentAnnouncement);
        }

        if (this.messages.length !== initialLength) {
            await this.state.storage.put('messages', this.messages);
        }

        if (this.emptySince !== null && this.channelSlug !== '0') {
            if (now - this.emptySince > CHANNEL.EMPTY_TTL) {
                this.deleteChannel();
            }
        }
    }

    async touchRegistry() {
        try {
            const registryId = this.env.CHANNEL_REGISTRY.idFromName('registry');
            const registry = this.env.CHANNEL_REGISTRY.get(registryId);
            await registry.fetch(new Request('https://dummy/touch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Internal-Token': this.env.HMAC_SECRET },
                body: JSON.stringify({ slug: this.channelSlug })
            }));
        } catch (error) {
            console.error('Failed to touch registry:', error);
        }
    }

    async deleteChannel() {
        if (this.channelSlug === '0') return;

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        this.sessions.clear();
        this.ipConnections.clear();
        this.userMetadata.clear();
        this.typingUsers.clear();
        this.messages = [];
        this.bannedIPs.clear();
        this.bannedSessions.clear();
        this.auditLogs = [];
        this.errorLogs = [];
        this.currentAnnouncement = null;

        try {
            await this.state.storage.deleteAll();
        } catch (error) {
            console.error('Failed to delete channel storage:', error);
        }

        try {
            const registryId = this.env.CHANNEL_REGISTRY.idFromName('registry');
            const registry = this.env.CHANNEL_REGISTRY.get(registryId);
            await registry.fetch(new Request('https://dummy/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Internal-Token': this.env.HMAC_SECRET },
                body: JSON.stringify({ slug: this.channelSlug })
            }));
        } catch (error) {
            console.error('Failed to notify registry of channel deletion:', error);
        }

        this.emptySince = null;
        this.channelSlug = '0';
    }
}
