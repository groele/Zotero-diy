import { isFullLowerCase, isFullUpperCase } from "../../utils/str";
import { defineRule } from "./rule-base";

export const CorrectCreatorsCase = defineRule({
  id: "correct-creators-case",
  scope: "field",
  targetItemField: "creators",
  apply({ item }) {
    const creators = item.getCreators();

    let changed = false;
    for (const creator of creators) {
      if (creator.fieldMode === 0) {
        if (creator.firstName) {
          const trimmed = creator.firstName.trim();
          const newFirst
            = (isFullUpperCase(trimmed) || isFullLowerCase(trimmed))
              ? Zotero.Utilities.capitalizeName(trimmed)
              : creator.firstName;
          if (newFirst !== creator.firstName) {
            creator.firstName = newFirst;
            changed = true;
          }
        }
        if (creator.lastName) {
          const trimmed = creator.lastName.trim();
          const newLast
            = (isFullUpperCase(trimmed) || isFullLowerCase(trimmed))
              ? Zotero.Utilities.capitalizeName(trimmed)
              : creator.lastName;
          if (newLast !== creator.lastName) {
            creator.lastName = newLast;
            changed = true;
          }
        }
      }
      else if (creator.lastName) {
        // For creators with single field, if it is already all uppercase,
        // it may be an abbreviation of an institutional name, keep it as is.
        // https://github.com/northword/zotero-format-metadata/issues/378
        const trimmed = creator.lastName.trim();
        const newLast = isFullUpperCase(trimmed)
          ? creator.lastName
          : Zotero.Utilities.capitalizeName(trimmed);
        if (newLast !== creator.lastName) {
          creator.lastName = newLast;
          changed = true;
        }
      }
    }
    if (changed) {
      item.setCreators(creators);
    }
  },
});
