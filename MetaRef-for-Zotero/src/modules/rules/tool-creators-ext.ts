import { useSettingsDialog } from "../../utils/dialog";
import { defineRule } from "./rule-base";

interface CreatorExt extends _ZoteroTypes.Item.Creator {
  country?: string;
  original?: string;
}

interface CreatorExtOptions {
  mark: string;
  country?: string;
}

const KNOWN_SYMBOLS: {
  label: string;
  open: string;
  close: string;
}[] = [
  {
    label: "[]",
    open: "[",
    close: "]",
  },
  {
    label: "()",
    open: "(",
    close: ")",
  },
  {
    label: "【】",
    open: "【",
    close: "】",
  },
  {
    label: "（）",
    open: "（",
    close: "）",
  },
  {
    label: "〔〕",
    open: "〔",
    close: "〕",
  },
  {
    label: "No Symbols",
    open: "",
    close: "",
  },
];

export const ToolCreatorsExt = defineRule<CreatorExtOptions> ({
  id: "tool-creators-ext",
  scope: "field",
  targetItemField: "creators",
  category: "tool",

  async apply({ item, options, debug }) {
    if (!options) {
      debug("参数未定义，可能是弹窗未确认，结束应用规则。");
      return;
    }

    const creators = item.getCreators();
    const creatorsExtRaw = ztoolkit.ExtraField.getExtraField(item, "creatorsExt");
    let creatorsExt: CreatorExt[];
    if (creatorsExtRaw) {
      const stored: unknown = JSON.parse(creatorsExtRaw);
      if (!Array.isArray(stored) || stored.length !== creators.length || stored.some(creator => !creator || typeof creator.lastName !== "string" || typeof creator.firstName !== "string" || ![0, 1].includes(creator.fieldMode) || !Zotero.CreatorTypes.getName(creator.creatorTypeID)))
        throw new Error("creatorsExt must match the current creator list and contain valid creator records");
      creatorsExt = stored.map(creator => ({ ...creator, country: options.country || creator.country || "" }));
    }
    else {
      creatorsExt = creators.map((creator) => {
        return {
          firstName: creator.firstName,
          lastName: creator.lastName,
          fieldMode: creator.fieldMode,
          creatorTypeID: creator.creatorTypeID,
          country: options.country || "",
          original: "",
        };
      });
      debug("可能修改 creators 字段，备份当前 creators 至 extra.creatorsExt.");
    }

    await ztoolkit.ExtraField.setExtraField(item, "creatorsExt", JSON.stringify(creatorsExt), { save: false });

    const mark = KNOWN_SYMBOLS.find(mark => mark.label === options.mark);
    creatorsExt.forEach((creatorExt) => {
      if (mark && creatorExt.country) {
        const cleanLastName = creatorExt.lastName.replace(/^(\[.*?\]|\(.*?\)|【.*?】|（.*?）|〔.*?〕)\s*/, "");
        creatorExt.lastName = `${
          (mark.open ?? "") + creatorExt.country + (mark.close ?? "")
        } ${cleanLastName}`.trim();
      }
    });
    item.setCreators(creatorsExt);
  },

  async prepare() {
    const { dialog, openForSettings } = useSettingsDialog<CreatorExtOptions>();
    dialog
      .addSetting("标记符号：", "mark", {
        tag: "select",
        children: KNOWN_SYMBOLS.map(mark => ({
          tag: "option",
          properties: {
            value: mark.label,
            innerHTML: mark.label,
          },
        }),
        ),
      })
      .addSetting("国籍：", "country", {
        tag: "input",
        attributes: {
          type: "text",
          name: "country",
          placeholder: "Default is extra.creatorsExt",
        },
      });

    const result = await openForSettings("作者扩展信息");
    return result;
  },

  getItemMenu() {
    return {
      mutiltipleItems: false,
    };
  },
});
