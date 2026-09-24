
Zotero.zoteropreview = {
	id: null,
	version: null,
	rootURI: null,
	initialized: false,
	currentStyle: null,
	_notifierID: null,
	_pendingPreviewTimers: null,
	_windowRetryTimers: null,
	_previewTargetDoc: null,
	_selectListeners: null,
	_addedElementIDs: null,
	_debugEnabled: false,
	_lastSelfCheck: null,
	_windowReadyListeners: null,
	_previewStates: null,
	_mountedWindows: null,
	_maxPreviewItems: 100,

	init({ id, version, rootURI }) {
		if (this.initialized) return;
		this.id = id;
		this.version = version;
		this.rootURI = rootURI;
		this._addedElementIDs = new Set();
		this._pendingPreviewTimers = new Map();
		this._windowRetryTimers = new Map();
		this._windowReadyListeners = new Map();
		this._selectListeners = new Map();
		this._previewStates = new WeakMap();
		this._mountedWindows = new Set();
		this._debugEnabled = !!Zotero.Prefs.get('extensions.zoteropreview.debug', true);
		this._maxPreviewItems = this._getMaxPreviewItems();
		this.initialized = true;
	},

	log(msg) {
		if (!this._debugEnabled) return;
		Zotero.debug("zoteropreview: " + msg);
	},

	_now() {
		return Date.now();
	},

	getPreviewState(doc) {
		if (!this._previewStates) {
			this._previewStates = new WeakMap();
		}
		if (!this._previewStates.has(doc)) {
			this._previewStates.set(doc, {
				currentItemID: null,
				currentItemIDs: [],
				lastHTML: null,
				lastRenderKey: null,
				copyClickHandler: null,
				copyFeedbackTimers: new Set(),
				sourceWindow: null
			});
		}
		return this._previewStates.get(doc);
	},

	buildRenderKey(item, format, prefs) {
		var items = Array.isArray(item) ? item : [item];
		return [
			items.map(entry => entry?.id || '').join(','),
			format?.id || '',
			format?.locale || prefs?.locale || '',
			prefs?.showpref || '',
			prefs?.fontSizePref || '',
			prefs?.spacingPref || ''
		].join('|');
	},

	invalidatePreviewCache(ids) {
		var invalidated = false;
		for (let win of (this._mountedWindows || [])) {
			let doc = win?.document;
			if (!doc) continue;
			let state = this.getPreviewState(doc);
			var currentIDs = state.currentItemIDs || (state.currentItemID ? [state.currentItemID] : []);
			if (Array.isArray(ids) && currentIDs.length && !ids.some(id => currentIDs.includes(id))) {
				continue;
			}
			state.lastRenderKey = null;
			state.lastHTML = null;
			invalidated = true;
		}
		return invalidated || !Array.isArray(ids);
	},

	_getPreviewDocuments() {
		var docs = [];
		for (let win of (this._mountedWindows || [])) {
			let doc = win?.document;
			if (doc?.getElementById?.('zotero-preview')) {
				docs.push(doc);
			}
		}
		var fallbackDoc = this._getPreviewTargetDoc();
		if (fallbackDoc?.getElementById?.('zotero-preview') && !docs.includes(fallbackDoc)) {
			docs.push(fallbackDoc);
		}
		return docs;
	},

	_queueAllPreviews(debugmsg) {
		var docs = this._getPreviewDocuments();
		if (!docs.length) {
			this._queuePreview(debugmsg, this._getPreviewTargetDoc());
			return;
		}
		for (let doc of docs) {
			let state = this.getPreviewState(doc);
			state.lastRenderKey = null;
			state.lastHTML = null;
			this._queuePreview(debugmsg, doc);
		}
	},

	_previewMessage(text, type, l10nId) {
		var localization = l10nId ? ` data-l10n-id="${l10nId}"` : '';
		return `<div class="zotero-preview-message zotero-preview-message-${type || 'info'}" role="status" aria-live="polite"${localization}>${text}</div>`;
	},

	_previewLimitNotice(shown, total) {
		return `<div class="zotero-preview-message zotero-preview-message-info" role="status" aria-live="polite" data-l10n-id="zotero-preview-limit-reached" data-l10n-args='{"shown":${shown},"total":${total}}'></div>`;
	},

	_getMaxPreviewItems() {
		var value = parseInt(Zotero.Prefs.get('extensions.zoteropreview.maxPreviewItems', true), 10);
		return Number.isFinite(value) ? Math.max(1, Math.min(500, value)) : 100;
	},

	_clipboardIconSVG() {
		return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3V0H1V13H4V16H15V3H12ZM2 1H11V12H2V1ZM14 15H5V13H12V4H14V15Z" fill="#cc9200"/></svg>`;
	},

	_successIconSVG() {
		return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 1L5.5 9.5L2 6" stroke="#009900" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
	},

	_copyButton(id, asCitations) {
		var title = asCitations ? 'Copy or use ctrl + shift + A' : 'Copy or use ctrl + shift + C';
		return ` <span id="${id}" class="zotero-preview-copy" role="button" tabindex="0" aria-label="${title}" data-copy-citation="${asCitations ? 'true' : 'false'}" title="${title}">${this._clipboardIconSVG()}</span>`;
	},

	_previewBlockHTML(kind, html, copyId, asCitations) {
		return [
			`<section class="zotero-preview-block zotero-preview-block-${kind}">`,
			`<div class="zotero-preview-block-row">`,
			`<div class="zotero-preview-block-body">${html}</div>`,
			`<div class="zotero-preview-block-toolbar">${this._copyButton(copyId, asCitations)}</div>`,
			`</div>`,
			`</section>`
		].join('');
	},

	_copyItemsToClipboard(items, format, locale, asCitations, sourceDoc) {
		try {
			if (typeof Components === 'undefined') {
				throw new Error('Components API unavailable');
			}
			var wm = Components.classes?.["@mozilla.org/appshell/window-mediator;1"]
						   ?.getService(Components.interfaces.nsIWindowMediator);
			var browserWindow = wm?.getMostRecentWindow("navigator:browser");
			var fileInterface = browserWindow?.Zotero_File_Interface;
			if (!fileInterface?.copyItemsToClipboard) {
				throw new Error('Zotero clipboard interface unavailable');
			}
			fileInterface.copyItemsToClipboard(
					items, format.id, locale, format.contentType == 'html', asCitations
			);
			return true;
		}
		catch (err) {
			this.log('copy failed: ' + err);
			this._showCopyFailure(sourceDoc);
			return false;
		}
	},

	_showCopyFailure(sourceDoc) {
		var doc = sourceDoc || this._getPreviewTargetDoc();
		var preview = doc?.getElementById ? doc.getElementById('zotero-preview') : null;
		if (!preview) return;
		var state = this.getPreviewState(doc);
		this.renderPreview(doc, state, {
			 html: this._previewMessage('Copy unavailable. Try Zotero copy shortcuts or select the item again.', 'warning', 'zotero-preview-copy-unavailable')
		});
	},

	_ensurePreviewClickHandler(targetDoc, targetDiv, state) {
		if (state.copyClickHandler || !targetDiv?.addEventListener) return;
		state.copyClickHandler = (event) => {
			var target = event.target;
			var copyTarget = target?.closest ? target.closest('[data-copy-citation]') : null;
			if (!copyTarget || !targetDiv.contains(copyTarget)) return;
			if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
			if (event.type === 'keydown') event.preventDefault();
			this.copyCitation(copyTarget.dataset.copyCitation == 'true', targetDoc);
		};
		targetDiv.addEventListener('click', state.copyClickHandler);
		targetDiv.addEventListener('keydown', state.copyClickHandler);
	},

	renderPreview(targetDoc, state, payload) {
		var targetDiv = targetDoc.getElementById('zotero-preview');
		if (!targetDiv) return false;
		this._ensurePreviewClickHandler(targetDoc, targetDiv, state);
		if (payload.fontSizePref) {
			targetDiv.style.setProperty('--zotero-preview-font-size', payload.fontSizePref + 'em');
		}
		if (state.lastHTML === payload.html && targetDiv.innerHTML === payload.html) {
			return false;
		}
		targetDiv.innerHTML = payload.html;
		state.lastHTML = payload.html;
		if (payload.spacingPref) {
			let bibBody = targetDiv.querySelector?.('.csl-bib-body');
			if (bibBody) {
				bibBody.style.lineHeight = payload.spacingPref;
			}
		}
		return true;
	},

	// this was an approach that worked, but since Zotero itself uses stylesheets, I went with that
	// the ::before selector isn't available in JavaScript
	addIcon(){
		var mainDocument = Zotero.getActiveZoteroPane().document;
		if (mainDocument.getElementById('zpicon') == null){
			var icon = mainDocument.createElement('span');
			icon.innerHTML=" ";
			icon.id='zpicon';
			icon.className = 'zotero-preview-icon';

			this.log('added span');

			mainDocument.querySelector('#zotero-preview-container .head .title').prepend(icon);
			this.storeAddedElement(icon);
		}
	},

	_queuePreview(debugmsg, targetDoc) {
		if (targetDoc) {
			this._previewTargetDoc = targetDoc;
		}
		var candidateDoc = this._getPreviewTargetDoc(targetDoc);
		if (!candidateDoc || !candidateDoc.getElementById('zotero-preview')) {
			return;
		}
		if (!this._pendingPreviewTimers) {
			this._pendingPreviewTimers = new Map();
		}
		if (this._pendingPreviewTimers.has(candidateDoc)) {
			clearTimeout(this._pendingPreviewTimers.get(candidateDoc));
		}
		var timer = setTimeout(() => {
			this._pendingPreviewTimers.delete(candidateDoc);
			this.getCitationPreview(debugmsg || 'queued', candidateDoc);
		}, 80);
		this._pendingPreviewTimers.set(candidateDoc, timer);
	},

	_getSelectedItems(sourceDoc) {
		try {
			if (sourceDoc) {
				var state = this._previewStates ? this.getPreviewState(sourceDoc) : null;
				var sourceWindow = state?.sourceWindow || sourceDoc.defaultView;
				var pane = sourceWindow?.ZoteroPane || sourceWindow;
				if (pane?.getSelectedItems) {
					var selected = pane.getSelectedItems();
					return Array.isArray(selected) ? selected.filter(item => item?.id) : [];
				}
			}
			if (!Zotero.getActiveZoteroPane) return [];
			var pane = Zotero.getActiveZoteroPane();
			if (!pane || !pane.getSelectedItems) return [];
			var selected = pane.getSelectedItems();
			return Array.isArray(selected) ? selected.filter(item => item?.id) : [];
		}
		catch (err) {
			this.log('selected items unavailable: ' + err);
			return [];
		}
	},

	_getPreviewTargetDoc(preferredDoc) {
		if (preferredDoc?.getElementById?.('zotero-preview')) {
			return preferredDoc;
		}
		if (this._previewTargetDoc?.getElementById?.('zotero-preview')) {
			return this._previewTargetDoc;
		}
		var pane = Zotero.getActiveZoteroPane ? Zotero.getActiveZoteroPane() : null;
		if (pane?.document?.getElementById?.('zotero-preview')) {
			return pane.document;
		}
		return preferredDoc || this._previewTargetDoc || pane?.document || null;
	},

	_isMainWindow(window) {
		return !!(window && window.ZoteroPane);
	},

	_findReaderMountTarget(doc) {
		var selectors = [
			'#reader-sidebar',
			'#reader-ui .sidebar',
			'#reader-ui',
			'#reader-container',
			'.reader-sidebar',
			'.sidebar',
			'main'
		];
		for (let selector of selectors) {
			let el = doc.querySelector(selector);
			if (el) return el;
		}
		return doc.body || null;
	},

	_findReaderInfoSection(doc) {
		var selectors = [
			'collapsible-section[data-pane="info"]',
			'collapsible-section[data-pane="item-info"]',
			'#reader-sidebar collapsible-section[data-pane="info"]',
			'#reader-sidebar [data-pane="info"]',
			'#reader-sidebar #zotero-editpane-info',
			'#reader-item-pane [data-pane="info"]',
			'#zotero-reader-item-pane [data-pane="info"]',
			'#zotero-reader-item-pane #zotero-editpane-info',
			'.reader-sidebar [data-pane="info"]',
			'[data-l10n-id="item-pane-info"]',
			'[data-l10n-id="zotero-item-pane-info"]'
		];
		for (let selector of selectors) {
			let el = doc.querySelector(selector);
			if (el) return el;
		}
		return null;
	},

	_getReaderInsertionPoint(doc) {
		var infoSection = this._findReaderInfoSection(doc);
		if (infoSection?.parentNode) {
			return { parent: infoSection.parentNode, before: infoSection };
		}
		var mountTarget = this._findReaderMountTarget(doc);
		if (!mountTarget) return null;
		return { parent: mountTarget, before: mountTarget.firstChild || null };
	},

	_runSelfCheck(context) {
		var warnings = [];
		if (!Zotero?.QuickCopy) warnings.push('QuickCopy API unavailable');
		if (!Zotero?.Styles) warnings.push('Styles API unavailable');
		if (typeof Zotero?.getActiveZoteroPane !== 'function') warnings.push('Active pane API unavailable');

		var fontPref = parseFloat(Zotero.Prefs.get('extensions.zoteropreview.fontsize', true));
		if (Number.isNaN(fontPref) || fontPref < 0.2 || fontPref > 3) warnings.push('fontsize preference out of range');

		var spacingPref = parseFloat(Zotero.Prefs.get('extensions.zoteropreview.spacing', true));
		if (Number.isNaN(spacingPref) || spacingPref < 1 || spacingPref > 3) warnings.push('spacing preference out of range');

		this._lastSelfCheck = {
			ok: warnings.length === 0,
			context,
			warnings
		};

		if (!this._lastSelfCheck.ok || this._debugEnabled) {
			Zotero.debug('zoteropreview self-check (' + context + '): ' + JSON.stringify(this._lastSelfCheck));
		}

		return this._lastSelfCheck;
	},

	_scheduleAddToWindow(window, positionpref, attempt) {
		var tryCount = typeof attempt === 'number' ? attempt : 0;
		if (tryCount >= 25) return;

		var key = window || 'main';
		if (!this._windowRetryTimers) {
			this._windowRetryTimers = new Map();
		}
		if (this._windowRetryTimers.has(key)) {
			clearTimeout(this._windowRetryTimers.get(key));
		}
		// Zotero may finish building a pane after DOMContentLoaded. Back off
		// while keeping retries bounded so a missing target cannot loop forever.
		var retryDelay = Math.min(1000, 100 * Math.pow(1.4, tryCount));
		var timer = setTimeout(() => {
			this._windowRetryTimers.delete(key);
			this.addToWindow(window, positionpref, tryCount + 1);
		}, retryDelay);
		this._windowRetryTimers.set(key, timer);
	},

	_waitForWindowReady(window, positionpref) {
		if (!window) return false;
		if (!this._windowReadyListeners) {
			this._windowReadyListeners = new Map();
		}
		if (this._windowReadyListeners.has(window)) return true;

		var doc = window.document;
		if (!doc || doc.readyState !== 'loading') return false;

		var onReady = () => {
			this._windowReadyListeners.delete(window);
			doc.removeEventListener('DOMContentLoaded', onReady);
			this.addToWindow(window, positionpref, 0);
		};
		this._windowReadyListeners.set(window, { doc, onReady });
		doc.addEventListener('DOMContentLoaded', onReady);
		return true;
	},

	_registerSelectListener(doc) {
		if (!doc?.addEventListener) return;
		if (!this._selectListeners) {
			this._selectListeners = new Map();
		}
		if (this._selectListeners.has(doc)) return;
		var listener = () => {
			this._queuePreview('select', doc);
		};
		this._selectListeners.set(doc, listener);
		doc.addEventListener('select', listener);
	},

	_findMainMountTarget(doc, preferredId) {
		var candidates = [
			preferredId,
			'zotero-item-pane-header',
			'zotero-editpane-item-box',
			'zotero-editpane-related'
		];

		for (let id of candidates) {
			if (!id) continue;
			let el = doc.getElementById(id);
			if (el) return el;
		}
		return null;
	},

	_ensureStylesheet(doc) {
		var link = doc.getElementById('zotero-preview-stylesheet');
		if (!link) {
			link = doc.createElement('link');
			link.id = 'zotero-preview-stylesheet';
			link.type = 'text/css';
			link.rel = 'stylesheet';
			link.href = this.rootURI + 'style.css';
			doc.documentElement.appendChild(link);
		}
		this.storeAddedElement(link);
		return link;
	},

	_ensureReaderContainer(doc) {
		var insertionPoint = this._getReaderInsertionPoint(doc);
		if (!insertionPoint) return null;
		this._ensureStylesheet(doc);

		var container = doc.getElementById('zotero-preview-reader-container');
		var preview = doc.getElementById('zotero-preview');
		var state = this.getPreviewState(doc);

		if (!container) {
			doc.ownerGlobal?.MozXULElement?.insertFTLIfNeeded?.('zotero-preview.ftl');
			container = doc.createXULElement ? doc.createXULElement("collapsible-section") : doc.createElement('div');
			container.id = 'zotero-preview-reader-container';
			container.setAttribute?.('class', 'zotero-preview-reader-container zotero-preview-section');
			container.open = "";
			container.dataset.pane = "preview";
			container.setAttribute?.('data-l10n-id', 'zotero-preview-pane-title');
			if (!container.setAttribute) {
				container.className = 'zotero-preview-reader-container zotero-preview-section';
			}
			if (insertionPoint.before) {
				insertionPoint.parent.insertBefore(container, insertionPoint.before);
			}
			else {
				insertionPoint.parent.appendChild(container);
			}
		}

		if (!preview) {
			preview = doc.createElement('div');
			preview.id = 'zotero-preview';
			container.appendChild(preview);
		}

		this.storeAddedElement(container);
		this.storeAddedElement(preview);
		this._ensurePreviewClickHandler(doc, preview, state);
		return preview;
	},

	addToWindow(windowOrPosition, positionpref, attempt) {
		try {
			var targetWindow = null;
			if (windowOrPosition && typeof windowOrPosition === 'object' && windowOrPosition.document) {
				targetWindow = windowOrPosition;
			}

			if (typeof windowOrPosition === 'string') {
				positionpref = windowOrPosition;
			}

			// the prefs.xhtml has the values of the containers representing the position
			if (typeof positionpref === 'undefined'){
				positionpref = Zotero.Prefs.get('extensions.zoteropreview.position', true);
			}

			this.log(positionpref);

			if (!targetWindow) {
				if (!Zotero.getActiveZoteroPane()) {
					this._scheduleAddToWindow(null, positionpref, attempt);
					return;
				}
				targetWindow = Zotero.getActiveZoteroPane();
			}

			if (this._waitForWindowReady(targetWindow, positionpref)) {
				return;
			}

			var mainDocument = targetWindow.document;
			this._previewTargetDoc = mainDocument;
			if (this._mountedWindows) {
				this._mountedWindows.add(targetWindow);
			}
			this.getPreviewState(mainDocument).sourceWindow = targetWindow;
			this._registerSelectListener(mainDocument);

			var target = this._isMainWindow(targetWindow)
				? this._findMainMountTarget(mainDocument, positionpref)
				: mainDocument.getElementById(positionpref);
			if (!target) {
				if (!this._isMainWindow(targetWindow) && mainDocument.body) {
					if (this._ensureReaderContainer(mainDocument)) {
						this._queuePreview('addtowindow', mainDocument);
						return;
					}
				}
				this._scheduleAddToWindow(targetWindow, positionpref, attempt);
				return;
			}
			this.log(target);

			var zpdivContainer = mainDocument.getElementById('zotero-preview-container');

			// it appears that if we move a collapsible element, it loses it's contents
			this.log('zpdiv');
			var zpdiv = mainDocument.getElementById('zotero-preview');
			if (zpdiv == null){
				this.log('adding zpdiv');
				zpdiv = mainDocument.createElement('div');
				zpdiv.id = 'zotero-preview';
				this.storeAddedElement(zpdiv);
			}
			if (zpdivContainer == null){
				this.log('adding zpdivContainer')

				mainDocument.ownerGlobal?.MozXULElement?.insertFTLIfNeeded?.('zotero-preview.ftl');

				zpdivContainer = mainDocument.createXULElement("collapsible-section");
				zpdivContainer.id='zotero-preview-container';
				zpdivContainer.setAttribute('class', 'zotero-preview-section');
				zpdivContainer.open="";
				zpdivContainer.dataset.pane="preview";
				zpdivContainer.setAttribute('data-l10n-id', 'zotero-preview-pane-title');


				this.log('adding span');
				this.log('storing elements');

				this._ensureStylesheet(mainDocument);

				this.storeAddedElement(zpdivContainer);
			}

			if (zpdivContainer.parentNode === target.parentNode && zpdivContainer.previousSibling === target) {
				if (!zpdiv.innerHTML) {
					zpdiv.innerHTML = this._previewMessage('Loading preview...', 'info');
				}
				this._ensurePreviewClickHandler(mainDocument, zpdiv, this.getPreviewState(mainDocument));
				this._queuePreview('addtowindow', mainDocument);
				return;
			}

			this.log('appending container to target')
			target.after(zpdivContainer);

			// basic order of operations thing here. add the div after adding the container to the main document
			this.log('appending zpdiv to zpdivContainer');
			zpdivContainer.appendChild(zpdiv);
			if (!zpdiv.innerHTML) {
				zpdiv.innerHTML = this._previewMessage('Loading preview...', 'info');
			}
			this._ensurePreviewClickHandler(mainDocument, zpdiv, this.getPreviewState(mainDocument));
			// this.addIcon();
			this.log('store')

			this._queuePreview('addtowindow', mainDocument);

		} catch (error) {
			this.log('could not add the item pane header thing: ' + error);
		}
	},

	addToAllWindows() {
		var windows = typeof Zotero.getMainWindows === 'function' ? Zotero.getMainWindows() : [];
		for (let win of windows) {
			if (!win.ZoteroPane) continue;
			this.addToWindow(win, Zotero.Prefs.get('extensions.zoteropreview.position', true));
		}
	},

	addToReaderWindow(window) {
		try {
			if (!window?.document) return;
			var doc = window.document;
			this._previewTargetDoc = doc;
			this._mountedWindows?.add(window);
			this.getPreviewState(doc).sourceWindow = window;
			this._registerSelectListener(doc);
			if (this._waitForWindowReady(window, Zotero.Prefs.get('extensions.zoteropreview.position', true))) {
				return;
			}
			if (this._ensureReaderContainer(doc)) {
				this._queuePreview('reader-load', doc);
				return;
			}
			this.addToWindow(window, Zotero.Prefs.get('extensions.zoteropreview.position', true));
		}
		catch (err) {
			this.log('could not add preview to reader window: ' + err);
		}
	},

	// keep track of added elements so they can be removed on uninstall and shutdown
	storeAddedElement(elem) {
		if (!elem.id) {
			throw new Error("Element must have an id");
		}
		if (!this._addedElementIDs) {
			this._addedElementIDs = new Set();
		}
		this._addedElementIDs.add(elem.id);
	},

	removeFromWindow(window) {
		var doc = window.document;
		if (this._selectListeners?.has(doc)) {
			doc.removeEventListener('select', this._selectListeners.get(doc));
			this._selectListeners.delete(doc);
		}
		var state = this._previewStates ? this.getPreviewState(doc) : null;
		var preview = doc.getElementById('zotero-preview');
		if (preview && state?.copyClickHandler) {
			preview.removeEventListener('click', state.copyClickHandler);
			preview.removeEventListener('keydown', state.copyClickHandler);
			state.copyClickHandler = null;
		}
		for (let timer of (state?.copyFeedbackTimers || [])) {
			clearTimeout(timer);
		}
		state?.copyFeedbackTimers?.clear();
		var retryTimer = this._windowRetryTimers?.get(window);
		if (retryTimer) {
			clearTimeout(retryTimer);
			this._windowRetryTimers.delete(window);
		}
		var readyEntry = this._windowReadyListeners?.get(window);
		if (readyEntry) {
			readyEntry.doc.removeEventListener('DOMContentLoaded', readyEntry.onReady);
			this._windowReadyListeners.delete(window);
		}
		var pendingTimer = this._pendingPreviewTimers?.get(doc);
		if (pendingTimer) {
			clearTimeout(pendingTimer);
			this._pendingPreviewTimers.delete(doc);
		}
		// Remove all elements added to DOM
		for (let id of (this._addedElementIDs || [])) {
			doc.getElementById(id)?.remove();
		}
		try {
			doc.querySelector('#zotero-preview-container')?.remove();
			doc.querySelector('#zotero-preview-reader-container')?.remove();
			doc.querySelector('[href="zotero-preview.ftl"]')?.remove();
		}
		catch(err){
			this.log(err);
		}
		this._mountedWindows?.delete(window);
	},

	removeFromAllWindows() {
		var windows = new Set([...(this._mountedWindows || []), ...(Zotero.getMainWindows ? Zotero.getMainWindows() : [])]);
		for (let win of windows) {
			this.removeFromWindow(win);
		}
		for (let [_win, entry] of (this._windowReadyListeners || new Map())) {
			entry.doc.removeEventListener('DOMContentLoaded', entry.onReady);
		}
		this._windowReadyListeners = new Map();
		for (let [doc, listener] of (this._selectListeners || new Map())) {
			doc.removeEventListener('select', listener);
		}
		this._selectListeners = new Map();
		for (let timer of (this._windowRetryTimers || new Map()).values()) {
			clearTimeout(timer);
		}
		this._windowRetryTimers = new Map();
		for (let timer of (this._pendingPreviewTimers || new Map()).values()) {
			clearTimeout(timer);
		}
		this._pendingPreviewTimers = new Map();
		this._mountedWindows = new Set();
		this._previewTargetDoc = null;
		this._previewStates = new WeakMap();
	},

	main() {
		this._runSelfCheck('startup');
		// this.log('adding notifier');
		this._notifierID = Zotero.Notifier.registerObserver(this, ['item','itemtree'], 'itemBox');
		// this.log(this._notifierID);

		// Retrieve a global pref
		this.log(`Main: Format is ${Zotero.Prefs.get('extensions.zoteropreview.citationstyle', true)}`);
		// this.addToAllWindows();
		if(Zotero.getActiveZoteroPane()) {
			var doc = Zotero.getActiveZoteroPane().document;
			this._registerSelectListener(doc);
		}
		this._queuePreview('startup', Zotero.getActiveZoteroPane?.()?.document);
	},

	// the way this works is that you register with the Zotero Notifier, which then calls the "notify" function
	notify(event, _type, ids, extraData) {
		this.log(event);
		this.log(_type);
		this.log(JSON.stringify(ids));
		this.log(extraData);
		if (event != 'modify' && event != 'refresh') return;
		var changedIDs = event == 'modify'
			? (Array.isArray(ids) ? ids : (ids == null ? [] : [ids]))
			: null;
		if (!this.invalidatePreviewCache(changedIDs)) {
			return;
		}
		var activeDoc = Zotero.getActiveZoteroPane?.()?.document;
		if (!activeDoc?.getElementById?.('zotero-preview')) {
			this.addToWindow();
		}
		this._queueAllPreviews('notify');
	},

	// because someone might prefer a different preview to their default, this is a custom function
	copyCitation(asCitations, sourceDoc){
		// true = citation
		// false = bib
		this.log('copying citation');
		this.log("parameter is: " + asCitations);
		var qc = Zotero.QuickCopy;
		var items = this._getSelectedItems(sourceDoc);
		if (!items.length) return;
		var format = this._getQuickCopyFormat();
		if (!format) {
			this._showCopyFailure(sourceDoc);
			return;
		}
		var locale = format.locale ? format.locale : Zotero.Prefs.get('export.quickCopy.locale');
		var userpref = Zotero.Prefs.get('extensions.zoteropreview.citationstyle', true);
		if ( userpref != "" ){
			format.id = userpref;
		}

		if (!this._copyItemsToClipboard(items, format, locale, asCitations, sourceDoc)) {
			return;
		}
		this.log('copy done');

		// Show success feedback
		var doc = sourceDoc || this._getPreviewTargetDoc();
		var copyIconId = asCitations ? 'zpcitecopy' : 'zpbibcopy';
		var copyIcon = doc?.getElementById ? doc.getElementById(copyIconId) : null;
		if (copyIcon) {
			var state = doc ? this.getPreviewState(doc) : null;
			copyIcon.classList.add('zotero-preview-copy-success');
			copyIcon.innerHTML = this._successIconSVG();
			var feedbackTimers = state?.copyFeedbackTimers || new Set();
			if (state) state.copyFeedbackTimers = feedbackTimers;
			var scaleTimer = setTimeout(() => {
				feedbackTimers.delete(scaleTimer);
				copyIcon.classList.remove('zotero-preview-copy-success');
			}, 300);
			var iconTimer = setTimeout(() => {
				feedbackTimers.delete(iconTimer);
				copyIcon.innerHTML = this._clipboardIconSVG();
			}, 1000);
			feedbackTimers.add(scaleTimer);
			feedbackTimers.add(iconTimer);
		}
	},

	_getQuickCopyFormat() {
		try {
			var qc = Zotero.QuickCopy;
			if (!qc?.getFormatFromURL || !qc?.unserializeSetting) return null;
			var format = qc.unserializeSetting(qc.getFormatFromURL(qc.lastActiveURL));
			return format && typeof format === 'object' ? format : null;
		}
		catch (err) {
			this.log('QuickCopy format unavailable: ' + err);
			return null;
		}
	},

	setPref(pref,value){
		if (pref == 'extensions.zoteropreview.debug') {
			this._debugEnabled = !!value;
		}
		if (pref == 'extensions.zoteropreview.fontsize') {
			value = parseFloat(value);
			if (Number.isNaN(value)) value = 1;
			value = Math.max(0.2, Math.min(3, value));
		}
		if (pref == 'extensions.zoteropreview.spacing') {
			value = parseFloat(value);
			if (Number.isNaN(value)) value = 1.5;
			value = Math.max(1, Math.min(3, value));
		}
		if (pref == 'extensions.zoteropreview.maxPreviewItems') {
			value = parseInt(value, 10);
			if (Number.isNaN(value)) value = 100;
			value = Math.max(1, Math.min(500, value));
			this._maxPreviewItems = value;
		}
		Zotero.Prefs.set(pref, value, true);
		this._queueAllPreviews('post pref set: ' + pref + ' to ' + value);
	},

	getCitationPreview (debugmsg, preferredDoc){
		this.log("=========================");
		this.log('getCitationPreview started: ' + debugmsg);
		var timings = { start: this._now(), quickCopy: 0, csl: 0, dom: 0 };
		try {
			var targetDoc = this._getPreviewTargetDoc(preferredDoc);
			if (!targetDoc) {
				this.log('No preview target document available yet');
				return;
			}
			var targetDiv = targetDoc.getElementById('zotero-preview');
			if (!targetDiv) {
				this.log('No preview container in target document');
				return;
			}
			var state = this.getPreviewState(targetDoc);
			var items = this._getSelectedItems(targetDoc);
			if (!items.length) {
				state.currentItemID = null;
				state.currentItemIDs = [];
				state.lastRenderKey = null;
				this.renderPreview(targetDoc, state, {
					html: this._previewMessage('Select one or more items to preview citation.', 'info', 'zotero-preview-select-items')
				});
				return;
			}
			var selectedCount = items.length;
			var maxItems = this._maxPreviewItems || this._getMaxPreviewItems();
			if (items.length > maxItems) {
				items = items.slice(0, maxItems);
			}

			var qc = Zotero.QuickCopy;
			var format = this._getQuickCopyFormat();
			if (!format) {
				this.renderPreview(targetDoc, state, {
					html: this._previewMessage('QuickCopy format is unavailable. Check Quick Copy settings and try again.', 'warning', 'zotero-preview-quickcopy-unavailable')
				});
				return;
			}
			if (format.mode == "") {
				format.mode = "bibliography";
			}

			var userpref = Zotero.Prefs.get('extensions.zoteropreview.citationstyle', true);
			var showpref = Zotero.Prefs.get('extensions.zoteropreview.whatToShow', true);
			var userFontPref = Zotero.Prefs.get('extensions.zoteropreview.fontsize', true);
			var spacingPref = Zotero.Prefs.get('extensions.zoteropreview.spacing', true);
			if (debugmsg == 'zpboth' || debugmsg == 'zpintext' || debugmsg == 'zpbib') {
				showpref = debugmsg;
			}

			spacingPref = parseFloat(spacingPref);
			if (Number.isNaN(spacingPref) || spacingPref < 1 || spacingPref > 3) {
				spacingPref = 1.5;
			}

			var fontSizePref = Zotero.Prefs.get('fontSize');
			if (userFontPref != "") {
				fontSizePref = userFontPref;
			}
			fontSizePref = parseFloat(fontSizePref);
			if (Number.isNaN(fontSizePref) || fontSizePref < 0.2 || fontSizePref > 3) {
				fontSizePref = 1;
			}

			if (userpref != "") {
				format.id = userpref;
				format.mode = "bibliography";
			}
			var locale = format.locale ? format.locale : Zotero.Prefs.get('export.quickCopy.locale');
			format.locale = locale;

			if (format.id == "" || format.mode == "export") {
				state.lastRenderKey = null;
				this.renderPreview(targetDoc, state, {
					html: this._previewMessage('No bibliography style is chosen in the settings for QuickCopy. Set Preview preference in Settings.', 'warning', 'zotero-preview-no-style'),
					fontSizePref
				});
				return;
			}

			var renderKey = this.buildRenderKey(items, format, { showpref, fontSizePref, spacingPref, locale });
			if (renderKey === state.lastRenderKey && state.lastHTML && targetDiv.innerHTML === state.lastHTML) {
				this.log('render skipped by cache key');
				this.log('===================');
				return;
			}

			state.currentItemID = items[0].id;
			state.currentItemIDs = items.map(item => item.id);
			var msg = "";
			if (showpref == 'zpboth' || showpref == 'zpbib') {
				var qcStart = this._now();
				var biblio = qc.getContentFromItems(items, format);
				timings.quickCopy = this._now() - qcStart;
				var bibliographyHTML = biblio?.html || '';
				if (!bibliographyHTML) {
					throw new Error('QuickCopy returned no bibliography HTML');
				}
				msg = this._previewBlockHTML('bibliography', bibliographyHTML, 'zpbibcopy', false);
			}

			if (showpref == "zpboth") {
				msg += '<hr class="zotero-preview-separator"/>';
			}

			if (showpref == 'zpboth' || showpref == 'zpintext') {
				var cslStart = this._now();
				var style = Zotero.Styles.get(format.id);
				if (!style?.getCiteProc) {
					throw new Error('Citation style unavailable: ' + format.id);
				}
				var styleEngine = style.getCiteProc(locale, 'html');
				var citations;
				try {
					citations = styleEngine.previewCitationCluster(
						{
							citationItems: items.map(item => ({ id: item.id })),
							properties: {}
						},
						[], [], "html"
					);
				}
				finally {
					styleEngine.free();
				}
				timings.csl = this._now() - cslStart;
				if (showpref == 'zpintext') {
					msg = "";
				}
				msg += this._previewBlockHTML('citation', citations, 'zpcitecopy', true);
			}

			if (selectedCount > items.length) {
				msg = this._previewLimitNotice(items.length, selectedCount) + msg;
			}
			msg = `<div class="zotero-preview-content">${msg}</div>`;
			var domStart = this._now();
			this.renderPreview(targetDoc, state, { html: msg, spacingPref, fontSizePref });
			timings.dom = this._now() - domStart;
			state.lastRenderKey = renderKey;
			this.log('getCitationPreview timings: ' + JSON.stringify({
				total: this._now() - timings.start,
				quickCopy: timings.quickCopy,
				csl: timings.csl,
				dom: timings.dom
			}));
			this.log('getCitationPreview done');
			this.log('===================');
		}
		catch (err) {
			this.log('getCitationPreview failed: ' + err);
			var doc = this._getPreviewTargetDoc(preferredDoc);
			var preview = doc?.getElementById ? doc.getElementById('zotero-preview') : null;
			if (preview) {
				var state = this.getPreviewState(doc);
				state.lastRenderKey = null;
				this.renderPreview(doc, state, {
					html: this._previewMessage('Preview unavailable. Try selecting the item again.', 'error', 'zotero-preview-unavailable')
				});
			}
		}
	}
};
