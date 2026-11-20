import type { RbxDocument } from "@towerlab/dom-schema";

type WasmModule = {
  default: (moduleOrPath?: unknown) => Promise<unknown>;
  parseRobloxFile: (bytes: Uint8Array) => RbxDocument;
  serializeRbxm: (document: RbxDocument) => Uint8Array;
  serializeRbxl: (document: RbxDocument) => Uint8Array;
};

let modulePromise: Promise<WasmModule> | null = null;

async function loadModule(): Promise<WasmModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const imported = (await import("../pkg/rbx_dom_wasm.js")) as WasmModule;
      const wasmUrl = new URL("../pkg/rbx_dom_wasm_bg.wasm", import.meta.url);
      await imported.default(wasmUrl);
      return imported;
    })().catch((error: unknown) => {
      modulePromise = null;
      const message = error instanceof Error ? error.message : "The local parser could not be loaded.";
      throw new Error(
        message.includes("Failed to fetch") || message.includes("fetch")
          ? "The local parser is not built yet. From the repo root, run pnpm build:wasm and refresh."
          : message,
      );
    });
  }
  return modulePromise;
}

export async function parseOnThisThread(bytes: Uint8Array): Promise<RbxDocument> {
  const wasm = await loadModule();
  return wasm.parseRobloxFile(bytes);
}

export async function serializeRbxmOnThisThread(document: RbxDocument): Promise<Uint8Array> {
  const wasm = await loadModule();
  return wasm.serializeRbxm(document);
}

export async function serializeRbxlOnThisThread(document: RbxDocument): Promise<Uint8Array> {
  const wasm = await loadModule();
  return wasm.serializeRbxl(document);
}
