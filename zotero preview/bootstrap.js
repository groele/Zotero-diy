var Zotero;
var startupGeneration = 0;
async function startup({ id, version, rootURI }) {
	const generation = ++startupGeneration;
	await Zotero.initializationPromise;
	if (generation !== startupGeneration) return;
	try {
		Services.scriptloader.loadSubScript(rootURI + 'zoteropreview.js');
		const preview = Zotero.zoteropreview;
		preview.init({ id, version, rootURI });
		if (Zotero.ftl?.addResourceIds) {
			Zotero.ftl.addResourceIds(['zotero-preview.ftl']);
			preview._ftlRegistered = true;
		}
		Zotero.PreferencePanes.register({ pluginID: id, src: rootURI + 'prefs.xhtml', scripts: [rootURI + 'zoteropreview_prefs.js'], defaultXUL: true });
		preview.start();
	}
	catch (error) { shutdown(); throw error; }
}
function shutdown() {
	startupGeneration++;
	const preview = Zotero?.zoteropreview;
	try { preview?.shutdown(); }
	catch (error) { Zotero.logError?.(error); }
	finally {
		try {
			if (preview?._ftlRegistered) Zotero.ftl?.removeResourceIds?.(['zotero-preview.ftl']);
		}
		catch (error) { Zotero.logError?.(error); }
		finally { if (Zotero) delete Zotero.zoteropreview; }
	}
}
function install() {}
function uninstall() {}
