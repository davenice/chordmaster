import { describe, it, expect } from 'vitest';
import { detectChord } from './chords.js';

// Helper: MIDI note from note name + octave, e.g. note('C', 4) = 60, note('Eb', 4) = 63
function note(name, octave) {
  const PC = {
    C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3,
    E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8,
    Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
  };
  return PC[name] + (octave + 1) * 12;
}

describe('detectChord', () => {
  // ── Triads ──────────────────────────────────────────────────────────────────

  describe('triads', () => {
    it('major',      () => expect(detectChord([note('C',4), note('E',4), note('G',4)]).name).toBe('C'));
    it('minor',      () => expect(detectChord([note('C',4), note('Eb',4), note('G',4)], false).name).toBe('Cm'));
    it('diminished', () => expect(detectChord([note('C',4), note('Eb',4), note('F#',4)]).name).toBe('Cdim'));
    it('augmented',  () => expect(detectChord([note('C',4), note('E',4), note('G#',4)]).name).toBe('Caug'));
    it('sus2',       () => expect(detectChord([note('C',4), note('D',4), note('G',4)]).name).toBe('Csus2'));
    it('sus4',       () => expect(detectChord([note('C',4), note('F',4), note('G',4)]).name).toBe('Csus4'));
  });

  // ── Seventh chords ───────────────────────────────────────────────────────────

  describe('seventh chords', () => {
    it('dominant 7',  () => expect(detectChord([note('C',4), note('E',4), note('G',4), note('A#',4)]).name).toBe('C7'));
    it('major 7',     () => expect(detectChord([note('C',4), note('E',4), note('G',4), note('B',4)]).name).toBe('Cmaj7'));
    it('minor 7',     () => expect(detectChord([note('C',4), note('Eb',4), note('G',4), note('A#',4)], false).name).toBe('Cm7'));
    it('half-dim',    () => expect(detectChord([note('C',4), note('Eb',4), note('F#',4), note('A#',4)]).name).toBe('Cm7b5'));
    it('diminished 7',() => expect(detectChord([note('C',4), note('Eb',4), note('F#',4), note('A',4)]).name).toBe('Cdim7'));
  });

  // ── Sus4 / sus2 disambiguation (bass-note tiebreaker) ────────────────────────

  describe('sus disambiguation', () => {
    it('Fsus4 is not named A#sus2', () => {
      // F Bb C — same pitch classes as Bbsus2 but F is lowest
      expect(detectChord([note('F',3), note('A#',3), note('C',4)]).name).toBe('Fsus4');
    });

    it('Bbsus2 is not named Fsus4', () => {
      // Bb C F — same pitch classes but Bb is lowest
      expect(detectChord([note('A#',3), note('C',4), note('F',4)], false).name).toBe('Bbsus2');
    });

    it('Gsus4 is not named Dsus2', () => {
      expect(detectChord([note('G',3), note('C',4), note('D',4)]).name).toBe('Gsus4');
    });

    // Fsus4 in C major: F Bb C resolves to F (Bb drops to A)
    it('Fsus4 (F Bb C) in C major resolves to F (F A C)', () => {
      expect(detectChord([note('F',3), note('Bb',3), note('C',4)]).name).toBe('Fsus4');
      expect(detectChord([note('F',3), note('A',3),  note('C',4)]).name).toBe('F');
    });

    // 7sus4: dominant 7th with suspended 4th (4th replaces 3rd)
    it('Gsus47 (G C D F) — V sus47 in C major', () => {
      expect(detectChord([note('G',3), note('C',4), note('D',4), note('F',4)]).name).toBe('Gsus47');
    });

    it('Csus47 (C F G Bb)', () => {
      expect(detectChord([note('C',3), note('F',3), note('G',3), note('Bb',3)]).name).toBe('Csus47');
    });
  });

  // ── Inversions and slash chords ──────────────────────────────────────────────

  describe('inversions', () => {
    it('C/E — first inversion', () => {
      expect(detectChord([note('E',3), note('G',3), note('C',4)]).name).toBe('C/E');
    });

    it('C/G — second inversion', () => {
      expect(detectChord([note('G',3), note('C',4), note('E',4)]).name).toBe('C/G');
    });

    it('root-position chord has no slash', () => {
      expect(detectChord([note('C',4), note('E',4), note('G',4)]).name).not.toContain('/');
    });

    it('Cmaj7/E — seventh chord first inversion', () => {
      expect(detectChord([note('E',3), note('G',3), note('B',3), note('C',4)]).name).toBe('Cmaj7/E');
    });
  });

  // ── Flat / sharp naming ──────────────────────────────────────────────────────

  describe('flat/sharp naming', () => {
    it('flat names by default', () => {
      expect(detectChord([note('A#',3), note('D',4), note('F',4)]).name).toBe('Bb');
    });

    it('sharp names when useSharps=true', () => {
      expect(detectChord([note('A#',3), note('D',4), note('F',4)], true).name).toBe('A#');
    });

    it('Eb with flat names', () => {
      expect(detectChord([note('D#',4), note('G',4), note('A#',4)], false).name).toBe('Eb');
    });

    it('D# with sharp names', () => {
      expect(detectChord([note('D#',4), note('G',4), note('A#',4)], true).name).toBe('D#');
    });

    it('Ab with flat names', () => {
      expect(detectChord([note('G#',3), note('C',4), note('D#',4)], false).name).toBe('Ab');
    });
  });

  // ── Note list in result ──────────────────────────────────────────────────────

  describe('result.notes', () => {
    it('all notes matched on exact chord', () => {
      const { notes } = detectChord([note('C',4), note('E',4), note('G',4)]);
      expect(notes.map(n => n.name)).toEqual(['C', 'E', 'G']);
      expect(notes.every(n => n.matched)).toBe(true);
    });

    it('deduplicates same pitch class across octaves', () => {
      const { notes } = detectChord([note('C',3), note('C',4), note('E',4), note('G',4)]);
      expect(notes.map(n => n.name)).toEqual(['C', 'E', 'G']);
    });

    it('extra notes are flagged as unmatched', () => {
      // G major + an extra Bb (not in chord)
      const { notes } = detectChord([note('G',3), note('B',3), note('D',4), note('Bb',4)], false);
      const byName = Object.fromEntries(notes.map(n => [n.name, n.matched]));
      expect(byName['G']).toBe(true);
      expect(byName['B']).toBe(true);
      expect(byName['D']).toBe(true);
      expect(byName['Bb']).toBe(false);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns null for a single note', () => {
      expect(detectChord([note('C',4)])).toBeNull();
    });

    it('returns null for empty input', () => {
      expect(detectChord([])).toBeNull();
    });

    it('identifies chord regardless of octave spread', () => {
      // C3, E5, G5
      expect(detectChord([note('C',3), note('E',5), note('G',5)]).name).toBe('C');
    });
  });
});
