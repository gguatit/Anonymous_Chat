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
        this.nicknameButton = document.getElementById('nickname-button');
        this.nicknameModal = document.getElementById('nickname-modal');
        this.nicknameInput = document.getElementById('nickname-input');
        this.nicknameForm = document.getElementById('nickname-form');
        this.clearNicknameButton = document.getElementById('clear-nickname');
        this.closeModalButton = document.getElementById('close-modal');
        this.currentNicknameDisplay = document.getElementById('current-nickname');
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
        
        // Nickname modal
        this.nicknameButton.addEventListener('click', callbacks.onNicknameClick);
        this.nicknameForm.addEventListener('submit', callbacks.onNicknameSubmit);
        this.clearNicknameButton.addEventListener('click', callbacks.onNicknameClear);
        this.closeModalButton.addEventListener('click', callbacks.onModalClose);
        
        // Close modal on background click
        this.nicknameModal.addEventListener('click', (e) => {
            if (e.target === this.nicknameModal) {
                callbacks.onModalClose();
            }
        });
    }

    displayMessage(data, isOwnMessage, sessionId, nickname = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message-enter p-2.5 rounded-lg ' + 
            (data.sessionId === sessionId ? 'bg-blue-900/80 ml-auto' : 'bg-gray-700/80');
        messageDiv.style.maxWidth = '75%';
        
        const timestamp = new Date(data.timestamp).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const displayName = isOwnMessage 
            ? (nickname || '나') 
            : (data.nickname || '익명');

        messageDiv.innerHTML = `
            <div class="flex items-start justify-between gap-2 mb-1">
                <span class="text-xs font-medium ${isOwnMessage ? 'text-blue-300' : 'text-gray-400'}">
                    ${displayName}
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

    sanitizeInput(input) {
        // Basic XSS prevention
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    showNicknameModal() {
        this.nicknameModal.classList.remove('hidden');
    }

    hideNicknameModal() {
        this.nicknameModal.classList.add('hidden');
        this.nicknameInput.value = '';
    }

    updateNicknameDisplay(nickname) {
        if (nickname) {
            this.currentNicknameDisplay.textContent = `현재 닉네임: ${this.sanitizeInput(nickname)}`;
            this.currentNicknameDisplay.classList.remove('hidden');
            this.clearNicknameButton.classList.remove('hidden');
        } else {
            this.currentNicknameDisplay.classList.add('hidden');
            this.clearNicknameButton.classList.add('hidden');
        }
    }

    getNicknameInputValue() {
        return this.nicknameInput.value.trim();
    }
}
