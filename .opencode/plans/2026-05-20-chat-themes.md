# 채팅 테마 변경 기능 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 6가지 프리셋 테마(다크, 라이트, 미드나잇, 오션, 포레스트, 선셋)를 `[data-theme]` 셀렉터로 Tailwind CDN 유틸리티 클래스를 오버라이드하고, platform-info 패널 상단에 테마 선택 리스트를 배치한다.

**Architecture:** `[data-theme="name"]` 셀렉터가 `.bg-gray-900`, `.text-gray-100` 등 Tailwind CDN이 생성하는 유틸리티 클래스를 오버라이드. 테마 전환은 `<html data-theme>` 변경 + `localStorage` 저장. platform-info 패널 상단에 6개 테마를 컬러 닷 + 라벨 리스트로 나열, 한 번 클릭으로 즉시 전환. 모바일 헤더 혼잡 방지.

**Tech Stack:** CSS attribute selectors, Tailwind CDN (no build), Vanilla JS ES Modules, localStorage

---

### Task 1: 테마 CSS 파일 생성

**Files:**
- Create: `public/css/themes.css`

- [ ] **Step 1: 6개 테마 컬러 프리셋 + 라이트 모드 특수 오버라이드**

```css
/* ========== Theme: dark (기본, 현재와 동일) ========== */
[data-theme="dark"] .bg-gray-900,
[data-theme="dark"] .bg-gray-900\/90 { background-color: #111827; }
[data-theme="dark"] .bg-gray-800,
[data-theme="dark"] .bg-gray-800\/90 { background-color: #1F2937; }
[data-theme="dark"] .bg-gray-700,
[data-theme="dark"] .bg-gray-700\/50,
[data-theme="dark"] .bg-gray-700\/80 { background-color: #374151; }
[data-theme="dark"] .bg-gray-600 { background-color: #4B5563; }
[data-theme="dark"] .text-gray-100 { color: #F3F4F6; }
[data-theme="dark"] .text-gray-200 { color: #E5E7EB; }
[data-theme="dark"] .text-gray-300 { color: #D1D5DB; }
[data-theme="dark"] .text-gray-400 { color: #9CA3AF; }
[data-theme="dark"] .text-gray-500 { color: #6B7280; }
[data-theme="dark"] .border-gray-700 { border-color: #374151; }
[data-theme="dark"] .border-gray-600 { border-color: #4B5563; }
[data-theme="dark"] .hover\:bg-gray-700:hover { background-color: #374151; }
[data-theme="dark"] .hover\:bg-gray-600:hover { background-color: #4B5563; }
[data-theme="dark"] .hover\:text-gray-200:hover { color: #E5E7EB; }

/* ========== Theme: light ========== */
[data-theme="light"] .bg-gray-900,
[data-theme="light"] .bg-gray-900\/90 { background-color: #F9FAFB; }
[data-theme="light"] .bg-gray-800,
[data-theme="light"] .bg-gray-800\/90 { background-color: #FFFFFF; }
[data-theme="light"] .bg-gray-700,
[data-theme="light"] .bg-gray-700\/50,
[data-theme="light"] .bg-gray-700\/80 { background-color: #F3F4F6; }
[data-theme="light"] .bg-gray-600 { background-color: #E5E7EB; }
[data-theme="light"] .text-gray-100 { color: #111827; }
[data-theme="light"] .text-gray-200 { color: #1F2937; }
[data-theme="light"] .text-gray-300 { color: #374151; }
[data-theme="light"] .text-gray-400 { color: #6B7280; }
[data-theme="light"] .text-gray-500 { color: #9CA3AF; }
[data-theme="light"] .text-gray-600 { color: #D1D5DB; }
[data-theme="light"] .border-gray-700 { border-color: #E5E7EB; }
[data-theme="light"] .border-gray-600 { border-color: #D1D5DB; }
[data-theme="light"] .hover\:bg-gray-700:hover { background-color: #E5E7EB; }
[data-theme="light"] .hover\:bg-gray-600:hover { background-color: #D1D5DB; }
[data-theme="light"] .hover\:text-gray-200:hover { color: #1F2937; }
[data-theme="light"] .hover\:text-gray-300:hover { color: #374151; }
[data-theme="light"] .placeholder-gray-400::placeholder { color: #9CA3AF; }
[data-theme="light"] .bg-blue-900\/80 { background-color: rgba(219,234,254,0.95); }
[data-theme="light"] .bg-yellow-900\/20 { background-color: rgba(254,243,199,0.8); }
[data-theme="light"] .code-block-wrapper { background: #F3F4F6; border-color: #D1D5DB; }
[data-theme="light"] .code-block-header { background: #E5E7EB; border-color: #D1D5DB; }
[data-theme="light"] .code-block-lang { color: #6B7280; }
[data-theme="light"] .code-block { background: #F3F4F6; }
[data-theme="light"] .code-block code { color: #1F2937; }
[data-theme="light"] .inline-code { background: rgba(209,213,219,0.5); color: #1F2937; }
[data-theme="light"] .code-copy-btn { color: #6B7280; border-color: #D1D5DB; }
[data-theme="light"] .code-copy-btn:hover { color: #374151; background: #E5E7EB; border-color: #9CA3AF; }
[data-theme="light"] #search-results-container { scrollbar-color: #D1D5DB transparent; }
[data-theme="light"] input.bg-gray-700,
[data-theme="light"] textarea.bg-gray-700 { background-color: #F3F4F6; color: #1F2937; }
[data-theme="light"] .bg-black\/80 { background-color: rgba(0,0,0,0.4); }
[data-theme="light"] .bg-black\/70 { background-color: rgba(0,0,0,0.3); }

/* ========== Theme: midnight (slate 계열) ========== */
[data-theme="midnight"] .bg-gray-900,
[data-theme="midnight"] .bg-gray-900\/90 { background-color: #0F172A; }
[data-theme="midnight"] .bg-gray-800,
[data-theme="midnight"] .bg-gray-800\/90 { background-color: #1E293B; }
[data-theme="midnight"] .bg-gray-700,
[data-theme="midnight"] .bg-gray-700\/50,
[data-theme="midnight"] .bg-gray-700\/80 { background-color: #334155; }
[data-theme="midnight"] .bg-gray-600 { background-color: #475569; }
[data-theme="midnight"] .text-gray-100 { color: #F1F5F9; }
[data-theme="midnight"] .text-gray-200 { color: #E2E8F0; }
[data-theme="midnight"] .text-gray-300 { color: #CBD5E1; }
[data-theme="midnight"] .text-gray-400 { color: #94A3B8; }
[data-theme="midnight"] .text-gray-500 { color: #64748B; }
[data-theme="midnight"] .border-gray-700 { border-color: #334155; }
[data-theme="midnight"] .border-gray-600 { border-color: #475569; }
[data-theme="midnight"] .hover\:bg-gray-700:hover { background-color: #334155; }
[data-theme="midnight"] .hover\:bg-gray-600:hover { background-color: #475569; }
[data-theme="midnight"] .hover\:text-gray-200:hover { color: #E2E8F0; }

/* ========== Theme: ocean (teal/cyan 계열) ========== */
[data-theme="ocean"] .bg-gray-900,
[data-theme="ocean"] .bg-gray-900\/90 { background-color: #042F2E; }
[data-theme="ocean"] .bg-gray-800,
[data-theme="ocean"] .bg-gray-800\/90 { background-color: #134E4A; }
[data-theme="ocean"] .bg-gray-700,
[data-theme="ocean"] .bg-gray-700\/50,
[data-theme="ocean"] .bg-gray-700\/80 { background-color: #115E59; }
[data-theme="ocean"] .bg-gray-600 { background-color: #0F766E; }
[data-theme="ocean"] .text-gray-100 { color: #F0FDFA; }
[data-theme="ocean"] .text-gray-200 { color: #CCFBF1; }
[data-theme="ocean"] .text-gray-300 { color: #99F6E4; }
[data-theme="ocean"] .text-gray-400 { color: #5EEAD4; }
[data-theme="ocean"] .text-gray-500 { color: #2DD4BF; }
[data-theme="ocean"] .border-gray-700 { border-color: #115E59; }
[data-theme="ocean"] .border-gray-600 { border-color: #0F766E; }
[data-theme="ocean"] .hover\:bg-gray-700:hover { background-color: #115E59; }
[data-theme="ocean"] .hover\:bg-gray-600:hover { background-color: #0F766E; }
[data-theme="ocean"] .hover\:text-gray-200:hover { color: #CCFBF1; }

/* ========== Theme: forest (green 계열) ========== */
[data-theme="forest"] .bg-gray-900,
[data-theme="forest"] .bg-gray-900\/90 { background-color: #052E16; }
[data-theme="forest"] .bg-gray-800,
[data-theme="forest"] .bg-gray-800\/90 { background-color: #14532D; }
[data-theme="forest"] .bg-gray-700,
[data-theme="forest"] .bg-gray-700\/50,
[data-theme="forest"] .bg-gray-700\/80 { background-color: #166534; }
[data-theme="forest"] .bg-gray-600 { background-color: #15803D; }
[data-theme="forest"] .text-gray-100 { color: #F0FDF4; }
[data-theme="forest"] .text-gray-200 { color: #DCFCE7; }
[data-theme="forest"] .text-gray-300 { color: #BBF7D0; }
[data-theme="forest"] .text-gray-400 { color: #86EFAC; }
[data-theme="forest"] .text-gray-500 { color: #4ADE80; }
[data-theme="forest"] .border-gray-700 { border-color: #166534; }
[data-theme="forest"] .border-gray-600 { border-color: #15803D; }
[data-theme="forest"] .hover\:bg-gray-700:hover { background-color: #166534; }
[data-theme="forest"] .hover\:bg-gray-600:hover { background-color: #15803D; }
[data-theme="forest"] .hover\:text-gray-200:hover { color: #DCFCE7; }

/* ========== Theme: sunset (warm stone/orange) ========== */
[data-theme="sunset"] .bg-gray-900,
[data-theme="sunset"] .bg-gray-900\/90 { background-color: #1C1917; }
[data-theme="sunset"] .bg-gray-800,
[data-theme="sunset"] .bg-gray-800\/90 { background-color: #292524; }
[data-theme="sunset"] .bg-gray-700,
[data-theme="sunset"] .bg-gray-700\/50,
[data-theme="sunset"] .bg-gray-700\/80 { background-color: #44403C; }
[data-theme="sunset"] .bg-gray-600 { background-color: #57534E; }
[data-theme="sunset"] .text-gray-100 { color: #FFF7ED; }
[data-theme="sunset"] .text-gray-200 { color: #FFEDD5; }
[data-theme="sunset"] .text-gray-300 { color: #FED7AA; }
[data-theme="sunset"] .text-gray-400 { color: #FDBA74; }
[data-theme="sunset"] .text-gray-500 { color: #F97316; }
[data-theme="sunset"] .border-gray-700 { border-color: #44403C; }
[data-theme="sunset"] .border-gray-600 { border-color: #57534E; }
[data-theme="sunset"] .hover\:bg-gray-700:hover { background-color: #44403C; }
[data-theme="sunset"] .hover\:bg-gray-600:hover { background-color: #57534E; }
[data-theme="sunset"] .hover\:text-gray-200:hover { color: #FFEDD5; }

/* ========== Scrollbar 공통 (base.css에서 분리된 것) ========== */
#messages-container { scrollbar-width: none; -ms-overflow-style: none; }
#messages-container::-webkit-scrollbar { display: none; }
```

---

### Task 2: index.html 수정

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: `<html>` 태그에 `data-theme` 속성 추가**

Line 2, 변경 전: `<html lang="ko">`
변경 후: `<html lang="ko" data-theme="dark">`

- [ ] **Step 2: themes.css 링크 추가**

Line 63 (`code-highlight.css` 바로 아래):

```html
<link rel="stylesheet" href="/css/code-highlight.css">
<link rel="stylesheet" href="/css/themes.css">
```

- [ ] **Step 3: theme-color meta에 id 추가**

Line 22, 변경 전: `<meta name="theme-color" content="#1F2937">`
변경 후: `<meta name="theme-color" id="theme-color-meta" content="#1F2937">`

- [ ] **Step 4: platform-info 패널 상단에 테마 선택 섹션 추가**

Line 138 (`<div class="p-4">` 바로 아래, 모바일 닉네임 영역 위에 추가:

```html
<div class="mb-6 bg-gray-700/50 rounded-lg p-4 border border-gray-600" id="theme-section">
    <h4 class="text-sm font-bold text-gray-200 mb-3 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a10 10 0 1 0 0 20"/>
            <path d="M2 12h20"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10"/>
            <path d="M12 2a15.3 15.3 0 0 0-4 10 15.3 15.3 0 0 0 4 10"/>
        </svg>
        테마
    </h4>
    <div class="space-y-1">
        <button data-theme-value="dark" class="theme-option w-full text-left px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-2.5 text-gray-200 hover:bg-gray-600/50">
            <span class="w-3.5 h-3.5 rounded-full bg-gray-500 border border-gray-400 shrink-0"></span> 다크
        </button>
        <button data-theme-value="light" class="theme-option w-full text-left px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-2.5 text-gray-200 hover:bg-gray-600/50">
            <span class="w-3.5 h-3.5 rounded-full bg-white border border-gray-300 shrink-0"></span> 라이트
        </button>
        <button data-theme-value="midnight" class="theme-option w-full text-left px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-2.5 text-gray-200 hover:bg-gray-600/50">
            <span class="w-3.5 h-3.5 rounded-full bg-indigo-600 border border-indigo-400 shrink-0"></span> 미드나잇
        </button>
        <button data-theme-value="ocean" class="theme-option w-full text-left px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-2.5 text-gray-200 hover:bg-gray-600/50">
            <span class="w-3.5 h-3.5 rounded-full bg-teal-600 border border-teal-400 shrink-0"></span> 오션
        </button>
        <button data-theme-value="forest" class="theme-option w-full text-left px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-2.5 text-gray-200 hover:bg-gray-600/50">
            <span class="w-3.5 h-3.5 rounded-full bg-green-700 border border-green-400 shrink-0"></span> 포레스트
        </button>
        <button data-theme-value="sunset" class="theme-option w-full text-left px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-2.5 text-gray-200 hover:bg-gray-600/50">
            <span class="w-3.5 h-3.5 rounded-full bg-orange-700 border border-orange-400 shrink-0"></span> 선셋
        </button>
    </div>
</div>
```

선택된 테마는 ✓ 체크마크 + 볼드로 표시 (JS에서 `.theme-option.active` 클래스로 제어).

- [ ] **Step 5: panel 닫을 때 ESC 키에도 테마 동작 방해하지 않는 것 확인** (기존 ESC 핸들러 그대로 동작)

---

### Task 3: ThemeManager JS 모듈 생성

**Files:**
- Create: `public/js/theme.js`

- [ ] **Step 1: ThemeManager 클래스 작성**

platform-info 패널 안에 테마 선택 리스트가 있으므로, 드롭다운 토글 로직 없이 리스트 클릭만 처리하는 단순한 구조:

```js
const THEMES = ['dark', 'light', 'midnight', 'ocean', 'forest', 'sunset'];
const META_COLORS = { dark: '#1F2937', light: '#FFFFFF', midnight: '#1E293B', ocean: '#134E4A', forest: '#14532D', sunset: '#292524' };

export class ThemeManager {
    constructor() {
        this.options = document.querySelectorAll('.theme-option');
        this.meta = document.getElementById('theme-color-meta');
        this.current = this.load();
        this.apply(this.current);
        this.bindEvents();
    }

    load() {
        try {
            const saved = localStorage.getItem('chatTheme');
            if (saved && THEMES.includes(saved)) return saved;
        } catch (e) { /* ignore */ }
        return 'dark';
    }

    save(theme) {
        try { localStorage.setItem('chatTheme', theme); } catch (e) { /* ignore */ }
    }

    apply(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (this.meta && META_COLORS[theme]) {
            this.meta.setAttribute('content', META_COLORS[theme]);
        }
        this.current = theme;
        this.highlightActive();
    }

    setTheme(theme) {
        if (!THEMES.includes(theme)) return;
        this.apply(theme);
        this.save(theme);
    }

    highlightActive() {
        this.options.forEach(opt => {
            opt.classList.remove('active');
            opt.querySelector('.theme-check')?.remove();
            if (opt.dataset.themeValue === this.current) {
                opt.classList.add('active');
                opt.style.fontWeight = '600';
                const check = document.createElement('span');
                check.className = 'theme-check ml-auto text-blue-400 text-xs';
                check.innerHTML = '&#10003;';
                opt.appendChild(check);
            } else {
                opt.style.fontWeight = '';
            }
        });
    }

    bindEvents() {
        this.options.forEach(opt => {
            opt.addEventListener('click', () => {
                this.setTheme(opt.dataset.themeValue);
            });
        });
    }
}
```

---

### Task 4: chat.js에 연동

**Files:**
- Modify: `public/js/chat.js`

- [ ] **Step 1: Line 1의 import 블록에 추가**

```js
import { ThemeManager } from './theme.js?v=1.0.0';
```

- [ ] **Step 2: ChatClient constructor에 ThemeManager 초기화 추가**

Line 68 (`this.ogPreview = new OGPreviewManager();` 다음 줄):

```js
this.theme = new ThemeManager();
```

- [ ] **Step 3: ESLint 확인**

Run: `npx eslint public/js/chat.js public/js/theme.js`

---

### Task 5: 커밋 + 배포

- [ ] **Step 1: ESLint 전체 확인**

Run: `npx eslint public/js/chat.js public/js/theme.js public/js/ui.js`

- [ ] **Step 2: Commit & Deploy**

```bash
git add public/css/themes.css public/js/theme.js public/index.html public/js/chat.js
git commit -m "feat: 6개 테마 프리셋 (다크/라이트/미드나잇/오션/포레스트/선셋) 추가"
git push
wrangler deploy
```
