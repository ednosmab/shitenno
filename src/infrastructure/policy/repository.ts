/**
 * repository.ts — Policy repository implementation.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { Policy, PolicyFilter } from "./types.js";

export interface PolicyRepository {
  save(policy: Policy): void;
  findById(id: string): Policy | undefined;
  findAll(filter?: PolicyFilter): Policy[];
  delete(id: string): boolean;
  count(filter?: PolicyFilter): number;
}

export class FilePolicyRepository implements PolicyRepository {
  private dir: string;

  constructor(shitennoDir: string) {
    this.dir = join(shitennoDir, "governance", "policies");
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  save(policy: Policy): void {
    const filepath = join(this.dir, `${policy.id}.json`);
    writeFileSync(filepath, JSON.stringify(policy, null, 2), "utf-8");
  }

  findById(id: string): Policy | undefined {
    const filepath = join(this.dir, `${id}.json`);
    if (!existsSync(filepath)) return undefined;
    try {
      return JSON.parse(readFileSync(filepath, "utf-8")) as Policy;
    } catch {
      return undefined;
    }
  }

  findAll(filter?: PolicyFilter): Policy[] {
    if (!existsSync(this.dir)) return [];

    const files = readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    const policies: Policy[] = [];

    for (const file of files) {
      try {
        const policy = JSON.parse(readFileSync(join(this.dir, file), "utf-8")) as Policy;
        if (this.matchesFilter(policy, filter)) {
          policies.push(policy);
        }
      } catch {
        // Skip corrupt files
      }
    }

    return policies;
  }

  delete(id: string): boolean {
    const filepath = join(this.dir, `${id}.json`);
    if (!existsSync(filepath)) return false;
    try {
      unlinkSync(filepath);
      return true;
    } catch {
      return false;
    }
  }

  count(filter?: PolicyFilter): number {
    return this.findAll(filter).length;
  }

  private matchesFilter(policy: Policy, filter?: PolicyFilter): boolean {
    if (!filter) return true;
    if (filter.mode && policy.mode !== filter.mode) return false;
    if (filter.enabled !== undefined && policy.enabled !== filter.enabled) return false;
    if (filter.category && !policy.categories?.includes(filter.category)) return false;
    if (filter.tag && !policy.tags?.includes(filter.tag)) return false;
    return true;
  }
}
