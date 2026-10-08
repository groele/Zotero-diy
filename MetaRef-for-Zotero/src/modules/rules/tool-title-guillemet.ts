// autocorrect-disable -- autocorrect mismark of `《》`
import { useSettingsDialog } from "../../utils/dialog";
import { getActualField } from "../../utils/zotero";
import { defineRule } from "./rule-base";

interface TitleGuillemetOptions {
  target?: "single" | "double";
}

/**
 * Replaces `《》` to `〈〉`
 * @see https://github.com/redleafnew/Chinese-STD-GB-T-7714-related-csl/issues/204
 */
export const ToolTitleGuillemet = defineRule<TitleGuillemetOptions> ({
  id: "tool-title-guillemet",
  nameKey: "title-guillemet",
  scope: "field",
  category: "tool",
  targetItemField: "title",
  includeMappedFields: true,
  async apply({ item, options }) {
    if (!options.target)
      return;

    const field = getActualField(item, "title");
    if (!field)
      return;

    const title = item.getField(field, false, true);
    if (!title)
      return;

    let newTitle: string;
    if (options.target === "single") {
      newTitle = title.replace(/《/g, "〈").replace(/》/g, "〉");
    }
    else if (options.target === "double") {
      newTitle = title.replace(/〈/g, "《").replace(/〉/g, "》");
    }
    else {
      newTitle = title;
    }

    if (newTitle !== title) {
      item.setField(field, newTitle);
    }
  },

  async prepare() {
    const { dialog, openForSettings } = useSettingsDialog<TitleGuillemetOptions>();

    dialog.addSetting("Select your guillemet:", "target", {
      tag: "select",
      children: [
        {
          tag: "option",
          properties: {
            value: "double",
            innerHTML: "Single 〈〉 to Double 《》",
          },
        },
        {
          tag: "option",
          properties: {
            value: "single",
            innerHTML: "Double 《》 to Single 〈〉",
          },
        },
      ],
    });

    const result = await openForSettings("Select Guillemet");
    if (result) {
      return { target: result.target };
    }
    else {
      return false;
    }
  },
});
