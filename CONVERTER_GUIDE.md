# Converter guide

This is the API for writing tower-kit converters. The page calls one function, `convertDocument`. That function runs at most two of the three converters below, then packages the file. Write the transforms. Do not add a fourth kit-to-kit step, and do not package the place or model inside a converter.

## Where the code goes

Implement these three functions. They currently throw `ConverterNotReady`. Replace the throw with a real body.

| Function | Input | Output |
| --- | --- | --- |
| `convertTowerCreatorToV6` | Tower Creator document | EToH v6 document |
| `convertJtoh55ToV6` | JToH 5.5 document | EToH v6 document |
| `convertV6ToJtoh55` | EToH v6 document | JToH 5.5 document |

They live in `packages/kit-engine/src/convert.ts`. A longer transform can move to a sibling file and be called from there. `convertDocument` in that same file is the runner. It is already wired to the convert page. Leave its step order alone.

`packageForOutput` is not a kit converter. Place export adds instant-play scripts. Model export writes the kit and its music. Keep that work in `packageForOutput`.

There is no middleman format for client objects. Build the v6 instances in the tree.

## What the runner does

`convertDocument(document, target, shape)` detects the source, then:

1. Tower Creator or JToH 5.5 is converted to EToH v6. An EToH v6 file skips this step.
2. If `target` is `jtoh-5.5`, the v6 document is downgraded.
3. `packageForOutput` runs for `place` or `model`.

So a JToH 5.5 file exported back to JToH 5.5 still goes up to v6 and back down. `convertersFor(source, target)` is the step list:

| Source | Target | Steps |
| --- | --- | --- |
| `tower-creator` | `etoh-6` | `tower-creator->etoh-6` |
| `tower-creator` | `jtoh-5.5` | `tower-creator->etoh-6`, then `etoh-6->jtoh-5.5` |
| `jtoh-5.5` | `etoh-6` | `jtoh-5.5->etoh-6` |
| `jtoh-5.5` | `jtoh-5.5` | `jtoh-5.5->etoh-6`, then `etoh-6->jtoh-5.5` |
| `etoh-6` | `etoh-6` | none, then packaging |
| `etoh-6` | `jtoh-5.5` | `etoh-6->jtoh-5.5` |
| `unknown` | either | no converters, `download: false` |

Each function receives the document returned by the previous step. `convertV6ToJtoh55` must accept both a real EToH v6 file and the document produced by either up-converter.

Return the next document. Throw `ConverterNotReady` only while the body is still missing. Any other throw escapes the page as a failed export. On `ConverterNotReady`, the runner returns the original document and does not download.

`TargetKit` is `"etoh-6" | "jtoh-5.5"`. Tower Creator and `unknown` are not write targets.

## Imports

From app code or tests, import the package entry:

```ts
import {
  convertDocument,
  convertTowerCreatorToV6,
  openDom,
  type RbxDocument,
  type TargetKit,
  type OutputShape,
} from "@towerlab/kit-engine";
```

The package entry is `packages/kit-engine/src/index.ts` (`@towerlab/kit-engine`). Inside `packages/kit-engine/src/`, import siblings directly. Importing `@towerlab/kit-engine` from `convert.ts` cycles through the barrel.

```ts
import type { RbxDocument } from "@towerlab/dom-schema";
import { openDom } from "./dom";

export function convertTowerCreatorToV6(document: RbxDocument): RbxDocument {
  const dom = openDom(document);
  const tower = dom.FindFirstChild("Tower", true);
  // ...
  return dom.toDocument();
}
```

`openDom` copies the document. Mutating the copy does not change the object the page still holds. `toDocument()` is the value you return. Instances with no parent, including a `Clone()` or `Create()` you never parent, are left out of that result.

## Document model

`RbxDocument` (`@towerlab/dom-schema`) is the flat file:

```ts
interface RbxNode {
  id: string;
  className: string;
  name: string;
  parentId: string | null;
  childIds: string[];
  properties: Record<string, RbxPropertyValue>;
}

interface RbxDocument {
  nodes: RbxNode[];
  rootIds: string[];
  format: "binary" | "xml";
  diagnostics: string[];
}
```

`RbxPropertyValue` is one rbx_types variant, externally tagged:

```ts
{ Bool: true }
{ String: "Spawn" }
{ Float64: 12 }
{ Float64: "Infinity" } // also "-Infinity" and "NaN"
{ Vector3: [0, 1, 0] }
{ Ref: "some-instance-id" }
```

`Name` is the `name` field on the node. It is not only `properties.Name`. New ids minted by `Create` and `Clone` look like `tl-1`. Existing ids stay as they were. A `Ref` property stores one of those ids.

Do not rebuild `childIds` by hand. Use `RbxDom`.

## Tree API

```ts
const dom = openDom(document);
dom.Roots; // top-level instances, in file order
dom.Get(id); // undefined if missing or destroyed
dom.Create("Folder", "ClientObjects"); // parent is null until you set Parent
dom.FindFirstChild("Workspace");
dom.FindFirstChild("Obby", true);
dom.FindFirstChildOfClass("Workspace"); // roots only, not recursive
dom.FindFirstChildWhichIsA("BasePart", true);
dom.FindFirstDescendant("Spawn");
dom.GetDescendants(); // roots and everything under them
dom.toDocument();
```

`RbxDom` search treats `Roots` as the children of the file. On a model file the tower is often the root. On a place file the roots are usually the services.

### `RbxInstance`

Names match Roblox. Lookups are case-sensitive. Child order is `childIds` order. A recursive search checks a child, then that child's subtree, before the next sibling. `FindFirstChildOfClass` is never recursive. `undefined` means not found. A destroyed instance throws on the next call. `Destroy()` itself is safe to call twice.

| Member | Behavior |
| --- | --- |
| `Id` | Stable referent. Read-only. |
| `ClassName` | Read-only. There is no class change. |
| `Name` / `Name =` | Node name. If `properties.Name` is `{ String }`, the setter updates that too. |
| `Parent` / `Parent =` | `null` unparents. The instance is dropped from `toDocument()` unless you parent it again or it is still a root. Setting `Parent` appends it to the new parent's children. |
| `FindFirstChild(name, recursive?)` | Default `recursive` is false. |
| `FindFirstChildOfClass(className)` | Direct children, exact class. |
| `FindFirstChildWhichIsA(className, recursive?)` | Uses `IsA`. |
| `FindFirstAncestor(name)` | |
| `FindFirstAncestorOfClass(className)` | Exact class. |
| `FindFirstAncestorWhichIsA(className)` | |
| `FindFirstDescendant(name)` | Same as `FindFirstChild(name, true)`. |
| `GetChildren()` | Direct children. |
| `GetDescendants()` | Every descendant, preorder. Does not include itself. |
| `IsA(className)` | True for the class, its parents, and `"Instance"`. |
| `IsAncestorOf` / `IsDescendantOf` | An instance is not an ancestor of itself. |
| `GetFullName()` | Names from the root joined with `.` |
| `GetProperty(name)` | The live variant object, or `undefined`. Mutating the returned object mutates the tree. |
| `SetProperty(name, value)` | Stores a clone. `undefined` deletes the property. |
| `GetAttribute(name)` | See attributes below. Missing is `undefined`. |
| `SetAttribute(name, value)` | `null` or `undefined` removes it. |
| `GetAttributes()` | Copy of the unwrapped map. |
| `GetTags()` / `HasTag(tag)` / `AddTag(tag)` / `RemoveTag(tag)` | |
| `Clone()` | Deep copy, new ids, `Parent === null`. |
| `ClearAllChildren()` | Destroys every child. |
| `Destroy()` | Destroys descendants, then itself. |

`Parent` across two `openDom` results throws. Parenting an instance to itself or to its descendant throws.

`IsA` knows the classes converters branch on: `BasePart` and its parts (`Part`, `MeshPart`, `SpawnLocation`, `UnionOperation`, `WedgePart`, `TrussPart`, and the other standard part classes), `Model`, `Folder`, `LuaSourceContainer` (`Script`, `LocalScript`, `ModuleScript`), `ValueBase`, gui classes, lights, constraints, welds, and `Sound`. `MeshPart` is a `BasePart` and is not a `Part`. `SpawnLocation` is a `Part`. An unknown class is only itself and `Instance`. `isA(className, base)` and `isBasePart(className)` are the same checks without an instance.

### Attributes and tags

`SetAttribute` stores strings as `{ String }`, booleans as `{ Bool }`, and numbers as `{ Float64 }`. `Infinity`, `-Infinity`, and `NaN` are stored as those strings inside `Float64`, because the file format cannot hold a bare non-finite JSON number. `GetAttribute` turns those back into numbers.

Pass any other attribute as a tagged variant. It is stored as given:

```ts
part.SetAttribute("Push", { Vector3: [0, 40, 0] });
part.GetAttribute("Push"); // { Vector3: [0, 40, 0] }
```

On disk, attributes live at `properties.Attributes.Attributes`. Prefer the methods. An empty attribute map removes the property.

Tags live at `properties.Tags` as `{ Tags: ["Killbrick", "Button"] }`. `AddTag` keeps the first spelling and ignores a duplicate. Tags are case-sensitive, must be non-empty, and cannot contain `U+0000`. A legacy `BinaryString` of `\0`-separated names is read; the next `AddTag` or `RemoveTag` rewrites it as the array form. Removing the last tag deletes the property.

### Shape of a converter

```ts
export function convertJtoh55ToV6(document: RbxDocument): RbxDocument {
  const dom = openDom(document);
  const frame = dom.FindFirstChild("Frame", true);
  const floors = frame?.GetChildren().filter((child) => child.IsA("Model") || child.ClassName === "Folder") ?? [];

  for (const floor of floors) {
    const kill = floor.FindFirstChildWhichIsA("BasePart", true);
    if (kill?.HasTag("Killbrick")) kill.SetAttribute("Damage", 100);
  }

  const folder = dom.Create("Folder", "ClientObjects");
  if (frame?.Parent) folder.Parent = frame.Parent;

  return dom.toDocument();
}
```

Search by exact instance name. The stats helper folds case and strips spaces, but the tree API does not.

## Other exports

These are for the page, detection, and tests. Converters do not have to call them.

| Export | Use |
| --- | --- |
| `detectSource(document)` | `{ kit: SourceKit, label: string }` from file text. Tower Creator wins if that phrase is present, then JToH 5.5, then EToH v6, else `unknown`. A place with `Workspace` and `Lighting` is not a kit by itself. |
| `sourceLabel(kit)` | `"EToH v6"`, `"JToH 5.5"`, `"Tower Creator"`, `"Unknown kit"`. |
| `pipelineLabel(source, target, shape)` | The line shown above Export. |
| `convertersFor(source, target)` | The `ConverterId[]` described above. |
| `convertDocument(document, target, shape)` | Runner. Returns `ConversionResult`. |
| `packageForOutput(document, shape)` | Place or model packaging. Still unimplemented. |
| `ConverterNotReady` | `step` is a `ConverterId` or `"package"`. |
| `documentStats(document)` | Counts only. Name match is trimmed, lowercased, and ignores spaces, `_`, and `-`. Shallowest folder of that name wins. `clientObjects` and `floors` are direct `Model` or `Folder` children of `ClientSidedObjects` / `Frame`. Part counts walk the subtree. |
| `indexNodes(document)` | `Map<string, RbxNode>`. |
| `documentTree(document, rootIds?)` | Read-only nested `RbxTreeNode[]`. |
| `scriptBundle(document, rootIds?)` | Scripts as one text file. |
| `isA`, `isBasePart` | Class checks. |

`SourceKit` is `"etoh-6" | "jtoh-5.5" | "tower-creator" | "unknown"`. `OutputShape` is `"place" | "model"`. `AttributeValue` is `string | number | boolean | RbxPropertyValue`.

`ConversionResult` is `{ document, warnings, download, source, target, shape, steps }`. `download` stays false while a converter or the packager still throws `ConverterNotReady`.

## Tests

`packages/kit-engine` uses Vitest. From the repo root:

```sh
npm test --prefix packages/kit-engine
```

`src/dom.test.ts` covers the instance API. `src/index.test.ts` covers detection, stats, and the step list. Add converter fixtures there, or in a new `src/*.test.ts`, by building an `RbxDocument` of `RbxNode`s and expecting `toDocument()` from the function under test. Do not assert through `convertDocument` until `packageForOutput` also returns a document. That runner still stops on the first `ConverterNotReady`.
