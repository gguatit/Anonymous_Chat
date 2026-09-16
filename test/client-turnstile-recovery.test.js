import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function makeStorage() {
    const store = {};
    return {
        getItem: vi.fn((key) => (key in store ? store[key] : null)),
        setItem: vi.fn((key, value) => { store[key] = String(value); }),
        removeItem: vi.fn((key) => { delete store[key]; }),
        _store: store,
    };
}

describe('TurnstileManager.reverify', () => {
    let sessionStorageStub;

    beforeEach(() => {
        sessionStorageStub = makeStorage();
        vi.stubGlobal('sessionStorage', sessionStorageStub);
        vi.stubGlobal('document', { getElementById: vi.fn(() => null) });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('clears the cached ticket and re-renders the widget', async () => {
        const reset = vi.fn();
        vi.stubGlobal('turnstile', { reset });
        const { TurnstileManager } = await import('../public/js/turnstile.js');
        const manager = new TurnstileManager('sitekey', vi.fn(), 'user_1');
        manager.widgetId = 7;
        sessionStorageStub.setItem('turnstileVerified', 'true');
        sessionStorageStub.setItem('turnstileVerifiedAt', String(Date.now()));
        sessionStorageStub.setItem('chatTurnstileTicket', 'ticket');

        manager.reverify();

        expect(sessionStorageStub.getItem('chatTurnstileTicket')).toBeNull();
        expect(sessionStorageStub.getItem('turnstileVerified')).toBeNull();
        expect(manager.verified).toBe(false);
        expect(reset).toHaveBeenCalledWith(7);
    });
});

describe('WebSocketManager stale-ticket recovery', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('asks for re-verification after two failed upgrades instead of looping', async () => {
        const sessionStorageStub = makeStorage();
        vi.stubGlobal('sessionStorage', sessionStorageStub);
        sessionStorageStub.setItem('chatTurnstileTicket', 'stale');
        const { WebSocketManager } = await import('../public/js/websocket.js');
        const onAuthExpired = vi.fn();
        const onConnectionChange = vi.fn();
        const manager = new WebSocketManager('user_1', {
            onMessage: vi.fn(),
            onConnectionChange,
            onError: vi.fn(),
            onAuthExpired,
        });
        manager._socketOpened = false;

        manager.handleClose({ code: 1006 });
        expect(onAuthExpired).not.toHaveBeenCalled();

        manager.handleClose({ code: 1006 });
        expect(onAuthExpired).toHaveBeenCalledTimes(1);
        expect(sessionStorageStub.getItem('chatTurnstileTicket')).toBeNull();
        expect(manager.isReconnecting).toBe(false);
    });
});
