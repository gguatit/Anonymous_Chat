// UI Manager - handles all DOM interactions
import { renderCodeBlock, isLikelyCode, CODE_BLOCK_PREFIX, INLINE_CODE_PREFIX, PLACEHOLDER_SUFFIX } from './code-highlight.js';
import { escapeHtml, isValidUrl as _isValidUrl, sanitizeUrl as _sanitizeUrl, formatFileSize as _formatFileSize } from './utils.js';
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
        this.onReaction = null;

        // Announcement banner elements
        this.announcementBanner = document.getElementById('announcement-banner');
        this.announcementContent = document.getElementById('announcement-content');
        this.announcementTime = document.getElementById('announcement-time');
        this.announcementClose = document.getElementById('announcement-close');

        // Channel UI elements
        this.channelBadge = document.getElementById('channel-badge');
        this.channelNumberEl = document.getElementById('channel-number');
        this.channelNameEl = document.getElementById('channel-name');
        this.backToMainBtn = document.getElementById('back-to-main-btn');

        // Channel modals
        this.createChannelModal = document.getElementById('create-channel-modal');
        this.createChannelInput = document.getElementById('create-channel-input');
        this.createChannelError = document.getElementById('create-channel-error');
        this.createChannelConfirm = document.getElementById('create-channel-confirm');
        this.createChannelCancel = document.getElementById('create-channel-cancel');

        this.joinChannelModal = document.getElementById('join-channel-modal');
        this.joinChannelInput = document.getElementById('join-channel-input');
        this.joinChannelError = document.getElementById('join-channel-error');
        this.joinChannelConfirm = document.getElementById('join-channel-confirm');
        this.joinChannelCancel = document.getElementById('join-channel-cancel');

        // Setup announcement close button
        if (this.announcementClose) {
            this.announcementClose.addEventListener('click', () => {
                this.hideAnnouncement();
            });
        }

        // MutationObserver로 메시지 추가 감지하여 자동 스크롤
        this.initAutoScroll();
        
        // Gallery image click delegation
        this.messagesContainer.addEventListener('click', (e) => {
            const galleryImage = e.target.closest('.gallery-image');
            if (galleryImage) {
                try {
                    const images = JSON.parse(decodeURIComponent(atob(galleryImage.dataset.galleryData)));
                    const index = parseInt(galleryImage.dataset.galleryIndex);
                    this.openLightbox(images, index);
                } catch (err) {
                    console.error('[Gallery] Failed to open lightbox:', err);
                }
            }
        });

        // Empty space right-click for channel menu
        this.messagesContainer.addEventListener('contextmenu', (e) => {
            if (!e.target.closest('[data-message]')) {
                e.preventDefault();
                this.showChannelContextMenu(e);
            }
        });
    }

    isValidUrl(url) {
        return _isValidUrl(url);
    }

    sanitizeUrl(url) {
        return _sanitizeUrl(url);
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

        // Channel modal events
        this._channelProcessing = false;

        if (this.createChannelConfirm && callbacks.onCreateChannel) {
            this.createChannelConfirm.addEventListener('click', () => {
                if (this._channelProcessing) return;
                const name = this.createChannelInput.value.trim();
                callbacks.onCreateChannel(name);
            });
        }
        if (this.createChannelCancel) {
            this.createChannelCancel.addEventListener('click', () => this.hideCreateChannelModal());
        }
        if (this.createChannelInput) {
            this.createChannelInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!this._channelProcessing) this.createChannelConfirm.click();
                }
                if (e.key === 'Escape') this.hideCreateChannelModal();
            });
        }

        if (this.joinChannelConfirm && callbacks.onJoinChannel) {
            this.joinChannelConfirm.addEventListener('click', () => {
                if (this._channelProcessing) return;
                const raw = this.joinChannelInput.value.trim();
                callbacks.onJoinChannel(raw);
            });
        }
        if (this.joinChannelCancel) {
            this.joinChannelCancel.addEventListener('click', () => this.hideJoinChannelModal());
        }
        if (this.joinChannelInput) {
            this.joinChannelInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!this._channelProcessing) this.joinChannelConfirm.click();
                }
                if (e.key === 'Escape') this.hideJoinChannelModal();
            });
        }

        if (this.backToMainBtn && callbacks.onBackToMain) {
            this.backToMainBtn.addEventListener('click', () => callbacks.onBackToMain());
        }

        // Close modals on backdrop click
        if (this.createChannelModal) {
            this.createChannelModal.addEventListener('click', (e) => {
                if (e.target === this.createChannelModal) this.hideCreateChannelModal();
            });
        }
        if (this.joinChannelModal) {
            this.joinChannelModal.addEventListener('click', (e) => {
                if (e.target === this.joinChannelModal) this.hideJoinChannelModal();
            });
        }

        // Store callbacks
        this.onDelete = callbacks.onDelete;
        this.onRevealSecret = callbacks.onRevealSecret;
        this.onReaction = callbacks.onReaction;
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
        if (data.messageId && this.messagesContainer.querySelector(`[data-message-id="${data.messageId}"]`)) {
            return;
        }

        const messageDiv = this._renderSingleMessage(data, sessionId);
        this.messagesContainer.appendChild(messageDiv);

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

    displayBatchMessages(messages, sessionId) {
        if (!messages || messages.length === 0) return;

        console.log(`[UI] Rendering ${messages.length} messages in batch`);

        const fragment = document.createDocumentFragment();

        for (const data of messages) {
            if (data.messageId && this.messagesContainer.querySelector(`[data-message-id="${data.messageId}"]`)) {
                continue;
            }

            const messageDiv = this._renderSingleMessage(data, sessionId);
            fragment.appendChild(messageDiv);
        }

        this.messagesContainer.appendChild(fragment);

        const container = this.messagesContainer;
        const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
        if (isAtBottom) {
            this.scrollToBottom();
        } else {
            this.scrollButton.classList.remove('opacity-0', 'pointer-events-none');
            this.scrollButton.classList.add('opacity-100', 'pointer-events-auto');
        }

        console.log(`[UI] Batch rendering complete`);

        const revealBtns = this.messagesContainer.querySelectorAll('.reveal-secret-btn');
        revealBtns.forEach(btn => {
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

    _renderSingleMessage(data, sessionId) {
        if (data.type === 'summary') {
            const wrapper = document.createElement('div');
            wrapper.className = 'bg-indigo-900/40 border border-indigo-700/50 rounded-lg p-3 mx-2 my-3';
            wrapper.setAttribute('data-message', 'true');
            wrapper.setAttribute('data-message-id', data.messageId);

            const title = document.createElement('div');
            title.className = 'text-xs font-semibold text-indigo-300 mb-2';
            title.textContent = 'AI \uB300\uD654 \uC694\uC57D';

            const content = document.createElement('div');
            content.className = 'text-sm text-gray-200 leading-relaxed';
            content.textContent = data.content;

            wrapper.appendChild(title);
            wrapper.appendChild(content);
            return wrapper;
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
                <div class="reply-reference cursor-pointer hover:bg-gray-700/50 transition-colors bg-gray-800/50 border-l-2 border-gray-500 pl-2 py-1 mb-2 text-xs"
                     data-reply-to-id="${this.sanitizeInput(data.replyTo.messageId || '')}">
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

        if (data.files && Array.isArray(data.files) && data.files.length > 0) {
            contentHtml += this.formatFileGallery(data.files);
        } else if (data.file && data.file.url) {
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

        if (data.reactions && Object.keys(data.reactions).length > 0) {
            const reactionBar = document.createElement('div');
            reactionBar.className = 'reaction-bar flex flex-wrap gap-1 mt-2';
            for (const [emoji, count] of Object.entries(data.reactions)) {
                if (count > 0) {
                    const userReacted = data.reactionSessions &&
                        data.reactionSessions[emoji] &&
                        data.reactionSessions[emoji].includes(sessionId);
                    const pill = document.createElement('button');
                    pill.className = 'reaction-pill inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ' +
                        (userReacted
                            ? 'bg-blue-600 text-white ring-1 ring-blue-400'
                            : 'bg-gray-600 text-gray-200 hover:bg-gray-500');
                    pill.setAttribute('data-emoji', emoji);
                    pill.setAttribute('data-message-id', data.messageId);
                    pill.innerHTML = `${emoji} ${count}`;
                    pill.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (this.onReaction) {
                            const hasReacted = pill.classList.contains('bg-blue-600');
                            this.onReaction(data.messageId, emoji, hasReacted);
                        }
                    });
                    reactionBar.appendChild(pill);
                }
            }
            messageDiv.appendChild(reactionBar);
        }

        this.addMessageInteractions(messageDiv, data.messageId, canEdit, data.replyTo?.messageId);

        return messageDiv;
    }

    addMessageInteractions(messageDiv, messageId, canEdit, replyToMessageId) {
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

        // Double-click for quick 👍 reaction
        messageDiv.addEventListener('dblclick', (e) => {
            const interactive = e.target.closest('a, button, input, textarea, [role="button"], .reaction-pill');
            if (interactive) return;
            if (!this.onReaction) return;
            const bar = messageDiv.querySelector('.reaction-bar');
            const existingPill = bar && bar.querySelector('[data-emoji="👍"]');
            const hasReacted = existingPill && existingPill.classList.contains('bg-blue-600');
            this.onReaction(messageId, '👍', hasReacted);
        });

        // Add visual feedback
        messageDiv.style.cursor = 'pointer';
        messageDiv.style.userSelect = 'text';

        // Click on message to jump to replied message
        if (replyToMessageId) {
            messageDiv.addEventListener('click', (e) => {
                // Don't trigger if clicking on interactive elements
                const interactive = e.target.closest('a, button, input, textarea, [role="button"], .secret-message-container');
                if (!interactive) {
                    this.highlightMessage(replyToMessageId);
                }
            });
        }
    }

    highlightMessage(messageId) {
        const targetDiv = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
        if (!targetDiv) {
            alert('해당 메시지를 찾을 수 없습니다. (오래된 메시지일 수 있습니다)');
            return;
        }

        targetDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetDiv.classList.add('ring-2', 'ring-yellow-400', 'transition-all');

        setTimeout(() => {
            targetDiv.classList.remove('ring-2', 'ring-yellow-400', 'transition-all');
        }, 2000);
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
            <button class="react-message-btn w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors">
                반응 추가
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
        const reactButton = menu.querySelector('.react-message-btn');

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

        reactButton.addEventListener('click', () => {
            menu.remove();
            const messageDiv = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
            if (!messageDiv) return;
            this.showReactionPicker(messageDiv, messageId);
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

    confirmDelete(messageId) {
        // Directly delete without confirmation
        if (this.onDelete) {
            this.onDelete(messageId);
        }
    }

    showReactionPicker(messageDiv, messageId) {
        this.removeReactionPicker();

        const picker = document.createElement('div');
        picker.id = 'reaction-picker';
        picker.className = 'fixed bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-1 px-2 z-50 flex gap-1';

        const emojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];
        picker.innerHTML = emojis.map(emoji => {
            const existingBar = messageDiv.querySelector('.reaction-bar');
            const existingPill = existingBar && existingBar.querySelector(`[data-emoji="${emoji}"]`);
            const hasReacted = existingPill && existingPill.classList.contains('bg-blue-600');
            return `<button class="reaction-option text-lg px-1.5 py-0.5 rounded hover:bg-gray-600 transition-colors ${hasReacted ? 'ring-1 ring-blue-400 bg-gray-600' : ''}" data-emoji="${emoji}">${emoji}</button>`;
        }).join('');

        const rect = messageDiv.getBoundingClientRect();
        picker.style.left = `${rect.left}px`;
        picker.style.top = `${rect.top - 40}px`;

        picker.addEventListener('click', (e) => {
            const btn = e.target.closest('.reaction-option');
            if (!btn) return;
            const emoji = btn.dataset.emoji;
            const existingBar = messageDiv.querySelector('.reaction-bar');
            const existingPill = existingBar && existingBar.querySelector(`[data-emoji="${emoji}"]`);
            const hasReacted = existingPill && existingPill.classList.contains('bg-blue-600');
            if (this.onReaction) {
                this.onReaction(messageId, emoji, hasReacted);
            }
            this.removeReactionPicker();
        });

        document.body.appendChild(picker);

        const closePicker = (e) => {
            if (!picker.contains(e.target)) {
                this.removeReactionPicker();
                document.removeEventListener('click', closePicker);
            }
        };
        setTimeout(() => document.addEventListener('click', closePicker), 100);
    }

    removeReactionPicker() {
        const picker = document.getElementById('reaction-picker');
        if (picker) picker.remove();
    }

    // ========== Channel Context Menu ==========
    showChannelContextMenu(event) {
        const existingMenu = document.getElementById('channel-context-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'channel-context-menu';
        menu.className = 'fixed bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-1 z-50';
        menu.style.minWidth = '140px';

        menu.innerHTML = `
            <button class="create-channel-btn w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors">
                채널 추가
            </button>
            <button class="join-channel-btn w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors">
                채널 참가
            </button>
        `;

        const x = event.touches ? event.touches[0].clientX : event.clientX;
        const y = event.touches ? event.touches[0].clientY : event.clientY;

        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        document.body.appendChild(menu);

        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${window.innerWidth - rect.width - 10}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${y - rect.height}px`;
        }

        const createBtn = menu.querySelector('.create-channel-btn');
        const joinBtn = menu.querySelector('.join-channel-btn');

        createBtn.addEventListener('click', () => {
            menu.remove();
            this.showCreateChannelModal();
        });

        joinBtn.addEventListener('click', () => {
            menu.remove();
            this.showJoinChannelModal();
        });

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

    // ========== Channel Modals ==========
    showCreateChannelModal() {
        if (this.createChannelModal) {
            this.hideJoinChannelModal();
            this.createChannelModal.classList.remove('hidden');
            this.createChannelInput.value = '';
            this.createChannelError.classList.add('hidden');
            setTimeout(() => this.createChannelInput.focus(), 50);
        }
    }

    hideCreateChannelModal() {
        if (this.createChannelModal) {
            this.createChannelModal.classList.add('hidden');
        }
    }

    showCreateChannelError(message) {
        if (this.createChannelError) {
            this.createChannelError.textContent = message;
            this.createChannelError.classList.remove('hidden');
        }
    }

    showJoinChannelModal() {
        if (this.joinChannelModal) {
            this.hideCreateChannelModal();
            this.joinChannelModal.classList.remove('hidden');
            this.joinChannelInput.value = '';
            this.joinChannelError.classList.add('hidden');
            setTimeout(() => this.joinChannelInput.focus(), 50);
        }
    }

    hideJoinChannelModal() {
        if (this.joinChannelModal) {
            this.joinChannelModal.classList.add('hidden');
        }
    }

    showJoinChannelError(message) {
        if (this.joinChannelError) {
            this.joinChannelError.textContent = message;
            this.joinChannelError.classList.remove('hidden');
        }
    }

    updateChannelIndicator(number, name) {
        if (this.channelBadge) {
            if (number && number !== '0' && number !== 0) {
                this.channelBadge.classList.remove('hidden');
                this.channelNumberEl.textContent = number;
                this.channelNameEl.textContent = name || '';
                if (this.backToMainBtn) this.backToMainBtn.classList.remove('hidden');
            } else {
                this.channelBadge.classList.add('hidden');
                if (this.backToMainBtn) this.backToMainBtn.classList.add('hidden');
            }
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

    updateMessage(messageId, newContent, _editedAt) {
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

    updateReaction(messageId, emoji, count, reactionSessions, currentSessionId) {
        const messageDiv = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageDiv) return;

        let bar = messageDiv.querySelector('.reaction-bar');
        if (count === 0) {
            const pill = bar && bar.querySelector(`[data-emoji="${emoji}"]`);
            if (pill) pill.remove();
            if (bar && bar.children.length === 0) bar.remove();
            return;
        }

        if (!bar) {
            bar = document.createElement('div');
            bar.className = 'reaction-bar flex flex-wrap gap-1 mt-2';
            messageDiv.appendChild(bar);
        }

        let pill = bar.querySelector(`[data-emoji="${emoji}"]`);
        let isNewPill = false;
        if (!pill) {
            isNewPill = true;
            pill = document.createElement('button');
            pill.className = 'reaction-pill inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-600 text-gray-200 hover:bg-gray-500';
            pill.setAttribute('data-emoji', emoji);
            pill.setAttribute('data-message-id', messageId);
            pill.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.onReaction) {
                    const hasReacted = pill.classList.contains('bg-blue-600');
                    this.onReaction(messageId, emoji, hasReacted);
                }
            });
            bar.appendChild(pill);
        }

        const userReacted = reactionSessions && reactionSessions.includes(currentSessionId);
        pill.className = userReacted
            ? 'reaction-pill inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-600 text-white ring-1 ring-blue-400'
            : 'reaction-pill inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-600 text-gray-200 hover:bg-gray-500';
        pill.innerHTML = `${emoji} ${count}`;

        if (isNewPill) {
            pill.classList.add('reaction-just-added');
            pill.addEventListener('animationend', () => pill.classList.remove('reaction-just-added'), { once: true });
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

    displaySummary(summaryText) {
        const wrapper = document.createElement('div');
        wrapper.className = 'bg-indigo-900/40 border border-indigo-700/50 rounded-lg p-3 mx-2 my-3';
        wrapper.setAttribute('data-message', 'true');

        const title = document.createElement('div');
        title.className = 'text-xs font-semibold text-indigo-300 mb-2';
        title.textContent = 'AI 대화 요약';

        const content = document.createElement('div');
        content.className = 'text-sm text-gray-200 leading-relaxed';
        content.textContent = summaryText;

        wrapper.appendChild(title);
        wrapper.appendChild(content);
        this.messagesContainer.appendChild(wrapper);
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

    updateTypingIndicator(typingUsers) {
        const count = typingUsers.size;
        if (count === 0) {
            this.typingIndicator.classList.add('hidden');
            return;
        }

        this.typingIndicator.classList.remove('hidden');
        const users = Array.from(typingUsers.values()).map(u => this.sanitizeInput(u.nickname || '익명'));

        let text;
        if (count === 1) {
            text = `${users[0]}님이 입력 중`;
        } else if (count === 2) {
            text = `${users[0]}, ${users[1]}님이 입력 중`;
        } else {
            text = `${users[0]} 외 ${count - 1}명이 입력 중`;
        }

        this.typingIndicator.innerHTML = `<span>●</span><span>●</span><span>●</span> ${text}`;
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
        return escapeHtml(input);
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
        const urlPlaceholders = [];
        const mdLinkPlaceholders = [];

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

        // URL 자동 변환을 먼저 실행하고 placeholder로 보호
        // (마크다운 링크 처리나 서식 변환과 충돌 방지)
        let step1 = sanitized;
        const urlPattern = /(https?:\/\/[^\s<">]+[^\s<".,;)])|(\bwww\.[^\s<">]+[^\s<".,;)])|(\b[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}(?::[0-9]+)?(?:\/[^\s<"]*[^\s<".,;)])?)/gi;

        step1 = step1.replace(urlPattern, (match) => {
            const url = this.decodeHtml(match);

            // Validate URL to prevent XSS
            if (!this.isValidUrl(url)) {
                return match;
            }

            const safeUrl = this.sanitizeUrl(url);
            const placeholder = `{{UP${urlPlaceholders.length}}}`;

            // URL이 이미지인지 확인
            const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;
            let html;
            if (imageExtensions.test(url)) {
                const imgId = 'img_' + Math.random().toString(36).substring(2, 9);
                setTimeout(() => {
                    const img = document.getElementById(imgId);
                    if (img) {
                        img.addEventListener('error', function () {
                            this.style.display = 'none';
                        });
                    }
                }, 0);

                html = `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline block">${match}</a>
                <img id="${imgId}" src="${safeUrl}" alt="Image preview" class="mt-2 max-w-full max-h-64 rounded-lg border border-gray-600 object-contain" loading="lazy">`;
            } else if (/^https?:\/\//i.test(url)) {
                const secBtnId = 'secbtn_' + Math.random().toString(36).substring(2, 9);
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
                    }
                }, 0);
                html = `<span class="inline-flex items-center gap-1"><a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline break-all">${match}</a><button id="${secBtnId}" data-sec-url="${safeUrl}" class="inline-flex items-center justify-center w-4 h-4 text-gray-500 hover:text-emerald-400 transition-colors flex-shrink-0" aria-label="보안 헤더 분석"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-2.332 9-7.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg></button><span class="text-[10px] text-emerald-400/70 whitespace-nowrap">← 보안 헤더를 확인해 주세요.</span></span>`;
            } else {
                html = `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline break-all">${match}</a>`;
            }

            urlPlaceholders.push(html);
            return placeholder;
        });

        // 마크다운 링크 [텍스트](URL) 처리 (placeholder로 보호)
        let step2 = step1;
        step2 = step2.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (match, text, url) => {
            const placeholder = `{{ML${mdLinkPlaceholders.length}}}`;
            mdLinkPlaceholders.push(`<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline break-all">${text}</a>`);
            return placeholder;
        });

        // 마크다운 서식 변환 (placeholder 보호된 상태에서 실행)
        let formatted = step2;
        formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
        formatted = formatted.replace(/__(.+?)__/g, '<strong class="font-bold text-white">$1</strong>');
        formatted = formatted.replace(/\*(.+?)\*/g, '<em class="italic text-gray-200">$1</em>');
        formatted = formatted.replace(/_(.+?)_/g, '<em class="italic text-gray-200">$1</em>');
        formatted = formatted.replace(/~~(.+?)~~/g, '<del class="line-through text-gray-500">$1</del>');
        formatted = formatted.replace(/(^|<br>)&gt;\s?([^<]+)/g, '$1<span class="block border-l-2 border-gray-500 pl-2 my-1 text-gray-300 italic">$2</span>');

        // 마크다운 링크 placeholder 복원
        for (let i = 0; i < mdLinkPlaceholders.length; i++) {
            formatted = formatted.replace(`{{ML${i}}}`, mdLinkPlaceholders[i]);
        }

        // URL placeholder 복원
        for (let i = 0; i < urlPlaceholders.length; i++) {
            formatted = formatted.replace(`{{UP${i}}}`, urlPlaceholders[i]);
        }

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
                    img.addEventListener('click', () => {
                        this.ensureLightboxExists();
                        this.openLightbox([{url: file.url, filename: file.filename}], 0);
                    });
                }
            }, 0);

            return `
                <div class="mt-2">
                    <img id="${imgId}" src="${safeUrl}" alt="${fileName}" 
                         class="max-w-full max-h-96 rounded-lg border border-gray-600 object-contain cursor-pointer hover:opacity-90 transition-opacity" 
                         loading="lazy">
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

    formatFileGallery(files) {
        if (!files || files.length === 0) return '';

        console.log('[Gallery] Files:', files);
        const images = files.filter(f => f.filetype && f.filetype.startsWith('image/'));
        const others = files.filter(f => !f.filetype || !f.filetype.startsWith('image/'));
        console.log('[Gallery] Images:', images.length, 'Others:', others.length);

        let html = '';

        // Image gallery
        if (images.length > 0) {
            const gridCols = images.length === 1 ? 'grid-cols-1' : 
                           images.length === 2 ? 'grid-cols-2' : 'grid-cols-3';
            
            html += `<div class="grid ${gridCols} gap-1.5 mt-2 max-w-md">`;
            
            const galleryData = btoa(encodeURIComponent(JSON.stringify(images.map(img => ({url: img.url, filename: img.filename})))));
            
            images.forEach((file, index) => {
                const safeUrl = this.sanitizeUrl(file.url);
                const fileName = this.sanitizeInput(file.filename || 'image');
                
                // Show overlay for images beyond the first 6
                const showOverlay = index === 5 && images.length > 6;
                const hiddenClass = index >= 6 ? 'hidden' : '';
                
                html += `
                    <div class="relative aspect-square rounded-lg overflow-hidden border border-gray-600 cursor-pointer gallery-image ${hiddenClass}"
                         data-gallery-index="${index}" data-gallery-data="${galleryData}">
                        <img src="${safeUrl}" alt="${fileName}" 
                             class="w-full h-full object-cover hover:opacity-90 transition-opacity" 
                             loading="lazy">
                        ${showOverlay ? `
                            <div class="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-lg font-bold">
                                +${images.length - 5}
                            </div>
                        ` : ''}
                    </div>
                `;
            });
            
            html += '</div>';
        }

        // Other files list
        others.forEach(file => {
            html += this.formatFileContent(file);
        });

        // Add lightbox if not exists
        this.ensureLightboxExists();

        return html;
    }

    ensureLightboxExists() {
        if (document.getElementById('gallery-lightbox')) return;

        const lightbox = document.createElement('div');
        lightbox.id = 'gallery-lightbox';
        lightbox.className = 'fixed inset-0 z-[200] bg-black/90 hidden flex items-center justify-center';
        lightbox.innerHTML = `
            <button id="lightbox-close" class="absolute top-4 right-4 text-white/80 hover:text-white p-2 z-50 cursor-pointer">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
            <button id="lightbox-prev" class="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 z-10 hidden">
                <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                </svg>
            </button>
            <button id="lightbox-next" class="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 z-10 hidden">
                <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
            </button>
            <div class="max-w-5xl max-h-[90vh] p-4 pointer-events-none">
                <img id="lightbox-img" src="" alt="" class="max-w-full max-h-[85vh] object-contain rounded-lg pointer-events-auto">
                <p id="lightbox-caption" class="text-center text-white/80 mt-3 text-sm pointer-events-auto"></p>
            </div>
        `;
        document.body.appendChild(lightbox);

        // Close on click
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox || e.target.closest('#lightbox-close')) {
                this.closeLightbox();
            }
        });

        // Prev/Next buttons
        document.getElementById('lightbox-prev').addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigateLightbox(-1);
        });
        document.getElementById('lightbox-next').addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigateLightbox(1);
        });

        // Keyboard navigation
        if (this._lightboxKeyHandler) {
            document.removeEventListener('keydown', this._lightboxKeyHandler);
        }
        this._lightboxKeyHandler = (e) => {
            if (lightbox.classList.contains('hidden')) return;
            if (e.key === 'Escape') this.closeLightbox();
            if (e.key === 'ArrowLeft') this.navigateLightbox(-1);
            if (e.key === 'ArrowRight') this.navigateLightbox(1);
        };
        document.addEventListener('keydown', this._lightboxKeyHandler);
    }

    openLightbox(images, startIndex) {
        this.lightboxImages = images;
        this.lightboxIndex = startIndex;
        this.updateLightbox();
        
        const lightbox = document.getElementById('gallery-lightbox');
        lightbox.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeLightbox() {
        const lightbox = document.getElementById('gallery-lightbox');
        lightbox.classList.add('hidden');
        document.body.style.overflow = '';
        this.lightboxImages = null;
    }

    navigateLightbox(direction) {
        if (!this.lightboxImages) return;
        this.lightboxIndex = (this.lightboxIndex + direction + this.lightboxImages.length) % this.lightboxImages.length;
        this.updateLightbox();
    }

    updateLightbox() {
        const img = document.getElementById('lightbox-img');
        const caption = document.getElementById('lightbox-caption');
        const prev = document.getElementById('lightbox-prev');
        const next = document.getElementById('lightbox-next');
        
        const current = this.lightboxImages[this.lightboxIndex];
        img.src = this.sanitizeUrl(current.url);
        caption.textContent = `${this.lightboxIndex + 1} / ${this.lightboxImages.length}`;
        
        if (this.lightboxImages.length > 1) {
            prev.classList.remove('hidden');
            next.classList.remove('hidden');
        }
    }

    formatFileSize(bytes) {
        return _formatFileSize(bytes);
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
