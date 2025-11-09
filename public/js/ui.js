// UI Manager - handles all DOM interactions
export class UIManager {
    constructor() {
        this.messageForm = document.getElementById('message-form');
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-button');
        this.messagesContainer = document.getElementById('messages-container');
        this.connectionStatus = document.getElementById('connection-status');
        this.userCount = document.getElementById('count-number');
        this.typingIndicator = document.getElementById('typing-indicator');
        this.charCount = document.getElementById('char-count');
        this.scrollButton = document.getElementById('scroll-to-bottom');
        
        // Auto-scroll control (사용자가 스크롤 위치를 조작했는지 추적)
        this.autoScrollEnabled = true;
        this.scrollThreshold = 50; // 하단에서 50px 이상 떨어지면 자동 스크롤 비활성화
    }

    initializeEventListeners(callbacks) {
        // Form submission
        this.messageForm.addEventListener('submit', callbacks.onSubmit);
        
        // Input handling
        this.messageInput.addEventListener('input', callbacks.onInput);
        this.messageInput.addEventListener('keydown', callbacks.onTyping);
        
        // Character count
        this.messageInput.addEventListener('input', () => {
            this.charCount.textContent = this.messageInput.value.length;
        });
        
        // Scroll button - 클릭 시 자동 스크롤 재활성화
        this.scrollButton.addEventListener('click', () => {
            this.autoScrollEnabled = true;
            callbacks.onScrollClick();
        });
        
        // Scroll event - 사용자가 위로 스크롤하면 자동 스크롤 비활성화
        this.messagesContainer.addEventListener('scroll', () => {
            this.checkScrollPosition();
            callbacks.onScroll();
        });
    }
    
    /**
     * 스크롤 위치를 확인하여 자동 스크롤 활성화/비활성화 결정
     * 사용자가 맨 아래에서 threshold 이상 위로 스크롤하면 자동 스크롤 비활성화
     */
    checkScrollPosition() {
        const container = this.messagesContainer;
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        
        // 현재 스크롤 위치가 하단에서 threshold 이내인지 확인
        const isNearBottom = (scrollTop + clientHeight) >= (scrollHeight - this.scrollThreshold);
        
        // 사용자가 맨 아래에 있으면 자동 스크롤 활성화
        if (isNearBottom) {
            this.autoScrollEnabled = true;
        } else {
            // 위로 스크롤했으면 자동 스크롤 비활성화
            this.autoScrollEnabled = false;
        }
    }

    displayMessage(data, isOwnMessage, sessionId) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message-enter p-2.5 rounded-lg ' + 
            (data.sessionId === sessionId ? 'bg-blue-900/80 ml-auto' : 'bg-gray-700/80');
        messageDiv.style.maxWidth = '75%';
        
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

        // 메시지를 DOM에 추가
        this.messagesContainer.appendChild(messageDiv);
        
        // 내가 보낸 메시지는 무조건 스크롤, 다른 사람 메시지는 자동 스크롤 설정 따름
        if (isOwnMessage || this.autoScrollEnabled) {
            this.scrollToBottom();
            // 내가 메시지를 보냈으면 자동 스크롤 활성화
            if (isOwnMessage) {
                this.autoScrollEnabled = true;
            }
        }
    }

    displaySystemMessage(content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'text-center text-xs text-gray-500 py-1.5';
        messageDiv.textContent = content;
        this.messagesContainer.appendChild(messageDiv);
        
        // 시스템 메시지는 항상 자동 스크롤
        if (this.autoScrollEnabled) {
            this.scrollToBottom();
        }
    }

    displayError(content) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'text-center text-xs text-red-400 py-2 bg-red-900/20 rounded-lg mx-4';
        errorDiv.textContent = content;
        this.messagesContainer.appendChild(errorDiv);
        
        // 에러 메시지는 항상 자동 스크롤
        if (this.autoScrollEnabled) {
            this.scrollToBottom();
        }
        
        // Auto-remove error after 4 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 4000);
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

    showTypingIndicator(show) {
        if (show) {
            this.typingIndicator.classList.remove('hidden');
        } else {
            this.typingIndicator.classList.add('hidden');
        }
    }

    setInputEnabled(enabled) {
        this.sendButton.disabled = !enabled;
        this.messageInput.disabled = !enabled;
    }

    clearInput() {
        this.messageInput.value = '';
        this.charCount.textContent = '0';
    }

    getInputValue() {
        return this.messageInput.value.trim();
    }

    getInputLength() {
        return this.messageInput.value.length;
    }

    scrollToBottom(smooth = false) {
        const container = this.messagesContainer;
        
        if (smooth) {
            // 부드러운 스크롤 애니메이션
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        } else {
            // 즉시 스크롤 (requestAnimationFrame으로 DOM 업데이트 후 실행)
            requestAnimationFrame(() => {
                container.scrollTop = container.scrollHeight;
            });
        }
        
        // 스크롤 버튼 상태 업데이트
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

    sanitizeInput(input) {
        // Basic XSS prevention
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }
}
