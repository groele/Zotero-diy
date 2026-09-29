import { defineRule } from "./rule-base";

/**
 * Thesis type
 *
 * 硕士 -> 硕士学位论文;
 * 博士 -> 博士学位论文;
 * Dissertation -> Doctoral dissertation;
 * Ph.D. -> Doctoral dissertation;
 * master -> Master thesis;
 *
 * @see https://github.com/northword/zotero-format-metadata/issues/132
 */
export const CorrectThesisType = defineRule({
  id: "correct-thesis-type",
  scope: "field",

  targetItemTypes: ["thesis"],
  targetItemField: "thesisType",

  apply({ item }) {
    const originalType = item.getField("thesisType");
    if (!originalType)
      return;

    let type = originalType;

    if (type.match("硕士")) {
      type = "硕士学位论文";
    }
    else if (type.match("博士")) {
      type = "博士学位论文";
    }
    else if (/doctor/i.test(type)) {
      type = "Doctoral dissertation";
    }
    else if (/master/i.test(type)) {
      type = "Master thesis";
    }
    else if (/ph\.? ?d\.?/i.test(type)) {
      type = "Doctoral dissertation";
    }
    else {
      type = Zotero.Utilities.sentenceCase(type);
    }

    if (type !== originalType) {
      item.setField("thesisType", type);
    }
  },

});
