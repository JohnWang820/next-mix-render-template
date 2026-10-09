import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("renders the immersive shared-listening flow", async () => {
  const [layout, page, client, scene] = await Promise.all([
    readFile(new URL("src/app/layout.tsx", root), "utf8"),
    readFile(new URL("src/app/page.tsx", root), "utf8"),
    readFile(new URL("src/app/SharedSpaceDemo.tsx", root), "utf8"),
    readFile(new URL("src/app/PixiRiverScene.tsx", root), "utf8"),
  ]);

  assert.match(layout, /共听空间｜不用说话/);
  assert.match(page, /SharedSpaceDemo/);
  assert.match(client, /今晚，你想以什么样子出现/);
  assert.match(client, /今晚带一件东西/);
  assert.match(client, /外滩江畔/);
  assert.match(client, /我们的今晚/);
  assert.match(scene, /pointertap/);
  assert.match(scene, /animateProp/);
  assert.doesNotMatch(client, /城市天台|便利店|自动售货机/);
});

test("uses EdgeOne persistent storage and the full two-person state model", async () => {
  const route = await readFile(new URL("src/app/api/space/route.ts", root), "utf8");

  assert.match(route, /@edgeone\/pages-blob/);
  assert.match(route, /getStore\("gongting-space"\)/);
  assert.match(route, /consistency: "strong"/);
  assert.match(route, /generateDiaries/);
  assert.match(route, /equip_prop/);
  assert.match(route, /presence\//);
  assert.match(route, /session_id/);
});

test("ships the approved art, prop and music assets", async () => {
  const files = [
    "public/jiangpan-dusk.webp",
    "public/jiangpan-empty-bench.webp",
    "public/avatar-back-rust-v2.webp",
    "public/avatar-back-cream-v2.webp",
    "public/avatar-back-sage-v2.webp",
    "public/avatar-back-blue-v2.webp",
    "public/props/date-props-atlas-v1.png",
    "public/music/river-wind.m4a",
    "public/music/city-lullaby.m4a",
    "public/music/neon-afterglow.m4a",
  ];

  const assets = await Promise.all(files.map((file) => readFile(new URL(file, root))));
  assets.forEach((asset) => assert.ok(asset.byteLength > 100_000));
});
