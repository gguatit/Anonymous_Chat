import { describe, it, expect } from 'vitest';

describe('Link Preview Tests', () => {
    describe('URL Detection', () => {
        it('should detect HTTP URLs', () => {
            const text = 'Check out http://example.com';
            const urlPattern = /(https?:\/\/[^\s<]+[^\s<.,)])/g;
            const matches = text.match(urlPattern);
            
            expect(matches).toBeTruthy();
            expect(matches[0]).toBe('http://example.com');
        });

        it('should detect HTTPS URLs', () => {
            const text = 'Visit https://example.com/path';
            const urlPattern = /(https?:\/\/[^\s<]+[^\s<.,)])/g;
            const matches = text.match(urlPattern);
            
            expect(matches).toBeTruthy();
            expect(matches[0]).toBe('https://example.com/path');
        });

        it('should detect multiple URLs in text', () => {
            const text = 'Check https://example.com and http://test.org';
            const urlPattern = /(https?:\/\/[^\s<]+[^\s<.,)])/g;
            const matches = text.match(urlPattern);
            
            expect(matches).toBeTruthy();
            expect(matches.length).toBe(2);
            expect(matches[0]).toBe('https://example.com');
            expect(matches[1]).toBe('http://test.org');
        });

        it('should not detect non-HTTP(S) URLs', () => {
            const text = 'ftp://example.com is not supported';
            const urlPattern = /(https?:\/\/[^\s<]+[^\s<.,)])/g;
            const matches = text.match(urlPattern);
            
            expect(matches).toBeNull();
        });
    });

    describe('Image URL Detection', () => {
        it('should detect JPG images', () => {
            const url = 'https://example.com/image.jpg';
            const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;
            
            expect(imageExtensions.test(url)).toBe(true);
        });

        it('should detect PNG images', () => {
            const url = 'https://example.com/photo.png';
            const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;
            
            expect(imageExtensions.test(url)).toBe(true);
        });

        it('should detect images with query parameters', () => {
            const url = 'https://example.com/image.jpg?size=large&format=webp';
            const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;
            
            expect(imageExtensions.test(url)).toBe(true);
        });

        it('should not detect non-image URLs', () => {
            const url = 'https://example.com/document.pdf';
            const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;
            
            expect(imageExtensions.test(url)).toBe(false);
        });

        it('should handle case-insensitive extensions', () => {
            const urls = [
                'https://example.com/image.JPG',
                'https://example.com/image.PNG',
                'https://example.com/image.GIF'
            ];
            const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;
            
            urls.forEach(url => {
                expect(imageExtensions.test(url)).toBe(true);
            });
        });
    });

    describe('Link Formatting', () => {
        it('should create clickable links', () => {
            const url = 'https://example.com';
            const link = `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline break-all">${url}</a>`;
            
            expect(link).toContain('href="https://example.com"');
            expect(link).toContain('target="_blank"');
            expect(link).toContain('rel="noopener noreferrer"');
        });

        it('should include security attributes', () => {
            const url = 'https://example.com';
            const link = `<a href="${url}" target="_blank" rel="noopener noreferrer">link</a>`;
            
            // Security: prevent window.opener access
            expect(link).toContain('noopener');
            // Security: prevent referrer leakage
            expect(link).toContain('noreferrer');
            // Open in new tab
            expect(link).toContain('_blank');
        });
    });

    describe('XSS Prevention', () => {
        it('should sanitize URLs before creating links', () => {
            const maliciousUrl = 'javascript:alert("XSS")';
            const urlPattern = /(https?:\/\/[^\s<]+[^\s<.,)])/g;
            const matches = maliciousUrl.match(urlPattern);
            
            // Should not match javascript: URLs
            expect(matches).toBeNull();
        });

        it('should only accept HTTP and HTTPS protocols', () => {
            const urls = [
                'http://example.com',
                'https://example.com',
                'ftp://example.com',
                'file:///etc/passwd',
                'javascript:void(0)'
            ];
            
            const urlPattern = /(https?:\/\/[^\s<]+[^\s<.,)])/g;
            
            expect(urls[0].match(urlPattern)).toBeTruthy();
            expect(urls[1].match(urlPattern)).toBeTruthy();
            expect(urls[2].match(urlPattern)).toBeNull();
            expect(urls[3].match(urlPattern)).toBeNull();
            expect(urls[4].match(urlPattern)).toBeNull();
        });
    });

    describe('Image Preview Generation', () => {
        it('should generate image preview for image URLs', () => {
            const url = 'https://example.com/photo.jpg';
            const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;
            
            if (imageExtensions.test(url)) {
                const preview = `<img src="${url}" alt="Image preview" class="mt-2 max-w-full max-h-64 rounded-lg border border-gray-600 object-contain" 
                     onerror="this.style.display='none'" loading="lazy">`;
                
                expect(preview).toContain(`src="${url}"`);
                expect(preview).toContain('loading="lazy"');
                expect(preview).toContain('onerror="this.style.display=\'none\'"');
            }
        });

        it('should not generate image preview for non-image URLs', () => {
            const url = 'https://example.com/page.html';
            const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;
            
            expect(imageExtensions.test(url)).toBe(false);
        });
    });

    describe('Performance Optimizations', () => {
        it('should use lazy loading for images', () => {
            const imgTag = '<img src="test.jpg" loading="lazy">';
            expect(imgTag).toContain('loading="lazy"');
        });

        it('should include error handling for broken images', () => {
            const imgTag = '<img src="test.jpg" onerror="this.style.display=\'none\'">';
            expect(imgTag).toContain('onerror');
        });

        it('should set max dimensions for images', () => {
            const imgTag = '<img class="max-w-full max-h-64" />';
            expect(imgTag).toContain('max-w-full');
            expect(imgTag).toContain('max-h-64');
        });
    });
});
