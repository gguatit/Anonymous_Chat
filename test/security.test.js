import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src/worker.js';

describe('Security Tests', () => {
    let env;

    beforeEach(() => {
        env = {
            ADMIN_ID: 'testadmin',
            ADMIN_PASSWORD: 'TestP@ssw0rd!',
            HMAC_SECRET: 'test-secret-key-12345',
            ADMIN_TOKENS: {
                data: new Map(),
                async get(key) {
                    return this.data.get(key);
                },
                async put(key, value, options) {
                    this.data.set(key, value);
                },
                async delete(key) {
                    this.data.delete(key);
                }
            },
            ADMIN_LOGS: {
                data: new Map(),
                async get(key) {
                    return this.data.get(key);
                },
                async put(key, value, options) {
                    this.data.set(key, value);
                },
                async list(options) {
                    const keys = Array.from(this.data.keys())
                        .filter(k => k.startsWith(options.prefix))
                        .slice(0, options.limit || 100)
                        .map(name => ({ name }));
                    return { keys };
                }
            }
        };
    });

    describe('Rate Limiting', () => {
        it('should block after 5 failed login attempts', async () => {
            const ip = '192.168.1.100';
            
            // 5번 실패 시도
            for (let i = 0; i < 5; i++) {
                const request = new Request('http://localhost/api/admin/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'CF-Connecting-IP': ip
                    },
                    body: JSON.stringify({
                        id: 'testadmin',
                        password: 'wrongpassword'
                    })
                });

                const response = await worker.fetch(request, env);
                expect(response.status).toBe(401);
            }

            // 6번째 시도 - 차단되어야 함
            const request = new Request('http://localhost/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CF-Connecting-IP': ip
                },
                body: JSON.stringify({
                    id: 'testadmin',
                    password: 'wrongpassword'
                })
            });

            const response = await worker.fetch(request, env);
            expect(response.status).toBe(429);
            
            const data = await response.json();
            expect(data.error).toContain('Too many login attempts');
        });

        it('should reset rate limit after successful login', async () => {
            const ip = '192.168.1.101';
            
            // 3번 실패
            for (let i = 0; i < 3; i++) {
                await worker.fetch(new Request('http://localhost/api/admin/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'CF-Connecting-IP': ip
                    },
                    body: JSON.stringify({
                        id: 'testadmin',
                        password: 'wrongpassword'
                    })
                }), env);
            }

            // 성공
            const successRequest = new Request('http://localhost/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CF-Connecting-IP': ip
                },
                body: JSON.stringify({
                    id: 'testadmin',
                    password: 'TestP@ssw0rd!'
                })
            });

            const successResponse = await worker.fetch(successRequest, env);
            expect(successResponse.status).toBe(200);

            // 카운터가 리셋되어야 하므로 다시 실패 시도 가능
            const retryRequest = new Request('http://localhost/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CF-Connecting-IP': ip
                },
                body: JSON.stringify({
                    id: 'testadmin',
                    password: 'wrongpassword'
                })
            });

            const retryResponse = await worker.fetch(retryRequest, env);
            expect(retryResponse.status).toBe(401); // 429 아님
        });
    });

    describe('Token Blacklist', () => {
        it('should reject revoked tokens', async () => {
            // 로그인
            const loginRequest = new Request('http://localhost/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CF-Connecting-IP': '192.168.1.102',
                    'Origin': 'http://localhost:8787'
                },
                body: JSON.stringify({
                    id: 'testadmin',
                    password: 'TestP@ssw0rd!'
                })
            });

            const loginResponse = await worker.fetch(loginRequest, env);
            expect(loginResponse.status).toBe(200);
            
            const loginData = await loginResponse.json();
            expect(loginData.success).toBe(true);
            expect(loginData.token).toBeDefined();
            
            const { token } = loginData;

            // 토큰으로 API 접근 (성공)
            const metricsRequest1 = new Request('http://localhost/api/admin/verify', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Origin': 'http://localhost:8787'
                }
            });
            const metricsResponse1 = await worker.fetch(metricsRequest1, env);
            expect(metricsResponse1.status).toBe(200);

            // 로그아웃
            const logoutRequest = new Request('http://localhost/api/admin/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'CF-Connecting-IP': '192.168.1.102',
                    'Origin': 'http://localhost:8787'
                }
            });
            await worker.fetch(logoutRequest, env);

            // 같은 토큰으로 재접근 시도 (실패해야 함)
            const metricsRequest2 = new Request('http://localhost/api/admin/verify', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Origin': 'http://localhost:8787'
                }
            });
            const metricsResponse2 = await worker.fetch(metricsRequest2, env);
            expect(metricsResponse2.status).toBe(401);
        });
    });

    describe('Credentials Not Configured', () => {
        it('should reject login when credentials are not set', async () => {
            const emptyEnv = {
                ADMIN_TOKENS: env.ADMIN_TOKENS,
                ADMIN_LOGS: env.ADMIN_LOGS
            };

            const request = new Request('http://localhost/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CF-Connecting-IP': '192.168.1.103'
                },
                body: JSON.stringify({
                    id: 'testadmin',
                    password: 'TestP@ssw0rd!'
                })
            });

            const response = await worker.fetch(request, emptyEnv);
            expect(response.status).toBe(500);
            
            const data = await response.json();
            expect(data.error).toContain('not configured');
        });
    });

    describe('Audit Logging', () => {
        it('should log successful login', async () => {
            const request = new Request('http://localhost/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CF-Connecting-IP': '192.168.1.104',
                    'User-Agent': 'Test Browser'
                },
                body: JSON.stringify({
                    id: 'testadmin',
                    password: 'TestP@ssw0rd!'
                })
            });

            await worker.fetch(request, env);

            // 로그 확인
            const logs = Array.from(env.ADMIN_LOGS.data.values()).map(v => JSON.parse(v));
            const loginLog = logs.find(l => l.type === 'login_success');
            
            expect(loginLog).toBeDefined();
            expect(loginLog.admin).toBe('testadmin');
            expect(loginLog.ip).toBe('192.168.1.104');
            expect(loginLog.userAgent).toBe('Test Browser');
        });

        it('should log failed login', async () => {
            const request = new Request('http://localhost/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CF-Connecting-IP': '192.168.1.105'
                },
                body: JSON.stringify({
                    id: 'testadmin',
                    password: 'wrongpassword'
                })
            });

            await worker.fetch(request, env);

            // 로그 확인
            const logs = Array.from(env.ADMIN_LOGS.data.values()).map(v => JSON.parse(v));
            const failLog = logs.find(l => l.type === 'login_failed');
            
            expect(failLog).toBeDefined();
            expect(failLog.reason).toBe('invalid_credentials');
            expect(failLog.attemptedId).toBe('testadmin');
        });

        it('should log rate limit blocks', async () => {
            const ip = '192.168.1.106';
            
            // 5번 실패 시도
            for (let i = 0; i < 5; i++) {
                await worker.fetch(new Request('http://localhost/api/admin/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'CF-Connecting-IP': ip
                    },
                    body: JSON.stringify({
                        id: 'testadmin',
                        password: 'wrongpassword'
                    })
                }), env);
            }

            // 6번째 - 차단
            await worker.fetch(new Request('http://localhost/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CF-Connecting-IP': ip
                },
                body: JSON.stringify({
                    id: 'testadmin',
                    password: 'wrongpassword'
                })
            }), env);

            // 로그 확인
            const logs = Array.from(env.ADMIN_LOGS.data.values()).map(v => JSON.parse(v));
            const blockLog = logs.find(l => l.type === 'login_blocked');
            
            expect(blockLog).toBeDefined();
            expect(blockLog.reason).toBe('rate_limit_exceeded');
            expect(blockLog.ip).toBe(ip);
        });
    });

    describe('CORS Security', () => {
        it('should allow requests from kalpha.mmv.kr', async () => {
            const request = new Request('http://localhost/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': 'https://kalpha.mmv.kr',
                    'CF-Connecting-IP': '192.168.1.107'
                },
                body: JSON.stringify({
                    id: 'testadmin',
                    password: 'TestP@ssw0rd!'
                })
            });

            const response = await worker.fetch(request, env);
            expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://kalpha.mmv.kr');
        });

        it('should allow requests from localhost', async () => {
            const request = new Request('http://localhost/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': 'http://localhost:8787',
                    'CF-Connecting-IP': '192.168.1.108'
                },
                body: JSON.stringify({
                    id: 'testadmin',
                    password: 'TestP@ssw0rd!'
                })
            });

            const response = await worker.fetch(request, env);
            expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8787');
        });

        it('should reject requests from unknown origins', async () => {
            const request = new Request('http://localhost/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': 'https://evil-hacker.com',
                    'CF-Connecting-IP': '192.168.1.109'
                },
                body: JSON.stringify({
                    id: 'testadmin',
                    password: 'TestP@ssw0rd!'
                })
            });

            const response = await worker.fetch(request, env);
            expect(response.headers.get('Access-Control-Allow-Origin')).not.toBe('https://evil-hacker.com');
            expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://kalpha.mmv.kr');
        });
    });
});
