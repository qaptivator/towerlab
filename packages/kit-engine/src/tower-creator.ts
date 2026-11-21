import type { RbxDocument } from "@towerlab/dom-schema";
import { openDom, type RbxDom, type RbxInstance } from "./dom";
import { upgradeV6To613Document } from "./etoh-v613";

/**
 * Tower Creator to EToH v6.0.2, then the shared v6.0.x to v6.1.3 patch.
 * Objects with no v6 equivalent are kept and named in the warnings list.
 */

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

const ENUM_PART_TYPE = {
  Ball: 0,
  Block: 1,
  Cylinder: 2,
  Wedge: 3,
  CornerWedge: 4,
};

const IDENTITY_CFRAME = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1];

function decodeBase64(b64: string): string {
  if (!b64) return "";
  try {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    // Fallback if invalid base64
  }
  return b64;
}

function getTcStringAttr(
  inst: RbxInstance,
  attrName: string,
  fallback = ""
): string {
  const raw = inst.GetAttribute(attrName);
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    if ("BinaryString" in raw) {
      return decodeBase64(String(raw.BinaryString));
    }
    if ("String" in raw) {
      return String(raw.String);
    }
  }
  return fallback;
}

function getTcNumberAttr(
  inst: RbxInstance,
  attrName: string,
  fallback: number
): number {
  const raw = inst.GetAttribute(attrName);
  if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
  if (raw && typeof raw === "object") {
    if ("Float64" in raw) return Number(raw.Float64);
    if ("Float32" in raw) return Number(raw.Float32);
    if ("Int32" in raw) return Number(raw.Int32);
    if ("Int64" in raw) return Number(raw.Int64);
  }
  return fallback;
}

function getTcBoolAttr(
  inst: RbxInstance,
  attrName: string,
  fallback: boolean
): boolean {
  const raw = inst.GetAttribute(attrName);
  if (typeof raw === "boolean") return raw;
  if (raw && typeof raw === "object" && "Bool" in raw) {
    return Boolean(raw.Bool);
  }
  return fallback;
}

function getTcVector3Attr(
  inst: RbxInstance,
  attrName: string,
  fallback: [number, number, number] = [0, 0, 0]
): [number, number, number] {
  const raw = inst.GetAttribute(attrName);
  if (raw && typeof raw === "object" && "Vector3" in raw) {
    return raw.Vector3 as [number, number, number];
  }
  return fallback;
}

function parseEasingStyle(name: string): number {
  const key = name as keyof typeof ENUM_EASING_STYLE;
  return ENUM_EASING_STYLE[key] ?? ENUM_EASING_STYLE.Quad;
}

function parseEasingDirection(name: string): number {
  const key = name as keyof typeof ENUM_EASING_DIRECTION;
  return ENUM_EASING_DIRECTION[key] ?? ENUM_EASING_DIRECTION.Out;
}

function extractCFrameComponents(inst: RbxInstance): {
  pos: [number, number, number];
  rot: [
    [number, number, number],
    [number, number, number],
    [number, number, number]
  ];
} {
  const cfProp = inst.GetProperty("CFrame");
  if (cfProp && typeof cfProp === "object" && "CFrame" in cfProp) {
    const cf = cfProp.CFrame as any;
    if (Array.isArray(cf) && cf.length >= 12) {
      return {
        pos: [cf[0], cf[1], cf[2]],
        rot: [
          [cf[3], cf[4], cf[5]],
          [cf[6], cf[7], cf[8]],
          [cf[9], cf[10], cf[11]],
        ],
      };
    }
    if (cf && typeof cf === "object" && Array.isArray(cf.position)) {
      return {
        pos: cf.position as [number, number, number],
        rot: (cf.orientation as [
          [number, number, number],
          [number, number, number],
          [number, number, number]
        ]) ?? [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ],
      };
    }
  }
  return {
    pos: [0, 0, 0],
    rot: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
  };
}

function getRefTargets(dom: RbxDom, parent: RbxInstance): RbxInstance[] {
  const results: RbxInstance[] = [];
  for (const child of parent.GetChildren()) {
    if (child.ClassName === "ObjectValue") {
      const val = child.GetProperty("Value");
      if (val && typeof val === "object" && "Ref" in val) {
        const refId = String(val.Ref);
        if (refId && refId !== "00000000000000000000000000000000") {
          const target = dom.Get(refId);
          if (target && !target.IsDestroyed) {
            results.push(target);
          }
        }
      }
    }
  }
  return results;
}

function getSingleRefTarget(
  dom: RbxDom,
  parent: RbxInstance,
  childName: string
): RbxInstance | undefined {
  const child = parent.FindFirstChild(childName);
  if (!child || child.ClassName !== "ObjectValue") return undefined;
  const val = child.GetProperty("Value");
  if (val && typeof val === "object" && "Ref" in val) {
    const refId = String(val.Ref);
    if (refId && refId !== "00000000000000000000000000000000") {
      const target = dom.Get(refId);
      if (target && !target.IsDestroyed) return target;
    }
  }
  return undefined;
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

function purgeTcBoilerplate(object: RbxInstance): void {
  const handler = object.FindFirstChild("ClientObjectHandler");
  if (handler) handler.Destroy();

  const fnModel = object.FindFirstChild("FunctionModel");
  if (fnModel) fnModel.Destroy();

  const pressed = object.FindFirstChild("Pressed");
  if (pressed) pressed.Destroy();

  for (const child of object.GetChildren()) {
    if (child.ClassName === "BindableEvent" && child.Name === "Event") {
      child.Destroy();
    }
  }

  for (const tag of ["ClientObject", "NoBehaviors", "IgnoreCloning", "Unremovable", "Attachment"]) {
    if (object.HasTag(tag)) {
      object.RemoveTag(tag);
    }
  }
}

function convertTcTouchConfig(
  dom: RbxDom,
  sourceObj: RbxInstance,
  targetParentConfig: RbxInstance,
  defaults: {
    balloon?: boolean;
    canFlip?: boolean;
    colorSpecific?: boolean;
    player?: boolean;
    pushbox?: boolean;
    turret?: boolean;
  } = {}
): RbxInstance {
  const tcTouch = sourceObj.FindFirstChild("TouchConfiguration");
  const config = createTouchConfiguration(dom, targetParentConfig, {
    balloon: tcTouch
      ? getTcBoolAttr(tcTouch, "AllowBalloons", defaults.balloon ?? false)
      : defaults.balloon ?? false,
    canFlip: defaults.canFlip ?? false,
    colorSpecific: defaults.colorSpecific ?? false,
    player: tcTouch
      ? getTcBoolAttr(tcTouch, "AllowPlayers", defaults.player ?? true)
      : defaults.player ?? true,
    pushbox: tcTouch
      ? getTcBoolAttr(tcTouch, "AllowPushboxes", defaults.pushbox ?? true)
      : defaults.pushbox ?? true,
    turret: tcTouch
      ? getTcBoolAttr(tcTouch, "AllowBullets", defaults.turret ?? false)
      : defaults.turret ?? false,
  });

  if (tcTouch) tcTouch.Destroy();
  return config;
}

function clearTcAttributes(inst: RbxInstance): void {
  const attrs = inst.GetAttributes?.();
  if (attrs && typeof attrs === "object") {
    for (const key of Object.keys(attrs)) {
      inst.SetAttribute(key, undefined);
    }
  }
}

function convertTowerCreatorTo602(
  dom: RbxDom,
  warnings: string[]
): RbxInstance | undefined {
  const clientParts = dom.FindFirstChild("ClientParts", true);
  if (!clientParts || !clientParts.Parent) {
    return undefined;
  }

  const towerRoot = clientParts.Parent;
  const currentName = towerRoot.Name;
  if (!towerRoot.GetAttribute("OriginalName")) {
    towerRoot.SetAttribute("OriginalName", currentName);
  }
  towerRoot.Name = "TowerKit";

  // Rename ClientParts -> ClientSidedObjects
  clientParts.Name = "ClientSidedObjects";
  clientParts.SetAttribute("KitVersion", "6.0.2");

  // Setup DistanceCulling folder & configuration
  let distanceCulling = clientParts.FindFirstChild("DistanceCulling");
  if (!distanceCulling) {
    distanceCulling = dom.Create("Folder", "DistanceCulling");
    distanceCulling.Parent = clientParts;

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

  // Group linked ButtonActivated parts by color/button so EToH v6 Buttons can drive them
  let buttonPlatformsFolder = clientParts.FindFirstChild("ButtonPlatforms");
  if (!buttonPlatformsFolder) {
    buttonPlatformsFolder = dom.Create("Folder", "ButtonPlatforms");
    buttonPlatformsFolder.Parent = clientParts;
  }

  // Clean up TC attributes on static geometry outside ClientSidedObjects
  for (const inst of towerRoot.GetDescendants()) {
    if (inst.IsDestroyed) continue;
    const originName = getTcStringAttr(inst, "OriginName");
    if (originName) {
      inst.Name = originName;
    }
    // Strip TC metadata attributes from static parts/meshes
    if (!inst.IsDescendantOf(clientParts) && inst !== clientParts) {
      inst.SetAttribute("FunctionClass", undefined);
      inst.SetAttribute("OriginName", undefined);
      inst.SetAttribute("Class", undefined);
    }
  }

  // Snapshot descendants of ClientSidedObjects before mutating hierarchy
  const objects = [...clientParts.GetChildren()];

  for (const object of objects) {
    if (object.IsDestroyed) continue;
    if (object.Id === distanceCulling.Id || object.Id === buttonPlatformsFolder.Id) continue;

    const originName = getTcStringAttr(object, "OriginName", object.Name);
    const functionClass = getTcStringAttr(object, "FunctionClass", "");
    const objectType = originName || object.Name;

    // ------------------------------------------------------------------------
    // 1. BUTTONS & BUTTON-ACTIVATED PARTS
    // ------------------------------------------------------------------------
    if (objectType === "Button" || functionClass === "Button") {
      const timer = getTcNumberAttr(object, "Timer", 0);
      const invert = getTcBoolAttr(object, "Invert", false);
      const hideGui = !getTcBoolAttr(object, "ScreenTimerVisibility", true);
      const integerTimer = getTcBoolAttr(object, "IntegerTimer", false);
      const fullHide = getTcBoolAttr(object, "FullyHide", false);
      const linkedTargets = getRefTargets(dom, object);

      purgeTcBoilerplate(object);

      // Wrap part into an EToH v6 Button Model
      const parent = object.Parent ?? clientParts;
      const btnModel = dom.Create("Model", "Button");
      btnModel.Parent = parent;

      object.Name = "Part";
      object.Parent = btnModel;
      clearTcAttributes(object);

      // Remove TC ModelLink ObjectValues
      for (const child of object.GetChildren()) {
        if (child.ClassName === "ObjectValue") child.Destroy();
      }

      const btnConfig = createConfiguration(
        dom,
        btnModel,
        "ButtonConfiguration",
        ["CO_Interactables/Button", "v6.0.0"],
        {
          ColorSpecific: false,
          Debounce: 0.5,
          HideGUI: hideGui,
          Invert: invert,
          PadMode: false,
          Timer: timer,
          TimerDecimalPlaces: integerTimer ? 0 : 1,
          TimerText: "{T}",
        }
      );

      convertTcTouchConfig(dom, object, btnConfig, {
        balloon: false,
        player: true,
        pushbox: false,
        turret: false,
      });
      createTweenConfiguration(dom, btnConfig, "PressTweenConfiguration", 0.25);

      // Tag linked targets as ButtonActivated and match button color
      const btnColor = object.GetProperty("Color") ?? object.GetProperty("Color3uint8");
      for (const target of linkedTargets) {
        if (target.IsA("BasePart")) {
          target.AddTag("ButtonActivated");
          if (fullHide) target.AddTag("FullHide");
          if (btnColor) {
            target.SetProperty("Color", btnColor);
          }
          target.Parent = buttonPlatformsFolder;
        } else if (target.IsA("Model") || target.IsA("Folder")) {
          for (const desc of target.GetDescendants()) {
            if (desc.IsA("BasePart")) {
              desc.AddTag("ButtonActivated");
              if (fullHide) desc.AddTag("FullHide");
              if (btnColor) desc.SetProperty("Color", btnColor);
            }
          }
          target.Parent = buttonPlatformsFolder;
        }
      }
    }

    // ------------------------------------------------------------------------
    // 2. BUTTON DEACTIVATOR
    // ------------------------------------------------------------------------
    else if (objectType === "ButtonDeactivator") {
      purgeTcBoilerplate(object);
      object.Name = "ButtonDeactivator";

      const btnConfig = createConfiguration(
        dom,
        object,
        "ButtonConfiguration",
        ["CO_Interactables/ButtonDeactivator", "v6.0.0"],
        {
          ColorSpecific: false,
        }
      );

      convertTcTouchConfig(dom, object, btnConfig, {
        player: true,
        pushbox: false,
      });
      clearTcAttributes(object);
    }

    // ------------------------------------------------------------------------
    // 3. MORPHER BUTTON -> EToH v6 MORPHER
    // ------------------------------------------------------------------------
    else if (objectType === "Morpher Button") {
      const timer = getTcNumberAttr(object, "Timer", 5);
      const carryObjects = getTcBoolAttr(object, "CarryObjects", true);
      const integerTimer = getTcBoolAttr(object, "IntegerTimer", false);
      const hideGui = !getTcBoolAttr(object, "ScreenTimerVisibility", true);
      const timerText = getTcStringAttr(object, "TimerText", "{T}");
      const morphTime = getTcNumberAttr(object, "MorphTime", 1);
      const returnTime = getTcNumberAttr(object, "ReturnTime", 1);
      const morphStyle = parseEasingStyle(
        getTcStringAttr(object, "ENUM_MorphEaseStyle", "Quad")
      );
      const morphDir = parseEasingDirection(
        getTcStringAttr(object, "ENUM_MorphEaseDirection", "Out")
      );
      const returnStyle = parseEasingStyle(
        getTcStringAttr(object, "ENUM_ReturnEaseStyle", "Quad")
      );
      const returnDir = parseEasingDirection(
        getTcStringAttr(object, "ENUM_ReturnEaseDirection", "Out")
      );

      const morphPart = getSingleRefTarget(dom, object, "Morph Part");
      const targetPart = getSingleRefTarget(dom, object, "ModelLink");

      purgeTcBoilerplate(object);

      const morpherModel = dom.Create("Model", "Morpher");
      morpherModel.Parent = clientParts;

      object.Name = "Button";
      object.Parent = morpherModel;
      clearTcAttributes(object);

      for (const child of object.GetChildren()) {
        if (child.ClassName === "ObjectValue") child.Destroy();
      }

      const btnConfig = createConfiguration(
        dom,
        object,
        "MorpherButtonConfiguration",
        [],
        {
          CarryObjects: carryObjects,
          HideGUI: hideGui,
          Timer: timer,
          TimerDecimalPlaces: integerTimer ? 0 : 1,
          TimerText: timerText,
        }
      );

      convertTcTouchConfig(dom, object, btnConfig, {
        player: true,
        pushbox: false,
      });
      createTweenConfiguration(
        dom,
        btnConfig,
        "MoveTweenConfiguration",
        morphTime,
        morphStyle,
        morphDir
      );
      createTweenConfiguration(
        dom,
        btnConfig,
        "ReturnTweenConfiguration",
        returnTime,
        returnStyle,
        returnDir
      );

      const pressSound = object.FindFirstChild("Press");
      const tickSound = object.FindFirstChild("Tick");
      if (pressSound) pressSound.Parent = btnConfig;
      if (tickSound) tickSound.Parent = btnConfig;

      if (morphPart) {
        morphPart.Name = "Morph";
        morphPart.Parent = morpherModel;
      }
      if (targetPart) {
        targetPart.Name = "Target";
        targetPart.Parent = morpherModel;
      }

      createConfiguration(
        dom,
        morpherModel,
        "MorpherConfiguration",
        ["CO_Interactables/Morpher", "v6.0.0"],
        {}
      );
    }

    // ------------------------------------------------------------------------
    // 4. TELEPORTER
    // ------------------------------------------------------------------------
    else if (objectType === "Teleporter" || functionClass === "Teleporter") {
      const moveTime = getTcNumberAttr(object, "MoveTime", 0);
      const seamless = getTcBoolAttr(object, "SeamlessTeleport", false);
      const easeStyle = parseEasingStyle(
        getTcStringAttr(object, "ENUM_EaseStyle", "Linear")
      );
      const easeDir = parseEasingDirection(
        getTcStringAttr(object, "ENUM_EaseDirection", "Out")
      );
      const destination = getSingleRefTarget(dom, object, "ModelLink");

      purgeTcBoilerplate(object);

      const tpModel = dom.Create("Model", "Teleporter");
      tpModel.Parent = clientParts;

      object.Name = "Teleporter";
      object.Parent = tpModel;
      clearTcAttributes(object);

      for (const child of object.GetChildren()) {
        if (child.ClassName === "ObjectValue") child.Destroy();
      }

      if (destination) {
        destination.Name = "Destination";
        destination.Parent = tpModel;
        purgeTcBoilerplate(destination);
        clearTcAttributes(destination);
        createStudioDirectionCone(dom, destination, "UpDirection", {
          color: [0, 1, 0],
          transparency: 0.25,
          offset: [0, 1, 0],
        });
        createStudioDirectionCone(dom, destination, "LookDirection", {
          color: [1, 1, 1],
          transparency: 0.25,
          offset: [0, 0, -1],
        });
      }

      const tpConfig = createConfiguration(
        dom,
        tpModel,
        "TeleporterConfiguration",
        ["CO_Interactables/Teleporter", "v6.0.0"],
        {
          DisableCollision: false,
          Instant: moveTime === 0,
          KeepVelocity: false,
          Offset: { CFrame: IDENTITY_CFRAME },
          SeamlessTeleport: seamless,
        }
      );

      convertTcTouchConfig(dom, object, tpConfig, {
        player: true,
        pushbox: false,
      });
      createTweenConfiguration(
        dom,
        tpConfig,
        "TweenConfiguration",
        moveTime,
        easeStyle,
        easeDir
      );
    }

    // ------------------------------------------------------------------------
    // 5. BALLOON DISPENSER
    // ------------------------------------------------------------------------
    else if (objectType === "BalloonDispenser") {
      const allowJumpDismount = getTcBoolAttr(object, "AllowJumpDismount", true);
      const destroyWhenExpired = getTcBoolAttr(object, "DestroyWhenExpired", true);
      const handleAnim = getTcBoolAttr(object, "HandleAnimation", true);
      const jumpOnDismount = getTcBoolAttr(object, "JumpOnDismount", false);
      const keepMomentum = getTcBoolAttr(object, "KeepMomentum", true);
      const maxHeight = getTcNumberAttr(object, "MaxHeight", 50);
      const ropeLength = getTcNumberAttr(object, "RopeLength", 8);
      const speed = getTcNumberAttr(object, "Speed", 20);
      const timer = getTcNumberAttr(object, "Timer", 5);
      const tweenTime = getTcNumberAttr(object, "TweenTime", 1);
      const easeStyle = parseEasingStyle(
        getTcStringAttr(object, "ENUM_EaseStyle", "Linear")
      );
      const easeDir = parseEasingDirection(
        getTcStringAttr(object, "ENUM_EaseDirection", "Out")
      );

      purgeTcBoilerplate(object);

      const balloonModel = dom.Create("Model", "BalloonDispenser");
      balloonModel.Parent = clientParts;

      const soundsFolder = dom.Create("Folder", "Sounds");
      soundsFolder.Parent = balloonModel;

      for (const sndName of ["Inflate", "Pop", "TimerTick"]) {
        const snd = object.FindFirstChild(sndName);
        if (snd) snd.Parent = soundsFolder;
      }

      const timerGui = object.FindFirstChild("TemplateTimerGui");
      if (timerGui) timerGui.Destroy();

      object.Name = "Dispenser";
      object.Parent = balloonModel;
      clearTcAttributes(object);

      const balloonConfig = createConfiguration(
        dom,
        balloonModel,
        "BalloonConfiguration",
        ["CO_Mountables/Balloon", "v6.0.1"],
        {
          AllowJumpDismount: allowJumpDismount,
          DestroyWhenExpired: destroyWhenExpired,
          HandleAnimation: handleAnim,
          JumpOnDismount: jumpOnDismount,
          KeepMomentum: keepMomentum,
          MaxHeight: maxHeight,
          RopeLength: ropeLength,
          Speed: speed,
          Timer: timer,
        }
      );

      convertTcTouchConfig(dom, object, balloonConfig, {
        player: true,
        pushbox: true,
      });
      createTweenConfiguration(
        dom,
        balloonConfig,
        "TweenConfiguration",
        tweenTime,
        easeStyle,
        easeDir
      );
    }

    // ------------------------------------------------------------------------
    // 6. BALLOON DESTROYER -> DISMOUNTER
    // ------------------------------------------------------------------------
    else if (objectType === "BalloonDestroyer") {
      purgeTcBoilerplate(object);
      object.Name = "Dismounter";
      clearTcAttributes(object);

      const dismounterConfig = createConfiguration(
        dom,
        object,
        "DismounterConfiguration",
        ["CO_Interactables/Dismounter", "v6.0.1"],
        {
          Cooldown: 0,
          DismountAttachers: false,
          DismountBalloons: true,
          DismountSeats: false,
          DismountSwings: false,
          DismountVines: false,
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
    }

    // ------------------------------------------------------------------------
    // 7. VINE & SWING
    // ------------------------------------------------------------------------
    else if (objectType === "Vine") {
      const allowJumpDismount = getTcBoolAttr(object, "AllowJumpDismount", true);
      const handleAnim = getTcBoolAttr(object, "HandleAnimation", true);
      const jumpOnDismount = getTcBoolAttr(object, "JumpOnDismount", false);
      const keepMomentum = getTcBoolAttr(object, "KeepMomentum", true);
      const respawnTime = getTcNumberAttr(object, "RespawnTime", 3);
      const tweenTime = getTcNumberAttr(object, "TweenTime", 0.5);
      const easeStyle = parseEasingStyle(
        getTcStringAttr(object, "ENUM_EaseStyle", "Linear")
      );
      const easeDir = parseEasingDirection(
        getTcStringAttr(object, "ENUM_EaseDirection", "Out")
      );

      purgeTcBoilerplate(object);
      object.Name = "Vine";

      const sounds = dom.Create("Folder", "Sounds");
      sounds.Parent = object;
      const grab = object.FindFirstChild("GrabSound");
      const jump = object.FindFirstChild("JumpSound");
      if (grab) {
        grab.Name = "Grab";
        grab.Parent = sounds;
      }
      if (jump) {
        jump.Name = "Jump";
        jump.Parent = sounds;
      }

      const vineConfig = createConfiguration(
        dom,
        object,
        "VineConfiguration",
        ["CO_Mountables/Vine", "v6.0.1"],
        {
          AllowJumpDismount: allowJumpDismount,
          HandleAnimation: handleAnim,
          JumpOnDismount: jumpOnDismount,
          KeepMomentum: keepMomentum,
          RespawnTime: respawnTime,
        }
      );

      convertTcTouchConfig(dom, object, vineConfig, {
        player: true,
        pushbox: true,
      });
      createTweenConfiguration(
        dom,
        vineConfig,
        "TweenConfiguration",
        tweenTime,
        easeStyle,
        easeDir
      );
      clearTcAttributes(object);
    } else if (objectType === "Swing") {
      // Tower Creator Swing maps to EToH v6 Vine (or Swing)
      const allowJumpDismount = getTcBoolAttr(object, "AllowJumpDismount", true);
      const handleAnim = getTcBoolAttr(object, "HandleAnimation", true);
      const jumpOnDismount = getTcBoolAttr(object, "JumpOnDismount", false);
      const keepMomentum = getTcBoolAttr(object, "KeepMomentum", true);

      purgeTcBoilerplate(object);
      const ctrlConfig = object.FindFirstChild("ControlConfiguration");
      if (ctrlConfig) ctrlConfig.Destroy();

      object.Name = "Vine";
      const top = object.FindFirstChild("Top");
      if (top) {
        top.Name = "AttachmentPart";
        const swingAtt = top.FindFirstChild("SwingAttachment");
        if (swingAtt) swingAtt.Name = "VineAttachment";
      }
      const handle = object.FindFirstChild("Handle");
      if (handle) {
        handle.Name = "VinePart";
      }

      const sounds = dom.Create("Folder", "Sounds");
      sounds.Parent = object;
      const grab = object.FindFirstChild("GrabSound");
      const jump = object.FindFirstChild("JumpSound");
      if (grab) {
        grab.Name = "Grab";
        grab.Parent = sounds;
      }
      if (jump) {
        jump.Name = "Jump";
        jump.Parent = sounds;
      }

      const vineConfig = createConfiguration(
        dom,
        object,
        "VineConfiguration",
        ["CO_Mountables/Vine", "v6.0.1"],
        {
          AllowJumpDismount: allowJumpDismount,
          HandleAnimation: handleAnim,
          JumpOnDismount: jumpOnDismount,
          KeepMomentum: keepMomentum,
          RespawnTime: 0,
        }
      );

      convertTcTouchConfig(dom, object, vineConfig, {
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
      clearTcAttributes(object);
    }

    // ------------------------------------------------------------------------
    // 8. ZIPLINE
    // ------------------------------------------------------------------------
    else if (objectType === "Zipline") {
      const allowEndDismount = getTcBoolAttr(object, "AllowEndDismount", true);
      const allowJumpDismount = getTcBoolAttr(object, "AllowJumpDismount", true);
      const allowUserControl = getTcBoolAttr(object, "AllowUserControl", false);
      const handleAnim = getTcBoolAttr(object, "HandleAnimation", true);
      const jumpOnDismount = getTcBoolAttr(object, "JumpOnDismount", false);
      const keepMomentum = getTcBoolAttr(object, "KeepMomentum", true);
      const loop = getTcBoolAttr(object, "Loop", false);
      const ropeLength = getTcNumberAttr(object, "RopeLength", 5);
      const segments = getTcNumberAttr(object, "Segments", 20);
      const speed = getTcNumberAttr(object, "Speed", 30);
      const startInCenter = getTcBoolAttr(object, "StartInCenter", false);
      const useWeld = getTcBoolAttr(object, "UseWeld", false);

      purgeTcBoilerplate(object);

      const zipModel = dom.Create("Model", "Zipline");
      zipModel.Parent = clientParts;

      const sounds = dom.Create("Folder", "Sounds");
      sounds.Parent = zipModel;
      for (const sndName of ["GrabSound", "JumpSound", "MoveSound"]) {
        const snd = object.FindFirstChild(sndName);
        if (snd) {
          snd.Name = sndName.replace("Sound", "");
          snd.Parent = sounds;
        }
      }

      const tcSegments = object.FindFirstChild("Segments");
      const points = dom.Create("Folder", "Points");
      points.Parent = zipModel;
      if (tcSegments) {
        for (const seg of tcSegments.GetChildren()) {
          seg.Parent = points;
        }
        tcSegments.Destroy();
      }

      object.Name = "MountPart";
      object.Parent = zipModel;
      clearTcAttributes(object);

      const zipConfig = createConfiguration(
        dom,
        zipModel,
        "ZiplineConfiguration",
        ["CO_Mountables/Zipline", "v6.0.1"],
        {
          AllowEndDismount: allowEndDismount,
          AllowJumpDismount: allowJumpDismount,
          AllowUserControl: allowUserControl,
          CurveMode: "Linear",
          GuideColor: { Color3: [1, 1, 0] },
          HandleAnimation: handleAnim,
          JumpOnDismount: jumpOnDismount,
          KeepMomentum: keepMomentum,
          Loop: loop,
          RopeLength: ropeLength,
          Segments: segments,
          SegmentShape: "Cylinder",
          SegmentWidth: 0.25,
          Speed: speed,
          StartInCenter: startInCenter,
          UseWeld: useWeld,
        }
      );

      convertTcTouchConfig(dom, object, zipConfig, {
        player: true,
        pushbox: true,
      });
    }

    // ------------------------------------------------------------------------
    // 9. SEAT PART
    // ------------------------------------------------------------------------
    else if (objectType === "SeatPart") {
      const sitCooldown = getTcNumberAttr(object, "SitCooldown", 1);
      purgeTcBoilerplate(object);
      object.Name = "Seat";
      clearTcAttributes(object);

      createStudioDirectionCone(dom, object, "Visual");

      const seatConfig = createConfiguration(
        dom,
        object,
        "SeatConfiguration",
        ["CO_Mountables/Seat", "v6.0.1"],
        {
          Cooldown: sitCooldown,
          SitOffset: { CFrame: IDENTITY_CFRAME },
        }
      );

      createTouchConfiguration(dom, seatConfig, {
        player: true,
        pushbox: true,
      });
    }

    // ------------------------------------------------------------------------
    // 10. TRIP PART
    // ------------------------------------------------------------------------
    else if (objectType === "Trip") {
      purgeTcBoilerplate(object);
      object.Name = "TripPart";
      clearTcAttributes(object);

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
    }

    // ------------------------------------------------------------------------
    // 11. CONVEYOR
    // ------------------------------------------------------------------------
    else if (objectType === "Conveyor") {
      const speed = getTcNumberAttr(object, "ConveyorSpeed", 15);
      purgeTcBoilerplate(object);
      object.Name = "Conveyor";
      clearTcAttributes(object);

      createStudioDirectionCone(dom, object, "Visual", {
        offset: [0, 0, -1],
      });

      createConfiguration(
        dom,
        object,
        "ConveyorConfiguration",
        ["CO_Physics/Conveyor", "v6.0.0"],
        {
          Speed: speed,
        }
      );
    }

    // ------------------------------------------------------------------------
    // 12. JUMP LAUNCHER -> BOUNCE PAD
    // ------------------------------------------------------------------------
    else if (objectType === "JumpLauncher") {
      const cooldown = getTcNumberAttr(object, "Cooldown", 0.5);
      const force = getTcNumberAttr(object, "Force", 60);
      const followFront = getTcBoolAttr(object, "FollowFront", false);

      purgeTcBoilerplate(object);
      object.Name = "BouncePad";
      clearTcAttributes(object);

      const bounceConfig = createConfiguration(
        dom,
        object,
        "BouncePadConfiguration",
        ["CO_Interactables/BouncePad", "v6.0.1"],
        {
          Cooldown: cooldown,
          Power: force,
          RelativeForce: followFront,
        }
      );

      const bounceSound = object.FindFirstChild("Bounce");
      if (bounceSound) {
        bounceSound.Name = "BounceSound";
        bounceSound.Parent = bounceConfig;
      }

      convertTcTouchConfig(dom, object, bounceConfig, {
        player: true,
        pushbox: true,
      });
      createTweenConfiguration(dom, bounceConfig, "TweenConfiguration", 1);
    }

    // ------------------------------------------------------------------------
    // 13. JUMP CHANGER & SPEED CHANGER -> BOOSTER / BOOST PAD
    // ------------------------------------------------------------------------
    else if (objectType === "Jump Changer" || objectType === "Speed Changer") {
      const isJump = objectType === "Jump Changer";
      const duration = getTcNumberAttr(object, "BoostLength", 5);
      const distance = getTcNumberAttr(object, "Distance", 0);
      const hideGui = getTcBoolAttr(object, "HideGUI", false);
      const power = getTcNumberAttr(
        object,
        isJump ? "JumpPower" : "WalkSpeed",
        isJump ? 75 : 32
      );

      purgeTcBoilerplate(object);
      clearTcAttributes(object);

      if (distance > 0) {
        object.Name = isJump ? "Jump BoostPad" : "Speed BoostPad";
        const padConfig = createConfiguration(
          dom,
          object,
          "BoostPadConfiguration",
          ["CO_Interactables/BoostPad", "v6.0.0"],
          {
            Distance: distance,
            Power: power,
            Type: isJump ? "Jump" : "Speed",
          }
        );
        createTouchConfiguration(dom, padConfig, {
          player: true,
          pushbox: true,
        });
      } else {
        object.Name = "Booster";
        const attrs: Record<string, any> = {
          Duration: duration,
          HideGUI: hideGui,
          Mode: "Default",
          Power: power,
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
      }
    }

    // ------------------------------------------------------------------------
    // 14. TURRET
    // ------------------------------------------------------------------------
    else if (objectType === "Turret") {
      const bulletSpeed = getTcNumberAttr(object, "BulletSpeed", 50);
      const destroyOnTouch = getTcBoolAttr(object, "DestroyOnTouch", true);
      const fireRate = getTcNumberAttr(object, "FireRate", 1);
      const maxLifetime = getTcNumberAttr(object, "MaxLifetime", 5);
      const range = getTcNumberAttr(object, "Range", 50);

      purgeTcBoilerplate(object);

      const turretModel = dom.Create("Model", "Turret");
      turretModel.Parent = clientParts;

      object.Name = "Turret";
      object.Parent = turretModel;
      clearTcAttributes(object);

      // Synthesize a standard EToH v6 Bullet model since TC instantiates bullets at runtime
      const bulletModel = dom.Create("Model", "Bullet");
      bulletModel.Parent = turretModel;
      bulletModel.AddTag("SkipObjectLoad");

      const bulletPart = dom.Create("Part", "Bullet");
      bulletPart.Parent = bulletModel;
      bulletPart.SetProperty("Shape", { Enum: ENUM_PART_TYPE.Ball });
      bulletPart.SetProperty("Size", { Vector3: [1.5, 1.5, 1.5] });
      bulletPart.SetProperty("CanCollide", { Bool: false });
      bulletPart.SetProperty("Anchored", { Bool: false });
      bulletPart.SetProperty("Color", { Color3: [1, 0, 0] });
      bulletPart.SetProperty("Material", { Enum: 288 }); // Neon

      const activators = dom.Create("Folder", "Activators");
      activators.Parent = turretModel;

      createConfiguration(
        dom,
        turretModel,
        "TurretConfiguration",
        ["CO_Interactables/Turret", "v6.0.1"],
        {
          ActivatorCooldown: 1,
          Damage: 10,
          DestroyOnTouch: destroyOnTouch,
          FireRate: fireRate,
          MaxLifetime: maxLifetime,
          Range: range,
          Speed: bulletSpeed,
        }
      );
    }

    // ------------------------------------------------------------------------
    // 15. BULLET VELOCITY CHANGER -> PROPERTY CHANGER
    // ------------------------------------------------------------------------
    else if (objectType === "Bullet Velocity Changer") {
      const bulletSpeed = getTcNumberAttr(object, "BulletSpeed", 75);
      if (object.HasTag("IgnoreBullets")) {
        object.RemoveTag("IgnoreBullets");
      }
      purgeTcBoilerplate(object);
      object.Name = "BulletVelocity Changer";
      clearTcAttributes(object);

      const lookDir = object.FindFirstChild("LookDirection");
      if (lookDir) {
        lookDir.AddTag("OnlyInStudio");
        lookDir.SetProperty("Visible", { Bool: true });
        lookDir.SetProperty("Adornee", { Ref: object.Id });
      }

      const propConfig = createConfiguration(
        dom,
        object,
        "PropertyChangerConfiguration",
        ["CO_Interactables/PropertyChanger", "v6.0.1"],
        {
          Cooldown: 0,
          Speed: bulletSpeed,
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
	-- Converted from Tower Creator Bullet Velocity Changer
}
`,
      });

      createTouchConfiguration(dom, propConfig, {
        player: false,
        pushbox: false,
        turret: true,
      });
    }

    // ------------------------------------------------------------------------
    // 16. DIALOG PART -> DIALOG
    // ------------------------------------------------------------------------
    else if (objectType === "DialogPart") {
      const colorSpecific = getTcBoolAttr(object, "ColorSpecificCheck", false);
      const playerTouch = getTcBoolAttr(object, "PlayerTouchActivated", true);
      const pushboxTouch = getTcBoolAttr(object, "PushboxTouchActivated", false);
      const bulletTouch = getTcBoolAttr(object, "BulletActivated", false);

      const dialog1 = object.FindFirstChild("Dialog1");
      const text1 = dialog1?.FindFirstChild("text1");
      const decodedText = text1
        ? getTcStringAttr(text1, "Text", "Hello!")
        : "Hello!";
      const interval = text1 ? getTcNumberAttr(text1, "Interval", 0.05) : 0.05;
      const delayAfter = dialog1
        ? getTcNumberAttr(dialog1, "DelayAfterFinish", 1)
        : 1;

      purgeTcBoilerplate(object);
      if (dialog1) dialog1.Destroy();
      object.Name = "Dialog";
      clearTcAttributes(object);

      const dialogConfig = createConfiguration(
        dom,
        object,
        "DialogConfiguration",
        ["CO_Interactables/Dialog", "v6.0.0"],
        {
          Cooldown: 1,
          DelayAfterFinish: delayAfter,
          Interval: interval,
          ManualAdvance: false,
        }
      );

      const linesMod = dom.Create("ModuleScript", "Lines");
      linesMod.Parent = dialogConfig;
      linesMod.SetProperty("Source", {
        String: `return {
	${JSON.stringify(decodedText)},
}
`,
      });

      createTouchConfiguration(dom, dialogConfig, {
        colorSpecific,
        player: playerTouch,
        pushbox: pushboxTouch,
        turret: bulletTouch,
      });
    }

    // ------------------------------------------------------------------------
    // 17. LIGHTING CHANGER & SKYBOX TRIGGER -> LIGHTING CHANGER
    // ------------------------------------------------------------------------
    else if (
      objectType === "Lighting Changer" ||
      functionClass === "LightingChanger" ||
      objectType === "Skybox Trigger"
    ) {
      const tweenTime = getTcNumberAttr(object, "TweeningTime", 1);
      purgeTcBoilerplate(object);
      object.Name = "Lighting Changer";
      clearTcAttributes(object);

      const lcConfig = createConfiguration(
        dom,
        object,
        "LightingChangerConfiguration",
        ["CO_Visual/LightingChanger", "v6.0.0"],
        { ChangeOnLoad: false }
      );

      const lightingMod = dom.Create("ModuleScript", "Lighting");
      lightingMod.Parent = lcConfig;
      lightingMod.SetProperty("Source", {
        String: `--!strict
local Change = require(game:GetService("ReplicatedStorage").Framework.Kit.Repository.Visual.LightingChanger.TypeDefs)
-- DON'T TOUCH THE LINE ABOVE -- -- DON'T TOUCH THE LINE ABOVE --

return Change "Lighting" {
	TweenInfo = TweenInfo.new(${tweenTime}, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
	Configuration = {
		-- Converted from Tower Creator ${objectType}
	},
}
`,
      });

      convertTcTouchConfig(dom, object, lcConfig, {
        player: true,
        pushbox: false,
      });
    }

    // ------------------------------------------------------------------------
    // 18. MUSIC PART -> MUSIC ZONE
    // ------------------------------------------------------------------------
    else if (objectType === "MusicPart") {
      const priority = getTcNumberAttr(object, "Priority", 1);
      const volume = getTcNumberAttr(object, "OriginalVolume", 0.5);
      const musicFolder = object.FindFirstChild("MusicFolder");
      const sound = musicFolder?.FindFirstChild("Sound");

      purgeTcBoilerplate(object);
      object.Name = "MusicZone";
      clearTcAttributes(object);

      const zoneConfig = createConfiguration(
        dom,
        object,
        "MusicZoneConfiguration",
        ["CO_Audio/MusicZone", "v6.0.0"],
        {
          Priority: priority,
          ZoneName: `TC_Zone_${object.Id.slice(0, 6)}`,
        }
      );

      if (sound) {
        sound.SetProperty("Volume", { Float32: volume });
        sound.Parent = zoneConfig;
      }
      if (musicFolder) musicFolder.Destroy();
    }

    // ------------------------------------------------------------------------
    // 19. SOUND TRIGGER -> EMITTER
    // ------------------------------------------------------------------------
    else if (objectType === "Sound Trigger") {
      const cooldown = getTcNumberAttr(object, "TouchCooldown", 0);
      const multi = getTcBoolAttr(object, "MultiTrigger", true);
      const is3D = getTcBoolAttr(object, "Is3DSound", true);
      const delay = getTcNumberAttr(object, "Delay", 0);

      purgeTcBoilerplate(object);
      object.Name = "Emitter";
      clearTcAttributes(object);

      const sound = object.FindFirstChild("Sound");
      if (sound) {
        createConfiguration(dom, sound, "EmitConfiguration", [], {
          EmitDelay: delay,
        });
      }

      const emitterConfig = createConfiguration(
        dom,
        object,
        "EmitterConfiguration",
        ["CO_Visual/Emitter", "v6.0.0"],
        {
          Cooldown: cooldown,
          GlobalSound: !is3D,
          Uses: multi ? 0 : 1,
        }
      );

      convertTcTouchConfig(dom, object, emitterConfig, {
        player: true,
        pushbox: false,
      });
    }

    // ------------------------------------------------------------------------
    // 20. XPUSHER -> PUSHING PLATFORM (PrismaticConstraint + VectorForce)
    // ------------------------------------------------------------------------
    else if (objectType === "XPusher") {
      const force = getTcVector3Attr(object, "Force", [0, 0, 4000]);
      const lowerLimit = getTcNumberAttr(object, "LowerLimit", 0);
      const upperLimit = getTcNumberAttr(object, "UpperLimit", 23);

      purgeTcBoilerplate(object);
      object.Name = "PushingPlatform";
      clearTcAttributes(object);

      const constraintPart = object.FindFirstChild("Constraint");
      const platformPart = object.FindFirstChild("Part");
      const wallPart = object.FindFirstChild("Wall");

      if (constraintPart) {
        constraintPart.Name = "Base";
        constraintPart.SetProperty("Anchored", { Bool: true });
      }
      if (platformPart) {
        platformPart.Name = "Primary";
        platformPart.SetProperty("Anchored", { Bool: false });
      }
      if (wallPart && platformPart) {
        wallPart.SetProperty("Anchored", { Bool: false });
        const weld = dom.Create("WeldConstraint", "WeldConstraint");
        weld.Parent = wallPart;
        weld.SetProperty("Part0", { Ref: platformPart.Id });
        weld.SetProperty("Part1", { Ref: wallPart.Id });
      }

      const att0 = constraintPart?.FindFirstChild("Attachment0");
      const att1 = platformPart?.FindFirstChild("Attachment1");
      const vfAtt = platformPart?.FindFirstChild("VectorForceAttachment");

      if (constraintPart && att0 && att1) {
        const pc = dom.Create("PrismaticConstraint", "PrismaticConstraint");
        pc.Parent = constraintPart;
        pc.SetProperty("Attachment0", { Ref: att0.Id });
        pc.SetProperty("Attachment1", { Ref: att1.Id });
        pc.SetProperty("LimitsEnabled", { Bool: true });
        pc.SetProperty("LowerLimit", { Float32: lowerLimit });
        pc.SetProperty("UpperLimit", { Float32: upperLimit });
      }

      if (platformPart && vfAtt) {
        const vf = dom.Create("VectorForce", "VectorForce");
        vf.Parent = platformPart;
        vf.SetProperty("Attachment0", { Ref: vfAtt.Id });
        vf.SetProperty("Force", { Vector3: force });
        vf.SetProperty("RelativeTo", { Enum: 0 }); // Attachment0
      }

      object.Parent = distanceCulling;
    }

    // ------------------------------------------------------------------------
    // 21. ROPE SWING PLATFORM (Reconstruct missing RopeConstraint)
    // ------------------------------------------------------------------------
    else if (objectType === "Rope Swing Platform") {
      purgeTcBoilerplate(object);
      object.Name = "Rope Swing Platform";
      clearTcAttributes(object);

      const anchor = object.FindFirstChild("Anchor");
      const platform = object.FindFirstChild("Platform");

      if (anchor && platform) {
        anchor.Name = "Primary";
        anchor.SetProperty("Anchored", { Bool: true });
        platform.SetProperty("Anchored", { Bool: false });

        const anchorPos = extractCFrameComponents(anchor).pos;
        const platPos = extractCFrameComponents(platform).pos;
        const dx = anchorPos[0] - platPos[0];
        const dy = anchorPos[1] - platPos[1];
        const dz = anchorPos[2] - platPos[2];
        const ropeLength = Math.max(1, Math.hypot(dx, dy, dz));

        const att0 = dom.Create("Attachment", "Attachment0");
        att0.Parent = anchor;
        const att1 = dom.Create("Attachment", "Attachment1");
        att1.Parent = platform;

        const rope = dom.Create("RopeConstraint", "RopeConstraint");
        rope.Parent = platform;
        rope.SetProperty("Attachment0", { Ref: att0.Id });
        rope.SetProperty("Attachment1", { Ref: att1.Id });
        rope.SetProperty("Length", { Float32: ropeLength });
        rope.SetProperty("Visible", { Bool: true });
      }

      object.Parent = distanceCulling;
    }

    // ------------------------------------------------------------------------
    // 22. HEAL PART & HEALTH CHANGER -> DAMAGE BRICK (Custom / Heal)
    // ------------------------------------------------------------------------
    else if (objectType === "HealPart" || objectType === "HealthChanger") {
      const healAmount = getTcNumberAttr(object, "Health", 50);
      purgeTcBoilerplate(object);
      clearTcAttributes(object);

      createConfiguration(dom, object, "DamageBrickConfiguration", [], {
        Cooldown: 0.5,
        Damage: -Math.abs(healAmount),
        Type: "custom",
      });
    }

    // ------------------------------------------------------------------------
    // 23. TOWER CREATOR EXCLUSIVE MECHANICS (Best-effort + warning)
    // ------------------------------------------------------------------------
    else {
      purgeTcBoilerplate(object);
      clearTcAttributes(object);
      warnings.push(
        `Tower Creator object "${objectType}" has no direct EToH v6 equivalent and was preserved as a static/client part.`
      );
    }
  }

  return clientParts;
}

/**
 * Converts a Tower Creator document into an EToH v6.1.3 document.
 * `warnings` receives one entry per object that has no direct v6 equivalent.
 */
export function convertTowerCreatorToV6(document: RbxDocument, warnings: string[] = []): RbxDocument {
  const dom = openDom(document);
  const clientSidedObjects = convertTowerCreatorTo602(dom, warnings);
  const converted = dom.toDocument();
  if (!clientSidedObjects) return converted;
  return upgradeV6To613Document(converted);
}

