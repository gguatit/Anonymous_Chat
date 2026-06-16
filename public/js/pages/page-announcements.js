import ApiClient from '../api-client.js';
import * as ui from '../admin-ui.js';

function debounce(fn, delay) {
    let timer;
    return function (...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), delay); };
}

export async function init(core) {
    document.getElementById('announce-preview-btn')?.addEventListener('click', () => {
        const content = document.getElementById('admin-announce-input')?.value || '';
        const p = document.getElementById('announce-preview'), pc = document.getElementById('announce-preview-content');
        if (p && pc) { pc.textContent = content; p.style.display = content ? 'block' : 'none'; }
    });
    const input = document.getElementById('admin-announce-input');
    input?.addEventListener('input', () => { const cc = document.getElementById('announce-char-count'); if (cc) cc.textContent = `${input.value.length}/7500`; });
    document.getElementById('admin-announce-btn')?.addEventListener('click', async () => {
        const content = input?.value?.trim();
        if (!content) return;
        try {
            const emergency = document.getElementById('emergency-checkbox')?.checked;
            const schedule = document.getElementById('schedule-checkbox')?.checked;
            const expires = document.getElementById('announce-expiry-select')?.value || '0';
            const expiresInt = parseInt(expires);
            const scheduleAt = schedule ? (document.getElementById('schedule-datetime')?.value || null) : null;
            const emergencyUntil = emergency && expiresInt > 0 ? Date.now() + expiresInt : null;
            const expiresAt = !emergency && expiresInt > 0 ? Date.now() + expiresInt : null;
            await ApiClient.post('/api/admin/announce', {
                content, emergency,
                scheduleAt: scheduleAt ? new Date(scheduleAt).getTime() : null,
                expiresAt,
                emergencyUntil,
            });
            input.value = '';
            core.showNotification('공지사항 전송 완료', 'success');
            await refresh(core);
        } catch { core.showNotification('공지 전송 실패', 'error'); }
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

async function loadAnnouncements() {
    try {
        const search = (document.getElementById('announce-search')?.value || '').toLowerCase();
        const data = await ApiClient.get('/api/announcements');
        const list = Array.isArray(data) ? data : (data.announcements || []);
        const filtered = search ? list.filter(a =>
            (a.content || '').toLowerCase().includes(search) ||
            (a.timestamp ? new Date(a.timestamp).toLocaleString('ko-KR') : '').includes(search)
        ) : list;
        ui.renderAnnouncements(filtered);
    } catch (_e) { /* ignore */ }
}

export async function refresh(core) {
    await loadAnnouncements();
    core.updateLastUpdated();
}

export function handleEvent(core, _action, _payload) {
    refresh(core);
}
