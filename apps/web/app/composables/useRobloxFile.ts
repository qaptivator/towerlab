import type { RbxDocument } from "@towerlab/dom-schema";
import { detectKit, documentStats, type DocumentStats, type KitDetection } from "@towerlab/kit-engine";
import { parseRobloxFile } from "@towerlab/wasm-bridge";

const EXTENSIONS = [".rbxl", ".rbxlx", ".rbxm", ".rbxmx"];

export interface LoadedRobloxFile {
  name: string;
  size: number;
  document: RbxDocument;
  stats: DocumentStats;
  kit: KitDetection;
}

export function useRobloxFile() {
  const loaded = ref<LoadedRobloxFile | null>(null);
  const status = ref<"idle" | "loading" | "ready" | "error">("idle");
  const error = ref<string | null>(null);

  async function loadFile(file: File) {
    const lower = file.name.toLowerCase();
    if (!EXTENSIONS.some((extension) => lower.endsWith(extension))) {
      status.value = "error";
      error.value = "Use a .rbxl, .rbxlx, .rbxm, or .rbxmx file.";
      loaded.value = null;
      return;
    }

    status.value = "loading";
    error.value = null;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const document = await parseRobloxFile(bytes);
      loaded.value = {
        name: file.name,
        size: file.size,
        document,
        stats: documentStats(document),
        kit: detectKit(document),
      };
      status.value = "ready";
    } catch (cause) {
      loaded.value = null;
      status.value = "error";
      error.value = cause instanceof Error ? cause.message : "Couldn't read this file.";
    }
  }

  function clear() {
    loaded.value = null;
    status.value = "idle";
    error.value = null;
  }

  return { loaded, status, error, loadFile, clear };
}
