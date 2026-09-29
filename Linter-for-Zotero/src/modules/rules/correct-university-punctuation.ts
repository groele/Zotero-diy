import { defineRule } from "./rule-base";

export const CorrectUniversityPunctuation = defineRule({
  id: "correct-university-punctuation",
  scope: "field",
  targetItemTypes: ["thesis"],
  targetItemField: "university",
  apply({ item }) {
    const university = item.getField("university");
    if (!university)
      return;

    const language = item.getField("language") || "";
    const isChinese = language.includes("zh") || /[\u4E00-\u9FA5]/.test(university);
    if (!isChinese)
      return;

    const newUniversity = university.replace(/\(/g, "（").replace(/\)/g, "）");
    if (newUniversity !== university) {
      item.setField("university", newUniversity);
    }
  },
});
