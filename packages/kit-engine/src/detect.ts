import type { RbxDocument } from "@towerlab/dom-schema";
import type { SourceDetection, SourceKit } from "./types";
import { collectSearchText, normalizeName } from "./text";

export function sourceLabel(kit: SourceKit): string {
  switch (kit) {
    case "etoh-6":
      return "EToH v6";
    case "jtoh-5.5":
      return "JToH 5.5";
    case "tower-creator":
      return "Tower Creator";
    case "unknown":
      return "Unknown kit";
  }
}

/** Kit family, from the file's own text. Place versus model is not a kit. */
export function detectSource(document: RbxDocument): SourceDetection {
  const text = collectSearchText(document);
  const names = new Set(document.nodes.map((node) => normalizeName(node.name)));
  const kit = kitFromText(text, names, hasV6Marker(document));
  return { kit, label: sourceLabel(kit) };
}

function kitFromText(text: string, names: Set<string>, v6Marker: boolean): SourceKit {
  if (text.includes("tower creator") || text.includes("towercreator")) return "tower-creator";
  // v6 wins over leftover 5.5 script names so a converted kit is not run through 5.5 again.
  if (v6Marker || isEtoh6(text)) return "etoh-6";
  if (isJtoh55(text, names)) return "jtoh-5.5";
  return "unknown";
}

function hasV6Marker(document: RbxDocument): boolean {
  for (const node of document.nodes) {
    const attributes = node.properties.Attributes?.Attributes;
    if (attributes && typeof attributes === "object" && !Array.isArray(attributes) && "KitVersion" in attributes) {
      return true;
    }
    const tags = node.properties.Tags?.Tags;
    if (Array.isArray(tags) && tags.some((tag) => typeof tag === "string" && tag.startsWith("CO_"))) return true;
  }
  return false;
}

function isJtoh55(text: string, names: Set<string>): boolean {
  if (
    names.has("clientobjectscript") ||
    names.has("distanceanchoringobjects") ||
    names.has("clientobject") ||
    names.has("clientsidedobjects")
  ) {
    return true;
  }
  if (text.includes("jtoh") || text.includes("juke's towers") || text.includes("jukes towers") || text.includes("juke’s towers")) {
    return true;
  }
  if (text.includes("clientobjectscript") || text.includes("distanceanchoringobjects")) return true;
  return text.includes("5.5") && (text.includes("kit") || text.includes("version"));
}

function isEtoh6(text: string): boolean {
  if (text.includes("etoh") || text.includes("eternal towers") || text.includes("eternaltowers")) return true;
  return text.includes("kit version 6") || text.includes("kit v6") || text.includes("kitv6");
}
