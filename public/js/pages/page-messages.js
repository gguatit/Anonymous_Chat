import ApiClient from '../api-client.js';
import * as ui from '../admin-ui.js';

export async function init(core) {
    const input = document.getElementById('admin-message-input');
    const sendBtn = document.getElementById('admin-send-btn');
    const deleteAllBtn = document.getElementById('delete-all-messages-btn');
    const fileInput = document.getElementById('admin-message-file');

    window._adminEditMessage = async (messageId, content) => {
        if (!messageId) return;
        const next = prompt('메시지 수정', content || '');
        if (next === null) return;
        const newContent = next.trim();
        if (!newContent) return;
        try {
            await ApiClient.post('/api/admin/edit-message', { messageId, newContent });
            core.showNotification('메시지 수정 완료', 'success');
            await refresh(core);
        } catch (error) {
            console.error('Failed to edit message:', error);
            core.showNotification('메시지 수정 실패', 'error');
        }
    };

    sendBtn?.addEventListener('click', async () => {
        const content = input?.value?.trim();
        const file = fileInput?.files?.[0];
        if (!content && !file) return;
        try {
            let filePayload = null;
            if (file) {
                const form = new FormData();
                form.append('file', file);
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${ApiClient.getToken() || ''}` },
                    body: form
                });
                if (!res.ok) throw new Error('upload failed');
                const data = await res.json();
                filePayload = { url: data.full_url, filename: data.filename, filesize: data.filesize, filetype: data.filetype };
            }
            await ApiClient.post('/api/admin/broadcast', { content, file: filePayload || undefined });
            if (input) input.value = '';
            if (fileInput) fileInput.value = '';
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

export function handleEvent(core, action, payload) {
    if (action === 'message_deleted') {
        const el = document.querySelector(`[data-msg-id="${payload?.messageId}"]`);
        if (el) {
            el.style.transition = 'opacity 0.2s, transform 0.2s';
            el.style.opacity = '0';
            el.style.transform = 'scale(0.95)';
            setTimeout(() => { if (el.parentNode) el.remove(); }, 200);
        }
    } else {
        refresh(core);
    }
}
