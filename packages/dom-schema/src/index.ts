/**
 * A Roblox property in rbx_types' tagged serde form.
 * Examples: `{ Bool: true }`, `{ Vector3: [0, 1, 0] }`, `{ String: "Spawn" }`.
 */
export type RbxPropertyValue = Record<string, unknown>;

export interface RbxNode {
  id: string;
  className: string;
  name: string;
  parentId: string | null;
  childIds: string[];
  properties: Record<string, RbxPropertyValue>;
}

export type RbxSourceFormat = "binary" | "xml";

export interface RbxDocument {
  nodes: RbxNode[];
  rootIds: string[];
  format: RbxSourceFormat;
  diagnostics: string[];
}
