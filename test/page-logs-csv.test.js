import { describe, it, expect } from 'vitest';
import { csvField } from '../public/js/pages/page-logs.js';

describe('audit CSV formula injection guard', () => {
    it('prefixes risky leading characters with a single quote', () => {
        expect(csvField('=SUM(A1)')).toBe("'=SUM(A1)");
        expect(csvField('+cmd')).toBe("'+cmd");
        expect(csvField('-2+3')).toBe("'-2+3");
        expect(csvField('@x')).toBe("'@x");
    });

    it('leaves normal text alone and doubles embedded quotes', () => {
        expect(csvField('hello')).toBe('hello');
        expect(csvField('say "hi"')).toBe('say ""hi""');
        expect(csvField(null)).toBe('');
    });
});
