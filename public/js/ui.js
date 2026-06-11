// UI Manager - handles all DOM interactions
import { escapeHtml } from './utils.js';
import { UI } from '../../src/config/constants.js';
import { rendering } from './ui-render.js';
import { menus } from './ui-menu.js';
import { modals } from './ui-modals.js';
import { editing } from './ui-edit.js';
import { lightbox } from './ui-lightbox.js';

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

        this.replyingTo = null;
        this.onReaction = null;

        this._lastSender = null;
        this._lastTime = null;
        this._lastMessageEl = null;

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

        // Empty space right-click for channel menu, message right-click for context menu
        this.messagesContainer.addEventListener('contextmenu', (e) => {
            const msgEl = e.target.closest('[data-message-id]');
            if (msgEl) {
                e.preventDefault();
                const messageId = msgEl.getAttribute('data-message-id');
                const canEdit = msgEl.getAttribute('data-can-edit') === 'true';
                this.showContextMenu(e, messageId, canEdit);
            } else if (!e.target.closest('[data-message]')) {
                e.preventDefault();
                this.showChannelContextMenu(e);
            }
        });

        // ── Delegated message interactions (replaces per-message listeners) ──
        this._longPressTimer = null;

        this.messagesContainer.addEventListener('touchstart', (e) => {
            const msgEl = e.target.closest('[data-message-id]');
            if (!msgEl) return;
            clearTimeout(this._longPressTimer);
            this._longPressTimer = setTimeout(() => {
                const messageId = msgEl.getAttribute('data-message-id');
                const canEdit = msgEl.getAttribute('data-can-edit') === 'true';
                this.showContextMenu(e, messageId, canEdit);
            }, 500);
        }, { passive: true });

        this.messagesContainer.addEventListener('touchend', () => {
            clearTimeout(this._longPressTimer);
            this._longPressTimer = null;
        }, { passive: true });

        this.messagesContainer.addEventListener('touchmove', () => {
            clearTimeout(this._longPressTimer);
            this._longPressTimer = null;
        }, { passive: true });

        this.messagesContainer.addEventListener('dblclick', (e) => {
            const interactive = e.target.closest('a, button, input, textarea, [role="button"], .reaction-pill');
            if (interactive) return;
            const msgEl = e.target.closest('[data-message-id]');
            if (!msgEl || !this.onReaction) return;
            const messageId = msgEl.getAttribute('data-message-id');
            const bar = msgEl.querySelector('.reaction-bar');
            const existingPill = bar && bar.querySelector('[data-emoji="\uD83D\uDC4D"]');
            const hasReacted = existingPill && existingPill.classList.contains('bg-blue-600');
            this.onReaction(messageId, '\uD83D\uDC4D', hasReacted);
        });

        this.messagesContainer.addEventListener('click', (e) => {
            // Reaction pill clicks (delegated)
            const pill = e.target.closest('.reaction-pill');
            if (pill && this.onReaction) {
                e.stopPropagation();
                const messageId = pill.getAttribute('data-message-id');
                const emoji = pill.getAttribute('data-emoji');
                const hasReacted = pill.classList.contains('bg-blue-600');
                this.onReaction(messageId, emoji, hasReacted);
                return;
            }

            // Secret message reveal buttons
            const revealBtn = e.target.closest('.reveal-secret-btn');
            if (revealBtn && this.onRevealSecret) {
                const secretId = revealBtn.getAttribute('data-secret-id');
                const container = revealBtn.closest('.secret-message-container');
                if (container) {
                    this.onRevealSecret(secretId, container);
                }
                return;
            }

            // Jump to replied message
            const replyRef = e.target.closest('.reply-reference');
            if (replyRef) {
                const replyId = replyRef.getAttribute('data-reply-to-id');
                if (replyId) this.highlightMessage(replyId);
                return;
            }

            // Click on message to jump to its reply source (only if it has reply data)
            const msgEl = e.target.closest('[data-message-id]');
            if (msgEl && !e.target.closest('a, button, input, textarea, [role="button"], .secret-message-container')) {
                const replyToId = msgEl.getAttribute('data-reply-to');
                if (replyToId) {
                    this.highlightMessage(replyToId);
                }
            }
        });
    }

    /**
     * MutationObserver를 사용하여 새 메시지 추가 시 자동 스크롤
     */
    initAutoScroll() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('data-message')) {
                            const container = this.messagesContainer;
                            const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < UI.SCROLL_PROXIMITY_PX;
                            if (isAtBottom) {
                                this.scrollToBottom();
                            } else {
                                this.scrollButton.classList.remove('opacity-0', 'pointer-events-none');
                                this.scrollButton.classList.add('opacity-100', 'pointer-events-auto');
                            }
                            return;
                        }
                    }
                }
            }
        });

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
                if (typeof this.messageForm.requestSubmit === 'function') {
                    this.messageForm.requestSubmit();
                } else {
                    callbacks.onSubmit(new Event('submit', { bubbles: true, cancelable: true }));
                }
            }
        });

        // Character count + auto-resize textarea
        this.messageInput.addEventListener('input', () => {
            this.charCount.textContent = this.messageInput.value.length;

            this.messageInput.style.height = 'auto';
            const maxH = 200;
            const scrollH = this.messageInput.scrollHeight;
            this.messageInput.style.height = Math.min(scrollH, maxH) + 'px';
            this.messageInput.style.overflowY = scrollH > maxH ? 'auto' : 'hidden';
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

    displaySystemMessage(content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'text-center text-xs text-gray-500 py-1.5 system-message-enter';
        messageDiv.textContent = content;

        messageDiv.setAttribute('data-message', 'true');
        messageDiv.setAttribute('data-system-message', 'true');

        this.messagesContainer.appendChild(messageDiv);

        const prevLoading = this.messagesContainer.querySelectorAll('[data-loading-summary]');
        prevLoading.forEach(el => el.remove());

        if (content.includes('AI가 대화 요약을 생성 중입니다')) {
            messageDiv.setAttribute('data-loading-summary', 'true');
        }

        if (content.includes('입장했습니다')) {
            setTimeout(() => messageDiv.remove(), UI.SYSTEM_MESSAGE_TIMEOUT_MS);
        }

        return messageDiv;
    }

    _clearLoadingSummary() {
        const loading = this.messagesContainer.querySelector('[data-loading-summary]');
        if (loading) loading.remove();
    }

    displaySummary(summaryText, messageId, mode = 'default') {
        if (messageId && this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`)) {
            return;
        }

        this._clearLoadingSummary();

        const MODE_STYLES = {
            default: { bg: 'bg-indigo-900/40', border: 'border-indigo-700/50', title: 'text-indigo-300', label: 'AI \uB300\uD654 \uC694\uC57D' },
            topic: { bg: 'bg-emerald-900/40', border: 'border-emerald-700/50', title: 'text-emerald-300', label: '\uB300\uD654 \uC8FC\uC81C' },
            mood: { bg: 'bg-amber-900/40', border: 'border-amber-700/50', title: 'text-amber-300', label: '\uB300\uD654 \uBD84\uC704\uAE30' },
            conflict: { bg: 'bg-red-900/40', border: 'border-red-700/50', title: 'text-red-300', label: '\uC758\uACAC \uCDA9\uB3CC' },
        };
        const s = MODE_STYLES[mode] || MODE_STYLES.default;

        const wrapper = document.createElement('div');
        wrapper.className = `${s.bg} ${s.border} border rounded-lg p-3 mx-2 my-3`;
        wrapper.setAttribute('data-message', 'true');
        if (messageId) {
            wrapper.setAttribute('data-message-id', messageId);
        }

        const title = document.createElement('div');
        title.className = `text-xs font-semibold mb-2 ${s.title}`;
        title.textContent = s.label;

        const content = document.createElement('div');
        content.className = 'text-sm text-gray-200 leading-relaxed';
        content.textContent = summaryText;

        wrapper.appendChild(title);
        wrapper.appendChild(content);
        this.messagesContainer.appendChild(wrapper);
    }

    displayAnnouncement(_content, _timestamp) {
        // 공지사항은 채팅에 표시하지 않습니다.
        // 사용자는 헤더의 공지사항 버튼(확성기 아이콘)을 통해 /announcements.html에서 확인할 수 있습니다.
    }

    hideAnnouncement() {
        if (this.announcementBanner) {
            this.announcementBanner.style.maxHeight = '0';
            this.announcementBanner.style.opacity = '0';
        }
    }

    displayError(content) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'text-center text-xs text-red-400 py-2 bg-red-900/20 rounded-lg mx-4';
        errorDiv.textContent = content;

        errorDiv.setAttribute('data-message', 'true');

        this.messagesContainer.appendChild(errorDiv);

        setTimeout(() => {
            errorDiv.remove();
        }, UI.ERROR_BANNER_TIMEOUT_MS);
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
        const users = Array.from(typingUsers.values()).map(u => escapeHtml(u.nickname || '익명'));

        let text;
        if (count === 1) {
            text = `${users[0]}님이 입력 중`;
        } else if (count === 2) {
            text = `${users[0]}, ${users[1]}님이 입력 중`;
        } else {
            text = `${users[0]} 외 ${count - 1}명이 입력 중`;
        }

        this.typingIndicator.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 14 32 4" fill="currentColor" width="40" height="5" class="inline-block align-middle mr-1 opacity-70" preserveAspectRatio="none"><path opacity="0.8" transform="translate(0 0)" d="M2 14 V18 H6 V14z"><animateTransform attributeName="transform" type="translate" values="0 0; 24 0; 0 0" dur="2s" begin="0" repeatCount="indefinite" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" calcMode="spline"/></path><path opacity="0.5" transform="translate(0 0)" d="M0 14 V18 H8 V14z"><animateTransform attributeName="transform" type="translate" values="0 0; 24 0; 0 0" dur="2s" begin="0.1s" repeatCount="indefinite" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" calcMode="spline"/></path><path opacity="0.25" transform="translate(0 0)" d="M0 14 V18 H8 V14z"><animateTransform attributeName="transform" type="translate" values="0 0; 24 0; 0 0" dur="2s" begin="0.2s" repeatCount="indefinite" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" calcMode="spline"/></path></svg> ${text}`;
    }

    setInputEnabled(enabled) {
        this.sendButton.disabled = !enabled;
        this.messageInput.disabled = !enabled;
    }

    clearInput() {
        this.messageInput.value = '';
        this.charCount.textContent = '0';
        this.messageInput.style.height = '';
    }

    getInputValue() {
        return this.messageInput.value;
    }

    getInputLength() {
        return this.messageInput.value.length;
    }

    scrollToBottom(smooth = false) {
        const container = this.messagesContainer;

        if (smooth) {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        } else {
            container.scrollTop = container.scrollHeight;
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

    updateReaction(messageId, emoji, count, reacted) {
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
            bar.appendChild(pill);
        }

        const userReacted = !!reacted;
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
        const messages = this.messagesContainer.querySelectorAll('[data-message-id]');
        messages.forEach(msg => msg.remove());
    }

    setReplyingTo(messageId, content, isOwnMessage, targetSessionId) {
        this.replyingTo = { messageId, content, isOwnMessage, targetSessionId, isSecret: false };
        this.showReplyPreview();
        this.messageInput.focus();
    }

    showReplyPreview() {
        const existingPreview = document.getElementById('reply-preview');
        if (existingPreview) {
            existingPreview.remove();
        }

        if (!this.replyingTo) return;

        const preview = document.createElement('div');
        preview.id = 'reply-preview';
        preview.className = 'bg-gray-700/50 border-l-4 border-blue-500 p-2 mb-2 text-sm flex flex-col gap-2';

        const truncatedContent = this.replyingTo.content.length > 50
            ? this.replyingTo.content.substring(0, UI.REPLY_PREVIEW_LENGTH) + '...'
            : this.replyingTo.content;

        preview.innerHTML = `
            <div class="flex items-start justify-between gap-2">
                <div class="flex-1">
                    <div class="text-xs text-blue-400 mb-1">${this.replyingTo.isOwnMessage ? '내 메시지' : '익명'}에게 답장</div>
                    <div class="text-gray-300">${escapeHtml(truncatedContent)}</div>
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

// Apply mixins to prototype
Object.assign(UIManager.prototype, rendering);
Object.assign(UIManager.prototype, menus);
Object.assign(UIManager.prototype, modals);
Object.assign(UIManager.prototype, editing);
Object.assign(UIManager.prototype, lightbox);
