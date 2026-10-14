const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('preferences initialize on captured fragment load without inline handlers and clean up', () => {
 const nodes = new Map(), handlers = new Map(), values = new Map();
 const target = id => ({ id, value: '',
  addEventListener(type, fn, capture) { handlers.set(`${id}:${type}`, {fn, capture}); },
  removeEventListener(type) { handlers.delete(`${id}:${type}`); },
  setAttribute() {}, appendChild() {}, replaceChildren() {} });
 const doc = Object.assign(target('document'), {
  getElementById: id => nodes.get(id),
  querySelector: () => nodes.get('popup'), createXULElement: () => target('entry')
 });
 const win = target('window');
 const preview = { initialized: true, _prefPrefix: 'extensions.zoteropreview.',
  _prefPaneCleanups: new Set(), pref: name => values.get(name), getPosition: () => 'zotero-item-pane-header',
  setPref: (key, value) => values.set(key.replace('extensions.zoteropreview.', ''), value) };
 const context = vm.createContext({ document: doc, window: win,
  Zotero: { zoteropreview: preview, Styles: { getVisible: () => [{styleID:'style',title:'Style'}] } } });
 // Gecko 153 freezes sandbox built-ins; the script must not monkey-patch them.
 vm.runInContext('Object.freeze(Array.prototype); Object.freeze(JSON); Object.freeze(Promise);', context);
 vm.runInContext(read('zoteropreview_prefs.js'), context);
 assert.equal(handlers.size, 3);
 assert.equal(handlers.get('document:load').capture, true);
 for (const id of ['zotero-prefpane-zotero-preview', 'popup', 'zotero-preview-style-menulist',
  'extensions-zoteropreview-position', 'extensions-zoteropreview-whatToShow',
  'zotero-preview-fontsize', 'zotero-preview-spacing', 'zotero-preview-max-items']) nodes.set(id, target(id));
 const load = handlers.get('document:load').fn;
 load({target:{id:'other-plugin'}}); assert.equal(handlers.size, 3);
 load({target:nodes.get('zotero-prefpane-zotero-preview')});
 const count = handlers.size;
 load({target:nodes.get('zotero-prefpane-zotero-preview')}); assert.equal(handlers.size, count);
 const menu = nodes.get('zotero-preview-style-menulist'); menu.value = 'new-style';
 handlers.get(`${menu.id}:command`).fn(); assert.equal(values.get('citationstyle'), 'new-style');
 handlers.get('document:unload').fn({target:nodes.get('zotero-prefpane-zotero-preview')});
 assert.equal(handlers.size, 0); assert.equal(preview._prefPaneCleanups.size, 0);
});

test('shutdown during initialization prevents late startup in a frozen sandbox', async () => {
 let resolve, loaded = 0;
 const context = vm.createContext({ Zotero: {initializationPromise: new Promise(r => resolve = r)},
  Services: {scriptloader: {loadSubScript() { loaded++; }}} });
 vm.runInContext('Object.freeze(Array.prototype); Object.freeze(JSON); Object.freeze(Promise);', context);
 vm.runInContext(read('bootstrap.js'), context);
 const pending = context.startup({id:'test',version:'test',rootURI:'test/'});
 context.shutdown(); resolve(); await pending;
 assert.equal(loaded, 0);
});

test('partial startup failure removes Fluent resources even if plugin cleanup throws', async () => {
 const errors = [], removed = [];
 const context = vm.createContext({ Zotero: {
  initializationPromise: Promise.resolve(), logError: e => errors.push(e.message),
  ftl: {addResourceIds() {}, removeResourceIds: ids => removed.push(...ids)},
  PreferencePanes: {register: () => {throw Error('host registration failed');}}
 }, Services: {scriptloader: {loadSubScript() {
  context.Zotero.zoteropreview = {init() {}, shutdown() {throw Error('cleanup failed');}};
 }}} });
 vm.runInContext(read('bootstrap.js'), context);
 await assert.rejects(context.startup({id:'test',version:'test',rootURI:'test/'}), /host registration failed/);
 assert.deepEqual(removed, ['zotero-preview.ftl']);
 assert.deepEqual(errors, ['cleanup failed']);
 assert.equal(context.Zotero.zoteropreview, undefined);
});

test('Gecko 153 audit excludes inline handlers and obsolete platform patterns', () => {
 const markup = read('prefs.xhtml');
 assert.doesNotMatch(markup, /\son\w+\s*=/i);
 assert.doesNotMatch(markup, /\b(?:hidden|collapsed|disabled|checked|selected|remote)="false"/);
 for (const file of ['bootstrap.js', 'zoteropreview.js', 'zoteropreview_prefs.js', 'style.css']) {
  assert.doesNotMatch(read(file), /\.ownerGlobal\b|CheckboxStateChange|\.oncommand\s*=|\[(?:hidden|collapsed|disabled|checked|selected)="true"\]/);
 }
 assert.match(read('bootstrap.js'), /defaultXUL:\s*true/);
});
