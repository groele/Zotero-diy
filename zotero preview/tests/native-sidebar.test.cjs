const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../zoteropreview.js'), 'utf8');
function setup() {
 const prefs = new Map(Object.entries({
  'extensions.zoteropreview.whatToShow': 'zpboth',
  'extensions.zoteropreview.citationstyle': '',
  'extensions.zoteropreview.fontsize': 1,
  'extensions.zoteropreview.spacing': 1.5,
  'extensions.zoteropreview.maxPreviewItems': 100,
  'export.quickCopy.dragLimit': 100,
 }));
 const items = new Map(); const calls = []; const observers = new Set();
 const copied = [];
 const Zotero = {
  Prefs: { get: k => prefs.get(k), set: (k,v) => prefs.set(k,v),
   registerObserver: () => { const id = Symbol(); observers.add(id); return id; },
   unregisterObserver: id => observers.delete(id) },
  Items: { get: id => items.get(id) }, debug() {},
  Notifier: { registerObserver: (o,types) => { for(const type of types) assert.ok(['item','tab'].includes(type)); return 1; }, unregisterObserver: () => {} },
  ItemPaneManager: { registerSection: o => { Zotero.options = o; return 'native-id'; }, unregisterSection: () => {} },
  QuickCopy: { getFormatFromURL: url => ({mode:'bibliography',id:url || 'style'}), unserializeSetting: x => x,
   getContentFromItems: (items, format, unused, citation) => {
    calls.push(Array.from(items, i => i.id));
    return {html:`<i>${citation ? 'cite' : 'bib'}:${items.map(i=>i.id)}</i>`, text:`plain:${items.map(i=>i.id)}`};
   } }
 };
 const transferable = { init() {}, addDataFlavor() {}, setTransferData: (f,s) => copied.push([f,s.data]) };
 const Components = { classes: new Proxy({}, {get: (t,k) => ({createInstance: () => k.includes('transferable') ? transferable : {data:''}})}),
  interfaces: {nsIClipboard:{kGlobalClipboard:1}} };
 vm.runInNewContext(source, {Zotero,Components,Services:{clipboard:{setData(){}}},setTimeout,clearTimeout});
 const plugin=Zotero.zoteropreview;
 // State tests do not emulate Gecko's HTML/XML parser; desktop QA covers it.
 plugin._setHTML=(state,html)=>{state.body.innerHTML=html;};
 plugin.init({id:'test@example.com',version:'40.1.0',rootURI:'file:///plugin/'}); plugin.start();
 function item(id, parentID) { const i={id,parentID,isRegularItem:()=>!parentID,getField:f=>f==='dateModified'?'2026-10-13':''}; items.set(id,i); return i; }
 function section(i, tabType='reader', selection=[]) {
  const sheet = {remove() {},};
  const doc = {defaultView:{ZoteroPane:{getSelectedItems:()=>selection}},createElementNS:()=>({...sheet}),documentElement:{appendChild(){}}};
  const listeners = new Map();
  const body = {innerHTML:'',classList:{add(){}},style:{setProperty(){}},addEventListener:(k,v)=>listeners.set(k,v),
   removeEventListener:k=>listeners.delete(k),getClientRects:()=>[{}],closest:()=>({open:true}),contains:()=>true};
  let refreshes=0;
  plugin._initSection({doc,body,refresh:()=>{refreshes++;}});
  const props={doc,body,item:i,tabType,setEnabled:v=>{body.enabled=v;}};
  plugin._changeItem(props); plugin._prepareRender(props);
  return {body,doc,props,listeners,refreshes:()=>refreshes};
 }
 return {plugin,Zotero,item,section,calls,prefs,observers,copied};
}
test('native section registers library and reader lifecycle without window hooks',()=>{
 const h=setup(); assert.equal(h.Zotero.options.pluginID,'test@example.com');
 for(const hook of ['onInit','onDestroy','onItemChange','onRender','onAsyncRender']) assert.equal(typeof h.Zotero.options[hook],'function');
 assert.equal(h.plugin.addToReaderWindow,undefined); h.plugin.shutdown(); assert.equal(h.observers.size,0);
});
test('reader attachment resolves parent and never copies library selection',async()=>{
 const h=setup(); const parent=h.item(1), attachment=h.item(2,1), unrelated=h.item(3);
 const s=h.section(attachment,'reader',[unrelated]); await h.plugin._renderSection(s.props);
 assert.deepEqual(h.calls,[[1],[1]]); assert.equal(h.plugin.copyCitation(false,s.body),true);
 assert.deepEqual(h.copied,[['text/html','<i>bib:1</i>'],['text/plain','plain:1']]);
 assert.equal(h.calls.length,2); h.plugin.shutdown();
});
test('shared LRU reuses CSL results between two sections and ignores unrelated item changes',async()=>{
 const h=setup(), i=h.item(1), a=h.section(i), b=h.section(i);
 await h.plugin._renderSection(a.props); await h.plugin._renderSection(b.props);
 assert.equal(h.calls.length,2); assert.equal(h.plugin._stats.cacheHits,1);
 h.plugin.notify('modify','item',[99]); assert.equal(h.plugin._cache.size,1);
 h.plugin.notify('modify','item',[1]); assert.equal(h.plugin._cache.size,0);
 await h.plugin._renderSection(b.props); assert.equal(h.calls.length,4); h.plugin.shutdown();
});
test('rapid item changes cancel stale renders; shutdown resolves pending work',async()=>{
 const h=setup(), a=h.item(1), b=h.item(2), s=h.section(a);
 const old=h.plugin._renderSection(s.props);
 s.props.item=b; h.plugin._changeItem(s.props); const latest=h.plugin._renderSection(s.props);
 await Promise.all([old,latest]); assert.deepEqual(h.calls,[[2],[2]]);
 const pending=h.plugin._renderSection(s.props); h.plugin.shutdown(); await pending;
 assert.equal(h.plugin._states.size,0); assert.equal(s.listeners.size,0); assert.equal(h.plugin._stylesheets.size,0);
});
test('cache is bounded by entry and byte budget',()=>{
 const h=setup(); for(let i=0;i<100;i++) h.plugin._cachePut(String(i),{x:'abc'},[i]);
 assert.equal(h.plugin._cache.size,64); assert.equal(h.plugin._cache.has('0'),false);
 h.plugin._cachePut('huge',{x:'a'.repeat(1100000)},[1]); assert.equal(h.plugin._cache.has('huge'),false);
 assert.ok(h.plugin._cacheBytes<=h.plugin._cacheByteLimit); h.plugin.shutdown();
});
test('library preview honors limit, deduplicates parent attachments, and uses the same subset for copy',async()=>{
 const h=setup(), a=h.item(1), b=h.item(2), attachment=h.item(3,1);
 h.prefs.set('extensions.zoteropreview.maxPreviewItems',1);
 const s=h.section(a,'library',[a,attachment,b]); await h.plugin._renderSection(s.props);
 assert.deepEqual(h.calls,[[1],[1]]); assert.match(s.body.innerHTML,/zotero-preview-truncated/);
 assert.match(s.body.innerHTML,/data-copy-citation/); assert.match(s.body.innerHTML,/<svg/);
 h.plugin.shutdown();
});
test('invalid style is recoverable and deletion hides an orphan reader item',async()=>{
 const h=setup(), i=h.item(1), s=h.section(i);
 h.Zotero.QuickCopy.getContentFromItems=()=>{throw Error('missing style');};
 await h.plugin._renderSection(s.props); assert.match(s.body.innerHTML,/zotero-preview-unavailable/);
 i.deleted=true; h.plugin._changeItem(s.props); assert.equal(s.body.enabled,false); h.plugin.shutdown();
});
