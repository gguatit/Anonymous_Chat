import ApiClient from './api-client.js';

const PAGES = [
    { id: 'main', label: '대시보드', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>' },
    { id: 'users', label: '사용자', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
    { id: 'messages', label: '메시지', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' },
    { id: 'announcements', label: '공지사항', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5.882V19.24a1.76 1.76 0 0 1-3.417.592l-2.147-6.15M18 13a3 3 0 1 0 0-6M5.436 13.683A4.001 4.001 0 0 1 7 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 0 1-1.564-.317z"/></svg>' },
    { id: 'channels', label: '채널', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16"/><path d="M6 16l6-12 6 12"/></svg>' },
    { id: 'bans', label: '차단', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>' },
    { id: 'logs', label: '로그', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' },
    { id: 'security', label: '보안', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' },
];

class AdminCore {
    constructor() {
        this.sessionToken = localStorage.getItem('admin_token');
        if (this.sessionToken) { ApiClient.setToken(this.sessionToken); }
        this.autoRefreshInterval = null;
        this.pageModules = {};
        this.initPromise = null;
        this._toggleSetupDone = false;
        this._navListenerBound = false;
        this._helpersSetup = false;
        this.observerWs = null;
        this._userJoinThrottle = new Map();
    }

    getToken() { return this.sessionToken; }

    setToken(token) {
        this.sessionToken = token;
        if (token) { localStorage.setItem('admin_token', token); ApiClient.setToken(token); }
        else { localStorage.removeItem('admin_token'); ApiClient.setToken(null); }
    }

    async init() {
        if (this.initPromise) return this.initPromise;
        this.initPromise = (async () => {
            this.loginScreen = document.getElementById('login-screen');
            this.dashboard = document.getElementById('admin-dashboard');

            const loginForm = document.getElementById('login-form');
            if (!loginForm) return;
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));

            const mb = document.getElementById('mobile-menu-btn');
            const nav = document.getElementById('nav-sidebar');
            mb?.addEventListener('click', () => nav?.classList.toggle('open'));

            // Auto-refresh interval change handler
            document.getElementById('auto-refresh-interval')?.addEventListener('change', () => {
                this.startAutoRefresh();
            });

            // Hash-based routing
            window.addEventListener('hashchange', () => this._onHashChange());

            this._setupGlobalHelpers();

            if (!this.sessionToken) {
                this.loginScreen.style.display = 'flex';
                this.dashboard.style.display = 'none';
                return;
            }

            try {
                const data = await ApiClient.post('/api/admin/verify');
                if (!data || !data.valid) throw new Error('Token invalid');
                this.showDashboard();
                this.renderNav();
                this.startAutoRefresh();
                this.connectObserver();
                this._onHashChange();
            } catch (_e) {
                this.setToken(null);
                this.loginScreen.style.display = 'flex';
                this.dashboard.style.display = 'none';
            }
        })();
        return this.initPromise;
    }

    _currentHash() {
        return location.hash.replace(/^#/, '') || 'main';
    }

    _validPage(id) {
        return PAGES.some(p => p.id === id);
    }

    _onHashChange() {
        const pageId = this._currentHash();
        if (!this._validPage(pageId)) {
            location.replace('#main');
            return;
        }
        this._switchPage(pageId);
    }

    async _switchPage(pageId) {
        this.currentPage = pageId;
        this.updateNavActive(pageId);
        document.querySelectorAll('[data-page]').forEach(el => {
            el.style.display = el.dataset.page === pageId ? '' : 'none';
        });
        document.getElementById('nav-sidebar')?.classList.remove('open');

        if (!this.pageModules[pageId]) {
            const importer = PAGE_IMPORTERS[pageId];
            if (importer) {
                try {
                    const mod = await importer();
                    this.pageModules[pageId] = mod;
                    if (mod?.init) await mod.init(this);
                } catch (err) {
                    console.error('Failed to load page:', pageId, err);
                    return;
                }
            }
        } else {
            const mod = this.pageModules[pageId];
            if (mod?.refresh) await mod.refresh(this);
        }
    }

    navigateTo(pageId) {
        if (!this._validPage(pageId)) return;
        if (location.hash === '#' + pageId) return;
        location.hash = '#' + pageId;
    }

    async handleLogin(e) {
        e.preventDefault();
        const id = document.getElementById('admin-id')?.value || '';
        const password = document.getElementById('admin-password')?.value || '';
        const errorEl = document.getElementById('login-error');
        try {
            const data = await ApiClient.post('/api/admin/login', { id, password });
            if (data && data.success && data.token) {
                this.setToken(data.token);
                this.loginScreen.style.display = 'none';
                this.dashboard.style.display = '';
                this.renderNav();
                this.startAutoRefresh();
                const hash = this._currentHash();
                if (!hash || !this._validPage(hash)) {
                    location.replace('#main');
                }
                this._switchPage(this._currentHash());
            } else {
                errorEl.textContent = data?.error || '로그인 실패';
                errorEl.style.display = 'block';
            }
        } catch (_err) {
            errorEl.textContent = '서버 연결 실패';
            errorEl.style.display = 'block';
        }
    }

    handleLogout() {
        this.setToken(null);
        this.stopAutoRefresh();
        this.disconnectObserver();
        this.loginScreen.style.display = 'flex';
        this.dashboard.style.display = 'none';
        location.hash = '';
    }

    connectObserver() {
        if (this.observerWs && this.observerWs.readyState === WebSocket.OPEN) return;
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const obsId = 'admin_obs_' + (this.sessionToken || '').substring(0, 16);
        const wsUrl = `${protocol}//${location.host}/ws?sessionId=${encodeURIComponent(obsId)}`;

        const ws = new WebSocket(wsUrl);
        this.observerWs = ws;

        ws.addEventListener('message', (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'admin_event') {
                    this._dispatchEvent(data.action, data.payload);
                }
            } catch (_e) { /* ignore */ }
        });

        ws.addEventListener('close', () => {
            this.observerWs = null;
            setTimeout(() => {
                if (this.sessionToken) this.connectObserver();
            }, 10000);
        });

        ws.addEventListener('error', () => {
            this.observerWs = null;
        });
    }

    disconnectObserver() {
        if (this.observerWs) {
            this.observerWs.close();
            this.observerWs = null;
        }
    }

    _dispatchEvent(action, payload) {
        let shouldRefresh = false;
        if (action === 'user_joined' || action === 'user_left') {
            const sid = payload?.sessionId;
            const now = Date.now();
            const last = this._userJoinThrottle.get(sid) || 0;
            if (now - last < 1000) return;
            this._userJoinThrottle.set(sid, now);
            shouldRefresh = true;
        } else if (action === 'user_kicked' || action === 'ip_banned' || action === 'ip_unbanned' || action === 'session_unbanned' || action === 'token_expired') {
            shouldRefresh = true;
        } else if (action === 'message_created' || action === 'message_deleted' || action === 'all_messages_deleted') {
            shouldRefresh = true;
        } else if (action === 'channel_deleted') {
            shouldRefresh = true;
        } else if (action.startsWith('announcement_')) {
            shouldRefresh = true;
        }

        if (shouldRefresh) {
            const mod = this.pageModules[this.currentPage];
            if (mod?.handleEvent) {
                mod.handleEvent(this, action, payload);
            } else if (mod?.refresh) {
                mod.refresh(this);
            }
        }
    }

    _setupGlobalHelpers() {
        if (this._helpersSetup) return;
        this._helpersSetup = true;
        window._adminUnbanIP = async (target) => {
            const { sessionId, ip } = target || {};
            if (!sessionId && !ip) return;
            if (!confirm('차단을 해제하시겠습니까?')) return;
            try {
                await ApiClient.post('/api/admin/unban-ip', { sessionId, ip });
                this.showNotification('차단 해제 완료', 'success');
                const mod = this.pageModules[this.currentPage];
                if (mod?.refresh) mod.refresh(this);
            } catch { this.showNotification('차단 해제 실패', 'error'); }
        };
        window._adminDeleteMessage = async (messageId, el) => {
            if (!confirm('이 메시지를 삭제하시겠습니까?')) return;
            if (el) {
                el.style.transition = 'opacity 0.2s, transform 0.2s';
                el.style.opacity = '0.3';
                el.style.transform = 'translateX(-10px)';
                setTimeout(() => { if (el.parentNode) el.remove(); }, 200);
            }
            try {
                await ApiClient.post('/api/admin/delete-message', { messageId });
                this.showNotification('메시지 삭제 완료', 'success');
            } catch {
                this.showNotification('메시지 삭제 실패', 'error');
                const mod = this.pageModules[this.currentPage];
                if (mod?.refresh) mod.refresh(this);
            }
        };
    }

    showDashboard() {
        this.loginScreen.style.display = 'none';
        this.dashboard.style.display = '';
    }

    renderNav() {
        const nav = document.getElementById('nav-sidebar');
        if (!nav) return;
        nav.innerHTML = PAGES.map(p => `
            <button class="nav-item" data-page="${p.id}">
                <span class="nav-icon">${p.icon}</span>
                <span class="nav-label">${p.label}</span>
                <span class="nav-badge" data-badge="${p.id}">0</span>
            </button>
        `).join('');
        if (!this._navListenerBound) {
            this._navListenerBound = true;
            nav.addEventListener('click', (e) => {
                const btn = e.target.closest('.nav-item');
                if (btn) {
                    this.navigateTo(btn.dataset.page);
                    nav.classList.remove('open');
                }
            });
        }
        this.updateNavActive(this._currentHash());
    }

    updateNavActive(pageId) {
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === pageId);
        });
    }

    startAutoRefresh() {
        this.stopAutoRefresh();
        const interval = parseInt(document.getElementById('auto-refresh-interval')?.value || '30') * 1000;
        const toggle = document.getElementById('auto-refresh-toggle');
        if (!toggle) return;
        this._setupAutoRefreshToggle(toggle);
        if (!toggle.checked) return;
        this.autoRefreshInterval = setInterval(() => {
            const mod = this.pageModules[this.currentPage];
            if (mod?.refresh) mod.refresh(this);
        }, interval);
    }

    _setupAutoRefreshToggle(toggle) {
        if (this._toggleSetupDone) return;
        this._toggleSetupDone = true;
        toggle.addEventListener('change', (e) => {
            if (e.target.checked) this.startAutoRefresh();
            else this.stopAutoRefresh();
        });
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) { clearInterval(this.autoRefreshInterval); this.autoRefreshInterval = null; }
    }

    updateLastUpdated() {
        const el = document.getElementById('last-updated');
        if (el) el.textContent = `마지막 업데이트: ${new Date().toLocaleTimeString('ko-KR')}`;
    }

    showNotification(message, type = 'info') {
        const id = 'admin-notifications-container';
        let c = document.getElementById(id);
        if (!c) { c = document.createElement('div'); c.id = id; c.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:9999;display:flex;flex-direction:column;gap:0.5rem'; document.body.appendChild(c); }
        const colors = { success: '#16a34a', error: '#dc2626', warn: '#d97706', info: '#374151' };
        const el = document.createElement('div');
        el.setAttribute('role', 'status');
        el.style.cssText = `padding:8px 12px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.4);max-width:320px;background:${colors[type] || '#374151'};color:#fff`;
        el.textContent = message;
        c.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 350); }, 3000);
    }
}

const PAGE_IMPORTERS = {
    main: () => import('./admin-main.js'),
    users: () => import('./pages/page-users.js'),
    messages: () => import('./pages/page-messages.js'),
    announcements: () => import('./pages/page-announcements.js'),
    channels: () => import('./pages/page-channels.js'),
    bans: () => import('./pages/page-bans.js'),
    logs: () => import('./pages/page-logs.js'),
    security: () => import('./security-center.js'),
};

const core = new AdminCore();
document.addEventListener('DOMContentLoaded', () => core.init());
document.getElementById('logout-btn')?.addEventListener('click', () => core.handleLogout());
export default core;
