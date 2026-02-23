// Main Chat Client Application
import { SessionManager } from './session.js';
import { WebSocketManager } from './websocket.js';
import { UIManager } from './ui.js';
import { FileUploadManager } from './file-upload.js';
import { DeadDropClient } from './dead-drop.js';

class ChatClient {
    constructor() {
        // Initialize managers
        this.sessionManager = new SessionManager();
        this.ui = new UIManager();
        this.fileUpload = new FileUploadManager('https://static.a85labs.net');
        this.deadDrop = new DeadDropClient('https://api.kalpha.kr');

        // State
        this.typingTimeout = null;
        this.lastMessageTime = 0;
        this.messageRateLimit = 1000; // 1 message per second
        this.isTyping = false;

        // Initialize WebSocket with message handler
        this.wsManager = new WebSocketManager(
            this.sessionManager.getSessionId(),
            {
                onMessage: (data) => this.handleMessage(data),
                onConnectionChange: (status, attempt, max) => this.handleConnectionChange(status, attempt, max),
                onError: (message) => this.ui.displayError(message)
            }
        );

        this.initializeUI();
        this.wsManager.connect();
    }

    initializeUI() {
        this.ui.initializeEventListeners({
            onSubmit: (e) => this.handleSubmit(e),
            onInput: () => this.handleInput(),
            onTyping: () => this.handleTyping(),
            onScrollClick: () => this.ui.scrollToBottom(true),
            onScroll: () => this.ui.updateScrollButton(),
            onDelete: (messageId) => this.deleteMessage(messageId),
            onRevealSecret: (secretId, container) => this.revealSecretMessage(secretId, container)
        });
    }

    handleMessage(data) {
        switch (data.type) {
            case 'message':
                this.ui.displayMessage(
                    data,
                    data.sessionId === this.sessionManager.getSessionId(),
                    this.sessionManager.getSessionId()
                );
                break;
            case 'message_edited':
                // Update existing message in UI
                this.ui.updateMessage(data.message.messageId, data.message.content, data.message.editedAt);
                break;
            case 'message_deleted':
                // Remove message from UI
                this.ui.removeMessage(data.messageId);
                break;
            case 'user_count':
                this.ui.updateUserCount(data.count);
                break;
            case 'typing':
                if (data.sessionId !== this.sessionManager.getSessionId()) {
                    this.ui.showTypingIndicator(data.typing);
                }
                break;
            case 'system':
                this.ui.displaySystemMessage(data.content);
                break;
            case 'announcement':
                // Display system announcement with special styling
                console.log('Received announcement:', data.content);
                this.ui.displayAnnouncement(data.content);
                break;
            case 'kicked':
                // User was kicked by admin
                const banDuration = data.banDuration || 0;
                const isPermanent = data.permanent === true;
                const isSessionBan = data.sessionBan === true;

                if (isPermanent && banDuration > 0) {
                    // 차단 - 재접속 금지
                    const minutes = Math.floor(banDuration / 60);
                    const seconds = banDuration % 60;
                    const timeStr = minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;

                    this.ui.displayError(`${data.content}\n재접속은 ${timeStr} 후 가능합니다.`);
                    this.ui.setInputEnabled(false);

                    if (isSessionBan) {
                        // 세션 밴: 세션 ID를 유지하여 재접속 시 같은 (밴된) ID로 거부되도록 함
                        // localStorage.removeItem 하지 않음!
                    } else {
                        // IP 밴: 세션 ID 삭제 (IP로 차단되므로 새 세션이어도 거부됨)
                        localStorage.removeItem('chatSessionId');
                    }

                    // WebSocket 연결 완전 종료
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
                    }, 2000);
                }
                break;
            case 'banned':
                // Session or IP is banned
                this.ui.displayError(data.content);
                this.ui.setInputEnabled(false);

                // 세션 ID 삭제
                localStorage.removeItem('chatSessionId');

                // WebSocket 연결 종료
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
            case 'error':
                this.ui.displayError(data.content);
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    handleConnectionChange(status, attempt, max) {
        let statusText = '';

        switch (status) {
            case 'connected':
                statusText = '연결됨';
                this.ui.setInputEnabled(true);
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

        const message = this.ui.getInputValue();
        const trimmedMessage = message.trim();
        const hasFile = this.fileUpload.hasFile();

        // 메시지나 파일 중 하나는 있어야 함
        if (!trimmedMessage && !hasFile) return;

        // Rate limiting check
        const now = Date.now();
        if (now - this.lastMessageTime < this.messageRateLimit) {
            this.ui.displayError('메시지를 너무 빠르게 전송하고 있습니다.');
            return;
        }

        // Validate message length (count raw characters, including newlines)
        if (message.length > 5000) {
            this.ui.displayError('메시지는 최대 5000자까지 가능합니다.');
            return;
        }

        // Prepare message data
        const messageData = {
            type: 'message',
            // Preserve newlines; sanitizeInput will escape HTML but keep the text as-is
            content: this.ui.sanitizeInput(message) || '',
            sessionId: this.sessionManager.getSessionId(),
            timestamp: now
        };

        // 답장 정보 추가
        const replyingTo = this.ui.getReplyingTo();
        if (replyingTo) {
            if (replyingTo.isSecret) {
                // 비밀 메시지로 보내기 - Dead Drop에 저장
                try {
                    const deadDropResult = await this.deadDrop.store(trimmedMessage || '[파일]');
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

        // Upload file if selected
        if (hasFile) {
            try {
                const fileData = await this.fileUpload.uploadFile();

                console.log('File uploaded successfully:', fileData);

                // Add file info to message
                messageData.file = {
                    url: fileData.url,
                    filename: fileData.filename,
                    filesize: fileData.filesize,
                    filetype: fileData.filetype
                };

                this.fileUpload.clearFile();
            } catch (error) {
                console.error('File upload failed:', error);
                this.ui.displayError('파일 업로드 실패: ' + error.message);
                return;
            }
        }

        // Send message with or without file
        this.wsManager.send(messageData);

        this.lastMessageTime = now;
        this.ui.clearInput();
        this.ui.cancelReply(); // \ub2f5\uc7a5 \uc0c1\ud0dc \ucd08\uae30\ud654
    }

    // Note: 서명 생성은 서버에서만 수행됨 (보안 강화)
    // 클라이언트는 서명 없이 메시지를 전송하고, 서버가 검증 후 서명을 추가함

    handleInput() {
        // Clear typing indicator timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
    }

    handleTyping() {
        if (!this.isTyping && this.ui.getInputLength() > 0) {
            this.isTyping = true;
            this.wsManager.send({
                type: 'typing',
                sessionId: this.sessionManager.getSessionId(),
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
                    typing: false
                });
            }
        }, 2000);
    }

    async editMessage(messageId, newContent) {
        // Validate new content
        if (!newContent || newContent.trim().length === 0) {
            this.ui.displayError('메시지 내용이 비어있습니다.');
            return;
        }

        if (newContent.length > 5000) {
            this.ui.displayError('메시지는 최대 5000자까지 가능합니다.');
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

    async revealSecretMessage(secretId, container) {
        const btn = container.querySelector('.reveal-secret-btn');
        const contentDiv = container.querySelector('.secret-message-content');

        if (!btn || !contentDiv) return;

        // 버튼 비활성화 및 로딩 상태 표시
        btn.disabled = true;
        btn.textContent = '읽는 중...';

        try {
            // Dead Drop에서 메시지 읽기 (한 번만 가능)
            const result = await this.deadDrop.read(secretId);

            // 버튼 숨기고 메시지 표시
            btn.remove();
            contentDiv.classList.remove('hidden');
            contentDiv.innerHTML = `
                <div class="text-green-400 text-xs mb-2">✓ 비밀 메시지가 공개되었습니다 (이 메시지는 삭제되었습니다)</div>
                <div class="text-gray-100">${this.ui.sanitizeInput(result.message)}</div>
            `;
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
}

// Initialize chat client when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chatClient = new ChatClient();
});

// Handle page visibility changes - don't disconnect, just let heartbeat handle it
document.addEventListener('visibilitychange', () => {
    // The heartbeat mechanism will keep the connection alive
    // No need to manually reconnect
});

// Clean disconnect when page is unloaded
window.addEventListener('beforeunload', () => {
    if (window.chatClient && window.chatClient.wsManager) {
        window.chatClient.wsManager.disconnect();
    }
});
