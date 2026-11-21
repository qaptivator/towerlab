/**
 * A plain copy of JSON-like data.
 * `structuredClone` rejects Vue proxies, which is how the loaded file is held in the page.
 */
export function clonePlain<T>(value: T): T {
  return cloneValue(value, new WeakMap()) as T;
}

function cloneValue(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (typeof value !== "object" || value === null) return value;
  const cached = seen.get(value);
  if (cached !== undefined) return cached;

  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);
    for (const item of value) copy.push(cloneValue(item, seen));
    return copy;
  }

  const copy: Record<string, unknown> = {};
  seen.set(value, copy);
  for (const key of Object.keys(value)) {
    copy[key] = cloneValue((value as Record<string, unknown>)[key], seen);
  }
  return copy;
}
