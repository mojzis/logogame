## Phase 3: Sentence unlock visuals

- Sentence-mode words render as a golden pill centered at 50% x, 40% y
- Shows the full sentence text from `sentenceChallenge.sentence`
- Czech cue "teď řekni celou větu!" displayed below the pill
- `sentenceExpand` keyframe animates the bubble appearing (scale 0.5 -> 1)
- `sentenceGlow` keyframe pulses the pill's box-shadow continuously
- Three new S entries: `sentenceBubble`, `sentencePill`, `sentenceCue`
- No gameplay logic was changed; only rendering and styles added
