// EverNight Theme - GIF particle effect (static floating)
(function() {
    let active = false;
    let particles = [];
    let observer = null;
    const PARTICLE_COUNT = 18;

    function createParticles() {
        if (active) return;
        active = true;
        const frag = document.createDocumentFragment();
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const el = document.createElement('img');
            el.className = 'evernight-particle';
            el.src = '/assets/evernight-anime.gif';
            const size = 40 + Math.floor(Math.random() * 40);
            const top = Math.random() * 85;
            const left = Math.random() * 95;
            const delay = Math.random() * 4;
            el.style.setProperty('--p-size', size + 'px');
            el.style.setProperty('--p-top', top + '%');
            el.style.setProperty('--p-left', left + '%');
            el.style.setProperty('--p-delay', delay.toFixed(1) + 's');
            frag.appendChild(el);
            particles.push(el);
        }
        document.body.appendChild(frag);
    }

    function removeParticles() {
        if (!active) return;
        active = false;
        for (let i = 0; i < particles.length; i++) {
            if (particles[i].parentNode) {
                particles[i].parentNode.removeChild(particles[i]);
            }
        }
        particles = [];
    }

    function checkTheme() {
        const theme = document.documentElement.getAttribute('data-theme');
        if (theme === 'evernight') {
            createParticles();
        } else {
            removeParticles();
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
