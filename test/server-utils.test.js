import { describe, it, expect, vi } from 'vitest';
import { jsonError, jsonSuccess, textError, emptyResponse, extractErrorMessage } from '../src/utils/errors.js';
import { getCorsHeaders, handleCorsPreflightResponse } from '../src/config/cors.js';
import { handleMetrics, handleHealth } from '../src/handlers/health.js';
import { getChatRoom, forwardToDO } from '../src/utils/do.js';

describe('errors.js', () => {
    describe('jsonError', () => {
        it('returns JSON error response with CORS', async () => {
            const res = jsonError('test error', 400, 'https://kalpha.mmv.kr');
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toBe('test error');
        });

        it('returns default status 400', async () => {
            const res = jsonError('default status');
            expect(res.status).toBe(400);
        });

        it('returns 500 for server errors', async () => {
            const res = jsonError('server error', 500);
            expect(res.status).toBe(500);
        });
    });

    describe('jsonSuccess', () => {
        it('returns JSON success response', async () => {
            const res = jsonSuccess({ ok: true }, 200);
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.ok).toBe(true);
        });

        it('returns 200 by default', async () => {
            const res = jsonSuccess({ data: 'test' });
            expect(res.status).toBe(200);
        });
    });

    describe('textError', () => {
        it('returns plain text error response', async () => {
            const res = textError('Too many requests');
            expect(res.status).toBe(429);
            const text = await res.text();
            expect(text).toBe('Too many requests');
        });

        it('accepts custom status', async () => {
            const res = textError('Not found', 404);
            expect(res.status).toBe(404);
        });
    });

    describe('emptyResponse', () => {
        it('returns 204 no content', () => {
            const res = emptyResponse(204);
            expect(res.status).toBe(204);
        });

        it('accepts custom status', () => {
            const res = emptyResponse(201);
            expect(res.status).toBe(201);
        });
    });

    describe('extractErrorMessage', () => {
        it('extracts error from JSON response', async () => {
            const res = new Response(JSON.stringify({ error: 'something went wrong' }), {
                headers: { 'Content-Type': 'application/json' }
            });
            const msg = await extractErrorMessage(res);
            expect(msg).toBe('something went wrong');
        });

        it('falls back to message field', async () => {
            const res = new Response(JSON.stringify({ message: 'custom msg' }), {
                headers: { 'Content-Type': 'application/json' }
            });
            const msg = await extractErrorMessage(res);
            expect(msg).toBe('custom msg');
        });

        it('falls back to statusText for non-JSON', async () => {
            const res = new Response('plain text', { status: 500, statusText: 'Server Error' });
            const msg = await extractErrorMessage(res);
            expect(msg).toBe('Server Error');
        });
    });
});

describe('health.js', () => {
    const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

    describe('handleHealth', () => {
        it('returns healthy status', async () => {
            const res = handleHealth(corsHeaders);
            const body = await res.json();
            expect(body.status).toBe('healthy');
        });
    });

    describe('handleMetrics', () => {
        it('returns metrics with timestamp', async () => {
            const res = handleMetrics(corsHeaders);
            const body = await res.json();
            expect(body.timestamp).toBeDefined();
            expect(typeof body.activeConnections).toBe('number');
            expect(typeof body.totalMessages).toBe('number');
        });
    });
});

describe('cors.js', () => {
    describe('getCorsHeaders', () => {
        it('returns empty object for unauthorized origin', () => {
            const headers = getCorsHeaders('https://evil.com');
            expect(headers).toEqual({});
        });

        it('returns empty object for null origin', () => {
            const headers = getCorsHeaders(null);
            expect(headers).toEqual({});
        });

        it('returns CORS headers for allowed origin', () => {
            const headers = getCorsHeaders('https://kalpha.mmv.kr');
            expect(headers['Access-Control-Allow-Origin']).toBe('https://kalpha.mmv.kr');
            expect(headers['Access-Control-Allow-Methods']).toBeDefined();
            expect(headers['Access-Control-Allow-Credentials']).toBe('true');
        });
    });

    describe('handleCorsPreflightResponse', () => {
        it('returns response with CORS headers', () => {
            const headers = { 'Access-Control-Allow-Origin': '*' };
            const res = handleCorsPreflightResponse(headers);
            expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
        });
    });
});

describe('do.js', () => {
    describe('getChatRoom', () => {
        it('creates DO stub via idFromName', () => {
            const mockStub = { fetch: vi.fn() };
            const env = {
                CHAT_ROOM: {
                    idFromName: vi.fn((name) => `id:${name}`),
                    get: vi.fn(() => mockStub)
                }
            };
            const stub = getChatRoom(env);
            expect(stub).toBe(mockStub);
            expect(env.CHAT_ROOM.idFromName).toHaveBeenCalled();
        });
    });

    describe('forwardToDO', () => {
        it('forwards request to DO with HMAC header', async () => {
            const mockRoom = { fetch: vi.fn(() => Promise.resolve(new Response('{}'))) };
            const env = {
                CHAT_ROOM: {
                    idFromName: vi.fn(() => 'test-id'),
                    get: vi.fn(() => mockRoom)
                },
                HMAC_SECRET: 'test-secret'
            };
            await forwardToDO(env, '/test-path');
            expect(mockRoom.fetch).toHaveBeenCalledTimes(1);
            const req = mockRoom.fetch.mock.calls[0][0];
            expect(req.headers.get('X-HMAC-Secret')).toBe('test-secret');
        });

        it('sends JSON body when json option is set', async () => {
            const mockRoom = { fetch: vi.fn(() => Promise.resolve(new Response('{}'))) };
            const env = {
                CHAT_ROOM: {
                    idFromName: vi.fn(() => 'test-id'),
                    get: vi.fn(() => mockRoom)
                },
                HMAC_SECRET: 'key'
            };
            await forwardToDO(env, '/test', { method: 'POST', json: { a: 1 } });
            const req = mockRoom.fetch.mock.calls[0][0];
            expect(req.method).toBe('POST');
            expect(req.headers.get('Content-Type')).toBe('application/json');
            const body = await req.json();
            expect(body.a).toBe(1);
        });
    });
});
