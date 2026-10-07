import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist", "databases");
mkdirSync(output, { recursive: true });
const inputs = {
  "esi-journals": path.join(root, "data", "esi", "esi-journals.json"),
  "nature-index-journals": path.join(root, "data", "nature-index", "nature-index-journals.json"),
};
const quote = value => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
const csv = rows => `\uFEFF${rows.map(row => row.map(quote).join(",")).join("\r\n")}\r\n`;
const manifest = { generated: new Date().toISOString().slice(0, 10), sources: {}, files: {} };
for (const [name, input] of Object.entries(inputs)) {
  const data = JSON.parse(readFileSync(input, "utf8"));
  copyFileSync(input, path.join(output, `${name}.json`));
  const rows = name === "esi-journals"
    ? [["title", "title20", "title29", "issn", "eissn", "category"], ...data.map(row => [row.title, row.title20, row.title29, row.issn, row.eissn, row.category])]
    : [["title", "type", "aliases", "issn"], ...data.venues.map(row => [row.title, row.type, (row.aliases ?? []).join(";"), (row.issn ?? []).join(";")])];
  writeFileSync(path.join(output, `${name}.csv`), csv(rows));
  manifest.sources[name] = name === "esi-journals"
    ? { release: "2026 release 6", records: data.length, scope: "22 ESI categories", provenance: "esi-source.md" }
    : { release: data.release, snapshot: data.snapshot, records: data.venues.length, journals: data.journalCount, conferences: data.conferenceCount, source: data.source, provenance: "nature-index-source.md" };
  for (const extension of ["json", "csv"]) {
    const file = `${name}.${extension}`;
    const bytes = readFileSync(path.join(output, file));
    manifest.files[file] = { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
  }
}
writeFileSync(path.join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(path.join(output, "esi-template.json"), `${JSON.stringify([{ title: "Your Journal Title", issn: "", eissn: "", category: "PHYSICS" }], null, 2)}\n`);
writeFileSync(path.join(output, "nature-index-template.json"), `${JSON.stringify([{ title: "Your Journal Title", type: "journal", aliases: ["Your J."], issn: [] }], null, 2)}\n`);
copyFileSync(path.join(root, "docs", "custom-journal-databases.md"), path.join(output, "README.md"));
copyFileSync(path.join(root, "data", "esi", "README.md"), path.join(output, "esi-source.md"));
copyFileSync(path.join(root, "data", "nature-index", "README.md"), path.join(output, "nature-index-source.md"));
