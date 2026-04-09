import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { normalize, calcStars, pickRandom } from "./utils.js";

const VERSION = "v6";

// ============================================================
// CONFIG — word sets by level, based on Czech logopedie progression
// ============================================================
const LEVELS = [
  {
    id: "dr",
    label: "DR",
    description: "Slova s DR",
    emoji: "\u{1F409}",
    words: [
      { word: "drak", emoji: "\u{1F409}" },
      { word: "drát", emoji: "\u{1FAA1}" },
      { word: "dráha", emoji: "\u{1F6E4}\uFE0F" },
      { word: "dravec", emoji: "\u{1F985}" },
      { word: "drozd", emoji: "\u{1F426}" },
      { word: "drobek", emoji: "\u{1F35E}" },
      { word: "druh", emoji: "\u{1F91D}" },
      { word: "vydra", emoji: "\u{1F9A6}" },
      { word: "sádra", emoji: "\u{1FA79}" },
      { word: "Ondra", emoji: "\u{1F466}" },
      { word: "dráček", emoji: "\u{1FA81}" },
      { word: "drsný", emoji: "\u{1FAA8}" },
      { word: "držák", emoji: "\u{1F527}" },
      { word: "droždí", emoji: "\u{1FAD3}" },
      { word: "družina", emoji: "\u{1F3EB}" },
    ],
  },
  {
    id: "tr",
    label: "TR",
    description: "Slova s TR",
    emoji: "\u{1F333}",
    words: [
      { word: "tráva", emoji: "\u{1F33F}" },
      { word: "trám", emoji: "\u{1FAB5}" },
      { word: "tramvaj", emoji: "\u{1F68B}" },
      { word: "trůn", emoji: "\u{1FA91}" },
      { word: "trubka", emoji: "\u{1F3BA}" },
      { word: "trojka", emoji: "3\uFE0F\u20E3" },
      { word: "strom", emoji: "\u{1F333}" },
      { word: "strach", emoji: "\u{1F628}" },
      { word: "straka", emoji: "\u{1F426}\u200D\u2B1B" },
      { word: "sestra", emoji: "\u{1F467}" },
      { word: "traktor", emoji: "\u{1F69C}" },
      { word: "trpaslík", emoji: "\u{1F9D9}" },
      { word: "truhla", emoji: "\u{1F4E6}" },
      { word: "trnka", emoji: "\u{1FAD0}" },
      { word: "struna", emoji: "\u{1F3B8}" },
    ],
  },
];

// ============================================================
// WAVE CONFIG — tweak pacing here
// Each round = 3 waves; words per wave, fall speed, spawn interval
// ============================================================
const WAVE_CONFIG = [
  { wordCount: 6,  fallDuration: 9000, spawnInterval: 3500 },  // calm
  { wordCount: 8,  fallDuration: 7500, spawnInterval: 2800 },  // picking up
  { wordCount: 10, fallDuration: 6500, spawnInterval: 2200 },  // fast, overlapping
];
const WAVE_BANNER_DURATION_MS = 1500;
const MAX_MISSES = 5;
const LANG = "cs-CZ";

const SENTENCE_MAP = {
  drozd:   { sentence: "Drozd má velký zobák.",     keywords: ["drozd", "zobák"] },
  drak:    { sentence: "Drak letí přes hrad.",       keywords: ["drak", "hrad"] },
  vydra:   { sentence: "Vydra loví v řece.",         keywords: ["vydra", "řece", "loví"] },
  dráha:   { sentence: "Vlak jede po dráze.",        keywords: ["vlak", "dráze"] },
  tráva:   { sentence: "Tráva je zelená.",           keywords: ["tráva", "zelená"] },
  strom:   { sentence: "Strom roste v lese.",        keywords: ["strom", "lese"] },
  straka:  { sentence: "Straka krade lesklé věci.",  keywords: ["straka", "krade"] },
  traktor: { sentence: "Traktor jede po poli.",      keywords: ["traktor", "poli"] },
  trubka:  { sentence: "Na trubku hraje trumpetista.", keywords: ["trubka", "trumpetista"] },
  sestra:  { sentence: "Sestra čte knížku.",         keywords: ["sestra", "knížku"] },
  sádra:   { sentence: "Na ruce má sádru.",          keywords: ["ruce", "sádru"] },
  trpaslík: { sentence: "Trpaslík bydlí v lese.",   keywords: ["trpaslík", "lese", "bydlí"] },
};
const SENTENCE_TRIGGER_CHANCE = 0.25;
const SENTENCE_TIMEOUT_MS = 5000;

const SpeechRecognition =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

// ============================================================
// KEYFRAMES & STYLES — defined before components that reference S
// ============================================================
const keyframes = `
@keyframes fall {
  0%   { top: -80px; opacity: 0; transform: translateX(-50%) scale(0.7); }
  5%   { opacity: 1; transform: translateX(-50%) scale(1); }
  85%  { opacity: 1; }
  100% { top: calc(100% - 60px); opacity: 0.3; }
}
@keyframes popAnim {
  0%   { transform: scale(1); opacity: 1; }
  100% { transform: scale(2.5); opacity: 0; }
}
@keyframes wavePulse {
  0%   { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
  20%  { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
  80%  { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1.3); opacity: 0; }
}
@keyframes dragonFly {
  0%   { left: -15%; top: 30%; transform: scaleX(1) scale(1); }
  25%  { top: 15%; transform: scaleX(1) scale(1.2); }
  50%  { top: 35%; transform: scaleX(1) scale(1); }
  75%  { top: 20%; transform: scaleX(1) scale(1.1); }
  100% { left: 115%; top: 25%; transform: scaleX(1) scale(1); }
}
@keyframes starScaleIn {
  0%   { transform: scale(0); opacity: 0; }
  50%  { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes sentenceExpand {
  0%   { transform: translateX(-50%) scale(0.5); opacity: 0; }
  60%  { transform: translateX(-50%) scale(1.05); opacity: 1; }
  100% { transform: translateX(-50%) scale(1); opacity: 1; }
}
@keyframes sentenceGlow {
  0%, 100% { box-shadow: 0 0 24px rgba(251,191,36,0.4), 0 0 48px rgba(251,191,36,0.2); }
  50%      { box-shadow: 0 0 32px rgba(251,191,36,0.6), 0 0 64px rgba(251,191,36,0.3); }
}`;

if (typeof document !== "undefined") {
  const id = "ricky-r-kf";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.textContent =
      keyframes +
      `\n@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;800;900&display=swap');`;
    document.head.appendChild(s);
  }
}

const S = {
  container: {
    position: "relative",
    width: "100%",
    height: "100vh",
    background:
      "linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #334155 100%)",
    overflow: "hidden",
    fontFamily: "'Nunito', 'Segoe UI', sans-serif",
    userSelect: "none",
  },
  stars: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(1px 1px at 20% 30%, white 0.5px, transparent 1px), radial-gradient(1px 1px at 40% 70%, white 0.5px, transparent 1px), radial-gradient(1px 1px at 60% 20%, white 0.5px, transparent 1px), radial-gradient(1.5px 1.5px at 10% 80%, rgba(255,255,255,0.6) 1px, transparent 1.5px)",
    opacity: 0.6,
    pointerEvents: "none",
  },
  center: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 10,
    textAlign: "center",
  },
  title: {
    fontSize: 48,
    fontWeight: 900,
    color: "#fff",
    marginBottom: 8,
    textShadow: "0 0 40px rgba(99,102,241,0.6)",
  },
  levelGrid: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 24,
  },
  levelCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 20,
    padding: "24px 28px 20px",
    cursor: "pointer",
    transition: "transform 0.15s, border-color 0.15s",
    width: 160,
    color: "#fff",
    fontFamily: "inherit",
    fontSize: "inherit",
  },
  levelLabel: {
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: 2,
    color: "#e2e8f0",
  },
  badge: {
    position: "absolute",
    top: 64,
    left: "50%",
    transform: "translateX(-50%)",
    fontSize: 14,
    fontWeight: 800,
    color: "#6366f1",
    background: "rgba(99,102,241,0.12)",
    border: "1px solid rgba(99,102,241,0.3)",
    borderRadius: 8,
    padding: "3px 14px",
    letterSpacing: 2,
    zIndex: 10,
  },
  hud: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    display: "flex",
    justifyContent: "space-between",
    zIndex: 10,
  },
  hudItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    background: "rgba(15,23,42,0.7)",
    borderRadius: 12,
    padding: "6px 16px",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  falling: {
    position: "absolute",
    top: -80,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    transform: "translateX(-50%)",
    pointerEvents: "none",
    filter: "drop-shadow(0 0 12px rgba(99,102,241,0.5))",
  },
  wordPill: {
    fontSize: 20,
    fontWeight: 800,
    color: "#fff",
    background: "rgba(99,102,241,0.85)",
    padding: "4px 14px",
    borderRadius: 20,
    letterSpacing: 1,
    whiteSpace: "nowrap",
  },
  pop: {
    position: "absolute",
    top: "40%",
    transform: "translateX(-50%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    animation: "popAnim 0.7s ease-out forwards",
    pointerEvents: "none",
    zIndex: 20,
  },
  waveBanner: {
    position: "absolute",
    top: "40%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    fontSize: 56,
    fontWeight: 900,
    color: "#fbbf24",
    textShadow: "0 0 40px rgba(251,191,36,0.6), 0 4px 20px rgba(0,0,0,0.5)",
    zIndex: 25,
    pointerEvents: "none",
    animation: `wavePulse ${WAVE_BANNER_DURATION_MS}ms ease-out forwards`,
  },
  ground: {
    position: "absolute",
    bottom: 48,
    left: 0,
    right: 0,
    height: 3,
    background:
      "linear-gradient(90deg, transparent, rgba(248,113,113,0.6), transparent)",
  },
  heardBox: {
    position: "absolute",
    bottom: 60,
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(15,23,42,0.8)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 16,
    padding: "8px 20px",
    backdropFilter: "blur(8px)",
    zIndex: 10,
    whiteSpace: "nowrap",
  },
  micDot: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    zIndex: 10,
  },
  overlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(15,23,42,0.85)",
    backdropFilter: "blur(12px)",
    zIndex: 30,
    padding: 24,
  },
  btn: {
    fontSize: 18,
    fontWeight: 700,
    color: "#fff",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    border: "none",
    borderRadius: 16,
    padding: "12px 32px",
    cursor: "pointer",
    boxShadow: "0 4px 24px rgba(99,102,241,0.4)",
    fontFamily: "inherit",
  },
  confettiCanvas: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: 0,
  },
  dragonFly: {
    position: "absolute",
    fontSize: 80,
    animation: "dragonFly 4s linear infinite",
    pointerEvents: "none",
    zIndex: 1,
  },
  celebrationStars: {
    display: "flex",
    gap: 12,
    marginBottom: 12,
    zIndex: 2,
  },
  celebrationStar: {
    fontSize: 64,
    display: "inline-block",
    animation: "starScaleIn 0.5s ease-out both",
  },
  celebrationMessage: {
    fontSize: 48,
    fontWeight: 900,
    color: "#fbbf24",
    marginBottom: 20,
    textShadow: "0 0 40px rgba(251,191,36,0.6)",
    zIndex: 2,
  },
  sentenceBubble: {
    position: "absolute",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    transform: "translateX(-50%)",
    pointerEvents: "none",
    zIndex: 15,
    animation: "sentenceExpand 0.4s ease-out",
  },
  sentencePill: {
    fontSize: 22,
    fontWeight: 800,
    color: "#fff",
    background: "linear-gradient(135deg, rgba(251,191,36,0.85), rgba(245,158,11,0.85))",
    padding: "8px 24px",
    borderRadius: 24,
    letterSpacing: 0.5,
    whiteSpace: "nowrap",
    boxShadow: "0 0 24px rgba(251,191,36,0.4), 0 0 48px rgba(251,191,36,0.2)",
    animation: "sentenceGlow 1.5s ease-in-out infinite",
  },
  sentenceCue: {
    fontSize: 14,
    fontWeight: 600,
    color: "#fbbf24",
    opacity: 0.8,
    fontStyle: "italic",
  },
};

function HudItem({ label, value, color }) {
  return (
    <div style={S.hudItem}>
      <span
        style={{
          fontSize: 11,
          color: "#94a3b8",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 800, color: color || "#e2e8f0" }}>
        {value}
      </span>
    </div>
  );
}

function StatBox({ value, label }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16,
        padding: "16px 28px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 36, fontWeight: 800, color: "#e2e8f0" }}>
        {value}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#94a3b8",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function getStoredStars() {
  try { return JSON.parse(localStorage.getItem("logogame-stars") || "{}"); }
  catch { return {}; }
}

function saveStars(levelId, stars) {
  const stored = getStoredStars();
  if (!stored[levelId] || stars > stored[levelId]) {
    stored[levelId] = stars;
    localStorage.setItem("logogame-stars", JSON.stringify(stored));
  }
}

function ConfettiCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;
    const COLORS = ["#ef4444","#fbbf24","#34d399","#3b82f6","#a855f7","#f97316","#ec4899"];
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      size: 4 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      speed: 1 + Math.random() * 2,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.02 + Math.random() * 0.03,
    }));
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.y += p.speed;
        p.wobble += p.wobbleSpeed;
        p.x += Math.sin(p.wobble) * 1.5;
        if (p.y > canvas.height + 10) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={canvasRef} style={S.confettiCanvas} />;
}

export default function RickyR() {
  const [screen, setScreen] = useState("menu");
  const [level, setLevel] = useState(null);
  const [fallingWords, setFallingWords] = useState([]);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [pops, setPops] = useState([]);
  const [wave, setWave] = useState(0);
  const [waveBanner, setWaveBanner] = useState(null);
  const [roundComplete, setRoundComplete] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [supported, setSupported] = useState(true);
  const [micCheck, setMicCheck] = useState("idle"); // idle | listening | heard | error
  const [micCheckWord, setMicCheckWord] = useState("");
  const [sentenceChallenge, setSentenceChallenge] = useState(null);

  const recognitionRef = useRef(null);
  const spawnTimerRef = useRef(null);
  const wordIdRef = useRef(0);
  const fallingRef = useRef([]);
  const levelRef = useRef(null);
  const shouldListenRef = useRef(false);
  const waveRef = useRef(0);
  const wordsSpawnedInWaveRef = useRef(0);
  const waveSpawningDoneRef = useRef(false);
  const sentenceChallengeRef = useRef(null);
  const sentenceTimerRef = useRef(null);

  useEffect(() => {
    fallingRef.current = fallingWords;
  }, [fallingWords]);
  useEffect(() => {
    levelRef.current = level;
  }, [level]);
  useEffect(() => {
    sentenceChallengeRef.current = sentenceChallenge;
  }, [sentenceChallenge]);

  // Check support on mount, but don't create recognition yet
  useEffect(() => {
    if (!SpeechRecognition) setSupported(false);
  }, []);

  const clearSentence = useCallback((id) => {
    setSentenceChallenge(null);
    clearTimeout(sentenceTimerRef.current);
    setFallingWords((p) => p.filter((fw) => fw.id !== id));
  }, []);

  const handleSentenceMatch = useCallback((challenge) => {
    clearSentence(challenge.id);
    setPops((p) => [
      ...p,
      { id: challenge.id, x: challenge.x, emoji: challenge.emoji, word: challenge.sentence },
    ]);
    setTimeout(() => setPops((p) => p.filter((v) => v.id !== challenge.id)), 700);
    setScore((s) => s + 20);
  }, [clearSentence]);

  const handleMatch = useCallback((matched) => {
    // Check if this word can trigger a sentence challenge
    const entry = SENTENCE_MAP[matched.word.toLowerCase()];
    if (entry && Math.random() < SENTENCE_TRIGGER_CHANCE && !sentenceChallengeRef.current) {
      // Trigger sentence mode — award points but keep word on screen
      setScore((s) => s + 10);
      setCombo((c) => {
        const n = c + 1;
        setBestCombo((b) => Math.max(b, n));
        return n;
      });
      setFallingWords((p) =>
        p.map((fw) =>
          fw.id === matched.id
            ? { ...fw, sentenceMode: true, top: "40%" }
            : fw,
        ),
      );
      setSentenceChallenge({
        id: matched.id,
        x: matched.x,
        sentence: entry.sentence,
        keywords: entry.keywords,
        word: matched.word,
        emoji: matched.emoji,
      });
      sentenceTimerRef.current = setTimeout(() => clearSentence(matched.id), SENTENCE_TIMEOUT_MS);
      return;
    }

    // Normal match — pop animation, remove word, award points
    setPops((p) => [
      ...p,
      { id: matched.id, x: matched.x, emoji: matched.emoji, word: matched.word },
    ]);
    setTimeout(
      () => setPops((p) => p.filter((v) => v.id !== matched.id)),
      700,
    );
    setFallingWords((p) => p.filter((fw) => fw.id !== matched.id));
    setScore((s) => s + 10);
    setCombo((c) => {
      const n = c + 1;
      setBestCombo((b) => Math.max(b, n));
      return n;
    });
  }, [clearSentence]);

  const handleExpire = useCallback((id) => {
    setFallingWords((p) => {
      const fw = p.find((w) => w.id === id);
      if (!fw) return p; // already matched — don't count as miss
      if (fw.sentenceMode) {
        // Sentence mode word — clear without penalty
        setTimeout(() => clearSentence(id), 0);
        return p.filter((w) => w.id !== id);
      }
      // Use setTimeout so missed/combo update after this setState
      setTimeout(() => {
        setMissed((m) => m + 1);
        setCombo(0);
      }, 0);
      return p.filter((w) => w.id !== id);
    });
  }, [clearSentence]);

  const startWave = useCallback(
    (waveIndex) => {
      const cfg = WAVE_CONFIG[waveIndex];
      if (!cfg) return;
      waveRef.current = waveIndex;
      wordsSpawnedInWaveRef.current = 0;
      waveSpawningDoneRef.current = false;
      setWave(waveIndex);

      const spawn = () => {
        const lv = levelRef.current;
        if (!lv) return;
        wordsSpawnedInWaveRef.current++;
        const entry = pickRandom(lv.words);
        const id = ++wordIdRef.current;
        const x = 12 + Math.random() * 66;
        setFallingWords((p) => [...p, { ...entry, id, x, fallDuration: cfg.fallDuration }]);
        setTimeout(() => handleExpire(id), cfg.fallDuration);

        if (wordsSpawnedInWaveRef.current < cfg.wordCount) {
          spawnTimerRef.current = setTimeout(spawn, cfg.spawnInterval);
        } else {
          waveSpawningDoneRef.current = true;
        }
      };
      spawn();
    },
    [handleExpire],
  );

  const advanceWave = useCallback(() => {
    const nextWave = waveRef.current + 1;
    if (nextWave >= WAVE_CONFIG.length) {
      setRoundComplete(true);
      return;
    }
    setWaveBanner(`Vlna ${nextWave + 1}!`);
    setTimeout(() => {
      setWaveBanner(null);
      startWave(nextWave);
    }, WAVE_BANNER_DURATION_MS);
  }, [startWave]);

  // Create a fresh SpeechRecognition instance and start it.
  // Called after mic permission is already granted.
  const startListening = useCallback(() => {
    // Clean up any prior instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch { /* speech API may throw if already stopped */ }
    }

    const rec = new SpeechRecognition();
    rec.lang = LANG;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    recognitionRef.current = rec;
    shouldListenRef.current = true;

    rec.onresult = (e) => {
      const latest = e.results[e.results.length - 1];
      const candidates = [];
      for (let i = 0; i < latest.length; i++)
        candidates.push(latest[i].transcript.trim());
      setHeard(candidates[0] || "");

      // Check active sentence challenge first
      const sc = sentenceChallengeRef.current;
      if (sc) {
        for (const candidate of candidates) {
          const tokens = normalize(candidate).split(/\s+/);
          const matchedKeywords = sc.keywords.filter((kw) =>
            tokens.some((t) => normalize(kw) === t),
          );
          if (matchedKeywords.length >= 1) {
            handleSentenceMatch(sc);
            return;
          }
        }
      }

      for (const candidate of candidates) {
        const tokens = normalize(candidate).split(/\s+/);
        for (const token of tokens) {
          const matched = fallingRef.current.find(
            (fw) => normalize(fw.word) === token,
          );
          if (matched) {
            handleMatch(matched);
            return;
          }
        }
      }
    };

    rec.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted")
        console.warn("Speech error:", e.error);
    };

    rec.onend = () => {
      if (shouldListenRef.current) {
        try {
          recognitionRef.current.start();
        } catch { /* speech API may throw if already stopped */ }
      } else {
        setListening(false);
      }
    };

    try {
      rec.start();
      setListening(true);
    } catch { /* speech API may throw if already stopped */ }
  }, [handleMatch, handleSentenceMatch]);

  const runMicCheck = async () => {
    setMicCheck("listening");
    setMicCheckWord("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setMicCheck("error");
      return;
    }
    if (!SpeechRecognition) {
      setMicCheck("error");
      return;
    }
    const testRec = new SpeechRecognition();
    testRec.lang = LANG;
    testRec.continuous = false;
    testRec.interimResults = true;
    testRec.maxAlternatives = 1;
    testRec.onresult = (e) => {
      const transcript =
        e.results[e.results.length - 1][0].transcript.trim();
      setMicCheckWord(transcript);
      if (e.results[e.results.length - 1].isFinal) {
        setMicCheck("heard");
        try {
          testRec.stop();
        } catch { /* speech API may throw if already stopped */ }
      }
    };
    testRec.onerror = () => setMicCheck("error");
    testRec.onend = () => {
      setMicCheck((prev) => (prev === "listening" ? "heard" : prev));
    };
    setTimeout(() => {
      try {
        testRec.stop();
      } catch { /* speech API may throw if already stopped */ }
    }, 5000);
    try {
      testRec.start();
    } catch {
      setMicCheck("error");
    }
  };

  const startGame = async (lv) => {
    // Request mic permission first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      alert(
        "Bez mikrofonu to nepůjde 😔 Povol prosím přístup k mikrofonu.",
      );
      return;
    }

    setLevel(lv);
    setScore(0);
    setMissed(0);
    setCombo(0);
    setBestCombo(0);
    setFallingWords([]);
    setPops([]);
    setHeard("");
    setWave(0);
    setWaveBanner(null);
    setRoundComplete(false);
    setSentenceChallenge(null);
    clearTimeout(sentenceTimerRef.current);
    wordIdRef.current = 0;
    waveRef.current = 0;
    wordsSpawnedInWaveRef.current = 0;
    waveSpawningDoneRef.current = false;
    setScreen("playing");

    // Small delay so React flushes state, then start wave 1 + listening
    setTimeout(() => {
      startWave(0);
      startListening();
    }, 50);
  };

  const stopGame = useCallback((celebrate = false) => {
    setScreen(celebrate ? "celebration" : "over");
    clearTimeout(spawnTimerRef.current);
    shouldListenRef.current = false;
    setSentenceChallenge(null);
    clearTimeout(sentenceTimerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch { /* speech API may throw if already stopped */ }
      setListening(false);
    }
  }, []);

  // Advance wave when all words are resolved
  useEffect(() => {
    if (
      screen === "playing" &&
      !waveBanner &&
      waveSpawningDoneRef.current &&
      fallingWords.length === 0
    ) {
      advanceWave();
    }
  }, [fallingWords.length, screen, waveBanner, advanceWave]);

  // Round complete → go to celebration screen
  useEffect(() => {
    if (roundComplete && screen === "playing") stopGame(true);
  }, [roundComplete, screen, stopGame]);

  useEffect(() => {
    if (missed >= MAX_MISSES && screen === "playing") stopGame();
  }, [missed, screen, stopGame]);

  useEffect(() => () => clearTimeout(spawnTimerRef.current), []);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      clearTimeout(sentenceTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch { /* speech API may throw if already stopped */ }
      }
    };
  }, []);

  const celebrationStars = useMemo(() => calcStars(missed), [missed]);

  // Save stars to localStorage when celebration screen is shown
  useEffect(() => {
    if (screen === "celebration" && level) {
      saveStars(level.id, celebrationStars);
    }
  }, [screen, level, celebrationStars]);

  if (!supported) {
    return (
      <div style={S.container}>
        <div style={S.center}>
          <p style={{ fontSize: 48 }}>{"\u{1F614}"}</p>
          <p style={{ color: "#cbd5e1" }}>
            Tvůj prohlížeč nepodporuje rozpoznávání řeči.
          </p>
          <p style={{ fontSize: 13, color: "#64748b" }}>
            Zkus Chrome na počítači nebo Android.
          </p>
        </div>
      </div>
    );
  }

  const storedStars = screen === "menu" ? getStoredStars() : {};

  if (screen === "menu") {
    return (
      <div style={S.container}>
        <div style={S.stars} />
        <div style={S.center}>
          <div style={S.title}>{"Říkej nahlas!"}</div>
          <p style={{ fontSize: 15, color: "#94a3b8", marginBottom: 24 }}>
            Vyber si skupinu hlásek:
          </p>
          <div style={S.levelGrid}>
            {LEVELS.map((lv) => {
              const best = storedStars[lv.id];
              return (
              <button
                key={lv.id}
                style={S.levelCard}
                onClick={() => startGame(lv)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.06)";
                  e.currentTarget.style.borderColor = "rgba(99,102,241,0.6)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                }}
              >
                <span style={{ fontSize: 44 }}>{lv.emoji}</span>
                <span style={S.levelLabel}>{lv.label}</span>
                <span style={{ fontSize: 13, color: "#94a3b8" }}>
                  {lv.description}
                </span>
                <span
                  style={{ fontSize: 11, color: "#64748b", fontStyle: "italic" }}
                >
                  {lv.words.slice(0, 4).map((w) => w.word).join(", ")}&hellip;
                </span>
                {best != null && (
                  <span style={{ fontSize: 18, marginTop: 4 }}>
                    {Array.from({ length: 3 }, (_, i) =>
                      i < best ? "\u2B50" : "\u2606"
                    ).join("")}
                  </span>
                )}
              </button>
              );
            })}
          </div>
          <p style={{ fontSize: 13, color: "#64748b" }}>
            {"\u{1F3A4}"} Potřebuješ mikrofon a Chrome
          </p>

          {/* Mic check */}
          <button
            style={{
              ...S.btn,
              background:
                micCheck === "heard"
                  ? "linear-gradient(135deg, #059669, #10b981)"
                  : micCheck === "error"
                    ? "linear-gradient(135deg, #dc2626, #ef4444)"
                    : "linear-gradient(135deg, #475569, #64748b)",
              fontSize: 14,
              padding: "8px 20px",
              marginTop: 12,
            }}
            onClick={runMicCheck}
          >
            {micCheck === "idle" && "\u{1F3A4} Test mikrofonu"}
            {micCheck === "listening" && "\u{1F534} Řekni cokoliv\u2026"}
            {micCheck === "heard" &&
              `\u2705 Slyším: \u201E${micCheckWord}\u201C`}
            {micCheck === "error" &&
              "\u274C Mikrofon nefunguje \u2014 zkus znovu"}
          </button>

          <p style={{ fontSize: 10, color: "#475569", marginTop: 16 }}>
            {VERSION}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={S.container}>
      <div style={S.stars} />
      <div style={S.badge}>{level?.label} — vlna {wave + 1}/{WAVE_CONFIG.length}</div>
      <div style={S.hud}>
        <HudItem label="Skóre" value={score} />
        <HudItem
          label="Kombo"
          value={`${combo}\u00D7`}
          color={combo > 2 ? "#fbbf24" : undefined}
        />
        <HudItem
          label="Pryč"
          value={`${missed}/${MAX_MISSES}`}
          color={missed >= 3 ? "#f87171" : undefined}
        />
      </div>
      {screen === "playing" &&
        fallingWords.map((fw) => {
          if (fw.sentenceMode) {
            return (
              <div
                key={fw.id}
                style={{
                  ...S.sentenceBubble,
                  left: "50%",
                  top: fw.top,
                }}
              >
                <span style={{ fontSize: 36 }}>{fw.emoji}</span>
                <span style={S.sentencePill}>
                  {sentenceChallenge?.sentence || fw.word}
                </span>
                <span style={S.sentenceCue}>teď řekni celou větu!</span>
              </div>
            );
          }
          return (
            <div
              key={fw.id}
              style={{
                ...S.falling,
                left: `${fw.x}%`,
                animation: `fall ${fw.fallDuration}ms linear forwards`,
              }}
            >
              <span style={{ fontSize: 36 }}>{fw.emoji}</span>
              <span style={S.wordPill}>{fw.word}</span>
            </div>
          );
        })}
      {pops.map((p) => (
        <div key={p.id} style={{ ...S.pop, left: `${p.x}%` }}>
          <span style={{ fontSize: 32 }}>{"\u{1F4A5}"}</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#34d399" }}>
            {p.word}
          </span>
        </div>
      ))}
      {waveBanner && (
        <div style={S.waveBanner}>{waveBanner}</div>
      )}
      <div style={S.ground} />
      {screen === "playing" && heard && (
        <div style={S.heardBox}>
          {"\u{1F3A4}"}{" "}
          <span style={{ fontSize: 16, color: "#e2e8f0", fontWeight: 600 }}>
            {heard}
          </span>
        </div>
      )}
      {screen === "playing" && (
        <div
          style={{
            ...S.micDot,
            background: listening ? "#34d399" : "#ef4444",
          }}
        >
          {listening ? "\u{1F7E2}" : "\u{1F534}"}
        </div>
      )}
      {screen === "celebration" && (
        <div style={S.overlay}>
          <ConfettiCanvas />
          <div style={S.dragonFly}>🐉</div>
          <div style={S.celebrationStars}>
            {Array.from({ length: celebrationStars }, (_, i) => (
              <span
                key={i}
                style={{
                  ...S.celebrationStar,
                  animationDelay: `${i * 0.2}s`,
                }}
              >
                ⭐
              </span>
            ))}
          </div>
          <div style={S.celebrationMessage}>
            {celebrationStars === 3
              ? "Perfektní!"
              : celebrationStars === 2
                ? "Skvělé!"
                : "Výborně!"}
          </div>
          <div style={{ display: "flex", gap: 24, marginBottom: 28 }}>
            <StatBox value={score} label="bodů" />
            <StatBox value={`${bestCombo}\u00D7`} label="nejlepší kombo" />
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button style={S.btn} onClick={() => startGame(level)}>
              Další kolo
            </button>
            <button
              style={{
                ...S.btn,
                background: "linear-gradient(135deg, #475569, #64748b)",
              }}
              onClick={() => {
                setScreen("menu");
                setLevel(null);
              }}
            >
              Menu
            </button>
          </div>
        </div>
      )}
      {screen === "over" && (
        <div style={S.overlay}>
          <div
            style={{
              fontSize: 48,
              fontWeight: 900,
              color: roundComplete ? "#34d399" : "#f87171",
              marginBottom: 20,
            }}
          >
            {roundComplete ? "Super!" : "Konec!"}
          </div>
          <div style={{ display: "flex", gap: 24, marginBottom: 28 }}>
            <StatBox value={score} label="bodů" />
            <StatBox value={`${bestCombo}\u00D7`} label="nejlepší kombo" />
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button style={S.btn} onClick={() => startGame(level)}>
              {"\u{1F504}"} Znovu
            </button>
            <button
              style={{
                ...S.btn,
                background: "linear-gradient(135deg, #475569, #64748b)",
              }}
              onClick={() => {
                setScreen("menu");
                setLevel(null);
              }}
            >
              {"\u25C0"} Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
