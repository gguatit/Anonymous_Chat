import ApiClient from '../api-client.js';
import * as ui from '../admin-ui.js';

export async function init(core) {
    const input = document.getElementById('admin-message-input');
    const sendBtn = document.getElementById('admin-send-btn');
    const deleteAllBtn = document.getElementById('delete-all-messages-btn');

    sendBtn?.addEventListener('click', async () => {
        const content = input?.value?.trim();
        if (!content) return;
        try {
            await ApiClient.post('/api/admin/broadcast', { type: 'broadcast', content, isAdmin: true, timestamp: Date.now() });
            input.value = '';
            await refresh(core);
            core.showNotification('메시지 전송 완료', 'success');
        } catch { core.showNotification('전송 실패', 'error'); }
    });
    input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn?.click(); }
    });
    deleteAllBtn?.addEventListener('click', async () => {
        if (!confirm('전체 메시지를 삭제하시겠습니까?')) return;
        try { await ApiClient.post('/api/admin/delete-all-messages', { confirmation: 'DELETE_ALL_MESSAGES' }); core.showNotification('삭제 완료', 'success'); await refresh(core); }
        catch { core.showNotification('삭제 실패', 'error'); }
    });

    await refresh(core);
}

export async function refresh(core) {
    try {
        const data = await ApiClient.get('/api/admin/messages?limit=50');
        const msgs = Array.isArray(data) ? data : (data.messages || []);
        ui.renderRecentMessages(msgs);
    } catch (_e) { /* ignore */ }
    core.updateLastUpdated();
}
