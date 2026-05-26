(function() {
    var active = false;
    var petals = [];
    var observer = null;
    var PETAL_COUNT = 35;
    var COLORS = ['sakura-p1', 'sakura-p2', 'sakura-p3', 'sakura-p4'];
    var DRIFTS = ['sakuraDriftL', 'sakuraDriftR', 'sakuraDriftSlow', 'sakuraDriftGentle'];

    function createPetals() {
        if (active) return;
        active = true;
        var frag = document.createDocumentFragment();
        var driftWeights = ['sakuraDriftL','sakuraDriftL','sakuraDriftR','sakuraDriftR','sakuraDriftSlow','sakuraDriftGentle'];
        for (var i = 0; i < PETAL_COUNT; i++) {
            var el = document.createElement('div');
            el.className = 'sakura-petal ' + COLORS[i % 4];
            var size = 18 + Math.floor(Math.random() * 24);
            var duration = 9 + Math.random() * 16;
            var delay = Math.random() * 18;
            var left = Math.random() * 100;
            var drift = driftWeights[Math.floor(Math.random() * driftWeights.length)];
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
        for (var i = 0; i < petals.length; i++) {
            if (petals[i].parentNode) {
                petals[i].parentNode.removeChild(petals[i]);
            }
        }
        petals = [];
    }

    function checkTheme() {
        var theme = document.documentElement.getAttribute('data-theme');
        if (theme === 'sakura') {
            createPetals();
        } else {
            removePetals();
        }
    }

    var MO = window.MutationObserver || window.WebKitMutationObserver;
    if (MO) {
        observer = new MO(function(mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var m = mutations[i];
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
