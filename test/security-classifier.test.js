import { describe, it, expect } from 'vitest';
import { classifyContent, classifyURLPath, classifyPayloadSize } from '../src/utils/security-classifier.js';
import { SECURITY_EVENTS } from '../src/constants/security-events.js';

describe('security-classifier', () => {
    describe('classifyContent', () => {
        it('should return null for safe content', () => {
            expect(classifyContent('Hello, world!')).toBeNull();
            expect(classifyContent('')).toBeNull();
            expect(classifyContent(null)).toBeNull();
            expect(classifyContent(undefined)).toBeNull();
        });

        it('should detect XSS payloads', () => {
            expect(classifyContent('<script>alert(1)</script>')).toEqual(SECURITY_EVENTS.XSS_PAYLOAD);
            expect(classifyContent('<img onerror="alert(1)">')).toEqual(SECURITY_EVENTS.XSS_PAYLOAD);
            expect(classifyContent('javascript:void(0)')).toEqual(SECURITY_EVENTS.XSS_PAYLOAD);
            expect(classifyContent('<svg onload="fetch(\'/\')">')).toEqual(SECURITY_EVENTS.XSS_PAYLOAD);
            expect(classifyContent('<iframe src="evil.com">')).toEqual(SECURITY_EVENTS.XSS_PAYLOAD);
        });

        it('should detect SQL injection payloads', () => {
            expect(classifyContent("' OR 1=1 --")).toEqual(SECURITY_EVENTS.SQL_INJECTION);
            expect(classifyContent("UNION SELECT * FROM users")).toEqual(SECURITY_EVENTS.SQL_INJECTION);
            expect(classifyContent("DROP TABLE users; --")).toEqual(SECURITY_EVENTS.SQL_INJECTION);
            expect(classifyContent("1'; SELECT * FROM information_schema.tables")).toEqual(SECURITY_EVENTS.SQL_INJECTION);
        });

        it('should detect path traversal payloads', () => {
            expect(classifyContent('../../etc/passwd')).toEqual(SECURITY_EVENTS.PATH_TRAVERSAL);
            expect(classifyContent('..\\..\\windows\\system32')).toEqual(SECURITY_EVENTS.PATH_TRAVERSAL);
            expect(classifyContent('/etc/passwd')).toEqual(SECURITY_EVENTS.PATH_TRAVERSAL);
        });

        it('should prioritize SQL over XSS when both patterns match', () => {
            const result = classifyContent("' OR 1=1; <script>alert(1)</script>");
            expect(result).toEqual(SECURITY_EVENTS.SQL_INJECTION);
        });
    });

    describe('classifyURLPath', () => {
        it('should return null for safe paths', () => {
            expect(classifyURLPath('/api/chat')).toBeNull();
            expect(classifyURLPath('/')).toBeNull();
            expect(classifyURLPath(null)).toBeNull();
        });

        it('should detect path traversal in URLs', () => {
            expect(classifyURLPath('/../../etc/passwd')).toEqual(SECURITY_EVENTS.PATH_TRAVERSAL);
            expect(classifyURLPath('/..\\..\\windows')).toEqual(SECURITY_EVENTS.PATH_TRAVERSAL);
        });
    });

    describe('classifyPayloadSize', () => {
        it('should return null for normal payloads', () => {
            expect(classifyPayloadSize(1024)).toBeNull();
            expect(classifyPayloadSize(0)).toBeNull();
        });

        it('should detect oversized payloads', () => {
            expect(classifyPayloadSize(2 * 1024 * 1024)).toEqual(SECURITY_EVENTS.OVERSIZED_PAYLOAD);
        });
    });
});
