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
        
        // 답장 상태
        this.replyingTo = null; // { messageId, content, isOwnMessage }
        
        // Announcement banner elements
        this.announcementBanner = document.getElementById('announcement-banner');
        this.announcementContent = document.getElementById('announcement-content');
        this.announcementTime = document.getElementById('announcement-time');
        this.announcementClose = document.getElementById('announcement-close');
        
        // Setup announcement close button
        if (this.announcementClose) {
            this.announcementClose.addEventListener('click', () => {
                this.hideAnnouncement();
            });
        }
        
        // MutationObserver로 메시지 추가 감지하여 자동 스크롤
        this.initAutoScroll();
    }
    
    /**
     * Validate URL to prevent XSS attacks
     */
    isValidUrl(url) {
        try {
            const parsed = new URL(url);
            // Only allow http and https protocols
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
            return false;
        }
    }
    
    /**
     * Sanitize and encode URL for HTML attributes
     */
    sanitizeUrl(url) {
        if (!this.isValidUrl(url)) {
            return '#';
        }
        // Encode special characters
        return url.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

        // Enter to send, Shift+Enter to insert newline (works for textarea)
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                // Submit the form programmatically
                if (typeof this.messageForm.requestSubmit === 'function') {
                    this.messageForm.requestSubmit();
                } else {
                    // Fallback for older browsers
                    callbacks.onSubmit(new Event('submit', { bubbles: true, cancelable: true }));
                }
            }
        });
        
        // Character count
        this.messageInput.addEventListener('input', () => {
            this.charCount.textContent = this.messageInput.value.length;
        });
        
        // Scroll button
        this.scrollButton.addEventListener('click', callbacks.onScrollClick);
        this.messagesContainer.addEventListener('scroll', callbacks.onScroll);
        
        // Store delete callback
        this.onDelete = callbacks.onDelete;
    }

    displayMessage(data, isOwnMessage, sessionId) {
        // 중복 메시지 체크 - 이미 표시된 메시지는 무시
        if (data.messageId && this.messagesContainer.querySelector(`[data-message-id="${data.messageId}"]`)) {
            return; // 이미 표시된 메시지는 스킵
        }

        const isAdmin = !!(data.sessionId && String(data.sessionId).startsWith('admin_'));

        const messageDiv = document.createElement('div');
        // Admin messages use a distinct accent and left alignment; own messages stay on the right
        if (isAdmin) {
            messageDiv.className = 'message-enter p-3 rounded-lg border-l-4 border-yellow-400 bg-yellow-900/20 shadow-lg ring-1 ring-yellow-400/20';
            messageDiv.style.marginLeft = '0';
            messageDiv.style.marginRight = 'auto';
            // Accessibility hints for admin messages
            messageDiv.setAttribute('role', 'region');
            messageDiv.setAttribute('aria-live', 'polite');
            messageDiv.setAttribute('aria-label', '관리자 메시지');
        } else {
            messageDiv.className = 'message-enter p-2.5 rounded-lg ' + 
                (data.sessionId === sessionId ? 'bg-blue-900/80 ml-auto' : 'bg-gray-700/80');
        }
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

        // Build message content
        let contentHtml = '';
        
        // 답장된 메시지 표시
        if (data.replyTo) {
            const replyContent = data.replyTo.content || '[파일]';
            const truncatedReply = replyContent.length > 50 
                ? replyContent.substring(0, 50) + '...' 
                : replyContent;
            const replyLabel = data.replyTo.isOwnMessage ? '내 메시지' : '익명';
            
            contentHtml += `
                <div class="reply-reference bg-gray-800/50 border-l-2 border-gray-500 pl-2 py-1 mb-2 text-xs">
                    <div class="text-gray-400">${replyLabel}에게 답장:</div>
                    <div class="text-gray-300 italic">${this.sanitizeInput(truncatedReply)}</div>
                </div>
            `;
        }
        
        // Add text content if exists
        if (data.content && data.content.trim()) {
            contentHtml += `<div class="text-sm break-words leading-relaxed message-content">${this.formatMessageContent(data.content)}</div>`;
        }
        
        // Add file if exists
        if (data.file && data.file.url) {
            contentHtml += this.formatFileContent(data.file);
        }
        
        // If neither content nor file exists, show a placeholder
        if (!contentHtml) {
            contentHtml = '<div class="text-sm text-gray-500 italic">내용 없음</div>';
        }

        // Name/label section: show 관리자 for admin messages
        // 관리자 메시지는 아이콘 없이 텍스트로만 강조
        const nameLabel = isAdmin
            ? `<span class="text-xs font-semibold text-yellow-300">관리자</span>`
            : `<span class="text-xs font-medium ${isOwnMessage ? 'text-blue-300' : 'text-gray-400'}">${isOwnMessage ? '나' : '익명'}</span>`;

        messageDiv.innerHTML = `
            <div class="flex items-start justify-between gap-2 mb-1">
                <div class="flex items-center gap-2">${nameLabel}${editedLabel}</div>
                <span class="text-xs text-gray-500">${timestamp}</span>
            </div>
            ${contentHtml}
        `;

        // 모든 메시지에 컨텍스트 메뉴 추가 (답장 기능을 위해)
        this.addMessageInteractions(messageDiv, data.messageId, canEdit);

        // 메시지를 DOM에 추가 (MutationObserver가 자동으로 스크롤 처리)
        this.messagesContainer.appendChild(messageDiv);
    }

    addMessageInteractions(messageDiv, messageId, canEdit) {
        let longPressTimer;
        let isLongPress = false;

        // Long press for mobile
        messageDiv.addEventListener('touchstart', (e) => {
            isLongPress = false;
            longPressTimer = setTimeout(() => {
                isLongPress = true;
                this.showContextMenu(e, messageId, canEdit);
            }, 500); // 500ms long press
        }, { passive: true });

        messageDiv.addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
        }, { passive: true });

        messageDiv.addEventListener('touchmove', () => {
            clearTimeout(longPressTimer);
        }, { passive: true });

        // Right-click for desktop
        messageDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e, messageId, canEdit);
        });

        // Add visual feedback
        messageDiv.style.cursor = 'pointer';
        messageDiv.style.userSelect = 'none';
    }

    showContextMenu(event, messageId, canEdit = false) {
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
            <button class="reply-message-btn w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors">
                답장하기
            </button>
            ${canEdit ? `
            <button class="edit-message-btn w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors">
                메시지 수정
            </button>
            <button class="delete-message-btn w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors">
                메시지 삭제
            </button>
            ` : ''}
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

        // Add click handlers
        const replyButton = menu.querySelector('.reply-message-btn');
        const editButton = menu.querySelector('.edit-message-btn');
        const deleteButton = menu.querySelector('.delete-message-btn');
        
        replyButton.addEventListener('click', () => {
            menu.remove();
            const messageDiv = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
            if (!messageDiv) return;
            
            const contentDiv = messageDiv.querySelector('.message-content');
            const content = contentDiv ? this.htmlToPlainText(contentDiv.innerHTML) : '[파일]';
            const isOwnMessage = messageDiv.classList.contains('ml-auto');
            
            this.setReplyingTo(messageId, content, isOwnMessage);
        });
        
        if (canEdit && editButton) {
            editButton.addEventListener('click', () => {
                menu.remove();
                // Get current content from DOM (최신 수정된 내용)
                const messageDiv = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
                if (!messageDiv) {
                    console.error('Message div not found for messageId:', messageId);
                    return;
                }
                const contentDiv = messageDiv.querySelector('.message-content');
                if (!contentDiv) {
                    // 파일만 있고 텍스트가 없는 경우 - 빈 내용으로 편집 모드 시작
                    this.showEditMode(messageId, '');
                    return;
                }
                // Convert <br> tags to newlines before editing
                const currentContent = this.htmlToPlainText(contentDiv.innerHTML);
                this.showEditMode(messageId, currentContent);
            });
        }

        if (canEdit && deleteButton) {
            deleteButton.addEventListener('click', () => {
                menu.remove();
                this.confirmDelete(messageId);
            });
        }

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

    confirmDelete(messageId) {
        // Directly delete without confirmation
        if (this.onDelete) {
            this.onDelete(messageId);
        }
    }

    showEditMode(messageId, currentContent) {
        const messageDiv = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageDiv) return;

        let contentDiv = messageDiv.querySelector('.message-content');
        
        // If no content div exists (file-only message), create one
        if (!contentDiv) {
            const headerDiv = messageDiv.querySelector('.flex.items-start.justify-between');
            contentDiv = document.createElement('div');
            contentDiv.className = 'text-sm break-words leading-relaxed message-content';
            headerDiv.insertAdjacentElement('afterend', contentDiv);
        }
        
        const originalContent = currentContent;

        // Create edit input
        contentDiv.innerHTML = `
            <div class="flex flex-col gap-2">
                <textarea class="edit-input bg-gray-800 text-gray-100 border border-gray-600 rounded px-2 py-1 text-sm w-full resize-none"
                          rows="2"
                          maxlength="5000">${this.sanitizeInput(originalContent)}</textarea>
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
            if (originalContent) {
                contentDiv.innerHTML = this.sanitizeInput(originalContent);
            } else {
                // If there was no original content, remove the content div
                contentDiv.remove();
            }
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

        let contentDiv = messageDiv.querySelector('.message-content');
        
        // If no content div exists (file-only message), create one
        if (!contentDiv) {
            const headerDiv = messageDiv.querySelector('.flex.items-start.justify-between');
            contentDiv = document.createElement('div');
            contentDiv.className = 'text-sm break-words leading-relaxed message-content';
            headerDiv.insertAdjacentElement('afterend', contentDiv);
        }
        
        // Use formatMessageContent to preserve line breaks and format URLs
        contentDiv.innerHTML = this.formatMessageContent(newContent);

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

    removeMessage(messageId) {
        const messageDiv = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
        if (messageDiv) {
            messageDiv.remove();
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

    displayAnnouncement(content) {
        console.log('[UI] displayAnnouncement called with:', content);
        
        if (!this.announcementBanner || !this.announcementContent || !this.announcementTime) {
            console.error('[UI] Announcement elements not found');
            return;
        }
        
        // Set content
        this.announcementContent.textContent = content;
        this.announcementTime.textContent = new Date().toLocaleString('ko-KR');
        
        // Show banner
        this.announcementBanner.classList.remove('hidden');
        
        console.log('[UI] Announcement banner displayed');
    }
    
    hideAnnouncement() {
        if (this.announcementBanner) {
            this.announcementBanner.classList.add('hidden');
        }
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
        // Return raw value so we preserve intentional leading/trailing newlines.
        return this.messageInput.value;
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

    formatMessageContent(content) {
        if (!content) return '';
        
        // Sanitize first
        const sanitized = this.sanitizeInput(content);
        
        // URL 패턴 매칭 (더 정확한 패턴)
        const urlPattern = /(https?:\/\/[^\s<]+[^\s<.,)])/g;
        
        // URL을 링크로 변환하고 프리뷰 생성
        const formatted = sanitized.replace(urlPattern, (url) => {
            // Validate URL to prevent XSS
            if (!this.isValidUrl(url)) {
                return this.sanitizeInput(url);
            }
            
            const safeUrl = this.sanitizeUrl(url);
            
            // URL이 이미지인지 확인
            const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;
            if (imageExtensions.test(url)) {
                const imgId = 'img_' + Math.random().toString(36).substring(2, 9);
                // Use DOM API instead of inline handlers
                setTimeout(() => {
                    const img = document.getElementById(imgId);
                    if (img) {
                        img.addEventListener('error', function() {
                            this.style.display = 'none';
                        });
                    }
                }, 0);
                
                return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline block">${this.sanitizeInput(url)}</a>
                    <img id="${imgId}" src="${safeUrl}" alt="Image preview" class="mt-2 max-w-full max-h-64 rounded-lg border border-gray-600 object-contain" loading="lazy">`;
            }
            
            // 일반 링크
            return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline break-all">${this.sanitizeInput(url)}</a>`;
        });
        
        // 줄바꿈 처리
        return formatted.replace(/\n/g, '<br>');
    }

    formatFileContent(file) {
        if (!file || !file.url) return '';
        
        // Validate file URL
        if (!this.isValidUrl(file.url)) {
            return '<div class="text-red-400 text-sm">Invalid file URL</div>';
        }

        const fileType = file.filetype || '';
        const fileName = this.sanitizeInput(file.filename || 'file');
        const fileSize = this.formatFileSize(file.filesize || 0);
        const safeUrl = this.sanitizeUrl(file.url);

        // 이미지 파일
        if (fileType.startsWith('image/')) {
            const imgId = 'file_img_' + Math.random().toString(36).substring(2, 9);
            // Use DOM API instead of inline handlers
            setTimeout(() => {
                const img = document.getElementById(imgId);
                if (img) {
                    img.addEventListener('error', function() {
                        this.style.display = 'none';
                    });
                }
            }, 0);
            
            return `
                <div class="mt-2">
                    <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">
                        <img id="${imgId}" src="${safeUrl}" alt="${fileName}" 
                             class="max-w-full max-h-96 rounded-lg border border-gray-600 object-contain cursor-pointer hover:opacity-90 transition-opacity" 
                             loading="lazy">
                    </a>
                    <div class="mt-1 text-xs text-gray-400">
                        <span>${fileName}</span> · <span>${fileSize}</span>
                    </div>
                </div>
            `;
        }

        // 비디오 파일
        if (fileType.startsWith('video/')) {
            return `
                <div class="mt-2">
                    <video controls class="max-w-full max-h-96 rounded-lg border border-gray-600">
                        <source src="${safeUrl}" type="${this.sanitizeInput(fileType)}">
                        Your browser does not support the video tag.
                    </video>
                    <div class="mt-1 text-xs text-gray-400">
                        <span>${fileName}</span> · <span>${fileSize}</span>
                    </div>
                </div>
            `;
        }

        // 오디오 파일
        if (fileType.startsWith('audio/')) {
            return `
                <div class="mt-2">
                    <audio controls class="w-full max-w-md">
                        <source src="${safeUrl}" type="${this.sanitizeInput(fileType)}">
                        Your browser does not support the audio tag.
                    </audio>
                    <div class="mt-1 text-xs text-gray-400">
                        <span>${fileName}</span> · <span>${fileSize}</span>
                    </div>
                </div>
            `;
        }

        // 기타 파일 (다운로드 링크)
        return `
            <div class="mt-2">
                <a href="${safeUrl}" download="${fileName}" 
                   class="inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clip-rule="evenodd" />
                    </svg>
                    <div class="text-left">
                        <div class="text-sm font-medium">${fileName}</div>
                        <div class="text-xs text-gray-400">${fileSize}</div>
                    </div>
                </a>
            </div>
        `;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    htmlToPlainText(html) {
        // Convert HTML to plain text while preserving line breaks
        // Replace <br> and <br/> tags with newlines
        let text = html.replace(/<br\s*\/?>/gi, '\n');
        // Create a temporary div to decode HTML entities and strip other tags
        const div = document.createElement('div');
        div.innerHTML = text;
        return div.textContent || div.innerText || '';
    }
    
    setReplyingTo(messageId, content, isOwnMessage) {
        this.replyingTo = { messageId, content, isOwnMessage };
        this.showReplyPreview();
        this.messageInput.focus();
    }
    
    showReplyPreview() {
        // 기존 답장 프리뷰 제거
        const existingPreview = document.getElementById('reply-preview');
        if (existingPreview) {
            existingPreview.remove();
        }
        
        if (!this.replyingTo) return;
        
        const preview = document.createElement('div');
        preview.id = 'reply-preview';
        preview.className = 'bg-gray-700/50 border-l-4 border-blue-500 p-2 mb-2 text-sm flex items-start justify-between gap-2';
        
        const truncatedContent = this.replyingTo.content.length > 50 
            ? this.replyingTo.content.substring(0, 50) + '...' 
            : this.replyingTo.content;
        
        preview.innerHTML = `
            <div class="flex-1">
                <div class="text-xs text-blue-400 mb-1">${this.replyingTo.isOwnMessage ? '내 메시지' : '익명'}에게 답장</div>
                <div class="text-gray-300">${this.sanitizeInput(truncatedContent)}</div>
            </div>
            <button class="cancel-reply-btn text-gray-400 hover:text-white">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        `;
        
        const cancelBtn = preview.querySelector('.cancel-reply-btn');
        cancelBtn.addEventListener('click', () => {
            this.cancelReply();
        });
        
        // 메시지 입력 폼 앞에 삽입
        this.messageForm.parentElement.insertBefore(preview, this.messageForm);
    }
    
    cancelReply() {
        this.replyingTo = null;
        const preview = document.getElementById('reply-preview');
        if (preview) {
            preview.remove();
        }
    }
    
    getReplyingTo() {
        return this.replyingTo;
    }
}
