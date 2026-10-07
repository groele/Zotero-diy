import { validateISO2 } from "tinyld";
import { getPref } from "../../utils/prefs";
import { getTextLanguage } from "../../utils/str";
import { defineRule } from "./rule-base";

export const RequireLanguage = defineRule({
  id: "require-language",
  scope: "field",

  // computerProgram do not have field language
  // https://github.com/northword/zotero-format-metadata/issues/185
  // https://www.zotero.org/support/kb/item_types_and_fields#fields_for_software
  ignoreItemTypes: ["computerProgram"],
  targetItemField: "language",
  fieldMenu: {
    l10nID: "rule-require-language-menu-field",
  },
  async apply({ item, debug }) {
    // Check if language field already has a valid ISO 639-1 code
    const existingLanguage = item.getField("language") as string;
    if (existingLanguage && getPref("rule.require-language.verify-before")) {
      const iso2Code = existingLanguage.substring(0, 2).toLowerCase();
      const validated = validateISO2(iso2Code);
      if (validated) {
        debug(`The item has been skipped due to the presence of valid ISO 639-1 code: ${validated}`);
        return;
      }
    }

    const title = item.getField("title") as string;
    if (!title)
      return;
    const language = getTextLanguage(title);
    if (language && language !== existingLanguage) {
      item.setField("language", language);
    }
  },
});
