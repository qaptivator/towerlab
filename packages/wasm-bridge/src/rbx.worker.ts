import { parseOnThisThread, serializeRbxlOnThisThread, serializeRbxmOnThisThread } from "./codec";
import type { WorkerRequest, WorkerResponse } from "./protocol";

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  void handle(request);
};

async function handle(request: WorkerRequest) {
  try {
    if (request.op === "parse") {
      if (!request.bytes) throw new Error("Missing file bytes.");
      const document = await parseOnThisThread(request.bytes);
      const response: WorkerResponse = { id: request.id, ok: true, document };
      self.postMessage(response);
      return;
    }

    if (!request.document) throw new Error("Missing document.");
    const bytes =
      request.op === "serialize-rbxl"
        ? await serializeRbxlOnThisThread(request.document)
        : await serializeRbxmOnThisThread(request.document);
    const copy = new Uint8Array(bytes);
    const response: WorkerResponse = { id: request.id, ok: true, bytes: copy };
    self.postMessage(response, [copy.buffer]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not process this file.";
    const kind = message.includes("not built yet") || message.includes("parser") ? "boot" : "parse";
    const response: WorkerResponse = { id: request.id, ok: false, kind, error: message };
    self.postMessage(response);
  }
}
