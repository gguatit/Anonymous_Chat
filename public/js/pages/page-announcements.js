import ApiClient from '../api-client.js';
import renderMethods from '../admin-render.js';

export async function init(core) {
    document.getElementById('announce-preview-btn')?.addEventListener('click', () => {
        const content = document.getElementById('admin-announce-input')?.value || '';
        const preview = document.getElementById('announce-preview');
        const previewContent = document.getElementById('announce-preview-content');
        if (preview && previewContent) {
            previewContent.textContent = content;
            preview.style.display = content ? 'block' : 'none';
        }
    });
    const input = document.getElementById('admin-announce-input');
    input?.addEventListener('input', () => {
        const cc = document.getElementById('announce-char-count');
        if (cc) cc.textContent = `${input.value.length}/7500`;
    });
    document.getElementById('admin-announce-btn')?.addEventListener('click', async () => {
        const content = input?.value?.trim();
        if (!content) return;
        const emergency = document.getElementById('emergency-checkbox')?.checked;
        const schedule = document.getElementById('schedule-checkbox')?.checked;
        const expires = document.getElementById('announce-expiry-select')?.value || '0';
        let scheduledAt = null;
        if (schedule) {
            scheduledAt = document.getElementById('schedule-datetime')?.value || null;
        }
        try {
            await ApiClient.post('/api/admin/announcements', {
                content,
                emergency,
                scheduledAt,
                expiresIn: parseInt(expires),
            });
            input.value = '';
            core.showNotification('공지사항 전송 완료', 'success');
            await refresh(core);
        } catch (_e) { core.showNotification('공지 전송 실패', 'error'); }
    });
    document.getElementById('emergency-checkbox')?.addEventListener('change', (e) => {
        const dur = document.getElementById('emergency-duration');
        if (dur) dur.classList.toggle('hidden', !e.target.checked);
    });
    document.getElementById('schedule-checkbox')?.addEventListener('change', (e) => {
        const dt = document.getElementById('schedule-datetime');
        if (dt) dt.classList.toggle('hidden', !e.target.checked);
    });
    document.getElementById('announce-search')?.addEventListener('input', debounce(() => loadAnnouncements(), 300));

    await refresh(core);
}

function debounce(fn, delay) {
    let timer;
    return function (...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), delay); };
}

async function loadAnnouncements() {
    try {
        const search = document.getElementById('announce-search')?.value || '';
        const res = await ApiClient.get(`/api/admin/announcements?search=${encodeURIComponent(search)}`);
        const data = await res.json();
        renderMethods.renderAnnouncements(data.announcements || []);
    } catch (_e) { /* ignore */ }
}

export async function refresh(core) {
    await loadAnnouncements();
    core.updateLastUpdated();
}
