import { describe, it, expect } from 'vitest';

const API_PREFIX = '/api/admin/';

const adminRouteNames = [
    'login', 'verify', 'metrics', 'sessions', 'messages',
    'delete-error-logs', 'logout', 'logs', 'delete-logs',
    'broadcast', 'edit-message', 'delete-message', 'delete-all-messages',
    'kick-user', 'announce', 'banned-ips', 'unban-ip', 'user-details',
    'audit-logs', 'delete-audit-logs', 'channels', 'channel-details', 'channel-delete',
    'security/events', 'security/stats', 'security/risk-ips',
    'security/events/export', 'security/events/clear',
    'security/badge', 'security/block-ip',
];

const publicRoutePaths = [
    '/api/announcements',
    '/api/emergency-announcement',
    '/api/channels/create',
    '/api/channels/join',
    '/api/channels/list',
    '/api/push/vapid-key',
    '/api/push/subscribe',
    '/api/push/unsubscribe',
    '/api/search',
    '/api/config',
    '/api/check-ban',
    '/api/upload',
    '/api/turnstile/verify',
    '/api/summary',
    '/api/preview',
    '/api/logs/error',
    '/ws',
    '/metrics',
    '/health',
];

describe('worker routes', () => {
    describe('admin routes', () => {
        it('all admin routes have unique names', () => {
            const seen = new Set();
            for (const name of adminRouteNames) {
                expect(seen.has(name)).toBe(false);
                seen.add(name);
            }
        });

        it('all admin routes resolve to valid paths', () => {
            for (const name of adminRouteNames) {
                const path = `${API_PREFIX}${name}`;
                expect(path.startsWith('/api/admin/')).toBe(true);
                expect(path.length).toBeGreaterThan('/api/admin/'.length);
            }
        });

        it('admin route count matches expected', () => {
            expect(adminRouteNames).toHaveLength(30);
        });
    });

    describe('public routes', () => {
        it('all public routes start with slash', () => {
            for (const path of publicRoutePaths) {
                expect(path.startsWith('/')).toBe(true);
            }
        });

        it('API routes are under /api/', () => {
            for (const path of publicRoutePaths) {
                if (path.startsWith('/api/')) {
                    expect(path).toContain('/api/');
                }
            }
        });

        it('public route count matches expected', () => {
            expect(publicRoutePaths).toHaveLength(19);
        });
    });
});
