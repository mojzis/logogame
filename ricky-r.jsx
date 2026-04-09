import { useState, useEffect, useRef, useCallback } from "react";

const VERSION = "v3";

// ============================================================
// CONFIG — word sets by level, based on Czech logopedie progression
// ============================================================
const LEVELS = [
  {
    id: "dr",
    label: "DR",
    description: "Slova s DR",
    emoji: "🐉",
    words: [
      { word: "drak", emoji: "🐉" },
      { word: "drát", emoji: "🪡" },
      { word: "dráha", emoji: "🛤️" },
      { word: "dravec", emoji: "🦅" },
      { word: "drozd", emoji: "🐦" },
      { word: "drobek", emoji: "🍞" },
      { word: "druh", emoji: "🤝" },
      { word: "vydra", emoji: "🦦" },
      { word: "sádra", emoji: "🩹" },
      { word: "Ondra", emoji: "👦" },
      { word: "dráček", emoji: "🪁" },
      { word: "drsný", emoji: "🪨" },
      { word: "držák", emoji: "🔧" },
      { word: "droždí", emoji: "🫓" },
      { word: "družina", emoji: "🏫" },
    ],
  },
  {
    id: "tr",
    label: "TR",
    description: "Slova s TR",
    emoji: "🌳",
    words: [
      { word: "tráva", emoji: "🌿" },
      { word: "trám", emoji: "🪵" },
      { word: "tramvaj", emoji: "🚋" },
      { word: "trůn", emoji: "🪑" },
      { word: "trubka", emoji: "🎺" },
      { word: "trojka", emoji: "3️⃣" },
      { word: "strom", emoji: "🌳" },
      { word: "strach", emoji: "😨" },
      { word: "straka", emoji: "🐦‍⬛" },
      { word: "sestra", emoji: "👧" },
      { word: "traktor", emoji: "🚜" },
      { word: "trpaslík", emoji: "🧙" },
      { word: "truhla", emoji: "📦" },
      { word: "trnka", emoji: "🫐" },
      { word: "struna", emoji: "🎸" },
    ],
  },
];

const FALL_DURATION_MS = 8000;
const SPAWN_INTERVAL_MS = 3200;
const MAX_MISSES = 5;
const LANG = "cs-CZ";

const normalize = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const SpeechRecognition =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export default function RickyR() {
  const [screen, setScreen] = useState("menu");
  const [level, setLevel] = useState(null);
  const [fallingWords, setFallingWords] = useState([]);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [pops, setPops] = useState([]);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [supported, setSupported] = useState(true);
  const [micCheck, setMicCheck] = useState("idle"); // idle | listening | heard | error
  const [micCheckWord, setMicCheckWord] = useState("");

  const recognitionRef = useRef(null);
  const spawnTimerRef = useRef(null);
  const wordIdRef = useRef(0);
  const fallingRef = useRef([]);
  const levelRef = useRef(null);

  useEffect(() => { fallingRef.current = fallingWords; }, [fallingWords]);
  useEffect(() => { levelRef.current = level; }, [level]);

  useEffect(() => {
    if (!SpeechRecognition) { setSupported(false); return; }
    const rec = new SpeechRecognition();
    rec.lang = LANG;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    recognitionRef.current = rec;

    rec.onresult = (e) => {
      const latest = e.results[e.results.length - 1];
      const candidates = [];
      for (let i = 0; i < latest.length; i++) candidates.push(latest[i].transcript.trim());
      setHeard(candidates[0] || "");
      for (const candidate of candidates) {
        const tokens = normalize(candidate).split(/\s+/);
        for (const token of tokens) {
          const matched = fallingRef.current.find((fw) => normalize(fw.word) === token);
          if (matched) { handleMatch(matched); return; }
        }
      }
    };
    rec.onerror = (e) => { if (e.error !== "no-speech" && e.error !== "aborted") console.warn("Speech error:", e.error); };
    rec.onend = () => {
      if (recognitionRef.current?._shouldListen) { try { recognitionRef.current.start(); } catch (_) {} }
      else setListening(false);
    };
    return () => { rec._shouldListen = false; try { rec.stop(); } catch (_) {} };
  }, []);

  const handleMatch = useCallback((matched) => {
    setPops((p) => [...p, { id: matched.id, x: matched.x, emoji: matched.emoji, word: matched.word }]);
    setTimeout(() => setPops((p) => p.filter((v) => v.id !== matched.id)), 700);
    setFallingWords((p) => p.filter((fw) => fw.id !== matched.id));
    setScore((s) => s + 10);
    setCombo((c) => { const n = c + 1; setBestCombo((b) => Math.max(b, n)); return n; });
  }, []);

  const handleExpire = useCallback((id) => {
    setFallingWords((p) => p.filter((fw) => fw.id !== id));
    setMissed((m) => m + 1);
    setCombo(0);
  }, []);

  const startSpawning = useCallback(() => {
    const spawn = () => {
      const lv = levelRef.current;
      if (!lv) return;
      const entry = pickRandom(lv.words);
      const id = ++wordIdRef.current;
      const x = 12 + Math.random() * 66;
      setFallingWords((p) => [...p, { ...entry, id, x }]);
      setTimeout(() => handleExpire(id), FALL_DURATION_MS);
    };
    spawn();
    spawnTimerRef.current = setInterval(spawn, SPAWN_INTERVAL_MS);
  }, [handleExpire]);

  const runMicCheck = async () => {
    setMicCheck("listening");
    setMicCheckWord("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      setMicCheck("error");
      return;
    }
    if (!SpeechRecognition) { setMicCheck("error"); return; }
    const testRec = new SpeechRecognition();
    testRec.lang = LANG;
    testRec.continuous = false;
    testRec.interimResults = true;
    testRec.maxAlternatives = 1;
    testRec.onresult = (e) => {
      const transcript = e.results[e.results.length - 1][0].transcript.trim();
      setMicCheckWord(transcript);
      if (e.results[e.results.length - 1].isFinal) {
        setMicCheck("heard");
        try { testRec.stop(); } catch (_) {}
      }
    };
    testRec.onerror = () => setMicCheck("error");
    testRec.onend = () => { if (micCheck === "listening") setMicCheck("heard"); };
    // auto-stop after 5s
    setTimeout(() => { try { testRec.stop(); } catch (_) {} }, 5000);
    try { testRec.start(); } catch (_) { setMicCheck("error"); }
  };

  const startGame = async (lv) => {
    // Explicitly request mic permission first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the tracks — we just needed the permission grant
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      alert("Bez mikrofonu to nepůjde 😔 Povol prosím přístup k mikrofonu.");
      return;
    }

    setLevel(lv);
    setScore(0); setMissed(0); setCombo(0); setBestCombo(0);
    setFallingWords([]); setPops([]); setHeard("");
    wordIdRef.current = 0;
    setScreen("playing");
    setTimeout(() => {
      startSpawning();
      if (recognitionRef.current) {
        recognitionRef.current._shouldListen = true;
        try { recognitionRef.current.start(); setListening(true); } catch (_) {}
      }
    }, 50);
  };

  const stopGame = useCallback(() => {
    setScreen("over");
    clearInterval(spawnTimerRef.current);
    if (recognitionRef.current) {
      recognitionRef.current._shouldListen = false;
      try { recognitionRef.current.stop(); } catch (_) {}
      setListening(false);
    }
  }, []);

  useEffect(() => { if (missed >= MAX_MISSES && screen === "playing") stopGame(); }, [missed, screen, stopGame]);
  useEffect(() => () => clearInterval(spawnTimerRef.current), []);

  if (!supported) {
    return (
      <div style={S.container}>
        <div style={S.center}>
          <p style={{ fontSize: 48 }}>😔</p>
          <p style={{ color: "#cbd5e1" }}>Tvůj prohlížeč nepodporuje rozpoznávání řeči.</p>
          <p style={{ fontSize: 13, color: "#64748b" }}>Zkus Chrome na počítači nebo Android.</p>
        </div>
      </div>
    );
  }

  if (screen === "menu") {
    return (
      <div style={S.container}>
        <div style={S.stars} />
        <div style={S.center}>
          <div style={S.title}>Říkej nahlas!</div>
          <p style={{ fontSize: 15, color: "#94a3b8", marginBottom: 24 }}>Vyber si skupinu hlásek:</p>
          <div style={S.levelGrid}>
            {LEVELS.map((lv) => (
              <button key={lv.id} style={S.levelCard} onClick={() => startGame(lv)}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.06)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.6)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}>
                <span style={{ fontSize: 44 }}>{lv.emoji}</span>
                <span style={S.levelLabel}>{lv.label}</span>
                <span style={{ fontSize: 13, color: "#94a3b8" }}>{lv.description}</span>
                <span style={{ fontSize: 11, color: "#64748b", fontStyle: "italic" }}>
                  {lv.words.slice(0, 4).map((w) => w.word).join(", ")}…
                </span>
              </button>
            ))}
          </div>
          <p style={{ fontSize: 13, color: "#64748b" }}>🎤 Potřebuješ mikrofon a Chrome</p>

          {/* Mic check */}
          <button
            style={{ ...S.btn, background: micCheck === "heard" ? "linear-gradient(135deg, #059669, #10b981)" : micCheck === "error" ? "linear-gradient(135deg, #dc2626, #ef4444)" : "linear-gradient(135deg, #475569, #64748b)", fontSize: 14, padding: "8px 20px", marginTop: 12 }}
            onClick={runMicCheck}
          >
            {micCheck === "idle" && "🎤 Test mikrofonu"}
            {micCheck === "listening" && "🔴 Řekni cokoliv…"}
            {micCheck === "heard" && `✅ Slyším: "${micCheckWord}"`}
            {micCheck === "error" && "❌ Mikrofon nefunguje — zkus znovu"}
          </button>

          <p style={{ fontSize: 10, color: "#475569", marginTop: 16 }}>{VERSION}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={S.container}>
      <div style={S.stars} />
      <div style={S.badge}>{level?.label}</div>
      <div style={S.hud}>
        <HudItem label="Skóre" value={score} />
        <HudItem label="Kombo" value={`${combo}×`} color={combo > 2 ? "#fbbf24" : undefined} />
        <HudItem label="Pryč" value={`${missed}/${MAX_MISSES}`} color={missed >= 3 ? "#f87171" : undefined} />
      </div>
      {screen === "playing" && fallingWords.map((fw) => (
        <div key={fw.id} style={{ ...S.falling, left: `${fw.x}%`, animation: `fall ${FALL_DURATION_MS}ms linear forwards` }}>
          <span style={{ fontSize: 36 }}>{fw.emoji}</span>
          <span style={S.wordPill}>{fw.word}</span>
        </div>
      ))}
      {pops.map((p) => (
        <div key={p.id} style={{ ...S.pop, left: `${p.x}%` }}>
          <span style={{ fontSize: 32 }}>💥</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#34d399" }}>{p.word}</span>
        </div>
      ))}
      <div style={S.ground} />
      {screen === "playing" && heard && (
        <div style={S.heardBox}>🎤 <span style={{ fontSize: 16, color: "#e2e8f0", fontWeight: 600 }}>{heard}</span></div>
      )}
      {screen === "playing" && (
        <div style={{ ...S.micDot, background: listening ? "#34d399" : "#ef4444" }}>{listening ? "🟢" : "🔴"}</div>
      )}
      {screen === "over" && (
        <div style={S.overlay}>
          <div style={{ fontSize: 48, fontWeight: 900, color: "#f87171", marginBottom: 20 }}>Konec!</div>
          <div style={{ display: "flex", gap: 24, marginBottom: 28 }}>
            <StatBox value={score} label="bodů" />
            <StatBox value={`${bestCombo}×`} label="nejlepší kombo" />
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <button style={S.btn} onClick={() => startGame(level)}>🔄 Znovu</button>
            <button style={{ ...S.btn, background: "linear-gradient(135deg, #475569, #64748b)" }}
              onClick={() => { setScreen("menu"); setLevel(null); }}>◀ Menu</button>
          </div>
        </div>
      )}
    </div>
  );
}

function HudItem({ label, value, color }) {
  return (
    <div style={S.hudItem}>
      <span style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 800, color: color || "#e2e8f0" }}>{value}</span>
    </div>
  );
}

function StatBox({ value, label }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "16px 28px", textAlign: "center" }}>
      <div style={{ fontSize: 36, fontWeight: 800, color: "#e2e8f0" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
    </div>
  );
}

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
}`;

if (typeof document !== "undefined") {
  const id = "ricky-r-kf";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.textContent = keyframes + `\n@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;800;900&display=swap');`;
    document.head.appendChild(s);
  }
}

const S = {
  container: { position: "relative", width: "100%", height: "100vh", background: "linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #334155 100%)", overflow: "hidden", fontFamily: "'Nunito', 'Segoe UI', sans-serif", userSelect: "none" },
  stars: { position: "absolute", inset: 0, background: "radial-gradient(1px 1px at 20% 30%, white 0.5px, transparent 1px), radial-gradient(1px 1px at 40% 70%, white 0.5px, transparent 1px), radial-gradient(1px 1px at 60% 20%, white 0.5px, transparent 1px), radial-gradient(1.5px 1.5px at 10% 80%, rgba(255,255,255,0.6) 1px, transparent 1.5px)", opacity: 0.6, pointerEvents: "none" },
  center: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 10, textAlign: "center" },
  title: { fontSize: 48, fontWeight: 900, color: "#fff", marginBottom: 8, textShadow: "0 0 40px rgba(99,102,241,0.6)" },
  levelGrid: { display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", marginBottom: 24 },
  levelCard: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "24px 28px 20px", cursor: "pointer", transition: "transform 0.15s, border-color 0.15s", width: 160, color: "#fff", fontFamily: "inherit", fontSize: "inherit" },
  levelLabel: { fontSize: 28, fontWeight: 900, letterSpacing: 2, color: "#e2e8f0" },
  badge: { position: "absolute", top: 64, left: "50%", transform: "translateX(-50%)", fontSize: 14, fontWeight: 800, color: "#6366f1", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, padding: "3px 14px", letterSpacing: 2, zIndex: 10 },
  hud: { position: "absolute", top: 16, left: 16, right: 16, display: "flex", justifyContent: "space-between", zIndex: 10 },
  hudItem: { display: "flex", flexDirection: "column", alignItems: "center", background: "rgba(15,23,42,0.7)", borderRadius: 12, padding: "6px 16px", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" },
  falling: { position: "absolute", top: -80, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, transform: "translateX(-50%)", pointerEvents: "none", filter: "drop-shadow(0 0 12px rgba(99,102,241,0.5))" },
  wordPill: { fontSize: 20, fontWeight: 800, color: "#fff", background: "rgba(99,102,241,0.85)", padding: "4px 14px", borderRadius: 20, letterSpacing: 1, whiteSpace: "nowrap" },
  pop: { position: "absolute", top: "40%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", animation: "popAnim 0.7s ease-out forwards", pointerEvents: "none", zIndex: 20 },
  ground: { position: "absolute", bottom: 48, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, transparent, rgba(248,113,113,0.6), transparent)" },
  heardBox: { position: "absolute", bottom: 60, left: "50%", transform: "translateX(-50%)", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 16, padding: "8px 20px", backdropFilter: "blur(8px)", zIndex: 10, whiteSpace: "nowrap" },
  micDot: { position: "absolute", bottom: 16, right: 16, width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, zIndex: 10 },
  overlay: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.85)", backdropFilter: "blur(12px)", zIndex: 30, padding: 24 },
  btn: { fontSize: 18, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 16, padding: "12px 32px", cursor: "pointer", boxShadow: "0 4px 24px rgba(99,102,241,0.4)", fontFamily: "inherit" },
};
