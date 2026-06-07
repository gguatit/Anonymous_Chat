// UI Edit Mode mixin
import { escapeHtml } from './utils.js';
import { MESSAGE_EDIT_WINDOW_MS } from '../../src/config/constants.js';

export const editing = {
    showEditMode(messageId, currentContent) {
        const messageDiv = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageDiv) return;

        let contentDiv = messageDiv.querySelector('.message-content');

        if (!contentDiv) {
            const timeEl = messageDiv.querySelector('.msg-time');
            contentDiv = document.createElement('div');
            contentDiv.className = 'text-sm break-words leading-relaxed message-content';
            if (timeEl) {
                timeEl.parentNode.insertBefore(contentDiv, timeEl);
            } else {
                messageDiv.appendChild(contentDiv);
            }
        }

        const originalContent = currentContent;

        contentDiv.innerHTML = `
            <div class="flex flex-col gap-2">
                <textarea class="edit-input bg-gray-800 text-gray-100 border border-gray-600 rounded px-2 py-1 text-sm w-full resize-none"
                          rows="2"
                          maxlength="7500">${escapeHtml(originalContent)}</textarea>
                <div class="flex gap-2 justify-end">
                    <button class="cancel-edit-btn text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded">취소</button>
                    <button class="save-edit-btn text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded">저장</button>
                </div>
            </div>
        `;

        const editInput = contentDiv.querySelector('.edit-input');
        const cancelBtn = contentDiv.querySelector('.cancel-edit-btn');
        const saveBtn = contentDiv.querySelector('.save-edit-btn');

        editInput.focus();
        editInput.setSelectionRange(editInput.value.length, editInput.value.length);

        cancelBtn.addEventListener('click', () => {
            if (originalContent) {
                contentDiv.innerHTML = escapeHtml(originalContent);
            } else {
                contentDiv.remove();
            }
        });

        saveBtn.addEventListener('click', () => {
            const newContent = editInput.value.trim();
            if (!newContent) {
                alert('메시지 내용이 비어있습니다.');
                return;
            }
            if (newContent === originalContent) {
                contentDiv.innerHTML = escapeHtml(originalContent);
                return;
            }

            if (window.chatClient) {
                window.chatClient.editMessage(messageId, newContent);
            }
        });

        editInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveBtn.click();
            }
            if (e.key === 'Escape') {
                cancelBtn.click();
            }
        });
    },

    updateMessage(messageId, newContent, _editedAt) {
        const messageDiv = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageDiv) return;

        let contentDiv = messageDiv.querySelector('.message-content');

        if (!contentDiv) {
            const timeEl = messageDiv.querySelector('.msg-time');
            contentDiv = document.createElement('div');
            contentDiv.className = 'text-sm break-words leading-relaxed message-content';
            if (timeEl) {
                timeEl.parentNode.insertBefore(contentDiv, timeEl);
            } else {
                messageDiv.appendChild(contentDiv);
            }
        }

        contentDiv.innerHTML = this.formatMessageContent(newContent);

        const timeEl = messageDiv.querySelector('.msg-time');
        if (timeEl && !timeEl.innerHTML.includes('\uC218\uC815\uB428')) {
            timeEl.innerHTML += ' <span class="text-xs opacity-60">(\uC218\uC815\uB428)</span>';
        }

        const editBtn = messageDiv.querySelector('.edit-message-btn');
        if (editBtn) {
            const messageTimestamp = parseInt(messageDiv.closest('[data-message]').dataset.timestamp || '0');
            if (Date.now() - messageTimestamp >= MESSAGE_EDIT_WINDOW_MS) {
                editBtn.remove();
            }
        }
    },

    removeMessage(messageId) {
        const messageDiv = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
        if (messageDiv) {
            messageDiv.remove();
        }
    },
};
