import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function run(args, env = process.env) {
  const result = spawnSync("pnpm", args, { cwd: projectRoot, stdio: "inherit", shell: process.platform === "win32", env });
  if (result.error)
    throw result.error;
  if (result.status !== 0)
    process.exit(result.status ?? 1);
}

run(["build"]);
const qa = path.join(projectRoot, ".scaffold", "qa");
mkdirSync(qa, { recursive: true });
const packagePath = path.join(qa, "linter-for-zotero-production.xpi");
copyFileSync(path.join(projectRoot, ".scaffold", "build", "linter-for-zotero.xpi"), packagePath);
run(["exec", "zotero-plugin", "test", "--no-watch"], {
  ...process.env,
  LINTER_TEST_PACKAGE_PATH: packagePath,
  ZOTERO_PLUGIN_KILL_COMMAND: process.env.ZOTERO_PLUGIN_KILL_COMMAND || (process.platform === "win32" ? "pwsh -NoProfile -Command \"exit 0\"" : "true"),
});
