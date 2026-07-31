export function mergeDefaults(target: Record<string, unknown>, defaults: Record<string, unknown>) {
  const keys = Object.keys(defaults);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    if (Object.prototype.hasOwnProperty.call(target, key)) continue;
    Object.defineProperty(target, key, {
      value: defaults[key],
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  return target;
}
