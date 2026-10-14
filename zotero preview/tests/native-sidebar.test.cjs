const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../zoteropreview.js'), 'utf8');
function setup(clock = {setTimeout, clearTimeout}) {
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
 const context=vm.createContext({Zotero,Components,Services:{clipboard:{setData(){}}},setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});
 vm.runInContext('Object.freeze(Array.prototype); Object.freeze(JSON); Object.freeze(Promise);',context);
 vm.runInContext(source,context);
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

test('placement restores top by default, after Info and bottom without changing other section order',async()=>{
 const h=setup();
 const panes=['info','abstract','other-plugin','native-id'].map(pane=>({dataset:{pane}}));
 const moves=[];
 const owner={getPanes:()=>panes,changePaneOrder:async(id,index)=>{
  const target=panes[index]; const current=panes.findIndex(p=>p.dataset.pane===id);
  const [pane]=panes.splice(current,1);
  panes.splice(target ? panes.indexOf(target) : panes.length,0,pane);
 }};
 owner.sidenav={container:owner,changePaneOrder:async(id,index,options)=>{
  assert.equal(options.persist,false); moves.push(index); await owner.changePaneOrder(id,index);
 }};
 const order=()=>panes.map(p=>p.dataset.pane);
 await h.plugin._applyPosition(owner);
 assert.deepEqual(order(),['native-id','info','abstract','other-plugin']);
 await h.plugin._applyPosition(owner); assert.equal(moves.length,1);
 h.prefs.set('extensions.zoteropreview.position','zotero-editpane-item-box');
 await h.plugin._applyPosition(owner);
 assert.deepEqual(order(),['info','native-id','abstract','other-plugin']);
 h.prefs.set('extensions.zoteropreview.position','zotero-editpane-related');
 await h.plugin._applyPosition(owner);
 assert.deepEqual(order(),['info','abstract','other-plugin','native-id']);
 owner.skipRender=true; h.prefs.set('extensions.zoteropreview.position','invalid');
 await h.plugin._applyPosition(owner); assert.equal(moves.length,3);
 owner.skipRender=false; await h.plugin._applyPosition(owner);
 assert.equal(order()[0],'native-id'); h.plugin.shutdown();
});

test('position policy restores above Info once and preserves subsequent user choices',()=>{
 const h=setup();
 assert.equal(h.prefs.get('extensions.zoteropreview.position'),'zotero-item-pane-header');
 assert.equal(h.prefs.get('extensions.zoteropreview.positionPolicyVersion'),1);
 h.plugin.shutdown();
 h.prefs.set('extensions.zoteropreview.position','zotero-editpane-related');
 h.plugin.init({id:'test@example.com',version:'40.1.6',rootURI:'file:///plugin/'});
 h.plugin.start();
 assert.equal(h.plugin.getPosition(),'zotero-editpane-related'); h.plugin.shutdown();
});

test('native order restoration requeues placement and observer is released on section destruction',async()=>{
 const h=setup(); const s=h.section(h.item(1));
 let callback,disconnected=0,observed;
 s.doc.defaultView.MutationObserver=class {
  constructor(fn){callback=fn;} observe(parent,options){observed={parent,options};}
  disconnect(){disconnected++;}
 };
 const parent={},panes=['info','other-plugin','native-id'].map(pane=>({dataset:{pane},parentNode:parent,contains:()=>pane==='native-id'}));
 const owner={getPanes:()=>panes,changePaneOrder:async(id,index)=>{
  const target=panes[index], current=panes.findIndex(p=>p.dataset.pane===id);
  const [pane]=panes.splice(current,1);panes.splice(target?panes.indexOf(target):panes.length,0,pane);
 }};
 h.plugin._observePosition(owner,h.plugin._states.get(s.body));
 assert.equal(observed.parent,parent); assert.equal(observed.options.childList,true);
 assert.equal(observed.options.subtree,undefined);
 callback(); await new Promise(r=>setTimeout(r,10));
 assert.equal(panes[0].dataset.pane,'native-id');
 panes.push(panes.shift()); // Simulate Zotero restoring the preview to the bottom.
 callback(); await new Promise(r=>setTimeout(r,10));
 assert.equal(panes[0].dataset.pane,'native-id');
 h.plugin._destroySection(s.body); assert.equal(disconnected,1);
 assert.equal(h.plugin._positionObservers.size,0);assert.equal(h.plugin._positionTimers.size,0);
 h.plugin.shutdown();
});

test('hidden sidenav buttons do not shift the destination below Info',async()=>{
 const h=setup();
 const panes=['info','abstract','native-id'].map(pane=>({dataset:{pane}}));
 const wrappers=['hidden-note','info','abstract','native-id'].map(id=>({querySelector:()=>({dataset:{pane:id}})}));
 const owner={getPanes:()=>panes,changePaneOrder:async(id,index)=>{
  const target=panes[index],current=panes.findIndex(p=>p.dataset.pane===id);
  const [pane]=panes.splice(current,1);panes.splice(target?panes.indexOf(target):panes.length,0,pane);
 }};
 const indices=[];
 owner.sidenav={container:owner,querySelectorAll:()=>wrappers,changePaneOrder:async(id,index)=>{
  indices.push(index); // Model a sidenav that can lag behind the actual pane DOM.
 }};
 await h.plugin._applyPosition(owner);
 assert.deepEqual(indices,[1]);assert.equal(panes[0].dataset.pane,'native-id');
 h.plugin.shutdown();
});

test('original copy feedback scales for 300ms, shows green check for 1000ms and resets on repeated copy',()=>{
 let now=0, serial=0; const pending=new Map();
 const clock={setTimeout:(fn,delay)=>{pending.set(++serial,{fn,at:now+delay});return serial;},clearTimeout:id=>pending.delete(id)};
 const advance=ms=>{const end=now+ms; for(;;){
  const next=[...pending].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
  if(!next)break; now=next[1].at;pending.delete(next[0]);next[1].fn();
 } now=end;};
 const h=setup(clock), s=h.section(h.item(1)), state=h.plugin._states.get(s.body);
 const classes=new Set(),button={innerHTML:'',classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}};
 h.plugin._showCopyFeedback(state,button);
 assert.match(button.innerHTML,/#009900/); assert.ok(classes.has('zotero-preview-copy-success'));
 advance(299);assert.ok(classes.has('zotero-preview-copy-success'));
 advance(1);assert.equal(classes.size,0);assert.match(button.innerHTML,/#009900/);
 advance(699);assert.match(button.innerHTML,/#009900/);
 advance(1);assert.equal(button.innerHTML,h.plugin._clipboardIconSVG());assert.equal(pending.size,0);
 h.plugin._showCopyFeedback(state,button);advance(200);h.plugin._showCopyFeedback(state,button);
 assert.equal(pending.size,2);advance(800);assert.match(button.innerHTML,/#009900/);
 advance(200);assert.equal(button.innerHTML,h.plugin._clipboardIconSVG());
 h.plugin._showCopyFeedback(state,button);h.plugin.shutdown();assert.equal(pending.size,0);
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

test('one host unregister failure does not prevent remaining lifecycle cleanup',()=>{
 const h=setup(), s=h.section(h.item(1));
 const errors=[]; h.Zotero.logError=e=>errors.push(e.message);
 h.Zotero.Notifier.unregisterObserver=()=>{throw Error('host notifier unavailable');};
 let paneDisposed=false; h.plugin._prefPaneCleanups.add(()=>{paneDisposed=true;});
 h.plugin.shutdown();
 assert.equal(paneDisposed,true); assert.equal(h.observers.size,0);
 assert.equal(h.plugin._states.size,0); assert.equal(s.listeners.size,0);
 assert.equal(h.plugin._stylesheets.size,0); assert.equal(h.plugin._cache.size,0);
 assert.deepEqual(errors,['host notifier unavailable']);
 h.plugin.shutdown();
});

test('position changes serialize per owner and merge mutations during an async move',async()=>{
 const h=setup(),owner={getPanes:()=>[]};
 let resolve,active=0,maxActive=0,calls=0;
 h.plugin._applyPosition=async()=>{calls++;active++;maxActive=Math.max(maxActive,active);
  if(calls===1)await new Promise(r=>resolve=r);active--;
 };
 h.plugin._queuePosition(owner);await new Promise(r=>setTimeout(r,10));
 for(let i=0;i<20;i++)h.plugin._queuePosition(owner);
 assert.equal(calls,1);resolve();await new Promise(r=>setTimeout(r,20));
 assert.equal(calls,2);assert.equal(maxActive,1);assert.equal(h.plugin._positionRuns.size,0);
 h.plugin.shutdown();
});

test('shutdown during native reorder prevents fallback moves and fresh timers',async()=>{
 const h=setup(),panes=['info','native-id'].map(pane=>({dataset:{pane}}));
 let resolve,fallback=0;
 const owner={getPanes:()=>panes,changePaneOrder:()=>{fallback++;}};
 owner.sidenav={container:owner,changePaneOrder:async()=>{await new Promise(r=>resolve=r);}};
 const pending=h.plugin._applyPosition(owner);h.plugin.shutdown();resolve();await pending;
 h.plugin._queuePosition(owner);
 assert.equal(fallback,0);assert.equal(h.plugin._positionTimers.size,0);
});

test('reader trash notification immediately disables preview and prevents copying deleted content',async()=>{
 const h=setup(),i=h.item(1),s=h.section(i);
 await h.plugin._renderSection(s.props);i.deleted=true;h.plugin.notify('trash','item',[1]);
 assert.equal(s.body.enabled,false);assert.equal(h.plugin.copyCitation(false,s.body),false);
 await h.plugin._renderSection(s.props);assert.equal(h.calls.length,2);h.plugin.shutdown();
});

test('replacing the same cache key keeps byte accounting exact',()=>{
 const h=setup();for(let i=0;i<20;i++)h.plugin._cachePut('same',{x:'abc'},[1]);
 assert.equal(h.plugin._cache.size,1);assert.equal(h.plugin._cacheBytes,JSON.stringify({x:'abc'}).length*2);
 h.plugin._cacheDelete('same');assert.equal(h.plugin._cacheBytes,0);h.plugin.shutdown();
});

test('observer disconnect failures do not strand states or timers',()=>{
 const h=setup(),s=h.section(h.item(1)),errors=[];
 h.Zotero.logError=e=>errors.push(e.message);
 h.plugin._states.get(s.body).widthObserver={disconnect(){throw Error('resize disconnect failed');}};
 h.plugin._positionObservers.set({}, {observer:{disconnect(){throw Error('position disconnect failed');}},count:1});
 h.plugin.shutdown();assert.equal(h.plugin._states.size,0);assert.equal(s.listeners.size,0);
 assert.equal(h.plugin._positionObservers.size,0);assert.equal(h.plugin._positionTimers.size,0);
 assert.equal(errors.length,2);
});
