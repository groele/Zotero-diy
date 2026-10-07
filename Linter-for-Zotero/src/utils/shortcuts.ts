export const SHORTCUT_DEFAULTS = {
  subscript: "accel,=",
  supscript: "accel,shift,=",
  bold: "accel,B",
  italic: "accel,I",
  nocase: "accel,N",
  lint: "accel,alt,L",
  chemicalFormula: "accel,alt,S",
} as const;

export type ShortcutAction = keyof typeof SHORTCUT_DEFAULTS;

const modifiers = ["accel", "control", "meta", "alt", "shift"];
const modifierKeys = new Set(["Control", "Meta", "Alt", "Shift", "AltGraph", "Dead", "Process", "Unidentified"]);

export interface ShortcutEvent {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  isComposing?: boolean;
  repeat?: boolean;
  getModifierState?: (key: string) => boolean;
}

/** Physical key names keep shifted punctuation and macOS Option keys stable. */
function eventKey(event: ShortcutEvent): string {
  if (/^Key[A-Z]$/.test(event.code))
    return event.code.slice(3);
  if (/^Digit\d$/.test(event.code))
    return event.code.slice(5);
  if (event.code.startsWith("Numpad"))
    return event.code;
  const punctuation: Record<string, string> = {
    Equal: "=",
    Minus: "-",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Semicolon: ";",
    Quote: "'",
    Backquote: "`",
    Comma: "Comma",
    Period: ".",
    Slash: "/",
    Space: "Space",
  };
  return punctuation[event.code] ?? event.key;
}

export function normalizeShortcut(raw: string, isMac = false): string | null {
  if (!raw.trim())
    return "";
  const parts = raw.split(",").map(part => part.trim());
  const key = parts.pop()!;
  const mods = new Set(parts.map(part => part.toLowerCase()));
  if (parts.some(part => !modifiers.includes(part.toLowerCase())) || !key || modifierKeys.has(key))
    return null;
  if (mods.delete("accel"))
    mods.add(isMac ? "meta" : "control");
  if (key === "+")
    return null;
  const normalizedKey = key.toUpperCase();
  if (!["control", "meta", "alt"].some(mod => mods.has(mod)) && !/^F(?:[1-9]|1\d|2[0-4])$/.test(normalizedKey))
    return null;
  if (key.length > 1 && !/^(?:F(?:[1-9]|1\d|2[0-4])|Numpad(?:\d|Add|Subtract|Multiply|Divide|Decimal|Enter)|Space|Comma|Arrow(?:Up|Down|Left|Right)|Home|End|PageUp|PageDown|Insert|Delete|Backspace|Enter)$/i.test(key))
    return null;
  return [...modifiers.filter(mod => mods.has(mod)), normalizedKey].join(",");
}

export function recordShortcut(event: ShortcutEvent, isMac = false): string | null {
  if (event.isComposing || event.getModifierState?.("AltGraph") || modifierKeys.has(event.key))
    return null;
  const parts = [];
  if (isMac ? event.metaKey : event.ctrlKey)
    parts.push("accel");
  if (isMac && event.ctrlKey)
    parts.push("control");
  if (!isMac && event.metaKey)
    parts.push("meta");
  if (event.altKey)
    parts.push("alt");
  if (event.shiftKey)
    parts.push("shift");
  parts.push(eventKey(event));
  const raw = parts.join(",");
  return normalizeShortcut(raw, isMac) ? raw : null;
}

export function matchesShortcut(event: ShortcutEvent, raw: string, isMac = false): boolean {
  if (event.isComposing || event.repeat || event.getModifierState?.("AltGraph"))
    return false;
  const shortcut = normalizeShortcut(raw, isMac);
  const recorded = recordShortcut(event, isMac);
  return Boolean(shortcut && recorded && shortcut === normalizeShortcut(recorded, isMac));
}

export function shortcutPreview(raw: string, isMac = false): string {
  const normalized = normalizeShortcut(raw, isMac);
  if (!normalized)
    return "";
  const labels: Record<string, string> = {
    control: "Ctrl",
    meta: isMac ? "Cmd" : "Win",
    alt: isMac ? "Option" : "Alt",
    shift: "Shift",
  };
  return normalized.split(",").map(part => labels[part] ?? part).join(" + ");
}
