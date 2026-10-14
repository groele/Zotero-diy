// Preference handlers are scoped to this preference-pane document.
(() => {
const preview = Zotero.zoteropreview;
const initializedRoots = new WeakSet();
const listeners = [];
const listen = (target, type, handler, capture = false) => {
    target.addEventListener(type, handler, capture);
    listeners.push(() => target.removeEventListener(type, handler, capture));
};
const prefs = {
    init() {
        const root = document.getElementById('zotero-prefpane-zotero-preview');
        if (!preview.initialized || !root || initializedRoots.has(root)) return;
        const popup = document.querySelector('#zotero-preview-style-menulist menupopup');
        popup.replaceChildren();
        const menu = document.getElementById('zotero-preview-style-menulist');
        const automatic = document.createXULElement('menuitem');
        automatic.setAttribute('value', '');
        automatic.setAttribute('data-l10n-id', 'zotero-preview-follow-quickcopy');
        popup.appendChild(automatic);
        for (const style of Zotero.Styles.getVisible()) {
            const entry = document.createXULElement('menuitem');
            entry.setAttribute('value', style.styleID);
            entry.setAttribute('label', style.title);
            popup.appendChild(entry);
        }
        menu.value = preview.pref('citationstyle') || '';
        listen(menu, 'command', () => preview.setPref(preview._prefPrefix + 'citationstyle', menu.value));
        const position = document.getElementById('extensions-zoteropreview-position');
        position.value = preview.getPosition();
        listen(position, 'command', () => preview.setPref(preview._prefPrefix + 'position', position.value));
        const display = document.getElementById('extensions-zoteropreview-whatToShow');
        display.value = preview.pref('whatToShow') || 'zpboth';
        listen(display, 'command', () => preview.setPref(preview._prefPrefix + 'whatToShow', display.value));
        for (const [id, name, fallback] of [
            ['zotero-preview-fontsize', 'fontsize', 1],
            ['zotero-preview-spacing', 'spacing', 1.5],
            ['zotero-preview-max-items', 'maxPreviewItems', 100]
        ]) {
            const input = document.getElementById(id);
            input.value = preview.pref(name) || fallback;
            listen(input, 'change', () => {
                preview.setPref(preview._prefPrefix + name, input.value);
                input.value = preview.pref(name);
            });
        }
        initializedRoots.add(root);
    }
};
// Zotero loads pane scripts before inserting the fragment, then dispatches
// non-bubbling load events. Capture them without a CSP-blocked inline handler.
listen(document, 'load', event => {
    if (event.target?.id === 'zotero-prefpane-zotero-preview') prefs.init();
}, true);
const dispose = () => {
    for (const remove of listeners.splice(0)) remove();
    preview._prefPaneCleanups.delete(dispose);
};
preview._prefPaneCleanups.add(dispose);
listen(document, 'unload', event => {
    if (event.target?.id === 'zotero-prefpane-zotero-preview') dispose();
}, true);
listen(window, 'unload', dispose);
prefs.init();
})();
