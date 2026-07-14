const THEMES = ['dark', 'light', 'midnight', 'amethyst', 'sunset', 'sakura', 'evernight', 'ocean', 'forest'];
const META_COLORS = { dark: '#1F2937', light: '#FFFFFF', midnight: '#1E293B', amethyst: '#1A0A2E', sunset: '#292524', sakura: '#FFF5F7', evernight: '#18161C', ocean: '#042F2E', forest: '#052E16' };

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
        } catch (_e) { /* ignore storage errors */ }
        return 'dark';
    }

    save(theme) {
        try { localStorage.setItem('chatTheme', theme); } catch (_e) { /* ignore storage errors */ }
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
            const existingCheck = opt.querySelector('.theme-check');
            if (existingCheck) existingCheck.remove();
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
