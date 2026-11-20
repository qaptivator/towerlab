import { describe, expect, it } from "vitest";
import type { RbxDocument, RbxNode } from "@towerlab/dom-schema";
import { convertDocument, detectKit, documentForCleanModel, documentStats, documentTree, scriptBundle } from "./index";

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
      obbyParts: 0,
      clientObjectParts: 0,
      frameParts: 0,
      clientObjects: 1,
      frames: 2,
    });
  });

  it("counts baseparts under the highest Obby, ClientSidedObjects, and Frame", () => {
    const doc = document(
      [
        node({ id: "ws", className: "Workspace", name: "Workspace", childIds: ["kit", "obby", "outside", "lobby"] }),
        node({
          id: "kit",
          className: "Folder",
          name: "MyTower",
          parentId: "ws",
          childIds: ["cos", "frame", "spawn"],
        }),
        node({ id: "obby", className: "Folder", name: "Obby", parentId: "ws", childIds: ["floor", "nested"] }),
        node({ id: "floor", className: "Part", name: "Floor", parentId: "obby" }),
        node({ id: "nested", className: "Model", name: "Stairs", parentId: "obby", childIds: ["step", "decoy"] }),
        node({ id: "step", className: "WedgePart", name: "Step", parentId: "nested" }),
        node({ id: "decoy", className: "Folder", name: "Obby", parentId: "nested", childIds: ["hidden"] }),
        node({ id: "hidden", className: "Part", name: "Hidden", parentId: "decoy" }),
        node({
          id: "cos",
          className: "Folder",
          name: "ClientSidedObjects",
          parentId: "kit",
          childIds: ["spinner", "light"],
        }),
        node({ id: "spinner", className: "Model", name: "Spinner", parentId: "cos", childIds: ["blade"] }),
        node({ id: "blade", className: "MeshPart", name: "Blade", parentId: "spinner" }),
        node({ id: "light", className: "Part", name: "Light", parentId: "cos" }),
        node({ id: "frame", className: "Folder", name: "Frame", parentId: "kit", childIds: ["s1", "s2"] }),
        node({ id: "s1", className: "Folder", name: "1", parentId: "frame", childIds: ["a", "b"] }),
        node({ id: "a", className: "Part", name: "A", parentId: "s1" }),
        node({ id: "b", className: "MeshPart", name: "B", parentId: "s1" }),
        node({ id: "s2", className: "Folder", name: "2", parentId: "frame", childIds: ["c"] }),
        node({ id: "c", className: "UnionOperation", name: "C", parentId: "s2" }),
        node({ id: "spawn", className: "SpawnLocation", name: "Spawn", parentId: "kit" }),
        node({ id: "outside", className: "Part", name: "Outside", parentId: "ws" }),
        node({ id: "lobby", className: "Folder", name: "Lobby", parentId: "ws", childIds: ["lowObby"] }),
        node({ id: "lowObby", className: "Folder", name: "Obby", parentId: "lobby", childIds: ["ignored"] }),
        node({ id: "ignored", className: "Part", name: "Ignored", parentId: "lowObby" }),
      ],
      ["ws"],
    );

    const stats = documentStats(doc);
    expect(stats.obbyParts).toBe(3);
    expect(stats.clientObjectParts).toBe(2);
    expect(stats.frameParts).toBe(3);
    expect(stats.parts).toBe(11);
  });

  it("counts every Obby when several sit at the same depth", () => {
    const doc = document(
      [
        node({ id: "root", className: "Folder", name: "Workspace", childIds: ["left", "right"] }),
        node({ id: "left", className: "Folder", name: "Lobby", parentId: "root", childIds: ["obbyA"] }),
        node({ id: "obbyA", className: "Folder", name: "Obby", parentId: "left", childIds: ["a"] }),
        node({ id: "a", className: "Part", name: "A", parentId: "obbyA" }),
        node({ id: "right", className: "Folder", name: "Tower", parentId: "root", childIds: ["obbyB"] }),
        node({ id: "obbyB", className: "Model", name: "obby", parentId: "right", childIds: ["b", "c"] }),
        node({ id: "b", className: "Part", name: "B", parentId: "obbyB" }),
        node({ id: "c", className: "TrussPart", name: "C", parentId: "obbyB" }),
      ],
      ["root"],
    );

    expect(documentStats(doc).obbyParts).toBe(3);
  });
});

describe("documentTree", () => {
  it("nests children and can start from a selection", () => {
    const doc = document(
      [
        node({ id: "root", className: "Folder", name: "Obby", childIds: ["part"] }),
        node({
          id: "part",
          className: "Part",
          name: "Floor",
          parentId: "root",
          properties: { Anchored: { Bool: true } },
        }),
      ],
      ["root"],
    );

    expect(documentTree(doc)).toEqual([
      {
        id: "root",
        className: "Folder",
        name: "Obby",
        properties: {},
        children: [
          {
            id: "part",
            className: "Part",
            name: "Floor",
            properties: { Anchored: { Bool: true } },
            children: [],
          },
        ],
      },
    ]);
    expect(documentTree(doc, ["part"])).toEqual([
      {
        id: "part",
        className: "Part",
        name: "Floor",
        properties: { Anchored: { Bool: true } },
        children: [],
      },
    ]);
  });
});

describe("scriptBundle", () => {
  it("writes each script with a path header and real newlines", () => {
    const doc = document(
      [
        node({ id: "model", className: "Model", name: "Kit", childIds: ["mod"] }),
        node({
          id: "mod",
          className: "ModuleScript",
          name: "ClientObjectScript",
          parentId: "model",
          properties: { Source: { String: "return function()\n\tprint(1)\nend" } },
        }),
      ],
      ["model"],
    );

    expect(scriptBundle(doc)).toBe(
      [
        "-".repeat(80),
        "path: Kit/ClientObjectScript",
        "name: ClientObjectScript",
        "class: ModuleScript",
        "-".repeat(80),
        "return function()",
        "\tprint(1)",
        "end",
        "",
      ].join("\n"),
    );
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
