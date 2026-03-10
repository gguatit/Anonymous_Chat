// Code Highlight Module - 코드 구문 강조 및 자동 감지

/**
 * 코드 블록 HTML 생성
 * @param {string} code - 원본 코드 텍스트
 * @param {string} lang - 언어 (빈 문자열이면 자동 감지)
 * @param {Function} sanitizeFn - HTML 이스케이프 함수
 * @returns {string} 렌더링된 코드 블록 HTML
 */
export function renderCodeBlock(code, lang, sanitizeFn) {
    const trimmedCode = code.replace(/^\n+|\n+$/g, '');

    let highlightedCode;
    let detectedLang = lang;
    try {
        if (typeof hljs !== 'undefined') {
            if (lang && hljs.getLanguage(lang)) {
                highlightedCode = hljs.highlight(trimmedCode, { language: lang }).value;
            } else {
                const result = hljs.highlightAuto(trimmedCode);
                highlightedCode = result.value;
                if (!lang && result.language) {
                    detectedLang = result.language;
                }
            }
        } else {
            highlightedCode = sanitizeFn(trimmedCode);
        }
    } catch {
        highlightedCode = sanitizeFn(trimmedCode);
    }

    const langLabel = detectedLang ? `<span class="code-block-lang">${sanitizeFn(detectedLang)}</span>` : '';
    const copyBtnId = 'copy_' + Math.random().toString(36).substring(2, 9);
    const codeHtml = `<div class="code-block-wrapper">
        <div class="code-block-header">
            ${langLabel}
            <button id="${copyBtnId}" class="code-copy-btn" title="코드 복사">복사</button>
        </div>
        <pre class="code-block"><code class="hljs${detectedLang ? ` language-${sanitizeFn(detectedLang)}` : ''}">${highlightedCode}</code></pre>
    </div>`;

    // 복사 버튼 이벤트 등록
    setTimeout(() => {
        const btn = document.getElementById(copyBtnId);
        if (btn) {
            btn.addEventListener('click', () => {
                navigator.clipboard.writeText(trimmedCode).then(() => {
                    btn.textContent = '복사됨!';
                    setTimeout(() => { btn.textContent = '복사'; }, 2000);
                }).catch(() => {
                    btn.textContent = '실패';
                    setTimeout(() => { btn.textContent = '복사'; }, 2000);
                });
            });
        }
    }, 0);

    return codeHtml;
}

/**
 * 메시지가 코드인지 휴리스틱으로 판별
 * @param {string} content - 메시지 텍스트
 * @returns {boolean} 코드 여부
 */
export function isLikelyCode(content) {
    if (!content || typeof content !== 'string') return false;

    const trimmed = content.trim();
    const lines = trimmed.split(/\r?\n/);

    // 최소 2줄 이상이어야 코드로 판별 (한 줄은 일반 대화일 가능성 높음)
    if (lines.length < 2) return false;

    // 너무 길면 (50줄 초과) 코드로 봄 - 일반 대화로 50줄 이상 쓰는 경우는 거의 없음
    if (lines.length > 50) return true;

    let score = 0;

    // 1. 코드 시작 패턴 키워드 검사 (줄 시작 기준)
    const startPatterns = /^(import\s|from\s|export\s|const\s|let\s|var\s|function[\s(]|class\s|def\s|return\s|if\s*\(|else\s*\{|for\s*\(|while\s*\(|switch\s*\(|try\s*\{|catch\s*\(|#include|#define|#import|using\s|namespace\s|public\s|private\s|protected\s|static\s|void\s|int\s|string\s|bool\s|package\s|interface\s|struct\s|enum\s|<!DOCTYPE|<html|<head|<body|<div|<script|<style|<link|<meta|SELECT\s|INSERT\s|UPDATE\s|DELETE\s|CREATE\s|ALTER\s|DROP\s)/mi;
    if (startPatterns.test(trimmed)) score += 3;

    // 2. 줄 끝 패턴 검사 (;, {, }, => 등)
    let codeEndingLines = 0;
    for (const line of lines) {
        const t = line.trim();
        if (/[;{})\]]=?>?\s*$/.test(t) && t.length > 1) codeEndingLines++;
    }
    const endingRatio = codeEndingLines / lines.length;
    if (endingRatio > 0.4) score += 3;
    else if (endingRatio > 0.2) score += 1;

    // 3. 들여쓰기 패턴 (2칸 또는 4칸 스페이스, 탭)
    let indentedLines = 0;
    for (const line of lines) {
        if (/^(\t|  {2,})/.test(line) && line.trim().length > 0) indentedLines++;
    }
    const indentRatio = indentedLines / lines.length;
    if (indentRatio > 0.3) score += 2;

    // 4. 특수 코드 문자 밀도
    const codeChars = (trimmed.match(/[{}();=<>]/g) || []).length;
    const charDensity = codeChars / trimmed.length;
    if (charDensity > 0.08) score += 2;
    else if (charDensity > 0.04) score += 1;

    // 5. 주석 패턴 (//, /*, #)
    if (/\/\/.*|\/\*[\s\S]*?\*\/|^\s*#(?!!).*$/m.test(trimmed)) score += 1;

    // 6. 문자열 리터럴 패턴
    if (/(["'])(?:(?=(\\?))\2.)*?\1/.test(trimmed) && /[;{}()=]/.test(trimmed)) score += 1;

    // 7. HTML 태그 패턴 (< 로 시작하는 줄이 여러 개)
    let htmlLines = 0;
    for (const line of lines) {
        if (/^\s*<\/?[a-zA-Z]/.test(line)) htmlLines++;
    }
    if (htmlLines / lines.length > 0.3) score += 3;

    // 8. highlight.js 자동 감지 신뢰도 확인
    if (typeof hljs !== 'undefined' && lines.length >= 3) {
        try {
            const result = hljs.highlightAuto(trimmed);
            if (result.relevance > 10) score += 3;
            else if (result.relevance > 5) score += 1;
        } catch { /* ignore */ }
    }

    // 임계값: 5점 이상이면 코드로 판별
    return score >= 5;
}

/**
 * 코드 블록 placeholder 상수
 */
export const CODE_BLOCK_PREFIX = '\u200B\u200BCODEBLOCK';
export const INLINE_CODE_PREFIX = '\u200B\u200BINLINECODE';
export const PLACEHOLDER_SUFFIX = '\u200B\u200B';
