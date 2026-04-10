## Phase 1: Sentence unlock data layer

- Added `SENTENCE_MAP` with 12 word-to-sentence entries (Czech sentences for speech therapy).
- Added `SENTENCE_TRIGGER_CHANCE` (0.25) and `SENTENCE_TIMEOUT_MS` (5000) constants.
- Added `sentenceChallenge` state, `sentenceChallengeRef`, and `sentenceTimerRef` refs.
- Added sync effect for `sentenceChallengeRef`.
- Reset sentence state in `startGame` and `stopGame`.
- Added `sentenceTimerRef` cleanup to the unmount effect.
- No gameplay logic or visuals were changed.
