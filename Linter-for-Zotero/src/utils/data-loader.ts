import type { ESIJournalEntry, ESILookupMaps } from "./esi";
import csv from "csvtojson";
import { buildESILookupMaps } from "./esi";
import { createLogger } from "./logger";
import { normalizeKey } from "./str";

const logger = createLogger("data-loader");

export interface Data {
  [key: string]: string;
}

export interface JournalLookupMaps {
  abbrMap: Map<string, string>;
  titleMap: Map<string, string>;
}

export class DataLoader {
  private static cache = new Map<string, any>();
  private static derived<T>(key: string, build: () => Promise<T>): Promise<T> {
    const cacheKey = `derived:${key}`;
    if (this.cache.has(cacheKey))
      return this.cache.get(cacheKey);
    const pending = build().catch((error) => {
      if (this.cache.get(cacheKey) === pending)
        this.cache.delete(cacheKey);
      throw error;
    });
    this.cache.set(cacheKey, pending);
    return pending;
  }

  static getJournalAbbrMaps(): Promise<JournalLookupMaps> {
    return this.derived("journal-abbr", async () => {
      const data = await this.load("journalAbbr");
      const abbrMap = new Map<string, string>();
      const titleMap = new Map<string, string>();
      for (const [title, abbr] of Object.entries(data)) {
        const normalized = normalizeKey(title);
        if (abbr && !abbrMap.has(normalized))
          abbrMap.set(normalized, abbr);
        if (!titleMap.has(normalized))
          titleMap.set(normalized, title);
      }
      return { abbrMap, titleMap };
    });
  }

  static getConferenceAbbrMap(): Promise<Map<string, string>> {
    return this.derived("conference-abbr", async () => {
      const data = await this.load("conferencesAbbr");
      const map = new Map<string, string>();
      for (const [name, abbr] of Object.entries(data)) {
        const normalized = normalizeKey(name);
        if (abbr && !map.has(normalized))
          map.set(normalized, abbr);
      }
      return map;
    });
  }

  static getESIJournalMaps(customDataPath?: string): Promise<ESILookupMaps> {
    return this.derived(`esi:${customDataPath || "builtin"}`, async () => {
      const entries = customDataPath
        ? await this.load(/\.csv$/i.test(customDataPath) ? "csv" : "json", customDataPath, { noheader: false })
        : await this.load("esiJournals");
      if (!entries || typeof entries !== "object")
        throw new TypeError("Expected an ESI dataset containing journal records");
      const records = Array.isArray(entries) ? entries : Object.values(entries);
      const maps = buildESILookupMaps(records);
      if (records.length && !maps.titleMap.size && !maps.issnMap.size)
        throw new TypeError("ESI records must include a category and a journal title or ISSN");
      return maps;
    });
  }
  static async load(key: "esiJournals"): Promise<ESIJournalEntry[]>;

  static async load(key: "journalAbbr" | "conferencesAbbr" | "universityPlace" | "iso6393To6391"): Promise<Data>;
  static async load(key: "json", path: string): Promise<Data>;
  static async load(key: "csv", path: string, loaderOptions?: Parameters<typeof csv>[0]): Promise<any[]>;
  static async load(key: "txt", path: string): Promise<string>;
  static async load(key: string, path?: string, loaderOptions?: any): Promise<any>;
  static async load(key: string, path?: string, options?: any): Promise<any> {
    const { type, path: resolvedPath } = this.resolvePath(key, path);
    const cacheKey = `${type}:${resolvedPath}:${JSON.stringify(options ?? {})}`;

    if (this.cache.has(cacheKey)) {
      logger.debug(`Cache hit for ${resolvedPath}`);
      return this.cache.get(cacheKey);
    }

    const pending = this.readFile(resolvedPath).then(async (data) => {
      logger.debug(`Read ${resolvedPath} (type=${type})`);
      switch (type) {
        case "csv":
          return this.parseCSV(data, options);
        case "json":
          return this.parseJSON(data);
        default:
          return this.parseTXT(data);
      }
    });
    // Share the in-flight read as well as its result between concurrent items.
    this.cache.set(cacheKey, pending);
    try {
      return await pending;
    }
    catch (error) {
      if (this.cache.get(cacheKey) === pending)
        this.cache.delete(cacheKey);
      throw error;
    }
  }

  static clearCache() {
    this.cache.clear();

    logger.debug("Data cache cleared");
  }

  static getCacheKeys(): string[] {
    return [...this.cache.keys()];
  }

  private static resolvePath(key: string, path?: string): { type: string; path: string } {
    switch (key) {
      case "journalAbbr":
        return { type: "json", path: `${rootURI}data/journal-abbr/journal-abbr.json` };
      case "conferencesAbbr":
        return { type: "json", path: `${rootURI}data/conference-abbr.json` };
      case "universityPlace":
        return { type: "json", path: `${rootURI}data/university-list/university-place.json` };
      case "esiJournals":
        return { type: "json", path: `${rootURI}data/esi/esi-journals.json` };
      default:
        if (!path)
          throw new Error("path must be provided when key is csv or json");
        return { type: key, path };
    }
  }

  private static async readFile(path: string): Promise<string> {
    if (path.startsWith("jar:file://")) {
      return await Zotero.File.getResourceAsync(path);
    }
    else {
      return (await Zotero.File.getContentsAsync(path)) as string;
    }
  }

  private static async parseCSV(data: string, options?: any): Promise<any[]> {
    return csv({
      delimiter: "auto",
      trim: true,
      noheader: true,
      ...options,
    }).fromString(data);
  }

  private static parseJSON(data: string): any {
    if (!data || typeof data !== "string") {
      throw new SyntaxError("Invalid JSON file content.");
    }
    return JSON.parse(data.replace(/^\uFEFF/, ""));
  }

  private static parseTXT(data: string): string {
    return data;
  }
}
