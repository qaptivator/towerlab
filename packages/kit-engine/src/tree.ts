import type { RbxDocument, RbxNode, RbxPropertyValue } from "@towerlab/dom-schema";
import { instancePath, scriptSource } from "./text";

export interface RbxTreeNode {
  id: string;
  className: string;
  name: string;
  properties: Record<string, RbxPropertyValue>;
  children: RbxTreeNode[];
}

export function indexNodes(document: RbxDocument): Map<string, RbxNode> {
  return new Map(document.nodes.map((node) => [node.id, node]));
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

const SCRIPT_CLASSES = new Set(["Script", "LocalScript", "ModuleScript"]);

/**
 * Every script under `rootIds`, in tree order, as one text file.
 * Source is the decoded string, so newlines and tabs are real characters.
 */
export function scriptBundle(document: RbxDocument, rootIds: string[] = document.rootIds): string {
  const byId = indexNodes(document);
  const blocks: string[] = [];
  const visit = (id: string, trail: Set<string>) => {
    if (trail.has(id)) return;
    const node = byId.get(id);
    if (!node) return;
    if (SCRIPT_CLASSES.has(node.className)) {
      blocks.push(formatScriptBlock(node, instancePath(node, byId)));
    }
    const next = new Set(trail);
    next.add(id);
    for (const childId of node.childIds) visit(childId, next);
  };
  for (const id of rootIds) visit(id, new Set());
  return blocks.join("\n");
}

function formatScriptBlock(node: RbxNode, path: string): string {
  const rule = "-".repeat(80);
  const source = scriptSource(node.properties);
  const body = source.endsWith("\n") || source.length === 0 ? source : `${source}\n`;
  return `${rule}\npath: ${path}\nname: ${node.name}\nclass: ${node.className}\n${rule}\n${body}`;
}
