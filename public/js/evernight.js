// EverNight Theme - GIF particle effect
(function() {
    let active = false;
    let particles = [];
    let observer = null;
    const PARTICLE_COUNT = 18;

    function createParticles() {
        if (active) return;
        active = true;
        const frag = document.createDocumentFragment();
        const driftWeights = ['evDriftL','evDriftL','evDriftR','evDriftR','evDriftSlow','evDriftGentle'];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const el = document.createElement('img');
            el.className = 'evernight-particle';
            el.src = '/assets/evernight-anime.gif';
            const size = 30 + Math.floor(Math.random() * 28);
            const duration = 12 + Math.random() * 18;
            const delay = Math.random() * 20;
            const left = Math.random() * 100;
            const drift = driftWeights[Math.floor(Math.random() * driftWeights.length)];
            el.style.setProperty('--p-size', size + 'px');
            el.style.setProperty('--fall-duration', duration.toFixed(1) + 's');
            el.style.setProperty('--fall-delay', '-' + delay.toFixed(1) + 's');
            el.style.setProperty('--drift-anim', drift);
            el.style.left = left + '%';
            el.style.opacity = (0.15 + Math.random() * 0.2).toFixed(2);
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
