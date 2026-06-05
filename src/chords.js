const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const CHORD_TYPES = [
  // Triads
  { suffix: '',      intervals: [0, 4, 7]            },  // Major
  { suffix: 'm',     intervals: [0, 3, 7]            },  // Minor
  { suffix: 'dim',   intervals: [0, 3, 6]            },  // Diminished
  { suffix: 'aug',   intervals: [0, 4, 8]            },  // Augmented
  { suffix: 'sus2',  intervals: [0, 2, 7]            },  // Sus2
  { suffix: 'sus4',  intervals: [0, 5, 7]            },  // Sus4
  { suffix: 'sus47', intervals: [0, 5, 7, 10]        },  // Dom 7 Sus4
  // Sixths
  { suffix: '6',     intervals: [0, 4, 7, 9]         },  // Major 6
  { suffix: 'm6',    intervals: [0, 3, 7, 9]         },  // Minor 6 — before m7b5
  // Sevenths
  { suffix: '7',     intervals: [0, 4, 7, 10]        },  // Dom 7
  { suffix: 'maj7',  intervals: [0, 4, 7, 11]        },  // Major 7
  { suffix: 'm7',    intervals: [0, 3, 7, 10]        },  // Minor 7
  { suffix: 'mMaj7', intervals: [0, 3, 7, 11]        },  // Minor/Major 7
  { suffix: 'm7b5',  intervals: [0, 3, 6, 10]        },  // Half-diminished
  { suffix: 'dim7',  intervals: [0, 3, 6, 9]         },  // Diminished 7
  { suffix: 'aug7',  intervals: [0, 4, 8, 10]        },  // Aug Dom 7
  // Ninths
  { suffix: 'add9',  intervals: [0, 2, 4, 7]         },  // Add9 (no 7th)
  { suffix: '9',     intervals: [0, 2, 4, 7, 10]     },  // Dom 9
  { suffix: 'maj9',  intervals: [0, 2, 4, 7, 11]     },  // Major 9
  { suffix: 'm9',    intervals: [0, 2, 3, 7, 10]     },  // Minor 9
  // Elevenths
  { suffix: '11',    intervals: [0, 2, 4, 5, 7, 10]  },
  { suffix: 'maj11', intervals: [0, 2, 4, 5, 7, 11]  },
  // Thirteenths
  { suffix: '13',    intervals: [0, 2, 4, 5, 7, 9, 10] },
  { suffix: 'maj13', intervals: [0, 2, 4, 5, 7, 9, 11] },
];

/**
 * Identify the chord from an array of MIDI note numbers.
 * @param {number[]} midiNotes
 * @param {boolean} useSharps - use sharp names (C#) vs flat names (Db)
 * Returns { name, root (pitch class 0–11), notes (names) } or null.
 */
export function detectChord(midiNotes, useSharps = false) {
  const NOTE_NAMES = useSharps ? SHARP_NAMES : FLAT_NAMES;
  if (midiNotes.length < 2) return null;

  const pitchClasses = [...new Set(midiNotes.map(n => n % 12))].sort((a, b) => a - b);
  const lowestPC = midiNotes.reduce((lo, n) => n < lo ? n : lo) % 12;

  const candidates = [];

  for (const type of CHORD_TYPES) {
    for (const root of pitchClasses) {
      const intervals = pitchClasses
        .map(pc => (pc - root + 12) % 12)
        .sort((a, b) => a - b);

      const matched = type.intervals.filter(i => intervals.includes(i)).length;
      const extra   = intervals.filter(i => !type.intervals.includes(i)).length;
      const completeness = matched / type.intervals.length;

      if (completeness < 0.5) continue;

      candidates.push({
        root,
        type,
        exact: matched === type.intervals.length && extra === 0,
        score: completeness - extra * 0.1,
      });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.exact !== b.exact) return b.exact - a.exact;
    if (b.score !== a.score) return b.score - a.score;
    if (a.type.intervals.length !== b.type.intervals.length) return a.type.intervals.length - b.type.intervals.length;
    // Prefer root position: root matches the bass note, avoiding a slash chord
    const aRootPos = a.root === lowestPC ? 1 : 0;
    const bRootPos = b.root === lowestPC ? 1 : 0;
    return bRootPos - aRootPos;
  });

  const best = candidates[0];
  const rootName  = NOTE_NAMES[best.root];
  const chordName = rootName + best.type.suffix;
  const bassName  = lowestPC !== best.root ? NOTE_NAMES[lowestPC] : null;

  const chordIntervals = new Set(best.type.intervals);
  const notes = [...new Set(
    [...midiNotes].sort((a, b) => a - b).map(n => n % 12)
  )].map(pc => ({
    name:    NOTE_NAMES[pc],
    matched: chordIntervals.has((pc - best.root + 12) % 12),
  }));

  return {
    name:  bassName ? `${chordName}/${bassName}` : chordName,
    root:  best.root,
    notes,
  };
}
