// Code Highlight Module - Prism.js 기반 코드 구문 강조 및 자동 감지

// Prism autoloader 경로 설정
if (typeof Prism !== 'undefined' && Prism.plugins && Prism.plugins.autoloader) {
    Prism.plugins.autoloader.languages_path = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/';
}

/**
 * 언어 별칭 → Prism 언어명 매핑
 */
const LANG_ALIASES = {
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'rb': 'ruby',
    'cs': 'csharp',
    'c#': 'csharp',
    'c++': 'cpp',
    'md': 'markdown',
    'sh': 'bash',
    'shell': 'bash',
    'yml': 'yaml',
    'html': 'markup',
    'xml': 'markup',
    'svg': 'markup',
    'vue': 'markup',
    'tex': 'latex',
};

/**
 * 언어 별칭을 Prism 언어명으로 변환
 */
function resolveLangAlias(lang) {
    if (!lang) return '';
    const lower = lang.toLowerCase();
    return LANG_ALIASES[lower] || lower;
}

/**
 * 표시용 언어 이름 (헤더 라벨용)
 */
function getDisplayLang(inputLang, resolvedLang) {
    // 사용자가 입력한 원래 이름 우선, 없으면 resolved 사용
    return inputLang || resolvedLang || '';
}

/**
 * 메시지 내용에서 언어를 휴리스틱으로 추정
 */
function detectLanguage(content) {
    const trimmed = content.trim();

    // HTML/XML
    if (/^\s*<(!DOCTYPE|html|head|body|div|span|script|style|link|meta|p|a|ul|ol|li|table|form|input|img)/mi.test(trimmed)) return 'markup';

    // Python
    if (/^(def |class |import |from .+ import |if __name__|print\(|elif |except )/m.test(trimmed)) return 'python';

    // CSS
    if (/^(\.|#|@media|@keyframes|:root|body|html)\s*\{?/m.test(trimmed) && /[{};:]/.test(trimmed)) return 'css';

    // C/C++
    if (/^#include\s*[<"]/.test(trimmed)) return 'cpp';

    // Java
    if (/^(public\s+class|package\s+|import\s+java\.)/m.test(trimmed)) return 'java';

    // C#
    if (/^using\s+System/m.test(trimmed) || /^namespace\s+/m.test(trimmed)) return 'csharp';

    // SQL
    if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s/mi.test(trimmed)) return 'sql';

    // Bash/Shell
    if (/^(#!\/bin\/(bash|sh)|export\s|echo\s|sudo\s|apt |npm |yarn |pip |curl |wget )/m.test(trimmed)) return 'bash';

    // JSON
    if (/^\s*[\[{]/.test(trimmed) && /["\d\]},]$/.test(trimmed.trim())) {
        try { JSON.parse(trimmed); return 'json'; } catch { /* not json */ }
    }

    // TypeScript (check before JS due to overlap)
    if (/^(interface\s|type\s|enum\s|:\s*(string|number|boolean|void|any|Promise))/m.test(trimmed)) return 'typescript';

    // JavaScript (generic)
    if (/^(const |let |var |function |class |import |export |=>)/m.test(trimmed)) return 'javascript';

    // Go
    if (/^(package\s+main|func\s|import\s+\()/m.test(trimmed)) return 'go';

    // Rust
    if (/^(fn\s|let\s+mut|use\s+std|impl\s|pub\s+fn)/m.test(trimmed)) return 'rust';

    // Markdown
    if (/^#{1,6}\s/.test(trimmed) && /(\*\*|__|\[.*\]\(.*\))/.test(trimmed)) return 'markdown';

    return '';
}

/**
 * 코드 블록 HTML 생성
 * @param {string} code - 원본 코드 텍스트
 * @param {string} lang - 언어 (빈 문자열이면 자동 감지)
 * @param {Function} sanitizeFn - HTML 이스케이프 함수
 * @returns {string} 렌더링된 코드 블록 HTML
 */
export function renderCodeBlock(code, lang, sanitizeFn) {
    const trimmedCode = code.replace(/^\n+|\n+$/g, '');
    let resolvedLang = resolveLangAlias(lang);

    // 언어 미지정 시 자동 감지
    if (!resolvedLang) {
        resolvedLang = detectLanguage(trimmedCode);
    }

    const displayLang = getDisplayLang(lang, resolvedLang);
    const langLabel = displayLang ? `<span class="code-block-lang">${sanitizeFn(displayLang)}</span>` : '';
    const copyBtnId = 'copy_' + Math.random().toString(36).substring(2, 9);
    const codeId = 'code_' + Math.random().toString(36).substring(2, 9);
    const safeCode = sanitizeFn(trimmedCode);
    const langClass = resolvedLang ? `language-${sanitizeFn(resolvedLang)}` : '';

    const codeHtml = `<div class="code-block-wrapper">
        <div class="code-block-header">
            ${langLabel}
            <button id="${copyBtnId}" class="code-copy-btn" title="코드 복사">복사</button>
        </div>
        <pre class="code-block"><code id="${codeId}" class="${langClass}">${safeCode}</code></pre>
    </div>`;

    // DOM 삽입 후 Prism 하이라이팅 + 복사 버튼 이벤트 등록
    setTimeout(() => {
        // Prism 하이라이팅
        const codeEl = document.getElementById(codeId);
        if (codeEl && typeof Prism !== 'undefined' && resolvedLang) {
            try {
                Prism.highlightElement(codeEl);
            } catch { /* ignore */ }
        }

        // 복사 버튼 이벤트
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

    // 최소 2줄 이상이어야 코드로 판별
    if (lines.length < 2) return false;

    // 너무 길면 (50줄 초과) 코드로 봄
    if (lines.length > 50) return true;

    let score = 0;

    // 1. 코드 시작 패턴 키워드 검사
    const startPatterns = /^(import\s|from\s|export\s|const\s|let\s|var\s|function[\s(]|class\s|def\s|return\s|if\s*\(|else\s*\{|for\s*\(|while\s*\(|switch\s*\(|try\s*\{|catch\s*\(|#include|#define|#import|using\s|namespace\s|public\s|private\s|protected\s|static\s|void\s|int\s|string\s|bool\s|package\s|interface\s|struct\s|enum\s|<!DOCTYPE|<html|<head|<body|<div|<script|<style|<link|<meta|SELECT\s|INSERT\s|UPDATE\s|DELETE\s|CREATE\s|ALTER\s|DROP\s)/mi;
    if (startPatterns.test(trimmed)) score += 3;

    // 2. 줄 끝 패턴 검사
    let codeEndingLines = 0;
    for (const line of lines) {
        const t = line.trim();
        if (/[;{})\]]=?>?\s*$/.test(t) && t.length > 1) codeEndingLines++;
    }
    const endingRatio = codeEndingLines / lines.length;
    if (endingRatio > 0.4) score += 3;
    else if (endingRatio > 0.2) score += 1;

    // 3. 들여쓰기 패턴
    let indentedLines = 0;
    for (const line of lines) {
        if (/^(\t|  {2,})/.test(line) && line.trim().length > 0) indentedLines++;
    }
    if (indentedLines / lines.length > 0.3) score += 2;

    // 4. 특수 코드 문자 밀도
    const codeChars = (trimmed.match(/[{}();=<>]/g) || []).length;
    const charDensity = codeChars / trimmed.length;
    if (charDensity > 0.08) score += 2;
    else if (charDensity > 0.04) score += 1;

    // 5. 주석 패턴
    if (/\/\/.*|\/\*[\s\S]*?\*\/|^\s*#(?!!).*$/m.test(trimmed)) score += 1;

    // 6. 문자열 리터럴 + 코드 문자
    if (/(["'])(?:(?=(\\?))\2.)*?\1/.test(trimmed) && /[;{}()=]/.test(trimmed)) score += 1;

    // 7. HTML 태그 패턴
    let htmlLines = 0;
    for (const line of lines) {
        if (/^\s*<\/?[a-zA-Z]/.test(line)) htmlLines++;
    }
    if (htmlLines / lines.length > 0.3) score += 3;

    // 8. 언어 감지 성공 여부
    if (detectLanguage(trimmed)) score += 2;

    // 임계값: 5점 이상이면 코드로 판별
    return score >= 5;
}

/**
 * 코드 블록 placeholder 상수
 */
export const CODE_BLOCK_PREFIX = '\u200B\u200BCODEBLOCK';
export const INLINE_CODE_PREFIX = '\u200B\u200BINLINECODE';
export const PLACEHOLDER_SUFFIX = '\u200B\u200B';
