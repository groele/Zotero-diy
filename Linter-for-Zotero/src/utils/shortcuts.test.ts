import { describe, expect, it } from "vitest";
import { matchesShortcut, normalizeShortcut, recordShortcut, SHORTCUT_DEFAULTS } from "./shortcuts";

function event(overrides = {}) {
  return {
    key: "=",
    code: "Equal",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides,
  };
}

describe("shortcut matching and recording", () => {
  it("records shifted '=' consistently and accepts the legacy '+' binding", () => {
    const shifted = event({ key: "+", shiftKey: true });
    expect(recordShortcut(shifted)).toBe("accel,shift,=");
    expect(matchesShortcut(shifted, "accel,shift,+")).toBe(true);
    expect(matchesShortcut(shifted, SHORTCUT_DEFAULTS.supscript)).toBe(true);
    expect(matchesShortcut(shifted, SHORTCUT_DEFAULTS.subscript)).toBe(false);
  });

  it("uses the physical key when macOS Option changes the typed character", () => {
    const mac = event({ key: "¬", code: "KeyL", ctrlKey: false, metaKey: true, altKey: true });
    expect(matchesShortcut(mac, SHORTCUT_DEFAULTS.lint, true)).toBe(true);
    expect(recordShortcut(mac, true)).toBe("accel,alt,L");
  });

  it("preserves independent Ctrl and Cmd modifiers on macOS", () => {
    expect(recordShortcut(event({ key: "b", code: "KeyB", metaKey: true }), true)).toBe("accel,control,B");
  });

  it("keeps numpad plus distinct from shifted '='", () => {
    const numpad = event({ key: "+", code: "NumpadAdd" });
    expect(matchesShortcut(numpad, SHORTCUT_DEFAULTS.supscript)).toBe(false);
    expect(recordShortcut(numpad)).toBe("accel,NumpadAdd");
  });

  it("rejects repeats, IME composition, AltGraph and modifier-only events", () => {
    for (const overrides of [{ repeat: true }, { isComposing: true }, { getModifierState: () => true }, { key: "Control", code: "ControlLeft" }])
      expect(matchesShortcut(event(overrides), "accel,=")).toBe(false);
  });

  it("canonicalizes conflicts and distinguishes disabled or malformed bindings", () => {
    expect(normalizeShortcut("CTRL,B")).toBeNull();
    expect(normalizeShortcut("control,b")).toBe(normalizeShortcut("accel,B"));
    expect(normalizeShortcut("accel,shift,+")).toBe(normalizeShortcut("control,shift,="));
    for (const invalid of ["B", "shift,B", "accel,", "accel,shift", "accel,b,c", "<script>"])
      expect(normalizeShortcut(invalid)).toBeNull();
    expect(normalizeShortcut("")).toBe("");
    expect(matchesShortcut(event(), "")).toBe(false);
  });
});
