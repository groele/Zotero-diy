import type { FluentMessageId } from "../../typings/i10n";
import { getString } from "../utils/locale";
import { getPref } from "../utils/prefs";
import { removeHtmlTag } from "../utils/str";

const TOOLBAR_CLASS = "metaref-richtext-toolbar";
const PREVIEW_ID = "metaref-title-preview";
const HEADER_TITLE_SELECTOR = "item-pane-header .title editable-text";
const BUTTON_ICON_SIZE = 16;

interface ButtonConfig {
  name: string;
  i18nName: FluentMessageId;
  hookName: string;
  icon: string;
}

const BUTTONS: ButtonConfig[] = [
  {
    name: "Subscript",
    i18nName: "subscript",
    hookName: "subscript",
    icon: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" data-darkreader-inline-fill="" width="${BUTTON_ICON_SIZE}" height="${BUTTON_ICON_SIZE}"><path d="M755.809524 109.714286V243.809524h-73.142857V182.857143h-207.238096V828.952381H536.380952v24.380952c0 17.773714 4.754286 34.450286 13.068191 48.786286L316.952381 902.095238v-73.142857h85.333333V182.857143h-219.428571V243.809524h-73.142857V109.714286H755.809524zM877.714286 560.761905a48.761905 48.761905 0 0 1 48.761904 48.761905v243.809523a48.761905 48.761905 0 0 1-48.761904 48.761905H633.904762a48.761905 48.761905 0 0 1-48.761905-48.761905V609.52381a48.761905 48.761905 0 0 1 48.761905-48.761905h243.809524z m-24.380953 73.142857h-195.047619v195.047619h195.047619v-195.047619z"></path></svg>`,
  },
  {
    name: "Supscript",
    i18nName: "supscript",
    hookName: "supscript",
    icon: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" data-darkreader-inline-fill="" width="${BUTTON_ICON_SIZE}" height="${BUTTON_ICON_SIZE}"><path d="M755.809524 121.904762v134.095238h-73.142857V195.047619h-207.238096v646.095238H560.761905v73.142857H316.952381v-73.142857h85.333333V195.047619h-219.428571v60.952381h-73.142857V121.904762H755.809524z m121.904762 182.857143a48.761905 48.761905 0 0 1 48.761904 48.761905v243.809523a48.761905 48.761905 0 0 1-48.761904 48.761905H633.904762a48.761905 48.761905 0 0 1-48.761905-48.761905v-243.809523a48.761905 48.761905 0 0 1 48.761905-48.761905h243.809524z m-24.380953 73.142857h-195.047619v195.047619h195.047619v-195.047619z"></path></svg>`,
  },
  {
    name: "Bold",
    i18nName: "bold",
    hookName: "bold",
    icon: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" data-darkreader-inline-fill="" width="${BUTTON_ICON_SIZE}" height="${BUTTON_ICON_SIZE}"><path d="M195.047619 914.285714v-73.142857h73.142857v-658.285714H195.047619v-73.142857h438.857143v1.340952c102.521905 11.337143 182.857143 93.208381 182.857143 193.706667 0 62.902857-31.451429 118.491429-80.11581 154.087619 76.873143 41.910857 128.877714 120.783238 128.877715 211.626666 0 127.24419-102.009905 231.033905-231.594667 242.712381L633.904762 914.285714H195.047619z m414.476191-414.47619H341.333333v341.333333h268.190477c101.424762 0 182.857143-76.897524 182.857142-170.666667s-81.432381-170.666667-182.857142-170.666666z m0-316.952381H341.333333v243.809524h268.190477l5.558857-0.097524c72.021333-2.681905 128.536381-56.783238 128.536381-121.807238 0-66.706286-59.465143-121.904762-134.095238-121.904762z"></path></svg>`,
  },
  {
    name: "Italic",
    i18nName: "italic",
    hookName: "italic",
    icon: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" data-darkreader-inline-fill="" width="${BUTTON_ICON_SIZE}" height="${BUTTON_ICON_SIZE}"><path d="M764 200a4 4 0 0 0 4-4v-64a4 4 0 0 0-4-4H452a4 4 0 0 0-4 4v64a4 4 0 0 0 4 4h98.4L408.2 824H292a4 4 0 0 0-4 4v64a4 4 0 0 0 4 4h312a4 4 0 0 0 4-4v-64a4 4 0 0 0-4-4H488.2l142.2-624z"></path></svg>`,
  },
  {
    name: "No Case",
    i18nName: "no-case",
    hookName: "nocase",
    icon: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="${BUTTON_ICON_SIZE}" height="${BUTTON_ICON_SIZE}"><path d="M361.411765 356.894118h60.235294v120.470588H361.411765v-60.235294H240.941176v481.882353h60.235295v60.235294H120.470588v-60.235294h60.235294v-481.882353H60.235294v60.235294H0v-120.470588h361.411765zM963.764706 120.470588H361.411765v155.226353h60.235294V180.705882h240.941176v722.82353h-60.235294v60.235294h180.705883v-60.235294h-60.235295V180.705882h240.941177v94.991059h60.235294V120.470588h-60.235294z"></path></svg>`,
  },
  {
    name: "Small Caps",
    i18nName: "small-caps",
    hookName: "small-caps",
    icon: `<svg t="1715086915579" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="31298" data-darkreader-inline-fill="" width="${BUTTON_ICON_SIZE}" height="${BUTTON_ICON_SIZE}"><path d="M732.493 180.604l8.469 199.035h-25.308q-16.938-97.22-50.617-124.931c-19.662-18.474-60.546-27.76-122.368-27.76h-59.085v606.393q0 64.867 16.84 83.291c14.015 12.382 43.607 20.07 88.578 23.166v23.166H272.538v-23.302q67.456-4.482 84.394-27.76c11.143-9.286 16.839-40.042 16.839-92.577V226.837h-58.986q-92.863 0-122.368 27.76c-22.585 18.473-39.424 60.224-50.617 124.93h-25.308l8.47-199.035h607.53z" p-id="31299"></path><path d="M987.927 534.893l4.668 111.051h-14.103c-6.327-36.204-15.675-59.37-28.23-69.721q-16.505-15.54-68.335-15.477h-33.01v338.366c0 24.132 3.12 39.622 9.448 46.555 7.887 6.946 24.342 11.218 49.452 12.914v12.914H731.23v-12.901c25.11-1.709 40.785-6.835 47.112-15.477 6.191-5.126 9.447-22.287 9.447-51.681V560.783h-32.997q-51.842 0-68.334 15.477-18.833 15.539-28.23 69.721h-14.116l4.668-111.051z" p-id="31300"></path></svg>`,
  },
];

/** -------------------- BUTTON MODULE -------------------- */
class ButtonManager {
  constructor(private window: Window) {}

  createToolbar(): HTMLDivElement {
    const document = this.window.document;
    const toolbarDiv = (document.createElementNS?.("http://www.w3.org/1999/xhtml", "div")
      || document.createElement("div")) as HTMLDivElement;
    toolbarDiv.className = TOOLBAR_CLASS;
    Object.assign(toolbarDiv.style, {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: "4px",
      padding: "2px 4px",
      margin: "2px 0 4px 0",
      backgroundColor: "var(--material-sidepanel-background, #f5f5f5)",
      border: "1px solid var(--material-border, #dcdcdc)",
      borderRadius: "4px",
      width: "fit-content",
      boxSizing: "border-box",
      zIndex: "10",
    });

    BUTTONS.forEach((btn) => {
      const button = this.createToolbarButton(btn);
      toolbarDiv.appendChild(button);
    });

    return toolbarDiv;
  }

  private createToolbarButton(btn: ButtonConfig): HTMLElement {
    const document = this.window.document;
    const button = (document.createElementNS?.("http://www.w3.org/1999/xhtml", "button")
      || document.createElement("button")) as HTMLButtonElement;

    button.type = "button";
    button.id = `metaref-richtext-${btn.hookName}-btn`;
    button.className = "zotero-tb-button metaref-tb-btn";
    Object.assign(button.style, {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      padding: "2px",
      width: "24px",
      height: "24px",
      border: "1px solid transparent",
      borderRadius: "3px",
      background: "transparent",
      color: "var(--fill-secondary, currentColor)",
      boxSizing: "border-box",
      outline: "none",
    });
    const titleText = getString(btn.i18nName) || btn.name;
    button.setAttribute("title", titleText);
    button.setAttribute("tooltiptext", titleText);

    button.innerHTML = btn.icon;
    const svg = button.querySelector("svg");
    if (svg) {
      svg.setAttribute("style", `width: ${BUTTON_ICON_SIZE}px; height: ${BUTTON_ICON_SIZE}px; fill: currentColor; pointer-events: none;`);
    }

    button.addEventListener("mouseenter", () => {
      button.style.backgroundColor = "var(--toolbarbutton-hover-background, rgba(0, 0, 0, 0.08))";
      button.style.borderColor = "var(--toolbarbutton-hover-bordercolor, rgba(0, 0, 0, 0.15))";
    });
    button.addEventListener("mouseleave", () => {
      button.style.backgroundColor = "transparent";
      button.style.borderColor = "transparent";
    });

    button.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      addon.hooks.onShortcuts(btn.hookName, this.window);
    });

    return button;
  }

  attachToolbar(textarea: HTMLTextAreaElement): void {
    const editable = textarea.closest(HEADER_TITLE_SELECTOR);
    const container = editable?.parentElement;
    if (!container)
      return;
    if (container.querySelector(`.${TOOLBAR_CLASS}`))
      return;
    this.close();
    const bar = this.createToolbar();
    container.insertBefore(bar, container.querySelector(`#${PREVIEW_ID}`) || editable!.nextSibling);
  }

  close(): void {
    this.window.document.querySelectorAll(`.${TOOLBAR_CLASS}`).forEach((el: Element) => el.remove());
  }
}

/** -------------------- PREVIEW MODULE -------------------- */
class PreviewManager {
  private listeners = new Map<HTMLTextAreaElement, { focus: () => void; input: () => void }>();

  constructor(private window: Window) {}

  attachPreview(textarea: HTMLTextAreaElement): void {
    this.updatePreview(textarea);
    if (this.listeners.has(textarea))
      return;

    const focusListener = () => this.updatePreview(textarea);
    const inputListener = () => this.updatePreview(textarea);

    textarea.addEventListener("focus", focusListener);
    textarea.addEventListener("input", inputListener);

    this.listeners.set(textarea, { focus: focusListener, input: inputListener });
  }

  private ensurePreview(textarea: HTMLTextAreaElement): HTMLDivElement {
    const container = textarea.closest(HEADER_TITLE_SELECTOR)?.parentElement;
    let preview = container?.querySelector<HTMLDivElement>(`#${PREVIEW_ID}`);
    if (!preview && container) {
      preview = (this.window.document.createElementNS?.("http://www.w3.org/1999/xhtml", "div")
        || this.window.document.createElement("div")) as HTMLDivElement;
      preview.id = PREVIEW_ID;
      Object.assign(preview.style, {
        border: "1px solid var(--material-border, #ccc)",
        padding: "6px",
        marginTop: "6px",
        whiteSpace: "pre-wrap",
        fontWeight: "normal",
        borderRadius: "5px",
        color: "inherit",
        backgroundColor: "var(--material-background, #fff)",
        fontSize: "12px",
        lineHeight: "1.4",
      });
      container.appendChild(preview);
    }
    return preview!;
  }

  updatePreview(textarea: HTMLTextAreaElement): void {
    const preview = this.ensurePreview(textarea);
    if (!preview)
      return;
    const value = textarea.value;

    const errorDetails = this.checkHTMLorXMLValidity(value);
    if (errorDetails) {
      preview.textContent = `${getString("richtext-preview-error")}\n${errorDetails}`;
    }
    else {
      const parser = new (this.window as Window & typeof globalThis).DOMParser();
      const doc = parser.parseFromString(`<root>${escapeTitleText(value)}</root>`, "application/xml");
      const fragment = this.window.document.createDocumentFragment();
      const appendSafe = (source: Node, parent: Node) => {
        if (source.nodeType === 3) {
          parent.appendChild(this.window.document.createTextNode(source.textContent || ""));
          return;
        }
        const tag = (source as Element).localName;
        if (!["i", "b", "sub", "sup", "span"].includes(tag)) {
          parent.appendChild(this.window.document.createTextNode(source.textContent || ""));
          return;
        }
        const node = (this.window.document.createElementNS?.("http://www.w3.org/1999/xhtml", tag)
          || this.window.document.createElement(tag)) as HTMLElement;
        if (tag === "span") {
          const element = source as Element;
          const className = element.getAttribute("class");
          if (className === "nocase" || className === "nc")
            node.setAttribute("class", className);
          if (/^font-variant:\s*small-caps;?$/.test(element.getAttribute("style") || ""))
            node.setAttribute("style", "font-variant: small-caps");
        }
        source.childNodes.forEach(child => child && appendSafe(child, node));
        parent.appendChild(node);
      };
      doc.documentElement?.childNodes.forEach(child => child && appendSafe(child, fragment));
      preview.replaceChildren(fragment);
    }
  }

  checkHTMLorXMLValidity(source: string): string | null {
    const wrapped = `<root>${escapeTitleText(source)}</root>`;
    const parser = new (this.window as Window & typeof globalThis).DOMParser();
    const doc = parser.parseFromString(wrapped, "application/xml");
    const errorNode = doc.querySelector("parsererror");
    if (errorNode) {
      return errorNode.textContent?.split("\n")[0] || "Unknown parsing error";
    }
    return null;
  }

  close(): void {
    this.window.document
      .querySelectorAll(`#${PREVIEW_ID}`)
      .forEach((el: Element) => el.remove());

    this.listeners.forEach((listener, textarea) => {
      textarea.removeEventListener("focus", listener.focus);
      textarea.removeEventListener("input", listener.input);
    });

    this.listeners.clear();
  }
}

/** -------------------- MAIN CLASS -------------------- */
export class RichTextToolBar {
  private buttonManager: ButtonManager;
  private previewManager: PreviewManager;
  private observer?: MutationObserver;
  private closeTimer?: number;

  constructor(private window: Window) {
    this.buttonManager = new ButtonManager(window);
    this.previewManager = new PreviewManager(window);
  }

  init(): void {
    const initialTextarea = getTitleEditor(this.window);
    if (initialTextarea) {
      this.openFor(initialTextarea);
    }

    this.window.document.addEventListener("focusin", this.onFocusIn, true);
    this.window.document.addEventListener("focusout", this.onFocusOut, true);
    this.window.document.addEventListener("input", this.onInput, true);
    this.window.document.addEventListener("click", this.onClick, true);

    const MutationObserver = (this.window as Window & typeof globalThis).MutationObserver;
    if (MutationObserver) {
      this.observer = new MutationObserver((records) => {
        for (const record of records) {
          if (record.type === "attributes" && record.attributeName === "class") {
            const target = record.target as HTMLElement;
            if (target?.matches?.(HEADER_TITLE_SELECTOR)) {
              if (target.classList.contains("focused")) {
                const textarea = target.querySelector("textarea") || getTitleEditor(this.window);
                if (textarea)
                  this.openFor(textarea);
              }
              else if (target.className === "") {
                this.close();
              }
            }
          }
          else if (record.type === "childList") {
            for (const node of record.addedNodes) {
              const el = node as HTMLElement;
              if (el?.localName === "textarea" && el.closest?.(HEADER_TITLE_SELECTOR)) {
                this.openFor(el as HTMLTextAreaElement);
              }
              else if (el?.querySelector) {
                const nested = el.querySelector(`${HEADER_TITLE_SELECTOR} textarea`) as HTMLTextAreaElement | null;
                if (nested)
                  this.openFor(nested);
              }
            }
          }
        }
      });
      const root = this.window.document.documentElement || this.window.document.body;
      if (root) {
        this.observer.observe(root, {
          attributes: true,
          attributeFilter: ["class"],
          childList: true,
          subtree: true,
        });
      }
    }
  }

  private onFocusIn = (event: Event): void => {
    this.window.clearTimeout(this.closeTimer);
    const target = event.target as HTMLElement | null;
    if (!target)
      return;
    if (target.localName === "textarea" && target.closest?.(HEADER_TITLE_SELECTOR)) {
      this.openFor(target as HTMLTextAreaElement);
    }
    else if (target.matches?.(HEADER_TITLE_SELECTOR)) {
      const textarea = target.querySelector("textarea") || getTitleEditor(this.window);
      if (textarea)
        this.openFor(textarea);
    }
  };

  private onFocusOut = (event: FocusEvent): void => {
    const target = event.target as HTMLElement | null;
    if (target?.localName === "textarea" && target.closest?.(HEADER_TITLE_SELECTOR)) {
      const related = event.relatedTarget as HTMLElement | null;
      if (related && (related.closest?.(`.${TOOLBAR_CLASS}`) || related.closest?.(HEADER_TITLE_SELECTOR)))
        return;

      this.window.clearTimeout(this.closeTimer);
      this.closeTimer = this.window.setTimeout(() => {
        const active = this.window.document.activeElement as HTMLElement | null;
        if (active?.closest?.(HEADER_TITLE_SELECTOR) || active?.closest?.(`.${TOOLBAR_CLASS}`))
          return;
        const editor = getTitleEditor(this.window);
        if (editor && (editor === active || editor.closest("editable-text")?.classList.contains("focused")))
          return;
        this.close();
      }, 150);
    }
  };

  private onInput = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    if (target?.localName === "textarea" && target.closest?.(HEADER_TITLE_SELECTOR)) {
      if (getPref("richtext.preview", true))
        this.previewManager.updatePreview(target as HTMLTextAreaElement);
    }
  };

  private onClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    const editable = target?.closest?.(HEADER_TITLE_SELECTOR);
    if (editable) {
      this.window.setTimeout(() => {
        const textarea = editable.querySelector("textarea") || getTitleEditor(this.window);
        if (textarea)
          this.openFor(textarea);
      }, 50);
    }
  };

  openFor(textarea: HTMLTextAreaElement): void {
    this.window.clearTimeout(this.closeTimer);
    if (!textarea.closest(HEADER_TITLE_SELECTOR))
      return;
    if (getPref("richtext.toolBar", true))
      this.buttonManager.attachToolbar(textarea);
    if (getPref("richtext.preview", true))
      this.previewManager.attachPreview(textarea);
  }

  /** Close all toolbar and preview elements when the title editor loses focus. */
  close(): void {
    this.buttonManager.close();
    this.previewManager.close();
  }

  /** Remove window-local listeners when the window or plugin closes. */
  clean(): void {
    this.window.clearTimeout(this.closeTimer);
    this.observer?.disconnect();
    this.window.document.removeEventListener("focusin", this.onFocusIn, true);
    this.window.document.removeEventListener("focusout", this.onFocusOut, true);
    this.window.document.removeEventListener("input", this.onInput, true);
    this.window.document.removeEventListener("click", this.onClick, true);
    this.close();
  }
}

export function escapeTitleText(source: string): string {
  return source.split(/(<\/?(?:i|b|sub|sup|span)\b[^>]*>)/gi).map((part, index) => {
    if (index % 2)
      return part;
    return part.replace(/&nbsp;/g, "&#160;")
      .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);)/gi, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }).join("");
}

export function getTitleEditor(win: Window): HTMLTextAreaElement | null {
  const active = win.document.activeElement as HTMLElement | null;
  if (active?.localName === "textarea" && active.closest?.(HEADER_TITLE_SELECTOR))
    return active as HTMLTextAreaElement;
  return null;
}

/**
 * Get the selected text and replace it with text with or without HTML tags depending on the operation.
 * @param tag sub | sup | b | i | span
 * @param attribute Optional tag attribute
 * @param value Attribute value
 * @param win Window containing the title editor
 */
export function setHtmlTag(tag: string, attribute?: string, value?: string, win: Window = Zotero.getMainWindow()): void {
  const textarea = getTitleEditor(win);
  if (!textarea || textarea.selectionStart == null || textarea.selectionEnd == null)
    return;

  const { selectionStart: start, selectionEnd: end, value: text } = textarea;
  const attributeText = attribute ? ` ${attribute}="${value}"` : "";
  const openTag = `<${tag}${attributeText}>`;
  const closeTag = `</${tag}>`;

  if (start === end) {
    const emptyTag = `${openTag}${closeTag}`;
    textarea.setRangeText(emptyTag, start, end, "end");
    const newPos = start + openTag.length;
    textarea.setSelectionRange(newPos, newPos);
  }
  else {
    let selectedText = text.slice(start, end);
    if (selectedText.startsWith(openTag) && selectedText.endsWith(closeTag)) {
      selectedText = selectedText.slice(openTag.length, -closeTag.length);
    }
    else if (selectedText.startsWith(`<${tag}`) && selectedText.endsWith(`</${tag}>`)) {
      selectedText = removeHtmlTag(selectedText);
    }
    else {
      selectedText = `${openTag}${selectedText}${closeTag}`;
    }
    textarea.setRangeText(selectedText, start, end, "select");
  }

  textarea.style.height = "auto";
  if (textarea.scrollHeight > 0)
    textarea.style.height = `${textarea.scrollHeight}px`;

  const Event = (win as Window & typeof globalThis).Event;
  const inputEvent = new Event("input", { bubbles: true });
  textarea.dispatchEvent(inputEvent);

  textarea.focus();
}
