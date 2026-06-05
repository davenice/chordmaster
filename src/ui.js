import { ROOT_NOTES, buildDiatonicChords, chooseBestVoicing, chooseForcedInversion, inversionLabel, midiToName, keyUsesSharps } from './theory.js';
import { playChord, setSoundMode, echoNoteOn, echoNoteOff, releaseAllNotes } from './synth.js';
import { initMIDI, onNotesChange, onDeviceChange, getMIDIInputCount } from './midi.js';
import { detectChord } from './chords.js';
import { initKeyboard } from './keyboard.js';

// ── State ─────────────────────────────────────────────────────────────────────

let state = {
  // shared
  appMode: 'play',       // 'play' | 'detect'
  root: 'C',
  mode: 'major',
  soundMode: 'long',
  controlsOpen: false,

  // play mode
  chords: [],
  prevNotes: null,
  activeIndex: null,
  lastVoicing: null,
  shiftHeld: false,

  // detect mode
  detectedChord: null,
  echoEnabled: false,
  midiInitialized: false,
  midiSupported: false,
  midiError: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// C major / A minor have no accidentals; flats read more naturally for borrowed chords
function chordNamingUseSharps() {
  if (state.root === 'C') return false;
  return keyUsesSharps(state.root, state.mode);
}

// ── MIDI / notes callback ─────────────────────────────────────────────────────

let echoHeld = new Set(); // tracks which notes the synth is currently sounding

function handleNotesChange(midiNotes) {
  state.detectedChord = midiNotes.length >= 2 ? detectChord(midiNotes, chordNamingUseSharps()) : null;

  if (state.echoEnabled) {
    const next = new Set(midiNotes);
    // Release notes no longer held
    for (const n of echoHeld) {
      if (!next.has(n)) echoNoteOff(n);
    }
    // Attack newly pressed notes only
    for (const n of next) {
      if (!echoHeld.has(n)) echoNoteOn(n);
    }
    echoHeld = next;
  }

  // Partial DOM update — avoids full re-render on every MIDI event
  updateDetectDisplay();
}

async function ensureMIDI() {
  if (state.midiInitialized) return;
  state.midiInitialized = true;
  onNotesChange(handleNotesChange);
  onDeviceChange(render);
  const result = await initMIDI();
  state.midiSupported = result.supported;
  state.midiError     = result.error ?? null;
  render(); // re-render once to show MIDI status + optional keyboard
}

// ── Detect mode display (partial update) ─────────────────────────────────────

function getDiatonicLabel(root) {
  const diatonic = buildDiatonicChords(state.root, state.mode);
  const match    = diatonic.find(c => c.rootMidi === root);
  return match ? `${match.roman} in ${state.root} ${state.mode}` : null;
}

function updateDetectDisplay() {
  const nameEl     = document.getElementById('detect-chord-name');
  const notesEl    = document.getElementById('detect-chord-notes');
  const diatonicEl = document.getElementById('detect-diatonic');
  if (!nameEl) return;

  if (!state.detectedChord) {
    nameEl.textContent     = '—';
    notesEl.textContent    = '';
    diatonicEl.textContent = '';
    return;
  }

  nameEl.textContent = state.detectedChord.name;
  notesEl.innerHTML  = state.detectedChord.notes
    .map(n => `<span class="${n.matched ? '' : 'detect-note--extra'}">${n.name}</span>`)
    .join('  ');

  const label = getDiatonicLabel(state.detectedChord.root);
  diatonicEl.textContent = label ?? '';
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderModeTabs() {
  return `
    <div class="mode-tabs" role="tablist">
      <button class="mode-tab${state.appMode === 'play'   ? ' mode-tab--active' : ''}" data-mode="play"   role="tab" aria-selected="${state.appMode === 'play'}">Play</button>
      <button class="mode-tab${state.appMode === 'detect' ? ' mode-tab--active' : ''}" data-mode="detect" role="tab" aria-selected="${state.appMode === 'detect'}">Detect</button>
    </div>`;
}

function renderKeySelector() {
  return `
    <section class="key-selector" aria-label="Key and mode selector">
      <div class="selector-group">
        <label for="root-select">Root</label>
        <div class="select-wrapper">
          <select id="root-select">
            ${ROOT_NOTES.map(n => `<option value="${n}"${n === state.root ? ' selected' : ''}>${n}</option>`).join('')}
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
    </section>`;
}

function renderPlayView() {
  return `
    ${renderKeySelector()}

    <section class="chord-grid" aria-label="Chord buttons">
      ${state.chords.map((chord, i) => {
        const display   = state.shiftHeld ? invertedChord(chord) : chord;
        const isShifted = display !== chord;
        return `
        <button
          class="chord-btn${i === state.activeIndex ? ' chord-btn--active' : ''}${isShifted ? ' chord-btn--shifted' : ''}"
          data-index="${i}"
          aria-pressed="${i === state.activeIndex}"
        >
          <span class="chord-roman">${display.roman}</span>
          <span class="chord-name">${display.name}</span>
          <span class="chord-quality">${display.quality}</span>
        </button>`;
      }).join('')}
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
            <button class="segment-btn${state.soundMode === 'long'  ? ' segment-btn--active' : ''}" data-sound-mode="long">Long</button>
          </div>
        </div>
      </div>
      ` : ''}
    </div>`;
}

function renderDetectView() {
  const statusText = !state.midiInitialized
    ? 'Initialising MIDI…'
    : state.midiSupported
      ? getMIDIInputCount() === 0 ? 'MIDI ready — no devices connected' : `MIDI ready · ${getMIDIInputCount()} device${getMIDIInputCount() === 1 ? '' : 's'}`
      : `No MIDI: ${state.midiError}`;

  return `
    <section class="detect-view">
      ${renderKeySelector()}

      <div class="detect-chord-display">
        <div class="detect-chord-name" id="detect-chord-name">—</div>
        <div class="detect-chord-notes" id="detect-chord-notes"></div>
        <div class="detect-diatonic" id="detect-diatonic"></div>
      </div>

      <div class="detect-controls">
        <div class="segment-toggle" role="group" aria-label="Echo">
          <button class="segment-btn${!state.echoEnabled ? ' segment-btn--active' : ''}" data-echo="off">Echo off</button>
          <button class="segment-btn${ state.echoEnabled ? ' segment-btn--active' : ''}" data-echo="on">Echo on</button>
        </div>
        <div class="detect-status">${statusText}</div>
      </div>

      <div id="detect-keyboard-container" class="detect-keyboard-wrap"></div>
    </section>`;
}

function renderVoicingLabel() {
  if (state.activeIndex === null || !state.lastVoicing) {
    return `<span class="voicing-placeholder">Tap a chord to play</span>`;
  }
  const { notes, inversion, chord = state.chords[state.activeIndex] } = state.lastVoicing;
  const bass  = midiToName(notes[0]);
  return `<span class="voicing-info">${chord.name} / ${bass} <em>(${inversionLabel(inversion)})</em></span>`;
}

function render() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="app-wrapper">
      <header class="app-header">
        <h1 class="app-title">ChordMaster</h1>
        ${renderModeTabs()}
      </header>
      ${state.appMode === 'play' ? renderPlayView() : renderDetectView()}
    </div>
  `;
  bindEvents();
  afterRender();
}

function afterRender() {
  if (state.appMode === 'detect') {
      const kbContainer = document.getElementById('detect-keyboard-container');
      if (kbContainer) initKeyboard(kbContainer, handleNotesChange);
    updateDetectDisplay();
  }
}

// ── Keyboard mapping (play mode) ──────────────────────────────────────────────

const KEY_MAP = Object.fromEntries([
  ...'zxcvbnm'.split('').map((k, i) => [k, [i, 0]]),
  ...'asdfghj'.split('').map((k, i) => [k, [i, 1]]),
  ...'qwertyu'.split('').map((k, i) => [k, [i, 2]]),
]);

// ── Event binding ─────────────────────────────────────────────────────────────

function bindEvents() {
  // Mode tabs
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const newMode = btn.dataset.mode;
      if (newMode === state.appMode) return;
      state.appMode = newMode;
      if (newMode === 'detect') ensureMIDI();
      render();
    });
  });

  // Key selector is present in both modes
  document.getElementById('root-select').addEventListener('change', (e) => {
    state.root = e.target.value;
    resetKey();
  });

  document.getElementById('mode-select').addEventListener('change', (e) => {
    state.mode = e.target.value;
    resetKey();
  });

  if (state.appMode === 'play') {

    document.querySelectorAll('.chord-btn').forEach(btn => {
      btn.addEventListener('click', () => handleChordTap(parseInt(btn.dataset.index, 10)));
    });

    document.getElementById('controls-toggle').addEventListener('click', () => {
      state.controlsOpen = !state.controlsOpen;
      render();
    });

    document.querySelectorAll('[data-sound-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.soundMode = btn.dataset.soundMode;
        setSoundMode(state.soundMode);
        render();
      });
    });
  }

  if (state.appMode === 'detect') {
    document.querySelectorAll('[data-echo]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.echoEnabled = btn.dataset.echo === 'on';
        if (!state.echoEnabled) {
          releaseAllNotes();
          echoHeld.clear();
        }
        render();
      });
    });
  }
}

// ── Play mode actions ─────────────────────────────────────────────────────────

function invertedChord(chord) {
  const flipped = chord.quality === 'maj' ? 'min' : chord.quality === 'min' ? 'maj' : chord.quality;
  if (flipped === chord.quality) return chord;
  const suffix = flipped === 'maj' ? '' : 'm';
  const roman  = flipped === 'maj' ? chord.roman.toUpperCase() : chord.roman.toLowerCase();
  return { ...chord, quality: flipped, name: chord.name.replace(/m?$/, suffix), roman };
}

async function handleKeyDown(e) {
  if (state.appMode !== 'play') return;
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  const mapping = KEY_MAP[e.key.toLowerCase()];
  if (!mapping) return;
  e.preventDefault();
  const [degree, inversion] = mapping;
  const chord   = e.shiftKey ? invertedChord(state.chords[degree]) : state.chords[degree];
  const voicing = chooseForcedInversion(chord, inversion);

  state.activeIndex = degree;
  state.prevNotes   = voicing.notes;
  state.lastVoicing = { ...voicing, chord };
  render();

  try {
    await playChord(voicing.notes);
  } catch (err) {
    console.error('Audio error:', err);
  }
}

function resetKey() {
  state.prevNotes   = null;
  state.activeIndex = null;
  state.lastVoicing = null;
  state.chords      = buildDiatonicChords(state.root, state.mode);
  render();
}

async function handleChordTap(index) {
  const chord   = state.chords[index];
  const voicing = chooseBestVoicing(chord, state.prevNotes, index);

  state.activeIndex = index;
  state.prevNotes   = voicing.notes;
  state.lastVoicing = voicing;
  render();

  try {
    await playChord(voicing.notes);
  } catch (err) {
    console.error('Audio error:', err);
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

function handleShiftDown(e) {
  if (e.key !== 'Shift' || e.repeat || state.shiftHeld) return;
  if (state.appMode !== 'play') return;
  state.shiftHeld = true;
  render();
}

function handleShiftUp(e) {
  if (e.key !== 'Shift' || !state.shiftHeld) return;
  state.shiftHeld = false;
  render();
}

export function init() {
  state.chords = buildDiatonicChords(state.root, state.mode);
  render();
  const buildInfo = document.createElement('div');
  buildInfo.className = 'build-info';
  const date = new Date(__BUILD_DATE__).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
  buildInfo.textContent = `${__COMMIT_ID__} · ${date}`;
  document.body.appendChild(buildInfo);
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keydown', handleShiftDown);
  document.addEventListener('keyup', handleShiftUp);
}
