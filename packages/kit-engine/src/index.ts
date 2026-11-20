export type { RbxDocument, RbxNode, RbxPropertyValue } from "@towerlab/dom-schema";

export type {
  AttributeValue,
  ConversionResult,
  ConversionWarning,
  ConverterId,
  DocumentStats,
  OutputShape,
  SourceDetection,
  SourceKit,
  TargetKit,
} from "./types";

export { isA, isBasePart } from "./classes";
export { detectSource, sourceLabel } from "./detect";
export { documentStats } from "./stats";
export { documentTree, indexNodes, scriptBundle } from "./tree";
export type { RbxTreeNode } from "./tree";
export { openDom, RbxDom, RbxInstance } from "./dom";
export {
  ConverterNotReady,
  convertDocument,
  convertJtoh55ToV6,
  convertTowerCreatorToV6,
  convertV6ToJtoh55,
  convertersFor,
  packageForOutput,
  pipelineLabel,
} from "./convert";
