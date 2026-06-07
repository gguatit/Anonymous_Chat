// Admin Dashboard - User Management Methods
import { showModal } from './admin-utils.js';

const userMethods = {
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

    createBanModal(sessionId, userIp) {
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

        modal.querySelectorAll('.ban-option-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const banDuration = parseInt(btn.dataset.duration);
                modal.remove();
                await this.kickUser(sessionId, banDuration);
            });
        });

        modal.querySelector('.cancel-btn').addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        return modal;
    },
};

export default userMethods;
