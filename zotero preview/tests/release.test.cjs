const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,'');
const manifest=JSON.parse(read('manifest.json'));
const feed=JSON.parse(read('zoteropreview7-updates.json'));
const update=feed.addons[manifest.applications.zotero.id].updates[0];
test('manifest, maintained update feed and versioned package stay aligned',()=>{
 assert.match(manifest.version,/^\d+\.\d+\.\d+$/);
 assert.equal(update.version,manifest.version);
 assert.equal(manifest.applications.zotero.update_url,'https://raw.githubusercontent.com/groele/Zotero-diy/main/zotero%20preview/zoteropreview7-updates.json');
 assert.equal(update.update_link,`https://raw.githubusercontent.com/groele/Zotero-diy/main/zotero%20preview/dist/ZoteroPreview-${manifest.version}.xpi`);
 assert.deepEqual(update.applications.zotero,{strict_min_version:manifest.applications.zotero.strict_min_version,strict_max_version:manifest.applications.zotero.strict_max_version});
 const bytes=fs.readFileSync(path.join(root,`dist/ZoteroPreview-${manifest.version}.xpi`));
 assert.equal(update.update_hash,'sha256:'+crypto.createHash('sha256').update(bytes).digest('hex'));
});
test('all Fluent resources provide unique required runtime and copy messages',()=>{
 for(const locale of fs.readdirSync(path.join(root,'locale'))){
  const text=read(`locale/${locale}/zotero-preview.ftl`);
  const keys=[...text.matchAll(/^([a-z][\w-]*)\s*=/gm)].map(m=>m[1]);
  assert.equal(keys.length,new Set(keys).size,locale);
  for(const key of ['zotero-preview-pane-title','zotero-preview-loading','zotero-preview-native-position','zotero-preview-copy-bibliography','zotero-preview-copy-citation','zotero-preview-truncated'])assert.ok(keys.includes(key),`${locale}: ${key}`);
 }
});
