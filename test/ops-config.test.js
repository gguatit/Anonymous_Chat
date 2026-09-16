import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const toml = readFileSync(fileURLToPath(new URL('../wrangler.toml', import.meta.url)), 'utf-8');

describe('wrangler observability config (H2)', () => {
    it('redacts query strings so credentials in URLs are not persisted in Workers Logs', () => {
        const observability = toml.split('[observability]')[1] ?? '';
        expect(observability).toMatch(/redact_query_string\s*=\s*true/);
    });
});
