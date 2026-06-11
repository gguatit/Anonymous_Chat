// Main Chat Client Application
import ApiClient from './api-client.js';
import { SessionManager } from './session.js?v=1.0.4';
import { WebSocketManager } from './websocket.js?v=1.0.3';
import { UIManager } from './ui.js?v=1.1.0';
import { FileUploadManager } from './file-upload.js?v=1.0.5';
import { DeadDropClient } from './dead-drop.js?v=1.0.3';
import { PushNotificationManager } from './push-manager.js?v=1.0.5';
import { SearchManager } from './search.js?v=1.0.3';
import { SecurityHeadersManager } from './security-headers.js?v=1.0.1';
import { TurnstileManager } from './turnstile.js?v=1.0.0';
import { OGPreviewManager } from './og-preview.js?v=1.0.0';
import { ThemeManager } from './theme.js?v=1.0.0';
import { sendErrorReport } from './utils.js';
import { RATE_LIMIT, SECURITY, CHANNEL, UI, DEAD_DROP } from '../../src/config/constants.js';

class ChatClient {
    constructor(config = {}) {
        // Initialize managers
        this.sessionManager = new SessionManager();
        this.ui = new UIManager();
        this.fileUpload = new FileUploadManager(config.fileUploadUrl || null, '/api/upload');
        this.deadDrop = new DeadDropClient();

        // State
        this.typingTimeout = null;
        this.lastMessageTime = 0;
        this.messageRateLimit = RATE_LIMIT.MESSAGE_COOLDOWN;
        this.isTyping = false;
        this.isNicknameLocked = true;
        this.unreadCount = 0;
        this.originalTitle = document.title;
        this.titleBlinkInterval = null;
        this.typingUsers = new Map(); // sessionId -> { nickname, timeout }
        this.announcementHistoryBtn = document.getElementById('announcement-history-btn');
        this.announcementNewBadge = document.getElementById('announcement-new-badge');
        this.announcementTooltip = document.getElementById('announcement-tooltip');
        this.latestAnnouncementTimestamp = 0;
        this.announcementSeenStorageKey = 'chatLastSeenAnnouncementTs';
        this.currentChannel = '0';
        this.currentChannelName = '';

        this._messageHistory = [];
        this._historyIndex = -1;
        this._historySavedInput = '';

        // Restore saved channel
        try {
            const savedChannel = localStorage.getItem('chatCurrentChannel');
            if (savedChannel && savedChannel !== '0') {
                this.currentChannel = savedChannel;
                this.currentChannelName = localStorage.getItem('chatCurrentChannelName') || '';
            }
        } catch (_e) {
            // ignore storage errors
        }

        // Initialize WebSocket with message handler
        this.wsManager = new WebSocketManager(
            this.sessionManager.getSessionId(),
            {
                onMessage: (data) => this.handleMessage(data),
                onConnectionChange: (status, attempt, max) => this.handleConnectionChange(status, attempt, max),
                onError: (message) => this.ui.displayError(message)
            }
        );
        this.wsManager.channelId = this.currentChannel;

        // Push notifications
        this.pushManager = new PushNotificationManager();

        // Search
        this.search = new SearchManager((messageId) => this.scrollToMessage(messageId));
        this.securityHeaders = new SecurityHeadersManager(config.kalphaApiUrl || null);
        this.ogPreview = new OGPreviewManager();
        this.theme = new ThemeManager();
        window.chatClient = this;

        this.initializeUI();
        this.initializeCommandPopup();
        this.initializeAnnouncementIndicator();
        // WebSocket connection is started after Turnstile verification
        this.turnstile = new TurnstileManager(config.turnstileSiteKey, () => this.onTurnstileVerified());
        this.turnstile.init();
    }

    onTurnstileVerified() {
        this.wsManager.connect();
        this.initializePush();
    }

    toTimestamp(value) {
        const numericValue = Number(value);
        if (Number.isFinite(numericValue) && numericValue > 0) {
            return numericValue;
        }

        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : Date.now();
    }

    getSeenAnnouncementTimestamp() {
        try {
            const stored = localStorage.getItem(this.announcementSeenStorageKey);
            const ts = Number(stored);
            return Number.isFinite(ts) && ts > 0 ? ts : 0;
        } catch (_e) {
            return 0;
        }
    }

    setSeenAnnouncementTimestamp(timestamp) {
        if (!Number.isFinite(timestamp) || timestamp <= 0) {
            return;
        }

        try {
            localStorage.setItem(this.announcementSeenStorageKey, String(Math.floor(timestamp)));
        } catch (_e) {
            // Ignore storage failures (e.g. private mode restrictions)
        }
    }

    showAnnouncementBadge() {
        if (this.announcementNewBadge) {
            this.announcementNewBadge.classList.remove('hidden');
        }
        if (this.announcementTooltip) {
            this.announcementTooltip.classList.remove('hidden');
        }
    }

    hideAnnouncementBadge() {
        if (this.announcementNewBadge) {
            this.announcementNewBadge.classList.add('hidden');
        }
        if (this.announcementTooltip) {
            this.announcementTooltip.classList.add('hidden');
        }
    }

    updateAnnouncementBadgeVisibility() {
        const seenTs = this.getSeenAnnouncementTimestamp();
        if (this.latestAnnouncementTimestamp > seenTs) {
            this.showAnnouncementBadge();
        } else {
            this.hideAnnouncementBadge();
        }
    }

    // Add click listener to tooltip as well
    async initializeAnnouncementIndicator() {
        const markAsSeen = () => {
            const timestampToMark = this.latestAnnouncementTimestamp || Date.now();
            this.setSeenAnnouncementTimestamp(timestampToMark);
            this.hideAnnouncementBadge();
        };

        if (this.announcementHistoryBtn) {
            this.announcementHistoryBtn.addEventListener('click', markAsSeen);
        }
        if (this.announcementTooltip) {
            this.announcementTooltip.addEventListener('click', () => {
                markAsSeen();
                window.location.href = '/announcements.html';
            });
        }


        try {
            const announcements = await ApiClient.get('/api/announcements').catch(() => []);
            if (!Array.isArray(announcements) || announcements.length === 0) {
                return;
            }

            this.latestAnnouncementTimestamp = announcements.reduce((latest, item) => {
                const ts = this.toTimestamp(item?.timestamp);
                return Math.max(latest, ts);
            }, 0);

            this.updateAnnouncementBadgeVisibility();
        } catch (error) {
            console.error('Failed to initialize announcement indicator:', error);
        }
    }

    async initializePush() {
        const result = await this.pushManager.initialize();
        const bellBtn = document.getElementById('notification-toggle');

        if (!result.supported || !bellBtn) {
            if (result.error) {
                if (result.error.includes('not configured')) {
                    console.warn('[Push] Server push notifications not configured. Contact administrator.');
                }
            }
            return;
        }

        bellBtn.classList.remove('hidden');
        this.updateBellIcon(bellBtn);

        if (Notification.permission === 'granted' && !result.subscribed && this.pushManager._sessionSubscribed) {
            const resubscribed = await this.pushManager.subscribe(this.sessionManager.getSessionId());
            if (resubscribed) {
                this.updateBellIcon(bellBtn);
            }
        }

        bellBtn.addEventListener('click', async () => {
            try {
                const success = await this.pushManager.toggle(this.sessionManager.getSessionId());

                if (success !== undefined) {
                    this.updateBellIcon(bellBtn);
                } else {
                    console.error('[Chat] Notification toggle returned undefined');
                    this.ui.displayError('알림 설정을 변경할 수 없습니다. 브라우저 권한을 확인하거나 페이지를 새로고침 해주세요.');
                }
            } catch (error) {
                console.error('[Chat] Notification toggle error:', error);
                this.ui.displayError('알림 설정 중 오류가 발생했습니다: ' + error.message);
            }
        });
    }

    updateBellIcon(btn) {
        if (this.pushManager.isSubscribed) {
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>';
            btn.title = '알림 끄기';
            btn.classList.add('text-yellow-400');
            btn.classList.remove('text-gray-400');
        } else {
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>';
            btn.title = '알림 켜기';
            btn.classList.remove('text-yellow-400');
            btn.classList.add('text-gray-400');
        }
    }

    initializeUI() {
        this.ui.initializeEventListeners({
            onSubmit: (e) => this.handleSubmit(e),
            onInput: () => this.handleInput(),
            onTyping: () => this.handleTyping(),
            onScrollClick: () => this.ui.scrollToBottom(true),
            onScroll: () => this.ui.updateScrollButton(),
            onDelete: (messageId) => this.deleteMessage(messageId),
            onRevealSecret: (secretId, container) => this.revealSecretMessage(secretId, container),
            onSetNickname: (newName) => this.handleSetNickname(newName),
            onToggleNicknameLock: () => this.handleToggleNicknameLock(),
            onAcceptNotice: (dontShowAgain) => this.handleAcceptNotice(dontShowAgain),
            onCreateChannel: (name) => this.createChannel(name),
            onJoinChannel: (number) => this.joinChannel(number),
            onBackToMain: () => this.switchChannel('0'),
            onReaction: (messageId, emoji, hasReacted) => this.sendReaction(messageId, emoji, hasReacted),
        });
        this.ui.updateNicknameDisplay(this.sessionManager.getNickname());
        this.ui.setNicknameLockState(this.isNicknameLocked);
        this.ui.updateChannelIndicator(this.currentChannel, this.currentChannelName);
    }

    handleSetNickname(newName) {
        const savedName = this.sessionManager.setNickname(newName);
        this.ui.updateNicknameDisplay(savedName);
    }

    handleToggleNicknameLock() {
        if (this.isNicknameLocked) {
            // Attempting to unlock
            if (this.sessionManager.hasAcceptedNicknameNotice()) {
                // Already accepted notice
                this.isNicknameLocked = false;
                this.ui.setNicknameLockState(this.isNicknameLocked);
            } else {
                // Show notice
                this.ui.showNoticeModal();
            }
        } else {
            // Attempting to lock after changes
            this.isNicknameLocked = true;
            this.ui.setNicknameLockState(this.isNicknameLocked);
            
            // Trigger a save just in case
            if (this.ui.nicknameInput) {
                this.handleSetNickname(this.ui.nicknameInput.value);
            }
        }
    }

    handleAcceptNotice(dontShowAgain) {
        if (dontShowAgain) {
            this.sessionManager.setNicknameNoticeAccepted(true);
        }
        // Unlock nickname input
        this.isNicknameLocked = false;
        this.ui.setNicknameLockState(this.isNicknameLocked);
    }

    handleMessage(data) {
        switch (data.type) {
            case 'message':
                console.log('[handleMessage] received message, content length:', data.content?.length);
                this.ui.displayMessage(
                    data,
                    data.sessionId === this.sessionManager.getSessionId(),
                    this.sessionManager.getSessionId()
                );
                if (this.ogPreview) {
                    const lastMsg = this.ui.messagesContainer.querySelector('[data-message]:last-child');
                    if (lastMsg) this.ogPreview.enrichMessage(lastMsg);
                }
                if (document.hidden) {
                    this.unreadCount++;
                    this.updateUnreadTitle();
                }
                break;
            case 'message_edited':
                // Update existing message in UI
                this.ui.updateMessage(data.message.messageId, data.message.content, data.message.editedAt);
                break;
            case 'message_deleted':
                // Remove message from UI
                this.ui.removeMessage(data.messageId);
                break;
            case 'message_reaction':
                this.ui.updateReaction(data.messageId, data.emoji, data.count, data.reactionSessions, this.sessionManager.getSessionId());
                break;
            case 'all_messages_deleted':
                // Clear all messages from UI
                this.ui.clearAllMessages();
                this.ui.displaySystemMessage('관리자가 모든 메시지를 삭제했습니다.');
                break;
            case 'user_count':
                this.ui.updateUserCount(data.count);
                break;
            case 'typing':
                if (data.sessionId !== this.sessionManager.getSessionId()) {
                    this.handleTypingEvent(data.sessionId, data.nickname, data.typing);
                }
                break;
            case 'channel_deleted':
                this.ui.displaySystemMessage(data.content);
                this.switchChannel('0');
                break;
            case 'system':
                this.ui.displaySystemMessage(data.content);
                break;
            case 'summary':
                this.ui.displaySummary(data.content, data.messageId, data.summaryMode);
                break;
            case 'announcement':
                this.latestAnnouncementTimestamp = Math.max(
                    this.latestAnnouncementTimestamp,
                    this.toTimestamp(data.timestamp)
                );
                this.ui.displayAnnouncement(data.content, data.timestamp);
                this.updateAnnouncementBadgeVisibility();
                if (data.isEmergency) {
                    const seenTs = localStorage.getItem('chatEmergencySeenTs');
                    if (String(data.timestamp) !== seenTs) {
                        localStorage.setItem('chatEmergencySeenTs', String(data.timestamp));
                        localStorage.setItem('chatEmergencyRedirectTime', String(Date.now()));
                        location.href = '/announcements.html?from=emergency';
                    }
                }
                break;
            case 'emergency_cleared': {
                localStorage.removeItem('chatEmergencySeenTs');
                localStorage.removeItem('chatEmergencyRedirectTime');
                const toast = document.createElement('div');
                toast.className = 'fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-green-800 text-green-100 px-4 py-2 rounded-lg shadow-lg text-sm transition-opacity duration-500';
                toast.textContent = '긴급 공지가 해제되었습니다.';
                document.body.appendChild(toast);
                setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), UI.TOAST_FADE_MS); }, UI.TOAST_DURATION_MS);
                break;
            }
            case 'kicked': {
                const banDuration = data.banDuration || 0;
                const isPermanent = data.permanent === true;
                const isSessionBan = data.sessionBan === true;

                if (isPermanent && banDuration > 0) {
                    const minutes = Math.floor(banDuration / 60);
                    const seconds = banDuration % 60;
                    const timeStr = minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;

                    this.ui.displayError(`${data.content}\n재접속은 ${timeStr} 후 가능합니다.`);
                    this.ui.setInputEnabled(false);

                    if (isSessionBan) {
                        // 세션 밴: 세션 ID를 유지하여 재접속 시 같은 (밴된) ID로 거부되도록 함
                    } else {
                        localStorage.removeItem('chatSessionId');
                    }

                    if (this.wsManager) {
                        this.wsManager.manualClose = true;
                        this.wsManager.disconnect();
                    }

                    alert(`관리자에 의해 ${timeStr}간 차단되었습니다.\n\n차단이 해제될 때까지 접속이 불가능합니다.\n차단 시간이 지난 후 페이지를 새로고침하여 재접속할 수 있습니다.`);
                } else if (banDuration > 0) {
                    const minutes = Math.floor(banDuration / 60);
                    const seconds = banDuration % 60;
                    const timeStr = minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
                    this.ui.displayError(`${data.content}\n재접속은 ${timeStr} 후 가능합니다.`);
                    alert(`관리자에 의해 ${timeStr}간 차단되었습니다.\n페이지가 새로고침됩니다.`);
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                } else {
                    this.ui.displayError(data.content);
                    alert('관리자에 의해 강제퇴장되었습니다. 페이지가 새로고침됩니다.');
                    setTimeout(() => {
                        window.location.reload();
                    }, UI.HIGHLIGHT_RING_MS);
                }
                break;
            }
            case 'banned': {
                this.ui.displayError(data.content);
                this.ui.setInputEnabled(false);

                localStorage.removeItem('chatSessionId');

                if (this.wsManager) {
                    this.wsManager.disconnect();
                }

                const remainingTime = data.remainingSeconds || 0;
                if (remainingTime > 0) {
                    const mins = Math.floor(remainingTime / 60);
                    const secs = remainingTime % 60;
                    const timeText = mins > 0 ? `${mins}분 ${secs}초` : `${secs}초`;
                    alert(`접속이 차단되었습니다.\n차단 해제까지 ${timeText} 남았습니다.\n\n차단 시간이 지난 후 페이지를 새로고침하여 재접속할 수 있습니다.`);
                }
                break;
            }
            case 'error':
                this.ui.displayError(data.content);
                break;
            default:
                break;
        }
    }

    handleTypingEvent(sessionId, nickname, isTyping) {
        const existing = this.typingUsers.get(sessionId);
        if (existing) {
            clearTimeout(existing.timeout);
        }

        if (isTyping) {
            const timeout = setTimeout(() => {
                this.typingUsers.delete(sessionId);
                this.ui.updateTypingIndicator(this.typingUsers);
            }, UI.TYPING_EXPIRY_MS);
            this.typingUsers.set(sessionId, { nickname: nickname || '익명', timeout });
        } else {
            this.typingUsers.delete(sessionId);
        }

        this.ui.updateTypingIndicator(this.typingUsers);
    }

    updateUnreadTitle() {
        if (this.titleBlinkInterval) clearInterval(this.titleBlinkInterval);
        let showCount = true;
        const update = () => {
            document.title = showCount
                ? `(${this.unreadCount}) ${this.originalTitle}`
                : this.originalTitle;
            showCount = !showCount;
        };
        update();
        this.titleBlinkInterval = setInterval(update, UI.TITLE_BLINK_MS);
    }

    clearUnreadTitle() {
        if (this.titleBlinkInterval) {
            clearInterval(this.titleBlinkInterval);
            this.titleBlinkInterval = null;
        }
        this.unreadCount = 0;
        document.title = this.originalTitle;
    }

    handleConnectionChange(status, attempt, max) {
        let statusText = '';

        switch (status) {
            case 'connected':
                statusText = '연결됨';
                this.ui.setInputEnabled(true);
                this.ui.messageInput.focus();
                // 재연결 시에도 기존 메시지는 유지됨 (중복 체크로 자동 필터링)
                break;
            case 'disconnected':
                statusText = '연결 끊김';
                this.ui.setInputEnabled(false);
                break;
            case 'reconnecting':
                statusText = `재연결 중 (${attempt}/${max})`;
                this.ui.setInputEnabled(false);
                break;
            case 'banned':
                statusText = '접속 차단됨';
                this.ui.setInputEnabled(false);
                break;
            case 'error':
                statusText = '오류 발생';
                this.ui.setInputEnabled(false);
                break;
        }

        this.ui.updateConnectionStatus(status, statusText);
    }

    async handleSubmit(e) {
        e.preventDefault();

        let message = this.ui.getInputValue();
        console.log('[sendMessage] submitting, length:', message.length);
        const trimmedMessage = message.trim();
        const hasFile = this.fileUpload.hasFile();

        // 메시지나 파일 중 하나는 있어야 함
        if (!trimmedMessage && !hasFile) return;

        // /summary, /topic, /mood, /conflict 명령어 처리
        if (trimmedMessage === '/summary') {
            this.ui.clearInput();
            await this.requestSummary('default');
            return;
        }
        if (trimmedMessage === '/topic') {
            this.ui.clearInput();
            await this.requestSummary('topic');
            return;
        }
        if (trimmedMessage === '/mood') {
            this.ui.clearInput();
            await this.requestSummary('mood');
            return;
        }
        if (trimmedMessage === '/conflict') {
            this.ui.clearInput();
            await this.requestSummary('conflict');
            return;
        }

        // /로 시작하는 미인식 명령어는 전송하지 않음
        if (trimmedMessage.startsWith('/')) {
            this.ui.clearInput();
            return;
        }

        // Rate limiting check
        const now = Date.now();
        if (now - this.lastMessageTime < this.messageRateLimit) {
            this.ui.displayError('메시지를 너무 빠르게 전송하고 있습니다.');
            return;
        }

        // Truncate long messages (skip for secret replies - content goes to DeadDrop)
        const replyingTo = this.ui.getReplyingTo();
        const isSecretReply = replyingTo && replyingTo.isSecret;
        if (!isSecretReply && message.length > SECURITY.MAX_MESSAGE_LENGTH) {
            message = message.substring(0, SECURITY.MAX_MESSAGE_LENGTH);
            this.ui.displayError(`메시지가 너무 길어 ${SECURITY.MAX_MESSAGE_LENGTH}자로 잘렸습니다.`, 4000);
        }

        // Prepare message data
        const messageData = {
            type: 'message',
            content: message || '',
            sessionId: this.sessionManager.getSessionId(),
            nickname: this.sessionManager.getNickname(),
            timestamp: now
        };

        if (replyingTo) {
            if (replyingTo.isSecret) {
                // 비밀 메시지 길이 체크
                if (trimmedMessage && trimmedMessage.length > DEAD_DROP.MAX_MESSAGE_LENGTH) {
                    this.ui.displayError(`비밀 메시지는 최대 ${DEAD_DROP.MAX_MESSAGE_LENGTH.toLocaleString()}자까지 가능합니다.`);
                    return;
                }
                // 비밀 메시지로 보내기 - Dead Drop에 저장
                try {
                    console.log('[Secret] Storing message:', trimmedMessage ? trimmedMessage.substring(0, 50) : '[file]');
                    const deadDropResult = await this.deadDrop.store(trimmedMessage || '[파일]');
                    console.log('[Secret] Store result:', deadDropResult);
                    messageData.replyTo = {
                        messageId: replyingTo.messageId,
                        content: replyingTo.content,
                        isOwnMessage: replyingTo.isOwnMessage,
                        isSecret: true,
                        secretId: deadDropResult.id,
                        targetSessionId: replyingTo.targetSessionId // 답장 받는 사람의 sessionId
                    };
                    // 메시지 내용은 Dead Drop ID로 대체
                    messageData.content = `[비밀 메시지]`;
                } catch (error) {
                    console.error('Dead Drop store error:', error);
                    this.ui.displayError('비밀 메시지 저장 실패: ' + error.message);
                    sendErrorReport(error.message || 'DeadDrop store error', 'ChatClient.sendMessage - deadDrop.store failed');
                    return;
                }
            } else {
                // 일반 답장
                messageData.replyTo = {
                    messageId: replyingTo.messageId,
                    content: replyingTo.content,
                    isOwnMessage: replyingTo.isOwnMessage
                };
            }
        }

        // Upload files if selected
        if (hasFile) {
            try {
                const filesData = await this.fileUpload.uploadFiles();

                // Add files info to message
                if (filesData.length === 1) {
                    // Single file - backward compatibility
                    messageData.file = {
                        url: filesData[0].url,
                        filename: filesData[0].filename,
                        filesize: filesData[0].filesize,
                        filetype: filesData[0].filetype
                    };
                } else if (filesData.length > 1) {
                    // Multiple files
                    messageData.files = filesData.map(f => ({
                        url: f.url,
                        filename: f.filename,
                        filesize: f.filesize,
                        filetype: f.filetype
                    }));
                }

                this.fileUpload.clearFiles();
            } catch (error) {
                console.error('File upload failed:', error);
                this.ui.displayError('파일 업로드 실패: ' + error.message);
                sendErrorReport(error.message || 'File upload failed', 'ChatClient.sendMessage - file upload failed');
                return;
            }
        }

        // Send message with or without file
        try {
            console.log('[sendMessage] WS connected:', this.wsManager.isConnected(), 'sending:', messageData.content.substring(0, 30));
            this.wsManager.send(messageData);
            console.log('[sendMessage] WS send done');
            if (trimmedMessage && !trimmedMessage.startsWith('/')) {
                this._messageHistory.push(trimmedMessage);
                this._historyIndex = this._messageHistory.length;
            }
            if (!this.wsManager.isConnected()) {
                sendErrorReport('Message send attempted while WebSocket not connected', 'ChatClient.sendMessage - ws not connected');
                this.ui.displayError('메시지 전송 실패: 연결되어 있지 않습니다.');
            }
        } catch (err) {
            console.error('Message send error:', err);
            sendErrorReport(err.message || 'Message send error', 'ChatClient.sendMessage - exception on send');
            this.ui.displayError('메시지 전송 중 오류가 발생했습니다.');
        }

        this.lastMessageTime = now;
        this.ui.clearInput();
        this.ui.cancelReply(); // 답장 상태 초기화
        this.ui.messageInput.focus();
    }

    // Note: 서명 생성은 서버에서만 수행됨 (보안 강화)
    // 클라이언트는 서명 없이 메시지를 전송하고, 서버가 검증 후 서명을 추가함

    handleInput() {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        if (this._historyIndex < this._messageHistory.length) {
            this._historyIndex = this._messageHistory.length;
            this._historySavedInput = '';
        }
        this.updateCommandPopup();
    }

    handleTyping() {
        if (!this.isTyping && this.ui.getInputLength() > 0) {
            this.isTyping = true;
            this.wsManager.send({
                type: 'typing',
                sessionId: this.sessionManager.getSessionId(),
                nickname: this.sessionManager.getNickname(),
                typing: true
            });
        }

        // Reset typing indicator after 2 seconds of inactivity
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        this.typingTimeout = setTimeout(() => {
            if (this.isTyping) {
                this.isTyping = false;
                this.wsManager.send({
                    type: 'typing',
                    sessionId: this.sessionManager.getSessionId(),
                    nickname: this.sessionManager.getNickname(),
                    typing: false
                });
            }
        }, UI.TYPING_INACTIVITY_MS);
    }

    async editMessage(messageId, newContent) {
        // Validate new content
        if (!newContent || newContent.trim().length === 0) {
            this.ui.displayError('메시지 내용이 비어있습니다.');
            return;
        }

        if (newContent.length > SECURITY.MAX_MESSAGE_LENGTH) {
            this.ui.displayError(`메시지는 최대 ${SECURITY.MAX_MESSAGE_LENGTH}자까지 가능합니다.`);
            return;
        }

        const now = Date.now();

        // Prepare edit data (서버에서 서명 생성)
        const editData = {
            type: 'edit',
            messageId: messageId,
            newContent: newContent,
            sessionId: this.sessionManager.getSessionId(),
            timestamp: now
        };

        // Send edit request to server without signature
        this.wsManager.send(editData);
    }

    async deleteMessage(messageId) {
        const deleteData = {
            type: 'delete',
            messageId: messageId,
            sessionId: this.sessionManager.getSessionId(),
            timestamp: Date.now()
        };

        // Send delete request to server
        this.wsManager.send(deleteData);
    }

    sendReaction(messageId, emoji, hasReacted) {
        this.wsManager.send({
            type: 'reaction',
            messageId,
            emoji,
            action: hasReacted ? 'remove' : 'add',
            sessionId: this.sessionManager.getSessionId(),
            timestamp: Date.now()
        });
    }

    // ========== Channel Management ==========
    async switchChannel(channelId, channelName = '') {
        channelId = String(channelId || '0');
        if (this.currentChannel === channelId) return;

        // Update state
        this.currentChannel = channelId;
        this.currentChannelName = channelName;

        try {
            localStorage.setItem('chatCurrentChannel', channelId);
            if (channelName) {
                localStorage.setItem('chatCurrentChannelName', channelName);
            } else {
                localStorage.removeItem('chatCurrentChannelName');
            }
        } catch (_e) {
            /* ignore storage errors */
        }

        // Update UI
        this.ui.updateChannelIndicator(channelId, channelName);
        this.ui.clearAllMessages();

        // Reconnect WebSocket
        this.wsManager.channelId = channelId;
        this.wsManager.manualClose = true;
        this.wsManager.disconnect();
        this.wsManager.manualClose = false;

        // Allow disconnect to settle then reconnect
        setTimeout(() => {
            this.wsManager.connect();
        }, 300);
    }

    async createChannel(name) {
        if (this.ui._channelProcessing) return;
        if (!name) {
            this.ui.showCreateChannelError('채널 이름을 입력해주세요.');
            return;
        }
        if (name.length > CHANNEL.MAX_NAME_LENGTH) {
            this.ui.showCreateChannelError(`채널 이름은 최대 ${CHANNEL.MAX_NAME_LENGTH}자입니다.`);
            return;
        }

        this.ui._channelProcessing = true;
        try {
            const resp = await ApiClient.postRaw('/api/channels/create', { name, sessionId: this.sessionManager.getSessionId() });
            const data = await resp.json();

            if (!resp.ok) {
                this.ui.showCreateChannelError(data.error || '채널 생성에 실패했습니다.');
                return;
            }

            this.ui.hideCreateChannelModal();
            await this.switchChannel(data.slug, data.name);
            this.ui.displaySystemMessage(`채널 "${data.name}"에 입장했습니다.`);
        } catch (error) {
            console.error('Create channel error:', error);
            this.ui.showCreateChannelError('네트워크 오류가 발생했습니다.');
        } finally {
            this.ui._channelProcessing = false;
        }
    }

    async joinChannel(raw) {
        if (this.ui._channelProcessing) return;

        const trimmed = String(raw || '').trim();
        if (!trimmed) {
            this.ui.showJoinChannelError('채널 이름을 입력해주세요.');
            return;
        }

        this.ui._channelProcessing = true;
        try {
            const resp = await ApiClient.postRaw('/api/channels/join', { name: trimmed });
            const data = await resp.json();

            if (!resp.ok) {
                this.ui.showJoinChannelError(data.error || '채널을 찾을 수 없습니다.');
                return;
            }

            this.ui.hideJoinChannelModal();
            await this.switchChannel(data.slug, data.name);
            this.ui.displaySystemMessage(`채널 "${data.name}"에 입장했습니다.`);
        } catch (error) {
            console.error('Join channel error:', error);
            this.ui.showJoinChannelError('네트워크 오류가 발생했습니다.');
        } finally {
            this.ui._channelProcessing = false;
        }
    }

    scrollToMessage(messageId) {
        const messageEl = this.ui.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
            messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            messageEl.classList.add('ring-2', 'ring-blue-500');
            setTimeout(() => {
                messageEl.classList.remove('ring-2', 'ring-blue-500');
            }, 2000);
        }
    }

    async revealSecretMessage(secretId, container) {
        const btn = container.querySelector('.reveal-secret-btn');
        const contentDiv = container.querySelector('.secret-message-content');

        if (!btn || !contentDiv) return;

        // 버튼 비활성화 및 로딩 상태 표시
        btn.disabled = true;
        btn.textContent = '읽는 중...';

        try {
            // Dead Drop에서 메시지 읽기 (한 번만 가능)
            console.log('[Secret] Reading data for id:', secretId);
            const result = await this.deadDrop.read(secretId);
            console.log('[Secret] Read result:', result);

            // 버튼 숨기고 메시지 표시
            btn.remove();
            contentDiv.classList.remove('hidden');
            const formatted = this.ui.formatMessageContent(result.message);
            contentDiv.innerHTML = `
                <div class="text-green-400 text-xs mb-2">✓ 비밀 메시지가 공개되었습니다 (이 메시지는 삭제되었습니다)</div>
                <div class="text-gray-100 whitespace-pre-wrap">${formatted}</div>
            `;
            // Trigger syntax highlighting for code blocks
            setTimeout(() => {
                contentDiv.querySelectorAll('pre.code-block code[class*="language-"]').forEach(el => {
                    if (typeof Prism !== 'undefined') {
                        try { Prism.highlightElement(el); } catch (_e) {}
                    } else if (typeof hljs !== 'undefined') {
                        try { hljs.highlightElement(el); } catch (_e) {}
                    }
                });
            }, 50);
        } catch (error) {
            console.error('Failed to reveal secret:', error);
            btn.textContent = '읽기 실패';
            btn.classList.add('bg-red-600', 'hover:bg-red-500');
            btn.classList.remove('bg-purple-600', 'hover:bg-purple-500');

            // 에러 메시지 표시
            contentDiv.classList.remove('hidden');
            contentDiv.innerHTML = `
                <div class="text-red-400 text-sm">
                    ❌ ${error.message}
                </div>
            `;
        }
    }

    async requestSummary(mode = 'default') {
        this.ui.clearInput();
        const loadingMsg = this.ui.displaySystemMessage('AI가 대화 요약을 생성 중입니다...');
        try {
            const res = await ApiClient.postRaw('/api/summary', { mode });
            loadingMsg.remove();
            if (res.status !== 204 && !res.ok) {
                const data = await res.json().catch(() => ({}));
                if (res.status === 503) {
                    this.ui.displayError('AI 모델이 혼잡합니다. 1~2분 후 다시 시도해주세요.');
                } else {
                    this.ui.displayError(data.error || '요약 생성에 실패했습니다.');
                }
            }
        } catch (_err) {
            loadingMsg.remove();
            this.ui.displayError('요약 요청 중 오류가 발생했습니다.');
        }
    }

    initializeCommandPopup() {
        const input = this.ui.messageInput;
        if (!input) return;

        input.addEventListener('keydown', (e) => {
            if (this.isCommandPopupOpen()) {
                if (e.key === 'ArrowDown') { e.preventDefault(); this.selectCommandPopup(this._cmdSelected + 1); }
                if (e.key === 'ArrowUp') { e.preventDefault(); this.selectCommandPopup(this._cmdSelected - 1); }
                if (e.key === 'Enter') { e.preventDefault(); this.applyCommandPopup(); }
                if (e.key === 'Tab') { e.preventDefault(); this.applyCommandPopup(); }
                if (e.key === 'Escape') { e.preventDefault(); this.hideCommandPopup(); }
                return;
            }

            if (e.key === 'ArrowUp' && this._messageHistory.length > 0) {
                e.preventDefault();
                if (this._historyIndex === this._messageHistory.length) {
                    this._historySavedInput = this.ui.getInputValue();
                }
                if (this._historyIndex > 0) {
                    this._historyIndex--;
                    this.ui.messageInput.value = this._messageHistory[this._historyIndex];
                    this.ui.messageInput.focus();
                }
            }
            if (e.key === 'ArrowDown' && this._historyIndex < this._messageHistory.length) {
                e.preventDefault();
                if (this._historyIndex < this._messageHistory.length - 1) {
                    this._historyIndex++;
                    this.ui.messageInput.value = this._messageHistory[this._historyIndex];
                } else {
                    this._historyIndex = this._messageHistory.length;
                    this.ui.messageInput.value = this._historySavedInput;
                }
                this.ui.messageInput.focus();
            }
        });

        const popup = document.getElementById('command-popup');
        if (popup) {
            popup.addEventListener('click', (e) => {
                const item = e.target.closest('.cmd-item');
                if (item) {
                    this.ui.clearInput();
                    this.ui.messageInput.value = item.dataset.cmd;
                    this.ui.messageInput.focus();
                    this.hideCommandPopup();
                }
            });
        }
    }

    updateCommandPopup() {
        const popup = document.getElementById('command-popup');
        if (!popup) return;

        const value = this.ui.getInputValue();
        if (!value.startsWith('/') || value.includes(' ')) {
            popup.classList.add('hidden');
            this._cmdSelected = -1;
            return;
        }

        const filter = value.toLowerCase();
        const items = popup.querySelectorAll('.cmd-item');
        let visible = 0;
        this._cmdSelected = -1;

        items.forEach((item, _i) => {
            item.classList.remove('selected');
            const cmd = item.dataset.cmd.toLowerCase();
            if (cmd.startsWith(filter)) {
                item.classList.remove('hidden');
                visible++;
            } else {
                item.classList.add('hidden');
            }
        });

        if (visible > 0) {
            popup.classList.remove('hidden');
        } else {
            popup.classList.add('hidden');
        }
    }

    selectCommandPopup(index) {
        const popup = document.getElementById('command-popup');
        if (!popup || popup.classList.contains('hidden')) return;
        const items = popup.querySelectorAll('.cmd-item:not(.hidden)');
        if (items.length === 0) return;

        items.forEach(item => item.classList.remove('selected'));

        if (index < 0) {
            this._cmdSelected = -1;
            return;
        }
        if (index >= items.length) index = 0;
        if (index < 0) index = items.length - 1;

        items[index].classList.add('selected');
        items[index].scrollIntoView({ block: 'nearest' });
        this._cmdSelected = index;
    }

    applyCommandPopup() {
        const popup = document.getElementById('command-popup');
        if (!popup || popup.classList.contains('hidden')) return;
        const items = popup.querySelectorAll('.cmd-item:not(.hidden)');
        const idx = this._cmdSelected >= 0 ? this._cmdSelected : 0;
        if (idx < items.length) {
            const cmd = items[idx].dataset.cmd;
            this.ui.clearInput();
            this.ui.messageInput.value = cmd;
            this.ui.messageInput.focus();
        }
        popup.classList.add('hidden');
        this._cmdSelected = -1;
    }

    hideCommandPopup() {
        const popup = document.getElementById('command-popup');
        if (popup) popup.classList.add('hidden');
        this._cmdSelected = -1;
    }

    isCommandPopupOpen() {
        const popup = document.getElementById('command-popup');
        return popup && !popup.classList.contains('hidden');
    }
}

// Initialize chat client when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    let config = {};
    try {
        config = await ApiClient.get('/api/config');
    } catch (_e) {
        // config will be empty, features requiring config will be disabled
    }

    if (!config.turnstileSiteKey) {
        console.error('Failed to load configuration');
        return;
    }

    const emergency = await ApiClient.get('/api/emergency-announcement').catch(() => ({ isEmergency: false }));
    if (emergency.isEmergency) {
        const seenTs = localStorage.getItem('chatEmergencySeenTs');
        if (String(emergency.timestamp) !== seenTs) {
            localStorage.setItem('chatEmergencySeenTs', String(emergency.timestamp));
            localStorage.setItem('chatEmergencyRedirectTime', String(Date.now()));
            location.href = '/announcements.html?from=emergency';
            return;
        }
        localStorage.removeItem('chatEmergencyRedirectTime');
    } else {
        localStorage.removeItem('chatEmergencySeenTs');
        localStorage.removeItem('chatEmergencyRedirectTime');
    }

    window.chatClient = new ChatClient(config);
});

// Handle page visibility changes - proactively check and reconnect if needed
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        if (window.chatClient) {
            window.chatClient.clearUnreadTitle();
            if (window.chatClient.wsManager) {
                window.chatClient.wsManager.checkConnection();
            }
        }
    }
});

// Reconnect when the browsing device comes back online
window.addEventListener('online', () => {
    if (window.chatClient && window.chatClient.wsManager) {
        window.chatClient.wsManager.checkConnection();
    }
});

// Clean disconnect when page is unloaded
window.addEventListener('beforeunload', () => {
    if (window.chatClient && window.chatClient.wsManager) {
        window.chatClient.wsManager.disconnect();
    }
});
