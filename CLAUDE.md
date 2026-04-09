# Logogame — "Říkej nahlas!"

Czech speech recognition game for kids practicing consonant clusters (logopedie).
Words fall from the sky; the player says them aloud to score points.

## Tech stack

- React 19 + Vite 8, single-page app (no router)
- Bun for package management (`bun install`, not npm)
- Deployed to GitHub Pages via `.github/workflows/deploy.yml` on push to `master`
- Base path: `/logogame/`

## Project structure

```
src/
  main.jsx        — entry point, renders <RickyR />
  RickyR.jsx      — entire game (menu, playing, game-over screens + styles)
index.html        — shell HTML (lang="cs")
vite.config.js    — Vite config with React plugin and base path
ricky-r.jsx       — legacy/backup copy (not used in build)
```

## Commands

```sh
bun install       # install dependencies
bun run dev       # local dev server
bun run build     # production build → dist/
bun run preview   # preview production build
```

## Conventions

- All user-facing text is in Czech — use proper UTF-8 characters (á, č, ř, š, ž, ů…), never Unicode escapes
- Speech recognition uses `cs-CZ` locale
- Word matching normalizes away diacritics (NFD + strip combining marks) so voice input doesn't need exact accents
- Game levels are defined in the `LEVELS` array at the top of `RickyR.jsx`
- All styles are inline JS objects in the `S` constant at the bottom of `RickyR.jsx`
- No CSS files, no external component libraries
