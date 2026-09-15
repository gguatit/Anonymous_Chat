// Runs before body render to avoid theme flash. Kept as a classic (non-module) script.
(function () {
    try {
        const t = localStorage.getItem('chatTheme');
        if (t) {
            document.documentElement.setAttribute('data-theme', t);
            const m = document.getElementById('theme-color-meta');
            const c = {
                dark: '#1F2937', light: '#FFFFFF', midnight: '#1E293B', ocean: '#134E4A',
                forest: '#14532D', amethyst: '#1A0A2E', sunset: '#292524', sakura: '#FCE7F3', evernight: '#18161C'
            };
            if (m && c[t]) m.setAttribute('content', c[t]);
        }
    } catch (_e) { /* ignore storage errors */ }
})();
