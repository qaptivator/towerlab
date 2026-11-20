declare module "../pkg/rbx_dom_wasm.js" {
  import type { RbxDocument } from "@towerlab/dom-schema";

  export default function init(moduleOrPath?: unknown): Promise<unknown>;
  export function parseRobloxFile(bytes: Uint8Array): RbxDocument;
  export function serializeRbxm(document: RbxDocument): Uint8Array;
  export function serializeRbxl(document: RbxDocument): Uint8Array;
}
