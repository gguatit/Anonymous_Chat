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
        
        // MutationObserver로 메시지 추가 감지하여 자동 스크롤
        this.initAutoScroll();
    }
    
    /**
     * MutationObserver를 사용하여 새 메시지 추가 시 자동 스크롤
     */
    initAutoScroll() {
        const observer = new MutationObserver((mutations) => {
            // 새로운 메시지(data-message 속성을 가진 요소)가 추가되었는지 확인
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        // data-message 표식이 있는 요소가 추가되면 스크롤
                        if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('data-message')) {
                            console.log('New message detected, scrolling to bottom');
                            this.scrollToBottom();
                            return; // 한 번만 스크롤
                        }
                    }
                }
            }
        });
        
        // messagesContainer의 자식 요소 변경 감지
        observer.observe(this.messagesContainer, {
            childList: true,
            subtree: false
        });
        
        console.log('MutationObserver initialized for:', this.messagesContainer);
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
        
        // Scroll button
        this.scrollButton.addEventListener('click', callbacks.onScrollClick);
        this.messagesContainer.addEventListener('scroll', callbacks.onScroll);
    }

    displayMessage(data, isOwnMessage, sessionId) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message-enter p-2.5 rounded-lg ' + 
            (data.sessionId === sessionId ? 'bg-blue-900/80 ml-auto' : 'bg-gray-700/80');
        messageDiv.style.maxWidth = '75%';
        
        // 메시지 표식 추가 (MutationObserver가 감지)
        messageDiv.setAttribute('data-message', 'true');
        
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

        // 메시지를 DOM에 추가 (MutationObserver가 자동으로 스크롤 처리)
        this.messagesContainer.appendChild(messageDiv);
    }

    displaySystemMessage(content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'text-center text-xs text-gray-500 py-1.5';
        messageDiv.textContent = content;
        
        // 시스템 메시지 표식 추가
        messageDiv.setAttribute('data-message', 'true');
        
        this.messagesContainer.appendChild(messageDiv);
    }

    displayError(content) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'text-center text-xs text-red-400 py-2 bg-red-900/20 rounded-lg mx-4';
        errorDiv.textContent = content;
        
        // 에러 메시지 표식 추가
        errorDiv.setAttribute('data-message', 'true');
        
        this.messagesContainer.appendChild(errorDiv);
        
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
        
        console.log('Container info:', {
            scrollTop: container.scrollTop,
            scrollHeight: container.scrollHeight,
            clientHeight: container.clientHeight,
            offsetHeight: container.offsetHeight
        });
        
        if (smooth) {
            // 부드러운 스크롤 애니메이션
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        } else {
            // 즉시 스크롤 - scrollTop 직접 설정
            container.scrollTop = container.scrollHeight;
            
            // 강제로 다시 시도 (DOM 업데이트 후)
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
                console.log('After scroll attempt - scrollTop:', container.scrollTop);
            }, 0);
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
