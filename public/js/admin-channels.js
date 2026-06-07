// Admin Dashboard - Channel Management Methods
import { escapeHtml } from './utils.js';
import { showModal } from './admin-utils.js';

const channelMethods = {
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
            if (channelDetailModal) {
                this._channelModalHide = showModal(channelDetailModal, '#close-channel-detail', document.activeElement);
            }
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
};

export default channelMethods;
