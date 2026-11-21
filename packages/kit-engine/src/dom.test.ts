import { describe, expect, it } from "vitest";
import type { RbxDocument, RbxNode } from "@towerlab/dom-schema";
import { openDom } from "./index";

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

function tower() {
  return document(
    [
      node({ id: "tower", className: "Model", name: "Tower", childIds: ["obby", "frame"] }),
      node({ id: "obby", className: "Folder", name: "Obby", parentId: "tower", childIds: ["floor", "mesh"] }),
      node({ id: "floor", className: "Part", name: "Floor", parentId: "obby", childIds: ["spawn"] }),
      node({ id: "spawn", className: "SpawnLocation", name: "Spawn", parentId: "floor" }),
      node({ id: "mesh", className: "MeshPart", name: "Trim", parentId: "obby" }),
      node({ id: "frame", className: "Folder", name: "Frame", parentId: "tower" }),
    ],
    ["tower"],
  );
}

describe("RbxInstance", () => {
  it("finds children, descendants, and ancestors the way the engine does", () => {
    const dom = openDom(tower());
    const root = dom.Roots[0];
    expect(root?.FindFirstChild("Obby")?.ClassName).toBe("Folder");
    expect(root?.FindFirstChild("Spawn")).toBeUndefined();
    expect(root?.FindFirstChild("Spawn", true)?.Name).toBe("Spawn");
    expect(root?.FindFirstDescendant("Trim")?.IsA("BasePart")).toBe(true);
    expect(root?.FindFirstChildWhichIsA("BasePart")).toBeUndefined();
    expect(root?.FindFirstChild("Obby")?.FindFirstChildWhichIsA("BasePart")?.Name).toBe("Floor");
    expect(root?.FindFirstChild("Obby")?.FindFirstChildOfClass("MeshPart")?.Name).toBe("Trim");
    expect(root?.FindFirstDescendant("MeshPart")).toBeUndefined();

    const spawn = root?.FindFirstChild("Spawn", true);
    expect(spawn?.IsA("Part")).toBe(true);
    expect(spawn?.IsA("MeshPart")).toBe(false);
    expect(spawn?.FindFirstAncestor("Tower")?.Name).toBe("Tower");
    expect(spawn?.FindFirstAncestorOfClass("Folder")?.Name).toBe("Obby");
    expect(spawn?.FindFirstAncestorWhichIsA("Model")?.GetFullName()).toBe("Tower");
    expect(spawn?.IsDescendantOf(root!)).toBe(true);
    expect(root?.IsAncestorOf(spawn!)).toBe(true);
    expect(spawn?.GetDescendants()).toEqual([]);
    expect(root?.GetDescendants().map((item) => item.Name)).toEqual(["Obby", "Floor", "Spawn", "Trim", "Frame"]);
  });

  it("moves, clones, and destroys without touching the original document", () => {
    const source = tower();
    const dom = openDom(source);
    const towerModel = dom.FindFirstChild("Tower");
    const frame = towerModel?.FindFirstChild("Frame");
    const floor = towerModel?.FindFirstDescendant("Floor");
    expect(floor && frame).toBeTruthy();
    floor!.Parent = frame!;
    expect(frame?.FindFirstChild("Floor")?.GetFullName()).toBe("Tower.Frame.Floor");
    expect(towerModel?.FindFirstChild("Obby")?.FindFirstChild("Floor")).toBeUndefined();

    const copy = floor!.Clone();
    expect(copy.Parent).toBeNull();
    expect(copy.Id).not.toBe(floor!.Id);
    expect(copy.FindFirstChild("Spawn")?.Name).toBe("Spawn");
    copy.Name = "FloorCopy";
    copy.Parent = frame!;

    floor!.Destroy();
    expect(frame?.FindFirstChild("Floor")).toBeUndefined();
    expect(frame?.FindFirstChild("FloorCopy")?.FindFirstChild("Spawn")).toBeTruthy();
    expect(() => floor!.Name).toThrow(/destroyed/);
    expect(() => {
      frame!.Parent = copy;
    }).toThrow(/descendant/);

    const written = dom.toDocument();
    expect(written.nodes.some((item) => item.name === "Floor")).toBe(false);
    expect(written.nodes.some((item) => item.name === "FloorCopy")).toBe(true);
    expect(source.nodes.some((item) => item.name === "Floor")).toBe(true);
  });

  it("reads and writes attributes and tags", () => {
    const dom = openDom(tower());
    const floor = dom.FindFirstDescendant("Floor");
    expect(floor).toBeTruthy();
    floor!.SetAttribute("Uses", Number.POSITIVE_INFINITY);
    floor!.SetAttribute("Kill", false);
    floor!.SetAttribute("Song", "rbxassetid://3333");
    floor!.SetAttribute("Color", { Color3: [1, 0, 0] });
    expect(floor!.GetAttribute("Uses")).toBe(Number.POSITIVE_INFINITY);
    expect(floor!.GetAttribute("Kill")).toBe(false);
    expect(floor!.GetAttributes().Song).toBe("rbxassetid://3333");
    expect(floor!.GetAttribute("Color")).toEqual({ Color3: [1, 0, 0] });
    floor!.SetAttribute("Kill", null);
    expect(floor!.GetAttribute("Kill")).toBeUndefined();

    const saved = dom.toDocument().nodes.find((item) => item.name === "Floor");
    expect(saved?.properties.Attributes).toEqual({
      Attributes: {
        Uses: { Float64: "Infinity" },
        Song: { String: "rbxassetid://3333" },
        Color: { Color3: [1, 0, 0] },
      },
    });

    floor!.AddTag("Killbrick");
    floor!.AddTag("Killbrick");
    floor!.AddTag("Button");
    expect(floor!.GetTags()).toEqual(["Killbrick", "Button"]);
    expect(floor!.HasTag("Button")).toBe(true);
    floor!.RemoveTag("Killbrick");
    expect(floor!.HasTag("Killbrick")).toBe(false);
  });

  it("decodes null-separated binary tags", () => {
    const dom = openDom(
      document(
        [
          node({
            id: "part",
            className: "Part",
            name: "Pad",
            properties: { Tags: { BinaryString: Array.from(new TextEncoder().encode("ez\0pz")) } },
          }),
        ],
        ["part"],
      ),
    );
    const pad = dom.Roots[0];
    expect(pad?.GetTags()).toEqual(["ez", "pz"]);
    pad?.AddTag("next");
    expect(dom.toDocument().nodes[0]?.properties.Tags).toEqual({ Tags: ["ez", "pz", "next"] });
  });

  it("copies a proxied document instead of cloning the proxy", () => {
    const properties = new Proxy({ Anchored: { Bool: true } }, {});
    const doc = new Proxy(
      document([node({ id: "part", className: "Part", name: "Pad", properties })], ["part"]),
      {},
    );
    const dom = openDom(doc);
    expect(dom.Roots[0]?.GetProperty("Anchored")).toEqual({ Bool: true });
    expect(dom.toDocument().nodes[0]?.name).toBe("Pad");
  });
});