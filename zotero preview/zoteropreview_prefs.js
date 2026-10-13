// Preference handlers are scoped to this preference-pane document.
Zotero.zoteropreview.Prefs = {
    init() {
        const preview = Zotero.zoteropreview;
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
        menu.addEventListener('command', () => preview.setPref(preview._prefPrefix + 'citationstyle', menu.value));
        const display = document.getElementById('extensions-zoteropreview-whatToShow');
        display.value = preview.pref('whatToShow') || 'zpboth';
        display.addEventListener('command', () => preview.setPref(preview._prefPrefix + 'whatToShow', display.value));
        for (const [id, name, fallback] of [
            ['zotero-preview-fontsize', 'fontsize', 1],
            ['zotero-preview-spacing', 'spacing', 1.5],
            ['zotero-preview-max-items', 'maxPreviewItems', 100]
        ]) {
            const input = document.getElementById(id);
            input.value = preview.pref(name) || fallback;
            input.addEventListener('change', () => {
                preview.setPref(preview._prefPrefix + name, input.value);
                input.value = preview.pref(name);
            });
        }
    }
};
