/**
 * node-file-system.ts — Node.js FileSystem adapter.
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync, readdirSync, mkdirSync } from "node:fs";
import type { FileSystem } from "../../domain/ports/file-system.js";

export class NodeFileSystem implements FileSystem {
  exists(path: string): boolean {
    return existsSync(path);
  }

  read(path: string): string {
    return readFileSync(path, "utf-8");
  }

  readLines(path: string): string[] {
    return readFileSync(path, "utf-8").split("\n");
  }

  write(path: string, content: string): void {
    writeFileSync(path, content, "utf-8");
  }

  append(path: string, content: string): void {
    appendFileSync(path, content, "utf-8");
  }

  listDir(path: string): string[] {
    return readdirSync(path);
  }

  ensureDir(path: string): void {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
  }
}
