// Admin Dashboard JavaScript
import ApiClient from './api-client.js';
import { escapeHtml, isValidUrl as _isValidUrl, sanitizeUrl as _sanitizeUrl, formatFileSize as _formatFileSize } from './utils.js';
import { hideModal } from './admin-utils.js';
import csvMethods from './admin-csv.js';
import messageMethods from './admin-messages.js';
import userMethods from './admin-users.js';
import announceMethods from './admin-announcements.js';
import logMethods from './admin-logs.js';
import channelMethods from './admin-channels.js';
import renderMethods from './admin-render.js';

class AdminDashboard {
    constructor() {
        this.loginScreen = document.getElementById('login-screen');
        this.adminDashboard = document.getElementById('admin-dashboard');
        this.loginForm = document.getElementById('login-form');
        this.loginError = document.getElementById('login-error');
        this.logoutBtn = document.getElementById('logout-btn');
        this.refreshBtn = document.getElementById('refresh-btn');

        this.sessionToken = localStorage.getItem('admin_token');
        if (this.sessionToken) {
            ApiClient.setToken(this.sessionToken);
        }
        this.refreshInterval = null;
        this.autoRefreshInterval = null;

        this.initializeEventListeners();
        this.checkAuthentication();
    }

    initializeEventListeners() {
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.logoutBtn?.addEventListener('click', () => this.handleLogout());
        this.refreshBtn?.addEventListener('click', () => this.refreshData());
        this.exportCsvBtn = document.getElementById('export-csv-btn');
        this.exportCsvBtn?.addEventListener('click', () => this.exportCsv());

        const downloadErrorsBtn = document.getElementById('download-errors-btn');
        downloadErrorsBtn?.addEventListener('click', () => this.downloadErrorLogs());
        const deleteErrorsBtn = document.getElementById('delete-errors-btn');
        deleteErrorsBtn?.addEventListener('click', () => this.deleteErrorLogs());

        document.getElementById('refresh-channels-btn')?.addEventListener('click', () => this.loadChannels());
        document.getElementById('close-channel-detail')?.addEventListener('click', () => this.hideChannelDetail());

        try {
            const mobileMenuBtn = document.getElementById('mobile-menu-btn');
            const mobileMenu = document.getElementById('mobile-menu');
            const closeMobileMenu = document.getElementById('close-mobile-menu');
            const mobileMenuPanel = mobileMenu?.querySelector('.mobile-menu');

            mobileMenuBtn?.addEventListener('click', () => {
                mobileMenu?.classList.remove('hidden');
                setTimeout(() => mobileMenuPanel?.classList.add('active'), 10);
            });

            closeMobileMenu?.addEventListener('click', () => {
                mobileMenuPanel?.classList.remove('active');
                setTimeout(() => mobileMenu?.classList.add('hidden'), 300);
            });

            mobileMenu?.addEventListener('click', (e) => {
                if (e.target === mobileMenu) {
                    mobileMenuPanel?.classList.remove('active');
                    setTimeout(() => mobileMenu?.classList.add('hidden'), 300);
                }
            });

            const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
            const mobileAutoRefresh = document.getElementById('mobile-auto-refresh');
            const autoRefreshInterval = document.getElementById('auto-refresh-interval');
            const mobileRefreshInterval = document.getElementById('mobile-refresh-interval');

            mobileAutoRefresh?.addEventListener('change', (e) => {
                if (autoRefreshToggle) autoRefreshToggle.checked = e.target.checked;
                if (e.target.checked) {
                    this.startAutoRefresh();
                } else {
                    this.stopAutoRefresh();
                }
            });

            mobileRefreshInterval?.addEventListener('change', (e) => {
                if (autoRefreshInterval) autoRefreshInterval.value = e.target.value;
                if (this.autoRefreshInterval) {
                    this.stopAutoRefresh();
                    this.startAutoRefresh();
                }
            });

            const mobileExportCsv = document.getElementById('mobile-export-csv');
            mobileExportCsv?.addEventListener('click', () => {
                this.exportCsv();
                mobileMenuPanel?.classList.remove('active');
                setTimeout(() => mobileMenu?.classList.add('hidden'), 300);
            });
        } catch (_error) {
            // ignore
        }

        this.adminSendBtn = document.getElementById('admin-send-btn');
        this.adminAnnounceBtn = document.getElementById('admin-announce-btn');
        this.adminMessageInput = document.getElementById('admin-message-input');
        this.adminAnnounceInput = document.getElementById('admin-announce-input');
        this.emergencyCheckbox = document.getElementById('emergency-checkbox');
        this.emergencyDuration = document.getElementById('emergency-duration');
        this.adminSendBtn?.addEventListener('click', () => this.sendAdminBroadcast());
        this.adminAnnounceBtn?.addEventListener('click', () => this.sendAdminAnnounce());
        this.emergencyCheckbox?.addEventListener('change', () => {
            this.emergencyDuration.classList.toggle('hidden', !this.emergencyCheckbox.checked);
        });

        if (this.adminAnnounceInput) {
            const counter = document.getElementById('announce-char-count');
            this.adminAnnounceInput.addEventListener('input', () => {
                const len = this.adminAnnounceInput.value.length;
                if (counter) {
                    counter.textContent = `${len} / 7500`;
                    counter.className = len > 7000 ? 'text-xs text-red-400' : len > 6000 ? 'text-xs text-yellow-400' : 'text-xs text-gray-500';
                }
            });
        }

        const previewBtn = document.getElementById('announce-preview-btn');
        const previewDiv = document.getElementById('announce-preview');
        const previewContent = document.getElementById('announce-preview-content');
        if (previewBtn && this.adminAnnounceInput) {
            previewBtn.addEventListener('click', () => {
                if (previewDiv.classList.contains('hidden')) {
                    const text = this.adminAnnounceInput.value.trim();
                    previewContent.innerHTML = text ? this.escapeHtml(text).replace(/\n/g, '<br>') : '<span class="text-gray-500">내용을 입력하세요</span>';
                    previewDiv.classList.remove('hidden');
                    previewBtn.textContent = '미리보기 닫기';
                } else {
                    previewDiv.classList.add('hidden');
                    previewBtn.textContent = '미리보기';
                }
            });
        }

        this.deleteAllMessagesBtn = document.getElementById('delete-all-messages-btn');
        this.deleteAllMessagesBtn?.addEventListener('click', () => this.deleteAllMessages());

        if (this.adminMessageInput) {
            this.adminMessageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendAdminBroadcast();
                }
            });
        }

        this.exportFilteredCsvBtn = document.getElementById('export-filtered-csv-btn');
        this.exportFilteredCsvBtn?.addEventListener('click', () => this.exportFilteredCsv());

        const _autoRefreshToggle = document.getElementById('auto-refresh-toggle');
        const autoRefreshIntervalSelect = document.getElementById('auto-refresh-interval');

        if (_autoRefreshToggle) {
            _autoRefreshToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    const interval = parseInt(autoRefreshIntervalSelect.value) * 1000;
                    this.startAutoRefresh(interval);
                } else {
                    this.stopAutoRefresh();
                }
            });
        }

        if (autoRefreshIntervalSelect) {
            autoRefreshIntervalSelect.addEventListener('change', (e) => {
                if (_autoRefreshToggle && _autoRefreshToggle.checked) {
                    this.stopAutoRefresh();
                    const interval = parseInt(e.target.value) * 1000;
                    this.startAutoRefresh(interval);
                }
            });
        }

        const auditLogFilter = document.getElementById('audit-log-filter');
        if (auditLogFilter) {
            auditLogFilter.addEventListener('change', () => this.loadAuditLogs());
        }

        const exportAuditCsvBtn = document.getElementById('export-audit-csv-btn');
        if (exportAuditCsvBtn) {
            exportAuditCsvBtn.addEventListener('click', () => this.exportAuditLogCsv());
        }

        const clearAuditBtn = document.getElementById('clear-audit-logs-btn');
        if (clearAuditBtn) {
            clearAuditBtn.addEventListener('click', () => this.clearAuditLogs());
        }

        const deleteAdminLogsBtn = document.getElementById('delete-admin-logs-btn');
        if (deleteAdminLogsBtn) {
            deleteAdminLogsBtn.addEventListener('click', () => this.deleteAdminLogs());
        }

        const errorLogFilter = document.getElementById('error-log-filter');
        const errorLogSearch = document.getElementById('error-log-search');
        if (errorLogFilter) {
            errorLogFilter.addEventListener('change', () => {
                if (this._errorLogs) this.renderErrorLogs(this._errorLogs);
            });
        }
        if (errorLogSearch) {
            errorLogSearch.addEventListener('input', () => {
                if (this._errorLogs) this.renderErrorLogs(this._errorLogs);
            });
        }

        const userDetailsModal = document.getElementById('user-details-modal');
        if (userDetailsModal) {
            userDetailsModal.addEventListener('click', (e) => {
                if (e.target === userDetailsModal) hideModal(userDetailsModal);
            });
        }

        const announceSearch = document.getElementById('announce-search');
        if (announceSearch) {
            let searchTimer = null;
            announceSearch.addEventListener('input', () => {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                    const query = announceSearch.value.trim().toLowerCase();
                    this.filterAnnouncements(query);
                }, 300);
            });
        }

        this.scheduleCheckbox = document.getElementById('schedule-checkbox');
        this.scheduleDatetime = document.getElementById('schedule-datetime');
        if (this.scheduleCheckbox && this.scheduleDatetime) {
            this.scheduleCheckbox.addEventListener('change', () => {
                this.scheduleDatetime.classList.toggle('hidden', !this.scheduleCheckbox.checked);
                if (this.scheduleCheckbox.checked && !this.scheduleDatetime.value) {
                    const now = new Date();
                    now.setMinutes(now.getMinutes() + 5);
                    this.scheduleDatetime.value = now.toISOString().slice(0, 16);
                }
            });
        }

        this.announceExpirySelect = document.getElementById('announce-expiry-select');

        if (this.adminAnnounceInput) {
            this.adminAnnounceInput.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    this.sendAdminAnnounce();
                }
            });
        }
    }

    async checkAuthentication() {
        if (this.sessionToken) {
            const isValid = await this.verifyToken(this.sessionToken);
            if (isValid) {
                this.showDashboard();
            } else {
                this.showLogin();
            }
        } else {
            this.showLogin();
        }
    }

    async handleLogin(e) {
        e.preventDefault();

        const id = document.getElementById('admin-id').value;
        const password = document.getElementById('admin-password').value;
        this.loginError.classList.add('hidden');

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.sessionToken = data.token;
                ApiClient.setToken(data.token);
                localStorage.setItem('admin_token', data.token);
                this.showDashboard();
            } else {
                this.loginError.classList.remove('hidden');
                document.getElementById('admin-id').value = '';
                document.getElementById('admin-password').value = '';
            }
        } catch (_error) {
            this.loginError.classList.remove('hidden');
        }
    }

    async verifyToken(token) {
        try {
            const response = await fetch('/api/admin/verify', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.ok;
        } catch (_error) {
            return false;
        }
    }

    handleLogout() {
        const token = localStorage.getItem('admin_token');

        if (token) {
            fetch('/api/admin/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).catch(err => console.error('Logout error:', err));
        }

        localStorage.removeItem('admin_token');
        this.sessionToken = null;
        ApiClient.setToken(null);
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        this.showLogin();
    }

    showLogin() {
        this.loginScreen.classList.remove('hidden');
        this.adminDashboard.classList.add('hidden');
    }

    showDashboard() {
        this.loginScreen.classList.add('hidden');
        this.adminDashboard.classList.remove('hidden');
        this.refreshData();

        this.refreshInterval = setInterval(() => this.refreshData(), 5000);
    }

    async refreshData() {
        try {
            const metricsResponse = await fetch('/api/admin/metrics', {
                headers: { 'Authorization': `Bearer ${this.sessionToken}` }
            });

            if (!metricsResponse.ok) {
                if (metricsResponse.status === 401) {
                    this.handleLogout();
                    return;
                }
                throw new Error('Failed to fetch metrics');
            }

            const metrics = await metricsResponse.json();
            this.updateMetrics(metrics);

            const sessionsResponse = await fetch('/api/admin/sessions', {
                headers: { 'Authorization': `Bearer ${this.sessionToken}` }
            });

            if (sessionsResponse.ok) {
                const sessions = await sessionsResponse.json();
                this.updateActiveSessions(sessions);
            }

            const messagesResponse = await fetch('/api/admin/messages', {
                headers: { 'Authorization': `Bearer ${this.sessionToken}` }
            });

            if (messagesResponse.ok) {
                const messages = await messagesResponse.json();
                this.updateRecentMessages(messages);
            }

            await this.loadBannedIPs();
            await this.loadAuditLogs();
            await this.loadAnnouncements();
            await this.loadAdminLogs();
            await this.loadChannels();

            this.updateLastUpdated();

        } catch (_error) {
            // ignore refresh errors
        }
    }

    formatFileSize(bytes) {
        return _formatFileSize(bytes);
    }

    updateLastUpdated() {
        const timeStr = `마지막 업데이트: ${new Date().toLocaleTimeString('ko-KR')}`;
        document.getElementById('last-updated').textContent = timeStr;
        const mobileLastUpdated = document.getElementById('mobile-last-updated');
        if (mobileLastUpdated) {
            mobileLastUpdated.textContent = timeStr;
        }
    }

    truncateId(id) {
        if (!id) return 'Unknown';
        return id.length > 20 ? id.substring(0, 20) + '...' : id;
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) return `${hours}시간 전`;
        if (minutes > 0) return `${minutes}분 전`;
        return `${seconds}초 전`;
    }

    escapeHtml(text) {
        return escapeHtml(text);
    }

    isValidUrl(url) {
        return _isValidUrl(url);
    }

    sanitizeUrl(url) {
        return _sanitizeUrl(url);
    }

    startAutoRefresh(interval) {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        this.autoRefreshInterval = setInterval(() => this.refreshData(), interval);
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }

    showNotification(message, type = 'info') {
        try {
            const containerId = 'admin-notifications-container';
            let container = document.getElementById(containerId);
            if (!container) {
                container = document.createElement('div');
                container.id = containerId;
                container.style.position = 'fixed';
                container.style.top = '1rem';
                container.style.right = '1rem';
                container.style.zIndex = '9999';
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.gap = '0.5rem';
                document.body.appendChild(container);
            }

            const colorClass = {
                success: 'background: #16a34a; color: #fff;',
                error: 'background: #dc2626; color: #fff;',
                warn: 'background: #d97706; color: #fff;',
                info: 'background: #374151; color: #fff;'
            }[type] || 'background: #374151; color: #fff;';

            const el = document.createElement('div');
            el.setAttribute('role', 'status');
            el.style.cssText = `padding:8px 12px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.4);max-width:320px;${colorClass}`;
            el.textContent = message;

            container.appendChild(el);

            setTimeout(() => {
                el.style.transition = 'opacity 300ms ease, transform 300ms ease';
                el.style.opacity = '0';
                el.style.transform = 'translateY(-6px)';
                setTimeout(() => el.remove(), 350);
            }, 3000);
        } catch (_err) {
            // ignore
        }
    }
}

Object.assign(AdminDashboard.prototype, csvMethods, messageMethods, userMethods, announceMethods, logMethods, channelMethods, renderMethods);

window.adminDashboard = new AdminDashboard();
