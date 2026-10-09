import type { MetadataContext, TransformedData } from "./services/base-service";
import { useSettingsDialog } from "../../../utils/dialog";
import { getString } from "../../../utils/locale";
import { getPref } from "../../../utils/prefs";
import { isFieldValidForItemType } from "../../../utils/zotero";
import { defineRule } from "../rule-base";
import { extractIdentifiers, isPreprint } from "./identifiers";
import { services } from "./services";

interface UpdateMetadataOption {
  mode: "blank" | "all";
  allowTypeChanged: boolean;
  // lint: boolean;
}

export const ToolUpdateMetadata = defineRule<UpdateMetadataOption>({
  id: "tool-update-metadata",
  scope: "item",
  targetItemTypes: ["journalArticle", "preprint", "conferencePaper", "webpage"],
  category: "tool",
  cooldown: 0,
  async apply({ item, options, report, debug, signal }) {
    // 1. extract identifiers
    const identifiers = extractIdentifiers(item);
    debug("Identifiers: ", identifiers);
    if (Object.entries(identifiers).length === 0) {
      report({
        level: "error",
        message: getString("rule-tool-update-metadata-no-identifiers"),
      });
      return;
    }

    function createServiceContext(service: typeof services[number]): MetadataContext {
      return {
        item,
        identifiers,
        isPreprint: isPreprint(item, identifiers),
        debug: (msg: string) => debug(`[${service.id}] ${msg}`),
        signal,
      };
    }

    let errorMessage: string = "";

    // 2. get available metadata services
    const isAvailable = (service: typeof services[number]): boolean => {
      try {
        return service.shouldApply(createServiceContext(service));
      }
      catch (error) {
        signal?.throwIfAborted();
        const message = error instanceof Error ? error.message : String(error);
        debug(`Failed to check ${service.name}: ${message}`);
        errorMessage += `${service.name}: ${message}\n`;
        return false;
      }
    };
    const availableServices = services.filter(isAvailable);
    debug(`Available services: ${availableServices.map(s => s.id).join(", ")}`);

    // 3. update identidiers
    for (const service of availableServices) {
      signal?.throwIfAborted();
      if (!service.updateIdentifiers)
        continue;

      const status = await service.updateIdentifiers?.(createServiceContext(service))
        .catch((error) => {
          signal?.throwIfAborted();
          const message = error instanceof Error ? error.message : String(error);
          debug(`Failed to update identifiers via ${service.name}: ${message}`);
          errorMessage += `${service.name}: ${message}\n`;
        });

      // To save resources, we expect that once a service has obtained a general identifier,
      // it will not attempt further operations.
      // This can prevent some items that could have been updated via DOI service from being
      // forced to use a rate-limited semantic scholar service.
      // When the number of services increases further, we may be able to change this logic.
      if (status) {
        debug(`Identifiers updated via service ${service.name}: ${JSON.stringify(identifiers, null, 2)}`);
        break;
      }
    }

    // 3. request metadata and clean data
    let data: TransformedData | null = null;
    let successService: string;
    for (const service of services.filter(isAvailable)) {
      signal?.throwIfAborted();
      if (!service.fetch)
        continue;

      debug(`Service ${service.name} processing...`);

      try {
        const res = await service.fetch(createServiceContext(service));
        signal?.throwIfAborted();
        if (!res) {
          debug(`Service ${service.name} failed: no response`);
          continue;
        }
        const transformedData = normalizeMetadata(service.transform?.(res));
        if (transformedData) {
          data = transformedData;
          successService = service.name;
          break;
        }
      }
      catch (error) {
        signal?.throwIfAborted();
        const message = error instanceof Error ? error.message : String(error);
        debug(`Service ${service.name} failed: ${message}`);
        errorMessage += `${service.name}: ${message}\n`;
      }
    }

    if (!data) {
      report({
        level: "error",
        message: getString("rule-tool-update-metadata-no-data", { args: { errors: errorMessage } }),
      });
      return;
    }
    else if (errorMessage) {
      report({
        level: "warning",
        message: getString("rule-tool-update-metadata-service-warning", { args: { service: successService!, errors: errorMessage } }),
      });
    }

    debug("Clean data: ", data);

    // 4. apply field changes
    function applyItemType(data: TransformedData) {
      if (!data.itemType) {
        debug("Service did not provide itemType");
        return;
      }

      const newItemTypeID = Zotero.ItemTypes.getID(data.itemType);
      if (!newItemTypeID || data.itemType === item.itemType) {
        debug("Item type is not changed.");
        return;
      }

      if (data.DOI?.match(/arxiv/gi)) {
        debug("DOI has 'arxiv', skip to change itemType.");
        return;
      }

      if (!options.allowTypeChanged) {
        debug("User diasble to change itemType");
        return;
      }

      // Blank mode must not perform a destructive type migration. Zotero's
      // setType() clears fields that are unavailable on the target type and
      // may remap creator roles, which violates the promise to only fill gaps.
      if (options.mode === "blank") {
        report({ level: "warning", message: getString("rule-tool-update-metadata-type-change-loss") });
        return;
      }

      debug(`Update ItemType from ${item.itemType} to ${data.itemType}`);
      item.setType(newItemTypeID);
    }

    function applyItemCreators(data: TransformedData) {
      if (!data.creators?.length) {
        debug("Service doesn't return creators");
        return;
      }

      if (item.getCreators().length && options.mode !== "all") {
        debug("Original item has creators, blank mode, skip to update creators.");
        return;
      }

      const creators = data.creators.filter((creator) => {
        const type = "creatorType" in creator ? Zotero.CreatorTypes.getID(creator.creatorType) : creator.creatorTypeID;
        return type && Zotero.CreatorTypes.isValidForItemType(type, item.itemTypeID);
      });
      if (creators.length !== data.creators.length) {
        report({ level: "warning", message: getString("rule-tool-update-metadata-invalid-creators") });
        return;
      }
      if (creators.length)
        item.setCreators(creators);
    }

    function applyItemFields(data: Omit<TransformedData, "itemType" | "creators">) {
      for (const [field, value] of Object.entries(data)) {
        if (!isFieldValidForItemType(field as _ZoteroTypes.Item.ItemField, item.itemType))
          continue;

        let newFieldValue = "";
        const oldFieldValue = item.getField(field);

        if (options.mode !== "all" && !!oldFieldValue)
          continue;

        switch (field) {
          case "accessDate":
            // https://github.com/northword/zotero-format-metadata/issues/239
            // https://forums.zotero.org/discussion/117940/zoteroobjectuploaderror#latest
            if (!Number.isFinite(new Date(value).getTime())) {
              report({ level: "warning", message: getString("rule-tool-update-metadata-invalid-date") });
              continue;
            }
            newFieldValue = Zotero.Date.dateToSQL(new Date(value), true);
            break;

          case "abstractNote":
            // https://github.com/northword/zotero-format-metadata/issues/404
            newFieldValue = Zotero.Utilities.trimInternal(data[field] || "");
            break;

          default:
            newFieldValue = value;
            break;
        }

        if (!newFieldValue)
          continue;

        debug(`Update "${field}" from "${oldFieldValue}" to "${newFieldValue}"`);
        item.setField(field, newFieldValue);
      }
    }

    applyItemType(data);
    applyItemCreators(data);
    const { itemType, creators, ...fields } = data;
    applyItemFields(fields);

    // if (options.lint)
    //   addon.runner.add({ rules: "standard", items: item });
  },

  async prepare() {
    // Get Default Settings
    const isSlient = getPref("rule.tool-update-metadata.option.slient");
    const defaultOptions: UpdateMetadataOption = {
      mode: getPref("rule.tool-update-metadata.option.mode") === "all" ? "all" : "blank",
      allowTypeChanged: getPref("rule.tool-update-metadata.option.allow-type-changed"),
    };

    if (isSlient)
      return defaultOptions;

    // Create Dialog
    const { dialog, openForSettings } = useSettingsDialog<UpdateMetadataOption>();

    dialog.addSetting(getString("rule-tool-update-metadata-dialog-mode"), "mode", {
      tag: "select",
      children: [{
        tag: "option",
        properties: {
          value: "all",
          innerHTML: getString("rule-tool-update-metadata-dialog-mode-all"),
        },
        attributes: {
          ...defaultOptions.mode === "all" && { selected: "" },
        },
      }, {
        tag: "option",
        properties: {
          value: "blank",
          innerHTML: getString("rule-tool-update-metadata-dialog-mode-blank"),
        },
        attributes: {
          ...defaultOptions.mode === "blank" && { selected: "" },
        },
      }],
    })
      .addSetting(getString("rule-tool-update-metadata-dialog-allow-type-changed"), "allowTypeChanged", {
        tag: "input",
        attributes: {
          type: "checkbox",
          ...defaultOptions.allowTypeChanged && { checked: defaultOptions.allowTypeChanged },
        },
      }, { valueType: "boolean" })
      // .addSetting("Run Lint After Retrive", "lint", {
      //   tag: "input",
      //   attributes: {
      //     type: "checkbox",
      //     checked: true,
      //   },
      // }, { valueType: "boolean" })
      .addStaticRow(getString("rule-tool-update-metadata-dialog-notes"), {
        tag: "ul",
        children: [{
          tag: "li",
          properties: {
            textContent: getString("rule-tool-update-metadata-dialog-note-rate-limit"),
          },
        }, {
          tag: "li",
          properties: {
            textContent: getString("rule-tool-update-metadata-dialog-note-chinese-limit"),
          },
        }, {
          tag: "li",
          properties: {
            textContent: getString("rule-tool-update-metadata-dialog-note-type-change"),
          },
        }],
      });

    return await openForSettings(getString("rule-tool-update-metadata-dialog-title"));
  },
});

export function normalizeMetadata(response: unknown): TransformedData | null {
  if (!response || typeof response !== "object" || Array.isArray(response))
    return null;
  const data: Record<string, any> = {};
  for (const [field, value] of Object.entries(response)) {
    if (field === "creators" && Array.isArray(value)) {
      const creators = value.filter(creator => creator && typeof creator === "object"
        && (typeof creator.lastName === "string" || typeof creator.name === "string")
        && ((typeof creator.lastName === "string" && creator.lastName.trim()) || (typeof creator.name === "string" && creator.name.trim()))
        && (creator.firstName === undefined || typeof creator.firstName === "string"));
      data.creators = creators.length === value.length ? creators : [];
    }
    else if (typeof value === "string" && value.trim()) {
      data[field] = value;
    }
  }
  if (!["title", "DOI", "publicationTitle", "proceedingsTitle", "date"].some(field => data[field]) && !data.creators?.length)
    return null;
  return data as TransformedData;
}
