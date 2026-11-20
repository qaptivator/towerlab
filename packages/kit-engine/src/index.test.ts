import { describe, expect, it } from "vitest";
import type { RbxDocument, RbxNode } from "@towerlab/dom-schema";
import {
  convertDocument,
  convertersFor,
  detectSource,
  documentStats,
  documentTree,
  pipelineLabel,
  scriptBundle,
} from "./index";

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
      floors: 2,
      musicZones: 0,
      uniqueMusic: 0,
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
    expect(stats.clientObjects).toBe(1);
    expect(stats.floors).toBe(2);
    expect(stats.musicZones).toBe(0);
    expect(stats.uniqueMusic).toBe(0);
  });

  it("counts music zones and unique ids under the highest Music folder", () => {
    const doc = document(
      [
        node({ id: "tower", className: "Model", name: "Tower", childIds: ["music"] }),
        node({ id: "music", className: "Folder", name: "Music", parentId: "tower", childIds: ["z1", "z2", "z3"] }),
        node({ id: "z1", className: "Part", name: "Zone1", parentId: "music", childIds: ["s1", "decoy"] }),
        node({
          id: "s1",
          className: "Sound",
          name: "Song",
          parentId: "z1",
          properties: { SoundId: { Content: "rbxassetid://1111" } },
        }),
        node({ id: "z2", className: "Part", name: "Zone2", parentId: "music", childIds: ["s2"] }),
        node({
          id: "s2",
          className: "Sound",
          name: "Song",
          parentId: "z2",
          properties: { SoundId: { ContentId: "rbxassetid://1111" } },
        }),
        node({
          id: "z3",
          className: "Part",
          name: "Zone3",
          parentId: "music",
          properties: { Attributes: { Attributes: { Music: { String: "rbxassetid://2222" } } } },
        }),
        node({ id: "decoy", className: "Folder", name: "Music", parentId: "z1", childIds: ["extra"] }),
        node({ id: "extra", className: "Part", name: "Extra", parentId: "decoy" }),
      ],
      ["tower"],
    );

    const stats = documentStats(doc);
    expect(stats.musicZones).toBe(3);
    expect(stats.uniqueMusic).toBe(2);
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

describe("detectSource", () => {
  it("recognizes a Tower Creator marker before an EToH mention", () => {
    const doc = document(
      [
        node({
          id: "note",
          className: "StringValue",
          name: "Source",
          properties: { Value: { String: "Exported by Tower Creator for EToH" } },
        }),
      ],
      ["note"],
    );
    expect(detectSource(doc).kit).toBe("tower-creator");
  });

  it("recognizes EToH v6 and JToH 5.5 from file text", () => {
    const etoh = document(
      [node({ id: "note", className: "StringValue", name: "Kit", properties: { Value: { String: "EToH kit version 6" } } })],
      ["note"],
    );
    const jtoh = document(
      [node({ id: "note", className: "StringValue", name: "Kit", properties: { Value: { String: "JToH 5.5" } } })],
      ["note"],
    );
    expect(detectSource(etoh).kit).toBe("etoh-6");
    expect(detectSource(jtoh).kit).toBe("jtoh-5.5");
  });

  it("does not treat a plain place as a kit", () => {
    const doc = document(
      [
        node({ id: "ws", className: "Workspace", name: "Workspace" }),
        node({ id: "light", className: "Lighting", name: "Lighting" }),
      ],
      ["ws", "light"],
    );
    expect(detectSource(doc).kit).toBe("unknown");
  });
});

describe("conversion", () => {
  it("routes every source through v6, then downgrades only when asked", () => {
    expect(convertersFor("tower-creator", "etoh-6")).toEqual(["tower-creator->etoh-6"]);
    expect(convertersFor("tower-creator", "jtoh-5.5")).toEqual(["tower-creator->etoh-6", "etoh-6->jtoh-5.5"]);
    expect(convertersFor("jtoh-5.5", "etoh-6")).toEqual(["jtoh-5.5->etoh-6"]);
    expect(convertersFor("jtoh-5.5", "jtoh-5.5")).toEqual(["jtoh-5.5->etoh-6", "etoh-6->jtoh-5.5"]);
    expect(convertersFor("etoh-6", "etoh-6")).toEqual([]);
    expect(convertersFor("etoh-6", "jtoh-5.5")).toEqual(["etoh-6->jtoh-5.5"]);
    expect(pipelineLabel("tower-creator", "jtoh-5.5", "place")).toBe("Tower Creator → EToH v6 → JToH 5.5 → place");
  });

  it("stops on the first converter that is not written yet", () => {
    const doc = document(
      [node({ id: "note", className: "StringValue", name: "Source", properties: { Value: { String: "Tower Creator" } } })],
      ["note"],
    );
    const result = convertDocument(doc, "jtoh-5.5", "model");
    expect(result.download).toBe(false);
    expect(result.steps).toEqual(["tower-creator->etoh-6", "etoh-6->jtoh-5.5"]);
    expect(result.warnings[0]?.message).toContain("Tower Creator to EToH v6");
    expect(result.document).toBe(doc);
  });

  it("reports packaging when the file is already v6 and the target stays v6", () => {
    const doc = document(
      [node({ id: "note", className: "StringValue", name: "Kit", properties: { Value: { String: "EToH" } } })],
      ["note"],
    );
    const result = convertDocument(doc, "etoh-6", "place");
    expect(result.download).toBe(false);
    expect(result.steps).toEqual([]);
    expect(result.warnings[0]?.message).toContain("Place export");
  });

  it("refuses an unrecognized file", () => {
    const doc = document([node({ id: "m", className: "Model", name: "Tower" })], ["m"]);
    const result = convertDocument(doc, "etoh-6", "model");
    expect(result.source).toBe("unknown");
    expect(result.download).toBe(false);
  });
});
