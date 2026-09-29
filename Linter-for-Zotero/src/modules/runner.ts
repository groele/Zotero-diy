import type { Arrayable } from "../utils/types";
import type { ReportInfo } from "./reporter";
import type { ApplyContext, PrepareContext, Rule } from "./rules/rule-base";
import { DataLoader } from "../utils/data-loader";
import { toArray } from "../utils/general";
import { createLogger } from "../utils/logger";
import { getPref } from "../utils/prefs";
import { executeRule, normalizedConcurrency } from "../utils/rule-execution";
import { isFieldValidForItemType } from "../utils/zotero";
import { createReporter, ProgressUI } from "./reporter";
import { Rules } from "./rules";

const logger = createLogger("Runner");

interface RunnerStats {
  total: number;
  current: number;
  pass: number;
  error: number;
  startTime: number;
  records: ReportInfo[];
  phase: "idle" | "linting" | "saving";
}

export interface BatchResult {
  total: number;
  processed: number;
  passed: number;
  failed: number;
  saved: number;
  cancelled: boolean;
  records: ReportInfo[];
}

function shouldApplyRule(rule: Rule<any>, item: Zotero.Item): boolean {
  // tag and attachment rules are not implemented
  if (rule.scope !== "item" && rule.scope !== "field") {
    return false;
  }
  if (!item.isRegularItem()) {
    return false;
  }
  if (typeof item.isEditable === "function" && !item.isEditable()) {
    return false;
  }
  if (item.deleted) {
    return false;
  }

  /*  For regular item and rule  */
  if (rule.targetItemTypes && rule.ignoreItemTypes) {
    logger.warn(`Rule ${rule.id} has both targetItemTypes and ignoreItemTypes.`);
  }

  // Check item type
  if (rule.targetItemTypes && !rule.targetItemTypes.includes(item.itemType)) {
    logger.debug(`Skip ${rule.id}: ${item.itemType} not supported by this rule`);
    return false;
  }
  if (rule.ignoreItemTypes?.includes(item.itemType)) {
    logger.debug(`Skip ${rule.id}: ${item.itemType} is ignored by this rule`);
    return false;
  }

  if (rule.scope === "field") {
    // if targetField of this rule is primary field, always apply
    if (rule.targetItemField === "creators")
      return true;

    // Check this target field is included in this item type
    if (!isFieldValidForItemType(rule.targetItemField, item.itemType)) {
      if (!rule.includeMappedFields) {
        logger.debug(`Skip ${rule.id}: ${rule.targetItemField} not valid for ${item.itemType}`);
        return false;
      }
      else {
        const mappedFields = (Zotero.ItemFields.getTypeFieldsFromBase(rule.targetItemField, true) as _ZoteroTypes.Item.ItemField[])
          .filter(field => isFieldValidForItemType(field, item.itemType));
        if (!mappedFields.length) {
          logger.debug(`Skip ${rule.id}: no mapped fields for ${rule.targetItemField} are valid for ${item.itemType}`);
          return false;
        }
      }
    }
  }

  return true;
}

export class LintRunner {
  private stats: RunnerStats = this.emptyStats();
  private modifiedItems = new Set<Zotero.Item>();
  private runningQueue: Promise<void> = Promise.resolve();
  private cancelled = false;
  private saved = 0;
  private failedItems = new Set<number | Zotero.Item>();
  public lastResult?: BatchResult;
  private readonly ui = new ProgressUI({
    onCancel: () => this.cancel(),
  });

  public cancel(): void {
    this.cancelled = true;
  }

  public async stop(): Promise<void> {
    this.cancel();
    await this.runningQueue;
    this.ui.close();
  }

  public async add(params: {
    items: Arrayable<Zotero.Item>;
    rules: Arrayable<Rule<any>>;
    silent?: boolean;
  }): Promise<void> {
    const batch = { ...params, items: [...toArray(params.items)], rules: [...toArray(params.rules)] };
    const task = () => addon.data.alive ? this.runBatch(batch) : Promise.resolve();
    this.runningQueue = this.runningQueue.then(task, task);
    return this.runningQueue;
  }

  private async runBatch(params: {
    items: Arrayable<Zotero.Item>;
    rules: Arrayable<Rule<any>>;
    silent?: boolean;
  }): Promise<void> {
    const { items: _items, rules: _rules, silent = false } = params;

    this.initStats();
    try {
      await this.ui.init(silent);

      const items = [...new Map(toArray(_items).filter(item => item?.isRegularItem() && !item.deleted && item.isEditable()).map(item => [item.id || item, item])).values()];
      const rules = [...new Map(toArray(_rules).map(rule => [rule.id, rule])).values()];

      this.stats.phase = "idle";
      this.ui.updateProgress(0, items.length, this.stats.phase);

      if (!items.length || !rules.length)
        return;
      this.stats.total = items.length;
      const optionsMap = await this.prepareRules(rules, items);
      const hasActiveRules = [...optionsMap.values()].some(opt => opt !== false);

      if (items.length === 0 || !hasActiveRules) {
        return;
      }

      this.stats.phase = "linting";
      this.ui.updateProgress(this.stats.current, this.stats.total, this.stats.phase);

      let next = 0;
      const worker = async () => {
        while (!this.cancelled && next < items.length) {
          const item = items[next++];
          try {
            await this.lintItem(item, rules, optionsMap);
          }
          catch (error) {
            this.failedItems.add(item.id || item);
            logger.error(error);
          }
          this.updateStats(this.failedItems.has(item.id || item) ? "error" : "pass");
        }
      };
      await Promise.all(Array.from({ length: Math.min(items.length, normalizedConcurrency(getPref("lint.numConcurrent"))) }, worker));
      await this.batchSave();
    }
    finally {
      this.finish();
    }
  }

  // ----------------------------
  // Preparation
  // ----------------------------

  private async prepareRules(rules: Rule<any>[], items: Zotero.Item[]) {
    const optionsMap = new Map<ID, any>();

    for (const rule of rules) {
      if (this.cancelled)
        break;
      try {
        const ctx: PrepareContext = {
          items,
          debug: (...a) => logger.debug(`[prepare] [${rule.id}]`, ...a),
        };
        const options = await rule.prepare?.(ctx) ?? {};
        optionsMap.set(rule.id, options);
        if (options === false && rule.category === "tool") {
          this.cancel();
          break;
        }
      }
      catch (err) {
        this.stats.records.push({
          message: err instanceof Error ? err.message : String(err),
          level: "error",
          itemID: 0,
          title: "Prepare failed",
          ruleID: rule.id,
        });
        logger.error(`Failed to prepare rule ${rule.id}:`, err);

        optionsMap.set(rule.id, false);
      }
    }

    logger.debug("Options map:", optionsMap);
    return optionsMap;
  }

  // ----------------------------
  // Queue
  // ----------------------------

  // ----------------------------
  // Lint item
  // ----------------------------

  public async lintItem(
    item: Zotero.Item,
    rules: Rule<any>[],
    optionsMap: Map<string, any>,
  ) {
    logger.debug(`Linting item ${item.id}`);
    const errors: any[] = [];

    for (const rule of rules) {
      if (this.cancelled)
        break;
      if (!shouldApplyRule(rule, item))
        continue;

      const options = optionsMap.get(rule.id) ?? {};
      if (options === false) {
        logger.debug(`Skip ${rule.id}: options is false`);
        continue;
      }

      await this.applyRule(item, rule, options)
        // We expect one rule's error does not affect next rule apply,
        // so we eat any error here and throw them after all rules applied.
        .catch((error) => {
          let message: string = "";
          // Zotero.HTTP.request error, the message is too long, here we just show the status
          if (error && typeof error === "object" && "xmlhttp" in error && "message" in error)
            message += `HTTP request error: status ${error.status}, ${String(error.message).slice(0, 250)}`;
          // For regular error, we just show the message in the reporter window
          else if (error instanceof Error || (error && typeof error === "object" && "message" in error))
            message += `${error.name || "Error"}: ${error.message}`;
          // If error not have message, we show the error string
          else
            message += String(error);

          this.stats.records.push({
            message,
            level: "error",
            itemID: item.id,
            title: item.getDisplayTitle(),
            ruleID: rule.id,
          });

          logger.error(`[${rule.id}]`, error);

          errors.push(error);
        });
    }

    if (item.hasChanged()) {
      this.modifiedItems.add(item);
    }

    // If there are errors, throw a error so queue can catch
    if (errors.length)
      throw new Error(`Item ${item.id} failed ${errors.length} rules`, { cause: errors });
  }

  private async batchSave(): Promise<void> {
    if (this.modifiedItems.size === 0)
      return;

    const items = [...this.modifiedItems];
    const snapshots = new Map(items.map(item => [item, item.toJSON()]));
    this.stats.phase = "saving";
    this.ui.updateProgress(0, items.length, this.stats.phase);

    try {
      let savedCount = 0;
      await Zotero.DB.executeTransaction(async () => {
        for (const item of items) {
          if (!item.hasChanged())
            continue;
          await item.save({ skipSelect: true });
          savedCount++;
          this.ui.updateProgress(savedCount, items.length, this.stats.phase);
        }
        if (savedCount > 0) {
          // @ts-expect-error - Zotero.UndoHistory not yet typed in zotero-types
          Zotero.UndoHistory?.stageAction?.(
            "linter-undo-action-lint-metadata",
            { count: savedCount },
          );
        }
      });
      this.saved = savedCount;
    }
    catch (err) {
      logger.warn("Batch transaction save failed, falling back to individual saveTx:", err);
      for (const item of items) {
        try {
          // save() reloads the item before commit. Rollback does not restore its change flags.
          if (item.id)
            await item.reload(["primaryData", "itemData", "creators", "tags", "collections", "relations"], true);
          item.fromJSON(snapshots.get(item)!, { strict: true });
          await item.saveTx({ skipSelect: true, ...{ undoAction: "linter-undo-action-lint-metadata", undoActionArgs: { count: 1 } } });
          this.saved++;
        }
        catch (itemErr) {
          this.stats.records.push({
            message: itemErr instanceof Error ? itemErr.message : String(itemErr),
            level: "error",
            itemID: item.id,
            title: item.getDisplayTitle(),
            ruleID: "item-save",
          });
          logger.error(`Failed to save item ${item.id}:`, itemErr);
          this.failedItems.add(item.id || item);
        }
      }
    }

    this.modifiedItems.clear();
  }

  public async applyRule(item: Zotero.Item, rule: Rule<any>, options: any) {
    logger.debug(`Applying ${rule.id}`);

    await executeRule(item, async (guardedItem, signal) => {
      let acceptingReports = true;
      const ctx: ApplyContext = {
        item: guardedItem,
        options,
        signal,
        debug: (...a) => createLogger(rule.id).debug(...a),
        report: (info) => {
          if (signal.aborted || !acceptingReports)
            return;
          if (info.level === "error")
            this.failedItems.add(item.id || item);
          this.stats.records.push({
            ...info,
            itemID: item.id,
            title: item.getDisplayTitle(),
            ruleID: rule.id,
          });
        },
      };

      try {
        await rule.apply(ctx);
      }
      finally {
        acceptingReports = false;
      }
    }, rule.timeout ?? 60_000, () => new (Zotero.getMainWindow() as unknown as Window & typeof globalThis).AbortController());
  }

  public async applyRuleByID(item: Zotero.Item, ruleID: ID, options: any) {
    return await this.applyRule(item, Rules.getByID(ruleID)!, options);
  }

  // ----------------------------
  // Stats / UI / Finalization
  // ----------------------------

  private updateStats(type: "pass" | "error") {
    this.stats[type]++;
    this.stats.current++;
    this.ui.updateProgress(this.stats.current, this.stats.total, this.stats.phase);
  }

  private initStats() {
    this.cancelled = false;
    this.saved = 0;
    this.failedItems.clear();
    if (!this.stats.startTime)
      this.stats.startTime = Date.now();
    logger.debug(`Add tasks at ${new Date().toLocaleTimeString()}`);
  }

  private finish() {
    if (this.stats.startTime === this.emptyStats().startTime)
      return;

    const duration = (Date.now() - this.stats.startTime) / 1000;
    this.lastResult = {
      total: this.stats.total,
      processed: this.stats.current,
      passed: this.stats.current - this.failedItems.size,
      failed: this.failedItems.size,
      saved: this.saved,
      cancelled: this.cancelled,
      records: [...this.stats.records],
    };
    if (addon.data.alive) {
      this.ui.showFinished(this.lastResult.passed, this.lastResult.failed, duration, this.cancelled, this.stats.total - this.stats.current);
      if (this.stats.records.length)
        createReporter(this.stats.records);
    }

    this.modifiedItems.clear();
    DataLoader.clearCache();
    this.stats = this.emptyStats();
    logger.debug(`Batch tasks completed in ${duration}s`);
  }

  private emptyStats(): RunnerStats {
    return {
      total: 0,
      current: 0,
      pass: 0,
      error: 0,
      startTime: 0,
      records: [],
      phase: "idle",
    };
  }
}
