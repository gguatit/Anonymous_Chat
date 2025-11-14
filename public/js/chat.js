// Main Chat Client Application
import { SessionManager } from './session.js';
import { WebSocketManager } from './websocket.js';
import { UIManager } from './ui.js';

class ChatClient {
    constructor() {
        // Initialize managers
        this.sessionManager = new SessionManager();
        this.ui = new UIManager();
        
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
            onScroll: () => this.ui.updateScrollButton()
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
                break;
            case 'disconnected':
                statusText = '연결 끊김';
                this.ui.setInputEnabled(false);
                break;
            case 'reconnecting':
                statusText = `재연결 중 (${attempt}/${max})`;
                this.ui.setInputEnabled(false);
                break;
            case 'error':
                statusText = '오류 발생';
                this.ui.setInputEnabled(false);
                break;
        }
        
        this.ui.updateConnectionStatus(status, statusText);
    }

    handleSubmit(e) {
        e.preventDefault();
        
        const message = this.ui.getInputValue();
        if (!message) return;

        // Rate limiting check
        const now = Date.now();
        if (now - this.lastMessageTime < this.messageRateLimit) {
            this.ui.displayError('메시지를 너무 빠르게 전송하고 있습니다.');
            return;
        }

        // Validate message length
        if (message.length > 500) {
            this.ui.displayError('메시지는 최대 500자까지 가능합니다.');
            return;
        }

        // Prepare message data (서버에서 서명 생성)
        const messageData = {
            type: 'message',
            content: this.ui.sanitizeInput(message),
            sessionId: this.sessionManager.getSessionId(),
            timestamp: now
        };

        // Send without signature - server will sign it
        this.wsManager.send(messageData);

        this.lastMessageTime = now;
        this.ui.clearInput();
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

        if (newContent.length > 500) {
            this.ui.displayError('메시지는 최대 500자까지 가능합니다.');
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
}

// Initialize chat client when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chatClient = new ChatClient();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.chatClient) {
        // Reconnect if disconnected when page becomes visible
        if (!window.chatClient.wsManager.isConnected()) {
            window.chatClient.wsManager.connect();
        }
    }
});
