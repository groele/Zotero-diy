import { useSettingsDialog } from "../../utils/dialog";
import { getString } from "../../utils/locale";
import { defineRule } from "./rule-base";

interface Options {
  fieldsToClean?: string[];
}

export const ToolCleanExtra = defineRule<Options>({
  id: "tool-clean-extra",
  scope: "field",
  category: "tool",
  targetItemField: "extra",
  async apply({ item, options, debug }) {
    if (!options.fieldsToClean || options.fieldsToClean.length === 0)
      return;

    const extras = ztoolkit.ExtraField.getExtraFields(item);
    let changed = false;

    for (const fieldToClean of options.fieldsToClean) {
      if (extras.has(fieldToClean)) {
        extras.delete(fieldToClean);
        changed = true;
      }
    }

    if (changed) {
      debug("Cleaned extra fields:", extras);
      await ztoolkit.ExtraField.replaceExtraFields(item, extras, { save: false });
    }
  },

  async prepare({ items, debug }) {
    const fields = new Set<string>();

    for (const item of items) {
      const extras = ztoolkit.ExtraField.getExtraFields(item);
      debug(`Extra fields for ${item.id}`, extras);
      for (const [field, _value] of extras) {
        fields.add(field);
      }
    }

    const fieldPrefix = "field--" as const;
    const { dialog, openForSettings } = useSettingsDialog<{
      [key: `${typeof fieldPrefix}${string}`]: boolean;
    }>();

    if (fields.size === 0) {
      dialog.addStaticRow(getString("rule-tool-clean-extra-empty"), {
        tag: "label",
      });
    }
    else {
      dialog
        .addStaticRow(getString("rule-tool-clean-extra-select"), {
          tag: "label",
        });

      fields.forEach((extra) => {
        dialog.addSetting(`${extra}`, `${fieldPrefix}${extra}`, {
          tag: "input",
          attributes: {
            type: "checkbox",
          },
        }, {
          valueType: "boolean",
        });
      });
    }

    const data = await openForSettings(getString("rule-tool-clean-extra", "label"));

    if (!data)
      return false;

    const fieldsToClean = Object.entries(data)
      .filter(([key]) => key.startsWith(fieldPrefix))
      .filter(([_key, value]) => value)
      .map(([key]) => key.replace(fieldPrefix, ""));

    return {
      fieldsToClean,
    };
  },
});
