import { describe, it, expect } from 'vitest';
import { calculateRiskScore } from '../src/utils/risk-scorer.js';

describe('risk-scorer', () => {
    const now = Date.now();

    function makeEvent(eventType, score, category, ageMs = 0) {
        return {
            event_type: eventType,
            severity_score: score,
            category,
            timestamp: now - ageMs,
        };
    }

    it('should return zero for empty array', () => {
        const result = calculateRiskScore([]);
        expect(result.score).toBe(0);
        expect(result.eventCount).toBe(0);
    });

    it('should sum severity scores with time weighting', () => {
        const events = [
            makeEvent('LOGIN_FAIL', 25, 'auth', 2 * 60 * 60 * 1000),
            makeEvent('XSS_PAYLOAD', 65, 'input', 3 * 60 * 60 * 1000),
            makeEvent('TOKEN_INVALID', 50, 'auth', 4 * 60 * 60 * 1000),
        ];
        const result = calculateRiskScore(events);
        const expected = Math.round((25 + 65 + 50) * 1.5);
        expect(result.score).toBe(expected);
        expect(result.eventCount).toBe(3);
    });

    it('should apply 2x weight for events within 1 hour', () => {
        const events = [
            makeEvent('SQL_INJECTION', 70, 'input', 30 * 60 * 1000),
            makeEvent('LOGIN_FAIL', 25, 'auth', 30 * 60 * 1000),
        ];
        const result = calculateRiskScore(events);
        expect(result.score).toBe(190);
    });

    it('should apply 1.5x weight for events within 24 hours', () => {
        const events = [
            makeEvent('SQL_INJECTION', 70, 'input', 2 * 60 * 60 * 1000),
            makeEvent('LOGIN_FAIL', 25, 'auth', 3 * 60 * 60 * 1000),
        ];
        const result = calculateRiskScore(events);
        const expected = Math.round(70 * 1.5) + Math.round(25 * 1.5);
        expect(result.score).toBe(expected);
    });

    it('should apply category diversity bonus for 4+ categories', () => {
        const events = [
            makeEvent('LOGIN_FAIL', 25, 'auth', 2 * 24 * 60 * 60 * 1000),
            makeEvent('XSS_PAYLOAD', 65, 'input', 2 * 24 * 60 * 60 * 1000),
            makeEvent('ADMIN_NO_TOKEN', 45, 'endpoint', 2 * 24 * 60 * 60 * 1000),
            makeEvent('WS_FLOOD', 50, 'websocket', 2 * 24 * 60 * 60 * 1000),
        ];
        const result = calculateRiskScore(events);
        expect(result.score).toBe(Math.round(185 * 1.2));
        expect(result.categories.size).toBe(4);
    });

    it('should not apply diversity bonus for <4 categories', () => {
        const events = [
            makeEvent('LOGIN_FAIL', 25, 'auth', 2 * 24 * 60 * 60 * 1000),
            makeEvent('TOKEN_INVALID', 50, 'auth', 2 * 24 * 60 * 60 * 1000),
            makeEvent('RATE_LIMIT_HARD', 40, 'auth', 2 * 24 * 60 * 60 * 1000),
        ];
        const result = calculateRiskScore(events);
        expect(result.score).toBe(115);
    });

    it('should filter out events older than 7 days', () => {
        const events = [
            makeEvent('SQL_INJECTION', 70, 'input', 0),
            makeEvent('OLD_EVENT', 100, 'auth', 8 * 24 * 60 * 60 * 1000),
        ];
        const result = calculateRiskScore(events);
        expect(result.score).toBe(140);
        expect(result.eventCount).toBe(2);
    });

    it('should include event breakdown', () => {
        const events = [
            makeEvent('LOGIN_FAIL', 25, 'auth'),
            makeEvent('LOGIN_FAIL', 25, 'auth'),
            makeEvent('XSS_PAYLOAD', 65, 'input'),
        ];
        const result = calculateRiskScore(events);
        expect(result.breakdown).toEqual({ LOGIN_FAIL: 2, XSS_PAYLOAD: 1 });
    });
});
