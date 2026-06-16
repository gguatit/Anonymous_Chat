import { ADMIN, metrics, MAX_STORED_MESSAGES, FORCE_DELETE_DELAY_MS, MESSAGE_PREVIEW_COUNT } from '../../config/constants.js';
import { sanitizeInput, safeJson, generateMessageSignature } from '../../utils/helpers.js';
import { isEmergencyActive } from './announcements.js';

export async function dispatchAdminRoute(chatRoom, url, request, HMAC_SECRET) {
    if (url.pathname === '/admin/metrics') {
        return new Response(JSON.stringify({
            activeConnections: chatRoom.sessions.size,
            totalMessages: chatRoom.messages.length,
            totalConnections: metrics.totalConnections,
            errors: chatRoom.errorLogs ? chatRoom.errorLogs.length : 0,
            uptime: Date.now() - (chatRoom.startTime || Date.now()),
            errorLogs: chatRoom.errorLogs
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (url.pathname === '/admin/info') {
        const sessions = chatRoom.getSessionList();
        return new Response(JSON.stringify({
            slug: chatRoom.channelSlug || '0',
            activeConnections: chatRoom.sessions.size,
            totalMessages: chatRoom.messages.length,
            totalConnections: metrics.totalConnections,
            errors: chatRoom.errorLogs ? chatRoom.errorLogs.length : 0,
            uptime: Date.now() - (chatRoom.startTime || Date.now()),
            sessions,
            messages: chatRoom.messages.slice(-MESSAGE_PREVIEW_COUNT)
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (url.pathname === '/admin/sessions') {
        const sessions = chatRoom.getSessionList();
        return new Response(JSON.stringify(sessions), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (url.pathname === '/admin/messages') {
        return new Response(JSON.stringify(chatRoom.messages), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (url.pathname === '/admin/broadcast' && request.method === 'POST') {
        return await handleAdminBroadcast(chatRoom, request, HMAC_SECRET);
    }

    if (url.pathname === '/admin/edit-message' && request.method === 'POST') {
        return await handleAdminEditMessage(chatRoom, request, HMAC_SECRET);
    }

    if (url.pathname === '/admin/delete-message' && request.method === 'POST') {
        return await handleAdminDeleteMessage(chatRoom, request);
    }

    if (url.pathname === '/admin/delete-all-messages' && request.method === 'POST') {
        return await handleAdminDeleteAllMessages(chatRoom, request);
    }

    if (url.pathname === '/admin/force-delete' && request.method === 'POST') {
        return await handleAdminForceDelete(chatRoom, request);
    }

    if (url.pathname === '/admin/kick-user' && request.method === 'POST') {
        return await handleAdminKickUser(chatRoom, request);
    }

    if (url.pathname === '/admin/announce' && request.method === 'POST') {
        return await handleAdminAnnounce(chatRoom, request);
    }

    if (url.pathname === '/admin/announce' && request.method === 'PUT') {
        return await handleAdminEditAnnounce(chatRoom, request);
    }

    if (url.pathname === '/admin/announce' && request.method === 'DELETE') {
        return await handleAdminDeleteAnnounce(chatRoom, request);
    }

    if (url.pathname === '/admin/banned-ips') {
        return await handleAdminBannedIPs(chatRoom);
    }

    if (url.pathname === '/admin/unban-ip' && request.method === 'POST') {
        return await handleAdminUnbanIP(chatRoom, request);
    }

    if (url.pathname === '/admin/user-details') {
        return await handleAdminUserDetails(chatRoom, url);
    }

    if (url.pathname === '/admin/audit-logs') {
        return await handleAdminAuditLogs(chatRoom);
    }

    if (url.pathname === '/admin/delete-audit-logs' && request.method === 'POST') {
        chatRoom.auditLogs = [];
        if (chatRoom.env?.DB_ADMIN) {
            try {
                await chatRoom.env.DB_ADMIN.prepare('DELETE FROM audit_logs').run();
            } catch (e) {
                console.error('Failed to delete audit logs from D1:', e);
            }
        }
        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (url.pathname === '/admin/delete-error-logs' && request.method === 'POST') {
        chatRoom.errorLogs = [];
        if (chatRoom.env?.DB_ADMIN) {
            try {
                await chatRoom.env.DB_ADMIN.prepare('DELETE FROM error_logs').run();
            } catch (e) {
                console.error('Failed to delete error logs from D1:', e);
            }
        }
        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return null;
}

export async function handleAdminBroadcast(chatRoom, request, HMAC_SECRET) {
    try {
        const data = await safeJson(request);
        const content = typeof data.content === 'string' ? data.content : '';
        const file = data.file || null;
        const adminId = data.adminId || 'admin';

        if (!content && !file) {
            return new Response(JSON.stringify({ error: 'Empty message' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const messageId = `msg_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;

        const message = {
            type: 'message',
            messageId,
            content: sanitizeInput(content || ''),
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

        chatRoom.messages.push(message);

        if (chatRoom.messages.length > MAX_STORED_MESSAGES) {
            chatRoom.messages = chatRoom.messages.slice(-MAX_STORED_MESSAGES);
        }

        await chatRoom.state.storage.put('messages', chatRoom.messages);

        chatRoom.broadcast(message);

        return new Response(JSON.stringify({ success: true, message }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('admin broadcast error:', error);
        return new Response(JSON.stringify({ error: 'Failed to broadcast' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

export async function handleAdminEditMessage(chatRoom, request, HMAC_SECRET) {
    try {
        const data = await safeJson(request);
        const messageId = data.messageId;
        const newContent = data.newContent;

        if (!messageId || !newContent) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const messageIndex = chatRoom.messages.findIndex(msg => msg.messageId === messageId);

        if (messageIndex === -1) {
            return new Response(JSON.stringify({ error: 'Message not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const originalMessage = chatRoom.messages[messageIndex];

        if (!originalMessage.sessionId || !String(originalMessage.sessionId).startsWith('admin_')) {
            return new Response(JSON.stringify({ error: 'Not an admin message' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const now = Date.now();

        const editedMessage = {
            ...originalMessage,
            content: sanitizeInput(newContent),
            editedAt: now
        };

        if (HMAC_SECRET) {
            editedMessage.signature = await generateMessageSignature(editedMessage, HMAC_SECRET);
        }

        chatRoom.messages[messageIndex] = editedMessage;

        await chatRoom.state.storage.put('messages', chatRoom.messages);

        chatRoom.broadcast({
            type: 'message_edited',
            message: editedMessage
        });

        await chatRoom.addAuditLog('edit_message', `Edited message ${messageId}`, {
            messageId,
            originalContent: originalMessage.content.substring(0, ADMIN.AUDIT_LOG_TRUNCATION),
            newContent: newContent.substring(0, ADMIN.AUDIT_LOG_TRUNCATION)
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

export async function handleAdminDeleteMessage(chatRoom, request) {
    try {
        const data = await safeJson(request);
        const messageId = data.messageId;

        if (!messageId) {
            return new Response(JSON.stringify({ error: 'Missing messageId' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const messageIndex = chatRoom.messages.findIndex(msg => msg.messageId === messageId);

        if (messageIndex === -1) {
            return new Response(JSON.stringify({ error: 'Message not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const messageToDelete = chatRoom.messages[messageIndex];

        chatRoom.messages.splice(messageIndex, 1);

        await chatRoom.state.storage.put('messages', chatRoom.messages);

        chatRoom.broadcast({
            type: 'message_deleted',
            messageId
        });

        await chatRoom.addAuditLog('admin_delete_message', `Admin deleted message ${messageId} from user ${messageToDelete.sessionId}`, {
            messageId,
            originalSessionId: messageToDelete.sessionId,
            content: messageToDelete.content ? messageToDelete.content.substring(0, ADMIN.AUDIT_LOG_TRUNCATION) : '(file only)',
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

export async function handleAdminDeleteAllMessages(chatRoom, request) {
    try {
        const data = await safeJson(request);
        const confirmation = data.confirmation;

        if (confirmation !== 'DELETE_ALL_MESSAGES') {
            return new Response(JSON.stringify({ error: 'Invalid confirmation' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const messageCount = chatRoom.messages.length;

        chatRoom.messages = [];

        await chatRoom.state.storage.put('messages', chatRoom.messages);

        chatRoom.broadcast({
            type: 'all_messages_deleted'
        });

        await chatRoom.addAuditLog('admin_delete_all_messages', `Admin deleted all messages (${messageCount} messages)`, {
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

export async function handleAdminForceDelete(chatRoom, request) {
    try {
        const data = await safeJson(request);
        if (data.confirmation !== 'FORCE_DELETE_CHANNEL') {
            return new Response(JSON.stringify({ error: 'Invalid confirmation' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        if (chatRoom.channelSlug === '0') {
            return new Response(JSON.stringify({ error: 'Cannot delete main room' }), {
                status: 403, headers: { 'Content-Type': 'application/json' }
            });
        }

        for (const [, websocket] of chatRoom.sessions) {
            try {
                websocket.send(JSON.stringify({
                    type: 'channel_deleted',
                    content: '채널이 관리자에 의해 삭제되었습니다. 메인 채널로 이동합니다.'
                }));
            } catch (e) {
                console.error('Error sending channel_deleted:', e);
            }
        }

        await new Promise(resolve => setTimeout(resolve, FORCE_DELETE_DELAY_MS));

        for (const [, websocket] of chatRoom.sessions) {
            try {
                websocket.close(1000, 'Channel deleted by admin');
            } catch (_e) {
                // ignore
            }
        }

        if (chatRoom.cleanupInterval) {
            clearInterval(chatRoom.cleanupInterval);
            chatRoom.cleanupInterval = null;
        }

        chatRoom.sessions.clear();
        chatRoom.ipConnections.clear();
        chatRoom.userMetadata.clear();
        chatRoom.typingUsers.clear();
        chatRoom.messages = [];
        chatRoom.bannedIPs.clear();
        chatRoom.bannedSessions.clear();
        chatRoom.auditLogs = [];
        chatRoom.errorLogs = [];
        chatRoom.currentAnnouncement = null;
        chatRoom.emptySince = null;
        chatRoom.channelSlug = '0';

        await chatRoom.state.storage.deleteAll();

        return new Response(JSON.stringify({ success: true, slug: chatRoom.channelSlug }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('admin force delete error:', error);
        return new Response(JSON.stringify({ error: 'Failed to delete channel' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function handleAdminKickUser(chatRoom, request) {
    try {
        const data = await safeJson(request);
        const sessionId = data.sessionId;
        const banDuration = data.banDuration || 0;

        if (!sessionId) {
            return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const websocket = chatRoom.sessions.get(sessionId);
        const metadata = chatRoom.userMetadata.get(sessionId);

        if (!websocket && !metadata) {
            return new Response(JSON.stringify({ error: 'Session not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const clientIP = metadata?.ip;

        const ipConnectionCount = clientIP ? (chatRoom.ipConnections.get(clientIP) || 0) : 0;
        const isSharedIP = ipConnectionCount > 1;

        if (banDuration > 0) {
            const bannedUntil = Date.now() + (banDuration * 1000);

            chatRoom.bannedSessions.set(sessionId, {
                bannedUntil,
                reason: 'Admin kick',
                ip: clientIP
            });
            await chatRoom.state.storage.put('bannedSessions', Array.from(chatRoom.bannedSessions.entries()));

            if (clientIP && !isSharedIP) {
                chatRoom.bannedIPs.set(clientIP, {
                    bannedUntil,
                    reason: 'Admin kick',
                    sessionId
                });
                await chatRoom.state.storage.put('bannedIPs', Array.from(chatRoom.bannedIPs.entries()));
            }

            if (isSharedIP) {
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
                chatRoom.sessions.delete(sessionId);
                chatRoom.userMetadata.delete(sessionId);
                chatRoom.typingUsers.delete(sessionId);

                if (clientIP) {
                    const currentCount = chatRoom.ipConnections.get(clientIP) || 0;
                    if (currentCount > 1) {
                        chatRoom.ipConnections.set(clientIP, currentCount - 1);
                    } else {
                        chatRoom.ipConnections.delete(clientIP);
                    }
                }
            } else {
                for (const [sid, ws] of chatRoom.sessions.entries()) {
                    const meta = chatRoom.userMetadata.get(sid);
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
                        chatRoom.sessions.delete(sid);
                        chatRoom.userMetadata.delete(sid);
                        chatRoom.typingUsers.delete(sid);
                    }
                }

                chatRoom.ipConnections.delete(clientIP);
            }
        } else {
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

            chatRoom.sessions.delete(sessionId);
            if (metadata && clientIP) {
                const currentCount = chatRoom.ipConnections.get(clientIP) || 0;
                if (currentCount > 1) {
                    chatRoom.ipConnections.set(clientIP, currentCount - 1);
                } else {
                    chatRoom.ipConnections.delete(clientIP);
                }
            }
            chatRoom.userMetadata.delete(sessionId);
            chatRoom.typingUsers.delete(sessionId);
        }

        metrics.activeConnections = chatRoom.sessions.size;
        chatRoom.broadcastUserCount();

        const banType = isSharedIP ? 'session_only' : 'ip_and_session';
        await chatRoom.addAuditLog('kick_user', `Kicked session ${sessionId}`, {
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

export async function handleAdminAnnounce(chatRoom, request) {
    try {
        const data = await safeJson(request);
        const content = typeof data.content === 'string' ? data.content : '';
        const isEmergency = !!data.isEmergency;
        const emergencyUntil = isEmergency && data.emergencyUntil ? Number(data.emergencyUntil) : null;
        const scheduleAt = data.scheduleAt || null;

        if (!content) {
            return new Response(JSON.stringify({ error: 'Empty content' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        chatRoom.currentAnnouncement = {
            content: sanitizeInput(content),
            timestamp: Date.now(),
            isEmergency,
            emergencyUntil
        };
        if (data.expiresAt && data.expiresAt > Date.now()) {
            chatRoom.currentAnnouncement.expiresAt = data.expiresAt;
        }
        await chatRoom.state.storage.put('currentAnnouncement', chatRoom.currentAnnouncement);

        chatRoom.announcementHistory.unshift(chatRoom.currentAnnouncement);
        if (chatRoom.announcementHistory.length > ADMIN.ANNOUNCEMENT_HISTORY_MAX) {
            chatRoom.announcementHistory = chatRoom.announcementHistory.slice(0, ADMIN.ANNOUNCEMENT_HISTORY_MAX);
        }
        await chatRoom.state.storage.put('announcementHistory', chatRoom.announcementHistory);

        if (scheduleAt && scheduleAt > Date.now()) {
            chatRoom.currentAnnouncement.scheduleAt = scheduleAt;
            await chatRoom.state.storage.put('currentAnnouncement', chatRoom.currentAnnouncement);
            return new Response(JSON.stringify({ success: true, scheduled: true, scheduleAt }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const announcementMessage = {
            type: 'announcement',
            content: chatRoom.currentAnnouncement.content,
            timestamp: chatRoom.currentAnnouncement.timestamp,
            isEmergency: isEmergencyActive(chatRoom.currentAnnouncement),
            emergencyUntil: chatRoom.currentAnnouncement.emergencyUntil
        };

        let notified = 0;
        for (const [, ws] of chatRoom.sessions) {
            try { ws.send(JSON.stringify(announcementMessage)); notified++; } catch (_e) { /* ignore dead sessions */ }
        }

        await chatRoom.addAuditLog('send_announcement', `Sent announcement: ${content.substring(0, ADMIN.AUDIT_LOG_TRUNCATION)}...${isEmergency ? ' [EMERGENCY]' : ''}`, {
            contentLength: content.length,
            sessionsNotified: notified,
            isEmergency
        });

        return new Response(JSON.stringify({
            success: true,
            sessionsNotified: notified
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

export async function handleAdminEditAnnounce(chatRoom, request) {
    try {
        const data = await safeJson(request);
        const timestamp = Number(data.timestamp);
        const content = typeof data.content === 'string' ? data.content : '';
        const isEmergency = Object.hasOwn(data, 'isEmergency') ? !!data.isEmergency : undefined;
        const emergencyUntil = Object.hasOwn(data, 'emergencyUntil') ? (data.emergencyUntil ? Number(data.emergencyUntil) : null) : undefined;

        if (!timestamp || (content === '' && !Object.hasOwn(data, 'isEmergency'))) {
            return new Response(JSON.stringify({ error: 'Missing timestamp or content' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const announcementIndex = chatRoom.announcementHistory.findIndex(a => a.timestamp === timestamp);
        if (announcementIndex === -1) {
            return new Response(JSON.stringify({ error: 'Announcement not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const wasEmergency = chatRoom.announcementHistory[announcementIndex].isEmergency;
        if (content) {
            chatRoom.announcementHistory[announcementIndex].content = sanitizeInput(content);
        }
        if (isEmergency !== undefined) {
            chatRoom.announcementHistory[announcementIndex].isEmergency = isEmergency;
            chatRoom.announcementHistory[announcementIndex].emergencyUntil = emergencyUntil;
        }
        await chatRoom.state.storage.put('announcementHistory', chatRoom.announcementHistory);

        if (chatRoom.currentAnnouncement && chatRoom.currentAnnouncement.timestamp === timestamp) {
            if (content) {
                chatRoom.currentAnnouncement.content = chatRoom.announcementHistory[announcementIndex].content;
            }
            if (isEmergency !== undefined) {
                chatRoom.currentAnnouncement.isEmergency = isEmergency;
                chatRoom.currentAnnouncement.emergencyUntil = emergencyUntil;
            }
            await chatRoom.state.storage.put('currentAnnouncement', chatRoom.currentAnnouncement);

            if (wasEmergency && isEmergency === false && (!chatRoom.currentAnnouncement || !chatRoom.currentAnnouncement.isEmergency)) {
                chatRoom.broadcast({
                    type: 'emergency_cleared',
                    content: wasEmergency ? '긴급 공지가 해제되었습니다.' : '',
                    timestamp: Date.now()
                });
            }
        }

        await chatRoom.addAuditLog('edit_announcement', `Edited announcement from timestamp ${timestamp}: ${content ? content.substring(0, ADMIN.AUDIT_LOG_TRUNCATION) + '...' : 'emergency status changed'}`, {
            timestamp,
            isEmergency
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

export async function handleAdminDeleteAnnounce(chatRoom, request) {
    try {
        const data = await safeJson(request);
        const timestamp = Number(data.timestamp);

        if (!timestamp) {
            return new Response(JSON.stringify({ error: 'Missing timestamp' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const announcementIndex = chatRoom.announcementHistory.findIndex(a => a.timestamp === timestamp);
        if (announcementIndex === -1) {
            return new Response(JSON.stringify({ error: 'Announcement not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        chatRoom.announcementHistory.splice(announcementIndex, 1);
        await chatRoom.state.storage.put('announcementHistory', chatRoom.announcementHistory);

        const wasEmergency = chatRoom.currentAnnouncement && chatRoom.currentAnnouncement.timestamp === timestamp && chatRoom.currentAnnouncement.isEmergency;

        if (chatRoom.currentAnnouncement && chatRoom.currentAnnouncement.timestamp === timestamp) {
            if (chatRoom.announcementHistory.length > 0) {
                chatRoom.currentAnnouncement = chatRoom.announcementHistory[0];
                await chatRoom.state.storage.put('currentAnnouncement', chatRoom.currentAnnouncement);
            } else {
                chatRoom.currentAnnouncement = null;
                await chatRoom.state.storage.delete('currentAnnouncement');
            }
            if (wasEmergency && (!chatRoom.currentAnnouncement || !chatRoom.currentAnnouncement.isEmergency)) {
                chatRoom.broadcast({ type: 'emergency_cleared' });
            }
        }

        await chatRoom.addAuditLog('delete_announcement', `Deleted announcement from timestamp ${timestamp}`, {
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

export async function handleAdminBannedIPs(chatRoom) {
    const now = Date.now();
    const ips = [];
    const sessions = [];

    for (const [ip, b] of chatRoom.bannedIPs.entries()) {
        if (now < b.bannedUntil) {
            ips.push({
                ip,
                bannedUntil: b.bannedUntil,
                remainingSeconds: Math.ceil((b.bannedUntil - now) / 1000),
                reason: b.reason || 'No reason provided',
                bannedAt: b.bannedAt || (b.bannedUntil - (b.duration || 0) * 1000),
            });
        }
    }

    for (const [sessionId, b] of chatRoom.bannedSessions.entries()) {
        if (now < b.bannedUntil) {
            sessions.push({
                sessionId,
                ip: b.ip,
                bannedUntil: b.bannedUntil,
                remainingSeconds: Math.ceil((b.bannedUntil - now) / 1000),
                reason: b.reason || 'No reason provided',
                bannedAt: b.bannedAt || (b.bannedUntil - (b.duration || 0) * 1000),
            });
        }
    }

    return new Response(JSON.stringify({ ips, sessions }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function handleAdminUnbanIP(chatRoom, request) {
    try {
        const data = await safeJson(request);
        const ip = data.ip;
        const sessionId = data.sessionId;

        let unbanIp = false;
        let unbanSession = false;

        if (ip) {
            chatRoom.bannedIPs.delete(ip);
            unbanIp = true;
        }
        if (sessionId) {
            chatRoom.bannedSessions.delete(sessionId);
            unbanSession = true;
        }

        if (!unbanIp && !unbanSession) {
            return new Response(JSON.stringify({ error: 'Missing ip or sessionId' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (unbanIp) {
            await chatRoom.state.storage.put('bannedIPs', Array.from(chatRoom.bannedIPs.entries()));
        }
        if (unbanSession) {
            await chatRoom.state.storage.put('bannedSessions', Array.from(chatRoom.bannedSessions.entries()));
        }

        await chatRoom.addAuditLog('UNBAN_IP', `Unbanned IP: ${ip || 'N/A'}, Session: ${sessionId || 'N/A'}`);

        return new Response(JSON.stringify({ success: true, unbanIp, unbanSession }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('unban error:', error);
        return new Response(JSON.stringify({ error: 'Failed to unban' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function handleAdminUserDetails(chatRoom, url) {
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
        return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const metadata = chatRoom.userMetadata.get(sessionId);
    const userMessages = chatRoom.messages.filter(m => m.sessionId === sessionId);
    const isOnline = chatRoom.sessions.has(sessionId);

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

export async function handleAdminAuditLogs(chatRoom) {
    const logs = chatRoom.auditLogs.slice(-ADMIN.LOG_FETCH_LIMIT).reverse();

    return new Response(JSON.stringify(logs), {
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function handleCheckBan(chatRoom, url, request) {
    const ip = url.searchParams.get('ip') || request.headers.get('CF-Connecting-IP') || 'unknown';
    const sessionId = url.searchParams.get('sessionId');
    const now = Date.now();

    if (sessionId) {
        const sessionBanInfo = chatRoom.bannedSessions.get(sessionId);
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
            chatRoom.bannedSessions.delete(sessionId);
            await chatRoom.state.storage.put('bannedSessions', Array.from(chatRoom.bannedSessions.entries()));
        }
    }

    const banInfo = chatRoom.bannedIPs.get(ip);
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
            chatRoom.bannedIPs.delete(ip);
            await chatRoom.state.storage.put('bannedIPs', Array.from(chatRoom.bannedIPs.entries()));
        }
    }

    return new Response(JSON.stringify({ banned: false }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function handleBroadcastSummary(chatRoom, request, HMAC_SECRET) {
    try {
        const data = await safeJson(request);
        const content = typeof data.content === 'string' ? data.content : '';
        const summaryMode = typeof data.mode === 'string' ? data.mode : '_default';

        if (!content) {
            return new Response(JSON.stringify({ error: 'Empty summary' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        await chatRoom.initializeMessages();

        const messageId = `msg_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
        const message = {
            type: 'summary',
            messageId,
            content: sanitizeInput(content),
            sessionId: '_ai_summary',
            nickname: 'AI',
            timestamp: Date.now(),
            editedAt: null,
            summaryMode
        };

        if (HMAC_SECRET) {
            message.signature = await generateMessageSignature(message, HMAC_SECRET);
        } else {
            message.signature = '';
        }

        chatRoom.messages.push(message);

        if (chatRoom.messages.length > MAX_STORED_MESSAGES) {
            chatRoom.messages = chatRoom.messages.slice(-MAX_STORED_MESSAGES);
        }

        await chatRoom.state.storage.put('messages', chatRoom.messages);

        chatRoom.broadcast(message);

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        chatRoom.addErrorLog('BROADCAST_SUMMARY', error);
        return new Response(JSON.stringify({ error: 'Internal error' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}
