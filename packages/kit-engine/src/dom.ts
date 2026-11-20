import type { RbxDocument, RbxNode, RbxPropertyValue, RbxSourceFormat } from "@towerlab/dom-schema";
import { isA } from "./classes";
import { decodeBinaryProperty } from "./text";
import type { AttributeValue } from "./types";

interface LiveNode {
  id: string;
  className: string;
  name: string;
  parentId: string | null;
  childIds: string[];
  properties: Record<string, RbxPropertyValue>;
  destroyed: boolean;
}

/**
 * A mutable copy of a document.
 * Converters should use this instead of editing the flat node list.
 */
export class RbxDom {
  readonly nodes = new Map<string, LiveNode>();
  rootIds: string[];
  readonly format: RbxSourceFormat;
  readonly diagnostics: string[];
  private nextId = 1;

  private constructor(document: RbxDocument) {
    this.format = document.format;
    this.diagnostics = [...document.diagnostics];
    this.rootIds = [...document.rootIds];
    for (const node of document.nodes) {
      this.nodes.set(node.id, {
        id: node.id,
        className: node.className,
        name: node.name,
        parentId: node.parentId,
        childIds: [...node.childIds],
        properties: structuredClone(node.properties),
        destroyed: false,
      });
    }
  }

  static open(document: RbxDocument): RbxDom {
    return new RbxDom(document);
  }

  /** Roots, in file order. Treat these as the children of the file itself. */
  get Roots(): RbxInstance[] {
    return this.instances(this.rootIds);
  }

  Get(id: string): RbxInstance | undefined {
    const node = this.nodes.get(id);
    if (!node || node.destroyed) return undefined;
    return new RbxInstance(this, id);
  }

  /** A new instance with no parent. Parent it onto the tree to keep it. */
  Create(className: string, name = className): RbxInstance {
    const id = this.allocId();
    this.nodes.set(id, {
      id,
      className,
      name,
      parentId: null,
      childIds: [],
      properties: {},
      destroyed: false,
    });
    return new RbxInstance(this, id);
  }

  FindFirstChild(name: string, recursive = false): RbxInstance | undefined {
    return findNamed(this.Roots, name, recursive);
  }

  FindFirstChildOfClass(className: string): RbxInstance | undefined {
    return this.Roots.find((root) => root.ClassName === className);
  }

  FindFirstChildWhichIsA(className: string, recursive = false): RbxInstance | undefined {
    return findWhichIsA(this.Roots, className, recursive);
  }

  FindFirstDescendant(name: string): RbxInstance | undefined {
    return this.FindFirstChild(name, true);
  }

  GetDescendants(): RbxInstance[] {
    const found: RbxInstance[] = [];
    for (const root of this.Roots) {
      found.push(root, ...root.GetDescendants());
    }
    return found;
  }

  toDocument(): RbxDocument {
    const nodes: RbxNode[] = [];
    const seen = new Set<string>();
    const visit = (id: string) => {
      if (seen.has(id)) return;
      const node = this.nodes.get(id);
      if (!node || node.destroyed) return;
      seen.add(id);
      nodes.push({
        id: node.id,
        className: node.className,
        name: node.name,
        parentId: node.parentId,
        childIds: [...node.childIds],
        properties: structuredClone(node.properties),
      });
      for (const childId of node.childIds) visit(childId);
    };
    for (const id of this.rootIds) visit(id);
    return {
      nodes,
      rootIds: this.rootIds.filter((id) => seen.has(id)),
      format: this.format,
      diagnostics: [...this.diagnostics],
    };
  }

  allocId(): string {
    let id = `tl-${this.nextId++}`;
    while (this.nodes.has(id)) id = `tl-${this.nextId++}`;
    return id;
  }

  wrap(id: string): RbxInstance {
    return new RbxInstance(this, id);
  }

  private instances(ids: string[]): RbxInstance[] {
    const found: RbxInstance[] = [];
    for (const id of ids) {
      const node = this.nodes.get(id);
      if (node && !node.destroyed) found.push(new RbxInstance(this, id));
    }
    return found;
  }
}

export function openDom(document: RbxDocument): RbxDom {
  return RbxDom.open(document);
}

/** One Roblox instance. Method names match the engine so converter code can read like Luau. */
export class RbxInstance {
  constructor(
    private readonly dom: RbxDom,
    readonly Id: string,
  ) {}

  get ClassName(): string {
    return this.live().className;
  }

  /** True after Destroy, including while a snapshot of GetDescendants is still in hand. */
  get IsDestroyed(): boolean {
    const node = this.dom.nodes.get(this.Id);
    return !node || node.destroyed;
  }

  get Name(): string {
    return this.live().name;
  }

  set Name(value: string) {
    const node = this.live();
    node.name = value;
    const current = node.properties.Name;
    if (current && typeof current.String === "string") current.String = value;
  }

  get Parent(): RbxInstance | null {
    const parentId = this.live().parentId;
    if (!parentId) return null;
    const parent = this.dom.nodes.get(parentId);
    if (!parent || parent.destroyed) return null;
    return new RbxInstance(this.dom, parentId);
  }

  set Parent(next: RbxInstance | null) {
    const node = this.live();
    if (next) {
      if (next.dom !== this.dom) throw new Error("Parent is from a different document.");
      next.live();
      if (next.Id === this.Id || this.IsAncestorOf(next)) {
        throw new Error("Cannot parent an instance to itself or its descendant.");
      }
    }
    this.detach(node);
    if (!next) {
      node.parentId = null;
      return;
    }
    const parent = next.live();
    node.parentId = parent.id;
    parent.childIds.push(node.id);
  }

  FindFirstChild(name: string, recursive = false): RbxInstance | undefined {
    return findNamed(this.GetChildren(), name, recursive);
  }

  FindFirstChildOfClass(className: string): RbxInstance | undefined {
    return this.GetChildren().find((child) => child.ClassName === className);
  }

  FindFirstChildWhichIsA(className: string, recursive = false): RbxInstance | undefined {
    return findWhichIsA(this.GetChildren(), className, recursive);
  }

  FindFirstAncestor(name: string): RbxInstance | undefined {
    return this.ancestors().find((ancestor) => ancestor.Name === name);
  }

  FindFirstAncestorOfClass(className: string): RbxInstance | undefined {
    return this.ancestors().find((ancestor) => ancestor.ClassName === className);
  }

  FindFirstAncestorWhichIsA(className: string): RbxInstance | undefined {
    return this.ancestors().find((ancestor) => ancestor.IsA(className));
  }

  FindFirstDescendant(name: string): RbxInstance | undefined {
    return this.FindFirstChild(name, true);
  }

  GetChildren(): RbxInstance[] {
    return this.live().childIds.flatMap((id) => {
      const child = this.dom.nodes.get(id);
      return child && !child.destroyed ? [new RbxInstance(this.dom, id)] : [];
    });
  }

  GetDescendants(): RbxInstance[] {
    const found: RbxInstance[] = [];
    const stack = [...this.GetChildren()];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const current = stack.shift();
      if (!current || seen.has(current.Id)) continue;
      seen.add(current.Id);
      found.push(current);
      stack.unshift(...current.GetChildren());
    }
    return found;
  }

  IsA(className: string): boolean {
    return isA(this.ClassName, className);
  }

  IsAncestorOf(descendant: RbxInstance): boolean {
    if (descendant.dom !== this.dom || descendant.Id === this.Id) return false;
    return descendant.ancestors().some((ancestor) => ancestor.Id === this.Id);
  }

  IsDescendantOf(ancestor: RbxInstance): boolean {
    return ancestor.IsAncestorOf(this);
  }

  GetFullName(): string {
    const names: string[] = [];
    const seen = new Set<string>();
    let current: RbxInstance | null = this;
    while (current && !seen.has(current.Id)) {
      seen.add(current.Id);
      names.push(current.Name);
      current = current.Parent;
    }
    return names.reverse().join(".");
  }

  GetProperty(name: string): RbxPropertyValue | undefined {
    return this.live().properties[name];
  }

  SetProperty(name: string, value: RbxPropertyValue | undefined): void {
    const node = this.live();
    if (value === undefined) {
      delete node.properties[name];
      return;
    }
    node.properties[name] = structuredClone(value);
  }

  GetAttribute(name: string): AttributeValue | undefined {
    const stored = this.attributeMap()?.[name];
    if (!stored) return undefined;
    return unwrapAttribute(stored);
  }

  /**
   * `undefined` or `null` removes the attribute, matching a Luau nil assignment.
   * Numbers, strings, and booleans are stored as Float64, String, and Bool.
   * Pass a tagged variant for Vector3, Color3, and the other attribute types.
   */
  SetAttribute(name: string, value: AttributeValue | null | undefined): void {
    if (!name) throw new Error("Attribute name is empty.");
    const node = this.live();
    const map = ensureAttributeMap(node);
    if (value === undefined || value === null) {
      delete map[name];
      if (Object.keys(map).length === 0) delete node.properties.Attributes;
      return;
    }
    map[name] = wrapAttribute(value);
  }

  GetAttributes(): Record<string, AttributeValue> {
    const map = this.attributeMap();
    if (!map) return {};
    const attributes: Record<string, AttributeValue> = {};
    for (const [name, value] of Object.entries(map)) attributes[name] = unwrapAttribute(value);
    return attributes;
  }

  GetTags(): string[] {
    return readTags(this.live().properties);
  }

  HasTag(tag: string): boolean {
    return readTags(this.live().properties).includes(tag);
  }

  AddTag(tag: string): void {
    assertTag(tag);
    const node = this.live();
    const tags = readTags(node.properties);
    if (tags.includes(tag)) return;
    tags.push(tag);
    node.properties.Tags = { Tags: tags };
  }

  RemoveTag(tag: string): void {
    const node = this.live();
    const tags = readTags(node.properties).filter((current) => current !== tag);
    if (tags.length === 0) delete node.properties.Tags;
    else node.properties.Tags = { Tags: tags };
  }

  Clone(): RbxInstance {
    this.live();
    const id = cloneNode(this.dom, this.Id, null);
    return new RbxInstance(this.dom, id);
  }

  ClearAllChildren(): void {
    for (const child of [...this.GetChildren()]) child.Destroy();
  }

  Destroy(): void {
    const node = this.dom.nodes.get(this.Id);
    if (!node || node.destroyed) return;
    for (const childId of [...node.childIds]) this.dom.wrap(childId).Destroy();
    this.detach(node);
    node.destroyed = true;
    node.childIds = [];
    node.parentId = null;
    this.dom.nodes.delete(this.Id);
  }

  private live(): LiveNode {
    const node = this.dom.nodes.get(this.Id);
    if (!node || node.destroyed) throw new Error("Instance is destroyed.");
    return node;
  }

  private detach(node: LiveNode) {
    if (node.parentId) {
      const parent = this.dom.nodes.get(node.parentId);
      if (parent) parent.childIds = parent.childIds.filter((id) => id !== node.id);
      return;
    }
    this.dom.rootIds = this.dom.rootIds.filter((id) => id !== node.id);
  }

  private ancestors(): RbxInstance[] {
    const found: RbxInstance[] = [];
    const seen = new Set<string>();
    let current = this.Parent;
    while (current && !seen.has(current.Id)) {
      seen.add(current.Id);
      found.push(current);
      current = current.Parent;
    }
    return found;
  }

  private attributeMap(): Record<string, RbxPropertyValue> | undefined {
    const stored = this.live().properties.Attributes?.Attributes;
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return undefined;
    return stored as Record<string, RbxPropertyValue>;
  }
}

function findNamed(children: RbxInstance[], name: string, recursive: boolean): RbxInstance | undefined {
  for (const child of children) {
    if (child.Name === name) return child;
    if (recursive) {
      const nested = child.FindFirstChild(name, true);
      if (nested) return nested;
    }
  }
  return undefined;
}

function findWhichIsA(children: RbxInstance[], className: string, recursive: boolean): RbxInstance | undefined {
  for (const child of children) {
    if (child.IsA(className)) return child;
    if (recursive) {
      const nested = child.FindFirstChildWhichIsA(className, true);
      if (nested) return nested;
    }
  }
  return undefined;
}

function cloneNode(dom: RbxDom, sourceId: string, parentId: string | null): string {
  const source = dom.nodes.get(sourceId);
  if (!source || source.destroyed) throw new Error("Instance is destroyed.");
  const id = dom.allocId();
  const copy: LiveNode = {
    id,
    className: source.className,
    name: source.name,
    parentId,
    childIds: [],
    properties: structuredClone(source.properties),
    destroyed: false,
  };
  dom.nodes.set(id, copy);
  for (const childId of source.childIds) copy.childIds.push(cloneNode(dom, childId, id));
  return id;
}

function ensureAttributeMap(node: LiveNode): Record<string, RbxPropertyValue> {
  const stored = node.properties.Attributes?.Attributes;
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    return stored as Record<string, RbxPropertyValue>;
  }
  const created: Record<string, RbxPropertyValue> = {};
  node.properties.Attributes = { Attributes: created };
  return created;
}

function unwrapAttribute(value: RbxPropertyValue): AttributeValue {
  const keys = Object.keys(value);
  if (keys.length !== 1) return value;
  const type = keys[0];
  const inner = value[type];
  if (type === "Bool" && typeof inner === "boolean") return inner;
  if ((type === "String" || type === "Content" || type === "ContentId") && typeof inner === "string") return inner;
  if (isNumberType(type) && (typeof inner === "number" || typeof inner === "string")) return coerceNumber(inner);
  return value;
}

function wrapAttribute(value: AttributeValue): RbxPropertyValue {
  if (typeof value === "string") return { String: value };
  if (typeof value === "boolean") return { Bool: value };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { Float64: nonFiniteToken(value) };
    return { Float64: value };
  }
  return structuredClone(value);
}

function isNumberType(type: string): boolean {
  return type === "Float64" || type === "Float32" || type === "Int32" || type === "Int64" || type === "UInt32" || type === "UInt64" || type === "Double";
}

function coerceNumber(value: number | string): number {
  if (typeof value === "number") return value;
  if (value === "Infinity") return Number.POSITIVE_INFINITY;
  if (value === "-Infinity") return Number.NEGATIVE_INFINITY;
  if (value === "NaN") return Number.NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function nonFiniteToken(value: number): string {
  if (Number.isNaN(value)) return "NaN";
  return value > 0 ? "Infinity" : "-Infinity";
}

function readTags(properties: Record<string, RbxPropertyValue>): string[] {
  const tagged = properties.Tags;
  if (!tagged) return [];
  if (Array.isArray(tagged.Tags) && tagged.Tags.every((tag) => typeof tag === "string")) {
    return [...tagged.Tags];
  }
  const binary = decodeBinaryProperty(tagged.BinaryString);
  if (!binary) return [];
  return binary.split("\0").filter((tag) => tag.length > 0);
}

function assertTag(tag: string) {
  if (!tag || tag.includes("\0")) throw new Error("Tag is empty or contains a null character.");
}
