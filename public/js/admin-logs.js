// Admin Dashboard - Log Management Methods

const logMethods = {
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
            this.refreshData();
        } catch (error) {
            console.error('Error deleting logs:', error);
            this.showNotification('오류 로그 삭제 중 문제가 발생했습니다.', 'error');
        }
    },
};

export default logMethods;
