import type { RbxDocument } from "@towerlab/dom-schema";

export type WorkerOp = "parse" | "serialize-rbxm" | "serialize-rbxl";

export interface WorkerRequest {
  id: number;
  op: WorkerOp;
  bytes?: Uint8Array;
  document?: RbxDocument;
}

export interface WorkerSuccess {
  id: number;
  ok: true;
  document?: RbxDocument;
  bytes?: Uint8Array;
}

export interface WorkerFailure {
  id: number;
  ok: false;
  kind: "boot" | "parse";
  error: string;
}

export type WorkerResponse = WorkerSuccess | WorkerFailure;
