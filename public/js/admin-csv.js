// Admin Dashboard - CSV Export Methods
import ApiClient from './api-client.js';

const csvMethods = {
    async exportCsv() {
        if (!this.sessionToken) {
            alert('관리자 인증이 필요합니다.');
            return;
        }

        try {
            const [sessionsResp, messagesResp] = await Promise.all([
                ApiClient.getRaw('/api/admin/sessions'),
                ApiClient.getRaw('/api/admin/messages')
            ]);

            if (!sessionsResp.ok || !messagesResp.ok) {
                alert('데이터를 불러오는 중 오류가 발생했습니다. 권한을 확인하세요.');
                return;
            }

            const sessions = await sessionsResp.json();
            const messages = await messagesResp.json();

            const usersMap = new Map();
            for (const s of sessions) {
                usersMap.set(s.sessionId, s);
            }

            const rows = [];
            const headers = [
                'user_session_id', 'user_ip', 'user_join_time', 'user_message_count', 'user_last_message_time',
                'message_id', 'message_timestamp', 'message_content', 'message_edited_at', 'file_url', 'file_name', 'file_size', 'file_type'
            ];

            for (const msg of messages) {
                const user = usersMap.get(msg.sessionId) || {};
                rows.push([
                    user.sessionId || msg.sessionId || '',
                    user.ip || '',
                    user.joinTime ? new Date(user.joinTime).toISOString() : '',
                    user.messageCount != null ? user.messageCount : '',
                    user.lastMessageTime ? new Date(user.lastMessageTime).toISOString() : '',
                    msg.messageId || '',
                    msg.timestamp ? new Date(msg.timestamp).toISOString() : '',
                    msg.content || '',
                    msg.editedAt ? new Date(msg.editedAt).toISOString() : '',
                    msg.file?.url || '',
                    msg.file?.filename || '',
                    msg.file?.filesize != null ? String(msg.file.filesize) : '',
                    msg.file?.filetype || ''
                ]);
            }

            for (const [sessionId, user] of usersMap.entries()) {
                const hasMessage = messages.some(m => m.sessionId === sessionId);
                if (!hasMessage) {
                    rows.push([
                        user.sessionId || sessionId,
                        user.ip || '',
                        user.joinTime ? new Date(user.joinTime).toISOString() : '',
                        user.messageCount != null ? user.messageCount : '',
                        user.lastMessageTime ? new Date(user.lastMessageTime).toISOString() : '',
                        '', '', '', '', '', '', '', ''
                    ]);
                }
            }

            const escape = (value) => {
                if (value == null) return '';
                const str = String(value);
                return '"' + str.replace(/"/g, '""') + '"';
            };

            const csvContent = [headers.map(h => escape(h)).join(',')]
                .concat(rows.map(r => r.map(cell => escape(cell)).join(',')))
                .join('\n');

            const bom = '\uFEFF';
            const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `anonymous_chat_export_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Export CSV error:', error);
            alert('CSV 내보내기 중 오류가 발생했습니다. 콘솔을 확인하세요.');
        }
    },

    async exportFilteredCsv() {
        if (!this.sessionToken) {
            alert('관리자 인증이 필요합니다.');
            return;
        }

        const filterOptions = prompt(
            '내보내기 옵션을 선택하세요:\n' +
            '1: 전체 데이터\n' +
            '2: 활성 세션만\n' +
            '3: 오늘 메시지만\n' +
            '4: 최근 1시간\n' +
            '5: 최근 24시간',
            '1'
        );

        if (!filterOptions) return;

        try {
            const [sessionsResp, messagesResp] = await Promise.all([
                ApiClient.getRaw('/api/admin/sessions'),
                ApiClient.getRaw('/api/admin/messages')
            ]);

            if (!sessionsResp.ok || !messagesResp.ok) {
                alert('데이터를 불러오는 중 오류가 발생했습니다.');
                return;
            }

            let sessions = await sessionsResp.json();
            let messages = await messagesResp.json();

            const now = Date.now();
            const oneHour = 60 * 60 * 1000;
            const oneDay = 24 * oneHour;
            const todayStart = new Date().setHours(0, 0, 0, 0);

            switch (filterOptions) {
                case '2': {
                    const activeSessions = new Set(sessions.map(s => s.sessionId));
                    messages = messages.filter(m => activeSessions.has(m.sessionId));
                    break;
                }
                case '3':
                    messages = messages.filter(m => m.timestamp >= todayStart);
                    break;
                case '4':
                    messages = messages.filter(m => now - m.timestamp < oneHour);
                    sessions = sessions.filter(s => now - s.joinTime < oneHour);
                    break;
                case '5':
                    messages = messages.filter(m => now - m.timestamp < oneDay);
                    sessions = sessions.filter(s => now - s.joinTime < oneDay);
                    break;
                default:
                    break;
            }

            const usersMap = new Map();
            for (const s of sessions) {
                usersMap.set(s.sessionId, s);
            }

            const rows = [];
            const headers = [
                'user_session_id', 'user_ip', 'user_join_time', 'user_message_count', 'user_last_message_time',
                'message_id', 'message_timestamp', 'message_content', 'message_edited_at', 'file_url', 'file_name', 'file_size', 'file_type'
            ];

            for (const msg of messages) {
                const user = usersMap.get(msg.sessionId) || {};
                rows.push([
                    user.sessionId || msg.sessionId || '',
                    user.ip || '',
                    user.joinTime ? new Date(user.joinTime).toISOString() : '',
                    user.messageCount != null ? user.messageCount : '',
                    user.lastMessageTime ? new Date(user.lastMessageTime).toISOString() : '',
                    msg.messageId || '',
                    msg.timestamp ? new Date(msg.timestamp).toISOString() : '',
                    msg.content || '',
                    msg.editedAt ? new Date(msg.editedAt).toISOString() : '',
                    msg.file?.url || '',
                    msg.file?.filename || '',
                    msg.file?.filesize != null ? String(msg.file.filesize) : '',
                    msg.file?.filetype || ''
                ]);
            }

            for (const [sessionId, user] of usersMap.entries()) {
                const hasMessage = messages.some(m => m.sessionId === sessionId);
                if (!hasMessage) {
                    rows.push([
                        user.sessionId || sessionId,
                        user.ip || '',
                        user.joinTime ? new Date(user.joinTime).toISOString() : '',
                        user.messageCount != null ? user.messageCount : '',
                        user.lastMessageTime ? new Date(user.lastMessageTime).toISOString() : '',
                        '', '', '', '', '', '', '', ''
                    ]);
                }
            }

            const escape = (value) => {
                if (value == null) return '';
                const str = String(value);
                return '"' + str.replace(/"/g, '""') + '"';
            };

            const csvContent = [headers.map(h => escape(h)).join(',')]
                .concat(rows.map(r => r.map(cell => escape(cell)).join(',')))
                .join('\n');

            const bom = '\uFEFF';
            const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            const filterName = ['all', 'active', 'today', '1hour', '24hours'][parseInt(filterOptions) - 1] || 'filtered';
            const a = document.createElement('a');
            a.href = url;
            a.download = `anonymous_chat_${filterName}_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Export filtered CSV error:', error);
            alert('CSV 내보내기 중 오류가 발생했습니다.');
        }
    },

    async exportAuditLogCsv() {
        if (!this.sessionToken) {
            alert('관리자 인증이 필요합니다.');
            return;
        }

        try {
            const response = await fetch('/api/admin/audit-logs', {
                headers: { 'Authorization': `Bearer ${this.sessionToken}` }
            });

            if (!response.ok) {
                throw new Error('Failed to load audit logs');
            }

            const logs = await response.json();
            const filterSelect = document.getElementById('audit-log-filter');
            const selectedFilter = filterSelect?.value || 'all';

            let filteredLogs = logs;
            if (selectedFilter !== 'all') {
                filteredLogs = logs.filter(log => {
                    if (selectedFilter === 'delete_message') {
                        return log.action === 'delete_message' || log.action === 'admin_delete_message';
                    }
                    return log.action === selectedFilter;
                });
            }

            if (!filteredLogs || filteredLogs.length === 0) {
                this.showNotification('내보낼 감사 로그가 없습니다.', 'error');
                return;
            }

            const headers = ['timestamp', 'action', 'details', 'metadata'];
            const escape = (value) => {
                if (value == null) return '';
                const str = String(value);
                return '"' + str.replace(/"/g, '""') + '"';
            };

            const rows = filteredLogs.map(log => [
                new Date(log.timestamp).toISOString(),
                log.action,
                log.details || '',
                log.metadata ? JSON.stringify(log.metadata) : ''
            ]);

            const csvContent = [headers.map(h => escape(h)).join(',')]
                .concat(rows.map(r => r.map(cell => escape(cell)).join(',')))
                .join('\n');

            const bom = '\uFEFF';
            const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `audit_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Export audit CSV error:', error);
            this.showNotification('CSV 내보내기 중 오류가 발생했습니다.', 'error');
        }
    },

    downloadErrorLogs() {
        if (!this.lastMetrics || !this.lastMetrics.errorLogs || this.lastMetrics.errorLogs.length === 0) {
            this.showNotification('다운로드할 오류 로그가 없습니다.', 'error');
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `error_logs_${timestamp}.json`;
        const jsonStr = JSON.stringify(this.lastMetrics.errorLogs, null, 2);

        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    },
};

export default csvMethods;
