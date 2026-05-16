# Chord player — project summary

## Concept

A progressive web app (PWA) that lets you explore diatonic chords in any key. Pick a root and mode, tap a chord button, and the app plays it with smart voice leading — automatically choosing the inversion that minimises movement from the previous chord.

Allow the user to override the inversion to be played.

A planned second mode adds ear training: the app plays a chord and you identify it.

---

## Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Vanilla JS or React | No strong preference yet — vanilla is fine for v1 |
| Audio | Tone.js 14.x | PolySynth with triangle oscillator to start; swap to Sampler later for piano/guitar |
| Styling | CSS custom properties | Match a clean flat aesthetic |
| PWA | Vite PWA plugin | Service worker + manifest for offline support |

---

## Features — v1

### Key / mode selector
- Root note: C, C#, D, Eb, E, F, F#, G, Ab, A, Bb, B
- Mode: Major, Minor (natural)

### Chord grid
- 7 buttons, one per diatonic degree (I ii iii IV V vi vii°)
- Each button shows: Roman numeral degree, chord name (e.g. Dm), quality hint
- Tapping plays the chord and highlights the active button

### Keyboard shortcuts
Chords can be triggered from the keyboard without touching the mouse:

| Row | Keys | Inversion | Degrees |
|---|---|---|---|
| Bottom | `z x c v b n m` | Root position | I ii iii IV V vi vii° |
| Middle | `a s d f g h j` | 1st inversion | I ii iii IV V vi vii° |
| Top | `q w e r t y u` | 2nd inversion | I ii iii IV V vi vii° |

- Each row maps left-to-right to scale degrees I–VII.
- Pressing a key plays the chord in the specified inversion (overriding the voice-leading algorithm for that tap) and highlights the corresponding button.
- Keys are layout-independent mnemonics: the bottom row (`z–m`) approximates the note names C–B on a piano.

### Voice leading
- On each chord tap, compute the inversion that minimises total voice movement from the previous chord
- Avoid 2nd inversion except for chord V. Prefer not inverting the I chord.
- Keep voicings broadly within octave 4 (C4–B4); allow adjacent octaves only when voice leading strongly favours it
- Reset voice leading state when key or mode changes
- Display the bass note and inversion name below the grid (e.g. "G / B (1st inv)")
- The bass note should be repeated an octave below to give a solid bass

### Sound engine (v1)
- Tone.js `PolySynth` + `Synth`
- Oscillator: triangle
- Envelope: attack 0.04, decay 0.3, sustain 0.5, release 1.2
- Block chords (all notes simultaneously)
- Volume: −8 dB

---

## Features — v2 (planned)

### 7th chords
- Toggle to extend all triads to their diatonic 7th (Imaj7, ii7, iii7, IVmaj7, V7, vim7, viiø7)
- Voice leading algorithm unchanged — just add a 4th note

### Sustain control
- Toggle: chord holds until next tap vs. auto-releases after a fixed duration
- Duration slider (0.5s – 4s)

### Realistic sound
- Swap `PolySynth` for `Tone.Sampler` using Salamander Grand Piano samples (free, ~5 MB subset)
- UI toggle: Synth / Piano

### Ear training mode
- App plays a random diatonic chord (hidden)
- User sees 4 chord name buttons and selects their answer
- Feedback: correct / incorrect, then reveal
- Score tracker per session

---

## Music theory — implementation notes

### Scale construction
```
Major intervals (semitones from root): 0 2 4 5 7 9 11
Minor intervals:                       0 2 3 5 7 8 10
```

### Diatonic triad qualities
```
Major key: maj min min maj maj min dim
Minor key: min dim maj min min maj maj
```

### Triad interval patterns
```
Major triad:      0  4  7
Minor triad:      0  3  7
Diminished triad: 0  3  6
```

### Voice leading algorithm
1. For each candidate inversion × octave (octave 3–5), generate sorted MIDI pitches
2. Reject voicings spanning more than 24 semitones or outside MIDI 48–84
3. Score each candidate: sum of absolute distances between each new note and the nearest previous note, plus a register penalty for deviation from octave 4 (C4–B4)
4. Pick the lowest score; on the first chord default to root position around middle C

---

## File structure (suggested)

```
chord-player/
├── index.html
├── manifest.json
├── vite.config.js
├── src/
│   ├── main.js          # entry point
│   ├── theory.js        # scale, chord, voice leading logic
│   ├── synth.js         # Tone.js setup and playback
│   ├── ui.js            # DOM rendering and event wiring
│   └── style.css
└── public/
    └── icons/           # PWA icons
```

---

## Open questions

- Framework: stay vanilla or move to React/Svelte for the ear training UI?
- Should the chord grid reflow to 2 rows on narrow mobile screens?
- Strum (arpeggiated) mode as a toggle alongside block chords?
- MIDI output via Web MIDI API for users with hardware?
