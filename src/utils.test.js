import { describe, expect, test, beforeEach } from "bun:test";
import { normalize, calcStars, pickRandom, pickWeighted, getWordStats, saveWordStats, matchesSentenceKeywords } from "./utils.js";

describe("normalize", () => {
  test("lowercases and strips diacritics", () => {
    expect(normalize("Příšerně")).toBe("priserne");
  });

  test("handles č, ř, š, ž, ů", () => {
    expect(normalize("čřšžů")).toBe("crszu");
  });

  test("strips non-alpha characters", () => {
    expect(normalize("a-b c!2")).toBe("abc");
  });

  test("already plain ASCII passes through", () => {
    expect(normalize("hello")).toBe("hello");
  });

  test("empty string returns empty", () => {
    expect(normalize("")).toBe("");
  });
});

describe("calcStars", () => {
  test("0 missed → 3 stars", () => {
    expect(calcStars(0)).toBe(3);
  });

  test("1 missed → 2 stars", () => {
    expect(calcStars(1)).toBe(2);
  });

  test("2 missed → 2 stars", () => {
    expect(calcStars(2)).toBe(2);
  });

  test("3 missed → 1 star", () => {
    expect(calcStars(3)).toBe(1);
  });

  test("large number → 1 star", () => {
    expect(calcStars(100)).toBe(1);
  });
});

describe("pickRandom", () => {
  test("returns an element from the array", () => {
    const arr = ["a", "b", "c"];
    const result = pickRandom(arr);
    expect(arr).toContain(result);
  });

  test("single-element array always returns that element", () => {
    expect(pickRandom([42])).toBe(42);
  });
});

describe("pickWeighted", () => {
  const words = [
    { word: "aaa", emoji: "A" },
    { word: "bbb", emoji: "B" },
    { word: "ccc", emoji: "C" },
  ];

  test("returns an element from the array", () => {
    const result = pickWeighted(words, {});
    expect(words).toContain(result);
  });

  test("with empty stats behaves like uniform random", () => {
    const counts = { aaa: 0, bbb: 0, ccc: 0 };
    for (let i = 0; i < 3000; i++) {
      counts[pickWeighted(words, {}).word]++;
    }
    // All unseen → equal weight → roughly uniform
    for (const w of Object.keys(counts)) {
      expect(counts[w]).toBeGreaterThan(700);
      expect(counts[w]).toBeLessThan(1300);
    }
  });

  test("biases toward high-miss-rate words", () => {
    const stats = {
      aaa: { hits: 10, misses: 0 },  // mastered, weight 1.0
      bbb: { hits: 0, misses: 10 },  // struggling, weight 3.0
      ccc: { hits: 5, misses: 5 },   // 50%, weight 2.0
    };
    const counts = { aaa: 0, bbb: 0, ccc: 0 };
    for (let i = 0; i < 6000; i++) {
      counts[pickWeighted(words, stats).word]++;
    }
    // bbb should appear most, aaa least
    expect(counts.bbb).toBeGreaterThan(counts.ccc);
    expect(counts.ccc).toBeGreaterThan(counts.aaa);
  });

  test("respects exclude parameter", () => {
    const counts = { aaa: 0, bbb: 0, ccc: 0 };
    for (let i = 0; i < 1000; i++) {
      counts[pickWeighted(words, {}, ["aaa"]).word]++;
    }
    expect(counts.aaa).toBe(0);
    expect(counts.bbb).toBeGreaterThan(0);
    expect(counts.ccc).toBeGreaterThan(0);
  });

  test("falls back to full pool when all excluded", () => {
    const result = pickWeighted(words, {}, ["aaa", "bbb", "ccc"]);
    expect(words).toContain(result);
  });

  test("single word always returns it", () => {
    const single = [{ word: "solo", emoji: "S" }];
    expect(pickWeighted(single, {}).word).toBe("solo");
  });
});

describe("matchesSentenceKeywords", () => {
  test("matches a single keyword in transcript", () => {
    const result = matchesSentenceKeywords(["drak", "hrad"], "Drak letí přes hrad");
    expect(result).toEqual(["drak", "hrad"]);
  });

  test("matches keywords ignoring diacritics", () => {
    const result = matchesSentenceKeywords(["tráva", "zelená"], "trava je zelena");
    expect(result).toEqual(["tráva", "zelená"]);
  });

  test("returns empty array when no keywords match", () => {
    const result = matchesSentenceKeywords(["drak", "hrad"], "kočka spí na gauči");
    expect(result).toEqual([]);
  });

  test("handles empty transcript", () => {
    const result = matchesSentenceKeywords(["drak"], "");
    expect(result).toEqual([]);
  });

  test("handles partial word — does not match substring", () => {
    const result = matchesSentenceKeywords(["les"], "lesklé věci");
    expect(result).toEqual([]);
  });

  test("matches case-insensitively", () => {
    const result = matchesSentenceKeywords(["Straka", "krade"], "STRAKA KRADE");
    expect(result).toEqual(["Straka", "krade"]);
  });

  test("returns only the matched subset of keywords", () => {
    const result = matchesSentenceKeywords(["trpaslík", "lese", "bydlí"], "trpaslík je tady");
    expect(result).toEqual(["trpaslík"]);
  });
});

describe("getWordStats / saveWordStats", () => {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
    clear: () => { for (const k in store) delete store[k]; },
  };

  beforeEach(() => {
    localStorage.clear();
  });

  test("returns empty object for unknown level", () => {
    expect(getWordStats("unknown")).toEqual({});
  });

  test("round-trips hits and misses", () => {
    saveWordStats("dr", [
      { word: "drak", result: "hit" },
      { word: "drak", result: "hit" },
      { word: "drát", result: "miss" },
    ]);
    const stats = getWordStats("dr");
    expect(stats.drak).toEqual({ hits: 2, misses: 0 });
    expect(stats.drát).toEqual({ hits: 0, misses: 1 });
  });

  test("accumulates across multiple rounds", () => {
    saveWordStats("dr", [{ word: "drak", result: "hit" }]);
    saveWordStats("dr", [{ word: "drak", result: "miss" }]);
    const stats = getWordStats("dr");
    expect(stats.drak).toEqual({ hits: 1, misses: 1 });
  });

  test("keeps levels separate", () => {
    saveWordStats("dr", [{ word: "drak", result: "hit" }]);
    saveWordStats("tr", [{ word: "tráva", result: "miss" }]);
    expect(getWordStats("dr")).toEqual({ drak: { hits: 1, misses: 0 } });
    expect(getWordStats("tr")).toEqual({ tráva: { hits: 0, misses: 1 } });
  });

  test("skips save with empty results", () => {
    saveWordStats("dr", []);
    expect(getWordStats("dr")).toEqual({});
  });
});
