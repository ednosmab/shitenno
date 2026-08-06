import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { SHITENNO_DIR_NAME } from "../domain/types/constants.js";

describe("bundled example plugins", () => {
  const pluginsDir = join(process.cwd(), SHITENNO_DIR_NAME, "plugins");

  const pluginDirs = readdirSync(pluginsDir).filter((name) => {
    return statSync(join(pluginsDir, name)).isDirectory();
  });

  for (const name of pluginDirs) {
    it(`${name}/plugin.js is loadable as a valid ES module`, async () => {
      const path = join(pluginsDir, name, "plugin.js");
      await expect(import(path)).resolves.toBeDefined();
    });
  }
});
