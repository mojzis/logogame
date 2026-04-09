import { describe, expect, test } from "bun:test";
import { normalize, calcStars, pickRandom } from "./utils.js";

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
