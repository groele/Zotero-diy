import type { FluentMessageId } from "../../typings/i10n";
import { getString } from "../utils/locale";
import { getPref } from "../utils/prefs";

const TOOLBAR_CLASS = "linter-richtext-toolbar";
const PREVIEW_ID = "zotero-textarea-preview";
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
    const toolbarDiv = document.createElementNS("http://www.w3.org/1999/xhtml", "div") as HTMLDivElement;
    toolbarDiv.className = TOOLBAR_CLASS;
    toolbarDiv.style.display = "flex";

    BUTTONS.forEach((btn) => {
      const button = this.createToolbarButton(btn);
      toolbarDiv.appendChild(button);
    });

    return toolbarDiv;
  }

  private createToolbarButton(btn: ButtonConfig): HTMLElement {
    const document = this.window.document;
    const button = document.createElement("toolbarbutton");

    button.id = `linter-richtext-${btn.hookName}-btn`;
    button.className = "zotero-tb-button";
    Object.assign(button.style, {
      fill: "currentColor",
      stroke: "currentColor",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    });
    button.setAttribute("title", getString(btn.i18nName));

    const image = document.createElement("image");
    image.className = "toolbarbutton-icon";
    image.innerHTML = btn.icon;

    const label = document.createElement("label");
    label.className = "toolbarbutton-text";

    button.append(image, label);

    button.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      addon.hooks.onShortcuts(btn.hookName, this.window);
    });

    return button;
  }

  attachToolbar(textarea: HTMLTextAreaElement): void {
    if (this.window.document?.querySelector(`.${TOOLBAR_CLASS}`))
      return;

    const bar = this.createToolbar();
    textarea.parentElement?.parentElement?.insertBefore(bar, textarea.parentElement);
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
    let preview = textarea.parentElement?.querySelector<HTMLDivElement>(`#${PREVIEW_ID}`);
    if (!preview && textarea.parentElement) {
      preview = this.window.document.createElementNS("http://www.w3.org/1999/xhtml", "div") as HTMLDivElement;
      preview.id = PREVIEW_ID;
      Object.assign(preview.style, {
        border: "1px solid #ccc",
        padding: "6px",
        marginTop: "6px",
        whiteSpace: "pre-wrap",
        fontWeight: "normal",
        borderRadius: "5px",
      });
      textarea.parentElement.appendChild(preview);
    }
    return preview!;
  }

  updatePreview(textarea: HTMLTextAreaElement): void {
    if (!this.window.document.hasFocus() || getTitleEditor(this.window) !== textarea) {
      this.close();
      return;
    }
    const preview = this.ensurePreview(textarea);
    const value = textarea.value;

    const errorDetails = this.checkHTMLorXMLValidity(value);
    if (errorDetails) {
      // We should use textContent instead of innerHTML,
      // because tags in errorDetails will break the preview,
      // even we excape the errorDetails.
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
        const node = this.window.document.createElementNS("http://www.w3.org/1999/xhtml", tag);
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
    // Should wrap the source with a root tag, because DOMParser
    // will throw error if the xml doesn't have a root tag.
    const wrapped = `<root>${escapeTitleText(source)}</root>`;
    const parser = new (this.window as Window & typeof globalThis).DOMParser();
    const doc = parser.parseFromString(wrapped, "application/xml");
    const errorNode = doc.querySelector("parsererror");
    if (errorNode) {
      /**
       * Example of errorNode.textContent:
       *
       * "XML Parsing Error: mismatched tag. Expected: </sub>.
       * Location: moz-nullprincipal:{0cfb54c0-6fe2-48bb-963b-db92e9a2ce31}
       * Line Number 1, Column 115:<root>Enhancing performance of Co/CeO<sub>2</sub> catalyst by Sr doping for catalytic combustion of toluene<sub></root>
       * ------------------------------------------------------------------------------------------------------------------^"
       *
       * We only need the first line of errorDetails.
       */
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
  private refreshTimer?: number;
  private observer?: MutationObserver;

  constructor(private window: Window) {
    this.buttonManager = new ButtonManager(window);
    this.previewManager = new PreviewManager(window);
  }

  init(): void {
    this.window.addEventListener("focus", this.onFocus, true);
    this.window.addEventListener("blur", this.onBlur, true);
    this.window.document.addEventListener("focusin", this.onFocus);
    this.window.document.addEventListener("focusout", this.onBlur);
    this.window.document.addEventListener("input", this.onInput, true);
    this.observer = new (this.window as Window & typeof globalThis).MutationObserver((records) => {
      if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => (node as Element).localName === "textarea" || (node as Element).querySelector?.("editable-text[fieldname='title']")))) {
        this.onFocus(new (this.window as Window & typeof globalThis).Event("focus"));
      }
    });
    this.observer.observe(this.window.document.documentElement!, { childList: true, subtree: true });
    this.onFocus();
  }

  private onFocus = (event?: Event): void => {
    if (event) {
      this.window.clearTimeout(this.refreshTimer);
      // Focus events can arrive before the deferred refresh in background windows.
      this.close();
      this.refreshTimer = this.window.setTimeout(() => {
        this.refreshTimer = undefined;
        this.onFocus();
      }, 0);
      return;
    }
    const textarea = getTitleEditor(this.window);
    this.close();
    if (!textarea || !this.window.document.hasFocus())
      return;
    if (getPref("richtext.toolBar"))
      this.buttonManager.attachToolbar(textarea);
    if (getPref("richtext.preview"))
      this.previewManager.attachPreview(textarea);
  };

  private onBlur = (event: Event): void => {
    this.window.clearTimeout(this.refreshTimer);
    this.close();
    if (event.target === this.window)
      return;
    const relatedTarget = (event as FocusEvent).relatedTarget as Element | null;
    if (relatedTarget && !relatedTarget.closest?.("editable-text[fieldname='title']"))
      return;
    this.onFocus(event);
  };

  private onInput = (): void => {
    if (getTitleEditor(this.window) && getPref("richtext.preview") && !this.window.document.getElementById(PREVIEW_ID))
      this.onFocus();
  };

  /** Close all toolbar and preview elements when the title editor loses focus. */
  close(): void {
    this.buttonManager.close();
    this.previewManager.close();
  }

  /** Remove window-local listeners when the window or plugin closes. */
  clean(): void {
    this.window.clearTimeout(this.refreshTimer);
    this.observer?.disconnect();
    this.window.removeEventListener("focus", this.onFocus, true);
    this.window.removeEventListener("blur", this.onBlur, true);
    this.window.document.removeEventListener("focusin", this.onFocus);
    this.window.document.removeEventListener("focusout", this.onBlur);
    this.window.document.removeEventListener("input", this.onInput, true);
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
  const active = win.document.activeElement;
  if (active?.localName !== "textarea" || !active.closest("editable-text[fieldname='title']"))
    return null;
  return active as HTMLTextAreaElement;
}

/**
 * Get the selected text and replace it with text with or without HTML tags depending on the operation.
 * @param tag sub | sup | b | i
 * @param attribute Optional tag attribute
 * @param value Attribute value
 * @param win Window containing the title editor
 * @see https://stackoverflow.com/questions/31036076/how-to-replace-selected-text-in-a-textarea-with-javascript
 */
export function setHtmlTag(tag: string, attribute?: string, value?: string, win: Window = Zotero.getMainWindow()): void {
  const textarea = getTitleEditor(win);
  if (!textarea || textarea.selectionStart == null || textarea.selectionEnd == null || textarea.selectionStart === textarea.selectionEnd)
    return;

  const { selectionStart: start, selectionEnd: end, value: text } = textarea;
  let selectedText = text.slice(start, end);

  const attributeText = attribute ? ` ${attribute}="${value}"` : "";
  const openTag = `<${tag}${attributeText}>`;
  const closeTag = `</${tag}>`;
  selectedText = selectedText.startsWith(openTag) && selectedText.endsWith(closeTag)
    ? selectedText.slice(openTag.length, -closeTag.length)
    : `${openTag}${selectedText}${closeTag}`;

  textarea.setRangeText(selectedText, start, end, "select");

  // The changes of content may cause the height of textarea to change
  textarea.style.height = "auto";

  // Dispatch input event to trigger any listeners
  // Zotero not expose Event as global vars, so we define it here
  const Event = (win as Window & typeof globalThis).Event;
  const inputEvent = new Event("input", { bubbles: true });
  textarea.dispatchEvent(inputEvent);

  textarea.focus();
}
