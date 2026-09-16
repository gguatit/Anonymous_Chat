import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const toml = readFileSync(fileURLToPath(new URL('../wrangler.toml', import.meta.url)), 'utf-8');
const headers = readFileSync(fileURLToPath(new URL('../public/_headers', import.meta.url)), 'utf-8');
const indexHtml = readFileSync(fileURLToPath(new URL('../public/index.html', import.meta.url)), 'utf-8');
const securityTxt = readFileSync(fileURLToPath(new URL('../public/.well-known/security.txt', import.meta.url)), 'utf-8');

describe('wrangler observability config (H2)', () => {
    it('redacts query strings so credentials in URLs are not persisted in Workers Logs', () => {
        const observability = toml.split('[observability]')[1] ?? '';
        expect(observability).toMatch(/redact_query_string\s*=\s*true/);
    });
});

describe('self-hosted assets (M9)', () => {
    it('does not allow cdnjs in the CSP', () => {
        expect(headers).not.toContain('cdnjs.cloudflare.com');
    });

    it('does not load Prism from a CDN', () => {
        expect(indexHtml).not.toMatch(/cdnjs\.cloudflare\.com[^"']*prism/i);
    });
});

describe('security config', () => {
    it('security.txt Policy points to SECURITY.md, not the privacy policy', () => {
        const policyLine = securityTxt.split('\n').find(l => l.startsWith('Policy:'));
        expect(policyLine).toContain('SECURITY.md');
        expect(policyLine).not.toContain('privacy.html');
    });
});
