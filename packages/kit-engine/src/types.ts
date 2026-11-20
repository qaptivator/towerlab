import type { RbxDocument, RbxPropertyValue } from "@towerlab/dom-schema";

export type { RbxDocument, RbxNode, RbxPropertyValue } from "@towerlab/dom-schema";

/** What the file is, detected from its contents. */
export type SourceKit = "etoh-6" | "jtoh-5.5" | "tower-creator" | "unknown";

/** What we can write to. Derived, so the type enforces that TC is read-only. */
export type TargetKit = Exclude<SourceKit, "tower-creator" | "unknown">;

/** What shape the output takes, matching the file extension. */
export type OutputShape = "place" | "model";

export interface SourceDetection {
  kit: SourceKit;
  label: string;
}

export interface DocumentStats {
  instances: number;
  /** BaseParts anywhere in the file. */
  parts: number;
  /** BaseParts under the shallowest Obby folder/model. */
  obbyParts: number;
  /** BaseParts under the shallowest ClientSidedObjects folder/model. */
  clientObjectParts: number;
  /** BaseParts under the shallowest Frame folder, including nested sections. */
  frameParts: number;
  /** Models/folders under ClientSidedObjects. */
  clientObjects: number;
  /** Floors under Frame. */
  floors: number;
  /** Number of music zones. */
  musicZones: number;
  /** Number of unique music used. */
  uniqueMusic: number;
}

export interface ConversionWarning {
  severity: "info" | "warning";
  message: string;
}

/** The three kit transforms. Packaging is separate. */
export type ConverterId = "tower-creator->etoh-6" | "jtoh-5.5->etoh-6" | "etoh-6->jtoh-5.5";

export interface ConversionResult {
  document: RbxDocument;
  warnings: ConversionWarning[];
  /** False until the converter and the packager both return a document. */
  download: boolean;
  source: SourceKit;
  target: TargetKit;
  shape: OutputShape;
  steps: ConverterId[];
}

/** A Roblox attribute as a primitive, or the tagged variant for everything else. */
export type AttributeValue = string | number | boolean | RbxPropertyValue;
