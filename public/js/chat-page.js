// Extracted from index.html inline script (CSP: script-src without 'unsafe-inline').
// Public-site chrome: platform-info sidebar + responsive nickname placement.
(function () {
    const infoToggle = document.getElementById('info-toggle');
    const platformInfo = document.getElementById('platform-info');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    function openSidebar() {
        platformInfo.classList.remove('-translate-x-full');
        sidebarOverlay.classList.remove('opacity-0', 'pointer-events-none');
        sidebarOverlay.classList.add('opacity-100');
    }

    function closeSidebar() {
        platformInfo.classList.add('-translate-x-full');
        sidebarOverlay.classList.add('opacity-0', 'pointer-events-none');
        sidebarOverlay.classList.remove('opacity-100');
    }

    function isSidebarOpen() {
        return !platformInfo.classList.contains('-translate-x-full');
    }

    infoToggle.addEventListener('click', () => {
        if (isSidebarOpen()) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    // Close platform info on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isSidebarOpen()) {
            closeSidebar();
        }
    });

    // Close platform info when clicking outside
    document.addEventListener('click', (e) => {
        if (isSidebarOpen() &&
            !platformInfo.contains(e.target) &&
            e.target !== infoToggle && !infoToggle.contains(e.target)) {
            closeSidebar();
        }
    });

    // Close platform info when clicking overlay
    sidebarOverlay.addEventListener('click', () => {
        closeSidebar();
    });

    // Mobile Nickname Layout Logic
    function adjustNicknamePosition() {
        const nicknameContainer = document.getElementById('nickname-container');
        const desktopPlaceholder = document.getElementById('desktop-nickname-placeholder');
        const mobilePlaceholder = document.getElementById('mobile-nickname-placeholder');

        // 768px is the 'md' breakpoint in Tailwind
        if (window.innerWidth < 768) {
            if (nicknameContainer.parentElement !== mobilePlaceholder) {
                mobilePlaceholder.appendChild(nicknameContainer);
            }
        } else {
            if (nicknameContainer.parentElement !== desktopPlaceholder) {
                desktopPlaceholder.appendChild(nicknameContainer);
            }
        }
    }

    // Run on load and resize
    window.addEventListener('resize', adjustNicknamePosition);
    adjustNicknamePosition();
})();
