import { describe, it, expect } from 'vitest';
import * as constants from '../src/config/constants.js';

describe('constants', () => {
    it('should export SECURITY with required fields', () => {
        expect(constants.SECURITY).toBeDefined();
        expect(Array.isArray(constants.SECURITY.ALLOWED_ORIGINS)).toBe(true);
    });

    it('should export AUTH with required fields', () => {
        expect(constants.AUTH).toBeDefined();
        expect(typeof constants.AUTH.TOKEN_EXPIRY_MS).toBe('number');
    });

    it('should export RATE_LIMIT configs', () => {
        expect(constants.RATE_LIMIT).toBeDefined();
        expect(constants.API_RATE_LIMIT).toBeDefined();
    });

    it('should export AI_SUMMARY', () => {
        expect(constants.AI_SUMMARY).toBeDefined();
        expect(constants.AI_SUMMARY.MODEL_PRIMARY).toBeTruthy();
        expect(constants.AI_SUMMARY.MODEL_FALLBACK).toBeTruthy();
    });

    it('should export UPLOAD limits', () => {
        expect(constants.UPLOAD).toBeDefined();
        expect(typeof constants.UPLOAD.MAX_BYTES).toBe('number');
    });

    it('should export CHANNEL config', () => {
        expect(constants.CHANNEL).toBeDefined();
        expect(typeof constants.CHANNEL.MAX_NAME_LENGTH).toBe('number');
    });

    it('should export DEAD_DROP config', () => {
        expect(constants.DEAD_DROP).toBeDefined();
        expect(typeof constants.DEAD_DROP.TTL_MS).toBe('number');
    });

    it('should export ADMIN config', () => {
        expect(constants.ADMIN).toBeDefined();
        expect(typeof constants.ADMIN.AUDIT_LOG_TRUNCATION).toBe('number');
    });

    it('should export timing constants', () => {
        expect(typeof constants.ONE_MINUTE_MS).toBe('number');
        expect(typeof constants.ONE_HOUR_MS).toBe('number');
        expect(typeof constants.ONE_DAY_MS).toBe('number');
        expect(typeof constants.CLEANUP_INTERVAL_MS).toBe('number');
    });

    it('should export message constants', () => {
        expect(typeof constants.MAX_STORED_MESSAGES).toBe('number');
        expect(typeof constants.MESSAGE_RETENTION_MS).toBe('number');
    });
});
