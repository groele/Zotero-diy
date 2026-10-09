import { getPref, setPref } from "../utils/prefs";
import { matchesSettings, settingsTokens, validConcurrency } from "../utils/settings";

export function setupSettingsPanel(pane: Element) {
  const doc = pane.ownerDocument!;
  const search = pane.querySelector<HTMLInputElement>(".metaref-settings-search")!;
  const clear = pane.querySelector<HTMLButtonElement>(".metaref-settings-clear")!;
  const status = pane.querySelector<HTMLElement>(".metaref-settings-count")!;
  const empty = pane.querySelector<HTMLElement>(".metaref-settings-empty")!;
  const jump = pane.querySelector<HTMLSelectElement>(".metaref-settings-jump")!;
  const groups = [...pane.querySelectorAll<HTMLElement>(":scope > groupbox")];
  const details = [...pane.querySelectorAll<HTMLDetailsElement>("details")];
  const disclosureButtons = [...pane.querySelectorAll<HTMLButtonElement>(".metaref-settings-disclosure")];
  const controls = [...pane.querySelectorAll<HTMLElement>("[preference]")];
  const unitElements = [...new Set(controls.map(control => (control.closest(".metaref-shortcut-row, hbox") as HTMLElement | null) || control))];
  const about = groups.at(-1)!;
  unitElements.push(about);
  const text = (element: Element) => `${element.textContent} ${[...element.querySelectorAll("[label]")].map(node => node.getAttribute("label")).join(" ")} ${element.getAttribute("label") || ""}`;
  const units = unitElements.map((element) => {
    const prefs = controls.filter(control => element === control || element.contains(control)).map(control => control.getAttribute("preference")!);
    const descriptions: Element[] = [];
    let next = element.nextElementSibling;
    while (next?.localName === "description") {
      descriptions.push(next);
      next = next.nextElementSibling;
    }
    return { element, prefs, descriptions, text: "" };
  });
  const parents = new Map(units.map(unit => [unit, units.filter(parent => parent.prefs.some(key => unit.prefs.some(child => child.startsWith(`${key}.`)
    || (key.endsWith(".lint.onAdded") && child.endsWith(".lint.onGroup")))))]));
  const containers = [...pane.querySelectorAll<HTMLElement>("groupbox, .indented-pref, [data-journal-database]")]
    .map(element => ({ element, units: units.filter(unit => element === unit.element || element.contains(unit.element)) }));
  const detailUnits = new Map(details.map(detail => [detail, units.filter(unit => detail.contains(unit.element))]));
  let openStates: Map<HTMLDetailsElement, boolean> | undefined;
  const update = () => {
    const tokens = settingsTokens(search.value);
    const searching = tokens.length > 0;
    if (searching && !openStates)
      openStates = new Map(details.map(detail => [detail, detail.open]));
    const matches = new Set(units.filter(unit => matchesSettings(unit.text, tokens)));
    // Keep parent switches visible so a matching dependent option remains actionable.
    const visible = new Set(matches);
    for (const unit of matches) {
      for (const parent of parents.get(unit)!)
        visible.add(parent);
    }
    for (const unit of units) {
      const hidden = searching && !visible.has(unit);
      unit.element.hidden = hidden;
      for (const description of unit.descriptions)
        (description as HTMLElement).hidden = hidden;
    }
    for (const container of containers)
      container.element.hidden = searching && !container.units.some(unit => visible.has(unit));
    for (const detail of details) {
      detail.hidden = searching && !detailUnits.get(detail)!.some(unit => visible.has(unit));
      if (searching)
        detail.open = !detail.hidden;
      else if (openStates)
        detail.open = openStates.get(detail)!;
    }
    if (!searching)
      openStates = undefined;
    clear.disabled = !search.value;
    disclosureButtons.forEach(button => button.disabled = searching);
    empty.hidden = !searching || matches.size > 0;
    status.hidden = !searching;
    if (searching)
      doc.l10n!.setAttributes(status, "metaref-settings-results", { count: matches.size });
  };
  const clearSearch = () => {
    search.value = "";
    update();
  };
  const rebuild = () => {
    for (const unit of units) {
      const headings: string[] = [];
      let ancestor: Element | null = unit.element;
      while (ancestor && ancestor !== pane) {
        const heading = ancestor.querySelector(":scope > label, :scope > summary");
        if (heading)
          headings.push(text(heading));
        ancestor = ancestor.parentElement;
      }
      // Input values (including API secrets and paths) never enter the search index.
      unit.text = [text(unit.element), ...unit.descriptions.map(text), ...unit.prefs, ...headings, ...parents.get(unit)!.map(parent => text(parent.element))].join(" ");
    }
    update();
  };
  groups.forEach((group, index) => {
    group.id = `metaref-settings-section-${index}`;
    const heading = group.querySelector(":scope > label h2") as HTMLElement;
    heading.tabIndex = -1;
    const option = doc.createElementNS("http://www.w3.org/1999/xhtml", "option") as HTMLOptionElement;
    option.value = group.id;
    doc.l10n!.setAttributes(option, heading.getAttribute("data-l10n-id")!);
    jump.appendChild(option);
  });
  jump.addEventListener("change", () => {
    const group = groups.find(group => group.id === jump.value);
    if (!group)
      return;
    clearSearch();
    group.scrollIntoView({ block: "start" });
    (group.querySelector(":scope > label h2") as HTMLElement).focus({ preventScroll: true });
    jump.value = "";
  });
  search.addEventListener("input", update);
  search.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      clearSearch();
    }
  });
  clear.addEventListener("command", () => {
    clearSearch();
    search.focus();
  });
  pane.addEventListener("keydown", (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      event.stopPropagation();
      search.focus();
      search.select();
    }
  });
  for (const button of disclosureButtons) {
    button.addEventListener("command", () => details.forEach(detail => detail.open = button.dataset.open === "true"));
  }
  setupInputLabels(pane);
  setupConcurrency(pane);
  rebuild();
  void doc.l10n!.translateFragment(pane).then(rebuild);
}

function setupInputLabels(pane: Element) {
  for (const [index, input] of [...pane.querySelectorAll<HTMLElement>("input[preference], radiogroup[preference]")].entries()) {
    input.id ||= `metaref-setting-input-${index}`;
    const label = input.parentElement?.querySelector(":scope > label") || input.parentElement?.previousElementSibling;
    if (label?.localName === "label") {
      label.id ||= `${input.id}-label`;
      label.setAttribute("control", input.id);
      input.setAttribute("aria-labelledby", label.id);
    }
    const description = input.closest("hbox")?.querySelector("description") || input.closest("hbox")?.nextElementSibling;
    if (description?.localName === "description") {
      description.id ||= `${input.id}-description`;
      input.setAttribute("aria-describedby", [input.getAttribute("aria-describedby"), description.id].filter(Boolean).join(" "));
    }
  }
}

function setupConcurrency(pane: Element) {
  const input = pane.querySelector<HTMLInputElement>("input[type='number']")!;
  const doc = pane.ownerDocument!;
  const status = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
  status.id = "metaref-concurrency-status";
  status.className = "metaref-input-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  input.parentElement!.appendChild(status);
  input.setAttribute("aria-describedby", `${input.getAttribute("aria-describedby") || ""} ${status.id}`.trim());
  const validate = (event: Event) => {
    event.stopImmediatePropagation();
    const value = validConcurrency(input.value);
    if (value === null) {
      input.setAttribute("aria-invalid", "true");
      doc.l10n!.setAttributes(status, "metaref-settings-concurrency-invalid");
    }
    else {
      input.removeAttribute("aria-invalid");
      status.removeAttribute("data-l10n-id");
      status.textContent = "";
      setPref("lint.numConcurrent", value);
    }
  };
  input.addEventListener("input", validate, true);
  input.addEventListener("change", validate, true);
  input.addEventListener("blur", () => {
    if (input.hasAttribute("aria-invalid")) {
      input.value = String(getPref("lint.numConcurrent"));
      input.removeAttribute("aria-invalid");
      doc.l10n!.setAttributes(status, "metaref-settings-concurrency-restored");
    }
  });
}
