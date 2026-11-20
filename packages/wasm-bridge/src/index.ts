import type { RbxDocument } from "@towerlab/dom-schema";
import { parseOnThisThread, serializeRbxlOnThisThread, serializeRbxmOnThisThread } from "./codec";
import type { WorkerOp, WorkerRequest, WorkerResponse } from "./protocol";

export type { RbxDocument };

interface PendingCall {
  resolve: (value: RbxDocument | Uint8Array) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;
const pending = new Map<number, PendingCall>();

function ensureWorker(): Worker | null {
  if (workerBroken || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./rbx.worker.ts", import.meta.url), { type: "module" });
  } catch {
    workerBroken = true;
    return null;
  }

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;
    const call = pending.get(response.id);
    if (!call) return;
    pending.delete(response.id);
    if (response.ok) {
      call.resolve(response.document ?? response.bytes ?? new Uint8Array());
      return;
    }
    if (response.kind === "boot") workerBroken = true;
    call.reject(new Error(response.error));
  };

  worker.onerror = () => {
    workerBroken = true;
    worker = null;
    for (const [id, call] of pending) {
      pending.delete(id);
      call.reject(new Error("The background parser stopped. Retrying on this page."));
    }
  };

  return worker;
}

function callWorker(op: WorkerOp, payload: { bytes?: Uint8Array; document?: RbxDocument }) {
  const active = ensureWorker();
  if (!active) return Promise.reject(new Error("worker-unavailable"));

  const id = nextId++;
  const request: WorkerRequest = { id, op, ...payload };
  const transfer: Transferable[] = [];
  if (payload.bytes) {
    const copy = new Uint8Array(payload.bytes);
    request.bytes = copy;
    transfer.push(copy.buffer);
  }

  return new Promise<RbxDocument | Uint8Array>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    active.postMessage(request, transfer);
  });
}

export async function parseRobloxFile(bytes: Uint8Array): Promise<RbxDocument> {
  if (!workerBroken) {
    try {
      return (await callWorker("parse", { bytes })) as RbxDocument;
    } catch (error) {
      if (!shouldFallback(error)) throw error;
    }
  }
  return parseOnThisThread(bytes);
}

export async function serializeRbxm(document: RbxDocument): Promise<Uint8Array> {
  if (!workerBroken) {
    try {
      return (await callWorker("serialize-rbxm", { document })) as Uint8Array;
    } catch (error) {
      if (!shouldFallback(error)) throw error;
    }
  }
  return serializeRbxmOnThisThread(document);
}

export async function serializeRbxl(document: RbxDocument): Promise<Uint8Array> {
  if (!workerBroken) {
    try {
      return (await callWorker("serialize-rbxl", { document })) as Uint8Array;
    } catch (error) {
      if (!shouldFallback(error)) throw error;
    }
  }
  return serializeRbxlOnThisThread(document);
}

function shouldFallback(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    workerBroken ||
    error.message === "worker-unavailable" ||
    error.message.includes("background parser") ||
    error.message.includes("not built yet")
  );
}
