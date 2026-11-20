import type { RbxDocument, RbxNode, RbxPropertyValue } from "@towerlab/dom-schema";

export type { RbxDocument, RbxNode, RbxPropertyValue };

const BASE_PART_CLASSES = new Set([
  "Part",
  "MeshPart",
  "WedgePart",
  "CornerWedgePart",
  "TrussPart",
  "Seat",
  "VehicleSeat",
  "SpawnLocation",
  "SkateboardPlatform",
  "Platform",
  "FlagStand",
  "UnionOperation",
  "NegateOperation",
  "IntersectOperation",
  "PartOperation",
  "TriangleMeshPart",
]);

const CLIENT_OBJECT_CONTAINERS = new Set([
  "clientobject",
  "clientobjects",
  "clientsided",
  "clientsidedobjects",
]);

const FRAME_CONTAINERS = new Set([
  "frame",
  "frames",
  "section",
  "sections",
  "stage",
  "stages",
  "floor",
  "floors",
  "towersection",
  "towersections",
]);

const OBBY_CONTAINERS = new Set(["obby"]);
const FRAME_PART_CONTAINERS = new Set(["frame", "frames"]);

export interface DocumentStats {
  instances: number;
  /** BaseParts anywhere in the file. */
  parts: number;
  /** BaseParts under the shallowest instance named Obby. */
  obbyParts: number;
  /** BaseParts under the shallowest ClientSidedObjects folder. */
  clientObjectParts: number;
  /** BaseParts under the shallowest Frame folder, including nested sections. */
  frameParts: number;
  clientObjects: number;
  frames: number;
}

export interface RbxTreeNode {
  id: string;
  className: string;
  name: string;
  properties: Record<string, RbxPropertyValue>;
  children: RbxTreeNode[];
}

export type KitKind = "tower-creator" | "etoh" | "roblox-place" | "roblox-model" | "unknown";

export interface KitDetection {
  kind: KitKind;
  label: string;
}

export type ConvertTarget = "etoh-v6" | "clean-rbxm";

export interface ConversionWarning {
  severity: "info" | "warning";
  message: string;
}

export interface ConversionResult {
  document: RbxDocument;
  warnings: ConversionWarning[];
  download: boolean;
}

export function indexNodes(document: RbxDocument): Map<string, RbxNode> {
  return new Map(document.nodes.map((node) => [node.id, node]));
}

export function documentStats(document: RbxDocument): DocumentStats {
  const byId = indexNodes(document);
  const depthOf = nodeDepths(document, byId);
  return {
    instances: document.nodes.length,
    parts: document.nodes.filter((node) => isBasePart(node.className)).length,
    obbyParts: countPartsInShallowest(document, byId, depthOf, OBBY_CONTAINERS),
    clientObjectParts: countPartsInShallowest(document, byId, depthOf, CLIENT_OBJECT_CONTAINERS),
    frameParts: countPartsInShallowest(document, byId, depthOf, FRAME_PART_CONTAINERS),
    clientObjects: countClientObjects(document, byId),
    frames: countFrames(document, byId),
  };
}

/** Nested view of a document, or of one selected instance and its descendants. */
export function documentTree(document: RbxDocument, rootIds: string[] = document.rootIds): RbxTreeNode[] {
  const byId = indexNodes(document);
  const build = (id: string, trail: Set<string>): RbxTreeNode | null => {
    if (trail.has(id)) return null;
    const node = byId.get(id);
    if (!node) return null;
    const next = new Set(trail);
    next.add(id);
    const children: RbxTreeNode[] = [];
    for (const childId of node.childIds) {
      const child = build(childId, next);
      if (child) children.push(child);
    }
    return {
      id: node.id,
      className: node.className,
      name: node.name,
      properties: node.properties,
      children,
    };
  };

  const trees: RbxTreeNode[] = [];
  for (const id of rootIds) {
    const tree = build(id, new Set());
    if (tree) trees.push(tree);
  }
  return trees;
}

export function isBasePart(className: string): boolean {
  return BASE_PART_CLASSES.has(className);
}

export function detectKit(document: RbxDocument): KitDetection {
  const haystack = collectSearchText(document);
  if (haystack.includes("tower creator") || haystack.includes("towercreator")) {
    return { kind: "tower-creator", label: "Tower Creator" };
  }
  if (haystack.includes("etoh") || haystack.includes("eternal towers")) {
    return { kind: "etoh", label: "EToH kit" };
  }

  const classes = new Set(document.nodes.map((node) => node.className));
  if (classes.has("DataModel") || (classes.has("Workspace") && classes.has("Lighting"))) {
    return { kind: "roblox-place", label: "Roblox place" };
  }
  if (document.nodes.length > 0) {
    return { kind: "roblox-model", label: "Roblox model" };
  }
  return { kind: "unknown", label: "Unknown file" };
}

/**
 * Re-root a place so a clean model export writes the real top-level instances
 * instead of a synthetic DataModel wrapper.
 */
export function documentForCleanModel(document: RbxDocument): RbxDocument {
  if (document.rootIds.length !== 1) return document;
  const root = document.nodes.find((node) => node.id === document.rootIds[0]);
  if (!root || root.className !== "DataModel" || root.childIds.length === 0) return document;
  return { ...document, rootIds: root.childIds };
}

export function convertDocument(document: RbxDocument, target: ConvertTarget): ConversionResult {
  if (target === "clean-rbxm") {
    return {
      document: documentForCleanModel(document),
      warnings: [],
      download: true,
    };
  }

  const detection = detectKit(document);
  const warnings: ConversionWarning[] = [
    {
      severity: "warning",
      message:
        "Tower Creator to EToH v6 conversion is not ready yet. Nothing was changed. Use Clean .rbxm Package to repackage this file, then review it in Studio.",
    },
  ];
  if (detection.kind !== "tower-creator") {
    warnings.push({
      severity: "info",
      message: `This file looks like ${detection.label}. The EToH v6 pass expects a Tower Creator export.`,
    });
  }
  return { document, warnings, download: false };
}

function countPartsInShallowest(
  document: RbxDocument,
  byId: Map<string, RbxNode>,
  depthOf: Map<string, number>,
  names: Set<string>,
): number {
  let best = Number.POSITIVE_INFINITY;
  const roots: RbxNode[] = [];
  for (const node of document.nodes) {
    if (!names.has(normalizeName(node.name))) continue;
    const depth = depthOf.get(node.id) ?? 0;
    if (depth < best) {
      best = depth;
      roots.length = 0;
      roots.push(node);
    } else if (depth === best) {
      roots.push(node);
    }
  }
  return countBasePartsUnder(roots, byId);
}

function countBasePartsUnder(roots: RbxNode[], byId: Map<string, RbxNode>): number {
  const seen = new Set<string>();
  let count = 0;
  const stack = roots.flatMap((root) => root.childIds);
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (!node) continue;
    if (isBasePart(node.className)) count += 1;
    stack.push(...node.childIds);
  }
  return count;
}

function nodeDepths(document: RbxDocument, byId: Map<string, RbxNode>): Map<string, number> {
  const memo = new Map<string, number>();
  const depth = (id: string, trail: Set<string>): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (trail.has(id)) return 0;
    const node = byId.get(id);
    if (!node?.parentId || !byId.has(node.parentId)) {
      memo.set(id, 0);
      return 0;
    }
    trail.add(id);
    const value = depth(node.parentId, trail) + 1;
    trail.delete(id);
    memo.set(id, value);
    return value;
  };
  for (const node of document.nodes) depth(node.id, new Set());
  return memo;
}

function countClientObjects(document: RbxDocument, byId: Map<string, RbxNode>): number {
  const seen = new Set<string>();
  for (const node of document.nodes) {
    if (!CLIENT_OBJECT_CONTAINERS.has(normalizeName(node.name))) continue;
    const stack = [...node.childIds];
    while (stack.length > 0) {
      const id = stack.pop();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const child = byId.get(id);
      if (child) stack.push(...child.childIds);
    }
  }
  return seen.size;
}

function countFrames(document: RbxDocument, byId: Map<string, RbxNode>): number {
  let best = 0;

  for (const node of document.nodes) {
    if (!FRAME_CONTAINERS.has(normalizeName(node.name))) continue;
    const structural = node.childIds.filter((id) => {
      const child = byId.get(id);
      if (!child) return false;
      return child.className === "Model" || child.className === "Folder" || /^\d+$/.test(child.name.trim());
    }).length;
    best = Math.max(best, structural);
  }

  const numericSiblings = new Map<string, number>();
  for (const node of document.nodes) {
    const isFrame =
      (node.className === "Model" || node.className === "Folder") && /^\d+$/.test(node.name.trim());
    if (!isFrame) continue;
    const key = node.parentId ?? "__root__";
    numericSiblings.set(key, (numericSiblings.get(key) ?? 0) + 1);
  }
  for (const count of numericSiblings.values()) best = Math.max(best, count);

  return best;
}

function collectSearchText(document: RbxDocument): string {
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

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_-]+/g, "");
}
