import { describe, it, expect } from 'vitest';
import { buildDiatonicChords, keyUsesSharps } from './theory.js';

// ── keyUsesSharps ──────────────────────────────────────────────────────────────

describe('keyUsesSharps', () => {
  describe('major keys', () => {
    it.each([
      ['G',  true ],
      ['D',  true ],
      ['A',  true ],
      ['E',  true ],
      ['B',  true ],
      ['F#', true ],
      ['C#', true ],
      ['C',  true ],  // no accidentals — function returns true; chordNamingUseSharps() overrides for display
      ['F',  false],
      ['Bb', false],
      ['Eb', false],
      ['Ab', false],
      ['Db', false],
    ])('%s major → %s', (root, expected) => {
      expect(keyUsesSharps(root, 'major')).toBe(expected);
    });
  });

  describe('minor keys', () => {
    it.each([
      ['A',  true ],
      ['E',  true ],
      ['B',  true ],
      ['F#', true ],
      ['D',  false],
      ['G',  false],
      ['C',  false],
    ])('%s minor → %s', (root, expected) => {
      expect(keyUsesSharps(root, 'minor')).toBe(expected);
    });
  });
});

// ── buildDiatonicChords ────────────────────────────────────────────────────────

describe('buildDiatonicChords', () => {
  describe('C major', () => {
    const chords = buildDiatonicChords('C', 'major');

    it('returns 7 chords', () => expect(chords).toHaveLength(7));

    it.each([
      [0, 'I',    'C',  'maj'],
      [1, 'ii',   'Dm', 'min'],
      [2, 'iii',  'Em', 'min'],
      [3, 'IV',   'F',  'maj'],
      [4, 'V',    'G',  'maj'],
      [5, 'vi',   'Am', 'min'],
      [6, 'vii°', 'B°', 'dim'],
    ])('degree %i: %s %s (%s)', (i, roman, name, quality) => {
      expect(chords[i].roman).toBe(roman);
      expect(chords[i].name).toBe(name);
      expect(chords[i].quality).toBe(quality);
    });
  });

  describe('A minor', () => {
    const chords = buildDiatonicChords('A', 'minor');

    it.each([
      [0, 'i',   'Am', 'min'],
      [1, 'ii°', 'B°', 'dim'],
      [2, 'III', 'C',  'maj'],
      [3, 'iv',  'Dm', 'min'],
      [4, 'v',   'Em', 'min'],
      [5, 'VI',  'F',  'maj'],
      [6, 'VII', 'G',  'maj'],
    ])('degree %i: %s %s (%s)', (i, roman, name, quality) => {
      expect(chords[i].roman).toBe(roman);
      expect(chords[i].name).toBe(name);
      expect(chords[i].quality).toBe(quality);
    });
  });

  describe('Bb major (flat key)', () => {
    const chords = buildDiatonicChords('Bb', 'major');

    it('uses flat note names', () => {
      const names = chords.map(c => c.name);
      expect(names).toEqual(['Bb', 'Cm', 'Dm', 'Eb', 'F', 'Gm', 'A°']);
    });
  });

  describe('G major (sharp key)', () => {
    const chords = buildDiatonicChords('G', 'major');

    it('uses sharp note names', () => {
      const names = chords.map(c => c.name);
      expect(names).toEqual(['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#°']);
    });
  });
});
