import type { RbxDocument } from "@towerlab/dom-schema";
import type { SourceDetection, SourceKit } from "./types";
import { collectSearchText } from "./text";

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
  const kit = kitFromText(text);
  return { kit, label: sourceLabel(kit) };
}

function kitFromText(text: string): SourceKit {
  if (text.includes("tower creator") || text.includes("towercreator")) return "tower-creator";
  if (isJtoh55(text)) return "jtoh-5.5";
  if (isEtoh6(text)) return "etoh-6";
  return "unknown";
}

function isJtoh55(text: string): boolean {
  if (text.includes("jtoh") || text.includes("juke's towers") || text.includes("jukes towers") || text.includes("juke’s towers")) {
    return true;
  }
  return text.includes("5.5") && (text.includes("kit") || text.includes("version"));
}

function isEtoh6(text: string): boolean {
  if (text.includes("etoh") || text.includes("eternal towers") || text.includes("eternaltowers")) return true;
  return text.includes("kit version 6") || text.includes("kit v6") || text.includes("kitv6");
}
