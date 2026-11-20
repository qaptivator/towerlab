import { describe, expect, it } from "vitest";
import type { RbxDocument, RbxNode } from "@towerlab/dom-schema";
import { convertDocument, detectKit, documentForCleanModel, documentStats } from "./index";

function node(partial: Partial<RbxNode> & Pick<RbxNode, "id" | "className" | "name">): RbxNode {
  return {
    parentId: null,
    childIds: [],
    properties: {},
    ...partial,
  };
}

function document(nodes: RbxNode[], rootIds: string[]): RbxDocument {
  return { nodes, rootIds, format: "binary", diagnostics: [] };
}

describe("documentStats", () => {
  it("counts parts, client objects, and frames", () => {
    const doc = document(
      [
        node({ id: "tower", className: "Model", name: "Tower", childIds: ["frames", "cos", "part"] }),
        node({
          id: "frames",
          className: "Folder",
          name: "Frames",
          parentId: "tower",
          childIds: ["f1", "f2"],
        }),
        node({ id: "f1", className: "Model", name: "1", parentId: "frames" }),
        node({ id: "f2", className: "Model", name: "2", parentId: "frames" }),
        node({
          id: "cos",
          className: "Folder",
          name: "ClientObjects",
          parentId: "tower",
          childIds: ["spinner"],
        }),
        node({ id: "spinner", className: "Model", name: "Spinner", parentId: "cos" }),
        node({ id: "part", className: "Part", name: "Base", parentId: "tower" }),
        node({ id: "mesh", className: "MeshPart", name: "Trim", parentId: "tower" }),
      ],
      ["tower"],
    );

    expect(documentStats(doc)).toEqual({
      instances: 8,
      parts: 2,
      clientObjects: 1,
      frames: 2,
    });
  });
});

describe("detectKit", () => {
  it("recognizes a Tower Creator marker", () => {
    const doc = document(
      [
        node({
          id: "note",
          className: "StringValue",
          name: "Source",
          properties: { Value: { String: "Exported by Tower Creator" } },
        }),
      ],
      ["note"],
    );
    expect(detectKit(doc).kind).toBe("tower-creator");
  });

  it("recognizes a place by its services", () => {
    const doc = document(
      [
        node({ id: "ws", className: "Workspace", name: "Workspace" }),
        node({ id: "light", className: "Lighting", name: "Lighting" }),
      ],
      ["ws", "light"],
    );
    expect(detectKit(doc).kind).toBe("roblox-place");
  });
});

describe("conversion", () => {
  it("unwraps a DataModel for a clean model export", () => {
    const doc = document(
      [
        node({ id: "game", className: "DataModel", name: "Place1", childIds: ["ws"] }),
        node({ id: "ws", className: "Workspace", name: "Workspace", parentId: "game" }),
      ],
      ["game"],
    );
    expect(documentForCleanModel(doc).rootIds).toEqual(["ws"]);
  });

  it("does not pretend an EToH conversion succeeded", () => {
    const doc = document([node({ id: "m", className: "Model", name: "Tower" })], ["m"]);
    const result = convertDocument(doc, "etoh-v6");
    expect(result.download).toBe(false);
    expect(result.warnings.some((warning) => warning.severity === "warning")).toBe(true);
  });

  it("allows a clean rbxm download", () => {
    const doc = document([node({ id: "m", className: "Model", name: "Tower" })], ["m"]);
    const result = convertDocument(doc, "clean-rbxm");
    expect(result.download).toBe(true);
    expect(result.warnings).toEqual([]);
  });
});
