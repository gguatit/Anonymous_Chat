import { RATE_LIMIT, SECURITY, metrics } from '../config/constants.js';
import { generateMessageSignature, verifyMessageSignature } from '../utils/helpers.js';
import { sendPushToOfflineUsers } from '../handlers/push.js';

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
        this.startTime = Date.now(); // Track uptime
        this.bannedIPs = new Map(); // IP -> { bannedUntil: timestamp, reason: string }
        this.bannedSessions = new Map(); // sessionId -> { bannedUntil: timestamp, reason: string }
        this.currentAnnouncement = null; // Current active announcement
        this.announcementHistory = []; // History of all announcements
        this.auditLogs = []; // Audit logs for admin actions
        this.errorLogs = []; // Ring buffer for detailed errors
        this.MAX_ERROR_LOGS = 100;
        this.pushThrottleTimer = null;
        this.pushThrottleQueue = [];

        // Periodic cleanup of stale data (every 5 minutes)
        this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
    }

    addErrorLog(type, error, environment = {}, context = '') {
        const log = {
            timestamp: new Date().toISOString(),
            type,
            message: error instanceof Error ? error.message : String(error),
            stackTrace: error instanceof Error ? error.stack : 'No stack trace',
            location: this.extractErrorLocation(error),
            environment: environment || {},
            context
        };
        
        this.errorLogs.unshift(log);
        if (this.errorLogs.length > this.MAX_ERROR_LOGS) {
            this.errorLogs.pop();
        }

        // Save to persistent storage without awaiting to prevent blocking
        this.state.storage.put('errorLogs', this.errorLogs).catch(err => {
            console.error('Failed to save error logs to storage', err);
        });
    }

    extractErrorLocation(error) {
        if (error instanceof Error && error.stack) {
            const lines = error.stack.split('\n');
            // get the first location line (usually the second line in stack)
            if (lines.length > 1) {
                return lines[1].trim();
            }
        }
        return 'Unknown';
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

        // Load banned IPs from storage
        const bannedIPs = await this.state.storage.get('bannedIPs');
        if (bannedIPs) {
            this.bannedIPs = new Map(bannedIPs);
        }

        // Load banned sessions from storage
        const bannedSessions = await this.state.storage.get('bannedSessions');
        if (bannedSessions) {
            this.bannedSessions = new Map(bannedSessions);
        }

        // Load audit logs from storage
        const auditLogs = await this.state.storage.get('auditLogs');
        if (auditLogs) {
            this.auditLogs = auditLogs;
        }

        // Load current announcement from storage
        const announcement = await this.state.storage.get('currentAnnouncement');
        if (announcement) {
            this.currentAnnouncement = announcement;
        }

        // Load announcement history from storage
        const announcementHistory = await this.state.storage.get('announcementHistory');
        if (announcementHistory) {
            this.announcementHistory = announcementHistory;
        }

        // Load error logs from storage
        const errorLogs = await this.state.storage.get('errorLogs');
        if (errorLogs) {
            this.errorLogs = errorLogs;
        }

        this.initialized = true;
    }

    async fetch(request) {
        // Get HMAC_SECRET from request headers
        const HMAC_SECRET = request.headers.get('X-HMAC-Secret') || request.headers.get('X-Admin-Internal-Token');

        const url = new URL(request.url);

        // Security check for internal admin routes
        if (url.pathname.startsWith('/admin/')) {
            if (HMAC_SECRET !== this.env.HMAC_SECRET) {
                this.addErrorLog('SECURITY', 'Unauthorized DO Admin Access Attempt', {}, `Path: ${url.pathname}`);
                return new Response('Forbidden', { status: 403 });
            }
        }

        // Admin API endpoints
        if (url.pathname === '/admin/metrics') {
            return new Response(JSON.stringify({
                activeConnections: this.sessions.size,
                totalMessages: this.messages.length,
                totalConnections: metrics.totalConnections,
                errors: this.errorLogs ? this.errorLogs.length : 0,
                uptime: Date.now() - (this.startTime || Date.now()),
                errorLogs: this.errorLogs
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url.pathname === '/admin/sessions') {
            const sessions = Array.from(this.userMetadata.entries()).map(([sessionId, metadata]) => ({
                sessionId,
                ip: metadata.ip,
                joinTime: metadata.joinTime,
                messageCount: metadata.messageCount,
                lastMessageTime: metadata.lastMessageTime,
                lastActivityTime: metadata.lastActivityTime,
                nickname: metadata.nickname || '익명',
                isOnline: this.sessions.has(sessionId),
                country: metadata.environment?.country || '',
                userAgent: metadata.environment?.userAgent || ''
            }));

            return new Response(JSON.stringify(sessions), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url.pathname === '/admin/messages') {
            return new Response(JSON.stringify(this.messages), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url.pathname === '/admin/broadcast' && request.method === 'POST') {
            return await this.handleAdminBroadcast(request, HMAC_SECRET);
        }

        if (url.pathname === '/admin/edit-message' && request.method === 'POST') {
            return await this.handleAdminEditMessage(request, HMAC_SECRET);
        }

        if (url.pathname === '/admin/delete-message' && request.method === 'POST') {
            return await this.handleAdminDeleteMessage(request);
        }

        if (url.pathname === '/admin/delete-all-messages' && request.method === 'POST') {
            return await this.handleAdminDeleteAllMessages(request);
        }

        if (url.pathname === '/admin/kick-user' && request.method === 'POST') {
            return await this.handleAdminKickUser(request);
        }

        if (url.pathname === '/admin/announce' && request.method === 'POST') {
            return await this.handleAdminAnnounce(request);
        }
        
        if (url.pathname === '/admin/announce' && request.method === 'PUT') {
            return await this.handleAdminEditAnnounce(request);
        }
        
        if (url.pathname === '/admin/announce' && request.method === 'DELETE') {
            return await this.handleAdminDeleteAnnounce(request);
        }

        if (url.pathname === '/announcement-history') {
            await this.initializeMessages();
            return new Response(JSON.stringify(this.announcementHistory), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url.pathname === '/search') {
            await this.initializeMessages();
            const query = url.searchParams.get('q') || '';
            const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
            return this.handleSearch(query, limit);
        }

        if (url.pathname === '/admin/banned-ips') {
            return await this.handleAdminBannedIPs();
        }

        if (url.pathname === '/admin/unban-ip' && request.method === 'POST') {
            return await this.handleAdminUnbanIP(request);
        }

        if (url.pathname === '/admin/user-details') {
            return await this.handleAdminUserDetails(url);
        }

        if (url.pathname === '/admin/audit-logs') {
            return await this.handleAdminAuditLogs();
        }

        if (url.pathname === '/admin/delete-audit-logs' && request.method === 'POST') {
            this.auditLogs = [];
            await this.state.storage.delete('auditLogs');
            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url.pathname === '/check-ban') {
            return await this.handleCheckBan(url, request);
        }

        if (url.pathname === '/admin/delete-error-logs' && request.method === 'POST') {
            this.errorLogs = [];
            await this.state.storage.delete('errorLogs');
            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url.pathname === '/api/logs/error' && request.method === 'POST') {
            try {
                const logData = await request.json();
                this.addErrorLog('CLIENT_ERROR', new Error(logData.message), logData.environment, logData.context);
                return new Response('OK', { status: 200 });
            } catch (e) {
                return new Response('Error', { status: 400 });
            }
        }

        // Initialize messages from storage on first request
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

        // Check if IP is banned
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
                // Ban expired, remove it
                this.bannedIPs.delete(clientIP);
                await this.state.storage.put('bannedIPs', Array.from(this.bannedIPs.entries()));
            }
        }

        // Check IP-based connection limit
        const currentConnections = this.ipConnections.get(clientIP) || 0;
        if (currentConnections >= RATE_LIMIT.MAX_CONNECTIONS_PER_IP) {
            return new Response('Too many connections from this IP', { status: 429 });
        }

        // Create WebSocket pair
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);

        // Accept the WebSocket connection
        await this.handleSession(server, clientIP, HMAC_SECRET, environment);

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }

    async handleAdminBroadcast(request, HMAC_SECRET) {
        try {
            const data = await request.json();
            const content = typeof data.content === 'string' ? data.content : '';
            const file = data.file || null;
            const adminId = data.adminId || 'admin';

            if (!content && !file) {
                return new Response(JSON.stringify({ error: 'Empty message' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            // Generate unique message ID
            const messageId = `msg_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;

            const message = {
                type: 'message',
                messageId: messageId,
                content: this.sanitizeInput(content || ''),
                sessionId: `admin_${adminId}`,
                timestamp: Date.now(),
                editedAt: null
            };

            if (file && file.url) {
                message.file = {
                    url: file.url,
                    filename: file.filename || '',
                    filesize: file.filesize || null,
                    filetype: file.filetype || ''
                };
            }

            if (HMAC_SECRET) {
                message.signature = await generateMessageSignature(message, HMAC_SECRET);
            } else {
                message.signature = '';
            }

            this.messages.push(message);

            // Clean up messages older than 12 hours and limit to 500 messages
            const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);
            this.messages = this.messages
                .filter(msg => msg.timestamp > twelveHoursAgo)
                .slice(-500);

            // Persist to Durable Object storage
            this.state.storage.put('messages', this.messages);

            // Broadcast message to all users
            this.broadcast(message);

            return new Response(JSON.stringify({ success: true, message }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('admin broadcast error:', error);
            return new Response(JSON.stringify({ error: 'Failed to broadcast' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    async handleAdminEditMessage(request, HMAC_SECRET) {
        try {
            const data = await request.json();
            const messageId = data.messageId;
            const newContent = data.newContent;

            if (!messageId || !newContent) {
                return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Find the message
            const messageIndex = this.messages.findIndex(msg => msg.messageId === messageId);

            if (messageIndex === -1) {
                return new Response(JSON.stringify({ error: 'Message not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const originalMessage = this.messages[messageIndex];

            // Verify it's an admin message
            if (!originalMessage.sessionId || !String(originalMessage.sessionId).startsWith('admin_')) {
                return new Response(JSON.stringify({ error: 'Not an admin message' }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const now = Date.now();

            // Update message
            const editedMessage = {
                ...originalMessage,
                content: this.sanitizeInput(newContent),
                editedAt: now
            };

            // Generate new signature
            if (HMAC_SECRET) {
                editedMessage.signature = await generateMessageSignature(editedMessage, HMAC_SECRET);
            }

            // Update in messages array
            this.messages[messageIndex] = editedMessage;

            // Persist to storage
            this.state.storage.put('messages', this.messages);

            // Broadcast edited message to all users
            this.broadcast({
                type: 'message_edited',
                message: editedMessage
            });

            // Add audit log
            await this.addAuditLog('edit_message', `Edited message ${messageId}`, {
                messageId,
                originalContent: originalMessage.content.substring(0, 50),
                newContent: newContent.substring(0, 50)
            });

            return new Response(JSON.stringify({ success: true, message: editedMessage }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('admin edit message error:', error);
            return new Response(JSON.stringify({ error: 'Failed to edit message' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    async handleAdminDeleteMessage(request) {
        try {
            const data = await request.json();
            const messageId = data.messageId;

            if (!messageId) {
                return new Response(JSON.stringify({ error: 'Missing messageId' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Find the message
            const messageIndex = this.messages.findIndex(msg => msg.messageId === messageId);

            if (messageIndex === -1) {
                return new Response(JSON.stringify({ error: 'Message not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const messageToDelete = this.messages[messageIndex];

            // Remove message from array
            this.messages.splice(messageIndex, 1);

            // Persist to storage
            this.state.storage.put('messages', this.messages);

            // Broadcast deletion to all users
            this.broadcast({
                type: 'message_deleted',
                messageId: messageId
            });

            // Add audit log with more details
            await this.addAuditLog('admin_delete_message', `Admin deleted message ${messageId} from user ${messageToDelete.sessionId}`, {
                messageId,
                originalSessionId: messageToDelete.sessionId,
                content: messageToDelete.content ? messageToDelete.content.substring(0, 50) : '(file only)',
                hasFile: !!messageToDelete.file
            });

            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('admin delete message error:', error);
            return new Response(JSON.stringify({ error: 'Failed to delete message' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    async handleAdminDeleteAllMessages(request) {
        try {
            const data = await request.json();
            const confirmation = data.confirmation;

            if (confirmation !== 'DELETE_ALL_MESSAGES') {
                return new Response(JSON.stringify({ error: 'Invalid confirmation' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const messageCount = this.messages.length;

            // Clear all messages
            this.messages = [];

            // Persist to storage
            await this.state.storage.put('messages', this.messages);

            // Broadcast clear to all users
            this.broadcast({
                type: 'all_messages_deleted'
            });

            // Add audit log
            await this.addAuditLog('admin_delete_all_messages', `Admin deleted all messages (${messageCount} messages)`, {
                deletedCount: messageCount
            });

            return new Response(JSON.stringify({
                success: true,
                deletedCount: messageCount
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('admin delete all messages error:', error);
            return new Response(JSON.stringify({ error: 'Failed to delete all messages' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    async handleAdminKickUser(request) {
        try {
            const data = await request.json();
            const sessionId = data.sessionId;
            const banDuration = data.banDuration || 0;

            if (!sessionId) {
                return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Find the session
            const websocket = this.sessions.get(sessionId);
            const metadata = this.userMetadata.get(sessionId);

            if (!websocket && !metadata) {
                return new Response(JSON.stringify({ error: 'Session not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const clientIP = metadata?.ip;

            // Detect shared IP (NAT/internal network)
            const ipConnectionCount = clientIP ? (this.ipConnections.get(clientIP) || 0) : 0;
            const isSharedIP = ipConnectionCount > 1;

            // Ban IP and Session if duration is specified
            if (banDuration > 0) {
                const bannedUntil = Date.now() + (banDuration * 1000);

                // Always ban the specific session
                this.bannedSessions.set(sessionId, {
                    bannedUntil,
                    reason: 'Admin kick',
                    ip: clientIP
                });
                await this.state.storage.put('bannedSessions', Array.from(this.bannedSessions.entries()));

                // Ban IP only if NOT shared (to avoid banning innocent users on same network)
                if (clientIP && !isSharedIP) {
                    this.bannedIPs.set(clientIP, {
                        bannedUntil,
                        reason: 'Admin kick',
                        sessionId
                    });
                    await this.state.storage.put('bannedIPs', Array.from(this.bannedIPs.entries()));
                }

                if (isSharedIP) {
                    // Shared IP: only kick the target session
                    if (websocket) {
                        try {
                            websocket.send(JSON.stringify({
                                type: 'kicked',
                                content: `관리자에 의해 ${banDuration}초간 차단되었습니다.`,
                                banDuration,
                                permanent: true,
                                sessionBan: true
                            }));
                            websocket.close(1008, 'Kicked by admin');
                        } catch (e) {
                            console.error('Failed to kick session:', e);
                        }
                    }
                    this.sessions.delete(sessionId);
                    this.userMetadata.delete(sessionId);
                    this.typingUsers.delete(sessionId);

                    // Decrement IP connection count (don't delete, other users still connected)
                    if (clientIP) {
                        const currentCount = this.ipConnections.get(clientIP) || 0;
                        if (currentCount > 1) {
                            this.ipConnections.set(clientIP, currentCount - 1);
                        } else {
                            this.ipConnections.delete(clientIP);
                        }
                    }
                } else {
                    // Single IP: kick all sessions from this IP (original behavior)
                    for (const [sid, ws] of this.sessions.entries()) {
                        const meta = this.userMetadata.get(sid);
                        const shouldKick = sid === sessionId || (meta && meta.ip === clientIP);

                        if (shouldKick) {
                            try {
                                ws.send(JSON.stringify({
                                    type: 'kicked',
                                    content: `관리자에 의해 ${banDuration}초간 차단되었습니다.`,
                                    banDuration,
                                    permanent: true
                                }));
                                ws.close(1008, 'Kicked by admin');
                            } catch (e) {
                                console.error('Failed to kick session:', e);
                            }
                            this.sessions.delete(sid);
                            this.userMetadata.delete(sid);
                            this.typingUsers.delete(sid);
                        }
                    }

                    // Delete IP connection count entirely
                    this.ipConnections.delete(clientIP);
                }
            } else {
                // Just kick without ban
                if (websocket) {
                    try {
                        websocket.send(JSON.stringify({
                            type: 'kicked',
                            content: '관리자에 의해 강제퇴장되었습니다.'
                        }));
                        websocket.close(1008, 'Kicked by admin');
                    } catch (e) {
                        console.error('Failed to send kick notification:', e);
                    }
                }

                // Clean up session data
                this.sessions.delete(sessionId);
                if (metadata && clientIP) {
                    const currentCount = this.ipConnections.get(clientIP) || 0;
                    if (currentCount > 1) {
                        this.ipConnections.set(clientIP, currentCount - 1);
                    } else {
                        this.ipConnections.delete(clientIP);
                    }
                }
                this.userMetadata.delete(sessionId);
                this.typingUsers.delete(sessionId);
            }

            metrics.activeConnections = this.sessions.size;
            this.broadcastUserCount();

            // Add audit log
            const banType = isSharedIP ? 'session_only' : 'ip_and_session';
            await this.addAuditLog('kick_user', `Kicked session ${sessionId}`, {
                sessionId,
                ip: clientIP,
                banDuration,
                banned: banDuration > 0,
                sharedIP: isSharedIP,
                banType
            });

            return new Response(JSON.stringify({
                success: true,
                banned: banDuration > 0,
                banDuration,
                ip: clientIP,
                sharedIP: isSharedIP,
                banType
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('admin kick user error:', error);
            return new Response(JSON.stringify({ error: 'Failed to kick user' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    async handleAdminEditAnnounce(request) {
        try {
            const data = await request.json();
            const timestamp = Number(data.timestamp);
            const content = typeof data.content === 'string' ? data.content : '';

            if (!timestamp || !content) {
                return new Response(JSON.stringify({ error: 'Missing timestamp or content' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const announcementIndex = this.announcementHistory.findIndex(a => a.timestamp === timestamp);
            if (announcementIndex === -1) {
                return new Response(JSON.stringify({ error: 'Announcement not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            this.announcementHistory[announcementIndex].content = this.sanitizeInput(content);
            await this.state.storage.put('announcementHistory', this.announcementHistory);

            // Update currentAnnouncement if it matches
            if (this.currentAnnouncement && this.currentAnnouncement.timestamp === timestamp) {
                this.currentAnnouncement.content = this.announcementHistory[announcementIndex].content;
                await this.state.storage.put('currentAnnouncement', this.currentAnnouncement);
            }

            await this.addAuditLog('edit_announcement', `Edited announcement from timestamp ${timestamp}: ${content.substring(0, 50)}...`, {
                timestamp
            });

            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('admin edit announce error:', error);
            return new Response(JSON.stringify({ error: 'Failed to edit announcement' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    async handleAdminDeleteAnnounce(request) {
        try {
            const data = await request.json();
            const timestamp = Number(data.timestamp);

            if (!timestamp) {
                return new Response(JSON.stringify({ error: 'Missing timestamp' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const announcementIndex = this.announcementHistory.findIndex(a => a.timestamp === timestamp);
            if (announcementIndex === -1) {
                return new Response(JSON.stringify({ error: 'Announcement not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            this.announcementHistory.splice(announcementIndex, 1);
            await this.state.storage.put('announcementHistory', this.announcementHistory);

            // Update currentAnnouncement if it matches
            if (this.currentAnnouncement && this.currentAnnouncement.timestamp === timestamp) {
                if (this.announcementHistory.length > 0) {
                    this.currentAnnouncement = this.announcementHistory[0];
                    await this.state.storage.put('currentAnnouncement', this.currentAnnouncement);
                } else {
                    this.currentAnnouncement = null;
                    await this.state.storage.delete('currentAnnouncement');
                }
            }

            await this.addAuditLog('delete_announcement', `Deleted announcement from timestamp ${timestamp}`, {
                timestamp
            });

            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('admin delete announce error:', error);
            return new Response(JSON.stringify({ error: 'Failed to delete announcement' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    async handleAdminAnnounce(request) {
        try {
            const data = await request.json();
            const content = typeof data.content === 'string' ? data.content : '';

            if (!content) {
                return new Response(JSON.stringify({ error: 'Empty content' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            console.log('Broadcasting announcement:', content.substring(0, 50));

            // Save new announcement (replaces old one)
            this.currentAnnouncement = {
                content: this.sanitizeInput(content),
                timestamp: Date.now()
            };
            await this.state.storage.put('currentAnnouncement', this.currentAnnouncement);

            // Append to announcement history (newest first, keep up to 100)
            this.announcementHistory.unshift(this.currentAnnouncement);
            if (this.announcementHistory.length > 100) {
                this.announcementHistory = this.announcementHistory.slice(0, 100);
            }
            await this.state.storage.put('announcementHistory', this.announcementHistory);

            // Broadcast system announcement to all users
            const announcementMessage = {
                type: 'announcement',
                content: this.currentAnnouncement.content,
                timestamp: this.currentAnnouncement.timestamp
            };

            console.log('Active sessions:', this.sessions.size);
            this.broadcast(announcementMessage);

            // Add audit log
            await this.addAuditLog('send_announcement', `Sent announcement: ${content.substring(0, 50)}...`, {
                contentLength: content.length,
                sessionsNotified: this.sessions.size
            });

            return new Response(JSON.stringify({
                success: true,
                sessionsNotified: this.sessions.size
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('admin announce error:', error);
            return new Response(JSON.stringify({ error: 'Failed to send announcement' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    async handleAdminBannedIPs() {
        const now = Date.now();
        const bannedList = [];

        for (const [ip, banInfo] of this.bannedIPs.entries()) {
            if (now < banInfo.bannedUntil) {
                bannedList.push({
                    ip,
                    bannedUntil: banInfo.bannedUntil,
                    remainingSeconds: Math.ceil((banInfo.bannedUntil - now) / 1000),
                    reason: banInfo.reason || 'No reason provided',
                    bannedAt: banInfo.bannedAt || (banInfo.bannedUntil - (banInfo.duration || 0) * 1000)
                });
            }
        }

        return new Response(JSON.stringify(bannedList), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    async handleAdminUnbanIP(request) {
        try {
            const data = await request.json();
            const ip = data.ip;

            if (!ip) {
                return new Response(JSON.stringify({ error: 'Missing IP' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            this.bannedIPs.delete(ip);
            await this.state.storage.put('bannedIPs', Array.from(this.bannedIPs.entries()));

            // Add audit log
            await this.addAuditLog('UNBAN_IP', `Unbanned IP: ${ip}`);

            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('unban ip error:', error);
            return new Response(JSON.stringify({ error: 'Failed to unban IP' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    async handleAdminUserDetails(url) {
        const sessionId = url.searchParams.get('sessionId');

        if (!sessionId) {
            return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const metadata = this.userMetadata.get(sessionId);
        const userMessages = this.messages.filter(m => m.sessionId === sessionId);
        const isOnline = this.sessions.has(sessionId);

        return new Response(JSON.stringify({
            sessionId,
            metadata: metadata || null,
            messages: userMessages,
            messageCount: userMessages.length,
            isOnline,
            firstMessage: userMessages.length > 0 ? userMessages[0].timestamp : null,
            lastMessage: userMessages.length > 0 ? userMessages[userMessages.length - 1].timestamp : null
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    async handleAdminAuditLogs() {
        // Return last 100 audit logs
        const logs = this.auditLogs.slice(-100).reverse();

        return new Response(JSON.stringify(logs), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    async handleCheckBan(url, request) {
        const ip = url.searchParams.get('ip') || request.headers.get('CF-Connecting-IP') || 'unknown';
        const sessionId = url.searchParams.get('sessionId');
        const now = Date.now();

        // Check session ban first
        if (sessionId) {
            const sessionBanInfo = this.bannedSessions.get(sessionId);
            if (sessionBanInfo && now < sessionBanInfo.bannedUntil) {
                const remainingSeconds = Math.ceil((sessionBanInfo.bannedUntil - now) / 1000);
                return new Response(JSON.stringify({
                    banned: true,
                    remainingSeconds,
                    message: `이 세션은 ${remainingSeconds}초 동안 차단되었습니다.`
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } else if (sessionBanInfo) {
                // Session ban expired, remove it
                this.bannedSessions.delete(sessionId);
                await this.state.storage.put('bannedSessions', Array.from(this.bannedSessions.entries()));
            }
        }

        // Check IP ban
        const banInfo = this.bannedIPs.get(ip);
        if (banInfo) {
            if (now < banInfo.bannedUntil) {
                const remainingSeconds = Math.ceil((banInfo.bannedUntil - now) / 1000);
                return new Response(JSON.stringify({
                    banned: true,
                    remainingSeconds,
                    message: `이 IP는 ${remainingSeconds}초 동안 차단되었습니다.`
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } else {
                // Ban expired, remove it
                this.bannedIPs.delete(ip);
                await this.state.storage.put('bannedIPs', Array.from(this.bannedIPs.entries()));
            }
        }

        return new Response(JSON.stringify({ banned: false }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    async handleSession(websocket, clientIP, HMAC_SECRET, environment) {
        websocket.accept();

        let sessionId = null;
        let metadata = null;

        websocket.addEventListener('message', async (event) => {
            try {
                // Update activity time for any interaction
                if (metadata) {
                    metadata.lastActivityTime = Date.now();
                }

                const data = JSON.parse(event.data);

                // Handle different message types
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

                    default:
                        console.log('Unknown message type:', data.type);
                }

            } catch (error) {
                metrics.errors++;
                console.error('Message handling error:', error);
                const errorEnv = metadata?.environment || (environment ? environment : {});
                this.addErrorLog('WS_MESSAGE_PARSE', error, errorEnv, '메시지 처리 중 오류 발생');
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
            const errorEnv = metadata?.environment || (environment ? environment : {});
            this.addErrorLog('WS_CONNECTION', error, errorEnv, '웹소켓 연결 오류 발생');
        });
    }

    async handleJoin(data, websocket, clientIP, setSession) {
        const sessionId = data.sessionId || this.generateSessionId();

        // Check if session is banned
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

        // Check if IP is still banned
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
            console.log('Session reconnecting:', sessionId);
            this.sessions.set(sessionId, websocket);

            metadata = existingMetadata || {
                ip: clientIP,
                joinTime: Date.now(),
                messageCount: 0,
                lastMessageTime: 0,
                lastActivityTime: now
            };
            this.userMetadata.set(sessionId, metadata);

            // Send recent messages as a batch for better performance
            const recentMessages = this.messages.slice(-50);
            if (recentMessages.length > 0) {
                this.sendToSession(sessionId, {
                    type: 'history',
                    messages: recentMessages
                });
            }

            if (this.currentAnnouncement) {
                this.sendToSession(sessionId, {
                    type: 'announcement',
                    content: this.currentAnnouncement.content,
                    timestamp: this.currentAnnouncement.timestamp
                });
            }

            this.broadcastUserCount();
        } else {
            console.log('New session joining:', sessionId);

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

            // Only show join message for truly new sessions, not reconnections
            if (!existingMetadata) {
                this.sendToSession(sessionId, {
                    type: 'system',
                    content: '채팅방에 입장했습니다.'
                });
            }

            // Send recent messages as a batch for better performance
            const recentMessages = this.messages.slice(-50);
            if (recentMessages.length > 0) {
                this.sendToSession(sessionId, {
                    type: 'history',
                    messages: recentMessages
                });
            }

            if (this.currentAnnouncement) {
                this.sendToSession(sessionId, {
                    type: 'announcement',
                    content: this.currentAnnouncement.content,
                    timestamp: this.currentAnnouncement.timestamp
                });
            }
        }

        setSession(sessionId, metadata);
    }

    async handleMessage(data, sessionId, metadata, HMAC_SECRET) {
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

        if (data.sessionId !== sessionId) {
            this.sendToSession(sessionId, {
                type: 'error',
                content: '세션 ID가 일치하지 않습니다.'
            });
            console.warn('Session ID mismatch:', data.sessionId, '!=', sessionId);
            return;
        }

        // Track the user's current nickname in metadata for admin view
        try {
            const nick = this.sanitizeInput(data.nickname || metadata.nickname || '익명').substring(0, 12);
            metadata.nickname = nick;
            this.userMetadata.set(sessionId, metadata);
        } catch (e) {
            // ignore nickname sanitization errors
        }

        const validationError = this.validateMessage(data, metadata);
        if (validationError) {
            this.sendToSession(sessionId, {
                type: 'error',
                content: validationError
            });
            return;
        }

        metadata.messageCount++;
        metadata.lastMessageTime = Date.now();
        metrics.totalMessages++;

        const messageId = `msg_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;

        const message = {
            type: 'message',
            messageId: messageId,
            content: this.sanitizeInput(data.content),
            sessionId: sessionId,
            nickname: this.sanitizeInput(data.nickname || '익명').substring(0, 12),
            timestamp: Date.now(),
            editedAt: null
        };

        // 답장 정보 추가
        if (data.replyTo) {
            message.replyTo = {
                messageId: data.replyTo.messageId,
                content: this.sanitizeInput(data.replyTo.content),
                isOwnMessage: data.replyTo.isOwnMessage
            };

            // 비밀 메시지 정보 추가
            if (data.replyTo.isSecret) {
                message.replyTo.isSecret = true;
                message.replyTo.secretId = data.replyTo.secretId;
                message.replyTo.targetSessionId = data.replyTo.targetSessionId;
            }
        }

        // Handle single file (backward compatibility)
        if (data.file && data.file.url) {
            message.file = {
                url: data.file.url,
                filename: data.file.filename,
                filesize: data.file.filesize,
                filetype: data.file.filetype
            };
        }

        // Handle multiple files
        if (data.files && Array.isArray(data.files) && data.files.length > 0) {
            message.files = data.files.map(f => ({
                url: f.url,
                filename: f.filename || '',
                filesize: f.filesize || null,
                filetype: f.filetype || ''
            }));
        }

        message.signature = await generateMessageSignature(message, HMAC_SECRET);

        this.messages.push(message);

        const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);
        this.messages = this.messages
            .filter(msg => msg.timestamp > twelveHoursAgo)
            .slice(-500);

        this.state.storage.put('messages', this.messages);

        this.broadcast(message);
    }

    async handleEdit(data, sessionId, metadata, HMAC_SECRET) {
        if (!sessionId || !metadata) {
            this.sendToSession(sessionId, {
                type: 'error',
                content: '세션이 유효하지 않습니다.'
            });
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
        const tenMinutes = 10 * 60 * 1000;
        if (now - originalMessage.timestamp > tenMinutes) {
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
            content: this.sanitizeInput(data.newContent),
            editedAt: now
        };

        editedMessage.signature = await generateMessageSignature(editedMessage, HMAC_SECRET);

        this.messages[messageIndex] = editedMessage;

        this.state.storage.put('messages', this.messages);

        this.broadcast({
            type: 'message_edited',
            message: editedMessage
        });
    }

    async handleDelete(data, sessionId) {
        if (!sessionId) {
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
        const tenMinutes = 10 * 60 * 1000;
        if (now - messageToDelete.timestamp > tenMinutes) {
            this.sendToSession(sessionId, {
                type: 'error',
                content: '메시지는 작성 후 10분 이내에만 삭제할 수 있습니다.'
            });
            return;
        }

        this.messages.splice(messageIndex, 1);

        this.state.storage.put('messages', this.messages);

        this.broadcast({
            type: 'message_deleted',
            messageId: data.messageId
        });
    }

    handleTyping(data, sessionId) {
        if (!sessionId) return;

        if (data.typing) {
            this.typingUsers.add(sessionId);
        } else {
            this.typingUsers.delete(sessionId);
        }

        // Update nickname in metadata when typing events include a nickname
        try {
            const meta = this.userMetadata.get(sessionId);
            if (meta) {
                const nick = this.sanitizeInput(data.nickname || meta.nickname || '익명').substring(0, 12);
                meta.nickname = nick;
                this.userMetadata.set(sessionId, meta);
            }
        } catch (e) {
            // ignore
        }

        this.broadcast({
            type: 'typing',
            sessionId: sessionId,
            nickname: this.sanitizeInput(data.nickname || '익명').substring(0, 12),
            typing: data.typing
        }, sessionId);
    }

    validateMessage(data, metadata) {
        const hasFile = data.file && data.file.url;
        const hasFiles = data.files && Array.isArray(data.files) && data.files.length > 0 && data.files[0].url;
        const hasContent = data.content && data.content.trim().length > 0;

        if (!hasContent && !hasFile && !hasFiles) {
            return '메시지 내용이 비어있습니다.';
        }

        if (data.content && data.content.length > SECURITY.MAX_MESSAGE_LENGTH) {
            return `메시지는 최대 ${SECURITY.MAX_MESSAGE_LENGTH}자까지 입력할 수 있습니다.`;
        }

        const now = Date.now();
        if (now - metadata.lastMessageTime < RATE_LIMIT.MESSAGE_COOLDOWN) {
            return '메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해주세요.';
        }

        const oneMinuteAgo = now - 60000;
        if (metadata.messageCount > RATE_LIMIT.MAX_MESSAGES_PER_MINUTE &&
            metadata.joinTime > oneMinuteAgo) {
            return '분당 메시지 전송 한도를 초과했습니다.';
        }

        return null;
    }

    handleSearch(query, limit) {
        if (!query || query.trim().length === 0) {
            return new Response(JSON.stringify({ results: [], total: 0 }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const tags = [];
        const terms = [];
        const parts = query.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
        for (const part of parts) {
            if (part.startsWith('#')) {
                tags.push(part.substring(1));
            } else {
                terms.push(part);
            }
        }

        if (tags.length > 0) {
            terms.length = 0;
        }

        if (tags.length === 0 && terms.length === 0) {
            return new Response(JSON.stringify({ results: [], total: 0 }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const results = [];
        const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);
        const recentMessages = this.messages.filter(msg => msg.timestamp > twelveHoursAgo);

        for (const msg of recentMessages) {
            if (results.length >= limit) break;

            if (tags.length > 0) {
                let matchesAllTags = true;
                for (const tag of tags) {
                    if (tag === 'images') {
                        const hasImage = (msg.file && msg.file.filetype && msg.file.filetype.startsWith('image/')) ||
                                       (msg.files && msg.files.some(f => f.filetype && f.filetype.startsWith('image/')));
                        if (!hasImage) {
                            matchesAllTags = false;
                            break;
                        }
                    } else if (tag === 'files') {
                        const hasNonImage = (msg.file && msg.file.filetype && !msg.file.filetype.startsWith('image/')) ||
                                          (msg.files && msg.files.some(f => f.filetype && !f.filetype.startsWith('image/')));
                        if (!hasNonImage) {
                            matchesAllTags = false;
                            break;
                        }
                    } else if (tag === 'code') {
                        if (!this.isLikelyCode(msg.content || '')) {
                            matchesAllTags = false;
                            break;
                        }
                    } else if (tag === 'url') {
                        if (!this.containsUrl(msg.content || '')) {
                            matchesAllTags = false;
                            break;
                        }
                    } else {
                        matchesAllTags = false;
                        break;
                    }
                }
                if (!matchesAllTags) continue;
            }

            if (terms.length > 0) {
                const content = (msg.content || '').toLowerCase();
                const nickname = (msg.nickname || '').toLowerCase();
                const fileName = (msg.file?.filename || '').toLowerCase();
                const matchesAllTerms = terms.every(term =>
                    content.includes(term) ||
                    nickname.includes(term) ||
                    fileName.includes(term)
                );
                if (!matchesAllTerms) continue;
            }

            let tagList = [];
            // Check single file
            if (msg.file && msg.file.filetype) {
                if (msg.file.filetype.startsWith('image/')) {
                    tagList.push('images');
                } else {
                    tagList.push('files');
                }
            }
            // Check multiple files
            if (msg.files && msg.files.length > 0) {
                const hasImage = msg.files.some(f => f.filetype && f.filetype.startsWith('image/'));
                const hasNonImage = msg.files.some(f => f.filetype && !f.filetype.startsWith('image/'));
                if (hasImage && !tagList.includes('images')) {
                    tagList.push('images');
                }
                if (hasNonImage && !tagList.includes('files')) {
                    tagList.push('files');
                }
            }
            if (this.isLikelyCode(msg.content || '')) {
                tagList.push('code');
            }
            if (this.containsUrl(msg.content || '')) {
                tagList.push('url');
            }

            results.push({
                messageId: msg.messageId,
                content: msg.content || '',
                nickname: msg.nickname || 'Anonymous',
                sessionId: msg.sessionId,
                timestamp: msg.timestamp,
                hasFile: !!(msg.file),
                fileName: msg.file?.filename || null,
                fileType: msg.file?.filetype || null,
                tags: tagList
            });
        }

        return new Response(JSON.stringify({ results, total: results.length }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    isLikelyCode(content) {
        if (!content || typeof content !== 'string') return false;
        if (/```/.test(content)) return true;
        const trimmed = content.trim();
        const lines = trimmed.split(/\r?\n/);
        if (lines.length < 2) return false;
        if (lines.length > 50) return true;
        if (/^(#!\/bin\/|import\s|from\s|export\s|const\s|let\s|var\s|function[\s(]|class\s|def\s|return\s|#include|#define|using\s|namespace\s|public\s|private\s|SELECT\s|INSERT\s|CREATE\s)/mi.test(trimmed)) return true;
        let codeEndingLines = 0;
        for (const line of lines) {
            const t = line.trim();
            if (/[;{})\]]=?>?\s*$/.test(t) && t.length > 1) codeEndingLines++;
        }
        if (codeEndingLines / lines.length > 0.4) return true;
        const codeChars = (trimmed.match(/[{}();=<>]/g) || []).length;
        if (codeChars / trimmed.length > 0.08) return true;
        return false;
    }

    containsUrl(content) {
        if (!content || typeof content !== 'string') return false;
        // Match http/https URLs and common URL patterns
        return /https?:\/\/[^\s<>"{}|^`[\]]+/i.test(content) ||
               /www\.[a-zA-Z0-9][-a-zA-Z0-9]*[a-zA-Z0-9]*(\.[a-zA-Z]{2,})+/i.test(content);
    }

    sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        // Remove control characters
        let cleaned = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        // Normalize line breaks (HTML escaping is handled client-side at render time)
        return cleaned.replace(/\r\n?/g, '\n');
    }

    generateSessionId() {
        // Use only cryptographically secure random values
        const randomPart1 = crypto.randomUUID().replace(/-/g, '');
        const randomPart2 = crypto.randomUUID().replace(/-/g, '').substring(0, 8);
        return `user_${randomPart1.substring(0, 16)}${randomPart2}`;
    }

    async addAuditLog(action, details, metadata = {}) {
        const log = {
            timestamp: Date.now(),
            action,
            details,
            metadata
        };

        this.auditLogs.push(log);

        if (this.auditLogs.length > 500) {
            this.auditLogs = this.auditLogs.slice(-500);
        }

        await this.state.storage.put('auditLogs', this.auditLogs);

        return log;
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

        // Send push notifications to offline subscribers (fire-and-forget, throttled)
        if (message.type === 'message' && this.env?.PUSH_SUBSCRIPTIONS) {
            this.throttledPushNotification(message);
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
        }, 1500);
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
        if (this.pushThrottleTimer) {
            clearTimeout(this.pushThrottleTimer);
            this.pushThrottleTimer = null;
            this.pushThrottleQueue = [];
        }

        const now = Date.now();
        const sessionTimeout = 1800000; // 30 minutes
        const messageRetention = 12 * 60 * 60 * 1000;

        let bansChanged = false;
        for (const [ip, banInfo] of this.bannedIPs.entries()) {
            if (now >= banInfo.bannedUntil) {
                this.bannedIPs.delete(ip);
                bansChanged = true;
            }
        }
        if (bansChanged) {
            this.state.storage.put('bannedIPs', Array.from(this.bannedIPs.entries()));
        }

        let sessionBansChanged = false;
        for (const [sessionId, banInfo] of this.bannedSessions.entries()) {
            if (now >= banInfo.bannedUntil) {
                this.bannedSessions.delete(sessionId);
                sessionBansChanged = true;
            }
        }
        if (sessionBansChanged) {
            this.state.storage.put('bannedSessions', Array.from(this.bannedSessions.entries()));
        }

        for (const [sessionId, metadata] of this.userMetadata) {
            const lastActivity = metadata.lastActivityTime || metadata.lastMessageTime || metadata.joinTime;
            if (now - lastActivity > sessionTimeout && now - metadata.joinTime > sessionTimeout) {
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

        const twelveHoursAgo = now - messageRetention;
        const initialLength = this.messages.length;
        this.messages = this.messages.filter(msg => msg.timestamp > twelveHoursAgo);

        if (this.messages.length !== initialLength) {
            this.state.storage.put('messages', this.messages);
        }
    }
}
