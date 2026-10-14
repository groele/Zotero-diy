/* Native item-pane lifecycle; independent state per library/reader section. */
Zotero.zoteropreview = {
	initialized: false,
	_prefPrefix: 'extensions.zoteropreview.',
	_cacheLimit: 64,
	_cacheByteLimit: 2 * 1024 * 1024,
	_cacheTTL: 60000,
	init({ id, version, rootURI }) {
		if (this.initialized) return;
		Object.assign(this, { id, version, rootURI });
		this._states = new Map();
		this._cache = new Map();
		this._cacheBytes = 0;
		this._prefObservers = [];
		this._prefPaneCleanups = new Set();
		this._stylesheets = new Map();
		this._positionTimers = new Map();
		this._positionObservers = new Map();
		this._positionRuns = new Map();
		this._lifecycle = Symbol('preview-lifecycle');
		this._stats = { generations: 0, cacheHits: 0 };
		this.initialized = true;
	},
	log(message) {
		if (this.pref('debug')) Zotero.debug(`ZoteroPreview: ${message}`);
	},
	pref(name) { return Zotero.Prefs.get(this._prefPrefix + name, true); },
	start() {
		if (!Zotero.ItemPaneManager?.registerSection) throw new Error('Native ItemPaneManager API required');
		// Restore the requested default once on upgrade, retaining later choices.
		if (this.pref('positionPolicyVersion') !== 1) {
			this.setPref(this._prefPrefix + 'position', 'zotero-item-pane-header');
			this.setPref(this._prefPrefix + 'positionPolicyVersion', 1);
		}
		const title = { l10nID: 'zotero-preview-pane-title', icon: this.rootURI + 'view.svg' };
		this._sectionID = Zotero.ItemPaneManager.registerSection({
			paneID: 'zotero-preview', pluginID: this.id,
			header: title, sidenav: { ...title, orderable: true },
			onInit: props => this._initSection(props),
			onDestroy: ({ body }) => this._destroySection(body),
			onItemChange: props => this._changeItem(props),
			onRender: props => this._prepareRender(props),
			onAsyncRender: props => this._renderSection(props),
			onToggle: ({ body }) => { const state = this._states.get(body); if (state && !state.payload) this._scheduleRefresh(state); },
		});
		if (!this._sectionID) throw new Error('Could not register ZoteroPreview section');
		this._notifierID = Zotero.Notifier.registerObserver(this, ['item', 'tab'], 'zoteropreview');
		this._prefObservers.push(Zotero.Prefs.registerObserver(this._prefPrefix + 'position', () => {
			for (const state of this._states.values()) this._queuePosition(state.body.closest('item-details'));
		}, true));
		for (const name of ['citationstyle', 'whatToShow', 'fontsize', 'spacing', 'maxPreviewItems']) {
			this._prefObservers.push(Zotero.Prefs.registerObserver(this._prefPrefix + name,
				() => this._queueAllPreviews(), true));
		}
		for (const name of ['export.quickCopy.setting', 'export.quickCopy.locale', 'export.quickCopy.dragLimit']) {
			this._prefObservers.push(Zotero.Prefs.registerObserver(name, () => this._queueAllPreviews()));
		}
	},
	_initSection({ doc, body, refresh }) {
		if (this._states.has(body)) return;
		doc.defaultView?.MozXULElement?.insertFTLIfNeeded?.('zotero-preview.ftl');
		let sheet = this._stylesheets.get(doc);
		if (!sheet) {
			const link = doc.createElementNS('http://www.w3.org/1999/xhtml', 'link');
			Object.assign(link, { rel: 'stylesheet', href: this.rootURI + 'style.css' });
			doc.documentElement.appendChild(link);
			sheet = { link, count: 0 };
			this._stylesheets.set(doc, sheet);
		}
		sheet.count++;
		body.classList.add('zotero-preview-root');
		const state = { doc, body, refresh, item: null, tabType: null, ids: [],
			generation: 0, key: null, payload: null, timer: null, resolve: null,
			refreshTimer: null, feedbackTimers: new Set(), copyFeedback: new Map(), destroyed: false };
		state.handler = event => {
			const button = event.target?.closest?.('[data-copy-citation]');
			if (!button || !body.contains(button)) return;
			if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
			event.preventDefault();
			this.copyCitation(button.dataset.copyCitation === 'true', body, button);
		};
		body.addEventListener('click', state.handler);
		body.addEventListener('keydown', state.handler);
		this._states.set(body, state);
		// XUL descendants can keep a larger intrinsic width than their sidebar.
		// Observe the native section owner instead of polling window dimensions.
		const owner = body.closest('item-details');
		this._observePosition(owner, state);
		this._queuePosition(owner);
		if (owner && doc.defaultView.ResizeObserver) {
			state.sizingOwner = owner;
			state.widthObserver = new doc.defaultView.ResizeObserver(() => this._fitWidth(state));
			state.widthObserver.observe(owner);
		}
	},
	getPosition() {
		const position = this.pref('position');
		return ['zotero-item-pane-header', 'zotero-editpane-item-box', 'zotero-editpane-related'].includes(position)
			? position : 'zotero-item-pane-header';
	},
	_observePosition(owner, state) {
		if (state.positionOwner === owner) return;
		if (!owner?.getPanes) return;
		const parent = owner.getPanes().find(pane => pane.contains?.(state.body))?.parentNode;
		const Observer = state.doc.defaultView?.MutationObserver;
		if (!parent || !Observer) return;
		let entry = this._positionObservers.get(owner);
		if (!entry) {
			const observer = new Observer(() => this._queuePosition(owner));
			// Watch only direct pane insertion/reordering, not citation content.
			observer.observe(parent, { childList: true });
			entry = { observer, count: 0 };
			this._positionObservers.set(owner, entry);
		}
		entry.count++;
		state.positionOwner = owner;
	},
	_queuePosition(owner) {
		if (!this.initialized || !owner?.getPanes || this._positionTimers.has(owner)) return;
		const run = this._positionRuns.get(owner);
		if (run) { run.dirty = true; return; }
		const lifecycle = this._lifecycle;
		const timer = setTimeout(() => {
			this._positionTimers.delete(owner);
			if (!this.initialized || lifecycle !== this._lifecycle) return;
			const task = { dirty: false };
			this._positionRuns.set(owner, task);
			this._applyPosition(owner).catch(error => this.log(error)).finally(() => {
				if (this._positionRuns.get(owner) !== task) return;
				this._positionRuns.delete(owner);
				if (task.dirty && this.initialized && lifecycle === this._lifecycle) this._queuePosition(owner);
			});
		}, 0);
		this._positionTimers.set(owner, timer);
	},
	async _applyPosition(owner) {
		if (!this.initialized) return;
		const lifecycle = this._lifecycle;
		const sectionID = this._sectionID;
		const panes = owner.getPanes();
		const current = panes.findIndex(pane => pane.dataset.pane === this._sectionID);
		if (current < 0 || owner.skipRender) return;
		const position = this.getPosition();
		let index = position === 'zotero-editpane-related' ? panes.length : 0;
		if (position === 'zotero-editpane-item-box') {
			const info = panes.findIndex(pane => pane.dataset.pane === 'info');
			index = info < 0 ? 0 : info + 1;
		}
		if (current === index || current === index - 1) return;
		// Use native reordering rather than recreating or injecting a section.
		const sidenav = owner.sidenav;
		if (sidenav?.container === owner && sidenav.changePaneOrder) {
			// Sidenav includes hidden buttons absent from this item's pane list.
			// Translate the destination pane to its actual wrapper insertion index.
			const wrappers = Array.from(sidenav.querySelectorAll?.('.inherit-flex > .pin-wrapper') || []);
			const targetID = panes[index]?.dataset.pane;
			const targetIndex = targetID ? wrappers.findIndex(wrapper =>
				wrapper.querySelector('.btn[data-pane]')?.dataset.pane === targetID) : wrappers.length;
			await sidenav.changePaneOrder(this._sectionID,
				wrappers.length && targetIndex >= 0 ? targetIndex : index, { persist: false, render: false });
			if (!this.initialized || lifecycle !== this._lifecycle) return;
			// A stale sidenav can report no movement. Keep pane content authoritative.
			const updated = owner.getPanes();
			const actual = updated.findIndex(pane => pane.dataset.pane === this._sectionID);
			const target = targetID ? updated.findIndex(pane => pane.dataset.pane === targetID) : updated.length;
			if (actual >= 0 && target >= 0 && actual !== target && actual !== target - 1) {
				await owner.changePaneOrder?.(sectionID, target, { render: false });
			}
		}
		else if (owner.changePaneOrder) {
			await owner.changePaneOrder(sectionID, index, { render: false });
		}
		if (!this.initialized || lifecycle !== this._lifecycle) return;
		for (const state of this._states.values()) {
			if (state.body.closest('item-details') === owner && !state.payload) this._scheduleRefresh(state);
		}
	},
	_fitWidth(state) {
		if (!state.sizingOwner || state.destroyed) return;
		const bounds = state.sizingOwner.getBoundingClientRect();
		if (!bounds.width) return;
		const width = Math.max(0, Math.min(bounds.width, bounds.right - state.body.getBoundingClientRect().left - 8));
		state.body.style.maxWidth = `${width}px`;
	},
	_normalizeItem(item) {
		const seen = new Set();
		while (item?.id && !seen.has(item.id)) {
			seen.add(item.id);
			if (item.deleted) return null;
			if (item.isRegularItem()) return item;
			if (!item.parentID) return null;
			item = Zotero.Items.get(item.parentID);
		}
		return null;
	},
	_changeItem({ body, item, tabType, setEnabled }) {
		const state = this._states.get(body);
		if (!state) return;
		this._cancelRender(state);
		state.item = this._normalizeItem(item);
		state.tabType = tabType;
		state.setEnabled = setEnabled;
		state.ids = state.item ? [state.item.id] : [];
		state.key = null;
		state.payload = null;
		setEnabled(!!state.item);
	},
	_items(state) {
		// Reader sections never consult the library selection.
		if (state.tabType === 'library') {
			const selection = state.doc.defaultView?.ZoteroPane?.getSelectedItems() || [];
			const items = [...new Map(selection.map(item => this._normalizeItem(item))
				.filter(Boolean).map(item => [item.id, item])).values()];
			if (items.some(item => item.id === state.item?.id)) return items;
		}
		return state.item ? [state.item] : [];
	},
	_config(item) {
		const qc = Zotero.QuickCopy;
		const override = this.pref('citationstyle');
		const format = { ...qc.unserializeSetting(qc.getFormatFromURL(item?.getField('url') || '')) };
		if (override) Object.assign(format, { id: override, mode: 'bibliography' });
		if (format.mode !== 'bibliography' || !format.id) throw new Error('No bibliography style configured');
		format.locale = format.locale || Zotero.Prefs.get('export.quickCopy.locale');
		const asHTML = format.contentType === 'html';
		format.contentType = 'text';
		const show = this.pref('whatToShow');
		return { format, asHTML, show: ['zpboth', 'zpbib', 'zpintext'].includes(show) ? show : 'zpboth',
			font: this._number(this.pref('fontsize'), 1, 0.2, 3),
			spacing: this._number(this.pref('spacing'), 1.5, 1, 3),
			limit: Math.min(this._number(this.pref('maxPreviewItems'), 100, 1, 500),
				this._number(Zotero.Prefs.get('export.quickCopy.dragLimit'), 100, 1, 10000)) };
	},
	_number(value, fallback, min, max) {
		const parsed = Number.parseFloat(value);
		return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
	},
	_prepareRender(props) {
		const state = this._states.get(props.body);
		if (!state) return;
		this._queuePosition(props.body.closest('item-details'));
		if (state.item?.id !== this._normalizeItem(props.item)?.id || state.tabType !== props.tabType) this._changeItem(props);
		if (!state.payload) this._message(state, 'zotero-preview-loading', 'Loading preview…');
	},
	_cancelRender(state) {
		state.generation++;
		if (state.timer !== null) clearTimeout(state.timer);
		state.timer = null;
		state.resolve?.();
		state.resolve = null;
	},
	async _renderSection({ body }) {
		const state = this._states.get(body);
		if (!this.initialized || !state || state.destroyed || !state.item) return;
		state.item = this._normalizeItem(state.item);
		if (!state.item) { state.payload = null; state.setEnabled?.(false); return; }
		this._cancelRender(state);
		const generation = state.generation;
		// Coalesce rapid changes and yield before synchronous CSL work.
		await new Promise(resolve => {
			state.resolve = resolve;
			state.timer = setTimeout(() => { state.timer = null; state.resolve = null; resolve(); }, 40);
		});
		if (state.destroyed || generation !== state.generation || !this.initialized) return;
		try {
			const allItems = this._items(state);
			state.ids = allItems.map(item => item.id);
			const config = this._config(state.item);
			const items = allItems.slice(0, Math.floor(config.limit));
			const key = JSON.stringify([items.map(item => [item.id, item.getField('dateModified')]),
				config.format, config.show, Zotero.Styles?.get(config.format.id)?.updated || '']);
			if (this._cache.has(key) && Date.now() - this._cache.get(key).created > this._cacheTTL) this._cacheDelete(key);
			let payload = this._cache.get(key)?.payload;
			if (payload) {
				this._stats.cacheHits++;
				const entry = this._cache.get(key);
				this._cache.delete(key);
				this._cache.set(key, entry);
			}
			else {
				const started = Date.now();
				payload = this._generate(items, config);
				this._stats.generations++;
				this._cachePut(key, payload, items.map(item => item.id));
				this.log(`CSL ${Date.now() - started}ms, ${items.length} items`);
			}
			if (state.destroyed || generation !== state.generation) return;
			state.key = key;
			state.payload = payload;
			state.config = config;
			this._renderPayload(state, payload, allItems.length - items.length);
		}
		catch (error) {
			state.payload = null;
			this.log(error.stack || error);
			this._message(state, 'zotero-preview-unavailable', 'Preview unavailable. Check the selected citation style.', true);
		}
	},
	_generate(items, { format, show }) {
		const payload = {};
		for (const [kind, enabled, citation] of [
			['bibliography', show !== 'zpintext', false], ['citation', show !== 'zpbib', true]]) {
			if (!enabled) continue;
			// QuickCopy uses Zotero's cached CSL processors and returns HTML + text.
			const result = Zotero.QuickCopy.getContentFromItems(items, format, null, citation);
			if (!result?.html) throw new Error(`QuickCopy returned no ${kind}`);
			payload[kind] = { html: result.html, text: result.text };
		}
		return payload;
	},
	_cachePut(key, payload, ids) {
		const bytes = JSON.stringify(payload).length * 2;
		if (bytes > this._cacheByteLimit) return;
		this._cacheDelete(key);
		while (this._cache.size && (this._cache.size >= this._cacheLimit || this._cacheBytes + bytes > this._cacheByteLimit)) this._cacheDelete(this._cache.keys().next().value);
		this._cache.set(key, { payload, ids, bytes, created: Date.now() });
		this._cacheBytes += bytes;
	},
	_cacheDelete(key) {
		this._cacheBytes -= this._cache.get(key)?.bytes || 0;
		this._cache.delete(key);
	},
	_clipboardIconSVG() {
		return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3V0H1V13H4V16H15V3H12ZM2 1H11V12H2V1ZM14 15H5V13H12V4H14V15Z" fill="#cc9200"/></svg>';
	},
	_successIconSVG() {
		return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 1L5.5 9.5L2 6" stroke="#009900" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
	},
	_showCopyFeedback(state, button) {
		if (state.destroyed) return;
		for (const timer of state.copyFeedback.get(button) || []) {
			clearTimeout(timer);
			state.feedbackTimers.delete(timer);
		}
		button.classList.add('zotero-preview-copy-success');
		button.innerHTML = this._successIconSVG();
		const scaleTimer = setTimeout(() => {
			state.feedbackTimers.delete(scaleTimer);
			button.classList.remove('zotero-preview-copy-success');
		}, 300);
		const iconTimer = setTimeout(() => {
			state.feedbackTimers.delete(iconTimer);
			state.copyFeedback.delete(button);
			button.innerHTML = this._clipboardIconSVG();
		}, 1000);
		state.feedbackTimers.add(scaleTimer);
		state.feedbackTimers.add(iconTimer);
		state.copyFeedback.set(button, [scaleTimer, iconTimer]);
	},
	_block(kind, content) {
		const label = kind === 'citation' ? 'Copy in-text citation' : 'Copy bibliography';
		return `<section class="zotero-preview-block"><div class="zotero-preview-block-row"><div class="zotero-preview-block-body">${content.html}</div><div class="zotero-preview-block-toolbar"><span class="zotero-preview-copy" role="button" tabindex="0" title="${label}" aria-label="${label}" data-l10n-id="zotero-preview-copy-${kind}" data-copy-citation="${kind === 'citation'}">${this._clipboardIconSVG()}</span></div></div></section>`;
	},
	_renderPayload(state, payload, omitted) {
		let html = Object.entries(payload).map(([kind, content]) => this._block(kind, content)).join('<hr class="zotero-preview-separator"/>');
		if (omitted) html += `<div class="zotero-preview-message" data-l10n-id="zotero-preview-truncated" data-l10n-args='${JSON.stringify({ count: omitted })}'>${omitted} additional items omitted.</div>`;
		const { body, config } = state;
		body.style.setProperty('--zotero-preview-font-size', config.font + 'em');
		body.style.setProperty('--zotero-preview-line-height', config.spacing);
		const wrapped = `<div class="zotero-preview-content">${html}</div>`;
		// Fluent modifies attributes; compare our source rather than live innerHTML.
		if (state.lastHTML !== wrapped) { this._setHTML(state, wrapped); state.lastHTML = wrapped; }
		this._fitWidth(state);
	},
	_setHTML(state, html) {
		for (const timer of state.feedbackTimers) clearTimeout(timer);
		state.feedbackTimers.clear(); state.copyFeedback.clear();
		// Parse in an HTML document, then import into Zotero's XML/XUL document.
		// Unqualified innerHTML tags otherwise inherit the host XUL namespace.
		const parsed = new state.doc.defaultView.DOMParser().parseFromString(html, 'text/html');
		state.body.replaceChildren(...Array.from(parsed.body.childNodes,
			node => state.doc.importNode(node, true)));
	},
	_message(state, id, fallback, error = false) {
		state.lastHTML = null;
		this._setHTML(state, `<div class="zotero-preview-message${error ? ' zotero-preview-message-error' : ''}" role="status" data-l10n-id="${id}">${fallback}</div>`);
	},
	copyCitation(asCitations, body, button) {
		const state = this._states.get(body);
		const content = state?.payload?.[asCitations ? 'citation' : 'bibliography'];
		if (!content) return false;
		try {
			// Rich clipboard still uses XPCOM in Zotero. No window-mediator or
			// private File_Interface lookup; setTransferData uses the modern signature.
			const { classes: Cc, interfaces: Ci } = Components;
			const transferable = Cc['@mozilla.org/widget/transferable;1'].createInstance(Ci.nsITransferable);
			transferable.init(null);
			for (const [flavor, value] of [['text/html', content.html], ['text/plain', state.config.asHTML ? content.html : content.text]]) {
				const str = Cc['@mozilla.org/supports-string;1'].createInstance(Ci.nsISupportsString);
				str.data = value;
				transferable.addDataFlavor(flavor);
				transferable.setTransferData(flavor, str);
			}
			Services.clipboard.setData(transferable, null, Ci.nsIClipboard.kGlobalClipboard);
			if (button) this._showCopyFeedback(state, button);
			return true;
		}
		catch (error) {
			this.log(`Clipboard: ${error}`);
			let status = body.querySelector('.zotero-preview-copy-status');
			if (!status) {
				status = state.doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
				status.className = 'zotero-preview-copy-status'; status.setAttribute('role', 'status'); body.appendChild(status);
			}
			status.setAttribute('data-l10n-id', 'zotero-preview-copy-unavailable');
			status.textContent = 'Copy unavailable. Please try again.';
			return false;
		}
	},
	notify(event, type, ids) {
		if (this.initialized && type === 'tab' && event === 'select') {
			for (const state of this._states.values()) {
				this._queuePosition(state.body.closest('item-details'));
				if (!state.payload) this._scheduleRefresh(state);
			}
			return;
		}
		if (!this.initialized || type !== 'item' || !['modify', 'delete', 'trash', 'refresh', 'add'].includes(event)) return;
		const changed = event === 'refresh' ? null : new Set((ids || []).map(Number));
		if (changed && event === 'add') return;
		for (const [key, entry] of this._cache) if (!changed || entry.ids.some(id => changed.has(id))) this._cacheDelete(key);
		for (const state of this._states.values()) {
			if (!changed || state.ids.some(id => changed.has(id))) {
				state.payload = null; this._cancelRender(state); this._scheduleRefresh(state);
				if (!this._normalizeItem(state.item)) state.setEnabled?.(false);
			}
		}
	},
	_scheduleRefresh(state) {
		if (state.destroyed || state.refreshTimer !== null) return;
		state.refreshTimer = setTimeout(() => {
			state.refreshTimer = null;
			if (!this.initialized || state.destroyed) return;
			// Dirty hidden/collapsed sections render when next opened.
			if (!state.body.getClientRects().length || state.body.closest('collapsible-section')?.open === false) return;
			Promise.resolve().then(() => state.refresh()).catch(error => this.log(error));
		}, 80);
	},
	_queueAllPreviews() {
		this._cache.clear(); this._cacheBytes = 0;
		for (const state of this._states.values()) { state.payload = null; this._cancelRender(state); this._scheduleRefresh(state); }
	},
	setPref(pref, value) {
		const name = pref.replace(this._prefPrefix, '');
		const bounds = { fontsize: [1, 0.2, 3], spacing: [1.5, 1, 3], maxPreviewItems: [100, 1, 500] };
		if (bounds[name]) { value = this._number(value, ...bounds[name]); if (name === 'maxPreviewItems') value = Math.floor(value); }
		Zotero.Prefs.set(pref, value, true);
	},
	_destroySection(body) {
		const state = this._states.get(body);
		if (!state) return;
		state.destroyed = true; this._cancelRender(state);
		this._cleanup(() => state.widthObserver?.disconnect());
		const positionEntry = this._positionObservers.get(state.positionOwner);
		if (positionEntry && --positionEntry.count === 0) {
			this._cleanup(() => positionEntry.observer.disconnect());
			this._positionObservers.delete(state.positionOwner);
			const timer = this._positionTimers.get(state.positionOwner);
			if (timer !== undefined) clearTimeout(timer);
			this._positionTimers.delete(state.positionOwner);
		}
		if (state.refreshTimer !== null) clearTimeout(state.refreshTimer);
		for (const timer of state.feedbackTimers) clearTimeout(timer);
		state.copyFeedback.clear();
		this._cleanup(() => body.removeEventListener('click', state.handler));
		this._cleanup(() => body.removeEventListener('keydown', state.handler));
		this._states.delete(body);
		const sheet = this._stylesheets.get(state.doc);
		if (sheet && --sheet.count === 0) {
			this._cleanup(() => sheet.link.remove()); this._stylesheets.delete(state.doc);
		}
	},
	_cleanup(action) {
		try { action(); }
		catch (error) { Zotero.logError?.(error); }
	},
	shutdown() {
		if (!this.initialized) return;
		this.initialized = false;
		this._lifecycle = null;
		for (const timer of this._positionTimers.values()) clearTimeout(timer);
		this._positionTimers.clear();
		for (const { observer } of this._positionObservers.values()) this._cleanup(() => observer.disconnect());
		this._positionObservers.clear();
		this._positionRuns.clear();
		// A failed host unregister must not strand other resources on disable.
		const cleanup = action => this._cleanup(action);
		for (const dispose of [...this._prefPaneCleanups]) cleanup(dispose);
		this._prefPaneCleanups.clear();
		if (this._notifierID != null) cleanup(() => Zotero.Notifier.unregisterObserver(this._notifierID));
		for (const observer of this._prefObservers) cleanup(() => Zotero.Prefs.unregisterObserver(observer));
		if (this._sectionID) cleanup(() => Zotero.ItemPaneManager.unregisterSection(this._sectionID));
		for (const body of [...this._states.keys()]) cleanup(() => this._destroySection(body));
		for (const { link } of this._stylesheets.values()) cleanup(() => link.remove());
		this._stylesheets.clear(); this._cache.clear(); this._cacheBytes = 0;
		this._sectionID = null; this._notifierID = null; this._prefObservers = [];
	}
};
