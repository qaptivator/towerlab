import type { RbxDocument, RbxNode, RbxPropertyValue } from "@towerlab/dom-schema";
import { isBasePart } from "./classes";
import { normalizeName } from "./text";
import { indexNodes } from "./tree";
import type { DocumentStats } from "./types";

const CLIENT_OBJECT_CONTAINERS = new Set(["clientobject", "clientobjects", "clientsided", "clientsidedobjects"]);
const FRAME_CONTAINERS = new Set(["frame", "frames"]);
const OBBY_CONTAINERS = new Set(["obby"]);
const MUSIC_CONTAINERS = new Set(["music", "musiczones", "musiczone", "towermusic"]);
const MUSIC_VALUE_NAMES = new Set(["music", "song", "soundid", "audio", "musicid", "bgm"]);

export function documentStats(document: RbxDocument): DocumentStats {
  const byId = indexNodes(document);
  const depthOf = nodeDepths(document, byId);
  const music = countMusic(document, byId, depthOf);
  return {
    instances: document.nodes.length,
    parts: document.nodes.filter((node) => isBasePart(node.className)).length,
    obbyParts: countPartsInShallowest(document, byId, depthOf, OBBY_CONTAINERS),
    clientObjectParts: countPartsInShallowest(document, byId, depthOf, CLIENT_OBJECT_CONTAINERS),
    frameParts: countPartsInShallowest(document, byId, depthOf, FRAME_CONTAINERS),
    clientObjects: countDirectModels(document, byId, depthOf, CLIENT_OBJECT_CONTAINERS),
    floors: countDirectModels(document, byId, depthOf, FRAME_CONTAINERS),
    musicZones: music.zones,
    uniqueMusic: music.unique,
  };
}

function countPartsInShallowest(
  document: RbxDocument,
  byId: Map<string, RbxNode>,
  depthOf: Map<string, number>,
  names: Set<string>,
): number {
  return countBasePartsUnder(shallowest(document, depthOf, names), byId);
}

/** Model and Folder children of the shallowest matching containers. */
function countDirectModels(
  document: RbxDocument,
  byId: Map<string, RbxNode>,
  depthOf: Map<string, number>,
  names: Set<string>,
): number {
  let count = 0;
  for (const container of shallowest(document, depthOf, names)) {
    for (const childId of container.childIds) {
      const child = byId.get(childId);
      if (!child) continue;
      if (child.className === "Model" || child.className === "Folder") count += 1;
    }
  }
  return count;
}

function countMusic(
  document: RbxDocument,
  byId: Map<string, RbxNode>,
  depthOf: Map<string, number>,
): { zones: number; unique: number } {
  const containers = shallowest(document, depthOf, MUSIC_CONTAINERS);
  if (containers.length > 0) {
    const zones = directZones(containers, byId);
    const scan = zones.length > 0 ? zones : containers;
    return { zones: zones.length, unique: uniqueMusicUnder(scan, byId) };
  }

  const named = document.nodes.filter((node) => normalizeName(node.name) === "musiczone");
  if (named.length > 0) {
    return { zones: named.length, unique: uniqueMusicUnder(named, byId) };
  }

  const loose = document.nodes.filter((node) => {
    if (node.className === "Sound" && MUSIC_VALUE_NAMES.has(normalizeName(node.name))) return true;
    if (node.className === "StringValue" && MUSIC_VALUE_NAMES.has(normalizeName(node.name))) return true;
    return false;
  });
  return { zones: 0, unique: uniqueMusicUnder(loose, byId) };
}

function directZones(containers: RbxNode[], byId: Map<string, RbxNode>): RbxNode[] {
  const zones: RbxNode[] = [];
  for (const container of containers) {
    for (const childId of container.childIds) {
      const child = byId.get(childId);
      if (!child) continue;
      if (child.className === "Model" || child.className === "Folder" || child.className === "Sound" || isBasePart(child.className)) {
        zones.push(child);
      }
    }
  }
  return zones;
}

function uniqueMusicUnder(roots: RbxNode[], byId: Map<string, RbxNode>): number {
  const ids = new Set<string>();
  const seen = new Set<string>();
  const stack = roots.map((root) => root.id);
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (!node) continue;
    collectMusicIds(node, ids);
    stack.push(...node.childIds);
  }
  return ids.size;
}

function collectMusicIds(node: RbxNode, ids: Set<string>) {
  if (node.className === "Sound") addMusicId(readContent(node.properties.SoundId), ids);
  if (MUSIC_VALUE_NAMES.has(normalizeName(node.name))) {
    addMusicId(readContent(node.properties.Value), ids);
    addMusicId(readContent(node.properties.SoundId), ids);
  }
  const attributes = node.properties.Attributes?.Attributes;
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) return;
  for (const [name, value] of Object.entries(attributes as Record<string, RbxPropertyValue>)) {
    if (!MUSIC_VALUE_NAMES.has(normalizeName(name))) continue;
    addMusicId(readContent(value), ids);
  }
}

function readContent(value: RbxPropertyValue | undefined): string | null {
  if (!value) return null;
  for (const key of ["Content", "ContentId", "String", "ProtectedString", "Float64", "Int64", "Int32"]) {
    const inner = value[key];
    if (typeof inner === "string" && inner.trim()) return inner;
    if (typeof inner === "number" && Number.isFinite(inner) && inner > 0) return String(inner);
  }
  return null;
}

function addMusicId(raw: string | null, ids: Set<string>) {
  if (!raw) return;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "0" || trimmed === "rbxassetid://0") return;
  const digits = trimmed.match(/(\d{4,})/);
  ids.add(digits ? digits[1] : trimmed.toLowerCase());
}

function shallowest(document: RbxDocument, depthOf: Map<string, number>, names: Set<string>): RbxNode[] {
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
  return roots;
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
