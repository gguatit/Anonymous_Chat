import ApiClient from '../api-client.js';
import * as ui from '../admin-ui.js';

function debounce(fn, delay) {
    let timer;
    return function (...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), delay); };
}

export async function init(core) {
    window._deleteAnnouncement = async (timestamp) => {
        if (!Number.isFinite(timestamp)) return;
        if (!confirm('이 공지사항을 삭제할까요?')) return;
        try {
            const res = await ApiClient.del('/api/admin/announce', { timestamp });
            if (res && res.success === false) throw new Error(res.error || 'delete failed');
            core.showNotification('공지사항 삭제 완료', 'success');
            await refresh(core);
        } catch (error) {
            console.error('Failed to delete announcement:', error);
            core.showNotification('공지 삭제 실패', 'error');
        }
    };
    window._editAnnouncement = async (timestamp, content) => {
        if (!Number.isFinite(timestamp)) return;
        const next = prompt('공지사항 내용 수정', content || '');
        if (next === null) return;
        const trimmed = next.trim();
        if (!trimmed) return;
        try {
            await ApiClient.put('/api/admin/announce', { timestamp, content: trimmed });
            core.showNotification('공지사항 수정 완료', 'success');
            await refresh(core);
        } catch (error) {
            console.error('Failed to edit announcement:', error);
            core.showNotification('공지 수정 실패', 'error');
        }
    };
    window._toggleAnnouncePin = async (timestamp, pinned) => {
        if (!Number.isFinite(timestamp)) return;
        try {
            await ApiClient.put('/api/admin/announce', { timestamp, pinned });
            core.showNotification(pinned ? '공지 고정 완료' : '공지 고정 해제', 'success');
            await refresh(core);
        } catch (error) {
            console.error('Failed to toggle announcement pin:', error);
            core.showNotification('고정 상태 변경 실패', 'error');
        }
    };
    document.getElementById('announce-preview-btn')?.addEventListener('click', () => {
        const content = document.getElementById('admin-announce-input')?.value || '';
        const p = document.getElementById('announce-preview'), pc = document.getElementById('announce-preview-content');
        if (p && pc) { pc.textContent = content; p.style.display = content ? 'block' : 'none'; }
    });
    const input = document.getElementById('admin-announce-input');
    const autoResizeInput = () => {
        if (!input) return;
        input.style.height = 'auto';
        const maxH = 200;
        const scrollH = input.scrollHeight;
        input.style.height = Math.min(scrollH, maxH) + 'px';
        input.style.overflowY = scrollH > maxH ? 'auto' : 'hidden';
    };
    input?.addEventListener('input', () => { const cc = document.getElementById('announce-char-count'); if (cc) cc.textContent = `${input.value.length}/7500`; autoResizeInput(); });
    document.getElementById('admin-announce-btn')?.addEventListener('click', async () => {
        const content = input?.value?.trim();
        if (!content) return;
        try {
            const type = document.querySelector('input[name="announce-type"]:checked')?.value || 'normal';
            const emergency = type === 'emergency';
            const important = type === 'important';
            const emergencyDuration = parseInt(document.getElementById('emergency-duration')?.value || '0', 10);
            const importantDuration = parseInt(document.getElementById('important-duration')?.value || '0', 10);
            const schedule = document.getElementById('schedule-checkbox')?.checked;
            const scheduleAt = schedule ? (document.getElementById('schedule-datetime')?.value || null) : null;
            // Announcements persist until manual deletion; the emergency/important banner can auto-clear after the chosen duration
            await ApiClient.post('/api/admin/announce', {
                content,
                isEmergency: emergency,
                isImportant: important,
                emergencyUntil: emergency && emergencyDuration > 0 ? Date.now() + emergencyDuration : null,
                importantUntil: important && importantDuration > 0 ? Date.now() + importantDuration : null,
                scheduleAt: scheduleAt ? new Date(scheduleAt).getTime() : null,
            });
            input.value = ''; input.dispatchEvent(new Event('input'));
            core.showNotification('공지사항 전송 완료', 'success');
            await refresh(core);
        } catch { core.showNotification('공지 전송 실패', 'error'); }
    });
    document.getElementById('schedule-checkbox')?.addEventListener('change', (e) => {
        const dt = document.getElementById('schedule-datetime');
        if (dt) dt.classList.toggle('hidden', !e.target.checked);
    });
    document.querySelectorAll('input[name="announce-type"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            const type = document.querySelector('input[name="announce-type"]:checked')?.value || 'normal';
            const dur = document.getElementById('emergency-duration');
            if (dur) dur.classList.toggle('hidden', type !== 'emergency');
            const importantDur = document.getElementById('important-duration');
            if (importantDur) importantDur.classList.toggle('hidden', type !== 'important');
        });
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
