const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function trapFocus(modalEl) {
    if (!modalEl) return function cleanup() {};
    const focusable = Array.from(modalEl.querySelectorAll(FOCUSABLE));
    if (focusable.length === 0) return function cleanup() {};
    const firstEl = focusable[0];
    const lastEl = focusable[focusable.length - 1];
    firstEl.focus();
    function handler(e) {
        if (e.key !== 'Tab') return;
        if (e.shiftKey && document.activeElement === firstEl) {
            e.preventDefault();
            lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
            e.preventDefault();
            firstEl.focus();
        }
    }
    modalEl.addEventListener('keydown', handler);
    return function cleanup() {
        modalEl.removeEventListener('keydown', handler);
    };
}

export function showModal(modalEl, closeSelector, previousActiveEl) {
    if (!modalEl) return function cleanup() { return function cleanup() {}; };
    modalEl.classList.remove('hidden');
    const cleanup = trapFocus(modalEl);
    const triggers = closeSelector ? modalEl.querySelectorAll(closeSelector) : [];
    function hideHandler() {
        modalEl.classList.add('hidden');
        cleanup();
        if (previousActiveEl && typeof previousActiveEl.focus === 'function') {
            previousActiveEl.focus();
        }
        document.removeEventListener('keydown', escHandler);
        triggers.forEach(btn => btn.removeEventListener('click', hideHandler));
    }
    function escHandler(e) {
        if (e.key === 'Escape') hideHandler();
    }
    function clickHandler(e) {
        if (e.target === modalEl) hideHandler();
    }
    document.addEventListener('keydown', escHandler);
    modalEl.addEventListener('click', clickHandler);
    triggers.forEach(btn => btn.addEventListener('click', hideHandler));
    return hideHandler;
}

export function hideModal(modalEl) {
    if (!modalEl) return;
    const hidden = document.createEvent('Event');
    hidden.initEvent('modal:hide', true, true);
    modalEl.dispatchEvent(hidden);
    modalEl.classList.add('hidden');
}
