import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logAdminActivity, logAuditLog, logErrorLog } from '../src/utils/logger.js';

function makeDb() {
    const run = vi.fn(async () => ({}));
    const bind = vi.fn(() => ({ run }));
    const prepare = vi.fn(() => ({ bind }));
    return { db: { prepare }, prepare, bind, run };
}

describe('logger', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(Math, 'random').mockReturnValue(1); // skip cleanup branch
    });

    describe('logAdminActivity', () => {
        it('inserts type/ip/timestamp/data', async () => {
            const { db, bind } = makeDb();
            await logAdminActivity({ DB_ADMIN: db }, { type: 'login', ip: '1.2.3.4', timestamp: 1234 });
            expect(bind).toHaveBeenCalledWith('login', '1.2.3.4', 1234, expect.stringContaining('"type":"login"'));
        });

        it('defaults ip to null and timestamp to now', async () => {
            const { db, bind } = makeDb();
            await logAdminActivity({ DB_ADMIN: db }, { type: 'logout' });
            expect(bind.mock.calls[0][1]).toBeNull();
            expect(typeof bind.mock.calls[0][2]).toBe('number');
        });

        it('is a no-op without DB binding', async () => {
            const { db, prepare } = makeDb();
            await logAdminActivity({}, { type: 'login' });
            await logAdminActivity(null, { type: 'login' });
            expect(prepare).not.toHaveBeenCalled();
        });

        it('swallows D1 errors', async () => {
            const run = vi.fn(async () => { throw new Error('boom'); });
            const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run })) })) };
            await expect(logAdminActivity({ DB_ADMIN: db }, { type: 'login' })).resolves.toBeUndefined();
        });

        it('runs probabilistic cleanup when random is low', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0);
            const { db, prepare } = makeDb();
            await logAdminActivity({ DB_ADMIN: db }, { type: 'login' });
            expect(prepare).toHaveBeenCalledTimes(2);
            expect(prepare.mock.calls[1][0]).toContain('DELETE FROM admin_activity_logs');
        });
    });

    describe('logAuditLog', () => {
        it('inserts action/details/timestamp/metadata JSON', async () => {
            const { db, bind } = makeDb();
            await logAuditLog(db, 'KICK_USER', 'kicked user_x', { ip: '1.2.3.4' });
            const [action, details, timestamp, metadata] = bind.mock.calls[0];
            expect(action).toBe('KICK_USER');
            expect(details).toBe('kicked user_x');
            expect(typeof timestamp).toBe('number');
            expect(JSON.parse(metadata)).toEqual({ ip: '1.2.3.4' });
        });

        it('defaults details to empty string and metadata to {}', async () => {
            const { db, bind } = makeDb();
            await logAuditLog(db, 'ACTION');
            expect(bind.mock.calls[0][1]).toBe('');
            expect(JSON.parse(bind.mock.calls[0][3])).toEqual({});
        });

        it('is a no-op without db', async () => {
            const { db, prepare } = makeDb();
            await logAuditLog(null, 'ACTION');
            expect(prepare).not.toHaveBeenCalled();
            expect(db).toBeTruthy();
        });

        it('swallows insert errors', async () => {
            const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run: vi.fn(async () => { throw new Error('x'); }) })) })) };
            await expect(logAuditLog(db, 'A')).resolves.toBeUndefined();
        });
    });

    describe('logErrorLog', () => {
        it('inserts 7 columns with ISO timestamp', async () => {
            const { db, bind } = makeDb();
            await logErrorLog(db, 'TypeError', 'boom', 'stack', 'chat.js:1', { env: 'test' }, 'ctx');
            const [type, message, stackTrace, location, environment, context, timestamp] = bind.mock.calls[0];
            expect(type).toBe('TypeError');
            expect(message).toBe('boom');
            expect(stackTrace).toBe('stack');
            expect(location).toBe('chat.js:1');
            expect(JSON.parse(environment)).toEqual({ env: 'test' });
            expect(context).toBe('ctx');
            expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });

        it('defaults optional fields', async () => {
            const { db, bind } = makeDb();
            await logErrorLog(db, 'Error', 'm');
            const args = bind.mock.calls[0];
            expect(args[2]).toBe('');
            expect(args[3]).toBe('');
            expect(JSON.parse(args[4])).toEqual({});
            expect(args[5]).toBe('');
        });

        it('is a no-op without db', async () => {
            const { db, prepare } = makeDb();
            await logErrorLog(null, 'Error', 'm');
            expect(prepare).not.toHaveBeenCalled();
            expect(db).toBeTruthy();
        });

        it('swallows insert errors', async () => {
            const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run: vi.fn(async () => { throw new Error('x'); }) })) })) };
            await expect(logErrorLog(db, 'E', 'm')).resolves.toBeUndefined();
        });
    });
});
