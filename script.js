// ===========================================
// AFINACIÓN DE CELLO – MUSICALA
// Solo referencia auditiva (sin afinador por micrófono)
// ===========================================

// -------------------------------------------
// 1. Configuración básica
// -------------------------------------------

// Cuerdas del cello: C2, G2, D3, A3
const CELLO_STRINGS = [
  { id: "C2", midi: 36, name: "C (Do)",  label: "C (Do) – cuerda más grave" },
  { id: "G2", midi: 43, name: "G (Sol)", label: "G (Sol)" },
  { id: "D3", midi: 50, name: "D (Re)",  label: "D (Re)" },
  { id: "A3", midi: 57, name: "A (La)",  label: "A (La) – cuerda más aguda" },
];

// Intervalos de quinta entre cuerdas vecinas
const CELLO_INTERVALS = [
  { id: "C-G", label: "C (Do) – G (Sol)", lowIndex: 0, highIndex: 1 },
  { id: "G-D", label: "G (Sol) – D (Re)", lowIndex: 1, highIndex: 2 },
  { id: "D-A", label: "D (Re) – A (La)", lowIndex: 2, highIndex: 3 },
];

// Afinación de referencia (La 4)
let A4 = 440;

// Audio
let audioCtx = null;
const sustainedNotes = new Map();   // id cuerda -> {osc, gain}
let sequenceTimeouts = [];
let activeIntervalOsc = [];         // osciladores actuales de quinta
let fifthMode = "temperada";        // "temperada" o "pura"

// -------------------------------------------
// 2. Utilidades de audio
// -------------------------------------------

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function midiToFreq(midi, a4 = A4) {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

// Nota corta (click y suena)
function playShortTone(freq) {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.35, now + 0.05);
  gain.gain.setTargetAtTime(0, now + 0.6, 0.25);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 2);
}

// Nota larga (sostenida) ON/OFF
function toggleSustain(stringId, freq, buttonEl) {
  const ctx = getAudioContext();

  if (sustainedNotes.has(stringId)) {
    // Apagar
    const { osc, gain } = sustainedNotes.get(stringId);
    const now = ctx.currentTime;
    gain.gain.setTargetAtTime(0, now, 0.25);
    osc.stop(now + 1);
    sustainedNotes.delete(stringId);
    if (buttonEl) buttonEl.textContent = "Mantener nota";
    return;
  }

  // Encender
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;

  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.23, now + 0.3);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);

  sustainedNotes.set(stringId, { osc, gain });
  if (buttonEl) buttonEl.textContent = "Detener nota";
}

// Secuencia: recorre las cuatro cuerdas una por una
function playSequence() {
  stopAllAudio();
  const ctx = getAudioContext();

  let delayMs = 0;
  CELLO_STRINGS.forEach(string => {
    const freq = midiToFreq(string.midi);
    const timeoutId = setTimeout(() => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.05);
      gain.gain.setTargetAtTime(0, now + 0.6, 0.25);

      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.6);
    }, delayMs);

    sequenceTimeouts.push(timeoutId);
    delayMs += 900;
  });
}

// Quinta entre dos cuerdas (según modo actual)
function playFifthBetween(lowIndex, highIndex) {
  stopIntervalOnly();

  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const lowMidi = CELLO_STRINGS[lowIndex].midi;
  const highMidi = CELLO_STRINGS[highIndex].midi;

  const freqLow = midiToFreq(lowMidi);
  let freqHigh = midiToFreq(highMidi);

  if (fifthMode === "pura") {
    // quinta pura: 3/2 sobre la nota baja
    freqHigh = freqLow * 1.5;
  }

  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();

  osc1.type = "sine";
  osc2.type = "sine";
  osc1.frequency.value = freqLow;
  osc2.frequency.value = freqHigh;

  gain1.gain.setValueAtTime(0, now);
  gain2.gain.setValueAtTime(0, now);
  gain1.gain.linearRampToValueAtTime(0.22, now + 0.15);
  gain2.gain.linearRampToValueAtTime(0.22, now + 0.15);
  gain1.gain.setTargetAtTime(0, now + 2.4, 0.4);
  gain2.gain.setTargetAtTime(0, now + 2.4, 0.4);

  osc1.connect(gain1).connect(ctx.destination);
  osc2.connect(gain2).connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 4);
  osc2.stop(now + 4);

  activeIntervalOsc = [osc1, osc2];

  const timeoutId = setTimeout(() => {
    activeIntervalOsc = [];
  }, 4200);
  sequenceTimeouts.push(timeoutId);
}

// Detener solo el intervalo activo
function stopIntervalOnly() {
  activeIntervalOsc.forEach(osc => {
    try { osc.stop(); } catch (e) {}
  });
  activeIntervalOsc = [];
}

// Detener TODO
function stopAllAudio() {
  // Notas largas
  const ctx = getAudioContext();
  sustainedNotes.forEach(({ osc, gain }) => {
    const now = ctx.currentTime;
    gain.gain.setTargetAtTime(0, now, 0.25);
    try { osc.stop(now + 1); } catch (e) {}
  });
  sustainedNotes.clear();

  // Intervalos
  stopIntervalOnly();

  // Secuencia
  sequenceTimeouts.forEach(id => clearTimeout(id));
  sequenceTimeouts = [];

  // Volver texto de botones "Mantener nota"
  document.querySelectorAll("[data-sustain-btn]").forEach(btn => {
    btn.textContent = "Mantener nota";
  });
}

// -------------------------------------------
// 3. Construcción de interfaz
// -------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  setupInstrumentChip();
  setupA4Buttons();
  buildStringsTable();
  buildIntervalButtons();
  setupGlobalButtons();
  updateA4Label();
});

// “Chip” de instrumento (solo Cello, modo decorativo)
function setupInstrumentChip() {
  const tabs = document.getElementById("tabs");
  if (!tabs) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mx-tab";
  btn.setAttribute("aria-pressed", "true");
  btn.textContent = "Cello";
  btn.disabled = true; // es únicamente informativo
  tabs.appendChild(btn);
}

// Botones para elegir La 440 / 442 / 415, etc.
function setupA4Buttons() {
  const buttons = document.querySelectorAll(".mx-tab[data-a4]");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      const newA4 = parseFloat(btn.dataset.a4);
      if (!isNaN(newA4)) {
        A4 = newA4;
        buildStringsTable();
        updateA4Label();
      }
    });
  });
}

function updateA4Label() {
  const label = document.getElementById("labelA4");
  if (!label) return;
  label.textContent = A4.toFixed(2) + " Hz";
}

// Tabla con cuerdas del cello
function buildStringsTable() {
  const table = document.getElementById("tabla");
  if (!table) return;

  table.innerHTML = "";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Cuerda</th>
      <th>Frecuencia</th>
      <th>Escuchar</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  CELLO_STRINGS.forEach(string => {
    const freq = midiToFreq(string.midi);

    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = string.name;
    tdName.title = string.label;

    const tdFreq = document.createElement("td");
    tdFreq.textContent = freq.toFixed(2) + " Hz";

    const tdBtns = document.createElement("td");

    // Nota corta
    const btnShort = document.createElement("button");
    btnShort.type = "button";
    btnShort.className = "mx-btn mx-btn--ghost";
    btnShort.textContent = "Escuchar nota";
    btnShort.addEventListener("click", () => {
      playShortTone(freq);
    });

    // Nota sostenida (antes “drone”)
    const btnSustain = document.createElement("button");
    btnSustain.type = "button";
    btnSustain.className = "mx-btn mx-btn--ghost";
    btnSustain.textContent = "Mantener nota";
    btnSustain.dataset.sustainBtn = string.id;
    btnSustain.addEventListener("click", () => {
      toggleSustain(string.id, freq, btnSustain);
    });

    tdBtns.appendChild(btnShort);
    tdBtns.appendChild(btnSustain);

    tr.appendChild(tdName);
    tr.appendChild(tdFreq);
    tr.appendChild(tdBtns);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
}

// Botones de intervalos C–G, G–D, D–A
function buildIntervalButtons() {
  const cont = document.getElementById("intervalos");
  if (!cont) return;

  cont.innerHTML = "";

  CELLO_INTERVALS.forEach(interval => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mx-btn mx-btn--ghost";
    btn.textContent = interval.label;
    btn.addEventListener("click", () => {
      playFifthBetween(interval.lowIndex, interval.highIndex);
    });
    cont.appendChild(btn);
  });
}

// Botones globales (secuencia, stop, modo de quinta)
function setupGlobalButtons() {
  const btnSeq = document.getElementById("btn-secuencia");
  const btnStop = document.getElementById("btn-parar");
  const btnQPura = document.getElementById("btn-quinta-pura");
  const btnQTemp = document.getElementById("btn-quinta-temperada");

  if (btnSeq) {
    btnSeq.addEventListener("click", playSequence);
  }

  if (btnStop) {
    btnStop.addEventListener("click", stopAllAudio);
  }

  if (btnQPura && btnQTemp) {
    const updatePressed = () => {
      btnQPura.setAttribute("aria-pressed", fifthMode === "pura" ? "true" : "false");
      btnQTemp.setAttribute("aria-pressed", fifthMode === "temperada" ? "true" : "false");
    };

    btnQPura.addEventListener("click", () => {
      fifthMode = "pura";
      updatePressed();
    });

    btnQTemp.addEventListener("click", () => {
      fifthMode = "temperada";
      updatePressed();
    });

    // modo inicial
    fifthMode = "temperada";
    updatePressed();
  }
}
