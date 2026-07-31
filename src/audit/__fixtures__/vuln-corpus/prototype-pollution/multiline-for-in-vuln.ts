export function mergeSettings(target: Record<string, unknown>, source: Record<string, unknown>) {
  for (const key in source) {
    target[key] = source[key];
  }
  return target;
}
