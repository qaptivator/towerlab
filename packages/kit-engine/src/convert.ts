import type { RbxDocument } from "@towerlab/dom-schema";
import { detectSource, sourceLabel } from "./detect";
import type { ConversionResult, ConverterId, OutputShape, SourceKit, TargetKit } from "./types";

/**
 * Pipeline, once the bodies exist:
 * every source goes to EToH v6, an optional downgrade goes back to JToH 5.5,
 * then the document is packaged as a place or a model.
 * The three transforms are the only converters. Packaging is not one of them.
 */
export class ConverterNotReady extends Error {
  readonly step: ConverterId | "package";

  constructor(message: string, step: ConverterId | "package") {
    super(message);
    this.name = "ConverterNotReady";
    this.step = step;
  }
}

export function convertersFor(source: SourceKit, target: TargetKit): ConverterId[] {
  if (source === "unknown") return [];
  const steps: ConverterId[] = [];
  if (source === "tower-creator") steps.push("tower-creator->etoh-6");
  else if (source === "jtoh-5.5") steps.push("jtoh-5.5->etoh-6");
  if (target === "jtoh-5.5") steps.push("etoh-6->jtoh-5.5");
  return steps;
}

/** Readable order of the export, including the v6 hop and the file shape. */
export function pipelineLabel(source: SourceKit, target: TargetKit, shape: OutputShape): string {
  if (source === "unknown") return "Unknown kit";
  const parts = [sourceLabel(source)];
  if (source !== "etoh-6") parts.push(sourceLabel("etoh-6"));
  if (target === "jtoh-5.5") parts.push(sourceLabel("jtoh-5.5"));
  parts.push(shape);
  return parts.join(" → ");
}

export function convertTowerCreatorToV6(document: RbxDocument): RbxDocument {
  void document;
  throw new ConverterNotReady("Tower Creator to EToH v6 is not written yet.", "tower-creator->etoh-6");
}

export function convertJtoh55ToV6(document: RbxDocument): RbxDocument {
  void document;
  throw new ConverterNotReady("JToH 5.5 to EToH v6 is not written yet.", "jtoh-5.5->etoh-6");
}

export function convertV6ToJtoh55(document: RbxDocument): RbxDocument {
  void document;
  throw new ConverterNotReady("EToH v6 to JToH 5.5 is not written yet.", "etoh-6->jtoh-5.5");
}

export function packageForOutput(document: RbxDocument, shape: OutputShape): RbxDocument {
  void document;
  const what = shape === "place" ? "Place export (instant-play scripts)" : "Model export (kit and music)";
  throw new ConverterNotReady(`${what} is not written yet.`, "package");
}

const RUNNERS: Record<ConverterId, (document: RbxDocument) => RbxDocument> = {
  "tower-creator->etoh-6": convertTowerCreatorToV6,
  "jtoh-5.5->etoh-6": convertJtoh55ToV6,
  "etoh-6->jtoh-5.5": convertV6ToJtoh55,
};

export function convertDocument(document: RbxDocument, target: TargetKit, shape: OutputShape): ConversionResult {
  const source = detectSource(document).kit;
  const steps = convertersFor(source, target);
  const base = { source, target, shape, steps, document };
  if (source === "unknown") {
    return {
      ...base,
      download: false,
      warnings: [{ severity: "warning", message: "This file is not a recognized kit, so it was left unchanged." }],
    };
  }

  try {
    let current = document;
    for (const step of steps) current = RUNNERS[step](current);
    current = packageForOutput(current, shape);
    return { ...base, document: current, download: true, warnings: [] };
  } catch (error) {
    if (error instanceof ConverterNotReady) {
      return {
        ...base,
        download: false,
        warnings: [{ severity: "warning", message: error.message }],
      };
    }
    throw error;
  }
}
