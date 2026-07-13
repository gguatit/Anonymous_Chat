import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../public/js/session.js';

describe('client session', () => {
    let SessionManager;
    let store;

    beforeEach(async () => {
        store = {};
        vi.stubGlobal('localStorage', {
            store,
            getItem: vi.fn((key) => store[key] || null),
            setItem: vi.fn((key, val) => { store[key] = String(val); }),
            removeItem: vi.fn((key) => { delete store[key]; }),
        });
        vi.stubGlobal('crypto', {
            randomUUID: vi.fn(() => '12345678-1234-1234-1234-123456789abc'),
        });
        const mod = await import('../public/js/session.js');
        SessionManager = mod.SessionManager;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('SessionManager', () => {
        it('creates a new session when none exists', () => {
            const sm = new SessionManager();
            expect(sm.getSessionId()).toContain('user_');
        });

        it('reuses existing session from localStorage', () => {
            store.chatSessionId = 'user_existing_session_1';
            const sm = new SessionManager();
            expect(sm.getSessionId()).toBe('user_existing_session_1');
        });

        it('uses default nickname when not set', () => {
            const sm = new SessionManager();
            expect(sm.getNickname()).toBe('익명');
        });

        it('reuses existing nickname from localStorage', () => {
            store.chatNickname = '홍길동';
            const sm = new SessionManager();
            expect(sm.getNickname()).toBe('홍길동');
        });

        it('sets and persists nickname', () => {
            const sm = new SessionManager();
            const name = sm.setNickname('NewName');
            expect(name).toBe('NewName');
            expect(store.chatNickname).toBe('NewName');
        });

        it('trims and truncates long nickname', () => {
            const sm = new SessionManager();
            const name = sm.setNickname('  ' + 'x'.repeat(50) + '  ');
            expect(name.length).toBeLessThanOrEqual(12);
            expect(store.chatNickname).toBe(name);
        });

        it('falls back to 익명 on empty nickname', () => {
            const sm = new SessionManager();
            const name = sm.setNickname('');
            expect(name).toBe('익명');
        });

        it('manages nickname notice acceptance', () => {
            const sm = new SessionManager();
            expect(sm.hasAcceptedNicknameNotice()).toBe(false);
            sm.setNicknameNoticeAccepted(true);
            expect(sm.hasAcceptedNicknameNotice()).toBe(true);
            sm.setNicknameNoticeAccepted(false);
            expect(sm.hasAcceptedNicknameNotice()).toBe(false);
        });
    });
});
