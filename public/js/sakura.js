(function() {
    let active = false;
    let petals = [];
    let observer = null;
    const PETAL_COUNT = 35;
    const COLORS = ['sakura-p1', 'sakura-p2', 'sakura-p3', 'sakura-p4'];

    function createPetals() {
        if (active) return;
        active = true;
        const frag = document.createDocumentFragment();
        const driftWeights = ['sakuraDriftL','sakuraDriftL','sakuraDriftR','sakuraDriftR','sakuraDriftSlow','sakuraDriftGentle'];
        for (let i = 0; i < PETAL_COUNT; i++) {
            const el = document.createElement('div');
            el.className = 'sakura-petal ' + COLORS[i % 4];
            const size = 18 + Math.floor(Math.random() * 24);
            const duration = 9 + Math.random() * 16;
            const delay = Math.random() * 18;
            const left = Math.random() * 100;
            const drift = driftWeights[Math.floor(Math.random() * driftWeights.length)];
            el.style.setProperty('--petal-size', size + 'px');
            el.style.setProperty('--fall-duration', duration.toFixed(1) + 's');
            el.style.setProperty('--fall-delay', '-' + delay.toFixed(1) + 's');
            el.style.setProperty('--drift-anim', drift);
            el.style.left = left + '%';
            frag.appendChild(el);
            petals.push(el);
        }
        document.body.appendChild(frag);
    }

    function removePetals() {
        if (!active) return;
        active = false;
        for (let i = 0; i < petals.length; i++) {
            if (petals[i].parentNode) {
                petals[i].parentNode.removeChild(petals[i]);
            }
        }
        petals = [];
    }

    function checkTheme() {
        const theme = document.documentElement.getAttribute('data-theme');
        if (theme === 'sakura') {
            createPetals();
        } else {
            removePetals();
        }
    }

    const MO = window.MutationObserver || window.WebKitMutationObserver;
    if (MO) {
        observer = new MO(function(mutations) {
            for (let i = 0; i < mutations.length; i++) {
                const m = mutations[i];
                if (m.type === 'attributes' && m.attributeName === 'data-theme') {
                    checkTheme();
                    return;
                }
            }
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkTheme);
    } else {
        checkTheme();
    }
})();
