let heldNotes = new Set();
let notesChangeCb = null;
let midiAccess = null;

export function onNotesChange(cb) {
  notesChangeCb = cb;
}

export function getMIDIInputCount() {
  return midiAccess ? midiAccess.inputs.size : 0;
}

function fire() {
  notesChangeCb?.([...heldNotes]);
}

function handleMessage(e) {
  const [status, note, velocity] = e.data;
  const type = status & 0xF0;
  if (type === 0x90 && velocity > 0) {
    heldNotes.add(note);
  } else if (type === 0x80 || (type === 0x90 && velocity === 0)) {
    heldNotes.delete(note);
  }
  fire();
}

function wireInputs() {
  for (const input of midiAccess.inputs.values()) {
    input.onmidimessage = handleMessage;
  }
}

export async function initMIDI() {
  if (!navigator.requestMIDIAccess) {
    return { supported: false, error: 'Web MIDI not supported in this browser' };
  }
  try {
    midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    midiAccess.onstatechange = (e) => {
      if (e.port.type === 'input') {
        if (e.port.state === 'disconnected') {
          heldNotes.clear();
          fire();
        }
        wireInputs();
      }
    };
    wireInputs();
    return { supported: true };
  } catch (err) {
    return { supported: false, error: err.message };
  }
}
