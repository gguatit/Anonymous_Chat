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
    return inputLang || resolvedLang || '';
}

/**
 * 메시지 내용에서 언어를 휴리스틱으로 추정
 * 순서가 중요 — 더 구체적인 패턴을 먼저 검사
 */
export function detectLanguage(content) {
    const trimmed = content.trim();

    // === 매우 구체적인 패턴 (오탐 가능성 낮음) ===

    // C/C++ — #include는 C/C++에만 존재
    if (/^#include\s*[<"]/m.test(trimmed)) return 'cpp';

    // Bash/Shell — shebang 또는 셸 전용 명령어
    if (/^#!\/bin\/(bash|sh|zsh)/m.test(trimmed)) return 'bash';
    if (/^(export\s+\w+=|alias\s+\w+=|source\s+|chmod\s+|echo\s+["'])/m.test(trimmed) && !/;\s*$/.test(trimmed.split('\n')[0])) return 'bash';

    // JSON — 유효한 JSON 파싱
    if (/^\s*[{[]/.test(trimmed)) {
        try { JSON.parse(trimmed); return 'json'; } catch (_e) { /* not json */ }
    }

    // HTML/XML — DOCTYPE이나 HTML 태그로 시작
    if (/^\s*<(!DOCTYPE|html|head|body|div|span|script|style|link|meta|p\s|p>|a\s|ul|ol|li|table|form|input|img|section|header|footer|nav|main)/mi.test(trimmed)) return 'markup';

    // SQL — SQL 키워드로 시작
    if (/^(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+(TABLE|INDEX|VIEW|DATABASE)|ALTER\s+TABLE|DROP\s+TABLE)\s/mi.test(trimmed)) return 'sql';

    // === 언어 고유 키워드 (중간 수준) ===

    // Rust — fn, let mut, impl 등 고유 패턴
    if (/^(fn\s+\w+|let\s+mut\s|use\s+std::|impl\s+\w+|pub\s+fn\s)/m.test(trimmed)) return 'rust';

    // Go — package + func 조합
    if (/^package\s+\w+/m.test(trimmed) && /^(func\s|import\s)/m.test(trimmed)) return 'go';

    // C# — using System 또는 namespace + { 조합
    if (/^using\s+System/m.test(trimmed)) return 'csharp';
    if (/^namespace\s+[\w.]+\s*\{/m.test(trimmed)) return 'csharp';

    // Java — public class, package + ;, import java.
    if (/^(public\s+class\s+\w+|package\s+[\w.]+\s*;|import\s+java\.)/m.test(trimmed)) return 'java';

    // Python — def func(): 또는 class Class:, from x import 등
    if (/^(def\s+\w+\s*\(|class\s+\w+.*:\s*$|from\s+\w+\s+import\s|if\s+__name__\s*==|print\s*\(|elif\s|except\s)/m.test(trimmed)) return 'python';

    // CSS — 셀렉터 + { } 블록 (# 뒤에 반드시 알파벳)
    if (/^(\.[a-zA-Z_][\w-]*|#[a-zA-Z_][\w-]*|@media\s|@keyframes\s|@import\s|:root\s*\{|body\s*\{|html\s*\{|\*\s*\{)/m.test(trimmed) && /\{[\s\S]*\}/.test(trimmed)) return 'css';

    // TypeScript — interface, type alias, 타입 어노테이션
    if (/^(interface\s+\w+\s*\{|type\s+\w+\s*=|enum\s+\w+\s*\{)/m.test(trimmed)) return 'typescript';
    if (/:\s*(string|number|boolean|void|any|never|Promise<)/m.test(trimmed) && /^(const|let|var|function|class|export|import)\s/m.test(trimmed)) return 'typescript';

    // JavaScript — 일반 JS 패턴 (가장 마지막 - 다른 언어와 겹치는 키워드 많음)
    if (/^(const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|function\s+\w+|class\s+\w+\s*\{|import\s+.*\s+from\s|export\s+(default\s+)?)/m.test(trimmed)) return 'javascript';

    // Markdown — # 제목 + 마크다운 문법
    if (/^#{1,6}\s/m.test(trimmed) && /(\*\*|__|\[.*\]\(.*\)|^-\s|^\d+\.\s)/m.test(trimmed)) return 'markdown';

    return '';
}

/**
 * 코드 블록 HTML 생성
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

    setTimeout(() => {
        const codeEl = document.getElementById(codeId);
        if (codeEl && typeof Prism !== 'undefined' && resolvedLang) {
            try {
                Prism.highlightElement(codeEl);
            } catch (_e) { /* ignore */ }
        }

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

    // 1. 코드 시작 패턴 키워드 검사 (shebang 포함)
    const startPatterns = /^(#!\/bin\/|import\s|from\s|export\s|const\s|let\s|var\s|function[\s(]|class\s|def\s|return\s|if\s*\(|else\s*\{|for\s*\(|while\s*\(|switch\s*\(|try\s*\{|catch\s*\(|#include|#define|#import|using\s|namespace\s|public\s|private\s|protected\s|static\s|void\s|int\s|string\s|bool\s|package\s|interface\s|struct\s|enum\s|<!DOCTYPE|<html|<head|<body|<div|<script|<style|<link|<meta|SELECT\s|INSERT\s|UPDATE\s|DELETE\s|CREATE\s|ALTER\s|DROP\s)/mi;
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

    // 5. 주석 패턴 (shebang #!도 인정)
    if (/\/\/.*|\/\*[\s\S]*?\*\/|^\s*#.*$/m.test(trimmed)) score += 1;

    // 6. 문자열 리터럴 + 코드 문자
    if (/(["'])(?:(?=(\\?))\2.)*?\1/.test(trimmed) && /[;{}()=]/.test(trimmed)) score += 1;

    // 7. HTML 태그 패턴
    let htmlLines = 0;
    for (const line of lines) {
        if (/^\s*<\/?[a-zA-Z]/.test(line)) htmlLines++;
    }
    if (htmlLines / lines.length > 0.3) score += 3;

    // 8. 언어 감지 성공 여부 (강한 신호)
    if (detectLanguage(trimmed)) score += 3;

    // 임계값: 5점 이상이면 코드로 판별
    return score >= 5;
}

/**
 * 코드 블록 placeholder 상수
 */
export const CODE_BLOCK_PREFIX = '\u200B\u200BCODEBLOCK';
export const INLINE_CODE_PREFIX = '\u200B\u200BINLINECODE';
export const PLACEHOLDER_SUFFIX = '\u200B\u200B';
