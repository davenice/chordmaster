import * as Tone from 'tone';

let synth = null;

const SOUND_MODES = {
  long: { attack: 0.005, decay: 1.2, sustain: 0.0, release: 1.0 },
  short: { attack: 0.005, decay: 0.6, sustain: 0.0, release: 0.6 },
};

let currentMode = 'long';

export function setSoundMode(mode) {
  currentMode = mode;
  if (synth) {
    synth.set({ envelope: SOUND_MODES[mode] });
  }
}

function getSynth() {
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: SOUND_MODES[currentMode],
    }).toDestination();
    synth.volume.value = -4;
  }
  return synth;
}

/** Attack a single note without releasing others — for echo in detect mode. */
export async function echoNoteOn(midiNote) {
  await Tone.start();
  getSynth().triggerAttack(Tone.Frequency(midiNote, 'midi').toNote(), Tone.now());
}

/** Release a single note — for echo in detect mode. */
export function echoNoteOff(midiNote) {
  synth?.triggerRelease(Tone.Frequency(midiNote, 'midi').toNote(), Tone.now());
}

/** Release all notes currently held by the synth. */
export function releaseAllNotes() {
  synth?.releaseAll();
}

/**
 * Play an array of MIDI note numbers simultaneously.
 * Ensures the AudioContext is running (required after a user gesture).
 * @param {number[]} midiNotes
 */
export async function playChord(midiNotes) {
  await Tone.start();
  const s = getSynth();

  // Release any held notes first
  s.releaseAll();

  const toneNotes = midiNotes.map((m) => Tone.Frequency(m, 'midi').toNote());

  // add in a bass note an octave down
  toneNotes.push(Tone.Frequency(midiNotes[0], 'midi').transpose(-12).toNote());

  const duration = '2n';
  s.triggerAttackRelease(toneNotes, duration, Tone.now());
}
