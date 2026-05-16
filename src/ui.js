import { ROOT_NOTES, buildDiatonicChords, chooseBestVoicing, chooseForcedInversion, inversionLabel, midiToName } from './theory.js';
import { playChord, setSoundMode } from './synth.js';

// ── State ─────────────────────────────────────────────────────────────────────

let state = {
  root: 'C',
  mode: 'major',
  soundMode: 'long',
  controlsOpen: false,
  chords: [],
  prevNotes: null,
  activeIndex: null,
};

// ── Rendering ─────────────────────────────────────────────────────────────────

function render() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="app-wrapper">
      <header class="app-header">
        <h1 class="app-title">ChordMaster</h1>
      </header>

      <section class="key-selector" aria-label="Key and mode selector">
        <div class="selector-group">
          <label for="root-select">Root</label>
          <div class="select-wrapper">
            <select id="root-select">
              ${ROOT_NOTES.map((n) => `<option value="${n}"${n === state.root ? ' selected' : ''}>${n}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="selector-group">
          <label for="mode-select">Mode</label>
          <div class="select-wrapper">
            <select id="mode-select">
              <option value="major"${state.mode === 'major' ? ' selected' : ''}>Major</option>
              <option value="minor"${state.mode === 'minor' ? ' selected' : ''}>Minor</option>
            </select>
          </div>
        </div>
      </section>

      <section class="chord-grid" aria-label="Chord buttons">
        ${state.chords
          .map(
            (chord, i) => `
          <button
            class="chord-btn${i === state.activeIndex ? ' chord-btn--active' : ''}"
            data-index="${i}"
            aria-pressed="${i === state.activeIndex}"
          >
            <span class="chord-roman">${chord.roman}</span>
            <span class="chord-name">${chord.name}</span>
            <span class="chord-quality">${chord.quality}</span>
          </button>
        `
          )
          .join('')}
      </section>

      <div class="voicing-display" aria-live="polite">
        ${renderVoicingLabel()}
      </div>

      <div class="control-panel">
        <button class="control-panel__handle" id="controls-toggle" aria-expanded="${state.controlsOpen}">
          Settings <span class="control-panel__chevron">${state.controlsOpen ? '▴' : '▾'}</span>
        </button>
        ${state.controlsOpen ? `
        <div class="control-panel__body">
          <div class="control-row">
            <span class="control-label">Sound</span>
            <div class="segment-toggle" role="group" aria-label="Sound duration">
              <button class="segment-btn${state.soundMode === 'short' ? ' segment-btn--active' : ''}" data-sound-mode="short">Short</button>
              <button class="segment-btn${state.soundMode === 'long' ? ' segment-btn--active' : ''}" data-sound-mode="long">Long</button>
            </div>
          </div>
        </div>
        ` : ''}
      </div>
    </div>
  `;

  bindEvents();
}

function renderVoicingLabel() {
  if (state.activeIndex === null || !state.lastVoicing) {
    return `<span class="voicing-placeholder">Tap a chord to play</span>`;
  }
  const { notes, inversion } = state.lastVoicing;
  const bass = midiToName(notes[0]);
  const chord = state.chords[state.activeIndex];
  return `<span class="voicing-info">${chord.name} / ${bass} <em>(${inversionLabel(inversion)})</em></span>`;
}

// ── Keyboard mapping ──────────────────────────────────────────────────────────

// Each row maps to [degree, inversion] for keys left-to-right (I–VII)
const KEY_MAP = Object.fromEntries([
  ...'zxcvbnm'.split('').map((k, i) => [k, [i, 0]]), // root position
  ...'asdfghj'.split('').map((k, i) => [k, [i, 1]]), // 1st inversion
  ...'qwertyu'.split('').map((k, i) => [k, [i, 2]]), // 2nd inversion
]);

// ── Event binding ─────────────────────────────────────────────────────────────

function bindEvents() {
  document.getElementById('root-select').addEventListener('change', (e) => {
    state.root = e.target.value;
    resetKey();
  });

  document.getElementById('mode-select').addEventListener('change', (e) => {
    state.mode = e.target.value;
    resetKey();
  });

  document.querySelectorAll('.chord-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index, 10);
      handleChordTap(index);
    });
  });

  document.getElementById('controls-toggle').addEventListener('click', () => {
    state.controlsOpen = !state.controlsOpen;
    render();
  });

  document.querySelectorAll('[data-sound-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.soundMode = btn.dataset.soundMode;
      setSoundMode(state.soundMode);
      render();
    });
  });
}

async function handleKeyDown(e) {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  const mapping = KEY_MAP[e.key];
  if (!mapping) return;
  e.preventDefault();
  const [degree, inversion] = mapping;
  const chord = state.chords[degree];
  const voicing = chooseForcedInversion(chord, inversion);

  state.activeIndex = degree;
  state.prevNotes = voicing.notes;
  state.lastVoicing = voicing;
  render();

  try {
    await playChord(voicing.notes);
  } catch (err) {
    console.error('Audio error:', err);
  }
}

function resetKey() {
  state.prevNotes = null;
  state.activeIndex = null;
  state.lastVoicing = null;
  state.chords = buildDiatonicChords(state.root, state.mode);
  render();
}

async function handleChordTap(index) {
  const chord = state.chords[index];
  const voicing = chooseBestVoicing(chord, state.prevNotes, index);

  state.activeIndex = index;
  state.prevNotes = voicing.notes;
  state.lastVoicing = voicing;

  // Update UI immediately (re-render is cheap)
  render();

  // Play audio
  try {
    await playChord(voicing.notes);
  } catch (err) {
    console.error('Audio error:', err);
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

export function init() {
  state.chords = buildDiatonicChords(state.root, state.mode);
  render();
  document.addEventListener('keydown', handleKeyDown);
}
