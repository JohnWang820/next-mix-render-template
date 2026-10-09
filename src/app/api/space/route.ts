import { getStore } from "@edgeone/pages-blob";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Payload = {
  action?: string;
  deviceId?: string;
  nickname?: string;
  inviteCode?: string;
  avatarId?: number;
  sceneId?: string;
  eventType?: string;
  track?: number;
  body?: string;
  shared?: boolean;
  detail?: string;
  propId?: string;
};

type Member = {
  id: string;
  device_id: string;
  nickname: string;
  avatar_id: number;
  created_at: number;
};

type Session = {
  id: string;
  space_id: string;
  scene_id: "river";
  status: "active" | "ended";
  started_at: number;
  ended_at?: number;
  current_track: number;
  playback_started_at: number;
  paused_at?: number | null;
  is_playing: number;
  closeness: number;
  night_override: number;
};

type SpaceEvent = {
  id: string;
  session_id: string;
  space_id: string;
  member_id: string;
  type: string;
  payload: string;
  created_at: number;
};

type Light = {
  id: string;
  space_id: string;
  session_id: string;
  member_id: string;
  color: string;
  created_at: number;
};

type Diary = {
  id: string;
  session_id: string;
  member_id: string;
  body: string;
  representative_track: number;
  is_shared: number;
  created_at: number;
  updated_at: number;
};

type EquippedProp = {
  session_id: string;
  member_id: string;
  prop_id: string;
  equipped_at: number;
  used_at: number | null;
};

type SpaceDocument = {
  id: string;
  invite_code: string;
  title: string;
  scene_id: "river";
  created_at: number;
  members: Member[];
  sessions: Session[];
  events: SpaceEvent[];
  lights: Light[];
  diaries: Diary[];
  equipped: EquippedProp[];
};

const TRACKS = ["晚风经过江面", "城市睡前曲", "灯火慢慢亮起"];
const PROPS = [
  { id: "drinks", name: "啤酒与汽水", unlockAt: 1 },
  { id: "blanket", name: "一条毛毯", unlockAt: 2 },
  { id: "camera", name: "拍立得", unlockAt: 3 },
] as const;

const strong = { consistency: "strong" as const };

function blobStore() {
  return getStore("gongting-space");
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function codeCandidate() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function deviceKey(deviceId: string) {
  return `device/${encodeURIComponent(deviceId)}.json`;
}

function inviteKey(code: string) {
  return `invite/${encodeURIComponent(code)}.json`;
}

function spaceKey(spaceId: string) {
  return `space/${encodeURIComponent(spaceId)}.json`;
}

function presenceKey(deviceId: string) {
  return `presence/${encodeURIComponent(deviceId)}.json`;
}

async function readJSON<T>(key: string): Promise<T | null> {
  return await blobStore().get(key, { type: "json", ...strong }) as T | null;
}

async function writeJSON(key: string, value: unknown) {
  await blobStore().setJSON(key, value, { cacheControl: "no-store" });
}

async function saveSpace(space: SpaceDocument) {
  await writeJSON(spaceKey(space.id), space);
}

function safeAvatar(value: unknown) {
  return Math.max(0, Math.min(3, Math.floor(Number(value ?? 0))));
}

function safeScene(value: unknown) {
  void value;
  return "river" as const;
}

function activeSession(space: SpaceDocument) {
  return [...space.sessions].reverse().find((item) => item.status === "active") ?? null;
}

function latestEndedSession(space: SpaceDocument) {
  return [...space.sessions].reverse().find((item) => item.status === "ended") ?? null;
}

function visitCount(space: SpaceDocument) {
  return Math.max(1, space.sessions.length);
}

function phaseFor(session: Session | null) {
  if (!session) return "dusk";
  if (session.night_override) return "night";
  const elapsed = Date.now() - session.started_at;
  if (elapsed > 8 * 60_000) return "night";
  if (elapsed > 3 * 60_000) return "blue";
  return "dusk";
}

function addEvent(space: SpaceDocument, member: Member, session: Session, type: string, payload: Record<string, unknown> = {}) {
  space.events.push({
    id: id("evt"),
    session_id: session.id,
    space_id: space.id,
    member_id: member.id,
    type,
    payload: JSON.stringify(payload),
    created_at: Date.now(),
  });
}

async function createInviteCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = codeCandidate();
    if (!(await readJSON(inviteKey(code)))) return code;
  }
  return codeCandidate();
}

async function loadForDevice(deviceId: string) {
  const link = await readJSON<{ spaceId: string }>(deviceKey(deviceId));
  if (!link?.spaceId) return null;
  const space = await readJSON<SpaceDocument>(spaceKey(link.spaceId));
  if (!space) return null;
  const member = space.members.find((item) => item.device_id === deviceId);
  return member ? { space, member } : null;
}

async function invitationState(code: string) {
  const link = await readJSON<{ spaceId: string }>(inviteKey(code));
  if (!link?.spaceId) return null;
  const space = await readJSON<SpaceDocument>(spaceKey(link.spaceId));
  if (!space) return null;
  const host = space.members[0];
  const visits = visitCount(space);
  return {
    code,
    sceneId: "river" as const,
    host: host ? { nickname: host.nickname, avatarId: safeAvatar(host.avatar_id) } : null,
    visitCount: visits,
    props: PROPS.map((prop) => ({ ...prop, unlocked: visits >= prop.unlockAt })),
  };
}

async function getState(deviceId: string) {
  const loaded = await loadForDevice(deviceId);
  if (!loaded) return { paired: false };
  const { space, member } = loaded;
  const now = Date.now();
  await writeJSON(presenceKey(deviceId), { seenAt: now });
  const partner = space.members.find((item) => item.id !== member.id) ?? null;
  const partnerPresence = partner ? await readJSON<{ seenAt: number }>(presenceKey(partner.device_id)) : null;
  const session = activeSession(space);
  const lastSession = latestEndedSession(space);
  const events = session
    ? space.events.filter((item) => item.session_id === session.id).sort((a, b) => b.created_at - a.created_at).slice(0, 36)
    : [];
  const decoratedEvents = events.map((event) => {
    const owner = space.members.find((item) => item.id === event.member_id);
    return { ...event, nickname: owner?.nickname, avatar_id: owner?.avatar_id };
  });
  const lights = space.lights.slice(-24).map((light) => ({
    ...light,
    nickname: space.members.find((item) => item.id === light.member_id)?.nickname,
  }));
  const diary = lastSession
    ? space.diaries.find((item) => item.session_id === lastSession.id && item.member_id === member.id) ?? null
    : null;
  const sharedDiary = lastSession && partner
    ? space.diaries.find((item) => item.session_id === lastSession.id && item.member_id === partner.id && item.is_shared === 1) ?? null
    : null;
  const memories = space.sessions
    .filter((item) => item.status === "ended")
    .sort((a, b) => Number(b.ended_at ?? 0) - Number(a.ended_at ?? 0))
    .slice(0, 6)
    .map((memory) => {
      const memoryEvents = space.events.filter((item) => item.session_id === memory.id).sort((a, b) => a.created_at - b.created_at);
      const props = memoryEvents.filter((item) => item.type === "prop").map((item) => {
        try { return String(JSON.parse(item.payload).propId ?? ""); } catch { return ""; }
      }).filter(Boolean);
      return { ...memory, props: [...new Set(props)], eventCount: memoryEvents.length };
    });
  const visits = visitCount(space);
  const equipped = session
    ? space.equipped.filter((item) => item.session_id === session.id).map((item) => {
      const owner = space.members.find((entry) => entry.id === item.member_id);
      return { ...item, nickname: owner?.nickname, avatar_id: owner?.avatar_id };
    })
    : [];
  return {
    paired: true,
    member: { id: member.id, nickname: member.nickname, avatarId: safeAvatar(member.avatar_id) },
    partner: partner ? {
      id: partner.id,
      nickname: partner.nickname,
      avatarId: safeAvatar(partner.avatar_id),
      online: Boolean(partnerPresence && now - Number(partnerPresence.seenAt) < 8_000),
    } : null,
    space: { id: space.id, inviteCode: space.invite_code, title: space.title, sceneId: "river" },
    session: session ? { ...session, sceneId: "river", phase: phaseFor(session) } : null,
    events: decoratedEvents,
    lights,
    diary,
    sharedDiary: sharedDiary ? { ...sharedDiary, nickname: partner?.nickname } : null,
    memories,
    visitCount: visits,
    props: PROPS.map((prop) => ({ ...prop, unlocked: visits >= prop.unlockAt })),
    equipped,
    serverNow: now,
  };
}

function createSession(space: SpaceDocument, now: number): Session {
  const session: Session = {
    id: id("session"),
    space_id: space.id,
    scene_id: "river",
    status: "active",
    started_at: now,
    current_track: 0,
    playback_started_at: now,
    paused_at: null,
    is_playing: 1,
    closeness: 0,
    night_override: 0,
  };
  space.sessions.push(session);
  return session;
}

function generateDiaries(space: SpaceDocument, session: Session) {
  const sessionEvents = space.events.filter((item) => item.session_id === session.id).sort((a, b) => a.created_at - b.created_at);
  const trackEvent = [...sessionEvents].reverse().find((item) => item.type === "track");
  let chosenTrack = session.current_track;
  if (trackEvent) {
    try { chosenTrack = Number(JSON.parse(trackEvent.payload).track ?? session.current_track); } catch { chosenTrack = session.current_track; }
  }
  const closer = sessionEvents.find((item) => item.type === "closer");
  const light = sessionEvents.find((item) => item.type === "light");
  const usedProps = [...new Set(sessionEvents.filter((item) => item.type === "prop").map((item) => {
    try { return String(JSON.parse(item.payload).propId ?? ""); } catch { return ""; }
  }).filter(Boolean))];
  const minutes = Math.max(1, Math.round((Number(session.ended_at ?? Date.now()) - session.started_at) / 60_000));
  space.members.forEach((member, index) => {
    if (space.diaries.some((item) => item.session_id === session.id && item.member_id === member.id)) return;
    const other = space.members.find((item) => item.id !== member.id);
    const closerMember = closer ? space.members.find((item) => item.id === closer.member_id) : null;
    const propLine = usedProps.includes("camera")
      ? "拍立得把今晚留成了一张小小的照片。"
      : usedProps.includes("blanket")
        ? "那条毛毯让晚风变得没有那么凉。"
        : usedProps.includes("drinks")
          ? "碰杯的声音很轻，刚好盖过了一点江风。"
          : "我们没有特意安排什么，只是一起待着。";
    const facts = index === 0 ? [
      `今晚我和${other?.nickname ?? "TA"}在江边待了 ${minutes} 分钟。`,
      `我们一起听到了《${TRACKS[chosenTrack] ?? TRACKS[0]}》。`,
      closer ? `我记得${closerMember?.nickname ?? "TA"}靠近时，长椅轻轻响了一下。` : "我们并排看着天色慢慢暗下来。",
      propLine,
      light ? "对岸多了一盏属于我们的灯。" : "城市从黄昏变成了安静的蓝色。",
    ] : [
      `我在江边和${other?.nickname ?? "TA"}一起听了 ${minutes} 分钟的歌。`,
      `今晚留在耳边的是《${TRACKS[chosenTrack] ?? TRACKS[0]}》。`,
      closer ? "后来我们坐得近了一些，谁也没有急着说话。" : "晚风从我们中间经过，又慢慢安静下来。",
      propLine,
      light ? "离开以前，我们把一盏灯留在了对岸。" : "天色暗下来以后，我们还多坐了一会儿。",
    ];
    const now = Date.now();
    space.diaries.push({
      id: id("dia"),
      session_id: session.id,
      member_id: member.id,
      body: facts.join("\n"),
      representative_track: chosenTrack,
      is_shared: 0,
      created_at: now,
      updated_at: now,
    });
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("inviteCode")?.trim().toUpperCase();
    if (code) {
      const invite = await invitationState(code);
      return invite ? Response.json({ invite }) : Response.json({ error: "这张邀请已经找不到了" }, { status: 404 });
    }
    const deviceId = url.searchParams.get("deviceId")?.trim();
    if (!deviceId) return Response.json({ error: "缺少设备身份" }, { status: 400 });
    return Response.json(await getState(deviceId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "空间暂时不可用" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Payload;
    const deviceId = payload.deviceId?.trim();
    if (!deviceId) return Response.json({ error: "缺少设备身份" }, { status: 400 });
    const now = Date.now();

    if (payload.action === "reset") {
      const loaded = await loadForDevice(deviceId);
      if (!loaded) return Response.json({ paired: false });
      await Promise.all([
        ...loaded.space.members.map((item) => blobStore().delete(deviceKey(item.device_id))),
        ...loaded.space.members.map((item) => blobStore().delete(presenceKey(item.device_id))),
        blobStore().delete(inviteKey(loaded.space.invite_code)),
        blobStore().delete(spaceKey(loaded.space.id)),
      ]);
      return Response.json({ paired: false });
    }

    if (payload.action === "create") {
      if (await loadForDevice(deviceId)) return Response.json(await getState(deviceId));
      const nickname = payload.nickname?.trim().slice(0, 12);
      if (!nickname) return Response.json({ error: "给今晚留一个称呼" }, { status: 400 });
      const spaceId = id("space");
      const member: Member = {
        id: id("member"), device_id: deviceId, nickname, avatar_id: safeAvatar(payload.avatarId), created_at: now,
      };
      const space: SpaceDocument = {
        id: spaceId,
        invite_code: await createInviteCode(),
        title: "我们的共听空间",
        scene_id: safeScene(payload.sceneId),
        created_at: now,
        members: [member], sessions: [], events: [], lights: [], diaries: [], equipped: [],
      };
      const session = createSession(space, now);
      addEvent(space, member, session, "arrive");
      await saveSpace(space);
      await Promise.all([
        writeJSON(deviceKey(deviceId), { spaceId }),
        writeJSON(inviteKey(space.invite_code), { spaceId }),
      ]);
      return Response.json(await getState(deviceId));
    }

    if (payload.action === "join") {
      if (await loadForDevice(deviceId)) return Response.json(await getState(deviceId));
      const nickname = payload.nickname?.trim().slice(0, 12);
      const code = payload.inviteCode?.trim().toUpperCase();
      if (!nickname || !code) return Response.json({ error: "给今晚留一个称呼" }, { status: 400 });
      const link = await readJSON<{ spaceId: string }>(inviteKey(code));
      const space = link?.spaceId ? await readJSON<SpaceDocument>(spaceKey(link.spaceId)) : null;
      if (!space) return Response.json({ error: "这张邀请已经找不到了" }, { status: 404 });
      if (space.members.length >= 2) return Response.json({ error: "这个空间已经有两个人了" }, { status: 409 });
      const member: Member = {
        id: id("member"), device_id: deviceId, nickname, avatar_id: safeAvatar(payload.avatarId), created_at: now,
      };
      space.members.push(member);
      const session = activeSession(space) ?? createSession(space, now);
      addEvent(space, member, session, "arrive");
      await saveSpace(space);
      await writeJSON(deviceKey(deviceId), { spaceId: space.id });
      return Response.json(await getState(deviceId));
    }

    const loaded = await loadForDevice(deviceId);
    if (!loaded) return Response.json({ error: "请先进入空间" }, { status: 401 });
    const { space, member } = loaded;

    if (payload.action === "start") {
      const session = activeSession(space) ?? createSession(space, now);
      addEvent(space, member, session, "arrive");
      await saveSpace(space);
    }

    if (payload.action === "equip_prop") {
      const session = activeSession(space);
      if (!session) return Response.json({ error: "今晚还没有开始" }, { status: 409 });
      const prop = PROPS.find((item) => item.id === payload.propId);
      if (!prop || visitCount(space) < prop.unlockAt) return Response.json({ error: "这件东西还没有来到你们身边" }, { status: 403 });
      const existing = space.equipped.find((item) => item.session_id === session.id && item.member_id === member.id);
      if (existing) {
        existing.prop_id = prop.id;
        existing.equipped_at = now;
        existing.used_at = null;
      } else {
        space.equipped.push({ session_id: session.id, member_id: member.id, prop_id: prop.id, equipped_at: now, used_at: null });
      }
      addEvent(space, member, session, "equip", { propId: prop.id });
      await saveSpace(space);
    }

    if (payload.action === "event") {
      const session = activeSession(space);
      if (!session) return Response.json({ error: "今晚还没有开始" }, { status: 409 });
      const type = payload.eventType ?? "";
      if (type === "arrive") addEvent(space, member, session, "arrive");
      if (type === "closer") {
        session.closeness = Math.min(session.closeness + 1, 2);
        addEvent(space, member, session, "closer");
      }
      if (type === "light") {
        const colors = ["coral", "gold", "mint", "lilac"];
        space.lights.push({
          id: id("light"), space_id: space.id, session_id: session.id, member_id: member.id,
          color: colors[Math.floor(Math.random() * colors.length)], created_at: now,
        });
        addEvent(space, member, session, "light", { detail: payload.detail ?? "river" });
      }
      if (type === "ambient") addEvent(space, member, session, "ambient", { detail: payload.detail ?? "touch" });
      if (type === "prop") {
        const propId = String(payload.propId ?? "");
        if (space.members.length < 2) return Response.json({ error: "等 TA 来到身边再一起用" }, { status: 409 });
        const equipped = space.equipped.find((item) => item.session_id === session.id && item.prop_id === propId);
        if (!equipped) return Response.json({ error: "今晚没有带这件东西" }, { status: 409 });
        equipped.used_at = now;
        if (propId === "blanket") session.closeness = 2;
        addEvent(space, member, session, "prop", { propId });
      }
      if (type === "track") {
        const track = Math.max(0, Math.min(2, Number(payload.track ?? 0)));
        session.current_track = track;
        session.playback_started_at = now;
        session.paused_at = null;
        session.is_playing = 1;
        addEvent(space, member, session, "track", { track });
      }
      if (type === "toggle") {
        if (session.is_playing) {
          session.is_playing = 0;
          session.paused_at = now;
        } else {
          session.playback_started_at = now - (Number(session.paused_at ?? now) - session.playback_started_at);
          session.paused_at = null;
          session.is_playing = 1;
        }
        addEvent(space, member, session, "toggle");
      }
      if (type === "night") {
        session.night_override = 1;
        addEvent(space, member, session, "night");
      }
      if (type === "demo_next") {
        if (phaseFor(session) === "dusk") session.started_at = now - 4 * 60_000;
        else session.night_override = 1;
        addEvent(space, member, session, "demo_next");
      }
      if (type === "end") {
        addEvent(space, member, session, "leave");
        session.status = "ended";
        session.ended_at = now;
        session.is_playing = 0;
        generateDiaries(space, session);
      }
      await saveSpace(space);
    }

    if (payload.action === "save_diary") {
      const latest = latestEndedSession(space);
      if (!latest) return Response.json({ error: "还没有可以保存的今晚" }, { status: 409 });
      const diary = space.diaries.find((item) => item.session_id === latest.id && item.member_id === member.id);
      if (diary) {
        diary.body = payload.body?.slice(0, 1200) ?? "";
        diary.is_shared = payload.shared ? 1 : 0;
        diary.updated_at = now;
        await saveSpace(space);
      }
    }

    return Response.json(await getState(deviceId));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "空间暂时不可用" }, { status: 500 });
  }
}
