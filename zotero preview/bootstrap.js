var Zotero;
async function startup({ id, version, rootURI }) {
	await Zotero.initializationPromise;
	Services.scriptloader.loadSubScript(rootURI + 'zoteropreview.js');
	const preview = Zotero.zoteropreview;
	preview.init({ id, version, rootURI });
	try {
		if (Zotero.ftl?.addResourceIds) {
			Zotero.ftl.addResourceIds(['zotero-preview.ftl']);
			preview._ftlRegistered = true;
		}
		Zotero.PreferencePanes.register({ pluginID: id, src: rootURI + 'prefs.xhtml', scripts: [rootURI + 'zoteropreview_prefs.js'] });
		preview.start();
	}
	catch (error) { shutdown(); throw error; }
}
function shutdown() {
	const preview = Zotero?.zoteropreview;
	preview?.shutdown();
	if (preview?._ftlRegistered) Zotero.ftl.removeResourceIds(['zotero-preview.ftl']);
	delete Zotero.zoteropreview;
}
function install() {}
function uninstall() {}
