// Virtual piano: C3–B4 (MIDI 48–71), 2 octaves, 14 white keys
const WHITE_PCS   = [0, 2, 4, 5, 7, 9, 11];
const TOTAL_WHITE = 14;
const START_MIDI  = 48; // C3

const BLACK_DEFS = [
  { pc: 1,  left: 0.7  },  // C#
  { pc: 3,  left: 1.7  },  // D#
  { pc: 6,  left: 3.7  },  // F#
  { pc: 8,  left: 4.7  },  // G#
  { pc: 10, left: 5.7  },  // A#
];
const BLACK_WIDTH = 0.6; // in white-key units

let escapeController = null;

export function initKeyboard(container, onNotesChange) {
  escapeController?.abort();
  escapeController = new AbortController();

  container.innerHTML = '';

  const held = new Set();

  function fire() {
    onNotesChange([...held]);
  }

  function toggle(midi) {
    if (held.has(midi)) {
      held.delete(midi);
      highlight(midi, false);
    } else {
      held.add(midi);
      highlight(midi, true);
    }
    fire();
  }

  function clearAll() {
    held.forEach(midi => highlight(midi, false));
    held.clear();
    fire();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && container.isConnected) clearAll();
  }, { signal: escapeController.signal });

  function highlight(midi, on) {
    const el = container.querySelector(`[data-midi="${midi}"]`);
    el?.classList.toggle('piano-key--active', on);
  }

  function attachPointer(el, midi) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      toggle(midi);
    });
  }

  const keyboard = document.createElement('div');
  keyboard.className = 'piano-keyboard';
  keyboard.style.touchAction = 'none';

  for (let oct = 0; oct < 2; oct++) {
    WHITE_PCS.forEach((pc, idx) => {
      const midi = START_MIDI + oct * 12 + pc;
      const key  = document.createElement('div');
      key.className     = 'piano-key piano-key--white';
      key.dataset.midi  = midi;
      key.style.left    = `${(oct * 7 + idx) / TOTAL_WHITE * 100}%`;
      key.style.width   = `${1 / TOTAL_WHITE * 100}%`;
      attachPointer(key, midi);
      keyboard.appendChild(key);
    });

    BLACK_DEFS.forEach(({ pc, left }) => {
      const midi = START_MIDI + oct * 12 + pc;
      const key  = document.createElement('div');
      key.className     = 'piano-key piano-key--black';
      key.dataset.midi  = midi;
      key.style.left    = `${(oct * 7 + left) / TOTAL_WHITE * 100}%`;
      key.style.width   = `${BLACK_WIDTH / TOTAL_WHITE * 100}%`;
      attachPointer(key, midi);
      keyboard.appendChild(key);
    });
  }

  const clearBtn = document.createElement('button');
  clearBtn.className   = 'piano-clear-btn';
  clearBtn.textContent = 'Clear';
  clearBtn.addEventListener('click', clearAll);

  container.appendChild(keyboard);
  container.appendChild(clearBtn);
}
