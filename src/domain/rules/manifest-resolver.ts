/**
 * manifest-resolver.ts — Shared deterministic resolver for rule-manifest.yaml and skill-manifest.yaml.
 *
 * PRINCIPLE: Explicit field matching, no inference.
 * Same input -> same entry set, always (deterministic).
 */

export interface ManifestEntry {
  id: string;
  path: string;
  mandatory?: boolean;
  priority: number;
  when?: Record<string, string | string[]>;
}

export interface TaskMetadata {
  task?: string;
  language?: string;
  framework?: string;
  layer?: string;
  [key: string]: string | undefined;
}

function matchesWhen(
  when: Record<string, string | string[]> | undefined,
  taskMeta: TaskMetadata
): boolean {
  if (!when) return true; // no condition = always matches once selected
  return Object.entries(when).every(([key, value]) => {
    const actual = taskMeta[key];
    if (Array.isArray(value)) {
      return actual !== undefined && value.includes(actual);
    }
    return actual === value;
  });
}

/**
 * Resolve which entries apply to a task, ordered by priority (0 = highest).
 *
 * `unconditionalMandatory: true` (rule-manifest.yaml behavior) — mandatory
 * entries always apply, `when` is ignored for them.
 *
 * `unconditionalMandatory: false` (skill-manifest.yaml behavior) — mandatory
 * entries still need `when` to match; `mandatory` only means "not optional
 * once in scope", not "always in scope".
 */
export function resolveEntries(
  manifest: ManifestEntry[],
  taskMeta: TaskMetadata,
  options: { unconditionalMandatory: boolean }
): ManifestEntry[] {
  const selected = manifest.filter((entry) => {
    if (entry.mandatory && options.unconditionalMandatory) return true;
    return matchesWhen(entry.when, taskMeta);
  });
  return selected.sort((a, b) => a.priority - b.priority);
}

export function partitionEntries(
  manifest: ManifestEntry[],
  taskMeta: TaskMetadata,
  options: { unconditionalMandatory: boolean }
): { mandatory: ManifestEntry[]; contextual: ManifestEntry[] } {
  const resolved = resolveEntries(manifest, taskMeta, options);
  return {
    mandatory: resolved.filter((e) => e.mandatory),
    contextual: resolved.filter((e) => !e.mandatory),
  };
}
