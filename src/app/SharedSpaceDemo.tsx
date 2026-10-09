"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PixiRiverScene from "./PixiRiverScene";

type Person = { id: string; nickname: string; avatarId: number; online?: boolean };
type SpaceState = {
  paired: boolean;
  member?: Person;
  partner?: Person | null;
  space?: { inviteCode: string; title: string; sceneId: "river" };
  session?: Record<string, unknown> | null;
  events?: Array<Record<string, unknown>>;
  lights?: Array<Record<string, unknown>>;
  diary?: Record<string, unknown> | null;
  sharedDiary?: Record<string, unknown> | null;
  memories?: Array<Record<string, unknown>>;
  props?: Array<{ id: string; name: string; unlockAt: number; unlocked: boolean }>;
  equipped?: Array<Record<string, unknown>>;
  visitCount?: number;
  serverNow?: number;
  error?: string;
};
type PropChoice = { id: string; name: string; unlockAt: number; unlocked: boolean };
type InvitePreview = { code: string; sceneId: "river"; host: { nickname: string; avatarId: number } | null; visitCount: number; props: PropChoice[] };

const avatars = [
  { name: "赤陶", note: "温暖、安静" },
  { name: "月白", note: "柔和、松弛" },
  { name: "青苔", note: "自然、自在" },
  { name: "雾蓝", note: "沉静、轻盈" },
];
const scene = { name: "外滩江畔", image: "/jiangpan-empty-bench.webp" } as const;
const tracks = [
  { title: "晚风经过江面", artist: "共听原创配乐", color: "#e89078", src: "/music/river-wind.m4a", duration: 64 },
  { title: "城市睡前曲", artist: "共听原创配乐", color: "#8a91c8", src: "/music/city-lullaby.m4a", duration: 64 },
  { title: "灯火慢慢亮起", artist: "共听原创配乐", color: "#d9b06f", src: "/music/neon-afterglow.m4a", duration: 64 },
];
const propMeta = {
  drinks: { name: "啤酒与汽水", note: "坐下来以后，和 TA 轻轻碰杯", glyph: "乾" },
  blanket: { name: "一条毛毯", note: "晚风凉下来时，盖在两个人膝上", glyph: "暖" },
  camera: { name: "拍立得", note: "把今晚留成一张小小的照片", glyph: "映" },
} as const;
const RELEASE_ID = "2026-10-09-handheld-props-v4";

function getDeviceId() {
  const previousRelease = window.localStorage.getItem("gongting-release-id");
  if (previousRelease !== RELEASE_ID) {
    const previousDevice = window.localStorage.getItem("gongting-device-id");
    if (previousDevice) window.sessionStorage.setItem("gongting-reset-device", previousDevice);
    window.localStorage.removeItem("gongting-device-id");
    window.localStorage.setItem("gongting-release-id", RELEASE_ID);
  }
  const saved = window.localStorage.getItem("gongting-device-id");
  if (saved) return saved;
  const next = crypto.randomUUID();
  window.localStorage.setItem("gongting-device-id", next);
  return next;
}

function formatTime(value: unknown) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(Number(value)));
}

function AvatarFigure({ avatarId, pose = 0 }: { avatarId: number; pose?: number }) {
  return <span className="avatar-figure" style={{ backgroundPosition: `${avatarId * 33.333}% ${pose * 33.333}%` }} aria-hidden="true" />;
}

export default function SharedSpaceDemo() {
  const [deviceId] = useState(() => typeof window === "undefined" ? "" : getDeviceId());
  const [data, setData] = useState<SpaceState | null>(null);
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [nickname, setNickname] = useState("");
  const [avatarId, setAvatarId] = useState(0);
  const [setupStep, setSetupStep] = useState<"avatar" | "prop">("avatar");
  const [preselectedProp, setPreselectedProp] = useState("drinks");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [showSongs, setShowSongs] = useState(false);
  const [showDiary, setShowDiary] = useState(false);
  const [showProps, setShowProps] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState("");
  const [demoMode] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1");
  const [diaryBody, setDiaryBody] = useState("");
  const [audioReady, setAudioReady] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const lastSignalRef = useRef("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async (id: string, quiet = false) => {
    try {
      const response = await fetch(`/api/space?deviceId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const next = await response.json() as SpaceState;
      if (!response.ok) throw new Error(next.error ?? "连接空间失败");
      setData(next);
      if (!quiet) lastSignalRef.current = String((next.events ?? []).find((event) => event.type === "track" && event.member_id !== next.member?.id)?.id ?? "");
      if (next.diary?.body && !quiet) setDiaryBody(String(next.diary.body));
    } catch (error) {
      if (!quiet) setNotice(error instanceof Error ? error.message : "连接空间失败");
    }
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("join")?.toUpperCase();
    if (code) {
      fetch(`/api/space?inviteCode=${encodeURIComponent(code)}`, { cache: "no-store" })
        .then(async (response) => {
          const result = await response.json() as { invite?: InvitePreview; error?: string };
          if (!response.ok) throw new Error(result.error ?? "邀请暂时打不开");
          if (result.invite) {
            setInvitePreview(result.invite);
          }
        })
        .catch((error) => setNotice(error instanceof Error ? error.message : "邀请暂时打不开"));
    }
    const bootTimer = window.setTimeout(async () => {
      const previousDevice = window.sessionStorage.getItem("gongting-reset-device");
      if (previousDevice) {
        try {
          await fetch("/api/space", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reset", deviceId: previousDevice }) });
        } finally {
          window.sessionStorage.removeItem("gongting-reset-device");
        }
      }
      await load(deviceId);
    }, 0);
    return () => window.clearTimeout(bootTimer);
  }, [deviceId, load]);

  useEffect(() => {
    if (!deviceId || !data?.paired) return;
    let cancelled = false;
    let timer = 0;
    const poll = async () => {
      await load(deviceId, true);
      if (!cancelled) timer = window.setTimeout(poll, 700);
    };
    timer = window.setTimeout(poll, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [data?.paired, deviceId, load]);

  const post = useCallback(async (payload: Record<string, unknown>) => {
    if (!deviceId) return null;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/space", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, deviceId }),
      });
      const next = await response.json() as SpaceState;
      if (!response.ok) throw new Error(next.error ?? "操作没有完成");
      setData(next);
      if (next.diary?.body) setDiaryBody(String(next.diary.body));
      return next;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "操作没有完成");
      return null;
    } finally {
      setBusy(false);
    }
  }, [deviceId]);

  const unlockAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = "auto";
      audio.loop = true;
      audio.volume = 0.68;
      audioRef.current = audio;
    }
    setAudioReady(true);
  }, []);

  const session = data?.session;
  const currentTrack = Number(session?.current_track ?? 0);
  const playing = Boolean(Number(session?.is_playing ?? 0));
  const phase = String(session?.phase ?? "dusk");
  const playbackStartedAt = Number(session?.playback_started_at ?? 0);
  const pausedAt = Number(session?.paused_at ?? 0);

  useEffect(() => {
    if (!audioReady || !session || !audioRef.current) return;
    const audio = audioRef.current;
    const track = tracks[currentTrack] ?? tracks[0];
    if (!audio.src.endsWith(track.src)) audio.src = track.src;
    const referenceTime = playing ? Date.now() : (pausedAt || Date.now());
    const target = Math.max(0, ((referenceTime - playbackStartedAt) / 1000) % track.duration);
    if (!Number.isFinite(audio.currentTime) || Math.abs(audio.currentTime - target) > 1.15) audio.currentTime = target;
    const update = () => setAudioProgress(audio.currentTime / track.duration);
    audio.addEventListener("timeupdate", update);
    if (playing) void audio.play().catch(() => setAudioReady(false));
    else audio.pause();
    return () => audio.removeEventListener("timeupdate", update);
  }, [audioReady, currentTrack, pausedAt, playing, playbackStartedAt, session]);

  const partnerTrackEvent = useMemo(() => (data?.events ?? []).find((event) => event.type === "track" && event.member_id !== data?.member?.id), [data?.events, data?.member?.id]);
  useEffect(() => {
    if (!partnerTrackEvent?.id || String(partnerTrackEvent.id) === lastSignalRef.current) return;
    lastSignalRef.current = String(partnerTrackEvent.id);
    const showTimer = window.setTimeout(() => setNotice(`${String(partnerTrackEvent.nickname)} 放给你的 · ${tracks[currentTrack]?.title}`), 0);
    const hideTimer = window.setTimeout(() => setNotice(""), 3200);
    return () => { window.clearTimeout(showTimer); window.clearTimeout(hideTimer); };
  }, [partnerTrackEvent, currentTrack]);

  const shareInvite = async () => {
    const url = `${window.location.origin}/?join=${data?.space?.inviteCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "来陪我听一会儿", text: `我今晚在${scene.name}等你。`, url });
        return;
      } catch { /* user closed the share sheet */ }
    }
    await navigator.clipboard.writeText(url);
    setNotice("邀请已经放进剪贴板");
  };

  const enterFromSetup = async () => {
    if (!nickname.trim()) return setNotice("给今晚留一个称呼");
    unlockAudio();
    if (setupStep === "avatar") {
      setSetupStep("prop");
    } else if (setupStep === "prop" && invitePreview) {
      const next = await post({ action: "join", nickname, avatarId, inviteCode: invitePreview.code });
      if (next) await post({ action: "equip_prop", propId: preselectedProp });
    } else if (setupStep === "prop") {
      const next = await post({ action: "create", nickname, avatarId, sceneId: "river" });
      if (next) {
        await post({ action: "equip_prop", propId: preselectedProp });
        setInviteOpen(true);
      }
    }
  };

  const equipProp = async (propId: string) => {
    const next = await post({ action: "equip_prop", propId });
    if (next) setShowProps(false);
  };

  const resetDemo = async () => {
    const next = await post({ action: "reset" });
    if (next) {
      window.localStorage.removeItem("gongting-device-id");
      window.location.href = demoMode ? "/?demo=1" : "/";
    }
  };

  const endTonight = async () => {
    const next = await post({ action: "event", eventType: "end" });
    if (!next) return;
    const firstMemory = next.memories?.[0];
    if (firstMemory?.id) setSelectedMemory(String(firstMemory.id));
    if (next.diary?.body) setDiaryBody(String(next.diary.body));
    setShowDiary(true);
  };

  const renderMemoryPanel = () => {
    if (!showDiary || !data) return null;
    const memories = data.memories ?? [];
    const activeMemory = memories.find((memory) => String(memory.id) === selectedMemory) ?? memories[0];
    const memoryProps = (activeMemory?.props as string[] | undefined) ?? [];
    return (
      <section className="memory-panel">
        <button className="close-button" onClick={() => setShowDiary(false)} aria-label="关闭">×</button>
        <p className="eyebrow">空间记得你们来过</p>
        <h2>我们的今晚</h2>
        {activeMemory && <article className="memory-card-detail">
          <time>{formatTime(activeMemory.ended_at)}</time>
          <strong>{tracks[Number(activeMemory.current_track ?? 0)]?.title}</strong>
          <div className="memory-prop-row">{memoryProps.map((prop) => <span key={prop}>{propMeta[prop as keyof typeof propMeta]?.glyph}</span>)}</div>
          <p>{memoryProps.includes("camera") ? "那张拍立得还留着江面的晚霞。" : memoryProps.includes("blanket") ? "那晚风有一点凉，好在毛毯还留在长椅上。" : memoryProps.includes("drinks") ? "你们碰了杯，然后继续看着对岸亮起来。" : "你们在这里一起待了一会儿。"}</p>
        </article>}
        {data.diary ? <><textarea value={diaryBody} onChange={(event) => setDiaryBody(event.target.value)} aria-label="日记内容" /><label className="share-toggle"><input type="checkbox" checked={Boolean(Number(data.diary.is_shared))} onChange={(event) => void post({ action: "save_diary", body: diaryBody, shared: event.target.checked })} /> 分享给 TA</label><button className="secondary-button" onClick={() => void post({ action: "save_diary", body: diaryBody, shared: Boolean(Number(data.diary?.is_shared)) })}>保存这一页</button></> : <p className="empty-copy">等今晚结束以后，这里会留下只属于你的那一页。</p>}
        {data.sharedDiary && <div className="shared-diary"><span>{String(data.sharedDiary.nickname)} 分享给你的</span><p>{String(data.sharedDiary.body)}</p></div>}
        {memories.length > 0 && <div className="memory-times">{memories.map((memory) => <button className={String(memory.id) === String(activeMemory?.id) ? "selected" : ""} key={String(memory.id)} onClick={() => setSelectedMemory(String(memory.id))}>{formatTime(memory.ended_at)}</button>)}</div>}
      </section>
    );
  };

  if (!data) return <main className="loading-screen"><span className="loading-dot" /></main>;

  if (!data.paired) {
    if (setupStep === "prop") {
      const availableProps = invitePreview?.props ?? [
        { id: "drinks", name: propMeta.drinks.name, unlockAt: 1, unlocked: true },
        { id: "blanket", name: propMeta.blanket.name, unlockAt: 2, unlocked: false },
        { id: "camera", name: propMeta.camera.name, unlockAt: 3, unlocked: false },
      ];
      const visitCount = invitePreview?.visitCount ?? 1;
      return (
        <main className="prop-setup">
          <img className="prop-setup-art" src={scene.image} alt="今晚的场景" />
          <div className="setup-vignette" />
          <header className="quiet-brand">共听空间</header>
          <section className="prop-setup-stage">
            <p className="setup-kicker">第 {visitCount} 次相见 · 出发以前</p>
            <h1>今晚带什么去</h1>
            <div className="setup-prop-grid">
              {availableProps.map((prop) => {
                const meta = propMeta[prop.id as keyof typeof propMeta];
                return <button key={prop.id} disabled={!prop.unlocked} className={preselectedProp === prop.id ? "selected" : ""} onClick={() => setPreselectedProp(prop.id)}>
                  <span className={`prop-art prop-${prop.id}`} />
                  <strong>{prop.unlocked ? meta.name : `再相见 ${prop.unlockAt - visitCount} 次`}</strong>
                  <small>{prop.unlocked ? meta.note : "它会在以后的约会里出现"}</small>
                </button>;
              })}
            </div>
            <button className="setup-continue" disabled={busy} onClick={enterFromSetup}>{invitePreview ? "带着它，去 TA 身边" : "带上它，继续出发"}</button>
          </section>
          <button className="setup-back" onClick={() => setSetupStep("avatar")} aria-label="返回选择形象">←</button>
          {notice && <div className="toast">{notice}</div>}
        </main>
      );
    }

    const backdrop = invitePreview ? scene.image : "/jiangpan-dusk.webp";
    return (
      <main className="avatar-setup">
        <img className="avatar-setup-art" src={backdrop} alt="黄昏中的共同空间" />
        <div className="setup-vignette" />
        <header className="quiet-brand">共听空间</header>
        {invitePreview?.host && <div className="waiting-person"><AvatarFigure avatarId={invitePreview.host.avatarId} pose={2} /><span>{invitePreview.host.nickname} 在这里等你</span></div>}
        <section className="avatar-stage">
          <p>{invitePreview ? "去 TA 身边以前" : "今晚，你想以什么样子出现"}</p>
          <div className="chosen-avatar"><AvatarFigure avatarId={avatarId} /></div>
          <div className="avatar-carousel" role="listbox" aria-label="选择形象">
            {avatars.map((avatar, index) => (
              <button key={avatar.name} className={avatarId === index ? "selected" : ""} onClick={() => setAvatarId(index)} aria-label={`${avatar.name}：${avatar.note}`} aria-pressed={avatarId === index}>
                <AvatarFigure avatarId={index} />
              </button>
            ))}
          </div>
          <div className="name-step">
            <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="留下你的称呼" maxLength={12} aria-label="你的称呼" />
            <button disabled={busy} onClick={enterFromSetup} aria-label="继续选择道具">→</button>
          </div>
        </section>
        {notice && <div className="toast">{notice}</div>}
      </main>
    );
  }

  if (!session || !data.member || !data.space) {
    return (
      <main className="return-space">
        <img src={scene.image} alt={scene.name} />
        <div className="setup-vignette" />
        <header className="quiet-brand">共听空间</header>
        <section><p>{data.partner?.online ? `${data.partner.nickname}也在` : "你们上次停在这里"}</p><h1>再待一会儿</h1><button onClick={async () => { unlockAudio(); const next = await post({ action: "start" }); if (next) setShowProps(true); }}>走进去</button></section>
        <button className="memory-orb" onClick={() => setShowDiary(true)} aria-label="打开共同记忆">◌</button>
        {renderMemoryPanel()}
      </main>
    );
  }

  const duration = Math.max(1, Math.floor((Number(data.serverNow ?? session.started_at) - Number(session.started_at)) / 60_000));
  const cuddled = Number(session.closeness ?? 0) > 0;
  const equipped = data.equipped ?? [];
  const myProp = equipped.find((item) => item.member_id === data.member?.id);

  return (
    <main className={`space-scene phase-${phase}`}>
      <PixiRiverScene
        phase={phase}
        member={data.member}
        partner={data.partner ?? null}
        cuddled={cuddled}
        lights={data.lights ?? []}
        events={data.events ?? []}
        equipped={equipped}
        onCuddle={() => void post({ action: "event", eventType: "closer" })}
        onLight={() => void post({ action: "event", eventType: "light", detail: "window" })}
        onAmbient={(detail) => void post({ action: "event", eventType: "ambient", detail })}
        onProp={(propId) => data.partner ? void post({ action: "event", eventType: "prop", propId }) : setInviteOpen(true)}
        onSongs={() => setShowSongs(true)}
        onInvite={() => setInviteOpen(true)}
      />

      <header className="scene-presence">
        <div><span className="presence-dot active" />{data.member.nickname}</div>
        <span className="together-time">{data.partner ? `${data.partner.nickname}${data.partner.online ? " · 在这里" : " · 稍后回来"}` : `等 TA 来 · ${duration} 分钟`}</span>
        <nav>
          <button onClick={() => setInviteOpen(true)} aria-label={data.partner ? "分享共同空间" : "邀请恋人"}>⌁</button>
          <button onClick={() => setShowProps(true)} aria-label="今晚带来的东西">♧</button>
          <button onClick={() => setShowDiary(true)} aria-label="共同记忆">◌</button>
          <button onClick={() => void endTonight()} aria-label="结束今晚并查看日记">☾</button>
        </nav>
      </header>

      {!audioReady ? (
        <button className="sound-awaken" onClick={unlockAudio} aria-label="让音乐响起">♪</button>
      ) : (
        <section className="listening-puck">
          <button className="song-glyph" style={{ background: tracks[currentTrack].color }} onClick={() => setShowSongs(true)} aria-label="选择歌曲">♪</button>
          <button className="puck-title" onClick={() => setShowSongs(true)}><strong>{tracks[currentTrack].title}</strong><span>{tracks[currentTrack].artist}</span></button>
          <button className="puck-play" onClick={() => void post({ action: "event", eventType: "toggle" })} aria-label={playing ? "暂停" : "播放"}>{playing ? "Ⅱ" : "▶"}</button>
          <i className="puck-progress" style={{ transform: `scaleX(${audioProgress})` }} />
        </section>
      )}

      {showProps && (
        <div className="soft-backdrop" onClick={() => myProp && setShowProps(false)}>
          <section className="prop-tray" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <p className="eyebrow">第 {data.visitCount ?? 1} 次相见</p>
            <h2>今晚带一件东西</h2>
            <p className="prop-intro">到了江边，它会自然出现在你们身旁。</p>
            <div className="prop-grid">{(data.props ?? []).map((prop) => {
              const meta = propMeta[prop.id as keyof typeof propMeta];
              const selected = myProp?.prop_id === prop.id;
              return <button key={prop.id} disabled={!prop.unlocked || busy} className={selected ? "selected" : ""} onClick={() => void equipProp(prop.id)}><span className={`prop-art prop-${prop.id}`} /><strong>{prop.unlocked ? meta?.name : `再见 ${prop.unlockAt - (data.visitCount ?? 1)} 次`}</strong><small>{prop.unlocked ? meta?.note : "它会在以后来到这里"}</small></button>;
            })}</div>
            {myProp && <button className="secondary-button" onClick={() => setShowProps(false)}>就带这个</button>}
          </section>
        </div>
      )}

      {inviteOpen && (
        <div className="soft-backdrop" onClick={() => { setInviteOpen(false); if (!myProp) setShowProps(true); }}>
          <section className="invite-postcard" onClick={(event) => event.stopPropagation()}>
            <img src={scene.image} alt="你们今晚的场景" />
            <div>
              <span>{scene.name}</span>
              <h2>{data.member.nickname} 在这里等你</h2>
              <p>打开以后，沿着晚风走到我身边。</p>
              <button onClick={shareInvite}>把这张邀请送给 TA</button>
            </div>
            <button className="postcard-close" onClick={() => { setInviteOpen(false); if (!myProp) setShowProps(true); }} aria-label="收起邀请">×</button>
          </section>
        </div>
      )}

      {showSongs && (
        <div className="soft-backdrop" onClick={() => setShowSongs(false)}>
          <section className="song-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <p className="eyebrow">放一首给 TA</p>
            {tracks.map((track, index) => <button className="song-row" key={track.title} onClick={() => { unlockAudio(); setShowSongs(false); void post({ action: "event", eventType: "track", track: index }); }}><span style={{ background: track.color }}>♪</span><div><strong>{track.title}</strong><small>{track.artist}</small></div><b>{index === currentTrack ? "正在听" : "播放"}</b></button>)}
          </section>
        </div>
      )}

      {renderMemoryPanel()}
      {demoMode && <aside className="demo-tools"><button onClick={() => void post({ action: "event", eventType: "demo_next" })}>天色前进</button><button onClick={() => void endTonight()}>生成记忆</button><button onClick={() => void resetDemo()}>重新开始</button></aside>}
      {notice && <div className="toast">{notice}</div>}
    </main>
  );
}
