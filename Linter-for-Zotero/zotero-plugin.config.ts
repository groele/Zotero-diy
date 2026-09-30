import { resolve } from "node:path";
import { env } from "node:process";
import { defineConfig } from "zotero-plugin-scaffold";
import { fse } from "zotero-plugin-scaffold/vendor";
import pkg from "./package.json";

export default defineConfig({
  source: ["src", "addon"],
  dist: ".scaffold/build",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  updateURL: "https://raw.githubusercontent.com/groele/Zotero-diy/main/Linter-for-Zotero/dist/update.json",
  xpiDownloadLink: "https://raw.githubusercontent.com/groele/Zotero-diy/main/Linter-for-Zotero/dist/linter-for-zotero.xpi",
  server: {
    startArgs: ["-no-remote"],
  },

  build: {
    assets: [
      "addon/**/*.*",
      "data/journal-abbr/journal-abbr.json",
      "data/conference-abbr.json",
      "data/university-list/university-place.json",
      "data/esi/esi-journals.json",
      "data/nature-index/nature-index-journals.json",
    ],
    define: {
      ...pkg.config,
      author: pkg.author,
      description: pkg.description,
      homepage: pkg.homepage,
      buildVersion: pkg.version,
      buildTime: "{{buildTime}}",
    },
    prefs: {
      prefix: pkg.config.prefsPrefix,
    },
    esbuildOptions: [
      {
        entryPoints: [
          { in: "src/index.ts", out: pkg.config.addonRef },
        ],
        define: {
          __env__: `"${env.NODE_ENV}"`,
        },
        bundle: true,
        format: "esm",
        target: "firefox115",
        outdir: `.scaffold/build/addon/content/scripts/`,
        external: ["Zotero"],
      },
    ],
    makeUpdateJson: {
      hash: false,
      updates: [],
    },
    hooks: {
      "build:bundle": async () => {
        // @ts-expect-error resolve esbuild "ReferenceError: Zotero is not defined" error
        globalThis.Zotero = {
          Prefs: {
            get: () => 1,
          },
        };
        // Generate declaration file for rule ids
        const { Rules } = await import("./src/modules/rules/index.ts");

        const dts = `// Auto generated file. Do not modify.
        /* eslint-disable */
        type ID =
          | ${Rules.getAll().map(r => `"${r.id}"`).join("\n  | ")}
        `.replaceAll(" ".repeat(8), "");

        fse.outputFileSync("typings/rules.d.ts", dts);
      },
    },
  },

  release: {
    bumpp: {
      execute: "pnpm build",
      all: true,
    },
    github: {
      enable: "ci",
      updater: "releaser",
      releaseNote(ctx: any) {
        let notes = `${ctx.release.changelog}  \n\n`;
        notes += `![GitHub release (by tag)](https://img.shields.io/github/downloads/${ctx.release.github.repository}/${ctx.release.bumpp.tag}/total)  \n\n`;
        return notes;
      },
    },
  },
  test: {
    entries: ["test/tests"],
    prefs: {
      "linter.test.fixturePath": resolve("test/data"),
      ...env.LINTER_TEST_PACKAGE_PATH && { "linter.test.packagePath": env.LINTER_TEST_PACKAGE_PATH },
      ...env.LINTER_TEST_LOCALE && { "intl.locale.requested": env.LINTER_TEST_LOCALE },
    },
    watch: false,
    waitForPlugin: "() => Boolean(Zotero.Linter?.data.alive)",
  },

  // If you need to see a more detailed build log, uncomment the following line:
  // logLevel: "TRACE",
});
