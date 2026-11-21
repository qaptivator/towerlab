import type { RbxDocument } from "@towerlab/dom-schema";
import { detectSource, sourceLabel } from "./detect";
import { convertJtoh55ToV6, upgradeV6To613Document } from "./etoh-v613";
import { convertTowerCreatorToV6 } from "./tower-creator";
import type { ConversionResult, ConversionWarning, ConverterId, OutputShape, SourceKit, TargetKit } from "./types";

export { convertJtoh55ToV6, convertTowerCreatorToV6, upgradeV6To613Document };

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

  let current = document;
  const warnings: ConversionWarning[] = [];
  try {
    for (const step of steps) {
      if (step === "tower-creator->etoh-6") {
        const stepWarnings: string[] = [];
        current = convertTowerCreatorToV6(current, stepWarnings);
        for (const message of stepWarnings) warnings.push({ severity: "warning", message });
      } else {
        current = RUNNERS[step](current);
      }
    }
    // A file that is already v6 still needs the 6.0.x -> 6.1.3 patch.
    // 5.5 and Tower Creator run that patch inside their converters.
    if (source === "etoh-6" && target === "etoh-6") current = upgradeV6To613Document(current);
  } catch (error) {
    if (error instanceof ConverterNotReady) {
      return {
        ...base,
        download: false,
        warnings: [...warnings, { severity: "warning", message: error.message }],
      };
    }
    throw error;
  }

  try {
    current = packageForOutput(current, shape);
  } catch (error) {
    if (error instanceof ConverterNotReady) {
      return {
        ...base,
        document: current,
        download: true,
        warnings: [
          ...warnings,
          {
            severity: "info",
            message: `${error.message} Exported the converted kit without place scripts or model bundling.`,
          },
        ],
      };
    }
    throw error;
  }

  return { ...base, document: current, download: true, warnings };
}
