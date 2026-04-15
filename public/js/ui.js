// UI Manager - handles all DOM interactions
import { renderCodeBlock, isLikelyCode, CODE_BLOCK_PREFIX, INLINE_CODE_PREFIX, PLACEHOLDER_SUFFIX } from './code-highlight.js';
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
        this.nicknameInput = document.getElementById('nickname-input');
        this.nicknameLockBtn = document.getElementById('nickname-lock-btn');
        this.lockIcon = document.getElementById('lock-icon');
        this.unlockIcon = document.getElementById('unlock-icon');
        
        // Notice Modal elements
        this.noticeModal = document.getElementById('notice-modal');
        this.noticeAcceptBtn = document.getElementById('notice-accept-btn');
        this.noticeDontShowAgain = document.getElementById('notice-dont-show-again');

        // 답장 상태
        this.replyingTo = null; // { messageId, content, isOwnMessage, isSecret }

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
            // If it doesn't have a protocol, add a temporary one for validation
            const urlWithProtocol = url.match(/^https?:\/\//) ? url : 'https://' + url;
            const parsed = new URL(urlWithProtocol);

            // Basic validation for protocol-less URLs: must have a dot and something after it
            if (!url.match(/^https?:\/\//)) {
                const domain = parsed.hostname;
                if (!domain || !domain.includes('.') || domain.split('.').pop().length < 2) {
                    return false;
                }
            }

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

        // Ensure it has a protocol for the href attribute
        let safeUrl = url.match(/^https?:\/\//) ? url : 'https://' + url;

        // Encode special characters
        return safeUrl.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
                            // Only auto-scroll if we're already near the bottom
                            const container = this.messagesContainer;
                            const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
                            if (isAtBottom) {
                                this.scrollToBottom();
                            } else {
                                // If we don't scroll, we should make sure the scroll button is visible
                                this.scrollButton.classList.remove('opacity-0', 'pointer-events-none');
                                this.scrollButton.classList.add('opacity-100', 'pointer-events-auto');
                            }
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

        if (this.nicknameInput && callbacks.onSetNickname) {
            this.nicknameInput.addEventListener('change', (e) => {
                callbacks.onSetNickname(e.target.value);
            });
        }

        if (this.nicknameLockBtn && callbacks.onToggleNicknameLock) {
            this.nicknameLockBtn.addEventListener('click', () => {
                callbacks.onToggleNicknameLock();
            });
        }
        
        if (this.noticeAcceptBtn && callbacks.onAcceptNotice) {
            this.noticeAcceptBtn.addEventListener('click', () => {
                const dontShowAgain = this.noticeDontShowAgain ? this.noticeDontShowAgain.checked : false;
                callbacks.onAcceptNotice(dontShowAgain);
                this.hideNoticeModal();
            });
        }

        // Store callbacks
        this.onDelete = callbacks.onDelete;
        this.onRevealSecret = callbacks.onRevealSecret;
    }

    updateNicknameDisplay(name) {
        if (this.nicknameInput) {
            this.nicknameInput.value = name && name !== '익명' ? name : '';
        }
    }

    setNicknameLockState(isLocked) {
        if (!this.nicknameInput || !this.nicknameLockBtn) return;
        
        if (isLocked) {
            this.nicknameInput.readOnly = true;
            this.nicknameInput.classList.add('opacity-80', 'cursor-not-allowed');
            this.nicknameLockBtn.classList.remove('hidden');
            this.nicknameLockBtn.title = '닉네임 변경 보호됨';
            this.nicknameLockBtn.setAttribute('aria-label', '닉네임 잠금 해제');
        } else {
            this.nicknameInput.readOnly = false;
            this.nicknameInput.classList.remove('opacity-80', 'cursor-not-allowed');
            this.nicknameLockBtn.classList.add('hidden');
            this.nicknameLockBtn.title = '닉네임 변경 가능';
            this.nicknameLockBtn.setAttribute('aria-label', '닉네임 변경 가능');
            this.nicknameInput.focus();
        }
    }
    
    showNoticeModal() {
        if (this.noticeModal) {
            this.noticeModal.classList.remove('hidden');
        }
    }
    
    hideNoticeModal() {
        if (this.noticeModal) {
            this.noticeModal.classList.add('hidden');
        }
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
        messageDiv.setAttribute('data-session-id', data.sessionId);
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
            // 비밀 메시지인 경우 읽기 버튼 추가
            if (data.replyTo && data.replyTo.isSecret && data.replyTo.secretId) {
                // 받는 사람(targetSessionId)과 현재 사용자(sessionId)가 일치하는 경우에만 읽기 가능
                const isRecipient = data.replyTo.targetSessionId === sessionId;
                if (isRecipient) {
                    contentHtml += `
                        <div class="secret-message-container bg-gray-800/60 border border-gray-600/50 rounded-lg p-3 mt-2">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="text-gray-300 text-sm">비밀 메시지</span>
                            </div>
                            <button class="reveal-secret-btn w-full bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded transition-colors text-sm font-medium"
                                    data-secret-id="${this.sanitizeInput(data.replyTo.secretId)}">
                                비밀 메시지 읽기 (한 번만 볼 수 있음)
                            </button>
                            <div class="secret-message-content hidden mt-3 p-3 bg-gray-800/50 rounded text-sm break-words"></div>
                        </div>
                    `;
                } else if (isOwnMessage) {
                    contentHtml += `<div class="text-sm text-gray-400 italic">비밀 메시지를 보냈습니다</div>`;
                } else {
                    contentHtml += `<div class="text-sm text-gray-500 italic">비밀 메시지 (답장)</div>`;
                }
            } else {
                contentHtml += `<div class="text-sm break-words leading-relaxed message-content">${this.formatMessageContent(data.content)}</div>`;
            }
        }

        // Add file if exists
        if (data.file && data.file.url) {
            contentHtml += this.formatFileContent(data.file);
        }

        // If neither content nor file exists, show a placeholder
        if (!contentHtml) {
            contentHtml = '<div class="text-sm text-gray-500 italic">내용 없음</div>';
        }

        const senderName = data.nickname || '익명';
        // Name/label section: show 관리자 for admin messages
        // 관리자 메시지는 아이콘 없이 텍스트로만 강조
        const nameLabel = isAdmin
            ? `<span class="text-xs font-semibold text-yellow-300">관리자</span>`
            : `<span class="text-xs font-medium ${isOwnMessage ? 'text-blue-300' : 'text-gray-400'}">${isOwnMessage ? `나 (${this.sanitizeInput(senderName)})` : this.sanitizeInput(senderName)}</span>`;

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

        // 비밀 메시지 읽기 버튼 이벤트 리스너 추가
        const revealBtn = messageDiv.querySelector('.reveal-secret-btn');
        if (revealBtn && this.onRevealSecret) {
            revealBtn.addEventListener('click', async () => {
                const secretId = revealBtn.dataset.secretId;
                const container = revealBtn.closest('.secret-message-container');
                if (container) {
                    await this.onRevealSecret(secretId, container);
                }
            });
        }
    }

    /**
     * Display multiple messages at once using DocumentFragment for better performance
     * @param {Array} messages - Array of message objects
     * @param {string} sessionId - Current user's session ID
     */
    displayBatchMessages(messages, sessionId) {
        if (!messages || messages.length === 0) return;

        console.log(`[UI] Rendering ${messages.length} messages in batch`);

        // Create a DocumentFragment to batch DOM operations
        const fragment = document.createDocumentFragment();

        // Temporarily disconnect the MutationObserver to prevent it from firing multiple times
        const tempContainer = document.createElement('div');

        for (const data of messages) {
            // Skip duplicates
            if (data.messageId && this.messagesContainer.querySelector(`[data-message-id="${data.messageId}"]`)) {
                continue;
            }

            const isOwnMessage = data.sessionId === sessionId;
            const isAdmin = !!(data.sessionId && String(data.sessionId).startsWith('admin_'));

            const messageDiv = document.createElement('div');

            if (isAdmin) {
                messageDiv.className = 'message-enter p-3 rounded-lg border-l-4 border-yellow-400 bg-yellow-900/20 shadow-lg ring-1 ring-yellow-400/20';
                messageDiv.style.marginLeft = '0';
                messageDiv.style.marginRight = 'auto';
                messageDiv.setAttribute('role', 'region');
                messageDiv.setAttribute('aria-live', 'polite');
                messageDiv.setAttribute('aria-label', '관리자 메시지');
            } else {
                messageDiv.className = 'message-enter p-2.5 rounded-lg ' +
                    (data.sessionId === sessionId ? 'bg-blue-900/80 ml-auto' : 'bg-gray-700/80');
            }
            messageDiv.style.maxWidth = '75%';

            messageDiv.setAttribute('data-message', 'true');
            messageDiv.setAttribute('data-message-id', data.messageId);
            messageDiv.setAttribute('data-session-id', data.sessionId);
            messageDiv.setAttribute('data-timestamp', data.timestamp);

            const timestamp = new Date(data.timestamp).toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit'
            });

            const canEdit = isOwnMessage && data.timestamp && (Date.now() - data.timestamp < 10 * 60 * 1000);
            const editedLabel = data.editedAt ? ' <span class="text-xs text-gray-500">(수정됨)</span>' : '';

            let contentHtml = '';

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

            if (data.content && data.content.trim()) {
                if (data.replyTo && data.replyTo.isSecret && data.replyTo.secretId) {
                    const isRecipient = data.replyTo.targetSessionId === sessionId;
                    if (isRecipient) {
                        contentHtml += `
                            <div class="secret-message-container bg-gray-800/60 border border-gray-600/50 rounded-lg p-3 mt-2">
                                <div class="flex items-center gap-2 mb-2">
                                    <span class="text-gray-300 text-sm">비밀 메시지</span>
                                </div>
                                <button class="reveal-secret-btn w-full bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded transition-colors text-sm font-medium"
                                        data-secret-id="${this.sanitizeInput(data.replyTo.secretId)}">
                                    비밀 메시지 읽기 (한 번만 볼 수 있음)
                                </button>
                                <div class="secret-message-content hidden mt-3 p-3 bg-gray-800/50 rounded text-sm break-words"></div>
                            </div>
                        `;
                    } else if (isOwnMessage) {
                        contentHtml += `<div class="text-sm text-gray-400 italic">비밀 메시지를 보냈습니다</div>`;
                    } else {
                        contentHtml += `<div class="text-sm text-gray-500 italic">비밀 메시지 (답장)</div>`;
                    }
                } else {
                    contentHtml += `<div class="text-sm break-words leading-relaxed message-content">${this.formatMessageContent(data.content)}</div>`;
                }
            }

            if (data.file && data.file.url) {
                contentHtml += this.formatFileContent(data.file);
            }

            if (!contentHtml) {
                contentHtml = '<div class="text-sm text-gray-500 italic">내용 없음</div>';
            }

            const senderName = data.nickname || '익명';
            const nameLabel = isAdmin
                ? `<span class="text-xs font-semibold text-yellow-300">관리자</span>`
                : `<span class="text-xs font-medium ${isOwnMessage ? 'text-blue-300' : 'text-gray-400'}">${isOwnMessage ? `나 (${this.sanitizeInput(senderName)})` : this.sanitizeInput(senderName)}</span>`;

            messageDiv.innerHTML = `
                <div class="flex items-start justify-between gap-2 mb-1">
                    <div class="flex items-center gap-2">${nameLabel}${editedLabel}</div>
                    <span class="text-xs text-gray-500">${timestamp}</span>
                </div>
                ${contentHtml}
            `;

            this.addMessageInteractions(messageDiv, data.messageId, canEdit);
            fragment.appendChild(messageDiv);
        }

        // Add all messages to DOM at once
        this.messagesContainer.appendChild(fragment);

        // Scroll to bottom after batch insert if user was near the bottom
        const container = this.messagesContainer;
        const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
        if (isAtBottom) {
            this.scrollToBottom();
        } else {
            // Update scroll button visibility if we do not auto-scroll
            this.scrollButton.classList.remove('opacity-0', 'pointer-events-none');
            this.scrollButton.classList.add('opacity-100', 'pointer-events-auto');
        }

        console.log(`[UI] Batch rendering complete`);

        // Re-attach event listeners for secret message buttons
        const revealBtns = this.messagesContainer.querySelectorAll('.reveal-secret-btn');
        revealBtns.forEach(btn => {
            // Remove existing listeners to prevent duplicates
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            if (this.onRevealSecret) {
                newBtn.addEventListener('click', async () => {
                    const secretId = newBtn.dataset.secretId;
                    const container = newBtn.closest('.secret-message-container');
                    if (container) {
                        await this.onRevealSecret(secretId, container);
                    }
                });
            }
        });
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
        messageDiv.style.userSelect = 'text';
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
            <button class="copy-message-btn w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors">
                복사하기
            </button>
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
        const copyButton = menu.querySelector('.copy-message-btn');
        const replyButton = menu.querySelector('.reply-message-btn');
        const editButton = menu.querySelector('.edit-message-btn');
        const deleteButton = menu.querySelector('.delete-message-btn');

        copyButton.addEventListener('click', () => {
            menu.remove();
            const messageDiv = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
            if (!messageDiv) return;
            const contentDiv = messageDiv.querySelector('.message-content');
            const text = contentDiv ? this.htmlToPlainText(contentDiv.innerHTML) : '';
            if (text) {
                navigator.clipboard.writeText(text).catch(() => {
                    // fallback for older browsers
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                });
            }
        });

        replyButton.addEventListener('click', () => {
            menu.remove();
            const messageDiv = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
            if (!messageDiv) return;

            const contentDiv = messageDiv.querySelector('.message-content');
            const content = contentDiv ? this.htmlToPlainText(contentDiv.innerHTML) : '[파일]';
            const isOwnMessage = messageDiv.classList.contains('ml-auto');
            const targetSessionId = messageDiv.dataset.sessionId; // 원본 메시지 작성자의 sessionId

            this.setReplyingTo(messageId, content, isOwnMessage, targetSessionId);
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

    clearAllMessages() {
        // Remove all message elements
        const messages = this.messagesContainer.querySelectorAll('[data-message-id]');
        messages.forEach(msg => msg.remove());
    }

    displaySystemMessage(content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'text-center text-xs text-gray-500 py-1.5';
        messageDiv.textContent = content;

        // 시스템 메시지 표식 추가
        messageDiv.setAttribute('data-message', 'true');

        this.messagesContainer.appendChild(messageDiv);
    }

    displayAnnouncement(content, timestamp) {
        // 공지사항은 채팅에 표시하지 않습니다.
        // 사용자는 헤더의 공지사항 버튼(확성기 아이콘)을 통해 /announcements.html에서 확인할 수 있습니다.
        console.log('[UI] Announcement received (not displayed in chat):', content?.substring(0, 50));
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

    showTypingIndicator(show, nickname) {
        if (show) {
            this.typingIndicator.classList.remove('hidden');
            const displayName = nickname ? this.sanitizeInput(nickname) + '님이' : '';
            this.typingIndicator.innerHTML = `<span>●</span><span>●</span><span>●</span> ${displayName} 입력 중`;
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

    decodeHtml(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent;
    }

    sanitizeInput(input) {
        // Basic XSS prevention
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    formatMessageContent(content) {
        if (!content) return '';

        // 명시적 코드 블록(```)이 없으면 자동 코드 감지를 먼저 시도
        // (backtick 포함 코드가 인라인 코드로 오인되는 것을 방지)
        if (!/```/.test(content) && isLikelyCode(content)) {
            return renderCodeBlock(content, '', (text) => this.sanitizeInput(text));
        }

        // 코드 블록을 먼저 추출하여 보호 (sanitize 전)
        let processed = content;
        const codeBlocks = [];
        const inlineCodes = [];

        // ```lang\ncode\n``` 패턴 감지 (sanitize 전에 처리, \r\n도 지원)
        processed = processed.replace(/```(\w*)\r?\n([\s\S]*?)```/g, (match, lang, code) => {
            const placeholder = `${CODE_BLOCK_PREFIX}${codeBlocks.length}${PLACEHOLDER_SUFFIX}`;
            codeBlocks.push({ lang: lang.toLowerCase(), code });
            return placeholder;
        });

        // 인라인 코드 `code` 패턴 감지
        processed = processed.replace(/`([^`\n]+)`/g, (match, code) => {
            const placeholder = `${INLINE_CODE_PREFIX}${inlineCodes.length}${PLACEHOLDER_SUFFIX}`;
            inlineCodes.push(code);
            return placeholder;
        });

        // 나머지 텍스트를 sanitize
        const sanitized = this.sanitizeInput(processed);

        // URL 패턴 매칭 (프로토콜이 없어도 도메인 형태면 인식)
        const urlPattern = /(https?:\/\/[^\s<]+[^\s<.,)])|(\bwww\.[^\s<]+[^\s<.,)])|(\b[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}(?::[0-9]+)?(?:\/[^\s<]*[^\s<.,)])?)/gi;

        // URL을 링크로 변환하고 프리뷰 생성
        let formatted = sanitized.replace(urlPattern, (match) => {
            // 이미 sanitized된 문자열이므로 다시 디코딩하여 원본 URL 획듍
            const url = this.decodeHtml(match);

            // Validate URL to prevent XSS
            if (!this.isValidUrl(url)) {
                return match; // 이미 sanitized된 원본 매치 유지
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
                        img.addEventListener('error', function () {
                            this.style.display = 'none';
                        });
                    }
                }, 0);

                return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline block">${match}</a>
                <img id="${imgId}" src="${safeUrl}" alt="Image preview" class="mt-2 max-w-full max-h-64 rounded-lg border border-gray-600 object-contain" loading="lazy">`;
            }

            // 일반 링크 (보안 헤더 분석 버튼 포함)
            if (/^https?:\/\//i.test(url)) {
                const secBtnId = 'secbtn_' + Math.random().toString(36).substring(2, 9);
                const isFirstSecHint = !sessionStorage.getItem('secHintShown');
                // Use DOM API instead of inline handlers
                setTimeout(() => {
                    const btnEl = document.getElementById(secBtnId);
                    if (btnEl) {
                        btnEl.addEventListener('click', function (e) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (window.chatClient && window.chatClient.securityHeaders) {
                                const urlData = this.getAttribute('data-sec-url');
                                window.chatClient.securityHeaders.analyze(urlData);
                            }
                        });
                        btnEl.title = '보안 헤더 분석';
                        if (isFirstSecHint) {
                            sessionStorage.setItem('secHintShown', '1');
                            const hint = document.createElement('span');
                            hint.className = 'sec-hint ml-1 text-[10px] text-emerald-400/80 whitespace-nowrap';
                            hint.textContent = '← 보안헤더를 확인해주세요';
                            btnEl.parentElement.appendChild(hint);
                        }
                    }
                }, 0);
                return `<span class="inline-flex items-center gap-1"><a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline break-all">${match}</a><button id="${secBtnId}" data-sec-url="${safeUrl}" class="inline-flex items-center justify-center w-4 h-4 text-gray-500 hover:text-emerald-400 transition-colors flex-shrink-0" aria-label="보안 헤더 분석"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-2.332 9-7.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg></button></span>`;
            }

            return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline break-all">${match}</a>`;
        });

        // 코드 블록 placeholder를 하이라이트된 코드로 교체
        for (let i = 0; i < codeBlocks.length; i++) {
            const { lang, code } = codeBlocks[i];
            formatted = formatted.replace(`${CODE_BLOCK_PREFIX}${i}${PLACEHOLDER_SUFFIX}`, renderCodeBlock(code, lang, (text) => this.sanitizeInput(text)));
        }

        // 인라인 코드 placeholder를 교체
        for (let i = 0; i < inlineCodes.length; i++) {
            const code = inlineCodes[i];
            const safeCode = this.sanitizeInput(code);
            formatted = formatted.replace(`${INLINE_CODE_PREFIX}${i}${PLACEHOLDER_SUFFIX}`, `<code class="inline-code">${safeCode}</code>`);
        }

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
            setTimeout(() => {
                const img = document.getElementById(imgId);
                if (img) {
                    img.addEventListener('error', function () {
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

    setReplyingTo(messageId, content, isOwnMessage, targetSessionId) {
        this.replyingTo = { messageId, content, isOwnMessage, targetSessionId, isSecret: false };
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
        preview.className = 'bg-gray-700/50 border-l-4 border-blue-500 p-2 mb-2 text-sm flex flex-col gap-2';

        const truncatedContent = this.replyingTo.content.length > 50
            ? this.replyingTo.content.substring(0, 50) + '...'
            : this.replyingTo.content;

        preview.innerHTML = `
            <div class="flex items-start justify-between gap-2">
                <div class="flex-1">
                    <div class="text-xs text-blue-400 mb-1">${this.replyingTo.isOwnMessage ? '내 메시지' : '익명'}에게 답장</div>
                    <div class="text-gray-300">${this.sanitizeInput(truncatedContent)}</div>
                </div>
                <button class="cancel-reply-btn text-gray-400 hover:text-white flex-shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            <label class="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-gray-200 transition-colors">
                <input type="checkbox" id="secret-reply-checkbox" class="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0">
                <span>비밀 메시지로 보내기 (받는 사람만 한 번 볼 수 있음)</span>
            </label>
        `;

        const cancelBtn = preview.querySelector('.cancel-reply-btn');
        cancelBtn.addEventListener('click', () => {
            this.cancelReply();
        });

        const secretCheckbox = preview.querySelector('#secret-reply-checkbox');
        secretCheckbox.addEventListener('change', (e) => {
            this.replyingTo.isSecret = e.target.checked;
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
