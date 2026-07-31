export function mergeDefaults(target: Record<string, unknown>, defaults: Record<string, unknown>) {
  for (const key in defaults) {
    if (!(key in target)) {
      target[key] = defaults[key];
    }
  }
  return target;
}
