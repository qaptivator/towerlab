import type { RbxDocument, RbxNode, RbxPropertyValue } from "@towerlab/dom-schema";

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export function instancePath(node: RbxNode, byId: Map<string, RbxNode>): string {
  const names: string[] = [];
  const seen = new Set<string>();
  let current: RbxNode | undefined = node;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.push(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return names.reverse().join("/");
}

export function scriptSource(properties: Record<string, RbxPropertyValue>): string {
  const tagged = properties.Source;
  if (!tagged) return "";
  if (typeof tagged.String === "string") return tagged.String;
  if (typeof tagged.ProtectedString === "string") return tagged.ProtectedString;
  return decodeBinaryProperty(tagged.BinaryString);
}

export function decodeBinaryProperty(value: unknown): string {
  if (typeof value === "string") return decodeBinaryString(value);
  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    return new TextDecoder().decode(Uint8Array.from(value));
  }
  return "";
}

export function decodeBinaryString(value: string): string {
  if (!value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return value;
  try {
    const raw = atob(value);
    const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return value;
  }
}

/** Bounded text used to recognize a kit. Not a full dump of the file. */
export function collectSearchText(document: RbxDocument): string {
  const parts: string[] = [];
  for (const node of document.nodes) {
    parts.push(node.name, node.className);
    collectShortStrings(node.properties, parts, 0);
    if (parts.length > 400) break;
  }
  return parts.join("\n").toLowerCase();
}

function collectShortStrings(value: unknown, parts: string[], depth: number) {
  if (depth > 4 || parts.length > 400) return;
  if (typeof value === "string") {
    if (value.length > 0 && value.length <= 2000) parts.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectShortStrings(item, parts, depth + 1);
    return;
  }
  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectShortStrings(nested, parts, depth + 1);
    }
  }
}
