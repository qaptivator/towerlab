import type { RbxPropertyValue } from "@towerlab/dom-schema";

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function propertyTypeName(value: RbxPropertyValue): string {
  const keys = Object.keys(value);
  return keys.length === 1 ? keys[0] : "value";
}

export function formatPropertyValue(value: RbxPropertyValue): string {
  const type = propertyTypeName(value);
  const inner = value[type];
  if (inner === undefined) return JSON.stringify(value);

  if (typeof inner === "string" || typeof inner === "number" || typeof inner === "boolean") {
    return String(inner);
  }
  if (inner === null) return "none";

  if (Array.isArray(inner) && inner.every((item) => typeof item === "number")) {
    return inner.map((item) => trimNumber(item)).join(", ");
  }

  if (type === "CFrame" && isRecord(inner)) {
    const position = inner.position;
    if (Array.isArray(position)) return position.map((item) => trimNumber(Number(item))).join(", ");
    if (isRecord(position)) return `${trimNumber(Number(position.x))}, ${trimNumber(Number(position.y))}, ${trimNumber(Number(position.z))}`;
  }

  if (type === "Color3" && isRecord(inner)) {
    return `${trimNumber(Number(inner.r))}, ${trimNumber(Number(inner.g))}, ${trimNumber(Number(inner.b))}`;
  }

  if (type === "UDim2" && isRecord(inner) && isRecord(inner.x) && isRecord(inner.y)) {
    return `{${trimNumber(Number(inner.x.scale))}, ${inner.x.offset}} {${trimNumber(Number(inner.y.scale))}, ${inner.y.offset}}`;
  }

  if (type === "Ref") return typeof inner === "string" ? inner : JSON.stringify(inner);

  const serialized = JSON.stringify(inner);
  return serialized.length > 280 ? `${serialized.slice(0, 277)}…` : serialized;
}

export function downloadBytes(bytes: Uint8Array, filename: string) {
  downloadBlob(new Blob([bytes], { type: "application/octet-stream" }), filename);
}

export function downloadJson(value: unknown, filename: string) {
  const text = JSON.stringify(value, null, 2);
  downloadBlob(new Blob([text], { type: "application/json" }), filename);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function rbxmName(filename: string): string {
  return `${fileStem(filename)}.rbxm`;
}

export function jsonName(filename: string, suffix: string): string {
  return `${fileStem(filename)}.${suffix}.json`;
}

function fileStem(filename: string): string {
  const stripped = filename.replace(/\.(rbxlx|rbxl|rbxmx|rbxm)$/i, "");
  return stripped || "model";
}

function trimNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
