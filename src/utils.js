export const normalize = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");

export function calcStars(missed) {
  if (missed === 0) return 3;
  if (missed <= 2) return 2;
  return 1;
}

export const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const WEIGHT_BASE = 1.0;
const WEIGHT_BOOST = 2.0;

export function pickWeighted(words, stats, exclude = []) {
  const excludeSet = new Set(exclude);
  let pool = words.filter((w) => !excludeSet.has(w.word));
  if (pool.length === 0) pool = words;

  const weights = pool.map((w) => {
    const s = stats[w.word];
    if (!s || s.hits + s.misses === 0) return WEIGHT_BASE + 0.5 * WEIGHT_BOOST;
    const missRate = s.misses / (s.hits + s.misses);
    return WEIGHT_BASE + missRate * WEIGHT_BOOST;
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

const STATS_KEY = "logogame-wordstats";

export function getWordStats(levelId) {
  try {
    const all = JSON.parse(localStorage.getItem(STATS_KEY) || "{}");
    return all[levelId] || {};
  } catch {
    return {};
  }
}

export function saveWordStats(levelId, roundResults) {
  if (!roundResults || roundResults.length === 0) return;
  try {
    const all = JSON.parse(localStorage.getItem(STATS_KEY) || "{}");
    const lvStats = all[levelId] || {};
    for (const { word, result } of roundResults) {
      if (!lvStats[word]) lvStats[word] = { hits: 0, misses: 0 };
      if (result === "hit") lvStats[word].hits++;
      else lvStats[word].misses++;
    }
    all[levelId] = lvStats;
    localStorage.setItem(STATS_KEY, JSON.stringify(all));
  } catch {
    // localStorage unavailable — silently skip
  }
}
