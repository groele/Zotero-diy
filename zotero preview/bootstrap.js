if (typeof Zotero == 'undefined')
{
    var Zotero;
}

function log(msg) {
	try {
		if (Zotero.Prefs.get('extensions.zoteropreview.debug', true)) {
			Zotero.debug("zoteropreview: " + msg);
		}
	}
	catch (_err) {
		// Startup/shutdown logging must not interfere with plugin lifecycle.
	}
}

function install() {
	log("Installed ");
}

function startup({ id, version, rootURI }) {
	log("Starting " + version);

	Services.scriptloader.loadSubScript(rootURI + 'zoteropreview.js');
	// Zotero 10 consolidates plugin Fluent resources and resolves locale
	// fallbacks centrally. Keep the window-level linkset in prefs.xhtml for
	// older Zotero versions, while registering the resource for Zotero 10+.
	if (Zotero.ftl?.addResourceIds) {
		Zotero.ftl.addResourceIds(['zotero-preview.ftl']);
		Zotero.zoteropreview._ftlRegistered = true;
	}

	Zotero.PreferencePanes.register({
		pluginID: 'zoteropreview@carter-tod.com',
		src: rootURI + 'prefs.xhtml',
		scripts: [rootURI + 'zoteropreview_prefs.js']
	});

	Zotero.zoteropreview.init({ id, version, rootURI });

	Zotero.zoteropreview.addToAllWindows();
	Zotero.zoteropreview.main();
}

function onMainWindowLoad({ window }) {
	Zotero.zoteropreview.addToWindow(window);
}

function onMainWindowUnload({ window }) {
	Zotero.zoteropreview.removeFromWindow(window);
}

function onReaderWindowLoad({ window }) {
	if (Zotero.zoteropreview?.addToReaderWindow) {
		Zotero.zoteropreview.addToReaderWindow(window);
	}
}

function onReaderWindowUnload({ window }) {
	if (Zotero.zoteropreview?.removeFromWindow) {
		Zotero.zoteropreview.removeFromWindow(window);
	}
}

function shutdown() {
	log("Shutting down ");
	if (Zotero.zoteropreview?._notifierID) {
		Zotero.Notifier.unregisterObserver(Zotero.zoteropreview._notifierID);
	}
	if (Zotero.zoteropreview?.removeFromAllWindows) {
		Zotero.zoteropreview.removeFromAllWindows();
	}
	if (Zotero.zoteropreview?._ftlRegistered && Zotero.ftl?.removeResourceIds) {
		Zotero.ftl.removeResourceIds(['zotero-preview.ftl']);
	}
	Zotero.zoteropreview = undefined;
}

function uninstall() {
	shutdown();
	log("Uninstalled ");
}
