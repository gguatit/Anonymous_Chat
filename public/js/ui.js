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
        messageDiv.setAttribute('data-message-id', data.messageId);
        messageDiv.setAttribute('data-timestamp', data.timestamp);
        
        const timestamp = new Date(data.timestamp).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Check if message can be edited (within 10 minutes and own message)
        const canEdit = isOwnMessage && data.timestamp && (Date.now() - data.timestamp < 10 * 60 * 1000);
        const editedLabel = data.editedAt ? ' <span class="text-xs text-gray-500">(수정됨)</span>' : '';

        messageDiv.innerHTML = `
            <div class="flex items-start justify-between gap-2 mb-1">
                <span class="text-xs font-medium ${isOwnMessage ? 'text-blue-300' : 'text-gray-400'}">
                    ${isOwnMessage ? '나' : '익명'}${editedLabel}
                </span>
                <span class="text-xs text-gray-500">${timestamp}</span>
            </div>
            <div class="text-sm break-words leading-relaxed message-content">${this.sanitizeInput(data.content)}</div>
        `;

        // Add long-press and right-click for editing own messages
        if (canEdit) {
            this.addEditInteractions(messageDiv, data.messageId);
        }

        // 메시지를 DOM에 추가 (MutationObserver가 자동으로 스크롤 처리)
        this.messagesContainer.appendChild(messageDiv);
    }

    addEditInteractions(messageDiv, messageId) {
        let longPressTimer;
        let isLongPress = false;

        // Long press for mobile
        messageDiv.addEventListener('touchstart', (e) => {
            isLongPress = false;
            longPressTimer = setTimeout(() => {
                isLongPress = true;
                this.showContextMenu(e, messageId);
            }, 500); // 500ms long press
        });

        messageDiv.addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
        });

        messageDiv.addEventListener('touchmove', () => {
            clearTimeout(longPressTimer);
        });

        // Right-click for desktop
        messageDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e, messageId);
        });

        // Add visual feedback
        messageDiv.style.cursor = 'pointer';
        messageDiv.style.userSelect = 'none';
    }

    showContextMenu(event, messageId) {
        // Remove existing context menu if any
        const existingMenu = document.getElementById('message-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // Create context menu
        const menu = document.createElement('div');
        menu.id = 'message-context-menu';
        menu.className = 'fixed bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-1 z-50';
        menu.style.minWidth = '120px';

        menu.innerHTML = `
            <button class="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors">
                메시지 수정
            </button>
        `;

        // Position the menu
        const x = event.touches ? event.touches[0].clientX : event.clientX;
        const y = event.touches ? event.touches[0].clientY : event.clientY;
        
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        document.body.appendChild(menu);

        // Adjust position if menu goes off-screen
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${window.innerWidth - rect.width - 10}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${y - rect.height}px`;
        }

        // Add click handler
        const editButton = menu.querySelector('button');
        editButton.addEventListener('click', () => {
            menu.remove();
            // Get current content from DOM (최신 수정된 내용)
            const messageDiv = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
            const contentDiv = messageDiv.querySelector('.message-content');
            const currentContent = contentDiv.textContent;
            this.showEditMode(messageId, currentContent);
        });
        // Close menu when clicking outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
                document.removeEventListener('touchstart', closeMenu);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closeMenu);
            document.addEventListener('touchstart', closeMenu);
        }, 100);
    }

    showEditMode(messageId, currentContent) {iner.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageDiv) return;

        const contentDiv = messageDiv.querySelector('.message-content');
        const originalContent = currentContent;

        // Create edit input
        contentDiv.innerHTML = `
            <div class="flex flex-col gap-2">
                <textarea class="edit-input bg-gray-800 text-gray-100 border border-gray-600 rounded px-2 py-1 text-sm w-full resize-none"
                          rows="2"
                          maxlength="500">${this.sanitizeInput(originalContent)}</textarea>
                <div class="flex gap-2 justify-end">
                    <button class="cancel-edit-btn text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded">취소</button>
                    <button class="save-edit-btn text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded">저장</button>
                </div>
            </div>
        `;

        const editInput = contentDiv.querySelector('.edit-input');
        const cancelBtn = contentDiv.querySelector('.cancel-edit-btn');
        const saveBtn = contentDiv.querySelector('.save-edit-btn');

        // Focus and select text
        editInput.focus();
        editInput.setSelectionRange(editInput.value.length, editInput.value.length);

        // Cancel edit
        cancelBtn.addEventListener('click', () => {
            contentDiv.innerHTML = this.sanitizeInput(originalContent);
        });

        // Save edit
        saveBtn.addEventListener('click', () => {
            const newContent = editInput.value.trim();
            if (!newContent) {
                alert('메시지 내용이 비어있습니다.');
                return;
            }
            if (newContent === originalContent) {
                contentDiv.innerHTML = this.sanitizeInput(originalContent);
                return;
            }

            // Trigger edit event (handled by chat.js)
            if (window.chatClient) {
                window.chatClient.editMessage(messageId, newContent);
            }
        });

        // Save on Enter (Shift+Enter for new line)
        editInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveBtn.click();
            }
            if (e.key === 'Escape') {
                cancelBtn.click();
            }
        });
    }

    updateMessage(messageId, newContent, editedAt) {
        const messageDiv = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageDiv) return;

        const contentDiv = messageDiv.querySelector('.message-content');
        contentDiv.innerHTML = this.sanitizeInput(newContent);

        // Update edited label
        const nameSpan = messageDiv.querySelector('.text-xs.font-medium');
        if (nameSpan && !nameSpan.innerHTML.includes('수정됨')) {
            nameSpan.innerHTML += ' <span class="text-xs text-gray-500">(수정됨)</span>';
        }

        // Remove edit button after 10 minutes elapsed
        const editBtn = messageDiv.querySelector('.edit-message-btn');
        if (editBtn) {
            const messageTimestamp = parseInt(messageDiv.closest('[data-message]').dataset.timestamp || '0');
            if (Date.now() - messageTimestamp >= 10 * 60 * 1000) {
                editBtn.remove();
            }
        }
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
        
        if (smooth) {
            // 부드러운 스크롤 애니메이션
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        } else {
            // 즉시 스크롤
            container.scrollTop = container.scrollHeight;
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
