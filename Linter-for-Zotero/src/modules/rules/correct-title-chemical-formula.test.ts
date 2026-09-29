import { describe, expect, it } from "vitest";
import sentenceCase from "../../../test/data/sentenceCase.json";
import { containsValidElementsOnly, formatChemicalFormula, formatPart } from "./correct-title-chemical-formula";

describe("containsValidElementsOnly", () => {
  it("should work", () => {
    const map = {
      "Na-": true,
      "Co3O4": true,
      "H2O": true,
      "HAP": false,
      "HTML5": false,
      "3D": false,
      "goal-": false,

      // expected error
      "P3": true, // because 'P' is valid element, although 'P3' is not valid chemical formula
      "C4": true, // because 'C' is valid element, although 'C4' is not valid chemical formula
    };
    Object.entries(map).forEach(([input, expected]) => {
      expect(containsValidElementsOnly(input)).toBe(expected);
    });
  });
});

describe("formatPart", () => {
  // skip
  it("should skip if do not have numbers", () => {
    expect(formatPart("NaCl")).toBe("NaCl");
  });

  it("should skip if letters not in chemical formula", () => {
    expect(formatPart("SAIHOP2")).toBe("SAIHOP2");
  });

  // supscript
  it("should format end with +/-", () => {
    expect(formatPart("Na-")).toBe("Na<sup>-</sup>");
  });

  it("should format supscript with +/-", () => {
    expect(formatPart("Co2+")).toBe("Co<sup>2+</sup>");
    expect(formatPart("O2-")).toBe("O<sup>2-</sup>");
  });

  it("should format supscript with ()", () => {
    expect(formatPart("Co(2+)")).toBe("Co<sup>2+</sup>");
    expect(formatPart("O(2-)")).toBe("O<sup>2-</sup>");
  });

  // subscript
  it("should format chemical formula", () => {
    expect(formatPart("NO2")).toBe("NO<sub>2</sub>");
  });

  it("should format chemical formula, multi-characters", () => {
    expect(formatPart("Co3O4")).toBe("Co<sub>3</sub>O<sub>4</sub>");
    expect(formatPart("Mn0.1Co0.9Co2O4")).toBe("Mn<sub>0.1</sub>Co<sub>0.9</sub>Co<sub>2</sub>O<sub>4</sub>");
  });

  it("should format cnki style sub/sup", () => {
    expect(formatPart("Co_3O_4")).toBe("Co<sub>3</sub>O<sub>4</sub>");
  });

  it("should format chemical formula, with ()", () => {
    expect(formatPart("NO(2)")).toBe("NO<sub>2</sub>");
    expect(formatPart("N(2)O")).toBe("N<sub>2</sub>O");
  });

  it("should format stoichiometric number after ()", () => {
    expect(formatPart("Fe(NO3)3")).toBe("Fe(NO<sub>3</sub>)<sub>3</sub>");
  });
});

const data = {
  "A study of NO conversion into NO2 and N2O over Co3O4 catalyst":
    "A study of NO conversion into NO<sub>2</sub> and N<sub>2</sub>O over Co<sub>3</sub>O<sub>4</sub> catalyst",
  "Co-existence of atomically dispersed Ru and Ce3+ sites is responsible for excellent low temperature N2O reduction activity of Ru/CeO2":
    "Co-existence of atomically dispersed Ru and Ce<sup>3+</sup> sites is responsible for excellent low temperature N<sub>2</sub>O reduction activity of Ru/CeO<sub>2</sub>",

  // CNKI: Co_3O_4
  "A study of NO conversion into NO_2 and N_2O over Co_3O_4 catalyst":
    "A study of NO conversion into NO<sub>2</sub> and N<sub>2</sub>O over Co<sub>3</sub>O<sub>4</sub> catalyst",

  // should skip if already has sub/sup
  "A study of NO conversion into NO<sub>2</sub> and N<sub>2</sub>O over Co<sub>3</sub>O<sub>4</sub> catalyst": "A study of NO conversion into NO<sub>2</sub> and N<sub>2</sub>O over Co<sub>3</sub>O<sub>4</sub> catalyst",

};

describe("transformTitle", () => {
  it("should not break sentence case", () => {
    Object
      .values(sentenceCase)
      .filter(i => !(i.includes("SHOP2")))
      .filter(i => ![
        "CI2 – a logic for plural representation",
      ].includes(i))
      .forEach((expected) => {
        expect(formatChemicalFormula(expected)).toBe(expected);
      });
  });

  Object.entries(data).forEach(([title, expected], index) => {
    it(`should transform ${index}`, () => {
      expect(formatChemicalFormula(title)).toBe(expected);
    });
  });

  it("should preserve existing HTML tags and format untagged formulas", () => {
    expect(formatChemicalFormula("Study of <i>Escherichia coli</i> with H2O and TiO2"))
      .toBe("Study of <i>Escherichia coli</i> with H<sub>2</sub>O and TiO<sub>2</sub>");
    expect(formatChemicalFormula("NO<sub>2</sub> and N2O"))
      .toBe("NO<sub>2</sub> and N<sub>2</sub>O");
  });

  it("should clean inter-formula spaces as learned from sub.txt", () => {
    expect(formatChemicalFormula("ReS 2")).toBe("ReS<sub>2</sub>");
    expect(formatChemicalFormula("CuInP2 S6")).toBe("CuInP<sub>2</sub>S<sub>6</sub>");
    expect(formatChemicalFormula("MoS2 / WS2")).toBe("MoS<sub>2</sub>/WS<sub>2</sub>");
    expect(formatChemicalFormula("Bi2O2 Se")).toBe("Bi<sub>2</sub>O<sub>2</sub>Se");
  });

  it("should protect 4-digit years", () => {
    expect(formatChemicalFormula("C2024 research report")).toBe("C2024 research report");
    expect(formatChemicalFormula("Report from (2024)")).toBe("Report from (2024)");
  });

  it("formats mixed stoichiometry, grouping and charges in one pass", () => {
    expect(formatChemicalFormula("NH4+ (NH4)2SO4 SO4^2- H_2O2 Pd2+"))
      .toBe("NH<sub>4</sub><sup>+</sup> (NH<sub>4</sub>)<sub>2</sub>SO<sub>4</sub> SO<sub>4</sub><sup>2-</sup> H<sub>2</sub>O<sub>2</sub> Pd<sup>2+</sup>");
  });

  it("preserves protected scripts, nocase markup, attributes and ordinary prose", () => {
    for (const title of [
      "<sub>H2 O</sub> <sup>Fe3+</sup>",
      "<span class='nocase'>MoS2 / WS2</span>",
      "<nc>Bi<sub>2</sub>O<sub>2</sub> Se</nc>",
      "HTML5 RNA2 C2024 MoS1234 3D 2D H2O2x",
      "Method / Results in 2024",
      "response2 / WS<sub>2</sub>",
      "<i title='H2O'>Water</i>",
    ]) {
      expect(formatChemicalFormula(title)).toBe(title);
    }
  });

  it("completes partially formatted formulas without nesting tags", () => {
    expect(formatChemicalFormula("Fe<sub>2</sub>O3 and MoS<sub>2</sub> / WS2"))
      .toBe("Fe<sub>2</sub>O<sub>3</sub> and MoS<sub>2</sub>/WS<sub>2</sub>");
  });

  it("allows space repair to be disabled independently", () => {
    expect(formatChemicalFormula("ReS 2 MoS2 / WS2", { normalizeSpaces: false }))
      .toBe("ReS 2 MoS<sub>2</sub> / WS<sub>2</sub>");
  });

  it("is idempotent across supported formula forms and rich text", () => {
    for (const title of [
      ...Object.keys(data),
      "Fe(NO3)3 NH4+ SO4^2- Mn0.1Co2.9O4",
      "MoS2 / WS2 CuInP2 S6 Bi2O2 Se ReS 2",
      "<i>H2O</i> <span class='nocase'>TiO2</span>",
      "Na+, O2-; Pd2+ and 14C",
    ]) {
      const first = formatChemicalFormula(title);
      expect(formatChemicalFormula(first)).toBe(first);
    }
  });
});
