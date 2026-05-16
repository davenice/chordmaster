// ── Scale definitions ─────────────────────────────────────────────────────────

// Selector uses mixed conventional spellings (one name per pitch class)
export const ROOT_NOTES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Determine whether a key spells accidentals as sharps.
 * Sharp major keys: C G D A E B F#  (everything except F and flat-named roots)
 * Sharp minor keys: A E B F# C# G# D#
 */
function keyUsesSharps(rootName, mode) {
  if (rootName.includes('#')) return true;
  if (rootName.includes('b')) return false;
  // Natural-letter roots
  if (mode === 'major') return rootName !== 'F';
  return ['A', 'E', 'B'].includes(rootName); // minor: A E B are sharp keys
}

const SCALE_INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

// Qualities per scale degree (0-indexed)
const QUALITIES = {
  major: ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'],
  minor: ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'],
};

const ROMAN_NUMERALS = {
  major: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
  minor: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'],
};

// Semitone intervals for each triad quality
const TRIAD_INTERVALS = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
};

// ── Scale / chord builders ────────────────────────────────────────────────────

/** Return the MIDI pitch class (0–11) of the nth degree of the scale. */
function scaleDegreeNote(rootMidi, mode, degree) {
  return (rootMidi + SCALE_INTERVALS[mode][degree]) % 12;
}

/** Build descriptor objects for all 7 diatonic chords. */
export function buildDiatonicChords(rootName, mode) {
  const rootMidi = ROOT_NOTES.indexOf(rootName);
  const intervals = SCALE_INTERVALS[mode];
  const qualities = QUALITIES[mode];
  const noteNames = keyUsesSharps(rootName, mode) ? SHARP_NAMES : FLAT_NAMES;

  return intervals.map((interval, degree) => {
    const quality = qualities[degree];
    const chordRootMidi = (rootMidi + interval) % 12;
    const chordRootName = noteNames[chordRootMidi];
    const suffix = quality === 'maj' ? '' : quality === 'min' ? 'm' : '°';
    return {
      degree,
      roman: ROMAN_NUMERALS[mode][degree],
      name: chordRootName + suffix,
      quality,
      rootMidi: chordRootMidi,
    };
  });
}

// ── Inversion generator ───────────────────────────────────────────────────────

/**
 * Generate all candidate voicings for a chord across octaves 3–5.
 * Returns arrays of MIDI pitch numbers (lowest first).
 */
function candidateVoicings(chordRootMidi, quality) {
  const intervals = TRIAD_INTERVALS[quality];
  const voicings = [];

  // Three inversions × octaves 3, 4, 5 for the bass note
  for (let octave = 3; octave <= 5; octave++) {
    for (let inv = 0; inv < 3; inv++) {
      // Rotate intervals so inversion `inv` is in the bass
      const rotated = [...intervals.slice(inv), ...intervals.slice(0, inv)];
      // Bass note
      const bassAbs = (chordRootMidi + intervals[inv]) % 12 + (octave + 1) * 12;
      const notes = rotated.map((semitones, i) => {
        // Each successive note must be above the previous
        let note = bassAbs + ((semitones - intervals[inv] + 12) % 12);
        // Ensure ascending order
        if (i > 0 && note <= voicings[voicings.length - 1]?.[i - 1]) {
          note += 12;
        }
        return note;
      });

      // Build properly ascending voicing
      const sorted = buildAscending(chordRootMidi, quality, inv, octave);
      if (sorted) voicings.push({ notes: sorted, inversion: inv });
    }
  }

  return voicings;
}

function buildAscending(chordRootMidi, quality, inversion, bassOctave) {
  const intervals = TRIAD_INTERVALS[quality];
  // The bass note is the `inversion`-th note of the chord
  const bassPC = (chordRootMidi + intervals[inversion]) % 12;
  const bass = bassPC + (bassOctave + 1) * 12;

  const notes = [bass];
  for (let i = 1; i < intervals.length; i++) {
    const idx = (inversion + i) % intervals.length;
    const pc = (chordRootMidi + intervals[idx]) % 12;
    let note = pc + (bassOctave + 1) * 12;
    // Push up until above previous note
    while (note <= notes[notes.length - 1]) note += 12;
    notes.push(note);
  }

  return notes;
}

// ── Voice leading ─────────────────────────────────────────────────────────────

const MIDI_MIN = 48;
const MIDI_MAX = 84;
const MAX_SPAN = 24;

// Preferred register: broadly octave 4 (C4–B4)
const REGISTER_LOW = 60;
const REGISTER_HIGH = 71;

function isValidVoicing(notes) {
  if (notes[0] < MIDI_MIN || notes[notes.length - 1] > MIDI_MAX) return false;
  if (notes[notes.length - 1] - notes[0] > MAX_SPAN) return false;
  return true;
}

/** Penalty for notes outside the preferred octave-4 register. */
function registerPenalty(notes) {
  return notes.reduce((total, note) => {
    if (note < REGISTER_LOW) return total + (REGISTER_LOW - note);
    if (note > REGISTER_HIGH) return total + (note - REGISTER_HIGH);
    return total;
  }, 0);
}

function voiceLeadingScore(prev, next) {
  // Sum of nearest-neighbour absolute distances
  return next.reduce((total, note) => {
    const nearest = Math.min(...prev.map((p) => Math.abs(p - note)));
    return total + nearest;
  }, 0);
}

/**
 * Choose the best-voiced inversion of `chord` given the previous voicing.
 * @param {object} chord  - from buildDiatonicChords
 * @param {number[]} prevNotes - MIDI notes of previous chord (or null)
 * @param {number}   degree   - 0-based scale degree
 * @returns {{ notes: number[], inversion: number }}
 */
export function chooseBestVoicing(chord, prevNotes, degree) {
  const candidates = [];

  for (let octave = 3; octave <= 5; octave++) {
    for (let inv = 0; inv < 3; inv++) {
      // Apply inversion preferences from the spec:
      // - Avoid 2nd inversion except for degree 4 (V in major = index 4)
      // - Prefer root position for degree 0 (I / i)
      if (inv === 2 && degree !== 4) continue;

      const notes = buildAscending(chord.rootMidi, chord.quality, inv, octave);
      if (!notes || !isValidVoicing(notes)) continue;

      let score;
      if (!prevNotes) {
        // First chord: prefer root position, anchor to octave 4
        score = registerPenalty(notes) + (inv === 0 ? 0 : 6);
      } else {
        score = voiceLeadingScore(prevNotes, notes) + registerPenalty(notes) * 0.5;
        // Penalise inversions for the I chord to keep it grounded
        if (degree === 0 && inv !== 0) score += 4;
      }

      candidates.push({ notes, inversion: inv, score });
    }
  }

  if (candidates.length === 0) {
    // Fallback: root position, octave 4, no restrictions
    const notes = buildAscending(chord.rootMidi, chord.quality, 0, 4);
    return { notes, inversion: 0 };
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates[0];
}

/**
 * Choose the best octave for a forced inversion, scored by register penalty.
 * @param {object} chord
 * @param {number} inversion - 0 | 1 | 2
 * @returns {{ notes: number[], inversion: number }}
 */
export function chooseForcedInversion(chord, inversion) {
  const candidates = [];
  for (let octave = 3; octave <= 5; octave++) {
    const notes = buildAscending(chord.rootMidi, chord.quality, inversion, octave);
    if (!notes || !isValidVoicing(notes)) continue;
    candidates.push({ notes, inversion, score: registerPenalty(notes) });
  }
  if (candidates.length === 0) {
    const notes = buildAscending(chord.rootMidi, chord.quality, inversion, 4);
    return { notes, inversion };
  }
  candidates.sort((a, b) => a.score - b.score);
  return candidates[0];
}

// ── Inversion name helpers ────────────────────────────────────────────────────

const INVERSION_NAMES = ['root position', '1st inv', '2nd inv'];

export function inversionLabel(inversion) {
  return INVERSION_NAMES[inversion] ?? 'root position';
}

/** Given MIDI note number return e.g. "G4" */
export function midiToName(midi) {
  const names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  return names[midi % 12] + octave;
}
