// UI Context Menus mixin
export const menus = {
    showContextMenu(event, messageId, canEdit = false) {
        const existingMenu = document.getElementById('message-context-menu');
        if (existingMenu) existingMenu.remove();

        const messageDiv = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
        const contentDiv = messageDiv && messageDiv.querySelector('.message-content');
        const replyContent = contentDiv ? this.htmlToPlainText(contentDiv.innerHTML) : '[파일]';
        const isOwnMessage = !!(messageDiv && messageDiv.querySelector('.msg-bubble-own'));
        const targetSessionId = messageDiv ? messageDiv.dataset.sessionId : null;

        const menu = document.createElement('div');
        menu.id = 'message-context-menu';
        menu.className = 'fixed bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-1 z-50 context-menu-enter';
        menu.style.minWidth = '120px';
        menu.setAttribute('data-ctx-message-id', messageId);
        if (canEdit) menu.setAttribute('data-ctx-can-edit', 'true');

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

        // ── Delegated click handler for all menu buttons ──
        menu.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            menu.remove();

            const mid = menu.getAttribute('data-ctx-message-id');
            if (btn.classList.contains('copy-message-btn')) {
                const msgDiv = this.messagesContainer.querySelector(`[data-message-id="${mid}"]`);
                const cDiv = msgDiv && msgDiv.querySelector('.message-content');
                const text = cDiv ? this.htmlToPlainText(cDiv.innerHTML) : '';
                if (text) {
                    navigator.clipboard.writeText(text).catch(() => {
                        const ta = document.createElement('textarea');
                        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
                        document.body.appendChild(ta); ta.select();
                        document.execCommand('copy'); document.body.removeChild(ta);
                    });
                }
            } else if (btn.classList.contains('reply-message-btn')) {
                this.setReplyingTo(mid, replyContent, isOwnMessage, targetSessionId);
            } else if (btn.classList.contains('edit-message-btn')) {
                const msgDiv = this.messagesContainer.querySelector(`[data-message-id="${mid}"]`);
                if (msgDiv) {
                    const cDiv = msgDiv.querySelector('.message-content');
                    this.showEditMode(mid, cDiv ? this.htmlToPlainText(cDiv.innerHTML) : '');
                }
            } else if (btn.classList.contains('delete-message-btn')) {
                this.confirmDelete(mid);
            } else if (btn.classList.contains('react-message-btn')) {
                const msgDiv = this.messagesContainer.querySelector(`[data-message-id="${mid}"]`);
                if (msgDiv) this.showReactionPicker(msgDiv, mid);
            }
        });

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
    },

    confirmDelete(messageId) {
        if (this.onDelete) {
            this.onDelete(messageId);
        }
    },

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
    },

    removeReactionPicker() {
        const picker = document.getElementById('reaction-picker');
        if (picker) picker.remove();
    },

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
    },
};
