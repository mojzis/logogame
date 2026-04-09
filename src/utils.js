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
