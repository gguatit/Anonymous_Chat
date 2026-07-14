import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listEvents, getStats, getRiskIPs, getEvent, clearEvents, exportCSV, getBadge } from '../src/handlers/security.js';

function mockEnv() {
    const db = {
        prepare() { return this; },
        bind() { return this; },
        all() { return Promise.resolve({ results: [] }); },
        first() { return Promise.resolve(null); },
        run() { return Promise.resolve({ changes: 0 }); },
    };
    return { DB_ADMIN: db, HMAC_SECRET: 'test-secret' };
}

function cors() {
    return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
}

describe('Security Routes', () => {
    let env;
    beforeEach(() => {
        env = mockEnv();
    });

    describe('listEvents', () => {
        it('returns paginated events', async () => {
            env.DB_ADMIN.all = vi.fn().mockResolvedValue({ results: [] });
            env.DB_ADMIN.first = vi.fn().mockResolvedValue({ total: 0 });
            const req = new Request('https://example.com/api/admin/security/events?page=1&limit=10');
            const res = await listEvents(req, env, cors());
            const body = await res.json();
            expect(body.events).toEqual([]);
            expect(body.total).toBe(0);
            expect(body.page).toBe(1);
        });

        it('filters by category', async () => {
            env.DB_ADMIN.all = vi.fn().mockResolvedValue({ results: [] });
            env.DB_ADMIN.first = vi.fn().mockResolvedValue({ total: 0 });
            const req = new Request('https://example.com/api/admin/security/events?category=auth');
            const res = await listEvents(req, env, cors());
            const body = await res.json();
            expect(body.events).toEqual([]);
        });

        it('clamps page to 1', async () => {
            env.DB_ADMIN.all = vi.fn().mockResolvedValue({ results: [] });
            env.DB_ADMIN.first = vi.fn().mockResolvedValue({ total: 0 });
            const req = new Request('https://example.com/api/admin/security/events?page=-5');
            const res = await listEvents(req, env, cors());
            const body = await res.json();
            expect(body.page).toBe(1);
        });
    });

    describe('getStats', () => {
        it('returns category and severity breakdowns', async () => {
            env.DB_ADMIN.all = vi.fn()
                .mockResolvedValueOnce({ results: [{ category: 'auth', count: 5 }] })
                .mockResolvedValueOnce({ results: [{ severity: 'high', count: 3 }] });
            env.DB_ADMIN.first = vi.fn().mockResolvedValue({ total: 10 });
            const req = new Request('https://example.com/api/admin/security/stats');
            const res = await getStats(req, env, cors());
            const body = await res.json();
            expect(body.byCategory).toHaveLength(1);
            expect(body.bySeverity).toHaveLength(1);
            expect(body.last24h).toBe(10);
        });
    });

    describe('getRiskIPs', () => {
        it('returns top 10 scored IPs', async () => {
            const now = Date.now();
            const events = [];
            for (let i = 0; i < 100; i++) {
                events.push({
                    ip: '192.168.1.1',
                    event_type: 'XSS_ATTEMPT',
                    category: 'input',
                    severity_score: 50,
                    timestamp: now - i * 3600000,
                });
            }
            env.DB_ADMIN.all = vi.fn().mockResolvedValue({ results: events });
            const req = new Request('https://example.com/api/admin/security/risk-ips');
            const res = await getRiskIPs(req, env, cors());
            const body = await res.json();
            expect(body.riskIPs.length).toBeGreaterThan(0);
            expect(body.riskIPs[0].ip).toBe('192.168.1.1');
        });

        it('handles empty event list', async () => {
            env.DB_ADMIN.all = vi.fn().mockResolvedValue({ results: [] });
            const req = new Request('https://example.com/api/admin/security/risk-ips');
            const res = await getRiskIPs(req, env, cors());
            const body = await res.json();
            expect(body.riskIPs).toEqual([]);
        });
    });

    describe('getEvent', () => {
        it('returns event detail with related IP events', async () => {
            const event = { id: 1, ip: '192.168.1.1', event_type: 'LOGIN_FAIL' };
            env.DB_ADMIN.first = vi.fn().mockResolvedValue(event);
            env.DB_ADMIN.all = vi.fn().mockResolvedValue({ results: [] });
            const req = new Request('https://example.com/api/admin/security/events/1');
            const res = await getEvent(req, env, cors());
            const body = await res.json();
            expect(body.event.id).toBe(1);
        });

        it('returns 404 for missing event', async () => {
            env.DB_ADMIN.first = vi.fn().mockResolvedValue(null);
            const req = new Request('https://example.com/api/admin/security/events/999');
            const res = await getEvent(req, env, cors());
            expect(res.status).toBe(404);
        });
    });

    describe('clearEvents', () => {
        it('deletes events before cutoff', async () => {
            env.DB_ADMIN.run = vi.fn().mockResolvedValue({ changes: 5 });
            const req = new Request('https://example.com/api/admin/security/events/clear', { method: 'POST' });
            const res = await clearEvents(req, env, cors());
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.deleted).toBe(5);
        });
    });

    describe('exportCSV', () => {
        it('returns CSV content', async () => {
            env.DB_ADMIN.all = vi.fn().mockResolvedValue({
                results: [{
                    id: 1,
                    event_type: 'LOGIN_FAIL',
                    category: 'auth',
                    severity: 'medium',
                    severity_score: 30,
                    ip: '192.168.1.1',
                    country: null,
                    path: '/api/admin/login',
                    method: 'POST',
                    details: null,
                    timestamp: 1234567890,
                }]
            });
            const req = new Request('https://example.com/api/admin/security/events/export');
            const res = await exportCSV(req, env, cors());
            const text = await res.text();
            expect(text).toContain('id,event_type,category');
            expect(text).toContain('LOGIN_FAIL');
        });
    });

    describe('getBadge', () => {
        it('returns count by severity tiers', async () => {
            env.DB_ADMIN.first = vi.fn()
                .mockResolvedValueOnce({ count: 5 })
                .mockResolvedValueOnce({ count: 3 })
                .mockResolvedValueOnce({ count: 2 });
            const req = new Request('https://example.com/api/admin/security/badge');
            const res = await getBadge(req, env, cors());
            const body = await res.json();
            expect(body.high).toBe(5);
            expect(body.medium).toBe(3);
            expect(body.critical).toBe(2);
        });
    });
});
