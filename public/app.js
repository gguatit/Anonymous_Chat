// Anonymous Chat Client Application
class ChatClient {
    constructor() {
        this.ws = null;
        this.sessionId = this.getOrCreateSessionId();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.baseReconnectDelay = 1000;
        this.typingTimeout = null;
        this.lastMessageTime = 0;
        this.messageRateLimit = 1000; // 1 message per second
        this.isTyping = false;
        
        this.initializeUI();
        this.connect();
    }

    getOrCreateSessionId() {
        // Try to get existing sessionId from localStorage
        let sessionId = localStorage.getItem('chatSessionId');
        
        if (!sessionId) {
            // Generate new sessionId if not exists
            sessionId = this.generateSessionId();
            localStorage.setItem('chatSessionId', sessionId);
        }
        
        return sessionId;
    }

    generateSessionId() {
        // Generate a cryptographically secure random session ID for anonymous user
        // Using crypto.randomUUID() for better security than Math.random()
        return 'user_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16) + '_' + Date.now();
    }

    initializeUI() {
        this.messageForm = document.getElementById('message-form');
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-button');
        this.messagesContainer = document.getElementById('messages-container');
        this.connectionStatus = document.getElementById('connection-status');
        this.userCount = document.getElementById('count-number');
        this.typingIndicator = document.getElementById('typing-indicator');
        this.charCount = document.getElementById('char-count');
        this.scrollButton = document.getElementById('scroll-to-bottom');

        // Event listeners
        this.messageForm.addEventListener('submit', (e) => this.handleSubmit(e));
        this.messageInput.addEventListener('input', () => this.handleInput());
        this.messageInput.addEventListener('keydown', () => this.handleTyping());

        // Update character count
        this.messageInput.addEventListener('input', () => {
            this.charCount.textContent = this.messageInput.value.length;
        });
        
        // Scroll to bottom button
        this.scrollButton.addEventListener('click', () => {
            this.scrollToBottom(true);
        });
        
        // Show/hide scroll button based on scroll position
        this.messagesContainer.addEventListener('scroll', () => {
            this.updateScrollButton();
        });
    }

    connect() {
        try {
            // Use WebSocket protocol - in production, this would be wss://
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
            this.updateConnectionStatus('connecting', '연결 중');
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => this.handleOpen();
            this.ws.onmessage = (event) => this.handleMessage(event);
            this.ws.onclose = (event) => this.handleClose(event);
            this.ws.onerror = (error) => this.handleError(error);
            
        } catch (error) {
            console.error('Connection error:', error);
            this.scheduleReconnect();
        }
    }

    handleOpen() {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.updateConnectionStatus('connected', '연결됨');
        this.sendButton.disabled = false;
        this.messageInput.disabled = false;
        
        // Send join message
        this.send({
            type: 'join',
            sessionId: this.sessionId,
            timestamp: Date.now()
        });
    }

    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'message':
                    this.displayMessage(data);
                    break;
                case 'user_count':
                    this.updateUserCount(data.count);
                    break;
                case 'typing':
                    this.showTypingIndicator(data);
                    break;
                case 'system':
                    this.displaySystemMessage(data.content);
                    break;
                case 'error':
                    this.displayError(data.content);
                    break;
                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    }

    handleClose(event) {
        console.log('WebSocket closed:', event.code, event.reason);
        this.updateConnectionStatus('disconnected', '연결 끊김');
        this.sendButton.disabled = true;
        this.messageInput.disabled = true;
        
        if (!event.wasClean) {
            this.scheduleReconnect();
        }
    }

    handleError(error) {
        console.error('WebSocket error:', error);
        this.updateConnectionStatus('error', '오류 발생');
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.displayError('재연결 실패. 페이지를 새로고침해주세요.');
            return;
        }

        // Exponential backoff: delay = baseDelay * 2^attempts
        const delay = Math.min(
            this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
            30000 // Max 30 seconds
        );
        
        this.reconnectAttempts++;
        this.updateConnectionStatus('reconnecting', `재연결 중 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
            console.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            this.connect();
        }, delay);
    }

    handleSubmit(e) {
        e.preventDefault();
        
        const message = this.messageInput.value.trim();
        if (!message) return;

        // Rate limiting check
        const now = Date.now();
        if (now - this.lastMessageTime < this.messageRateLimit) {
            this.displayError('메시지를 너무 빠르게 전송하고 있습니다.');
            return;
        }

        // Validate message length
        if (message.length > 500) {
            this.displayError('메시지는 최대 500자까지 가능합니다.');
            return;
        }

        this.send({
            type: 'message',
            content: this.sanitizeInput(message),
            sessionId: this.sessionId,
            timestamp: now
        });

        this.lastMessageTime = now;
        this.messageInput.value = '';
        this.charCount.textContent = '0';
    }

    handleInput() {
        // Clear typing indicator timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
    }

    handleTyping() {
        if (!this.isTyping && this.messageInput.value.length > 0) {
            this.isTyping = true;
            this.send({
                type: 'typing',
                sessionId: this.sessionId,
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
                this.send({
                    type: 'typing',
                    sessionId: this.sessionId,
                    typing: false
                });
            }
        }, 2000);
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    sanitizeInput(input) {
        // Basic XSS prevention
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    displayMessage(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message-enter p-2.5 rounded-lg ' + 
            (data.sessionId === this.sessionId ? 'bg-blue-900/80 ml-auto' : 'bg-gray-700/80');
        messageDiv.style.maxWidth = '75%';
        
        const isOwnMessage = data.sessionId === this.sessionId;
        
        const timestamp = new Date(data.timestamp).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageDiv.innerHTML = `
            <div class="flex items-start justify-between gap-2 mb-1">
                <span class="text-xs font-medium ${isOwnMessage ? 'text-blue-300' : 'text-gray-400'}">
                    ${isOwnMessage ? '나' : '익명'}
                </span>
                <span class="text-xs text-gray-500">${timestamp}</span>
            </div>
            <div class="text-sm break-words leading-relaxed">${this.sanitizeInput(data.content)}</div>
        `;

        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    displaySystemMessage(content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'text-center text-xs text-gray-500 py-1.5';
        messageDiv.textContent = content;
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    displayError(content) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'text-center text-xs text-red-400 py-2 bg-red-900/20 rounded-lg mx-4';
        errorDiv.textContent = content;
        this.messagesContainer.appendChild(errorDiv);
        this.scrollToBottom();
        
        // Auto-remove error after 4 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 4000);
    }

    showTypingIndicator(data) {
        if (data.sessionId === this.sessionId) return;
        
        if (data.typing) {
            this.typingIndicator.classList.remove('hidden');
        } else {
            this.typingIndicator.classList.add('hidden');
        }
    }

    updateUserCount(count) {
        this.userCount.textContent = count;
    }

    updateConnectionStatus(status, text) {
        const statusDot = this.connectionStatus.querySelector('.w-2');
        const statusText = this.connectionStatus.querySelector('.text-xs');
        
        statusText.textContent = text;
        
        const colors = {
            connecting: 'bg-yellow-500',
            connected: 'bg-green-500',
            disconnected: 'bg-red-500',
            reconnecting: 'bg-orange-500',
            error: 'bg-red-600'
        };
        
        statusDot.className = `w-2 h-2 rounded-full ${colors[status] || 'bg-gray-500'}`;
    }

    scrollToBottom(smooth = false) {
        if (smooth) {
            this.messagesContainer.scrollTo({
                top: this.messagesContainer.scrollHeight,
                behavior: 'smooth'
            });
        } else {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
        this.updateScrollButton();
    }
    
    updateScrollButton() {
        const container = this.messagesContainer;
        const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        
        if (isAtBottom) {
            this.scrollButton.classList.add('opacity-0', 'pointer-events-none');
            this.scrollButton.classList.remove('opacity-100', 'pointer-events-auto');
        } else {
            this.scrollButton.classList.remove('opacity-0', 'pointer-events-none');
            this.scrollButton.classList.add('opacity-100', 'pointer-events-auto');
        }
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
        if (window.chatClient.ws.readyState !== WebSocket.OPEN) {
            window.chatClient.connect();
        }
    }
});
