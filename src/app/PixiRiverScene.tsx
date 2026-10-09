"use client";

import { useEffect, useRef } from "react";
import type { Application, Container, Graphics, Sprite, Texture } from "pixi.js";

type Person = { id: string; nickname: string; avatarId: number; online?: boolean };
type Item = Record<string, unknown>;
type SceneProps = {
  phase: string;
  member: Person;
  partner: Person | null;
  cuddled: boolean;
  lights: Item[];
  events: Item[];
  equipped: Item[];
  onCuddle: () => void;
  onLight: () => void;
  onAmbient: (detail: string) => void;
  onProp: (propId: string) => void;
  onSongs: () => void;
  onInvite: () => void;
};
type Runtime = {
  app: Application;
  memberSprite: Sprite;
  partnerSprite: Sprite;
  memberFrames: Texture[];
  partnerFrames: Texture[];
  framesByAvatar: Texture[][];
  memberId: string;
  partnerId: string;
  partnerVisible: boolean;
  memberResting: boolean;
  partnerResting: boolean;
  cityLights: Container;
  memoryLights: Container;
  nightWash: Graphics;
  effects: Container;
  propLayer: Container;
  propTextures: Texture[];
  propAnimating: boolean;
  activePropId: string;
  lastEventId: string;
  animatePartnerArrival: (frames: Texture[]) => void;
  setCuddled: (value: boolean) => void;
};

const WORLD_WIDTH = 1672;
const WORLD_HEIGHT = 941;
const AVATAR_SHEETS = ["/avatar-back-rust-v2.webp", "/avatar-back-cream-v2.webp", "/avatar-back-sage-v2.webp", "/avatar-back-blue-v2.webp"];
const PROP_IMAGES = ["bottle", "can", "blanket-folded", "blanket-open", "camera", "photo"].map((name) => `/props/items/${name}.png`);
const WINDOW_POINTS = [
  [35, 443], [117, 412], [154, 465], [203, 447], [267, 438], [318, 463], [373, 433], [438, 428], [485, 458], [543, 425],
  [602, 413], [650, 425], [706, 401], [755, 433], [806, 411], [857, 385], [906, 399], [958, 385], [1017, 420], [1070, 370],
  [1123, 408], [1175, 359], [1230, 399], [1284, 335], [1336, 382], [1387, 355], [1444, 421], [1492, 407], [1561, 435], [1617, 414],
] as const;
const MEMORY_COLORS: Record<string, number> = { coral: 0xff8f78, gold: 0xffd484, mint: 0xa9d9c4, lilac: 0xc2b3ed };

export default function PixiRiverScene(props: SceneProps) {
  const { phase, member, partner, cuddled, lights, events, equipped, onCuddle, onLight, onAmbient, onProp, onSongs, onInvite } = props;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const stateRef = useRef(props);
  const actionsRef = useRef({ onCuddle, onLight, onAmbient, onProp, onSongs, onInvite });
  const latestEventId = String(events[0]?.id ?? "");
  const lightSignature = lights.map((light) => `${String(light.id)}:${String(light.color)}`).join("|");
  const partnerKey = partner ? `${partner.id}:${partner.avatarId}` : "";
  const propSignature = equipped.map((item) => `${String(item.member_id)}:${String(item.prop_id)}:${String(item.used_at ?? "")}`).join("|");

  useEffect(() => {
    stateRef.current = props;
    actionsRef.current = { onCuddle, onLight, onAmbient, onProp, onSongs, onInvite };
  });

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    const mount = async () => {
      const host = hostRef.current;
      if (!host) return;
      const PIXI = await import("pixi.js");
      if (disposed) return;
      const app = new PIXI.Application();
      await app.init({ resizeTo: host, background: "#292d50", antialias: true, resolution: Math.min(window.devicePixelRatio, 2), autoDensity: true });
      if (disposed) return void app.destroy(true);
      host.appendChild(app.canvas);
      app.canvas.setAttribute("aria-label", "可互动的外滩江畔共听场景");

      const world = new PIXI.Container();
      app.stage.addChild(world);
      const loaded = await Promise.all([
        PIXI.Assets.load<Texture>("/jiangpan-empty-bench.webp"),
        ...AVATAR_SHEETS.map((path) => PIXI.Assets.load<Texture>(path)),
        ...PROP_IMAGES.map((path) => PIXI.Assets.load<Texture>(path)),
      ]);
      if (disposed) return void app.destroy(true);
      const backgroundTexture = loaded[0];
      const avatarSheets = loaded.slice(1, 5);
      const propTextures = loaded.slice(5);

      const background = new PIXI.Sprite(backgroundTexture);
      background.width = WORLD_WIDTH;
      background.height = WORLD_HEIGHT;
      world.addChild(background);

      const framesByAvatar = avatarSheets.map((sheet) => {
        const frameWidth = sheet.source.width / 6;
        return Array.from({ length: 6 }, (_, index) => new PIXI.Texture({
          source: sheet.source,
          frame: new PIXI.Rectangle(index * frameWidth, 0, frameWidth, sheet.source.height),
        }));
      });
      const memberFrames = framesByAvatar[member.avatarId] ?? framesByAvatar[0];
      const partnerFrames = framesByAvatar[partner?.avatarId ?? 1] ?? framesByAvatar[1];
      const seatY = 852;
      const leftX = 775;
      const rightX = 920;
      const avatarScale = 0.65;

      const memberSprite = new PIXI.Sprite(memberFrames[0]);
      memberSprite.anchor.set(0.5, 0.86);
      memberSprite.visible = false;
      world.addChild(memberSprite);
      const partnerSprite = new PIXI.Sprite(partnerFrames[0]);
      partnerSprite.anchor.set(0.5, 0.86);
      partnerSprite.visible = false;
      world.addChild(partnerSprite);

      const foreground = new PIXI.Sprite(backgroundTexture);
      foreground.width = WORLD_WIDTH;
      foreground.height = WORLD_HEIGHT;
      const foregroundMask = new PIXI.Graphics();
      foregroundMask.poly([596, 747, 1111, 744, 1110, 788, 603, 792]).fill({ color: 0xffffff });
      foregroundMask.poly([618, 760, 650, 760, 646, 885, 614, 885]).fill({ color: 0xffffff });
      foregroundMask.poly([1041, 754, 1074, 752, 1079, 881, 1046, 881]).fill({ color: 0xffffff });
      foreground.mask = foregroundMask;
      world.addChild(foreground, foregroundMask);

      const nightWash = new PIXI.Graphics().rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill({ color: 0x182044, alpha: 1 });
      nightWash.alpha = phase === "night" ? 0.46 : phase === "blue" ? 0.2 : 0;
      world.addChild(nightWash);
      const cityLights = new PIXI.Container();
      WINDOW_POINTS.forEach(([x, y], index) => {
        cityLights.addChild(new PIXI.Graphics().roundRect(x - 2, y - 3, 4, 6, 1).fill({ color: index % 6 === 0 ? 0xffa97a : 0xffd58f }));
      });
      cityLights.alpha = phase === "night" ? 1 : phase === "blue" ? 0.48 : 0.14;
      world.addChild(cityLights);
      const memoryLights = new PIXI.Container();
      const propLayer = new PIXI.Container();
      const effects = new PIXI.Container();
      world.addChild(memoryLights, propLayer, effects);

      const runtime = {} as Runtime;
      const alive = () => runtimeRef.current === runtime && !disposed;
      const animateArrival = (sprite: Sprite, frames: Texture[], startX: number, targetX: number, side: "member" | "partner") => {
        if (side === "member") runtime.memberResting = false;
        else runtime.partnerResting = false;
        const direction = side === "partner" ? -1 : 1;
        sprite.visible = true;
        sprite.alpha = 0;
        sprite.rotation = 0;
        sprite.position.set(startX, 922);
        sprite.scale.set(direction * avatarScale * 1.12, avatarScale * 1.12);
        const started = performance.now();
        const step = (time: number) => {
          if (!alive()) return;
          const t = Math.min(1, (time - started) / 2350);
          if (t < 0.7) {
            const walkT = t / 0.7;
            const eased = 1 - Math.pow(1 - walkT, 2);
            sprite.texture = frames[Math.floor(time / 210) % 2 ? 1 : 2];
            sprite.x = startX + (targetX - startX) * eased;
            sprite.y = 922 - 132 * eased;
            const scale = avatarScale * (1.12 - 0.12 * eased);
            sprite.scale.set(direction * scale, scale);
            sprite.alpha = Math.min(1, t * 5);
          } else if (t < 0.86) {
            const sitT = (t - 0.7) / 0.16;
            sprite.texture = frames[3];
            sprite.x = targetX;
            sprite.y = 790 + (seatY - 790) * sitT;
            sprite.scale.set(direction * avatarScale, avatarScale);
          } else {
            sprite.texture = stateRef.current.cuddled ? frames[5] : frames[4];
            sprite.position.set(targetX, seatY);
            sprite.scale.set(direction * avatarScale, avatarScale);
          }
          if (t < 1) requestAnimationFrame(step);
          else if (side === "member") runtime.memberResting = true;
          else runtime.partnerResting = true;
        };
        requestAnimationFrame(step);
      };

      Object.assign(runtime, {
        app, memberSprite, partnerSprite, memberFrames, partnerFrames, framesByAvatar, memberId: member.id, partnerId: partner?.id ?? "", partnerVisible: Boolean(partner),
        memberResting: false, partnerResting: false, cityLights, memoryLights, propLayer, propTextures, propAnimating: false, activePropId: "", nightWash, effects, lastEventId: String(events[0]?.id ?? ""),
        animatePartnerArrival: (frames: Texture[]) => animateArrival(partnerSprite, frames, 1240, rightX, "partner"),
        setCuddled: (value: boolean) => {
          if (!runtime.memberResting || (runtime.partnerVisible && !runtime.partnerResting)) return;
          const started = performance.now();
          const fromLeft = memberSprite.x;
          const fromRight = partnerSprite.x;
          const lean = (time: number) => {
            if (!alive()) return;
            const t = Math.min(1, (time - started) / 620);
            const eased = 1 - Math.pow(1 - t, 3);
            memberSprite.texture = value && t > 0.34 ? runtime.memberFrames[5] : runtime.memberFrames[4];
            memberSprite.x = fromLeft + (value ? 18 : leftX - fromLeft) * eased;
            memberSprite.rotation = value ? 0.018 * eased : 0;
            if (runtime.partnerVisible) {
              partnerSprite.texture = value && t > 0.34 ? runtime.partnerFrames[5] : runtime.partnerFrames[4];
              partnerSprite.x = fromRight + (value ? -18 : rightX - fromRight) * eased;
              partnerSprite.rotation = value ? -0.018 * eased : 0;
            }
            if (t < 1) requestAnimationFrame(lean);
          };
          requestAnimationFrame(lean);
        },
      });
      runtimeRef.current = runtime;

      const makeHit = (x: number, y: number, width: number, height: number, action: () => void) => {
        const hit = new PIXI.Container();
        hit.position.set(x, y);
        hit.hitArea = new PIXI.Rectangle(0, 0, width, height);
        hit.eventMode = "static";
        hit.cursor = "pointer";
        hit.on("pointertap", action);
        world.addChild(hit);
      };
      const addPulse = (x: number, y: number, label: "invite-pulse" | "interaction-pulse") => {
        const pulse = new PIXI.Graphics().circle(x, y, 7).fill({ color: 0xffd7aa, alpha: 0.72 });
        pulse.label = label;
        effects.addChild(pulse);
      };
      if (!partner) addPulse(rightX, seatY - 120, "invite-pulse");
      addPulse(930, 420, "interaction-pulse");
      addPulse(330, 615, "interaction-pulse");
      addPulse(1490, 655, "interaction-pulse");
      makeHit(560, 500, 620, 390, () => stateRef.current.partner ? actionsRef.current.onCuddle() : actionsRef.current.onInvite());
      makeHit(50, 290, 1510, 240, () => actionsRef.current.onLight());
      makeHit(20, 520, 590, 190, () => actionsRef.current.onAmbient("ripple"));
      makeHit(1390, 550, 240, 250, () => actionsRef.current.onSongs());

      const resizeWorld = () => {
        if (disposed || !app.renderer) return;
        const width = app.screen.width;
        const height = app.screen.height;
        const scale = Math.max(width / WORLD_WIDTH, height / WORLD_HEIGHT);
        world.scale.set(scale);
        world.position.set((width - WORLD_WIDTH * scale) / 2, (height - WORLD_HEIGHT * scale) / 2);
      };
      resizeWorld();
      resizeObserver = new ResizeObserver(() => window.requestAnimationFrame(resizeWorld));
      resizeObserver.observe(host);

      let idleTime = 0;
      app.ticker.add((ticker) => {
        idleTime += ticker.deltaMS;
        cityLights.children.forEach((light, index) => { light.alpha = Math.max(0.36, 0.82 + Math.sin(idleTime / 760 + index) * 0.18); });
        effects.children.filter((child) => child.label?.endsWith("-pulse")).forEach((pulse, index) => {
          const wave = (Math.sin(idleTime / 520 + index) + 1) / 2;
          pulse.alpha = 0.28 + wave * 0.5;
          pulse.scale.set(0.82 + wave * 0.28);
        });
        if (runtime.memberResting) memberSprite.y = seatY + Math.sin(idleTime / 950) * 1.2;
        if (runtime.partnerVisible && runtime.partnerResting) partnerSprite.y = seatY + Math.sin(idleTime / 950 + 0.45) * 1.2;
        positionHeldProps(runtime);
        effects.children.filter((child) => child.label === "temporary").forEach((effect) => {
          effect.alpha -= ticker.deltaMS / 1600;
          effect.scale.x += ticker.deltaMS / 1800;
          effect.scale.y += ticker.deltaMS / 1800;
          if (effect.alpha <= 0) effect.destroy();
        });
      });

      updateMemoryLights(runtime, lights, PIXI);
      updateSceneProps(runtime, equipped, events, Boolean(partner), PIXI, (propId) => actionsRef.current.onProp(propId));
      animateArrival(memberSprite, memberFrames, leftX - 280, leftX, "member");
      if (partner) window.setTimeout(() => alive() && runtime.animatePartnerArrival(partnerFrames), 380);
    };

    void mount();
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      runtimeRef.current?.app.destroy(true, { children: true });
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.nightWash.alpha = phase === "night" ? 0.46 : phase === "blue" ? 0.2 : 0;
    runtime.cityLights.alpha = phase === "night" ? 1 : phase === "blue" ? 0.48 : 0.14;
    runtime.partnerFrames = runtime.framesByAvatar[partner?.avatarId ?? 1] ?? runtime.framesByAvatar[1];
    runtime.partnerId = partner?.id ?? "";
    if (partner && !runtime.partnerVisible) {
      runtime.partnerVisible = true;
      runtime.animatePartnerArrival(runtime.partnerFrames);
      runtime.effects.children.filter((child) => child.label === "invite-pulse").forEach((child) => child.destroy());
    }
    if (!partner) {
      runtime.partnerVisible = false;
      runtime.partnerResting = false;
      runtime.partnerSprite.visible = false;
    }
    runtime.setCuddled(cuddled);
  }, [phase, cuddled, partnerKey]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    import("pixi.js").then((PIXI) => updateMemoryLights(runtime, lights, PIXI));
  }, [lightSignature]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    import("pixi.js").then((PIXI) => updateSceneProps(runtime, equipped, events, Boolean(partner), PIXI, (propId) => actionsRef.current.onProp(propId)));
  }, [propSignature, latestEventId, partnerKey]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    const latest = events[0];
    if (!runtime || !latest || latestEventId === runtime.lastEventId) return;
    runtime.lastEventId = latestEventId;
    if (latest.type !== "ambient" && latest.type !== "prop") return;
    import("pixi.js").then((PIXI) => {
      if (runtimeRef.current !== runtime) return;
      if (latest.type === "prop") {
        const propId = String(JSON.parse(String(latest.payload ?? "{}")).propId ?? "");
        animateProp(runtime, propId, PIXI);
      } else {
        const ripple = new PIXI.Graphics().circle(0, 0, 34).stroke({ color: 0xffd3ba, width: 3, alpha: 0.8 });
        ripple.position.set(330, 615);
        ripple.label = "temporary";
        runtime.effects.addChild(ripple);
      }
    });
  }, [latestEventId]);

  return <div className="pixi-scene" ref={hostRef}><div className="game-a11y-controls">
    <button onClick={partner ? onCuddle : onInvite}>{partner ? "靠近对方" : "邀请恋人"}</button>
    <button onClick={onLight}>点亮对岸的窗</button>
    <button onClick={() => onAmbient("ripple")}>触碰江面</button>
    {equipped.map((item) => <button key={String(item.member_id)} onClick={() => onProp(String(item.prop_id))}>使用{String(item.prop_id)}</button>)}
    <button onClick={onSongs}>选择歌曲</button>
  </div></div>;
}

function eventPropIds(events: Item[]) {
  return events.filter((event) => event.type === "prop").map((event) => {
    try { return String(JSON.parse(String(event.payload ?? "{}")).propId ?? ""); } catch { return ""; }
  }).filter(Boolean);
}

function propSprite(PIXI: typeof import("pixi.js"), texture: Texture, width: number) {
  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.width = width;
  sprite.scale.y = sprite.scale.x;
  return sprite;
}

function stateIsCuddled(runtime: Runtime) {
  return runtime.partnerVisible && Math.abs(runtime.partnerSprite.x - runtime.memberSprite.x) < 125;
}

function positionHeldProps(runtime: Runtime) {
  runtime.propLayer.children.forEach((child) => {
    const [kind, side, item] = String(child.label ?? "").split(":");
    if (kind !== "held") return;
    const person = side === "partner" ? runtime.partnerSprite : runtime.memberSprite;
    const direction = side === "partner" ? -1 : 1;
    const positions: Record<string, [number, number]> = {
      bottle: [38, -216],
      can: [38, -216],
      blanket: [46, -182],
      camera: [42, -232],
    };
    const [offsetX, offsetY] = positions[item] ?? [40, -210];
    child.position.set(person.x + offsetX * direction, person.y + offsetY);
    child.rotation = person.rotation + (item === "blanket" ? direction * -0.08 : direction * 0.04);
  });
}

function setStaticPropVisible(runtime: Runtime, propId: string, visible: boolean) {
  runtime.propLayer.children.forEach((child) => {
    if (String(child.label ?? "").endsWith(`:${propId}`)) child.visible = visible;
  });
}

function updateSceneProps(runtime: Runtime, equipped: Item[], events: Item[], partnerAvailable: boolean, PIXI: typeof import("pixi.js"), onProp: (propId: string) => void) {
  runtime.propLayer.removeChildren().forEach((child) => child.destroy());
  const used = new Set(eventPropIds(events));
  const rendered = new Set<string>();
  const makeInteractive = (sprite: Sprite, propId: string) => {
    sprite.label = `${sprite.label}:${propId}`;
    sprite.eventMode = partnerAvailable ? "static" : "none";
    sprite.cursor = partnerAvailable ? "pointer" : "default";
    sprite.on("pointertap", () => {
      if (runtime.propAnimating) return;
      animateProp(runtime, propId, PIXI);
      onProp(propId);
    });
  };
  equipped.forEach((item) => {
    const propId = String(item.prop_id ?? "");
    if (!propId || rendered.has(propId)) return;
    rendered.add(propId);
    const ownerSide = String(item.member_id) === runtime.partnerId ? "partner" : "member";
    if (propId === "drinks") {
      const bottle = propSprite(PIXI, runtime.propTextures[0], 92);
      const can = propSprite(PIXI, runtime.propTextures[1], 92);
      bottle.label = "held:member:bottle";
      can.label = partnerAvailable ? "held:partner:can" : "held:member:can";
      makeInteractive(bottle, propId);
      makeInteractive(can, propId);
      runtime.propLayer.addChild(bottle);
      if (partnerAvailable) runtime.propLayer.addChild(can);
    }
    if (propId === "blanket") {
      const blanket = propSprite(PIXI, runtime.propTextures[used.has("blanket") ? 3 : 2], used.has("blanket") ? 330 : 145);
      if (used.has("blanket")) {
        blanket.position.set(851, 704);
        blanket.rotation = 0.012;
        blanket.label = "placed:blanket";
      } else {
        blanket.label = `held:${ownerSide}:blanket`;
      }
      makeInteractive(blanket, propId);
      runtime.propLayer.addChild(blanket);
    }
    if (propId === "camera") {
      const camera = propSprite(PIXI, runtime.propTextures[4], 125);
      camera.label = `held:${ownerSide}:camera`;
      makeInteractive(camera, propId);
      runtime.propLayer.addChild(camera);
      if (used.has("camera")) {
        const photo = propSprite(PIXI, runtime.propTextures[5], 105);
        photo.position.set(1012, 678); photo.rotation = -0.14;
        photo.label = "placed:photo";
        runtime.propLayer.addChild(photo);
      }
    }
  });
  positionHeldProps(runtime);
  if (runtime.propAnimating && runtime.activePropId) setStaticPropVisible(runtime, runtime.activePropId, false);
}

function animateProp(runtime: Runtime, propId: string, PIXI: typeof import("pixi.js")) {
  if (runtime.propAnimating) return;
  runtime.propAnimating = true;
  runtime.activePropId = propId;
  setStaticPropVisible(runtime, propId, false);
  runtime.memberResting = false;
  runtime.partnerResting = false;
  const memberStart = { x: runtime.memberSprite.x, y: runtime.memberSprite.y, rotation: runtime.memberSprite.rotation };
  const partnerStart = { x: runtime.partnerSprite.x, y: runtime.partnerSprite.y, rotation: runtime.partnerSprite.rotation };
  const cuddledAtStart = stateIsCuddled(runtime);
  const heldFor = (item: string) => runtime.propLayer.children.find((child) => String(child.label ?? "").includes(`:${item}:`) && String(child.label ?? "").endsWith(`:${propId}`));
  const settlePeople = () => {
    runtime.memberSprite.position.set(memberStart.x, memberStart.y);
    runtime.memberSprite.rotation = memberStart.rotation;
    runtime.memberSprite.texture = runtime.memberFrames[cuddledAtStart ? 5 : 4];
    if (runtime.partnerVisible) {
      runtime.partnerSprite.position.set(partnerStart.x, partnerStart.y);
      runtime.partnerSprite.rotation = partnerStart.rotation;
      runtime.partnerSprite.texture = runtime.partnerFrames[cuddledAtStart ? 5 : 4];
    }
    runtime.memberResting = true;
    runtime.partnerResting = runtime.partnerVisible;
  };
  const finish = (...children: Array<Sprite | Graphics>) => {
    children.forEach((child) => { if (!child.destroyed) child.destroy(); });
    settlePeople();
    runtime.propAnimating = false;
    runtime.activePropId = "";
    setStaticPropVisible(runtime, propId, true);
  };
  if (propId === "blanket") {
    const folded = propSprite(PIXI, runtime.propTextures[2], 150);
    const open = propSprite(PIXI, runtime.propTextures[3], 330);
    const heldBlanket = heldFor("blanket");
    folded.position.set(heldBlanket?.x ?? memberStart.x + 46, heldBlanket?.y ?? memberStart.y - 182);
    folded.rotation = -0.12;
    open.position.set(850, 704);
    open.alpha = 0;
    open.scale.x *= 0.18;
    const foldedScale = folded.scale.x;
    runtime.effects.addChild(folded, open);
    const started = performance.now();
    const unfold = (time: number) => {
      if (folded.destroyed || open.destroyed) return;
      const t = Math.min(1, (time - started) / 1850);
      const reach = Math.sin(Math.min(1, t / 0.72) * Math.PI);
      runtime.memberSprite.position.set(memberStart.x + 8 * reach, memberStart.y + 8 * reach);
      runtime.partnerSprite.position.set(partnerStart.x - 8 * reach, partnerStart.y + 8 * reach);
      runtime.memberSprite.rotation = memberStart.rotation + 0.028 * reach;
      runtime.partnerSprite.rotation = partnerStart.rotation - 0.028 * reach;
      if (t < 0.45) {
        const p = t / 0.45;
        const eased = 1 - Math.pow(1 - p, 3);
        const fromX = heldBlanket?.x ?? memberStart.x + 46;
        const fromY = heldBlanket?.y ?? memberStart.y - 182;
        folded.position.set(fromX + (850 - fromX) * eased, fromY + (704 - fromY) * eased - Math.sin(p * Math.PI) * 38);
        folded.rotation = -0.12 + eased * 0.18;
        folded.scale.set(foldedScale * (1 + Math.sin(p * Math.PI) * 0.08));
      } else {
        const p = (t - 0.45) / 0.55;
        folded.alpha = Math.max(0, 1 - p * 4);
        open.alpha = Math.min(1, p * 3);
        const baseX = 330 / runtime.propTextures[3].width;
        const overshoot = p < 0.76 ? (0.18 + (1.08 - 0.18) * (1 - Math.pow(1 - p / 0.76, 3))) : 1.08 - (p - 0.76) / 0.24 * 0.08;
        open.scale.set(baseX * overshoot, baseX * (0.92 + 0.08 * p));
        open.rotation = Math.sin(p * Math.PI * 2) * 0.018 * (1 - p);
      }
      if (t < 1) requestAnimationFrame(unfold);
      else {
        finish(folded, open);
        requestAnimationFrame(() => runtime.setCuddled(true));
      }
    };
    requestAnimationFrame(unfold);
    return;
  }
  if (propId === "camera") {
    const camera = propSprite(PIXI, runtime.propTextures[4], 130);
    const photo = propSprite(PIXI, runtime.propTextures[5], 112);
    const flash = new PIXI.Graphics().rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill({ color: 0xfff8e8 });
    const heldCamera = heldFor("camera");
    const cameraByPartner = String(heldCamera?.label ?? "").includes("held:partner");
    const cameraPerson = cameraByPartner ? runtime.partnerSprite : runtime.memberSprite;
    const cameraPersonStart = cameraByPartner ? partnerStart : memberStart;
    const cameraDirection = cameraByPartner ? -1 : 1;
    const cameraFromX = heldCamera?.x ?? memberStart.x + 42;
    const cameraFromY = heldCamera?.y ?? memberStart.y - 232;
    camera.position.set(cameraFromX, cameraFromY);
    camera.rotation = -0.08;
    photo.position.set(790, 620);
    photo.alpha = 0;
    flash.alpha = 0;
    runtime.effects.addChild(camera, photo, flash);
    const started = performance.now();
    const shoot = (time: number) => {
      if (camera.destroyed || photo.destroyed || flash.destroyed) return;
      const elapsed = time - started;
      const t = Math.min(1, elapsed / 2650);
      const lift = Math.min(1, t / 0.28);
      const gesture = t < 0.74 ? Math.min(1, t / 0.22) : Math.max(0, 1 - (t - 0.74) / 0.26);
      cameraPerson.position.set(cameraPersonStart.x + 7 * cameraDirection * gesture, cameraPersonStart.y - 2 * gesture);
      cameraPerson.rotation = cameraPersonStart.rotation + 0.02 * cameraDirection * gesture;
      const companion = cameraByPartner ? runtime.memberSprite : runtime.partnerSprite;
      const companionStart = cameraByPartner ? memberStart : partnerStart;
      companion.position.set(companionStart.x - 13 * cameraDirection * gesture, companionStart.y);
      companion.rotation = companionStart.rotation - 0.025 * cameraDirection * gesture;
      camera.position.set(cameraFromX + (cameraPersonStart.x + 10 * cameraDirection - cameraFromX) * (1 - Math.pow(1 - lift, 3)), cameraFromY - 72 * Math.sin(lift * Math.PI / 2));
      camera.rotation = -0.08 + lift * 0.06;
      const pulsePhase = elapsed > 700 && elapsed < 1450 ? Math.floor((elapsed - 700) / 250) : -1;
      camera.scale.set((130 / runtime.propTextures[4].width) * (pulsePhase >= 0 && (elapsed % 250) < 90 ? 1.08 : 1));
      if (elapsed > 1480 && elapsed < 1620) flash.alpha = Math.sin(((elapsed - 1480) / 140) * Math.PI) * 0.9;
      else flash.alpha = 0;
      if (elapsed > 1600) {
        const p = Math.min(1, (elapsed - 1600) / 900);
        photo.alpha = Math.min(1, p * 4);
        photo.position.set(800 + 205 * p, 610 + 70 * p + Math.sin(p * Math.PI) * 32);
        photo.rotation = -0.02 - p * 0.13;
      }
      if (t < 1) requestAnimationFrame(shoot);
      else finish(camera, photo, flash);
    };
    requestAnimationFrame(shoot);
    return;
  }
  if (propId === "drinks") {
    const left = propSprite(PIXI, runtime.propTextures[0], 92);
    const right = propSprite(PIXI, runtime.propTextures[1], 92);
    const ring = new PIXI.Graphics().circle(0, 0, 10).stroke({ color: 0xffe3b7, width: 4, alpha: 0.9 });
    const heldBottle = heldFor("bottle");
    const heldCan = heldFor("can");
    const leftFrom = { x: heldBottle?.x ?? memberStart.x + 38, y: heldBottle?.y ?? memberStart.y - 216 };
    const rightFrom = { x: heldCan?.x ?? partnerStart.x - 38, y: heldCan?.y ?? partnerStart.y - 216 };
    left.position.set(leftFrom.x, leftFrom.y);
    right.position.set(rightFrom.x, rightFrom.y);
    left.rotation = -0.08;
    right.rotation = 0.08;
    ring.position.set(850, 632);
    ring.alpha = 0;
    runtime.effects.addChild(left, right);
    runtime.effects.addChild(ring);
    const started = performance.now();
    const clink = (time: number) => {
      if (left.destroyed || right.destroyed || ring.destroyed) return;
      const t = Math.min(1, (time - started) / 2250);
      const approach = Math.min(1, t / 0.48);
      const leave = t < 0.68 ? 0 : Math.min(1, (t - 0.68) / 0.32);
      const easedIn = 1 - Math.pow(1 - approach, 3);
      const easedOut = leave * leave;
      const bodyGesture = Math.max(0, easedIn - easedOut);
      runtime.memberSprite.position.set(memberStart.x + 11 * bodyGesture, memberStart.y + 3 * bodyGesture);
      runtime.partnerSprite.position.set(partnerStart.x - 11 * bodyGesture, partnerStart.y + 3 * bodyGesture);
      runtime.memberSprite.rotation = memberStart.rotation + 0.025 * bodyGesture;
      runtime.partnerSprite.rotation = partnerStart.rotation - 0.025 * bodyGesture;
      const leftHand = { x: 836, y: 632 };
      const rightHand = { x: 864, y: 632 };
      left.position.set(leftFrom.x + (leftHand.x - leftFrom.x) * easedIn + (leftFrom.x - leftHand.x) * easedOut, leftFrom.y + (leftHand.y - leftFrom.y) * easedIn + (leftFrom.y - leftHand.y) * easedOut - Math.sin(approach * Math.PI) * 18);
      right.position.set(rightFrom.x + (rightHand.x - rightFrom.x) * easedIn + (rightFrom.x - rightHand.x) * easedOut, rightFrom.y + (rightHand.y - rightFrom.y) * easedIn + (rightFrom.y - rightHand.y) * easedOut - Math.sin(approach * Math.PI) * 18);
      left.rotation = -0.08 + easedIn * 0.28 - easedOut * 0.28;
      right.rotation = 0.08 - easedIn * 0.28 + easedOut * 0.28;
      if (t > 0.4 && t < 0.64) {
        const p = (t - 0.4) / 0.24;
        ring.alpha = Math.sin(p * Math.PI);
        ring.scale.set(0.6 + p * 2.2);
      } else ring.alpha = 0;
      if (t < 1) requestAnimationFrame(clink);
      else finish(left, right, ring);
    };
    requestAnimationFrame(clink);
    return;
  }
  runtime.propAnimating = false;
}

function updateMemoryLights(runtime: Runtime, lights: Item[], PIXI: typeof import("pixi.js")) {
  runtime.memoryLights.removeChildren().forEach((child) => child.destroy());
  lights.forEach((light, index) => {
    const point = WINDOW_POINTS[(index * 5 + 4) % WINDOW_POINTS.length];
    const color = MEMORY_COLORS[String(light.color)] ?? 0xffd484;
    runtime.memoryLights.addChild(
      new PIXI.Graphics().circle(point[0], point[1], 12).fill({ color, alpha: 0.16 }),
      new PIXI.Graphics().circle(point[0], point[1], 5).fill({ color, alpha: 0.96 }),
    );
  });
}
