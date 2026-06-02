// Admin Dashboard - Data & API Methods
import { escapeHtml } from './utils.js';
import { trapFocus, showModal } from './admin-utils.js';

const dataMethods = {
    async exportCsv() {
        if (!this.sessionToken) {
            alert('관리자 인증이 필요합니다.');
            return;
        }

        try {
            const [sessionsResp, messagesResp] = await Promise.all([
                fetch('/api/admin/sessions', { headers: { 'Authorization': `Bearer ${this.sessionToken}` } }),
                fetch('/api/admin/messages', { headers: { 'Authorization': `Bearer ${this.sessionToken}` } })
            ]);

            if (!sessionsResp.ok || !messagesResp.ok) {
                alert('데이터를 불러오는 중 오류가 발생했습니다. 권한을 확인하세요.');
                return;
            }

            const sessions = await sessionsResp.json();
            const messages = await messagesResp.json();

            // Map users by sessionId for quick lookup
            const usersMap = new Map();
            for (const s of sessions) {
                usersMap.set(s.sessionId, s);
            }

            // Build CSV rows: include user info per message; also include users with no messages
            const rows = [];
            const headers = [
                'user_session_id', 'user_ip', 'user_join_time', 'user_message_count', 'user_last_message_time',
                'message_id', 'message_timestamp', 'message_content', 'message_edited_at', 'file_url', 'file_name', 'file_size', 'file_type'
            ];

            for (const msg of messages) {
                const user = usersMap.get(msg.sessionId) || {};
                rows.push([
                    user.sessionId || msg.sessionId || '',
                    user.ip || '',
                    user.joinTime ? new Date(user.joinTime).toISOString() : '',
                    user.messageCount != null ? user.messageCount : '',
                    user.lastMessageTime ? new Date(user.lastMessageTime).toISOString() : '',
                    msg.messageId || '',
                    msg.timestamp ? new Date(msg.timestamp).toISOString() : '',
                    msg.content || '',
                    msg.editedAt ? new Date(msg.editedAt).toISOString() : '',
                    msg.file?.url || '',
                    msg.file?.filename || '',
                    msg.file?.filesize != null ? String(msg.file.filesize) : '',
                    msg.file?.filetype || ''
                ]);
            }

            // Add users who have no messages as rows with empty message fields
            for (const [sessionId, user] of usersMap.entries()) {
                const hasMessage = messages.some(m => m.sessionId === sessionId);
                if (!hasMessage) {
                    rows.push([
                        user.sessionId || sessionId,
                        user.ip || '',
                        user.joinTime ? new Date(user.joinTime).toISOString() : '',
                        user.messageCount != null ? user.messageCount : '',
                        user.lastMessageTime ? new Date(user.lastMessageTime).toISOString() : '',
                        '', '', '', '', '', '', '', ''
                    ]);
                }
            }

            // CSV escape helper
            const escape = (value) => {
                if (value == null) return '';
                const str = String(value);
                // Replace double quotes with two double quotes, wrap in quotes
                return '"' + str.replace(/"/g, '""') + '"';
            };

            const csvContent = [headers.map(h => escape(h)).join(',')]
                .concat(rows.map(r => r.map(cell => escape(cell)).join(',')))
                .join('\n');

            // Add BOM for Excel compatibility
            const bom = '\uFEFF';
            const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `anonymous_chat_export_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Export CSV error:', error);
            alert('CSV 내보내기 중 오류가 발생했습니다. 콘솔을 확인하세요.');
        }
    },

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
            const response = await fetch('/api/admin/broadcast', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify({ content: raw })
            });

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

    async sendAdminAnnounce() {
        if (!this.sessionToken) {
            alert('관리자 인증이 필요합니다.');
            return;
        }

        const raw = (this.adminAnnounceInput?.value || '');
        const content = raw.trim();
        if (!content) {
            alert('공지 내용을 입력하세요.');
            return;
        }

        if (raw.length > 7500) {
            alert('공지사항은 최대 7500자까지 가능합니다.');
            return;
        }

        const isEmergency = this.emergencyCheckbox?.checked || false;

        if (isEmergency) {
            const confirmed = await new Promise((resolve) => {
                const modal = document.createElement('div');
                modal.className = 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50';
                modal.innerHTML = `
            <div class="bg-gray-800 rounded-lg shadow-2xl p-6 max-w-md w-full mx-4 border border-red-500/30">
                <div class="flex items-center gap-2 mb-3">
                    <span class="text-2xl">🚨</span>
                    <h3 class="text-lg font-bold text-red-400">긴급 공지 확인</h3>
                </div>
                <p class="text-sm text-gray-300 mb-1">정말 <span class="text-red-400 font-semibold">긴급 공지</span>로 발송하시겠습니까?</p>
                <p class="text-xs text-gray-500 mb-4">긴급 공지는 모든 사용자를 공지 페이지로 강제 이동시킵니다.</p>
                <div class="text-xs text-gray-600 bg-gray-900 rounded p-2 mb-4 max-h-24 overflow-y-auto">${this.escapeHtml(content.substring(0, 200))}${content.length > 200 ? '...' : ''}</div>
                <div class="flex gap-3 justify-end">
                    <button class="cancel-btn bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm">취소</button>
                    <button class="confirm-btn bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">긴급 발송</button>
                </div>
            </div>`;
                document.body.appendChild(modal);
                modal.querySelector('.cancel-btn').onclick = () => { modal.remove(); resolve(false); };
                modal.querySelector('.confirm-btn').onclick = () => { modal.remove(); resolve(true); };
                modal.addEventListener('click', (e) => { if (e.target === modal) { modal.remove(); resolve(false); } });
            });
            if (!confirmed) return;
        }

        const body = { content: raw, isEmergency };
        if (isEmergency) {
            const duration = parseInt(this.emergencyDuration?.value || '0');
            if (duration > 0) {
                body.emergencyUntil = Date.now() + duration;
            }
        }

        const isScheduled = this.scheduleCheckbox?.checked || false;
        if (isScheduled && this.scheduleDatetime?.value) {
            body.scheduleAt = new Date(this.scheduleDatetime.value).getTime();
            if (body.scheduleAt <= Date.now()) {
                alert('예약 시간은 현재보다 이후여야 합니다.');
                return;
            }
        }

        const expiryDuration = parseInt(this.announceExpirySelect?.value || '0');
        if (expiryDuration > 0) {
            body.expiresAt = Date.now() + expiryDuration;
        }

        try {
            const response = await fetch('/api/admin/announce', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const err = await response.json().catch(() => null);
                console.error('Announce failed', err);
                alert('공지 전송에 실패했습니다.');
                return;
            }

            const result = await response.json();
            if (result.sessionsNotified !== undefined) {
                alert(`공지가 ${result.sessionsNotified}명의 사용자에게 전송되었습니다.`);
            } else {
                alert('공지가 전송되었습니다.');
            }

            if (this.adminAnnounceInput) this.adminAnnounceInput.value = '';
            if (this.emergencyCheckbox) this.emergencyCheckbox.checked = false;
            if (this.emergencyDuration) this.emergencyDuration.classList.add('hidden');
            this.refreshData();

        } catch (error) {
            console.error('sendAdminAnnounce error:', error);
            alert('공지 전송 중 오류가 발생했습니다.');
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
                // fallback for older browsers
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

    async exportFilteredCsv() {
        if (!this.sessionToken) {
            alert('관리자 인증이 필요합니다.');
            return;
        }

        // 필터 옵션 프롬프트
        const filterOptions = prompt(
            '내보내기 옵션을 선택하세요:\n' +
            '1: 전체 데이터\n' +
            '2: 활성 세션만\n' +
            '3: 오늘 메시지만\n' +
            '4: 최근 1시간\n' +
            '5: 최근 24시간',
            '1'
        );

        if (!filterOptions) return;

        try {
            const [sessionsResp, messagesResp] = await Promise.all([
                fetch('/api/admin/sessions', { headers: { 'Authorization': `Bearer ${this.sessionToken}` } }),
                fetch('/api/admin/messages', { headers: { 'Authorization': `Bearer ${this.sessionToken}` } })
            ]);

            if (!sessionsResp.ok || !messagesResp.ok) {
                alert('데이터를 불러오는 중 오류가 발생했습니다.');
                return;
            }

            let sessions = await sessionsResp.json();
            let messages = await messagesResp.json();

            // 필터 적용
            const now = Date.now();
            const oneHour = 60 * 60 * 1000;
            const oneDay = 24 * oneHour;
            const todayStart = new Date().setHours(0, 0, 0, 0);

            switch (filterOptions) {
                case '2': { // 활성 세션만
                    const activeSessions = new Set(sessions.map(s => s.sessionId));
                    messages = messages.filter(m => activeSessions.has(m.sessionId));
                    break;
                }
                case '3': // 오늘 메시지
                    messages = messages.filter(m => m.timestamp >= todayStart);
                    break;
                case '4': // 최근 1시간
                    messages = messages.filter(m => now - m.timestamp < oneHour);
                    sessions = sessions.filter(s => now - s.joinTime < oneHour);
                    break;
                case '5': // 최근 24시간
                    messages = messages.filter(m => now - m.timestamp < oneDay);
                    sessions = sessions.filter(s => now - s.joinTime < oneDay);
                    break;
                default: // 전체
                    break;
            }

            // CSV 생성
            const usersMap = new Map();
            for (const s of sessions) {
                usersMap.set(s.sessionId, s);
            }

            const rows = [];
            const headers = [
                'user_session_id', 'user_ip', 'user_join_time', 'user_message_count', 'user_last_message_time',
                'message_id', 'message_timestamp', 'message_content', 'message_edited_at', 'file_url', 'file_name', 'file_size', 'file_type'
            ];

            for (const msg of messages) {
                const user = usersMap.get(msg.sessionId) || {};
                rows.push([
                    user.sessionId || msg.sessionId || '',
                    user.ip || '',
                    user.joinTime ? new Date(user.joinTime).toISOString() : '',
                    user.messageCount != null ? user.messageCount : '',
                    user.lastMessageTime ? new Date(user.lastMessageTime).toISOString() : '',
                    msg.messageId || '',
                    msg.timestamp ? new Date(msg.timestamp).toISOString() : '',
                    msg.content || '',
                    msg.editedAt ? new Date(msg.editedAt).toISOString() : '',
                    msg.file?.url || '',
                    msg.file?.filename || '',
                    msg.file?.filesize != null ? String(msg.file.filesize) : '',
                    msg.file?.filetype || ''
                ]);
            }

            // 메시지 없는 세션 추가
            for (const [sessionId, user] of usersMap.entries()) {
                const hasMessage = messages.some(m => m.sessionId === sessionId);
                if (!hasMessage) {
                    rows.push([
                        user.sessionId || sessionId,
                        user.ip || '',
                        user.joinTime ? new Date(user.joinTime).toISOString() : '',
                        user.messageCount != null ? user.messageCount : '',
                        user.lastMessageTime ? new Date(user.lastMessageTime).toISOString() : '',
                        '', '', '', '', '', '', '', ''
                    ]);
                }
            }

            const escape = (value) => {
                if (value == null) return '';
                const str = String(value);
                return '"' + str.replace(/"/g, '""') + '"';
            };

            const csvContent = [headers.map(h => escape(h)).join(',')]
                .concat(rows.map(r => r.map(cell => escape(cell)).join(',')))
                .join('\n');

            const bom = '\uFEFF';
            const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            const filterName = ['all', 'active', 'today', '1hour', '24hours'][parseInt(filterOptions) - 1] || 'filtered';
            const a = document.createElement('a');
            a.href = url;
            a.download = `anonymous_chat_${filterName}_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Export filtered CSV error:', error);
            alert('CSV 내보내기 중 오류가 발생했습니다.');
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

    async kickUser(sessionId, banDuration = 0) {
        if (!this.sessionToken) {
            alert('관리자 인증이 필요합니다.');
            return;
        }

        try {
            const response = await fetch('/api/admin/kick-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify({ sessionId, banDuration })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => null);
                console.error('Kick user failed', err);
                alert('사용자 강제퇴장에 실패했습니다.');
                return;
            }

            const result = await response.json();

            if (result.banned) {
                const minutes = Math.floor(banDuration / 60);
                const seconds = banDuration % 60;
                const timeStr = minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
                if (result.sharedIP) {
                    alert(`사용자가 강제퇴장되었습니다.\n\n⚠️ 공유 IP 감지: 세션만 ${timeStr}간 차단됨\n(같은 IP의 다른 사용자는 영향 없음)`);
                } else {
                    alert(`사용자가 강제퇴장되었습니다.\nIP ${result.ip}가 ${timeStr}간 차단되었습니다.`);
                }
            } else {
                alert('사용자가 강제퇴장되었습니다.');
            }

            this.refreshData();
        } catch (error) {
            console.error('kickUser error:', error);
            alert('사용자 강제퇴장 중 오류가 발생했습니다.');
        }
    },

    async loadBannedIPs() {
        try {
            const response = await fetch('/api/admin/banned-ips', {
                headers: { 'Authorization': `Bearer ${this.sessionToken}` }
            });

            if (!response.ok) {
                throw new Error('Failed to load banned IPs');
            }

            const bannedList = await response.json();
            const tbody = document.getElementById('banned-ips-body');

            if (!tbody) return;

            if (!bannedList || bannedList.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="px-3 md:px-4 py-8 text-center text-gray-500">차단된 IP가 없습니다.</td></tr>';
                return;
            }

            tbody.innerHTML = bannedList.map(ban => `
                <tr class="border-t border-gray-700 md:border-0">
                    <td data-label="IP 주소" class="px-3 md:px-4 py-3 font-mono text-sm break-all">${ban.ip}</td>
                    <td data-label="남은 시간" class="px-3 md:px-4 py-3 text-sm">${this.formatDuration(ban.remainingSeconds * 1000)}</td>
                    <td data-label="사유" class="px-3 md:px-4 py-3 text-sm hidden md:table-cell">${ban.reason || 'No reason'}</td>
                    <td data-label="차단 시각" class="px-3 md:px-4 py-3 text-sm hidden md:table-cell">${new Date(ban.bannedAt).toLocaleString('ko-KR')}</td>
                    <td data-label="작업" class="px-3 md:px-4 py-3 text-center">
                        <button class="unban-ip-btn bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded" data-ip="${ban.ip}">
                            차단 해제
                        </button>
                    </td>
                </tr>
            `).join('');

            // Unban button event
            document.querySelectorAll('.unban-ip-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const ip = e.currentTarget.dataset.ip;
                    await this.unbanIP(ip);
                });
            });

        } catch (error) {
            console.error('Load banned IPs error:', error);
        }
    },

    async unbanIP(ip) {
        if (!confirm(`IP ${ip}의 차단을 해제하시겠습니까?`)) {
            return;
        }

        try {
            const response = await fetch('/api/admin/unban-ip', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify({ ip })
            });

            if (!response.ok) {
                throw new Error('Failed to unban IP');
            }

            alert(`IP ${ip}의 차단이 해제되었습니다.`);
            await this.loadBannedIPs();

        } catch (error) {
            console.error('Unban IP error:', error);
            alert('IP 차단 해제 중 오류가 발생했습니다.');
        }
    },

    async showUserDetails(sessionId) {
        try {
            const response = await fetch(`/api/admin/user-details?sessionId=${encodeURIComponent(sessionId)}`, {
                headers: { 'Authorization': `Bearer ${this.sessionToken}` }
            });

            if (!response.ok) {
                throw new Error('Failed to load user details');
            }

            const userDetails = await response.json();
            const modal = document.getElementById('user-details-modal');
            const content = document.getElementById('user-details-content');

            if (!modal || !content) return;

            content.innerHTML = `
                <div class="space-y-4">
                    <div class="bg-gray-700 rounded-lg p-4">
                        <h3 class="text-sm font-semibold text-gray-400 mb-2">기본 정보</h3>
                        <div class="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <p class="text-gray-500">세션 ID</p>
                                <p class="text-gray-200 font-mono break-all">${userDetails.sessionId || 'N/A'}</p>
                            </div>
                            <div>
                                <p class="text-gray-500">닉네임</p>
                                <p class="text-gray-200">${userDetails.metadata?.nickname ? this.escapeHtml(userDetails.metadata.nickname) : '익명'}</p>
                            </div>
                            <div>
                                <p class="text-gray-500">IP 주소</p>
                                <p class="text-gray-200 font-mono break-all">${userDetails.metadata?.ip || 'N/A'}</p>
                            </div>
                            <div>
                                <p class="text-gray-500">국가</p>
                                <p class="text-gray-200">${userDetails.metadata?.environment?.country || 'N/A'}</p>
                            </div>
                            <div>
                                <p class="text-gray-500">User-Agent</p>
                                <p class="text-gray-200 text-xs break-all">${this.escapeHtml(userDetails.metadata?.environment?.userAgent || 'N/A')}</p>
                            </div>
                            <div>
                                <p class="text-gray-500">접속 시각</p>
                                <p class="text-gray-200">${userDetails.metadata?.joinTime ? new Date(userDetails.metadata.joinTime).toLocaleString('ko-KR') : 'N/A'}</p>
                            </div>
                            <div>
                                <p class="text-gray-500">상태</p>
                                <p class="text-gray-200">${userDetails.isOnline ? '<span class="text-green-400">온라인</span>' : '<span class="text-gray-400">오프라인</span>'}</p>
                            </div>
                            <div>
                                <p class="text-gray-500">메시지 수</p>
                                <p class="text-gray-200">${userDetails.messageCount || 0}</p>
                            </div>
                            <div>
                                <p class="text-gray-500">마지막 활동</p>
                                <p class="text-gray-200">${userDetails.lastMessage ? new Date(userDetails.lastMessage).toLocaleString('ko-KR') : 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-gray-700 rounded-lg p-4">
                        <h3 class="text-sm font-semibold text-gray-400 mb-2">메시지 기록 (최근 ${Math.min(userDetails.messages?.length || 0, 50)}개)</h3>
                        <div class="space-y-2 max-h-96 overflow-y-auto">
                            ${userDetails.messages && userDetails.messages.length > 0
                    ? userDetails.messages.slice(0, 50).map(msg => `
                                    <div class="bg-gray-800 rounded p-3 text-sm">
                                        <div class="flex justify-between items-start mb-1">
                                            <span class="text-xs text-gray-500">${new Date(msg.timestamp).toLocaleString('ko-KR')}</span>
                                            ${msg.editedAt ? '<span class="text-xs text-yellow-400">(수정됨)</span>' : ''}
                                        </div>
                                        <p class="text-gray-200 break-all whitespace-pre-wrap">${this.escapeHtml(msg.content)}</p>
                                        ${msg.file ? `<p class="text-xs text-blue-400 mt-1 break-all">파일: ${msg.file.filename}</p>` : ''}
                                    </div>
                                `).join('')
                    : '<p class="text-gray-500 text-center py-4">메시지가 없습니다.</p>'
                }
                        </div>
                    </div>
                </div>
            `;

            modal.classList.remove('hidden');
            showModal(modal, '#close-user-modal', document.activeElement);

        } catch (error) {
            console.error('Show user details error:', error);
            alert('사용자 정보를 불러오는 중 오류가 발생했습니다.');
        }
    },

    async loadAnnouncements() {
        try {
            const response = await fetch('/api/announcements');
            
            if (!response.ok) {
                throw new Error('Failed to load announcements');
            }
            
            const announcements = await response.json();
            this.lastAnnouncements = announcements;
            this.updateAnnouncementsList(announcements);
        } catch (error) {
            console.error('Announcements load error:', error);
            const container = document.getElementById('announcement-list');
            if (container) {
                container.innerHTML = '<p class="text-sm text-red-500 text-center py-8">공지사항을 불러오는 중 오류가 발생했습니다.</p>';
            }
        }
    },

    async editAnnouncement(timestamp) {
        const item = this.lastAnnouncements?.find(a => a.timestamp === timestamp);
        if (!item) return;

        const isEmergency = item.isEmergency || false;
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-gray-800 rounded-lg shadow-2xl p-6 max-w-lg w-full mx-4 border border-gray-700">
                <h3 class="text-lg font-bold text-gray-100 mb-4">공지사항 수정</h3>
                <textarea id="edit-announce-input" rows="5" class="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none resize-none mb-3">${item.content}</textarea>
                <label class="flex items-center gap-1.5 text-sm text-gray-300 mb-4 cursor-pointer">
                    <input type="checkbox" id="edit-emergency-checkbox" class="rounded bg-gray-700 border-gray-600 text-red-500 focus:ring-red-500" ${isEmergency ? 'checked' : ''}>
                    긴급공지
                </label>
                <div class="flex justify-end gap-2">
                    <button id="cancel-edit-btn" class="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition-colors">취소</button>
                    <button id="save-edit-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors">저장</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#cancel-edit-btn').addEventListener('click', () => modal.remove());
        modal.querySelector('#save-edit-btn').addEventListener('click', async () => {
            const newContent = modal.querySelector('#edit-announce-input').value.trim();
            if (!newContent) {
                this.showNotification('내용을 입력하세요.', 'error');
                return;
            }
            const newEmergency = modal.querySelector('#edit-emergency-checkbox').checked;
            modal.remove();

            try {
                const body = { timestamp, content: newContent, isEmergency: newEmergency };
                if (newEmergency && item.emergencyUntil) {
                    body.emergencyUntil = item.emergencyUntil;
                }
                const response = await fetch('/api/admin/announce', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.sessionToken}`
                    },
                    body: JSON.stringify(body)
                });

                if (!response.ok) throw new Error('Failed to edit announcement');
                this.showNotification('공지사항이 수정되었습니다.', 'success');
                this.refreshData();
            } catch (_error) {
                this.showNotification('공지사항 수정에 실패했습니다.', 'error');
            }
        });
    },

    async deleteAnnouncement(timestamp) {
        if (!confirm('정말 이 공지사항을 삭제하시겠습니까?')) return;

        try {
            const response = await fetch('/api/admin/announce', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify({ timestamp })
            });

            if (!response.ok) throw new Error('Failed to delete announcement');
            this.showNotification('공지사항이 삭제되었습니다.', 'success');
            this.refreshData();
        } catch (_error) {
            this.showNotification('공지사항 삭제에 실패했습니다.', 'error');
        }
    },

    async demoteAnnouncement(timestamp) {
        if (!this.sessionToken) { alert('관리자 인증이 필요합니다.'); return; }
        if (!confirm('긴급 공지를 일반 공지로 전환하시겠습니까?\n\n전환 시 사용자에게 긴급 해제 알림이 전송됩니다.')) return;

        try {
            const response = await fetch('/api/admin/announce', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify({ timestamp, isEmergency: false, emergencyUntil: null })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => null);
                console.error('Demote announce failed', err);
                alert('공지 전환에 실패했습니다.');
                return;
            }
            alert('긴급 공지가 일반 공지로 전환되었습니다.');
            this.refreshData();
        } catch (error) {
            console.error('demoteAnnouncement error:', error);
            alert('공지 전환 중 오류가 발생했습니다.');
        }
    },

    async loadAuditLogs() {
        try {
            const response = await fetch('/api/admin/audit-logs', {
                headers: { 'Authorization': `Bearer ${this.sessionToken}` }
            });

            if (!response.ok) {
                throw new Error('Failed to load audit logs');
            }

            const logs = await response.json();
            const container = document.getElementById('audit-logs-list');
            const filterSelect = document.getElementById('audit-log-filter');

            if (!container) return;

            const selectedFilter = filterSelect?.value || 'all';
            const filteredLogs = selectedFilter === 'all'
                ? logs
                : logs.filter(log => {
                    if (selectedFilter === 'delete_message') {
                        return log.action === 'delete_message' || log.action === 'admin_delete_message';
                    }
                    return log.action === selectedFilter;
                });

            if (!filteredLogs || filteredLogs.length === 0) {
                container.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">감사 로그가 없습니다.</p>';
                return;
            }

            container.innerHTML = filteredLogs.map(log => {
                const actionText = {
                    'kick_user': '유저 강퇴',
                    'edit_message': '메시지 수정',
                    'delete_message': '메시지 삭제',
                    'admin_delete_message': '메시지 삭제',
                    'admin_delete_all_messages': '전체 메시지 삭제',
                    'send_announcement': '공지 전송',
                    'edit_announcement': '공지사항 수정',
                    'delete_announcement': '공지사항 삭제',
                    'UNBAN_IP': 'IP 차단 해제'
                }[log.action] || log.action;

                const actionColor = {
                    'kick_user': 'text-red-400',
                    'edit_message': 'text-yellow-400',
                    'delete_message': 'text-orange-400',
                    'admin_delete_message': 'text-orange-400',
                    'admin_delete_all_messages': 'text-red-500',
                    'send_announcement': 'text-blue-400',
                    'edit_announcement': 'text-blue-400',
                    'delete_announcement': 'text-red-400',
                    'UNBAN_IP': 'text-green-400'
                }[log.action] || 'text-gray-400';

                return `
                    <div class="bg-gray-700 rounded-lg p-3">
                        <div class="flex justify-between items-start mb-1">
                            <span class="text-sm font-medium ${actionColor}">${actionText}</span>
                            <span class="text-xs text-gray-500">${new Date(log.timestamp).toLocaleString('ko-KR')}</span>
                        </div>
                        <p class="text-sm text-gray-300 break-all">${log.details}</p>
                        ${log.metadata ? `<p class="text-xs text-gray-500 mt-1 break-all overflow-x-auto">${JSON.stringify(log.metadata)}</p>` : ''}
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('Load audit logs error:', error);
        }
    },

    async clearAuditLogs() {
        const confirmed = confirm('모든 감사 로그를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.');
        if (!confirmed) return;

        try {
            const response = await fetch('/api/admin/delete-audit-logs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                }
            });

            if (!response.ok) throw new Error('Failed to delete audit logs');
            this.showNotification('감사 로그가 삭제되었습니다.', 'success');
            this.loadAuditLogs();
        } catch (error) {
            console.error('Clear audit logs error:', error);
            this.showNotification('감사 로그 삭제에 실패했습니다.', 'error');
        }
    },

    async loadAdminLogs() {
        try {
            const response = await fetch('/api/admin/logs', {
                headers: { 'Authorization': `Bearer ${this.sessionToken}` }
            });

            if (!response.ok) {
                throw new Error('Failed to load admin logs');
            }

            const data = await response.json();
            const logs = (data.logs || []).filter(log =>
                ['login_success', 'login_failed', 'login_blocked', 'logout'].includes(log.type)
            );
            const container = document.getElementById('admin-login-logs');

            if (!container) return;

            if (logs.length === 0) {
                container.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">관리자 로그인 기록이 없습니다.</p>';
                return;
            }

            container.innerHTML = logs.map(log => {
                const typeBadge = {
                    'login_success': 'bg-green-900/50 text-green-400 border border-green-700',
                    'login_failed': 'bg-red-900/50 text-red-400 border border-red-700',
                    'login_blocked': 'bg-orange-900/50 text-orange-400 border border-orange-700',
                    'logout': 'bg-gray-700 text-gray-300 border border-gray-600'
                }[log.type] || 'bg-gray-700 text-gray-300';

                const typeText = {
                    'login_success': '로그인 성공',
                    'login_failed': '로그인 실패',
                    'login_blocked': '로그인 차단',
                    'logout': '로그아웃'
                }[log.type] || log.type;

                return `
                    <div class="bg-gray-700 rounded-lg p-3">
                        <div class="flex justify-between items-start mb-1">
                            <span class="text-sm font-medium"><span class="px-2 py-0.5 rounded text-xs font-bold ${typeBadge}">${typeText}</span></span>
                            <span class="text-xs text-gray-500">${new Date(log.timestamp).toLocaleString('ko-KR')}</span>
                        </div>
                        <p class="text-sm text-gray-300 break-all">IP: ${this.escapeHtml(log.ip || 'N/A')}</p>
                        ${log.details ? `<p class="text-xs text-gray-400 mt-1">${this.escapeHtml(log.details)}</p>` : ''}
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('Load admin logs error:', error);
        }
    },

    async deleteAdminLogs() {
        if (!this.sessionToken) {
            alert('관리자 인증이 필요합니다.');
            return;
        }

        if (!confirm('모든 관리자 로그인 기록을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
            return;
        }

        try {
            const response = await fetch('/api/admin/delete-logs', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.sessionToken}` }
            });

            if (!response.ok) throw new Error('Failed to delete admin logs');

            const result = await response.json();
            this.showNotification(`로그인 기록 ${result.deletedCount}건이 삭제되었습니다.`, 'success');
            this.loadAdminLogs();
        } catch (error) {
            console.error('Delete admin logs error:', error);
            this.showNotification('로그인 기록 삭제에 실패했습니다.', 'error');
        }
    },

    downloadErrorLogs() {
        if (!this.lastMetrics || !this.lastMetrics.errorLogs || this.lastMetrics.errorLogs.length === 0) {
            this.showNotification('다운로드할 오류 로그가 없습니다.', 'error');
            return;
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `error_logs_${timestamp}.json`;
        const jsonStr = JSON.stringify(this.lastMetrics.errorLogs, null, 2);
        
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    },

    async deleteErrorLogs() {
        if (!this.lastMetrics || !this.lastMetrics.errorLogs || this.lastMetrics.errorLogs.length === 0) {
            this.showNotification('삭제할 오류 로그가 없습니다.', 'error');
            return;
        }

        if (!confirm('경고: 모든 오류 로그 데이터가 서버에서 영구적으로 삭제됩니다. 계속하시겠습니까?')) {
            return;
        }

        try {
            const response = await fetch('/api/admin/delete-error-logs', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.sessionToken}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete error logs');
            }

            this.showNotification('모든 오류 로그가 성공적으로 삭제되었습니다.', 'success');
            
            // 데이터 새로고침
            this.refreshData();
        } catch (error) {
            console.error('Error deleting logs:', error);
            this.showNotification('오류 로그 삭제 중 문제가 발생했습니다.', 'error');
        }
    },

    async exportAuditLogCsv() {
        if (!this.sessionToken) {
            alert('관리자 인증이 필요합니다.');
            return;
        }

        try {
            const response = await fetch('/api/admin/audit-logs', {
                headers: { 'Authorization': `Bearer ${this.sessionToken}` }
            });

            if (!response.ok) {
                throw new Error('Failed to load audit logs');
            }

            const logs = await response.json();
            const filterSelect = document.getElementById('audit-log-filter');
            const selectedFilter = filterSelect?.value || 'all';

            let filteredLogs = logs;
            if (selectedFilter !== 'all') {
                filteredLogs = logs.filter(log => {
                    if (selectedFilter === 'delete_message') {
                        return log.action === 'delete_message' || log.action === 'admin_delete_message';
                    }
                    return log.action === selectedFilter;
                });
            }

            if (!filteredLogs || filteredLogs.length === 0) {
                this.showNotification('내보낼 감사 로그가 없습니다.', 'error');
                return;
            }

            const headers = ['timestamp', 'action', 'details', 'metadata'];
            const escape = (value) => {
                if (value == null) return '';
                const str = String(value);
                return '"' + str.replace(/"/g, '""') + '"';
            };

            const rows = filteredLogs.map(log => [
                new Date(log.timestamp).toISOString(),
                log.action,
                log.details || '',
                log.metadata ? JSON.stringify(log.metadata) : ''
            ]);

            const csvContent = [headers.map(h => escape(h)).join(',')]
                .concat(rows.map(r => r.map(cell => escape(cell)).join(',')))
                .join('\n');

            const bom = '\uFEFF';
            const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `audit_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Export audit CSV error:', error);
            this.showNotification('CSV 내보내기 중 오류가 발생했습니다.', 'error');
        }
    },

    async loadChannels() {
        try {
            const resp = await fetch('/api/admin/channels', {
                headers: { 'Authorization': `Bearer ${this.sessionToken}` }
            });
            if (!resp.ok) throw new Error('Failed to load channels');
            const data = await resp.json();
            this.renderChannels(data.channels || []);
        } catch (error) {
            console.error('loadChannels error:', error);
            const tbody = document.getElementById('channels-list');
            if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-red-400">채널 목록을 불러오지 못했습니다.</td></tr>';
        }
    },

    async loadChannelStats(slug) {
        try {
            const resp = await fetch(`/api/admin/channel-details?slug=${encodeURIComponent(slug)}`, {
                headers: { 'Authorization': `Bearer ${this.sessionToken}` }
            });
            if (!resp.ok) return;
            const data = await resp.json();
            const usersEl = document.querySelector(`.channel-users[data-slug="${CSS.escape(slug)}"]`);
            const msgsEl = document.querySelector(`.channel-messages[data-slug="${CSS.escape(slug)}"]`);
            if (usersEl) usersEl.textContent = data.activeConnections ?? '-';
            if (msgsEl) msgsEl.textContent = data.totalMessages ?? '-';
        } catch (e) {
            console.warn('loadChannelStats error:', e);
        }
    },

    async viewChannelDetail(slug, name) {
        try {
            const resp = await fetch(`/api/admin/channel-details?slug=${encodeURIComponent(slug)}`, {
                headers: { 'Authorization': `Bearer ${this.sessionToken}` }
            });
            if (!resp.ok) throw new Error('Failed to load channel details');
            const data = await resp.json();

            const title = document.getElementById('channel-detail-title');
            const content = document.getElementById('channel-detail-content');
            if (title) title.textContent = `채널 상세: ${escapeHtml(name)}`;

            const sessions = data.sessions || [];
            const messages = data.messages || [];

            content.innerHTML = `
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div class="bg-gray-700/50 rounded-lg p-3">
                        <div class="text-xs text-gray-400">접속자</div>
                        <div class="text-xl font-bold text-white">${data.activeConnections || 0}</div>
                    </div>
                    <div class="bg-gray-700/50 rounded-lg p-3">
                        <div class="text-xs text-gray-400">총 메시지</div>
                        <div class="text-xl font-bold text-white">${data.totalMessages || 0}</div>
                    </div>
                    <div class="bg-gray-700/50 rounded-lg p-3">
                        <div class="text-xs text-gray-400">총 연결</div>
                        <div class="text-xl font-bold text-white">${data.totalConnections || 0}</div>
                    </div>
                    <div class="bg-gray-700/50 rounded-lg p-3">
                        <div class="text-xs text-gray-400">오류</div>
                        <div class="text-xl font-bold text-white">${data.errors || 0}</div>
                    </div>
                </div>
                <div>
                    <h4 class="text-sm font-semibold text-gray-200 mb-2">접속 중인 사용자 (${sessions.filter(s => s.isOnline).length})</h4>
                    <div class="overflow-x-auto">
                        <table class="w-full text-xs text-left">
                            <thead class="text-gray-400 bg-gray-700/50"><tr><th class="px-2 py-1">닉네임</th><th class="px-2 py-1">IP</th><th class="px-2 py-1">국가</th><th class="px-2 py-1">메시지</th><th class="px-2 py-1">상태</th></tr></thead>
                            <tbody class="divide-y divide-gray-700">
                                ${sessions.length ? sessions.map(s => `
                                    <tr class="${s.isOnline ? 'text-gray-200' : 'text-gray-500'}">
                                        <td class="px-2 py-1">${escapeHtml(s.nickname)}</td>
                                        <td class="px-2 py-1 font-mono">${escapeHtml(s.ip)}</td>
                                        <td class="px-2 py-1">${escapeHtml(s.country)}</td>
                                        <td class="px-2 py-1">${s.messageCount || 0}</td>
                                        <td class="px-2 py-1">${s.isOnline ? '<span class="text-green-400">온라인</span>' : '<span class="text-gray-500">오프라인</span>'}</td>
                                    </tr>
                                `).join('') : '<tr><td colspan="5" class="px-2 py-4 text-center text-gray-500">사용자 정보가 없습니다.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div>
                    <h4 class="text-sm font-semibold text-gray-200 mb-2">최근 메시지 (${messages.length})</h4>
                    <div class="space-y-1 max-h-64 overflow-y-auto bg-gray-900/50 rounded-lg p-2">
                        ${messages.length ? messages.map(m => `
                            <div class="text-xs text-gray-300 border-b border-gray-700/50 pb-1">
                                <span class="text-gray-500">[${new Date(m.timestamp).toLocaleTimeString('ko-KR')}]</span>
                                <span class="text-emerald-400">${escapeHtml(m.nickname || '익명')}</span>:
                                <span>${escapeHtml(m.content?.substring(0, 100) || '(파일)')}${m.content?.length > 100 ? '...' : ''}</span>
                            </div>
                        `).join('') : '<div class="text-xs text-gray-500 text-center py-4">메시지가 없습니다.</div>'}
                    </div>
                </div>
            `;

            const channelDetailModal = document.getElementById('channel-detail-modal');
            channelDetailModal?.classList.remove('hidden');
            if (channelDetailModal) this._channelModalHide = showModal(channelDetailModal, '#close-channel-detail', document.activeElement);
        } catch (error) {
            console.error('viewChannelDetail error:', error);
            this.showNotification('채널 상세 정보를 불러오지 못했습니다.', 'error');
        }
    },

    hideChannelDetail() {
        const modal = document.getElementById('channel-detail-modal');
        if (this._channelModalHide) { this._channelModalHide(); this._channelModalHide = null; }
        modal?.classList.add('hidden');
    },

    async deleteChannel(slug, name) {
        if (!confirm(`채널 "${name}"을(를) 강제 삭제하시겠습니까?\n모든 메시지와 사용자 데이터가 영구 삭제됩니다.`)) return;
        try {
            const resp = await fetch('/api/admin/channel-delete', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.sessionToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ slug })
            });
            if (!resp.ok) throw new Error('Failed to delete channel');
            this.showNotification(`채널 "${name}"이(가) 삭제되었습니다.`, 'success');
            this.loadChannels();
        } catch (error) {
            console.error('deleteChannel error:', error);
            this.showNotification('채널 삭제에 실패했습니다.', 'error');
        }
    },

    createBanModal(sessionId, userIp) {
        // Detect shared IP: count how many active sessions share this IP
        const sessionRows = document.querySelectorAll('.session-row');
        let sameIpCount = 0;
        sessionRows.forEach(row => {
            const btn = row.querySelector('.kick-user-btn');
            if (btn && btn.dataset.userIp === userIp) {
                sameIpCount++;
            }
        });
        const isSharedIP = sameIpCount > 1;

        const sharedIpWarning = isSharedIP ? `
            <div class="mb-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
                <p class="text-yellow-400 text-sm font-semibold">⚠️ 공유 IP 감지 (${sameIpCount}명 접속 중)</p>
                <p class="text-yellow-500 text-xs mt-1">같은 IP를 사용하는 다른 사용자가 있습니다. 차단 시 해당 세션만 차단되며, 같은 IP의 다른 사용자는 영향을 받지 않습니다.</p>
            </div>
        ` : '';

        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-gray-800 rounded-lg shadow-2xl p-6 max-w-md w-full mx-4 border border-gray-700">
                <h3 class="text-xl font-bold text-gray-100 mb-4">사용자 강제퇴장</h3>
                <div class="mb-4 text-sm text-gray-400">
                    <p>세션 ID: <span class="text-gray-200">${this.truncateId(sessionId)}</span></p>
                    <p>IP 주소: <span class="text-gray-200">${userIp}</span></p>
                </div>
                ${sharedIpWarning}
                <p class="text-sm text-gray-300 mb-4">차단 시간을 선택하세요:</p>
                <div class="grid grid-cols-2 gap-3 mb-6">
                    <button class="ban-option-btn bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-3 px-4 rounded-lg transition-colors" data-duration="0">
                        즉시 퇴장
                        <span class="block text-xs opacity-80">재접속 가능</span>
                    </button>
                    <button class="ban-option-btn bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 px-4 rounded-lg transition-colors" data-duration="30">
                        30초 차단
                        <span class="block text-xs opacity-80">${isSharedIP ? '세션만 차단' : '임시 차단'}</span>
                    </button>
                    <button class="ban-option-btn bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors" data-duration="300">
                        5분 차단
                        <span class="block text-xs opacity-80">${isSharedIP ? '세션만 차단' : '단기 차단'}</span>
                    </button>
                    <button class="ban-option-btn bg-red-700 hover:bg-red-800 text-white font-medium py-3 px-4 rounded-lg transition-colors" data-duration="600">
                        10분 차단
                        <span class="block text-xs opacity-80">${isSharedIP ? '세션만 차단' : '장기 차단'}</span>
                    </button>
                </div>
                <button class="cancel-btn w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 rounded-lg transition-colors">
                    취소
                </button>
            </div>
        `;

        // 차단 옵션 버튼 이벤트
        modal.querySelectorAll('.ban-option-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const banDuration = parseInt(btn.dataset.duration);
                modal.remove();
                await this.kickUser(sessionId, banDuration);
            });
        });

        // 취소 버튼 이벤트
        modal.querySelector('.cancel-btn').addEventListener('click', () => {
            modal.remove();
        });

        // 모달 배경 클릭시 닫기
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        return modal;
    },

    filterAnnouncements(query) {
        if (!this.lastAnnouncements) return;
        if (!query) {
            this.updateAnnouncementsList(this.lastAnnouncements);
            return;
        }
        const filtered = this.lastAnnouncements.filter(acc => {
            const content = acc.content.toLowerCase();
            const timeStr = new Date(acc.timestamp).toLocaleString('ko-KR').toLowerCase();
            return content.includes(query) || timeStr.includes(query);
        });
        this.updateAnnouncementsList(filtered);
    }
};

export default dataMethods;
