import type { RbxDocument } from "@towerlab/dom-schema";
import { openDom, type RbxDom, type RbxInstance } from "./dom";

// --- Roblox Enum Constants ---
const ENUM_SURFACE_TYPE = {
  Smooth: 0,
  Glue: 1,
  Weld: 2,
  Studs: 3,
  Inlet: 4,
  Universal: 5,
  Hinge: 6,
  Motor: 7,
  SteppingMotor: 8,
  SmoothNoOutlines: 10,
};

const ENUM_EASING_STYLE = {
  Linear: 0,
  Sine: 1,
  Back: 2,
  Quad: 3,
  Quart: 4,
  Quint: 5,
  Bounce: 6,
  Elastic: 7,
  Exponential: 8,
  Circular: 9,
  Cubic: 10,
};

const ENUM_EASING_DIRECTION = {
  In: 0,
  Out: 1,
  InOut: 2,
};

const ENUM_ACTUATOR_TYPE = {
  None: 0,
  Motor: 1,
  Servo: 2,
};

const ENUM_PART_TYPE = {
  Ball: 0,
  Block: 1,
  Cylinder: 2,
  Wedge: 3,
  CornerWedge: 4,
};

const ENUM_NORMAL_ID = {
  Right: 0,
  Top: 1,
  Back: 2,
  Left: 3,
  Bottom: 4,
  Front: 5,
};

// --- Property & ValueBase Helpers ---

function getValueObject(parent: RbxInstance, name: string): unknown {
  const child = parent.FindFirstChild(name);
  if (!child) return undefined;

  const valProp = child.GetProperty("Value");
  if (!valProp || typeof valProp !== "object") return undefined;

  if ("Bool" in valProp) return valProp.Bool;
  if ("String" in valProp) return valProp.String;
  if ("Float64" in valProp) return Number(valProp.Float64);
  if ("Float32" in valProp) return Number(valProp.Float32);
  if ("Int32" in valProp) return Number(valProp.Int32);
  if ("Int64" in valProp) return Number(valProp.Int64);
  if ("Vector3" in valProp) return valProp.Vector3;
  if ("Color3" in valProp) return valProp.Color3;
  if ("CFrame" in valProp) return valProp.CFrame;
  if ("BrickColor" in valProp) return valProp.BrickColor;

  return undefined;
}

function getNumberValue(
  parent: RbxInstance,
  name: string,
  fallback: number
): number {
  const val = getValueObject(parent, name);
  return typeof val === "number" && !Number.isNaN(val) ? val : fallback;
}

function getBoolValue(
  parent: RbxInstance,
  name: string,
  fallback: boolean
): boolean {
  const val = getValueObject(parent, name);
  return typeof val === "boolean" ? val : fallback;
}

function getStringValue(
  parent: RbxInstance,
  name: string,
  fallback: string
): string {
  const val = getValueObject(parent, name);
  return typeof val === "string" ? val : fallback;
}

function destroyChildrenByName(parent: RbxInstance, names: string[]): void {
  for (const name of names) {
    const child = parent.FindFirstChild(name);
    if (child) {
      child.Destroy();
    }
  }
}

function purgeLegacyClientScripts(object: RbxInstance): void {
  const co = object.FindFirstChild("ClientObject");
  if (co) co.Destroy();

  const cos = object.FindFirstChild("ClientObjectScript");
  if (cos) cos.Destroy();
}

function createConfiguration(
  dom: RbxDom,
  parent: RbxInstance,
  name: string,
  tags: string[] = [],
  attributes: Record<string, any> = {}
): RbxInstance {
  const config = dom.Create("Configuration", name);
  config.Parent = parent;
  for (const tag of tags) {
    config.AddTag(tag);
  }
  for (const [k, v] of Object.entries(attributes)) {
    config.SetAttribute(k, v);
  }
  return config;
}

function createTouchConfiguration(
  dom: RbxDom,
  parentConfig: RbxInstance,
  overrides: {
    balloon?: boolean;
    canFlip?: boolean;
    colorSpecific?: boolean;
    player?: boolean;
    pushbox?: boolean;
    turret?: boolean;
    collisionGroup?: boolean;
    playerHitboxMode?: string;
  } = {}
): RbxInstance {
  return createConfiguration(dom, parentConfig, "TouchConfiguration", [], {
    balloon: overrides.balloon ?? false,
    canFlip: overrides.canFlip ?? false,
    colorSpecific: overrides.colorSpecific ?? false,
    player: overrides.player ?? true,
    pushbox: overrides.pushbox ?? true,
    turret: overrides.turret ?? false,
    collisionGroup: overrides.collisionGroup ?? false,
    playerHitboxMode: overrides.playerHitboxMode ?? "StaticWholeBody",
  });
}

function createTweenConfiguration(
  dom: RbxDom,
  parentConfig: RbxInstance,
  name: string,
  time = 1,
  style = ENUM_EASING_STYLE.Quad,
  direction = ENUM_EASING_DIRECTION.Out
): RbxInstance {
  return createConfiguration(dom, parentConfig, name, [], {
    Direction: { Enum: direction },
    Style: { Enum: style },
    Time: time,
  });
}

function makePartStudioInvisible(part: RbxInstance, transparency = 0.5): void {
  part.SetProperty("Transparency", { Float32: transparency });
  part.AddTag("Invisible");
}

function createStudioDirectionCone(
  dom: RbxDom,
  parentPart: RbxInstance,
  name: string,
  options: {
    color?: [number, number, number];
    transparency?: number;
    offset?: [number, number, number];
    cframeRotation?: number[];
  } = {}
): RbxInstance {
  const cone = dom.Create("ConeHandleAdornment", name);
  cone.Parent = parentPart;
  cone.SetProperty("Color3", {
    Color3: options.color ?? [1, 1, 100 / 255],
  });
  cone.SetProperty("Transparency", { Float32: options.transparency ?? 0.5 });
  cone.SetProperty("Adornee", { Ref: parentPart.Id });
  cone.SetProperty("AlwaysOnTop", { Bool: true });
  cone.SetProperty("Height", { Float32: 1 });
  cone.SetProperty("Radius", { Float32: 0.5 });
  cone.SetProperty("SizeRelativeOffset", {
    Vector3: options.offset ?? [0, 1, 0],
  });
  cone.SetProperty("Visible", { Bool: true });
  cone.SetProperty("ZIndex", { Int32: -1 });
  if (options.cframeRotation) {
    cone.SetProperty("CFrame", {
      CFrame: [0, 0, 0, ...options.cframeRotation],
    });
  }
  cone.AddTag("OnlyInStudio");
  return cone;
}

function moveSurfaceGuisToVisuals(dom: RbxDom, part: RbxInstance): void {
  const guis = part.GetChildren().filter((c) => c.ClassName === "SurfaceGui");
  if (guis.length === 0) return;

  const visuals = dom.Create("Folder", "Visuals");
  visuals.Parent = part;
  for (const gui of guis) {
    gui.Parent = visuals;
    gui.SetProperty("Adornee", { Ref: part.Id });
  }
}

function getPartColorRGB(
  part: RbxInstance | undefined,
  fallback: [number, number, number] = [255, 255, 255]
): [number, number, number] {
  if (!part) return fallback;
  const colorProp = part.GetProperty("Color") ?? part.GetProperty("Color3uint8");
  if (colorProp && typeof colorProp === "object" && "Color3" in colorProp) {
    const [r, g, b] = colorProp.Color3 as [number, number, number];
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }
  return fallback;
}

// ============================================================================
// STEP 1: JToH v5.5 -> EToH v6.0.2 (Based on Goldfish's V6 Converter)
// ============================================================================

function upgrade55To602(dom: RbxDom): RbxInstance | undefined {
  const clientSidedObjects = dom.FindFirstChild("ClientSidedObjects", true);
  if (!clientSidedObjects || !clientSidedObjects.Parent) {
    return undefined;
  }

  const towerRoot = clientSidedObjects.Parent;
  const currentName = towerRoot.Name;
  if (!towerRoot.GetAttribute("OriginalName")) {
    towerRoot.SetAttribute(
      "OriginalName",
      currentName.replace(" [AUTO-BACKUP DO NOT DELETE]", "")
    );
  }
  towerRoot.Name = "TowerKit";

  // Set base migrated version to 6.0.2 prior to running v6.1.x patches
  clientSidedObjects.SetAttribute("KitVersion", "6.0.2");

  // Setup DistanceCulling folder & configuration
  let distanceCulling = clientSidedObjects.FindFirstChild("DistanceCulling");
  if (!distanceCulling) {
    distanceCulling = dom.Create("Folder", "DistanceCulling");
    distanceCulling.Parent = clientSidedObjects;

    createConfiguration(
      dom,
      distanceCulling,
      "DistanceCullingConfiguration",
      ["CO_DistanceCulling", "v6.0.0"],
      {
        Mode: "Anchor",
        Range: 150,
        UpdateInterval: 0.2,
      }
    );
  }

  // Snapshot descendants before mutating hierarchy
  const descendants = towerRoot.GetDescendants();

  for (const object of descendants) {
    if (object.IsDestroyed) continue;
    // Skip objects that already possess a v6 Configuration
    if (object.FindFirstChildOfClass("Configuration")) continue;

    // ------------------------------------------------------------------------
    // MODELS
    // ------------------------------------------------------------------------
    if (object.IsA("Model")) {
      if (
        object.Name === "Spinning Platform" ||
        object.Name === "Beginner Spinning Weld Platform" ||
        object.Name === "Spinning Kill Brick"
      ) {
        purgeLegacyClientScripts(object);

        const isWeldOrKill =
          object.Name === "Beginner Spinning Weld Platform" ||
          object.Name === "Spinning Kill Brick";
        const secondPartName = isWeldOrKill ? "Motor" : "Platform";

        let partsFolder = object
          .GetChildren()
          .find((c) => c.ClassName === "Folder" && c.Name === "Parts");
        if (!partsFolder && object.GetChildren().length > 2) {
          partsFolder = dom.Create("Folder", "Parts");
          partsFolder.Parent = object;
        }

        let cylindrical: RbxInstance | undefined;
        for (const item of object.GetChildren()) {
          if (item.IsA("Folder")) continue;
          const cc = item.FindFirstChildOfClass("CylindricalConstraint");
          if (cc) {
            cylindrical = cc;
            item.Parent = object;
          } else if (partsFolder) {
            item.Parent = partsFolder;
          }
        }

        if (!cylindrical) {
          cylindrical = object.FindFirstChildWhichIsA(
            "CylindricalConstraint",
            true
          );
        }

        if (cylindrical && cylindrical.Parent) {
          const primaryPart = cylindrical.Parent;
          primaryPart.Name = "Primary";

          const att0Ref = cylindrical.GetProperty("Attachment0");
          const att1Ref = cylindrical.GetProperty("Attachment1");
          const att0 =
            att0Ref && typeof att0Ref === "object" && "Ref" in att0Ref
              ? dom.Get(att0Ref.Ref as string)
              : undefined;
          const att1 =
            att1Ref && typeof att1Ref === "object" && "Ref" in att1Ref
              ? dom.Get(att1Ref.Ref as string)
              : undefined;

          if (att1 && att1.Parent) {
            att1.Parent.Name = secondPartName;
            att1.Parent.Parent = object;
          }

          const transpProp = primaryPart.GetProperty("Transparency");
          const transp =
            transpProp &&
            typeof transpProp === "object" &&
            "Float32" in transpProp
              ? Number(transpProp.Float32)
              : 0;
          if (primaryPart.IsA("BasePart") && transp === 1) {
            primaryPart.SetProperty("Transparency", { Float32: 0.5 });
            primaryPart.SetProperty("Material", { Enum: 288 }); // Neon
            primaryPart.AddTag("Invisible");
          }

          if (att0 && att1) {
            const hinge = dom.Create("HingeConstraint", "HingeConstraint");
            hinge.Parent =
              object.Name === "Spinning Kill Brick" && att0.Parent
                ? att0.Parent
                : primaryPart;
            hinge.SetProperty("Attachment0", { Ref: att0.Id });
            hinge.SetProperty("Attachment1", { Ref: att1.Id });

            const angVel = cylindrical.GetProperty("AngularVelocity");
            if (angVel) hinge.SetProperty("AngularVelocity", angVel);

            const maxAcc = cylindrical.GetProperty("MotorMaxAcceleration");
            if (maxAcc) hinge.SetProperty("MotorMaxAcceleration", maxAcc);

            hinge.SetProperty("MotorMaxTorque", { Float32: "Infinity" });
            hinge.SetProperty("ActuatorType", {
              Enum: ENUM_ACTUATOR_TYPE.Motor,
            });

            cylindrical.Destroy();
            if (
              object.Name !== "Beginner Spinning Weld Platform" ||
              object.Parent === clientSidedObjects
            ) {
              object.Parent = distanceCulling;
            }
          }
        }
      } else if (object.Name === "Tilting Platform") {
        purgeLegacyClientScripts(object);
        const att0 = object.FindFirstChild("Attachment0", true);
        const att1 = object.FindFirstChild("Attachment1", true);
        if (att0?.Parent) att0.Parent.Name = "Primary";
        if (att1?.Parent) att1.Parent.Name = "Motor";

        let hinge = object.FindFirstChildWhichIsA("HingeConstraint", true);
        if (!hinge && att0?.Parent) {
          hinge = dom.Create("HingeConstraint", "HingeConstraint");
          hinge.Parent = att0.Parent;
          if (att0) hinge.SetProperty("Attachment0", { Ref: att0.Id });
          if (att1) hinge.SetProperty("Attachment1", { Ref: att1.Id });
          hinge.SetProperty("ActuatorType", { Enum: ENUM_ACTUATOR_TYPE.None });

          const cyl = object.FindFirstChildWhichIsA(
            "CylindricalConstraint",
            true
          );
          if (cyl) cyl.Destroy();
        }
        object.Parent = distanceCulling;
      } else if (object.Name === "Loose Platform") {
        purgeLegacyClientScripts(object);
        const bsc = object.FindFirstChildWhichIsA("BallSocketConstraint", true);
        if (bsc?.Parent) {
          bsc.Parent.Name = "Primary";
          const transp = bsc.Parent.GetProperty("Transparency");
          if (
            transp &&
            typeof transp === "object" &&
            "Float32" in transp &&
            Number(transp.Float32) === 1
          ) {
            bsc.Parent.SetProperty("Transparency", { Float32: 0.5 });
            bsc.Parent.SetProperty("Material", { Enum: 288 }); // Neon
            bsc.Parent.AddTag("Invisible");
          }
        }
        const att1 = object.FindFirstChild("Attachment1", true);
        if (att1?.Parent) att1.Parent.Name = "Platform";
        object.Parent = distanceCulling;
      } else if (
        object.Name === "Single Rope Platform" ||
        object.Name === "Rope Swing Platform"
      ) {
        purgeLegacyClientScripts(object);
        const att1 = object.FindFirstChild("Attachment1", true);
        if (att1?.Parent) att1.Parent.Name = "Primary";

        const rope = object.FindFirstChildWhichIsA("RopeConstraint", true);
        if (rope?.Parent) rope.Parent.Name = "Platform";

        const bv = object.FindFirstChildWhichIsA("BodyVelocity", true);
        if (bv && bv.Parent) {
          const lv = dom.Create("LinearVelocity", "LinearVelocity");
          lv.Parent = bv.Parent;
          const att0 = object.FindFirstChild("Attachment0", true);
          if (att0) lv.SetProperty("Attachment0", { Ref: att0.Id });
          lv.SetProperty("MaxAxesForce", { Vector3: [10, 10, 10] });
          bv.Destroy();
        }

        object.Parent = distanceCulling;
      } else if (object.Name === "Button") {
        purgeLegacyClientScripts(object);
        // Convert v5.5 Button to v6 ButtonConfiguration
        if (!object.FindFirstChild("ButtonConfiguration")) {
          const btnConfig = createConfiguration(
            dom,
            object,
            "ButtonConfiguration",
            ["CO_Interactables/Button", "v6.0.0"],
            {
              ColorSpecific: getBoolValue(object, "ColorSpecific", false),
              Debounce: getNumberValue(object, "Debounce", 0.5),
              HideGUI: getBoolValue(object, "HideGUI", false),
              Invert: getBoolValue(object, "Invert", false),
              PadMode: false,
              Timer: getNumberValue(object, "Timer", 0),
              TimerDecimalPlaces: 1,
              TimerText: "{T}",
            }
          );

          createTouchConfiguration(dom, btnConfig, {
            balloon: getBoolValue(object, "SupportBalloons", false),
            player: getBoolValue(object, "SupportPlayers", true),
            pushbox: getBoolValue(object, "SupportPushboxes", false),
            turret: getBoolValue(object, "SupportTurrets", false),
          });

          createTweenConfiguration(dom, btnConfig, "PressTweenConfiguration", 0.25);

          destroyChildrenByName(object, [
            "ColorSpecific",
            "Debounce",
            "HideGUI",
            "Invert",
            "SupportBalloons",
            "SupportPlayers",
            "SupportPushboxes",
            "SupportTurrets",
            "Timer",
          ]);
        }
      } else if (object.Name === "ButtonDeactivator") {
        object.Parent = clientSidedObjects;
        const btnConfig = createConfiguration(
          dom,
          object,
          "ButtonConfiguration",
          ["CO_Interactables/ButtonDeactivator", "v6.0.0"],
          {
            ColorSpecific: getBoolValue(object, "ColorSpecific", false),
          }
        );

        createTouchConfiguration(dom, btnConfig, {
          player: getBoolValue(object, "SupportPlayers", true),
          pushbox: getBoolValue(object, "SupportPushboxes", false),
        });

        if (object.FindFirstChild("Invisible")) {
          object.FindFirstChild("Invisible")?.Destroy();
          object.AddTag("Invisible");
        }
        destroyChildrenByName(object, [
          "ColorSpecific",
          "SupportPlayers",
          "SupportPushboxes",
        ]);
      } else if (
        object.Name === "FallingPlatform" ||
        object.Name === "Falling Platform"
      ) {
        purgeLegacyClientScripts(object);
        const endPart = object.FindFirstChild("End");
        const platformPart = object.FindFirstChild("Platform");

        if (endPart) purgeLegacyClientScripts(endPart);
        if (platformPart) {
          purgeLegacyClientScripts(platformPart);
          const bp = platformPart.FindFirstChild("BodyPosition");
          if (bp) bp.Destroy();

          const alignPos = dom.Create("AlignPosition", "AlignPosition");
          alignPos.Parent = platformPart;
        }

        if (!object.FindFirstChildOfClass("Beam") && platformPart && endPart) {
          const beam = dom.Create("Beam", "FallingPlatformBeam");
          beam.Parent = object;
          beam.SetProperty("LightEmission", { Float32: 1 });
          beam.SetProperty("LightInfluence", { Float32: 1 });
          beam.SetProperty("TextureSpeed", { Float32: 1 });
          beam.SetProperty("FaceCamera", { Bool: true });
          beam.SetProperty("Segments", { Int32: 25 });
          beam.SetProperty("Width0", { Float32: 0.5 });
          beam.SetProperty("Width1", { Float32: 0.5 });
        }

        createConfiguration(
          dom,
          object,
          "FallingPlatformConfiguration",
          ["CO_Physics/FallingPlatform", "v6.0.1"],
          {
            ActivateConnectedParts: true,
            ActiveCanCollide: false,
            Active: 1.5,
            ActiveTransparency: 0.75,
            BaseMass: 12.6,
          }
        );
      } else if (object.Name === "Key" || object.Name === "KeyDoor") {
        const isDoor = object.Name === "KeyDoor";
        if (isDoor) object.Name = "Door";

        const keyId = getStringValue(object, "KeyID", "DefaultKeyGroup");
        let keyGroup = clientSidedObjects.FindFirstChild(keyId);
        if (!keyGroup) {
          keyGroup = dom.Create("Folder", keyId);
          keyGroup.Parent = clientSidedObjects;
          keyGroup.AddTag("KeyGroupProcessLater");

          createConfiguration(
            dom,
            keyGroup,
            "KeyGroupConfiguration",
            ["CO_Interactables/KeyGroup", "v6.0.1"],
            {}
          );
        }
        object.Parent = keyGroup;
        purgeLegacyClientScripts(object);

        const hitbox = object.FindFirstChild("KeyHitbox");
        if (hitbox) {
          hitbox.AddTag("Invisible");
          hitbox.Name = "Hitbox";
        }

        if (isDoor) {
          createConfiguration(dom, object, "DoorConfiguration", [], {
            RequiredKeys: 1,
          });
          const doorParts = dom.Create("Folder", "DoorParts");
          doorParts.Parent = object;
          const vanish = object.FindFirstChild("Vanish");
          if (vanish) vanish.Parent = doorParts;
        } else {
          createConfiguration(dom, object, "KeyConfiguration", [], {
            SpinSpeed: 5,
            Timer: 0,
            TimerDecimalPlaces: 1,
            ViewportOffset: { CFrame: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1] },
          });
        }
        destroyChildrenByName(object, ["KeyID"]);
      } else if (object.Name === "Morpher") {
        const legacyScript = object.FindFirstChild("ClientObjectScript");

        for (const item of object.GetChildren()) {
          if (item.Name === "Button") {
            const btnConfig = createConfiguration(
              dom,
              item,
              "MorpherButtonConfiguration",
              [],
              {
                CarryObjects: true,
                Timer: getNumberValue(item, "MorphDuration", 5),
                TimerDecimalPlaces: 0,
                TimerText: "{T}",
              }
            );

            createTouchConfiguration(dom, btnConfig, {
              balloon: getBoolValue(item, "SupportBalloons", false),
              player: getBoolValue(item, "SupportPlayers", true),
              pushbox: getBoolValue(item, "SupportPushboxes", false),
              turret: getBoolValue(item, "SupportTurrets", false),
            });

            createTweenConfiguration(
              dom,
              btnConfig,
              "MoveTweenConfiguration",
              getNumberValue(item, "MorphSpeed", 1)
            );
            createTweenConfiguration(
              dom,
              btnConfig,
              "ReturnTweenConfiguration",
              getNumberValue(item, "ReturnSpeed", 1)
            );

            if (legacyScript) {
              const press = legacyScript.FindFirstChild("Press");
              const tick = legacyScript.FindFirstChild("Tick");
              if (press) press.Clone().Parent = btnConfig;
              if (tick) tick.Clone().Parent = btnConfig;
            }

            destroyChildrenByName(item, [
              "MorphDuration",
              "MorphSpeed",
              "ReturnSpeed",
              "SupportBalloons",
              "SupportPlayers",
              "SupportPushboxes",
              "SupportTurrets",
            ]);
          }
        }

        const morpherConfig = createConfiguration(
          dom,
          object,
          "MorpherConfiguration",
          ["CO_Interactables/Morpher", "v6.0.0"],
          {}
        );

        if (legacyScript) {
          const durationGui = legacyScript.FindFirstChild("DurationGui");
          if (durationGui) durationGui.Clone().Parent = morpherConfig;
        }

        purgeLegacyClientScripts(object);
      } else if (object.Name === "Moving Platform") {
        purgeLegacyClientScripts(object);

        const positions = object.FindFirstChild("Positions");
        const delayVal = getNumberValue(object, "Delay", 1);
        const invisPositions = getBoolValue(object, "InvisiblePositions", false);

        if (positions) {
          const count = positions.GetChildren().length;
          for (let i = 1; i <= count; i++) {
            const pos = positions.FindFirstChild(`a${i}`);
            if (pos) {
              pos.Name = String(i);
              const transpProp = pos.GetProperty("Transparency");
              const transp =
                transpProp &&
                typeof transpProp === "object" &&
                "Float32" in transpProp
                  ? Number(transpProp.Float32)
                  : 0;
              if (invisPositions || transp === 1) {
                makePartStudioInvisible(pos, 0.5);
              }
              const posConfig = createConfiguration(
                dom,
                pos,
                "PositionConfiguration",
                [],
                { MoveDelay: delayVal }
              );
              createTweenConfiguration(dom, posConfig, "TweenConfiguration", 2);
            }
          }
        }

        const ao = object.FindFirstChildWhichIsA("AlignOrientation", true);
        if (ao) {
          ao.SetProperty("Mode", { Enum: 0 }); // OneAttachment
          ao.SetProperty("Attachment0", undefined);
        }
        const ap = object.FindFirstChildWhichIsA("AlignPosition", true);
        if (ap) {
          ap.SetProperty("Mode", { Enum: 0 }); // OneAttachment
          ap.SetProperty("Attachment0", undefined);
        }

        const mpConfig = createConfiguration(
          dom,
          object,
          "MovingPlatformConfiguration",
          ["CO_Physics/MovingPlatform", "v6.0.0"],
          {
            TouchActivated: false,
            Tween: false,
          }
        );

        createTouchConfiguration(dom, mpConfig, {
          player: true,
          pushbox: true,
        });

        destroyChildrenByName(object, ["Delay", "InvisiblePositions"]);
      } else if (object.Name === "PushboxSpawnButton") {
        purgeLegacyClientScripts(object);

        const existingPushbox = object.FindFirstChild("Pushbox");
        if (existingPushbox && existingPushbox.ClassName !== "Model") {
          const model = dom.Create("Model", "Pushbox");
          model.Parent = object;
          model.AddTag("SkipObjectLoad");

          for (const item of object.GetDescendants()) {
            if (item.Name === "Pushbox" && item !== model) {
              item.Parent = model;
              item.SetProperty("Anchored", { Bool: false });
            }
          }
        }

        const spawnerConfig = createConfiguration(
          dom,
          object,
          "PushboxSpawnConfiguration",
          ["CO_Interactables/PushboxSpawn", "v6.0.0"],
          {
            Cooldown: getNumberValue(object, "Cooldown", 1),
            DontSpawnFirst: getBoolValue(object, "DontSpawnFirst", false),
          }
        );

        createTouchConfiguration(dom, spawnerConfig, {
          balloon: getBoolValue(object, "ButtonSupportBalloons", false),
          colorSpecific: getBoolValue(object, "ButtonColorSpecific", false),
          player: getBoolValue(object, "ButtonSupportPlayers", true),
          pushbox: getBoolValue(object, "ButtonSupportPushboxes", false),
          turret: getBoolValue(object, "ButtonSupportTurrets", false),
        });

        destroyChildrenByName(object, [
          "Cooldown",
          "DontSpawnFirst",
          "ButtonSupportBalloons",
          "ButtonColorSpecific",
          "ButtonSupportPlayers",
          "ButtonSupportPushboxes",
          "ButtonSupportTurrets",
        ]);
      } else if (object.Name === "PushingPlatform") {
        purgeLegacyClientScripts(object);
        const decal = object.FindFirstChildWhichIsA("Decal", true);
        if (decal?.Parent) decal.Parent.Name = "X";

        const vf = object.FindFirstChildWhichIsA("VectorForce", true);
        if (vf?.Parent) vf.Parent.Name = "Base";

        const pc = object.FindFirstChildWhichIsA("PrismaticConstraint", true);
        if (pc?.Parent) pc.Parent.Name = "Primary";
      } else if (object.Name === "PushingPlatformTrampoline") {
        purgeLegacyClientScripts(object);
        const decal = object.FindFirstChildWhichIsA("Decal", true);
        if (decal?.Parent) decal.Parent.Name = "X";

        const vf = object.FindFirstChildWhichIsA("VectorForce", true);
        if (vf?.Parent) {
          vf.Parent.Name = "Base";
          const att0Ref = vf.GetProperty("Attachment0");
          const att0 =
            att0Ref && typeof att0Ref === "object" && "Ref" in att0Ref
              ? dom.Get(att0Ref.Ref as string)
              : undefined;
          if (att0) att0.Name = "ForceAttachment";
        }

        const pc = object.FindFirstChildWhichIsA("PrismaticConstraint", true);
        if (pc?.Parent) {
          pc.Parent.Name = "Anchor";
          const att0Ref = pc.GetProperty("Attachment0");
          const att1Ref = pc.GetProperty("Attachment1");
          const att0 =
            att0Ref && typeof att0Ref === "object" && "Ref" in att0Ref
              ? dom.Get(att0Ref.Ref as string)
              : undefined;
          const att1 =
            att1Ref && typeof att1Ref === "object" && "Ref" in att1Ref
              ? dom.Get(att1Ref.Ref as string)
              : undefined;
          if (att0) att0.Name = "AnchorAttachment";
          if (att1) att1.Name = "BaseAttachment";
          purgeLegacyClientScripts(pc.Parent);
        }

        createConfiguration(
          dom,
          object,
          "PushingPlatformTrampolineConfiguration",
          ["CO_Physics/PushingPlatformTrampoline", "v6.0.0"],
          { LauchSpeed: 1 }
        );
      } else if (object.Name === "Swing") {
        object.Name = "Vine";
        const sounds = dom.Create("Folder", "Sounds");
        sounds.Parent = object;

        const grab = object.FindFirstChild("Grab", true);
        const jump = object.FindFirstChild("Jump", true);
        if (grab) grab.Parent = sounds;
        if (jump) jump.Parent = sounds;

        purgeLegacyClientScripts(object);

        const top = object.FindFirstChild("Top");
        if (top) {
          top.Name = "AttachmentPart";
          const vineAtt = dom.Create("Attachment", "VineAttachment");
          vineAtt.Parent = top;
          vineAtt.SetProperty("Orientation", { Vector3: [0, 0, 90] });
        }

        const swingPart = object.FindFirstChild("Swing");
        if (swingPart) {
          const mesh = swingPart.FindFirstChild("Mesh");
          if (mesh) mesh.Destroy();
          swingPart.SetProperty("Shape", { Enum: ENUM_PART_TYPE.Cylinder });
          swingPart.Name = "VinePart";
        }

        const vineConfig = createConfiguration(
          dom,
          object,
          "VineConfiguration",
          ["CO_Mountables/Vine", "v6.0.1"],
          {
            AllowJumpDismount: getBoolValue(object, "AllowJumpDismount", true),
            HandleAnimation: true,
            KeepMomentum: getBoolValue(object, "KeepVelocity", true),
            RespawnTime: getNumberValue(object, "RespawnTime", 3),
          }
        );

        createTouchConfiguration(dom, vineConfig, {
          player: true,
          pushbox: true,
        });
        createTweenConfiguration(
          dom,
          vineConfig,
          "TweenConfiguration",
          0.5,
          ENUM_EASING_STYLE.Linear
        );

        destroyChildrenByName(object, [
          "AllowJumpDismount",
          "KeepVelocity",
          "RespawnTime",
          "RopeLength",
        ]);
      } else if (object.Name === "Teleporter") {
        purgeLegacyClientScripts(object);

        for (const item of object.GetChildren()) {
          if (item.Name === "Teleporter" || item.Name === "Destination") {
            if (item.FindFirstChild("Invisible")) {
              item.FindFirstChild("Invisible")?.Destroy();
              makePartStudioInvisible(item, 0.5);
            }
            if (item.Name === "Destination") {
              createStudioDirectionCone(dom, item, "UpDirection", {
                color: [0, 1, 0],
                transparency: 0.25,
                offset: [0, 1, 0],
              });
              createStudioDirectionCone(dom, item, "LookDirection", {
                color: [1, 1, 1],
                transparency: 0.25,
                offset: [0, 0, -1],
              });
            }
          }
        }

        const transTime = getNumberValue(object, "TransitionTime", 0);
        const tpConfig = createConfiguration(
          dom,
          object,
          "TeleporterConfiguration",
          ["CO_Interactables/Teleporter", "v6.0.0"],
          {
            DisableCollision: false,
            Instant: transTime === 0,
            KeepVelocity: getBoolValue(object, "KeepVelocity", false),
            Offset: { CFrame: [0, 4, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1] },
            SeamlessTeleport: false,
          }
        );

        createTouchConfiguration(dom, tpConfig, {
          player: getBoolValue(object, "TeleportPlayers", true),
          pushbox: getBoolValue(object, "TeleportPushboxes", false),
        });
        createTweenConfiguration(
          dom,
          tpConfig,
          "TweenConfiguration",
          transTime,
          ENUM_EASING_STYLE.Linear
        );

        const tpSound = object.FindFirstChild("TeleportSound", true);
        if (tpSound) tpSound.Name = "Teleport";

        destroyChildrenByName(object, [
          "KeepVelocity",
          "RemoveButtons",
          "TeleportPlayers",
          "TeleportPushboxes",
          "TransitionTime",
        ]);
      } else if (object.Name === "Turret") {
        purgeLegacyClientScripts(object);

        const bulletPart = object.FindFirstChild("Bullet");
        if (bulletPart && bulletPart.ClassName !== "Model") {
          const bulletModel = dom.Create("Model", "Bullet");
          bulletModel.Parent = object;
          bulletModel.AddTag("SkipObjectLoad");
          bulletPart.Parent = bulletModel;
        }

        const activators = dom.Create("Folder", "Activators");
        activators.Parent = object;

        const ignorePlayers = getBoolValue(object, "IgnorePlayers", false);
        createConfiguration(
          dom,
          object,
          "TurretConfiguration",
          ["CO_Interactables/Turret", "v6.0.1"],
          {
            ActivatorCooldown: 1,
            Damage: getNumberValue(object, "Damage", 10),
            DestroyOnTouch: !ignorePlayers,
            FireRate: getNumberValue(object, "Delay", 1),
            MaxLifetime: 5,
            Range: getNumberValue(object, "Distance", 50),
            Speed: getNumberValue(object, "Speed", 30),
          }
        );

        const turretHead = object.FindFirstChild("Turret");
        if (turretHead) {
          const hole = dom.Create("Decal", "Hole");
          hole.Parent = turretHead;
          hole.SetProperty("Texture", {
            String: "rbxassetid://106125794836484",
          });
          hole.SetProperty("Face", { Enum: ENUM_NORMAL_ID.Front });
          hole.SetProperty("Color3", { Color3: [0, 0, 0] });
        }

        const ignoreBullets = object.FindFirstChild("IgnoreBullets", true);
        if (ignoreBullets) ignoreBullets.Destroy();

        const innerCos = object.FindFirstChild("ClientObjectScript", true);
        if (innerCos) innerCos.Destroy();

        destroyChildrenByName(object, [
          "Damage",
          "Delay",
          "Distance",
          "IgnoreParts",
          "IgnorePlayers",
          "Speed",
        ]);
      }
    }

    // ------------------------------------------------------------------------
    // BASEPARTS
    // ------------------------------------------------------------------------
    else if (object.IsA("BasePart")) {
      const leftSurf = object.GetProperty("LeftSurface") ?? {
        Enum: ENUM_SURFACE_TYPE.Smooth,
      };
      for (const face of ["FrontSurface", "TopSurface", "BackSurface"]) {
        const surf = object.GetProperty(face);
        if (
          surf &&
          typeof surf === "object" &&
          "Enum" in surf &&
          surf.Enum === ENUM_SURFACE_TYPE.Hinge
        ) {
          object.SetProperty(face, leftSurf);
        }
      }

      if (object.FindFirstChild("SetCollisionGroup")) {
        const cg = getStringValue(object, "SetCollisionGroup", "Default");
        object.SetProperty("CollisionGroup", { String: cg });
        object.FindFirstChild("SetCollisionGroup")?.Destroy();
      }

      if (object.Name === "ButtonActivatedPlatform") {
        object.AddTag("ButtonActivated");
      }

      const simpleTagChildren = [
        "Invert",
        "FullHide",
        "IgnoreAll",
        "Invisible",
        "IgnoreTransparency",
        "IgnoreCanCollide",
      ];
      for (const tagName of simpleTagChildren) {
        const child = object.FindFirstChild(tagName);
        if (child) {
          object.AddTag(tagName);
          child.Destroy();
        }
      }

      const colorOverrideChild = object.FindFirstChild("ColorOverride");
      if (colorOverrideChild) {
        const val = colorOverrideChild.GetProperty("Value");
        if (val) object.SetAttribute("ColorOverride", val);
        colorOverrideChild.Destroy();
      }

      const setTranspChild = object.FindFirstChild("SetTransparency");
      if (setTranspChild) {
        const val = getNumberValue(object, "SetTransparency", 0);
        object.SetAttribute("SetTransparency", val);
        setTranspChild.Destroy();
      }

      // Damage Bricks (kills, ouch, instakills, double)
      const damageTypes = ["kills", "ouch", "instakills", "double"];
      let matchedDamage: string | undefined;
      for (const dt of damageTypes) {
        const child = object.FindFirstChild(dt);
        if (child) {
          matchedDamage = dt;
          child.Destroy();
          break;
        }
      }

      if (matchedDamage) {
        const attrs: Record<string, any> = {
          Cooldown: 0,
          Type: matchedDamage === "double" ? "custom" : matchedDamage,
        };
        if (matchedDamage === "double") attrs.Damage = 10;
        createConfiguration(dom, object, "DamageBrickConfiguration", [], attrs);
      } else if (
        object.FindFirstChild("CanFlip") &&
        !object.FindFirstChild("ClientObject")
      ) {
        object.FindFirstChild("CanFlip")?.Destroy();
        object.AddTag("CanFlip");
        object.SetAttribute("FlipCooldown", 0);
      } else if (
        object.Name === "SwingDismounter" ||
        object.Name === "BalloonDestroyer"
      ) {
        const isBalloon = object.Name === "BalloonDestroyer";
        purgeLegacyClientScripts(object);
        destroyChildrenByName(object, ["NoJump"]);
        object.Name = "Dismounter";

        const transp = object.GetProperty("Transparency");
        if (
          transp &&
          typeof transp === "object" &&
          "Float32" in transp &&
          Number(transp.Float32) === 1
        ) {
          object.SetProperty("Transparency", { Float32: 0.5 });
          object.SetProperty("Color", { Color3: [0, 1, 0] });
          object.AddTag("Invisible");
        }

        const dismounterConfig = createConfiguration(
          dom,
          object,
          "DismounterConfiguration",
          ["CO_Interactables/Dismounter", "v6.0.1"],
          {
            Cooldown: 0,
            DismountAttachers: false,
            DismountBalloons: isBalloon,
            DismountSeats: false,
            DismountSwings: false,
            DismountVines: !isBalloon,
            DismountZiplines: false,
            ForceDismountPlayer: false,
            MountColorSpecific: false,
          }
        );

        createTouchConfiguration(dom, dismounterConfig, {
          balloon: true,
          player: true,
          pushbox: true,
        });
      } else if (object.Name === "TripPart") {
        purgeLegacyClientScripts(object);
        object.AddTag("CO_Interactables/TripPart");
        object.AddTag("v6.0.1");

        const tripConfig = createConfiguration(
          dom,
          object,
          "TripPartConfiguration",
          ["CO_Interactables/TripPart", "v6.0.1"],
          {
            Cooldown: 1,
            StunDuration: 0,
          }
        );
        createTouchConfiguration(dom, tripConfig, {
          player: true,
          pushbox: true,
        });
      } else if (object.Name === "Seat") {
        purgeLegacyClientScripts(object);
        createStudioDirectionCone(dom, object, "Visual");

        const seatConfig = createConfiguration(
          dom,
          object,
          "SeatConfiguration",
          ["CO_Mountables/Seat", "v6.0.1"],
          {
            Cooldown: getNumberValue(object, "SitCooldown", 1),
            SitOffset: { CFrame: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1] },
          }
        );
        createTouchConfiguration(dom, seatConfig, {
          player: true,
          pushbox: true,
        });
        destroyChildrenByName(object, ["SitCooldown"]);
      } else if (object.Name === "BalloonDispenser") {
        const parent = object.Parent;
        const model = dom.Create("Model", "BalloonDispenser");
        if (parent) model.Parent = parent;
        object.Parent = model;

        const soundsFolder = dom.Create("Folder", "Sounds");
        soundsFolder.Parent = model;

        const cos = object.FindFirstChild("ClientObjectScript");
        if (cos) {
          const inflate = cos.FindFirstChild("Inflate");
          const pop = cos.FindFirstChild("Pop");
          if (inflate) inflate.Parent = soundsFolder;
          if (pop) pop.Parent = soundsFolder;
        }

        purgeLegacyClientScripts(object);
        object.Name = "Dispenser";

        const balloonConfig = createConfiguration(
          dom,
          model,
          "BalloonConfiguration",
          ["CO_Mountables/Balloon", "v6.0.1"],
          {
            AllowJumpDismount: !getBoolValue(object, "CannotDismount", false),
            DestroyWhenExpired: true,
            HandleAnimation: true,
            KeepMomentum: true,
            MaxHeight: getNumberValue(object, "MaxHeight", 50),
            RopeLength: 8,
            Speed: getNumberValue(object, "Force", 20),
            Timer: getNumberValue(object, "WaitTime", 5),
          }
        );

        createTouchConfiguration(dom, balloonConfig, {
          player: true,
          pushbox: true,
        });
        createTweenConfiguration(
          dom,
          balloonConfig,
          "TweenConfiguration",
          2,
          ENUM_EASING_STYLE.Linear
        );

        destroyChildrenByName(object, [
          "CannotDismount",
          "MaxHeight",
          "Force",
          "WaitTime",
        ]);
      } else if (object.Name === "BulletVelocityChanger") {
        purgeLegacyClientScripts(object);
        object.Name = "BulletVelocity Changer";

        createStudioDirectionCone(dom, object, "LookDirection", {
          color: [1, 1, 1],
          transparency: 0.25,
          offset: [0, 0, -1],
        });

        const propConfig = createConfiguration(
          dom,
          object,
          "PropertyChangerConfiguration",
          ["CO_Interactables/PropertyChanger", "v6.0.1"],
          {
            Cooldown: 0,
            Speed: getNumberValue(object, "Speed", 50),
          }
        );

        const propsMod = dom.Create("ModuleScript", "Properties");
        propsMod.Parent = propConfig;
        propsMod.SetProperty("Source", {
          String: `--!strict
local _C = require(game:GetService("ReplicatedStorage").Framework.Kit.Repository.Interactables.PropertyChanger.TypeDefs)
local script, workspace, Workspace, game, Game, shared, _G, wait, task, spawn, delay, Spawn, Delay, Wait, require, Instance
local Toucher, Tagged, TagFromSequenceVariable, Changer, Character = _C.Toucher, _C.Tagged, _C.TagFromSequenceVariable, _C.Changer, _C.Character
-- DON'T TOUCH THE LINES ABOVE -- -- PLEASE IGNORE THE LINES ABOVE -- -- DON'T TOUCH THE LINES ABOVE -- -- PLEASE IGNORE THE LINES ABOVE --

return Changer {
	-- Converted BulletVelocityChanger
}
`,
        });

        createTouchConfiguration(dom, propConfig, {
          player: false,
          pushbox: false,
          turret: true,
        });

        destroyChildrenByName(object, [
          "ChangeTime",
          "ColorSpecific",
          "Speed",
        ]);
      } else if (object.Name === "Elevator") {
        purgeLegacyClientScripts(object);
        createStudioDirectionCone(dom, object, "Visual");

        const elevConfig = createConfiguration(
          dom,
          object,
          "ElevatorConfiguration",
          ["CO_Physics/Elevator", "v6.0.0"],
          {
            ContinuousUpdates: false,
            HitboxMode: "StaticWholeBody",
            MaxForce: getNumberValue(object, "MaxForce", 10000),
            Speed: getNumberValue(object, "Speed", 20),
            Vector: "UpVector",
          }
        );

        createTouchConfiguration(dom, elevConfig, {
          player: true,
          pushbox: true,
        });
        destroyChildrenByName(object, ["MaxForce", "Speed"]);
      } else if (object.Name === "Conveyor") {
        purgeLegacyClientScripts(object);
        const beam = object.FindFirstChildWhichIsA("Beam", true);
        if (beam) beam.Parent = object;

        createStudioDirectionCone(dom, object, "Visual", {
          offset: [0, 0, -1],
        });

        createConfiguration(
          dom,
          object,
          "ConveyorConfiguration",
          ["CO_Physics/Conveyor", "v6.0.0"],
          {
            Speed: getNumberValue(object, "Speed", 15),
          }
        );
        destroyChildrenByName(object, ["Speed"]);
      } else if (object.Name === "DisappearingPlatform") {
        purgeLegacyClientScripts(object);
        const parent = object.Parent;
        const group = dom.Create("Model", "VanisherGroup");
        if (parent) group.Parent = parent;
        object.Parent = group;
        object.Name = "Vanisher";

        const vanConfig = createConfiguration(
          dom,
          group,
          "VanisherConfiguration",
          ["CO_Interactables/Vanisher", "v6.0.2"],
          {
            BlinkCount: 3,
            ConstantNoRecovery: false,
            Invert: false,
            RespawnFade: false,
            RespawnTime: getNumberValue(object, "RespawnTime", 3),
            ShrinkDirection: "Center",
            VanishMode: "Fade",
          }
        );

        createTouchConfiguration(dom, vanConfig, {
          balloon: getBoolValue(object, "SupportBalloons", false),
          player: getBoolValue(object, "SupportPlayers", true),
          pushbox: getBoolValue(object, "SupportPushboxes", false),
          turret: getBoolValue(object, "SupportTurrets", false),
        });
        createTweenConfiguration(dom, vanConfig, "TweenConfiguration", 1);

        const selBox = object.FindFirstChild("SelectionBox");
        if (selBox) selBox.Name = "VanisherSelectionBox";

        destroyChildrenByName(object, [
          "FadeTime",
          "RespawnTime",
          "SupportBalloons",
          "SupportPlayers",
          "SupportPushboxes",
          "SupportTurrets",
        ]);
      } else if (object.Name === "PushboxDestroyer") {
        purgeLegacyClientScripts(object);
        createConfiguration(
          dom,
          object,
          "PushboxDestroyerConfiguration",
          ["CO_Interactables/PushboxDestroyer", "v6.0.0"],
          {
            ColorSpecific: getBoolValue(object, "ColorSpecific", false),
            DestroyTag: "",
            DestroyWholeModel: false,
          }
        );
        destroyChildrenByName(object, ["ColorSpecific"]);
      } else if (object.Name === "PushboxColorChanger") {
        purgeLegacyClientScripts(object);
        object.Name = "PropertyChanger";

        const propConfig = createConfiguration(
          dom,
          object,
          "PropertyChangerConfiguration",
          ["CO_Interactables/PropertyChanger", "v6.0.1"],
          { Cooldown: 0.5 }
        );

        const [r, g, b] = getPartColorRGB(object);
        const propsMod = dom.Create("ModuleScript", "Properties");
        propsMod.Parent = propConfig;
        propsMod.SetProperty("Source", {
          String: `--!strict
local _C = require(game:GetService("ReplicatedStorage").Framework.Kit.Repository.Interactables.PropertyChanger.TypeDefs)
local script, workspace, Workspace, game, Game, shared, _G, wait, task, spawn, delay, Spawn, Delay, Wait, require, Instance
local Toucher, Tagged, TagFromSequenceVariable, Changer, Character = _C.Toucher, _C.Tagged, _C.TagFromSequenceVariable, _C.Changer, _C.Character
-- DON'T TOUCH THE LINES ABOVE -- -- PLEASE IGNORE THE LINES ABOVE -- -- DON'T TOUCH THE LINES ABOVE -- -- PLEASE IGNORE THE LINES ABOVE --

return Changer {
	[Toucher] = {
		Color = Color3.fromRGB(${r}, ${g}, ${b}),
	},
}
`,
        });

        createTouchConfiguration(dom, propConfig, {
          player: true,
          pushbox: true,
        });
      } else if (object.Name === "JumpPad") {
        const bounceConfig = createConfiguration(
          dom,
          object,
          "BouncePadConfiguration",
          ["CO_Interactables/BouncePad", "v6.0.1"],
          {
            Cooldown: 0.05,
            Power: getNumberValue(object, "Power", 50) * 1.35,
            RelativeForce: true,
          }
        );

        const boing = object.FindFirstChild("Boing", true);
        if (boing) {
          boing.Parent = bounceConfig;
          boing.Name = "BounceSound";
        }

        purgeLegacyClientScripts(object);

        createTouchConfiguration(dom, bounceConfig, {
          player: getBoolValue(object, "SupportPlayers", true),
          pushbox: getBoolValue(object, "SupportPushboxes", false),
        });
        createTweenConfiguration(dom, bounceConfig, "TweenConfiguration", 1);

        destroyChildrenByName(object, [
          "Power",
          "SupportPlayers",
          "SupportPushboxes",
        ]);
      } else if (
        object.Name === "Jump Boost Pad" ||
        object.Name === "Speed Boost Pad"
      ) {
        const isJump = object.Name === "Jump Boost Pad";
        purgeLegacyClientScripts(object);
        object.Name = isJump ? "Jump BoostPad" : "Speed BoostPad";

        const boostPadConfig = createConfiguration(
          dom,
          object,
          "BoostPadConfiguration",
          ["CO_Interactables/BoostPad", "v6.0.0"],
          {
            Distance: getNumberValue(object, "Distance", 10),
            Power: getNumberValue(
              object,
              isJump ? "JumpPower" : "WalkSpeed",
              isJump ? 75 : 32
            ),
            Type: isJump ? "Jump" : "Speed",
          }
        );
        createTouchConfiguration(dom, boostPadConfig, {
          player: true,
          pushbox: true,
        });
        destroyChildrenByName(object, [
          "Distance",
          "Power",
          "JumpPower",
          "WalkSpeed",
        ]);
      } else if (
        object.Name === "Jump Booster" ||
        object.Name === "Speed Booster"
      ) {
        const isJump = object.Name === "Jump Booster";
        purgeLegacyClientScripts(object);
        object.Name = "Booster";
        moveSurfaceGuisToVisuals(dom, object);

        const attrs: Record<string, any> = {
          Duration: getNumberValue(object, "BoostLength", 5),
          HideGUI: false,
          Mode: "Default",
          Power: getNumberValue(
            object,
            isJump ? "JumpPower" : "WalkSpeed",
            isJump ? 75 : 32
          ),
          Type: isJump ? "Jump" : "Speed",
        };
        if (!isJump) attrs.TimerDecimals = 1;

        const boosterConfig = createConfiguration(
          dom,
          object,
          "BoosterConfiguration",
          ["CO_Interactables/Booster", "v6.0.0"],
          attrs
        );

        createTouchConfiguration(dom, boosterConfig, {
          player: true,
          pushbox: true,
        });
        createTweenConfiguration(
          dom,
          boosterConfig,
          "StartTweenConfiguration",
          1
        );
        createTweenConfiguration(
          dom,
          boosterConfig,
          "EndTweenConfiguration",
          1
        );

        destroyChildrenByName(object, [
          "JumpPower",
          "WalkSpeed",
          "Instant",
          "BoostLength",
        ]);
      } else if (
        object.Name === "Jump Remover" ||
        object.Name === "Speed Remover"
      ) {
        const isJump = object.Name === "Jump Remover";
        purgeLegacyClientScripts(object);
        object.Name = "BoostRemover";
        moveSurfaceGuisToVisuals(dom, object);

        const removerConfig = createConfiguration(
          dom,
          object,
          "BoostRemoverConfiguration",
          ["CO_Interactables/BoostRemover", "v6.0.0"],
          { Type: isJump ? "Jump" : "Speed" }
        );

        createTouchConfiguration(dom, removerConfig, {
          player: true,
          pushbox: true,
        });
      } else if (
        object.Name === "Lighting Changer" ||
        object.Name === "Lighting Reverter" ||
        object.Name === "Bloom Changer" ||
        object.Name === "Bloom Reverter" ||
        object.Name === "Blur Changer" ||
        object.Name === "Blur Reverter" ||
        object.Name === "Color Correction Changer" ||
        object.Name === "Color Correction Reverter" ||
        object.Name === "Depth Changer" ||
        object.Name === "Depth Reverter"
      ) {
        const lcConfig = createConfiguration(
          dom,
          object,
          "LightingChangerConfiguration",
          ["CO_Visual/LightingChanger", "v6.0.0"],
          { ChangeOnLoad: false }
        );

        const isReverter = object.Name.endsWith("Reverter");
        let effectClass = "Lighting";
        if (object.Name.startsWith("Bloom")) effectClass = "BloomEffect";
        else if (object.Name.startsWith("Blur")) effectClass = "BlurEffect";
        else if (object.Name.startsWith("Color Correction"))
          effectClass = "ColorCorrectionEffect";
        else if (object.Name.startsWith("Depth"))
          effectClass = "DepthOfFieldEffect";

        const lightingModule = dom.Create("ModuleScript", "Lighting");
        lightingModule.Parent = lcConfig;

        if (isReverter) {
          lightingModule.SetProperty("Source", {
            String: `--!strict
local Change = require(game:GetService("ReplicatedStorage").Framework.Kit.Repository.Visual.LightingChanger.TypeDefs)
-- DON'T TOUCH THE LINE ABOVE -- -- DON'T TOUCH THE LINE ABOVE --

return Change "${effectClass}" {
	TweenInfo = TweenInfo.new(1, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
	UseDefault = "TowerDefault",
}
`,
          });
        } else {
          // Extract source from legacy LightingConfiguration ModuleScript if available
          const legacyConfig = object.FindFirstChild("LightingConfiguration");
          const legacySourceProp = legacyConfig?.GetProperty("Source");
          const legacySource =
            legacySourceProp &&
            typeof legacySourceProp === "object" &&
            "String" in legacySourceProp
              ? String(legacySourceProp.String)
              : "";

          const configBodyMatch = legacySource.match(
            /Configuration\s*=\s*\{([\s\S]*?)\}/
          );
          const configBody = configBodyMatch
            ? configBodyMatch[1]
            : "\n\t\t-- Converted from v5.5 LightingConfiguration\n\t";

          lightingModule.SetProperty("Source", {
            String: `--!strict
local Change = require(game:GetService("ReplicatedStorage").Framework.Kit.Repository.Visual.LightingChanger.TypeDefs)
-- DON'T TOUCH THE LINE ABOVE -- -- DON'T TOUCH THE LINE ABOVE --

return Change "${effectClass}" {
	TweenInfo = TweenInfo.new(1, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
	Configuration = {${configBody}},
}
`,
          });
        }

        createTouchConfiguration(dom, lcConfig, {
          colorSpecific: getBoolValue(object, "ColorSpecific", false),
          player: getBoolValue(object, "SupportPlayers", true),
          pushbox: getBoolValue(object, "SupportPushboxes", false),
        });

        const transp = object.GetProperty("Transparency");
        if (
          object.FindFirstChild("Invisible") ||
          (transp &&
            typeof transp === "object" &&
            "Float32" in transp &&
            Number(transp.Float32) === 1)
        ) {
          object.FindFirstChild("Invisible")?.Destroy();
          makePartStudioInvisible(object, 0.8);
        }

        destroyChildrenByName(object, [
          "ColorSpecific",
          "SupportPlayers",
          "SupportPushboxes",
          "LightingConfiguration",
        ]);
      } else if (object.Name === "Zipline") {
        purgeLegacyClientScripts(object);
        const parent = object.Parent;
        const model = dom.Create("Model", "Zipline");
        if (parent) model.Parent = parent;

        object.Parent = model;
        object.Name = "MountPart";

        const sounds = dom.Create("Folder", "Sounds");
        sounds.Parent = model;

        const points = dom.Create("Folder", "Points");
        points.Parent = model;

        const zipConfig = createConfiguration(
          dom,
          model,
          "ZiplineConfiguration",
          ["CO_Mountables/Zipline", "v6.0.1"],
          {
            AllowEndDismount: true,
            AllowJumpDismount: !getBoolValue(object, "CannotDismount", false),
            AllowUserControl: false,
            GuideColor: { Color3: [1, 1, 0] },
            HandleAnimation: true,
            KeepMomentum: false,
            Loop: false,
            RopeLength: 5,
            Segments: 20,
            SegmentShape: "Cylinder",
            SegmentWidth: 0.25,
            Speed: getNumberValue(object, "PropelVelocity", 30),
          }
        );

        createTouchConfiguration(dom, zipConfig, {
          player: true,
          pushbox: true,
        });

        destroyChildrenByName(object, [
          "Start",
          "End",
          "PC",
          "PropelVelocity",
          "CannotDismount",
        ]);
      }
    }

    // ------------------------------------------------------------------------
    // FOLDERS
    // ------------------------------------------------------------------------
    else if (object.IsA("Folder")) {
      if (object.Name === "Beat Blocks") {
        purgeLegacyClientScripts(object);
        for (const item of object.GetChildren()) {
          item.Name = "BeatBlockGroup";
          item.Parent = clientSidedObjects;

          const bbConfig = createConfiguration(
            dom,
            item,
            "BeatBlockConfiguration",
            ["CO_Visual/BeatBlock", "v6.0.1"],
            {
              Indicator: getBoolValue(item, "Indicator", true),
              IndicatorInterval: 0.5,
              IndicatorSize: { Vector3: [3.25, 3.25, 3.25] },
              Interval: Number(getValueObject(item, "ToggleTime") ?? 1),
              MaterialIndicator: { Enum: 256 }, // SmoothPlastic
              OffCanCollide: false,
              OffCanTouch: false,
              OffTransparency: Number(
                getValueObject(item, "OffTransparency") ?? 0.75
              ),
              OnCanCollide: true,
              OnCanTouch: true,
              OnTransparency: Number(
                getValueObject(item, "OnTransparency") ?? 0
              ),
            }
          );

          const cos = item.FindFirstChild("ClientObjectScript");
          const ding = cos?.FindFirstChild("Ding");
          if (ding) ding.Clone().Parent = bbConfig;

          purgeLegacyClientScripts(item);

          for (const part of item.GetChildren()) {
            if (part.IsA("BasePart")) {
              part.SetProperty("Transparency", { Float32: 0 });
              part.SetProperty("CanCollide", { Bool: false });
            }
          }

          createConfiguration(dom, bbConfig, "MusicSyncConfiguration", [], {
            SyncEnabled: false,
            ZoneName: "Floor1",
          });

          destroyChildrenByName(item, [
            "ChangeFrame",
            "Indicator",
            "ToggleTime",
            "OffTransparency",
            "OnTransparency",
          ]);
        }
        object.Destroy();
      } else if (
        object.Name === "ButtonPlatforms" ||
        object.Name === "Buttons" ||
        object.Name === "KillBricks" ||
        object.Name === "LightingChangers"
      ) {
        purgeLegacyClientScripts(object);
      } else if (
        object.Name === "DistanceAnchoringObjects" ||
        object.Name === "DistanceAnchoringObjects (ONLY USE FOR ANTILAG)"
      ) {
        for (const item of object.GetChildren()) {
          if (item.IsA("PVInstance")) {
            item.Parent = distanceCulling;
          }
        }
        object.Destroy();
      } else if (object.Name === "MusicZoneEditors") {
        purgeLegacyClientScripts(object);
        for (const item of object.GetDescendants()) {
          if (item.Name === "MusicZoneEditor") {
            item.Parent = clientSidedObjects;
            const configs = item.FindFirstChild("Configurations");

            const mzeConfig = createConfiguration(
              dom,
              item,
              "MusicZoneEditorConfiguration",
              ["CO_Interactables/MusicZoneEditor", "v6.0.0"],
              {
                Cooldown: configs ? getNumberValue(configs, "Cooldown", 1) : 1,
                OneTimeUse: configs
                  ? getBoolValue(configs, "OneTimeUse", false)
                  : false,
                ZoneName: configs
                  ? getStringValue(configs, "ZoneName", "Floor1")
                  : "Floor1",
              }
            );

            const priority = configs
              ? getNumberValue(configs, "Priority", 1)
              : 1;
            const speed = configs ? getNumberValue(configs, "Speed", 1) : 1;
            const volume = configs ? getNumberValue(configs, "Volume", 0.5) : 0.5;
            const keepTime = configs
              ? getBoolValue(configs, "ChangeTimePosition", false)
              : false;
            const timePos = configs
              ? Number(
                  getValueObject(
                    configs.FindFirstChild("TimePosition", true) ?? configs,
                    "TimePosition"
                  ) ?? 0
                )
              : 0;

            const zoneMod = dom.Create("ModuleScript", "ZoneConfiguration");
            zoneMod.Parent = mzeConfig;
            zoneMod.SetProperty("Source", {
              String: `return {
	ZoneDisabled = false,
	ZonePriority = ${priority},
	SoundConfiguration = {
		PlaybackSpeed = ${speed},
		Volume = ${volume},
	},
	EffectConfiguration = {},
	ExtraConfiguration = {
		KeepTimePosition = { Enabled = ${keepTime}, Offset = ${timePos} },
	},
}
`,
            });

            createTouchConfiguration(dom, mzeConfig, {
              colorSpecific: configs
                ? getBoolValue(configs, "ColorSpecific", false)
                : false,
              player: configs
                ? getBoolValue(configs, "SupportPlayers", true)
                : true,
              pushbox: configs
                ? getBoolValue(configs, "SupportPushboxes", false)
                : false,
            });
            createTweenConfiguration(dom, mzeConfig, "TweenConfiguration", 1);

            if (configs) configs.Destroy();
          }
        }
        object.Destroy();
      } else if (object.Name === "SoundPlayers") {
        purgeLegacyClientScripts(object);
        for (const item of object.GetChildren()) {
          item.Name = "Emitter";
          item.Parent = clientSidedObjects;

          const sound = item.FindFirstChild("Sound");
          if (sound) {
            createConfiguration(dom, sound, "EmitConfiguration", [], {
              EmitDelay: 0,
            });
          }

          const configs = item.FindFirstChild("Configurations");
          const oneTime = configs
            ? getBoolValue(configs, "OneTimeUse", false)
            : false;

          const emitterConfig = createConfiguration(
            dom,
            item,
            "EmitterConfiguration",
            ["CO_Visual/Emitter", "v6.0.0"],
            {
              Cooldown: configs ? getNumberValue(configs, "Cooldown", 1) : 1,
              GlobalSound: configs
                ? getBoolValue(configs, "GlobalEmission", false)
                : false,
              Uses: oneTime ? 1 : 0,
            }
          );

          createTouchConfiguration(dom, emitterConfig, {
            balloon: configs
              ? getBoolValue(configs, "SupportBalloons", false)
              : false,
            player: configs
              ? getBoolValue(configs, "SupportPlayers", true)
              : true,
            pushbox: configs
              ? getBoolValue(configs, "SupportPushboxes", false)
              : false,
            turret: configs
              ? getBoolValue(configs, "SupportTurrets", false)
              : false,
          });

          if (configs) configs.Destroy();
        }
      }
    }

    // ------------------------------------------------------------------------
    // LEGACY SCRIPTS
    // ------------------------------------------------------------------------
    else if (object.IsA("Script")) {
      if (object.Name === "Move" && object.Parent === clientSidedObjects) {
        object.Destroy();
      }
    }

    // Generic cleanup for lingering v5.5 ValueBase markers on any remaining object
    if (!object.IsDestroyed) {
      if (object.FindFirstChild("Invisible")) {
        object.FindFirstChild("Invisible")?.Destroy();
        object.AddTag("Invisible");
      }
      destroyChildrenByName(object, [
        "ColorSpecific",
        "SupportPlayers",
        "SupportPushboxes",
      ]);
    }
  }

  // Finalize KeyGroup names
  for (const inst of clientSidedObjects.GetDescendants()) {
    if (!inst.IsDestroyed && inst.HasTag("KeyGroupProcessLater")) {
      inst.RemoveTag("KeyGroupProcessLater");
      inst.Name = "KeyGroup";
    }
  }

  return clientSidedObjects;
}

// ============================================================================
// STEP 2: EToH v6.0.x -> v6.1.3 Incremental Migrations
// ============================================================================

const HITBOX_MODE_OVERRIDES: Record<string, string> = {
  BouncePadConfiguration: "WholeBody",
  AttacherConfiguration: "WholeBody",
};

const CHANGER_TAG =
  "-- DON'T TOUCH THE LINES ABOVE -- -- PLEASE IGNORE THE LINES ABOVE -- -- DON'T TOUCH THE LINES ABOVE -- -- PLEASE IGNORE THE LINES ABOVE --";
const CHANGER_REPLACE = `--!strict
local _C = require(game:GetService("ReplicatedStorage").Framework.Kit.Repository.Interactables.PropertyChanger.TypeDefs)
local script, workspace, Workspace, game, Game, shared, _G, wait, task, spawn, delay, Spawn, Delay, Wait, require, Instance
local Toucher, Tagged, TagFromSequenceVariable, Changer, Character = _C.Toucher, _C.Tagged, _C.TagFromSequenceVariable, _C.Changer, _C.Character\n${CHANGER_TAG}\n`;

/**
 * Default configuration attributes introduced across v6.0.1 -> v6.1.3.
 * Reconciles missing attributes on matching CO_* Configurations.
 */
const V613_CONFIG_DEFAULTS: Record<string, Record<string, any>> = {
  "CO_Visual/BeatBlock": {
    IndicatorScaleMultiplier: 1,
    ToggleChildren: false,
  },
  "CO_Mountables/Balloon": {
    JumpOnDismount: false,
  },
  "CO_Mountables/Vine": {
    JumpOnDismount: false,
  },
  "CO_Mountables/Zipline": {
    CurveMode: "Linear",
    JumpOnDismount: false,
    StartInCenter: false,
    UseWeld: false,
  },
  "CO_Interactables/Vanisher": {
    OutlineColor: { Color3: [1, 1, 1] },
    ShrinkToZero: false,
  },
  "CO_Interactables/PropertyChanger": {
    SilenceWarnings: false,
  },
  "CO_Visual/Emitter": {
    PitchRange: { NumberRange: [1, 1] },
  },
  "CO_Interactables/Dialog": {
    ManualAdvance: false,
  },
  "CO_Interactables/Attacher": {
    CleanDelay: 0,
  },
};

/**
 * Latest v6.1.3 repository version tags per CO_* tag.
 */
const V613_VERSION_TAGS: Record<string, string> = {
  "CO_DistanceCulling": "v6.1.3",
  "CO_Interactables/Attacher": "v6.1.3",
  "CO_Interactables/BoostPad": "v6.1.0",
  "CO_Interactables/BoostRemover": "v6.1.0",
  "CO_Interactables/Booster": "v6.1.3",
  "CO_Interactables/BouncePad": "v6.1.1",
  "CO_Interactables/Button": "v6.1.3",
  "CO_Interactables/ButtonDeactivator": "v6.1.0",
  "CO_Interactables/Dialog": "v6.1.3",
  "CO_Interactables/Dismounter": "v6.1.3",
  "CO_Interactables/GuiDisplayer": "v6.1.0",
  "CO_Interactables/KeyGroup": "v6.1.0",
  "CO_Interactables/Morpher": "v6.1.3",
  "CO_Interactables/MusicZoneEditor": "v6.1.2",
  "CO_Interactables/PropertyChanger": "v6.1.3",
  "CO_Interactables/PropertyChecker": "v6.1.1",
  "CO_Interactables/PushboxDestroyer": "v6.1.0",
  "CO_Interactables/PushboxSpawn": "v6.1.2",
  "CO_Interactables/Sequencer": "v6.1.1",
  "CO_Interactables/Teleporter": "v6.1.0",
  "CO_Interactables/TripPart": "v6.1.3",
  "CO_Interactables/Turret": "v6.1.3",
  "CO_Interactables/Vanisher": "v6.1.3",
  "CO_Mountables/Balloon": "v6.1.3",
  "CO_Mountables/Seat": "v6.1.1",
  "CO_Mountables/Vine": "v6.1.3",
  "CO_Mountables/Zipline": "v6.1.3",
  "CO_Physics/Conveyor": "v6.1.0",
  "CO_Physics/Elevator": "v6.1.0",
  "CO_Physics/FallingPlatform": "v6.1.0",
  "CO_Physics/MovingPlatform": "v6.1.0",
  "CO_Physics/PushingPlatformTrampoline": "v6.1.0",
  "CO_Visual/BeatBlock": "v6.1.3",
  "CO_Visual/Emitter": "v6.1.3",
  "CO_Visual/GradientPart": "v6.1.0",
  "CO_Visual/LightingChanger": "v6.1.3",
};

function migrateV6To613(dom: RbxDom, clientObjects: RbxInstance): void {
  // 1. v6.0.0 -> v6.0.1: Update PropertyChanger / PropertyChecker ModuleScript headers
  for (const inst of clientObjects.GetDescendants()) {
    if (!inst.IsA("Configuration")) continue;

    if (
      inst.Name === "PropertyCheckerConfiguration" ||
      inst.Name === "PropertyChangerConfiguration"
    ) {
      if (inst.Name === "PropertyCheckerConfiguration") {
        if (inst.GetAttribute("ConditionalYieldSequence") === undefined) {
          inst.SetAttribute("ConditionalYieldSequence", false);
        }
        if (inst.GetAttribute("ConditionalBreakSequence") === undefined) {
          inst.SetAttribute("ConditionalBreakSequence", false);
        }
      }

      const propertiesScript = inst.FindFirstChild("Properties");
      if (propertiesScript && propertiesScript.ClassName === "ModuleScript") {
        const srcProp = propertiesScript.GetProperty("Source");
        const src =
          srcProp && typeof srcProp === "object" && "String" in srcProp
            ? String(srcProp.String)
            : "";

        const tagIndex = src.indexOf(CHANGER_TAG);
        if (tagIndex !== -1 && !src.includes("TagFromSequenceVariable")) {
          const body = src.slice(tagIndex + CHANGER_TAG.length).replace(/^\r?\n/, "");
          propertiesScript.SetProperty("Source", {
            String: CHANGER_REPLACE + body,
          });
        }
      }
    }
  }

  // 2. v6.1.0 & v6.1.1: Migrate HitboxMode onto TouchConfiguration & add collisionGroup
  for (const inst of clientObjects.GetDescendants()) {
    if (inst.IsA("Configuration") && inst.Name === "TouchConfiguration") {
      if (inst.GetAttribute("collisionGroup") === undefined) {
        inst.SetAttribute("collisionGroup", false);
      }

      if (inst.GetAttribute("playerHitboxMode") === undefined) {
        const parentConfig = inst.Parent;
        const legacyHitboxMode = parentConfig?.GetAttribute("HitboxMode");
        const overrideMode = parentConfig
          ? HITBOX_MODE_OVERRIDES[parentConfig.Name]
          : undefined;

        inst.SetAttribute(
          "playerHitboxMode",
          typeof legacyHitboxMode === "string"
            ? legacyHitboxMode
            : overrideMode ?? "StaticWholeBody"
        );
      }

      if (inst.Parent && inst.Parent.GetAttribute("HitboxMode") !== undefined) {
        inst.Parent.SetAttribute("HitboxMode", undefined);
      }
    }
  }

  // 3. v6.1.2: Update PushboxSpawn pushbox parts (anchor parts by default, tag pre-anchored as BoxAnchor)
  for (const inst of clientObjects.GetDescendants()) {
    if (
      inst.IsA("Configuration") &&
      inst.HasTag("CO_Interactables/PushboxSpawn")
    ) {
      const spawner = inst.Parent;
      const pushbox = spawner?.FindFirstChild("Pushbox");
      if (pushbox && pushbox.IsA("Model")) {
        for (const part of pushbox.GetDescendants()) {
          if (!part.IsA("BasePart")) continue;
          const anchoredProp = part.GetProperty("Anchored");
          const isAnchored =
            anchoredProp &&
            typeof anchoredProp === "object" &&
            "Bool" in anchoredProp
              ? Boolean(anchoredProp.Bool)
              : false;

          if (isAnchored) {
            part.AddTag("BoxAnchor");
          } else {
            part.SetProperty("Anchored", { Bool: true });
          }
        }
      }
    }
  }

  // 4. Reconcile new v6.1.x attributes and update version tags to v6.1.3
  for (const inst of clientObjects.GetDescendants()) {
    for (const tag of inst.GetTags()) {
      if (!tag.startsWith("CO_")) continue;

      // Reconcile missing default attributes for this CO type
      const defaults = V613_CONFIG_DEFAULTS[tag];
      if (defaults && inst.IsA("Configuration")) {
        for (const [attr, defaultVal] of Object.entries(defaults)) {
          if (inst.GetAttribute(attr) === undefined) {
            inst.SetAttribute(attr, defaultVal);
          }
        }
      }

      // Replace old v6.x.y version tag with the latest v6.1.3 repository version tag
      const targetVersionTag = V613_VERSION_TAGS[tag];
      if (targetVersionTag) {
        for (const existingTag of inst.GetTags()) {
          if (/^v\d+\.\d+\.\d+$/.test(existingTag)) {
            inst.RemoveTag(existingTag);
          }
        }
        inst.AddTag(targetVersionTag);
      }
    }
  }

  // 5. Stamp final KitVersion to 6.1.3
  clientObjects.SetAttribute("KitVersion", "6.1.3");
}

// ============================================================================
// PUBLIC CONVERTER ENTRYPOINTS
// ============================================================================

/**
 * Upgrades an EToH v6.0.0 - v6.1.2 document to EToH v6.1.3.
 */
export function upgradeV6To613Document(document: RbxDocument): RbxDocument {
  const dom = openDom(document);
  const clientSidedObjects = dom.FindFirstChild("ClientSidedObjects", true);
  if (clientSidedObjects) {
    migrateV6To613(dom, clientSidedObjects);
  }
  return dom.toDocument();
}

/**
 * Converts a JToH v5.5 document into an EToH v6.1.3 document.
 */
export function convertJtoh55ToV6(document: RbxDocument): RbxDocument {
  const dom = openDom(document);
  const clientSidedObjects = upgrade55To602(dom);
  if (clientSidedObjects) {
    migrateV6To613(dom, clientSidedObjects);
  }
  return dom.toDocument();
}
