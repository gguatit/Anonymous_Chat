// Admin Dashboard - Message Management Methods
import ApiClient from './api-client.js';
import { trapFocus } from './admin-utils.js';

const messageMethods = {
    async sendAdminBroadcast() {
        if (!this.sessionToken) {
            alert('관리자 인증이 필요합니다.');
            return;
        }

        const raw = (this.adminMessageInput?.value || '');
        const content = raw.trim();
        if (!content) {
            alert('메시지를 입력하세요.');
            return;
        }

        if (raw.length > 7500) {
            alert('메시지는 최대 7500자까지 가능합니다.');
            return;
        }

        try {
            const response = await ApiClient.postRaw('/api/admin/broadcast', { content: raw });

            if (!response.ok) {
                const err = await response.json().catch(() => null);
                console.error('Broadcast failed', err);
                alert('메시지 전송에 실패했습니다.');
                return;
            }

            if (this.adminMessageInput) this.adminMessageInput.value = '';
            this.refreshData();

        } catch (error) {
            console.error('sendAdminBroadcast error:', error);
            alert('메시지 전송 중 오류가 발생했습니다.');
        }
    },

    async editAdminMessage(messageId, newContent) {
        if (!this.sessionToken) {
            alert('관리자 인증이 필요합니다.');
            return;
        }

        if (!newContent) {
            alert('메시지 내용이 비어있습니다.');
            return;
        }

        try {
            const response = await fetch('/api/admin/edit-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify({ messageId, newContent })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => null);
                console.error('Edit failed', err);
                alert('메시지 수정에 실패했습니다.');
                return;
            }

            this.refreshData();
        } catch (error) {
            console.error('editAdminMessage error:', error);
            alert('메시지 수정 중 오류가 발생했습니다.');
        }
    },

    async deleteMessage(messageId) {
        if (!this.sessionToken) {
            alert('관리자 인증이 필요합니다.');
            return;
        }

        try {
            const response = await fetch('/api/admin/delete-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify({ messageId })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => null);
                console.error('Delete failed', err);
                alert('메시지 삭제에 실패했습니다.');
                return;
            }

            await response.json();
            this.refreshData();
        } catch (error) {
            console.error('deleteMessage error:', error);
            alert('메시지 삭제 중 오류가 발생했습니다.');
        }
    },

    async deleteAllMessages() {
        if (!this.sessionToken) {
            alert('관리자 인증이 필요합니다.');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-gray-800 rounded-lg shadow-2xl p-6 max-w-md w-full mx-4 border border-gray-700">
                <h3 class="text-xl font-bold text-red-400 mb-3">⚠️ 모든 메시지 삭제</h3>
                <p class="text-sm text-gray-300 mb-4">정말로 모든 메시지를 삭제하시겠습니까?</p>
                <div class="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-4">
                    <p class="text-xs text-red-300 font-medium">이 작업은 되돌릴 수 없습니다.</p>
                    <p class="text-xs text-red-400 mt-1">삭제된 메시지는 복구할 수 없으며, 첨부된 파일도 함께 삭제됩니다.</p>
                </div>
                <p class="text-sm text-gray-300 mb-2">계속하려면 아래 문구를 입력하세요:</p>
                <div class="flex items-center gap-2 mb-4">
                    <code class="flex-1 bg-gray-900 text-gray-100 px-3 py-2 rounded text-sm font-mono select-all">DELETE_ALL_MESSAGES</code>
                    <button class="copy-confirm-text-btn bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded text-sm transition-colors" title="복사">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                        </svg>
                    </button>
                </div>
                <input id="delete-all-confirm-input" type="text" placeholder="위 문구를 입력하세요" class="w-full bg-gray-900 text-gray-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-500 border border-gray-600 mb-4" autocomplete="off" maxlength="30">
                <div id="delete-all-confirm-error" class="hidden text-red-400 text-xs mb-3">문구가 일치하지 않습니다.</div>
                <div class="flex gap-3">
                    <button id="delete-all-cancel-btn" class="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 rounded-lg transition-colors">취소</button>
                    <button id="delete-all-confirm-btn" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled>삭제</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        trapFocus(modal);

        const input = modal.querySelector('#delete-all-confirm-input');
        const confirmBtn = modal.querySelector('#delete-all-confirm-btn');
        const cancelBtn = modal.querySelector('#delete-all-cancel-btn');
        const errorEl = modal.querySelector('#delete-all-confirm-error');
        const copyBtn = modal.querySelector('.copy-confirm-text-btn');

        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText('DELETE_ALL_MESSAGES');
                const original = copyBtn.innerHTML;
                copyBtn.innerHTML = '<svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
                setTimeout(() => copyBtn.innerHTML = original, 1500);
            } catch (_e) {
                const ta = document.createElement('textarea');
                ta.value = 'DELETE_ALL_MESSAGES';
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
        });

        input.addEventListener('input', () => {
            const matched = input.value === 'DELETE_ALL_MESSAGES';
            confirmBtn.disabled = !matched;
            errorEl.classList.add('hidden');
            if (matched) {
                input.classList.remove('focus:ring-red-500', 'border-red-500');
                input.classList.add('focus:ring-green-500', 'border-green-500');
            } else {
                input.classList.remove('focus:ring-green-500', 'border-green-500');
                input.classList.add('focus:ring-red-500', 'border-red-500');
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !confirmBtn.disabled) confirmBtn.click();
            if (e.key === 'Escape') modal.remove();
        });

        const closeModal = () => modal.remove();

        cancelBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        confirmBtn.addEventListener('click', async () => {
            if (input.value !== 'DELETE_ALL_MESSAGES') {
                errorEl.classList.remove('hidden');
                return;
            }

            try {
                const response = await fetch('/api/admin/delete-all-messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.sessionToken}`
                    },
                    body: JSON.stringify({ confirmation: 'DELETE_ALL_MESSAGES' })
                });

                if (!response.ok) {
                    const err = await response.json().catch(() => null);
                    console.error('Delete all messages failed', err);
                    alert('모든 메시지 삭제에 실패했습니다. 콘솔을 확인하세요.');
                    return;
                }

                const result = await response.json();
                modal.remove();
                alert(`✓ 모든 메시지가 삭제되었습니다. (${result.deletedCount}개)`);
                this.refreshData();

            } catch (error) {
                console.error('deleteAllMessages error:', error);
                modal.remove();
                alert('모든 메시지 삭제 중 오류가 발생했습니다.');
            }
        });

        setTimeout(() => input.focus(), 100);
    },
};

export default messageMethods;
