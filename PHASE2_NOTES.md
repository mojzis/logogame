## Phase 2: Sentence Unlock Gameplay Logic

- `handleMatch` now checks `SENTENCE_MAP` and rolls 25% chance to trigger sentence mode
- Sentence-mode words stay on screen (sentenceMode flag, fixed position) instead of popping
- `clearSentence` helper removes the word and resets challenge state
- `handleSentenceMatch` awards 20 bonus points with pop animation for the full sentence
- Speech recognition checks sentence keywords before normal word matching
- `handleExpire` skips miss penalty for sentence-mode words
- Auto-clear timeout (5s) removes sentence challenge without penalty
- Visuals not yet updated (Phase 3)
