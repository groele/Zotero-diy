const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const source = read('zoteropreview.js');

test('manifest, update feed, and project version stay aligned', () => {
  const updates = JSON.parse(read('zoteropreview7-updates.json'));
  const update = updates.addons['zoteropreview@carter-tod.com'].updates[0];
  assert.equal(manifest.version, '40.0.1');
  assert.equal(update.version, manifest.version);
  assert.equal(manifest.applications.zotero.strict_min_version, '8.0');
  assert.equal(manifest.applications.zotero.strict_max_version, '10.0.*');
  assert.match(manifest.applications.zotero.update_url, /groele\/Zotero-diy/);
  assert.match(update.update_link, /ZoteroPreview-40\.0\.1\.xpi$/);
});

test('source avoids known Zotero 10 removed APIs', () => {
  for (const pattern of [
    'getCollectionTreeRow(', 'getSelectedLibraryID(', 'getSelectedCollection(',
    'getSelectedSavedSearch(', 'getSelectedGroup(', 'collectionTreeRow',
    'fulltextWord', 'CookieSandbox'
  ]) assert.equal(source.includes(pattern), false, `found removed API: ${pattern}`);
});

test('window teardown clears timers, handlers, and mounted references', () => {
  assert.match(source, /removeEventListener\('keydown', state\.copyClickHandler\)/);
  assert.match(source, /clearTimeout\(retryTimer\)/);
  assert.match(source, /clearTimeout\(pendingTimer\)/);
  assert.match(source, /this\._mountedWindows\?\.delete\(window\)/);
  assert.match(source, /removeFromAllWindows\(\)/);
  assert.match(source, /Math\.min\(1000, 100 \* Math\.pow\(1\.4, tryCount\)\)/);
  assert.match(source, /if \(tryCount >= 25\) return/);
});

test('multi-item work is bounded and truncation is disclosed to users', () => {
  assert.match(source, /currentItemIDs/);
  assert.match(source, /items\.slice\(0, maxItems\)/);
  assert.match(source, /buildRenderKey\(items,/);
  assert.match(source, /selectedCount > items\.length/);
  assert.match(source, /_previewLimitNotice\(items\.length, selectedCount\)/);
  assert.match(source, /data-l10n-args=.*shown.*total/);
  assert.match(read('prefs.js'), /maxPreviewItems/);
});

test('copy controls preserve the visible SVG and keyboard interaction contract', () => {
  assert.match(source, /class="zotero-preview-copy" role="button" tabindex="0"/);
  assert.match(source, /this\._clipboardIconSVG\(\)/);
  assert.match(source, /data-copy-citation/);
  assert.match(source, /event\.key !== 'Enter' && event\.key !== ' '/);
});

test('all shipped locales define every runtime status message', () => {
  const ids = [
    'zotero-preview-select-items', 'zotero-preview-copy-unavailable',
    'zotero-preview-quickcopy-unavailable', 'zotero-preview-no-style',
    'zotero-preview-unavailable', 'zotero-preview-limit-reached'
  ];
  const locales = fs.readdirSync(path.join(root, 'locale'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  assert.deepEqual(locales.sort(), ['en-GB', 'en-US', 'es-ES', 'fr-FR', 'zh-CN']);
  for (const locale of locales) {
    const ftl = read(path.join('locale', locale, 'zotero-preview.ftl'));
    for (const id of ids) assert.match(ftl, new RegExp(`^${id}\\s*=`, 'm'), `${locale}: ${id}`);
  }
});

test('bootstrap startup logging follows the debug preference and cannot break lifecycle', () => {
  const bootstrap = read('bootstrap.js');
  assert.match(bootstrap, /Prefs\.get\('extensions\.zoteropreview\.debug', true\)/);
  assert.match(bootstrap, /catch \(_err\)/);
  assert.doesNotMatch(bootstrap, /zoteropreview 0\.1/);
});
