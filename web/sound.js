// Adaptive procedural soundtrack and game feedback.
// The music is synthesized at runtime, so the client ships no audio asset bundle.

(function () {
  "use strict";

  const SOUND_COPY = {
    "nav.sound_mute": "Mute music and sound effects",
    "nav.sound_enable": "Enable music and sound effects",
    "nav.sound": "Music + FX",
    "nav.sound_off": "Music + FX off",
  };
  const translate = (key) =>
    window.ImpostralI18n?.t(key) || SOUND_COPY[key] || key;
  const STORAGE_KEY = "impostral.soundEnabled";
  const AudioContextType = window.AudioContext || window.webkitAudioContext;
  const MIN_GAIN = 0.0001;
  const LANDING_MUSIC_LEVEL = 0.07;
  const MUSIC_LEVEL = 0.12;
  const INTRO_MUSIC_LEVEL = 0.16;
  const RESULT_MUSIC_LEVEL = 0.14;
  const DUCKED_MUSIC_LEVEL = 0.018;
  const SFX_LEVEL = 0.32;
  const DUCKED_SFX_LEVEL = 0.15;
  const STEP_SECONDS = 60 / 76 / 2;
  const STEPS_PER_BAR = 8;
  const INTRO_STEPS = STEPS_PER_BAR * 4;
  const LANDING_STEPS = STEPS_PER_BAR * 16;
  const LANDING_CELL_STEPS = STEPS_PER_BAR * 4;
  const RESULT_STEPS = STEPS_PER_BAR * 6;
  const MAX_MUSIC_VOICES = 16;
  const LOOKAHEAD_MS = 80;
  const SCHEDULE_AHEAD_SECONDS = 0.18;

  const NOTE = {
    A1: 55,
    BB1: 58.27,
    C2: 65.41,
    D2: 73.42,
    EB2: 77.78,
    E2: 82.41,
    FS2: 92.5,
    F2: 87.31,
    G2: 98,
    A2: 110,
    BB2: 116.54,
    B2: 123.47,
    C3: 130.81,
    CS3: 138.59,
    D3: 146.83,
    EB3: 155.56,
    E3: 164.81,
    F3: 174.61,
    FS3: 185,
    G3: 196,
    A3: 220,
    BB3: 233.08,
    B3: 246.94,
    C4: 261.63,
    CS4: 277.18,
    D4: 293.66,
    EB4: 311.13,
    E4: 329.63,
    F4: 349.23,
    FS4: 369.99,
    G4: 392,
    A4: 440,
    C5: 523.25,
    D5: 587.33,
    E5: 659.25,
    F5: 698.46,
    A5: 880,
  };

  // The landing page is a distant signal rather than a gameplay loop. Four
  // slow harmonic cells span roughly fifty seconds before resolving into the
  // D-minor entry cue. Sparse beacons keep it alive without exposing a motif.
  const LANDING_HARMONY = [
    { bass: NOTE.D2, chord: [NOTE.A2, NOTE.D3, NOTE.E3, NOTE.F3], filter: 920 },
    { bass: NOTE.BB1, chord: [NOTE.F2, NOTE.A2, NOTE.D3, NOTE.E3], filter: 1080 },
    { bass: NOTE.C2, chord: [NOTE.G2, NOTE.A2, NOTE.D3, NOTE.E3], filter: 1180 },
    { bass: NOTE.A1, chord: [NOTE.E2, NOTE.G2, NOTE.BB2, NOTE.D3], filter: 860 },
  ];
  const LANDING_BEACONS = new Map([
    [6, NOTE.D5],
    [22, NOTE.A4],
    [39, NOTE.E5],
    [57, NOTE.F5],
    [73, NOTE.A4],
    [90, NOTE.D5],
    [106, NOTE.C5],
    [122, NOTE.A4],
  ]);

  // A four-bar arrival: warm analogue depth under crisp pixel transients.
  const INTRO_HARMONY = [
    { bass: NOTE.D2, chord: [NOTE.D3, NOTE.F3, NOTE.A3, NOTE.E4] },
    { bass: NOTE.BB1, chord: [NOTE.BB2, NOTE.D3, NOTE.F3, NOTE.A3] },
    { bass: NOTE.G2, chord: [NOTE.G3, NOTE.A3, NOTE.BB3, NOTE.D4] },
    { bass: NOTE.A2, chord: [NOTE.A3, NOTE.D4, NOTE.EB4, NOTE.G4] },
  ];
  const INTRO_MELODY = [
    null, NOTE.D4, null, NOTE.F4, null, NOTE.A4, null, NOTE.E4,
    null, NOTE.A4, null, NOTE.F4, null, NOTE.D4, null, NOTE.C4,
    null, NOTE.D4, null, NOTE.G4, null, NOTE.A4, NOTE.G4, NOTE.D4,
    NOTE.A3, null, NOTE.D4, NOTE.EB4, NOTE.D4, NOTE.A3, NOTE.EB4, NOTE.D5,
  ];

  // Result scores are finite six-bar themes, not looping stingers. They share
  // the main music bus so narration still ducks them, and each outcome has a
  // distinct harmonic conclusion: major for humans, chromatic minor for an
  // agent, and an unresolved open fifth for a draw.
  const RESULT_SCORES = {
    human: {
      filter: 1850,
      bars: [
        { bass: NOTE.D2, chord: [NOTE.D3, NOTE.FS3, NOTE.A3] },
        { bass: NOTE.G2, chord: [NOTE.G3, NOTE.B3, NOTE.D4] },
        { bass: NOTE.B2, chord: [NOTE.B2, NOTE.D3, NOTE.FS3] },
        { bass: NOTE.A2, chord: [NOTE.A2, NOTE.CS3, NOTE.E3] },
        { bass: NOTE.G2, chord: [NOTE.G3, NOTE.B3, NOTE.D4] },
        { bass: NOTE.D2, chord: [NOTE.D3, NOTE.FS3, NOTE.A3, NOTE.D4] },
      ],
      melody: [
        NOTE.D4, null, NOTE.FS4, null, NOTE.A4, null, NOTE.D5, null,
        NOTE.B3, null, NOTE.D4, null, NOTE.G4, null, NOTE.FS4, null,
        NOTE.D4, null, NOTE.FS4, null, NOTE.B3, null, NOTE.D5, null,
        NOTE.CS4, null, NOTE.E4, null, NOTE.A4, null, NOTE.E5, null,
        NOTE.B3, null, NOTE.D4, NOTE.G4, null, NOTE.FS4, NOTE.A4, null,
        NOTE.D4, null, NOTE.FS4, null, NOTE.A4, null, NOTE.D5, null,
      ],
    },
    agent: {
      filter: 980,
      bars: [
        { bass: NOTE.D2, chord: [NOTE.D3, NOTE.F3, NOTE.A3] },
        { bass: NOTE.EB2, chord: [NOTE.EB3, NOTE.G3, NOTE.BB3] },
        { bass: NOTE.BB1, chord: [NOTE.BB2, NOTE.D3, NOTE.F3] },
        { bass: NOTE.A1, chord: [NOTE.A2, NOTE.CS3, NOTE.E3, NOTE.G3] },
        { bass: NOTE.EB2, chord: [NOTE.EB3, NOTE.FS3, NOTE.A3] },
        { bass: NOTE.D2, chord: [NOTE.D3, NOTE.F3, NOTE.A3, NOTE.EB4] },
      ],
      melody: [
        NOTE.D5, null, NOTE.A4, null, NOTE.F4, null, NOTE.EB4, null,
        NOTE.EB4, null, NOTE.BB3, null, NOTE.G3, null, NOTE.FS3, null,
        NOTE.F4, null, NOTE.D4, null, NOTE.BB3, null, NOTE.A3, null,
        NOTE.A4, null, NOTE.E4, null, NOTE.CS4, null, NOTE.A3, null,
        NOTE.EB4, NOTE.D4, null, NOTE.FS3, null, NOTE.A3, NOTE.EB4, null,
        NOTE.D4, null, NOTE.A3, null, NOTE.F3, null, NOTE.D3, null,
      ],
    },
    draw: {
      filter: 1320,
      bars: [
        { bass: NOTE.D2, chord: [NOTE.D3, NOTE.G3, NOTE.A3] },
        { bass: NOTE.C2, chord: [NOTE.C3, NOTE.D3, NOTE.G3] },
        { bass: NOTE.BB1, chord: [NOTE.BB2, NOTE.D3, NOTE.A3] },
        { bass: NOTE.A1, chord: [NOTE.A2, NOTE.D3, NOTE.E3] },
        { bass: NOTE.C2, chord: [NOTE.C3, NOTE.G3, NOTE.A3] },
        { bass: NOTE.D2, chord: [NOTE.D3, NOTE.A3, NOTE.D4] },
      ],
      melody: [
        NOTE.A4, null, NOTE.D5, null, NOTE.G4, null, NOTE.A4, null,
        NOTE.G4, null, NOTE.D4, null, NOTE.A3, null, NOTE.D4, null,
        NOTE.F4, null, NOTE.D4, null, NOTE.A3, null, NOTE.D4, null,
        NOTE.E4, null, NOTE.A4, null, NOTE.D5, null, NOTE.A4, null,
        NOTE.G4, null, NOTE.D4, null, NOTE.A4, null, NOTE.G4, null,
        NOTE.D4, null, NOTE.A4, null, NOTE.D5, null, NOTE.A4, null,
      ],
    },
  };

  // Sixteen-step motifs stay sparse so speech remains the focus.
  const PHASE_MUSIC = {
    lobby: {
      filter: 1350,
      melody: [
        NOTE.D3, null, null, NOTE.A3, null, null, NOTE.F3, null,
        NOTE.D3, null, null, NOTE.G3, null, NOTE.F3, null, null,
      ],
      bass: [
        NOTE.D2, null, null, null, null, null, null, null,
        NOTE.A2, null, null, null, null, null, null, null,
      ],
    },
    question: {
      filter: 1650,
      melody: [
        NOTE.D3, null, NOTE.F3, null, NOTE.A3, null, NOTE.G3, null,
        NOTE.D3, null, NOTE.C4, null, NOTE.A3, null, NOTE.F3, null,
      ],
      bass: [
        NOTE.D2, null, null, null, null, null, null, null,
        NOTE.A2, null, null, null, null, null, null, null,
      ],
    },
    vote: {
      filter: 1200,
      melody: [
        NOTE.D3, null, NOTE.EB3, null, NOTE.D3, null, NOTE.C4, null,
        NOTE.D3, null, NOTE.EB3, null, NOTE.A3, null, NOTE.EB3, null,
      ],
      bass: [
        NOTE.D2, null, NOTE.EB2, null, null, null, null, null,
        NOTE.D2, null, NOTE.EB2, null, null, null, null, null,
      ],
    },
    resolution: {
      filter: 900,
      melody: [
        null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null,
      ],
      bass: [
        NOTE.D2, null, NOTE.D2, null, null, null, null, null,
        NOTE.A2, null, NOTE.A2, null, null, null, null, null,
      ],
    },
    game_over: {
      filter: 850,
      melody: new Array(16).fill(null),
      bass: new Array(16).fill(null),
    },
  };

  let enabled = readPreference();
  let context = null;
  let masterBus = null;
  let musicBus = null;
  let musicFilter = null;
  let activeMusicLayer = null;
  let sfxBus = null;
  let noiseBuffer = null;
  let scheduler = null;
  let nextStepAt = 0;
  let musicNeedsRefresh = false;
  let transportStep = 0;
  let sceneStep = 0;
  let phase = "lobby";
  let pendingPhase = null;
  let scene = "silent";
  let pendingScene = null;
  let introPlayedForEntry = false;
  let introExitRequested = false;
  let resultKind = null;
  let resultLocked = false;
  let resultFinished = false;
  let voiceDepth = 0;
  let recordingDepth = 0;
  let liveSfx = 0;
  let control = null;
  let controlLabel = null;
  const lastPlayedAt = new Map();

  function readPreference() {
    try {
      return localStorage.getItem(STORAGE_KEY) !== "false";
    } catch {
      return true;
    }
  }

  function persistPreference() {
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // Sound still works when storage is unavailable.
    }
  }

  function setParam(param, value) {
    if (param) param.value = value;
  }

  function ensureContext() {
    if (context || !AudioContextType) return context;

    context = new AudioContextType();
    masterBus = context.createGain();
    musicBus = context.createGain();
    musicFilter = context.createBiquadFilter();
    sfxBus = context.createGain();
    const compressor = context.createDynamicsCompressor();

    setParam(masterBus.gain, 0.72);
    setParam(musicBus.gain, MIN_GAIN);
    setParam(sfxBus.gain, SFX_LEVEL);
    musicFilter.type = "lowpass";
    setParam(musicFilter.frequency, PHASE_MUSIC[phase].filter);
    setParam(musicFilter.Q, 0.7);
    setParam(compressor.threshold, -18);
    setParam(compressor.knee, 12);
    setParam(compressor.ratio, 4);
    setParam(compressor.attack, 0.003);
    setParam(compressor.release, 0.16);

    musicBus.connect(musicFilter);
    musicFilter.connect(compressor);
    sfxBus.connect(compressor);
    compressor.connect(masterBus);
    masterBus.connect(context.destination);

    if (typeof context.createBuffer === "function") {
      const length = Math.ceil(context.sampleRate * 0.48);
      noiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) {
        const envelope = 1 - index / length;
        data[index] = (Math.random() * 2 - 1) * envelope;
      }
    }
    return context;
  }

  function ramp(param, target, duration) {
    if (!context || !param) return;
    const now = context.currentTime;
    const currentValue = Math.max(MIN_GAIN, param.value);
    let held = false;
    if (typeof param.cancelAndHoldAtTime === "function") {
      try {
        param.cancelAndHoldAtTime(now);
        held = true;
      } catch { /* Older WebKit builds expose the method before fully supporting it. */ }
    }
    if (!held) {
      param.cancelScheduledValues(now);
      param.setValueAtTime(currentValue, now);
    }
    if (duration <= 0) {
      param.setValueAtTime(Math.max(MIN_GAIN, target), now);
      return;
    }
    param.linearRampToValueAtTime(Math.max(MIN_GAIN, target), now + duration);
  }

  function desiredMusicLevel() {
    if (
      !enabled
      || scene === "silent"
      || document.hidden
      || (scene === "game" && phase === "game_over")
      || (scene === "result" && resultFinished)
    ) return MIN_GAIN;
    if (recordingDepth > 0) return MIN_GAIN;
    if (voiceDepth > 0) return DUCKED_MUSIC_LEVEL;
    if (scene === "landing") return LANDING_MUSIC_LEVEL;
    if (scene === "entry") return INTRO_MUSIC_LEVEL;
    if (scene === "result") return RESULT_MUSIC_LEVEL;
    return MUSIC_LEVEL;
  }

  function desiredSfxLevel() {
    if (!enabled || recordingDepth > 0) return MIN_GAIN;
    return voiceDepth > 0 ? DUCKED_SFX_LEVEL : SFX_LEVEL;
  }

  function applyMix(duration = 0.12) {
    if (!context) return;
    ramp(musicBus.gain, desiredMusicLevel(), duration);
    ramp(sfxBus.gain, desiredSfxLevel(), Math.min(duration, 0.08));
  }

  function disconnect(nodes) {
    for (const node of nodes) {
      try { node.disconnect(); } catch { /* The node may already be disconnected. */ }
    }
  }

  function ensureMusicLayer() {
    if (activeMusicLayer || !context || !musicBus) return activeMusicLayer;
    const gain = context.createGain();
    setParam(gain.gain, 1);
    gain.connect(musicBus);
    activeMusicLayer = {
      gain,
      retired: false,
      voices: new Set(),
    };
    return activeMusicLayer;
  }

  function releaseMusicVoice(voice) {
    if (!voice || voice.released) return;
    voice.released = true;
    voice.layer.voices.delete(voice);
    disconnect(voice.nodes);
    if (voice.layer.retired && voice.layer.voices.size === 0) {
      disconnect([voice.layer.gain]);
    }
  }

  function trackMusicVoice(source, nodes, naturalStopAt) {
    const layer = ensureMusicLayer();
    if (!layer) return null;
    const voice = {
      layer,
      naturalStopAt,
      nodes,
      released: false,
      source,
    };
    layer.voices.add(voice);
    source.onended = () => releaseMusicVoice(voice);
    return voice;
  }

  function retireMusicLayer(fadeDuration = 0) {
    const layer = activeMusicLayer;
    activeMusicLayer = null;
    if (!layer || !context) return;
    layer.retired = true;
    ramp(layer.gain.gain, MIN_GAIN, fadeDuration);
    const stopBy = context.currentTime + Math.max(0, fadeDuration);
    for (const voice of [...layer.voices]) {
      try {
        voice.source.stop(Math.min(voice.naturalStopAt, stopBy));
      } catch {
        releaseMusicVoice(voice);
      }
    }
    if (layer.voices.size === 0) disconnect([layer.gain]);
  }

  function tone({
    frequency,
    endFrequency = null,
    delay = 0,
    duration = 0.1,
    attack = 0.004,
    volume = 0.15,
    type = "square",
    destination = sfxBus,
    tracked = true,
  }) {
    if (!context || !destination || context.state !== "running") return false;
    if (tracked && liveSfx >= 16) return false;

    const start = context.currentTime + delay;
    const end = start + duration;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, endFrequency),
        Math.max(start + 0.01, end - 0.012),
      );
    }
    envelope.gain.setValueAtTime(MIN_GAIN, start);
    envelope.gain.linearRampToValueAtTime(volume, start + Math.min(attack, duration / 3));
    envelope.gain.exponentialRampToValueAtTime(MIN_GAIN, end);
    oscillator.connect(envelope);
    envelope.connect(destination);
    if (tracked) liveSfx += 1;
    oscillator.onended = () => {
      if (tracked) liveSfx = Math.max(0, liveSfx - 1);
      disconnect([oscillator, envelope]);
    };
    oscillator.start(start);
    oscillator.stop(end + 0.025);
    return true;
  }

  function noise({
    delay = 0,
    duration = 0.22,
    volume = 0.14,
    frequency = 520,
  } = {}) {
    if (!context || !noiseBuffer || context.state !== "running" || liveSfx >= 16) return;
    const start = context.currentTime + delay;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = noiseBuffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(frequency, start);
    filter.frequency.exponentialRampToValueAtTime(90, start + duration);
    filter.Q.value = 0.9;
    envelope.gain.setValueAtTime(volume, start);
    envelope.gain.exponentialRampToValueAtTime(MIN_GAIN, start + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(sfxBus);
    liveSfx += 1;
    source.onended = () => {
      liveSfx = Math.max(0, liveSfx - 1);
      disconnect([source, filter, envelope]);
    };
    source.start(start);
    source.stop(start + duration);
  }

  function musicNote(frequency, at, duration, volume, type) {
    if (!context || context.state !== "running") return;
    const layer = ensureMusicLayer();
    if (!layer || layer.voices.size >= MAX_MUSIC_VOICES) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const naturalStopAt = at + duration + 0.025;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    envelope.gain.setValueAtTime(MIN_GAIN, at);
    envelope.gain.linearRampToValueAtTime(volume, at + 0.018);
    envelope.gain.exponentialRampToValueAtTime(MIN_GAIN, at + duration);
    oscillator.connect(envelope);
    envelope.connect(layer.gain);
    trackMusicVoice(oscillator, [oscillator, envelope], naturalStopAt);
    oscillator.start(at);
    oscillator.stop(naturalStopAt);
  }

  function musicPad(frequency, at, duration, volume, type = "sine") {
    if (!context || context.state !== "running") return;
    const layer = ensureMusicLayer();
    if (!layer || layer.voices.size >= MAX_MUSIC_VOICES) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const attack = Math.min(STEP_SECONDS * 3.2, duration * 0.28);
    const release = Math.min(STEP_SECONDS * 4.2, duration * 0.32);
    const naturalStopAt = at + duration + 0.025;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    envelope.gain.setValueAtTime(MIN_GAIN, at);
    envelope.gain.linearRampToValueAtTime(volume, at + attack);
    envelope.gain.setValueAtTime(volume * 0.78, at + duration - release);
    envelope.gain.exponentialRampToValueAtTime(MIN_GAIN, at + duration);
    oscillator.connect(envelope);
    envelope.connect(layer.gain);
    trackMusicVoice(oscillator, [oscillator, envelope], naturalStopAt);
    oscillator.start(at);
    oscillator.stop(naturalStopAt);
  }

  function musicTexture(at, duration) {
    if (!context || !noiseBuffer || context.state !== "running") return;
    const layer = ensureMusicLayer();
    if (!layer || layer.voices.size >= MAX_MUSIC_VOICES) return;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    const naturalStopAt = at + duration + 0.02;
    source.buffer = noiseBuffer;
    source.loop = true;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(190, at);
    filter.frequency.exponentialRampToValueAtTime(760, at + duration * 0.58);
    filter.frequency.exponentialRampToValueAtTime(230, at + duration);
    filter.Q.value = 0.55;
    envelope.gain.setValueAtTime(MIN_GAIN, at);
    envelope.gain.linearRampToValueAtTime(0.014, at + duration * 0.24);
    envelope.gain.exponentialRampToValueAtTime(MIN_GAIN, at + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(layer.gain);
    trackMusicVoice(source, [source, filter, envelope], naturalStopAt);
    source.start(at);
    source.stop(naturalStopAt);
  }

  function musicSwell(at = context?.currentTime + 0.025) {
    if (!context || !noiseBuffer || context.state !== "running") return;
    const layer = ensureMusicLayer();
    if (!layer || layer.voices.size >= MAX_MUSIC_VOICES) return;
    const start = at;
    const duration = STEP_SECONDS * 3.6;
    const naturalStopAt = start + duration + 0.02;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = noiseBuffer;
    source.loop = true;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(180, start);
    filter.frequency.exponentialRampToValueAtTime(1400, start + duration * 0.72);
    filter.Q.value = 0.65;
    envelope.gain.setValueAtTime(MIN_GAIN, start);
    envelope.gain.linearRampToValueAtTime(0.034, start + duration * 0.48);
    envelope.gain.exponentialRampToValueAtTime(MIN_GAIN, start + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(layer.gain);
    trackMusicVoice(source, [source, filter, envelope], naturalStopAt);
    source.start(start);
    source.stop(naturalStopAt);
  }

  function scheduleIntroStep(at) {
    const index = sceneStep % INTRO_STEPS;
    const bar = Math.floor(index / STEPS_PER_BAR);
    const barStep = index % STEPS_PER_BAR;
    const harmony = INTRO_HARMONY[bar];
    const melody = INTRO_MELODY[index];

    if (index === 0) musicSwell(at);
    if (barStep === 0) {
      musicNote(harmony.bass, at, STEP_SECONDS * 7.7, 0.1, "sine");
      harmony.chord.forEach((frequency, chordIndex) => {
        musicNote(
          frequency,
          at + chordIndex * 0.014,
          STEP_SECONDS * 6.7,
          0.043 - chordIndex * 0.004,
          chordIndex % 2 === 0 ? "triangle" : "sine",
        );
      });
    }
    if (melody) {
      const urgent = bar === 3;
      musicNote(
        melody,
        at,
        STEP_SECONDS * (urgent ? 0.58 : 0.82),
        urgent ? 0.078 : 0.065,
        "triangle",
      );
      musicNote(
        melody * 2,
        at,
        STEP_SECONDS * 0.2,
        urgent ? 0.021 : 0.014,
        "square",
      );
    }
  }

  function scheduleResultStep(at) {
    const score = RESULT_SCORES[resultKind] || RESULT_SCORES.draw;
    const index = sceneStep % RESULT_STEPS;
    const barIndex = Math.floor(index / STEPS_PER_BAR);
    const barStep = index % STEPS_PER_BAR;
    const harmony = score.bars[barIndex];
    const melody = score.melody[index];

    if (barStep === 0) {
      const finalBar = barIndex === score.bars.length - 1;
      const duration = STEP_SECONDS * (finalBar ? 7.9 : 7.5);
      musicPad(harmony.bass, at, duration, finalBar ? 0.105 : 0.082, "sine");
      harmony.chord.forEach((frequency, chordIndex) => {
        musicPad(
          frequency,
          at + chordIndex * 0.026,
          duration,
          (finalBar ? 0.048 : 0.038) - chordIndex * 0.004,
          chordIndex % 2 === 0 ? "triangle" : "sine",
        );
      });
      if (barIndex === 0 || barIndex === 4) {
        musicTexture(at, STEP_SECONDS * 7.2);
      }
      if (context && musicFilter) {
        musicFilter.frequency.cancelScheduledValues(at);
        musicFilter.frequency.setValueAtTime(
          Math.max(620, score.filter - 260),
          at,
        );
        musicFilter.frequency.linearRampToValueAtTime(
          score.filter,
          at + STEP_SECONDS * 6.8,
        );
      }
    }

    if (melody) {
      const finalBar = barIndex === score.bars.length - 1;
      musicNote(
        melody,
        at,
        STEP_SECONDS * (finalBar ? 1.45 : 0.82),
        finalBar ? 0.075 : 0.064,
        "triangle",
      );
      if (resultKind === "human" && barStep % 4 === 0) {
        musicNote(melody * 2, at + 0.018, STEP_SECONDS * 0.22, 0.011, "square");
      }
    }
  }

  function scheduleLandingStep(at) {
    const index = sceneStep % LANDING_STEPS;
    const cellIndex = Math.floor(index / LANDING_CELL_STEPS);
    const cellStep = index % LANDING_CELL_STEPS;
    const harmony = LANDING_HARMONY[cellIndex];

    if (cellStep === 0) {
      const duration = STEP_SECONDS * (LANDING_CELL_STEPS + 2);
      musicPad(harmony.bass, at, duration, 0.072, "sine");
      harmony.chord.forEach((frequency, chordIndex) => {
        musicPad(
          frequency,
          at + chordIndex * 0.045,
          duration,
          0.03 - chordIndex * 0.003,
          chordIndex % 2 === 0 ? "triangle" : "sine",
        );
      });
      musicTexture(at, STEP_SECONDS * (LANDING_CELL_STEPS - 0.5));
      if (context && musicFilter) {
        musicFilter.frequency.cancelScheduledValues(at);
        musicFilter.frequency.setValueAtTime(
          Math.max(620, harmony.filter - 180),
          at,
        );
        musicFilter.frequency.linearRampToValueAtTime(
          harmony.filter,
          at + STEP_SECONDS * (LANDING_CELL_STEPS - 1),
        );
      }
    }

    const beacon = LANDING_BEACONS.get(index);
    if (beacon) {
      musicNote(beacon, at, STEP_SECONDS * 3.4, 0.044, "triangle");
      musicNote(
        beacon / 2,
        at + STEP_SECONDS * 1.8,
        STEP_SECONDS * 3.8,
        0.018,
        "sine",
      );
      musicNote(beacon * 2, at + 0.035, 0.045, 0.008, "square");
    }
  }

  function scheduleLoopStep(at) {
    const motif = PHASE_MUSIC[phase] || PHASE_MUSIC.lobby;
    const index = sceneStep % motif.melody.length;
    const cycle = Math.floor(sceneStep / motif.melody.length) % 4;
    let melody = motif.melody[index];
    const bass = motif.bass[index];

    // The waiting room breathes over four phrases instead of exposing a short loop.
    if (phase === "lobby") {
      if (cycle === 1 && index === 13) melody = NOTE.C4;
      if (cycle === 2 && index === 10) melody = NOTE.A3;
      if (cycle === 3 && (index === 3 || index === 12)) melody = null;
    }
    if (melody) {
      musicNote(melody, at, STEP_SECONDS * 0.72, 0.12, "triangle");
      if (cycle !== 1) {
        musicNote(melody * 2, at, STEP_SECONDS * 0.24, 0.018, "square");
      }
    }
    if (bass) musicNote(bass, at, STEP_SECONDS * 1.7, 0.16, "sine");
  }

  function applyPhase(next) {
    phase = PHASE_MUSIC[next] ? next : "lobby";
    pendingPhase = null;
    if (context && musicFilter) {
      const now = context.currentTime;
      musicFilter.frequency.cancelScheduledValues(now);
      musicFilter.frequency.linearRampToValueAtTime(
        PHASE_MUSIC[phase].filter,
        now + 0.4,
      );
    }
  }

  function transitionScene(next) {
    if (next === scene) {
      pendingScene = null;
      return false;
    }

    const previous = scene;
    const fadeDuration = previous === "landing" && next === "entry"
      ? 1.1
      : next === "landing"
        ? 0.9
        : 0.7;
    retireMusicLayer(fadeDuration);
    scene = next;
    pendingScene = null;
    sceneStep = 0;
    musicNeedsRefresh = false;

    if (scene === "landing") {
      if (context && musicFilter) {
        const now = context.currentTime;
        musicFilter.frequency.cancelScheduledValues(now);
        musicFilter.frequency.linearRampToValueAtTime(740, now + 0.8);
      }
    } else if (scene === "entry") {
      if (context && musicFilter) {
        const now = context.currentTime;
        musicFilter.frequency.cancelScheduledValues(now);
        musicFilter.frequency.linearRampToValueAtTime(1380, now + 0.65);
      }
    } else if (scene === "result") {
      if (context && musicFilter) {
        const now = context.currentTime;
        const score = RESULT_SCORES[resultKind] || RESULT_SCORES.draw;
        musicFilter.frequency.cancelScheduledValues(now);
        musicFilter.frequency.linearRampToValueAtTime(
          Math.max(620, score.filter - 260),
          now + 0.7,
        );
      }
    } else if (scene === "game") {
      if (pendingPhase) applyPhase(pendingPhase);
      else if (context && musicFilter) {
        const now = context.currentTime;
        musicFilter.frequency.cancelScheduledValues(now);
        musicFilter.frequency.linearRampToValueAtTime(
          PHASE_MUSIC[phase].filter,
          now + 0.55,
        );
      }
    }

    if (scene !== "silent") ensureMusicLayer();
    applyMix(scene === "entry" ? 1.4 : 0.75);
    return true;
  }

  function requestScene(next) {
    if (next === scene && !pendingScene) {
      startMusic();
      return false;
    }
    if (scheduler) {
      pendingScene = next;
      scheduleMusic();
    } else {
      transitionScene(next);
      startMusic();
    }
    return true;
  }

  function finishIntro() {
    introExitRequested = false;
    transitionScene("game");
    applyMix(0.9);
  }

  function scheduleMusic() {
    if (!context || context.state !== "running" || !scheduler) return;
    if (nextStepAt < context.currentTime - STEP_SECONDS) {
      nextStepAt = context.currentTime + 0.05;
    }
    while (nextStepAt < context.currentTime + SCHEDULE_AHEAD_SECONDS) {
      if (pendingScene) transitionScene(pendingScene);
      if (
        scene === "entry"
        && (
          sceneStep >= INTRO_STEPS
          || (
            introExitRequested
            && sceneStep > 0
            && sceneStep % STEPS_PER_BAR === 0
          )
        )
      ) {
        finishIntro();
      }
      if (scene === "result" && sceneStep >= RESULT_STEPS) {
        clearInterval(scheduler);
        scheduler = null;
        nextStepAt = 0;
        resultFinished = true;
        break;
      }
      if (scene === "game" && sceneStep % STEPS_PER_BAR === 0 && pendingPhase) {
        applyPhase(pendingPhase);
      }
      if (scene === "landing") scheduleLandingStep(nextStepAt);
      else if (scene === "entry") scheduleIntroStep(nextStepAt);
      else if (scene === "game") scheduleLoopStep(nextStepAt);
      else if (scene === "result") scheduleResultStep(nextStepAt);
      nextStepAt += STEP_SECONDS;
      transportStep += 1;
      sceneStep += 1;
    }
  }

  function startMusic() {
    if (
      scheduler ||
      !enabled ||
      scene === "silent" ||
      document.hidden ||
      (scene === "game" && phase === "game_over") ||
      (scene === "result" && resultFinished) ||
      !context ||
      context.state !== "running"
    ) return;
    if (musicNeedsRefresh) {
      const phraseLength = scene === "landing"
        ? LANDING_CELL_STEPS
        : scene === "result"
          ? STEPS_PER_BAR
        : STEPS_PER_BAR;
      sceneStep -= sceneStep % phraseLength;
      musicNeedsRefresh = false;
    }
    nextStepAt = context.currentTime + 0.05;
    ensureMusicLayer();
    scheduler = setInterval(scheduleMusic, LOOKAHEAD_MS);
    applyMix(scene === "entry" ? 1.4 : 0.7);
    scheduleMusic();
  }

  function stopMusic(fadeDuration = 0.25) {
    if (scheduler) clearInterval(scheduler);
    scheduler = null;
    nextStepAt = 0;
    if (scene !== "silent") musicNeedsRefresh = true;
    retireMusicLayer(fadeDuration);
    if (musicBus) ramp(musicBus.gain, MIN_GAIN, fadeDuration);
  }

  async function unlock() {
    if (!enabled || !AudioContextType) {
      updateControl();
      return false;
    }
    ensureContext();
    try {
      if (context.state !== "running" && context.state !== "closed") {
        await context.resume();
      }
    } catch {
      return false;
    }
    const ready = context.state === "running";
    if (ready) {
      applyMix(0.06);
      startMusic();
    }
    return ready;
  }

  async function startLandingFromGesture() {
    if (!enabled || !AudioContextType || document.hidden) return false;
    if (
      scene === "entry"
      || scene === "game"
      || scene === "result"
      || pendingScene === "entry"
      || pendingScene === "game"
      || pendingScene === "result"
    ) return false;
    if (scene === "landing" && scheduler) return false;

    if (scene !== "landing") transitionScene("landing");
    const ready = await unlock();
    if (!ready || scene !== "landing") return false;
    startMusic();
    return true;
  }

  function beginEntry() {
    if (
      !enabled
      || !context
      || context.state !== "running"
      || document.hidden
      || resultLocked
    ) return false;
    if (introPlayedForEntry || scene === "entry" || pendingScene === "entry") return false;

    introPlayedForEntry = true;
    introExitRequested = false;
    if (phase === "game_over") applyPhase("lobby");
    tone({
      frequency: NOTE.D3,
      endFrequency: NOTE.D4,
      delay: 0.03,
      duration: 0.24,
      volume: 0.08,
      type: "triangle",
    });
    tone({
      frequency: NOTE.D5,
      delay: 0.12,
      duration: 0.08,
      volume: 0.038,
      type: "square",
    });
    requestScene("entry");
    return true;
  }

  function playResult(outcome) {
    const aliases = {
      human: "human",
      humans: "human",
      agent: "agent",
      agents: "agent",
      draw: "draw",
      neutral: "draw",
    };
    const normalized = aliases[String(outcome || "").toLowerCase()];
    if (!normalized || resultLocked) return false;

    resultKind = normalized;
    resultLocked = true;
    resultFinished = false;
    introExitRequested = false;
    pendingPhase = null;
    applyPhase("game_over");
    requestScene("result");
    startMusic();
    return true;
  }

  function setPhase(next) {
    const normalized = PHASE_MUSIC[next] ? next : "lobby";
    if (normalized === "game_over") {
      applyPhase(normalized);
      if (scene !== "result" && pendingScene !== "result") stopMusic(0.8);
      return;
    }
    if (normalized === phase || normalized === pendingPhase) return;
    if (scene === "entry" || pendingScene === "entry") {
      pendingPhase = normalized;
      if (normalized !== "lobby") introExitRequested = true;
      return;
    }
    if (scene === "game" && scheduler) pendingPhase = normalized;
    else if (scene === "landing") pendingPhase = normalized;
    else applyPhase(normalized);
    startMusic();
  }

  function returnToLanding() {
    const alreadyLanding = scene === "landing" && !pendingScene;
    introPlayedForEntry = false;
    introExitRequested = false;
    resultKind = null;
    resultLocked = false;
    resultFinished = false;
    pendingPhase = null;
    phase = "lobby";
    transitionScene("landing");
    startMusic();
    return !alreadyLanding;
  }

  function setGameActive(active) {
    const next = Boolean(active);
    if (next) {
      if (scene === "result" || pendingScene === "result") {
        startMusic();
        applyMix(0.55);
        return;
      }
      if (scene !== "entry" && pendingScene !== "entry") requestScene("game");
      startMusic();
      applyMix(0.55);
      return;
    }
    returnToLanding();
  }

  function allowedByCooldown(name) {
    const cooldown = {
      select: 35,
      tick: 180,
      "tick-final": 180,
      turn: 120,
      "your-turn": 300,
    }[name] || 60;
    const now = Date.now();
    const last = lastPlayedAt.get(name) || 0;
    if (now - last < cooldown) return false;
    lastPlayedAt.set(name, now);
    return true;
  }

  function play(name) {
    if (
      !enabled ||
      recordingDepth > 0 ||
      !context ||
      context.state !== "running" ||
      !allowedByCooldown(name)
    ) return false;

    switch (name) {
      case "confirm":
        tone({ frequency: NOTE.D5, duration: 0.07, volume: 0.13 });
        tone({ frequency: NOTE.A5, delay: 0.055, duration: 0.08, volume: 0.1 });
        break;
      case "question":
        tone({ frequency: NOTE.D4, duration: 0.11, volume: 0.14, type: "triangle" });
        tone({ frequency: NOTE.F4, delay: 0.08, duration: 0.12, volume: 0.12 });
        tone({ frequency: NOTE.A4, delay: 0.16, duration: 0.16, volume: 0.09 });
        break;
      case "turn":
        tone({ frequency: NOTE.G4, duration: 0.055, volume: 0.07 });
        break;
      case "your-turn":
        tone({ frequency: NOTE.A4, duration: 0.09, volume: 0.14 });
        tone({ frequency: NOTE.D5, delay: 0.075, duration: 0.14, volume: 0.16 });
        break;
      case "tick":
        tone({ frequency: NOTE.F5, duration: 0.04, volume: 0.09 });
        break;
      case "tick-final":
        tone({ frequency: NOTE.A5, duration: 0.055, volume: 0.12 });
        break;
      case "select":
        tone({
          frequency: 650,
          endFrequency: 820,
          duration: 0.045,
          volume: 0.1,
        });
        break;
      case "submit":
        tone({
          frequency: NOTE.D5,
          endFrequency: NOTE.A5,
          duration: 0.11,
          volume: 0.15,
        });
        break;
      case "vote-open":
        tone({ frequency: NOTE.D3, duration: 0.13, volume: 0.16, type: "triangle" });
        tone({
          frequency: NOTE.EB3,
          delay: 0.11,
          duration: 0.16,
          volume: 0.14,
          type: "triangle",
        });
        break;
      case "runoff":
        tone({ frequency: NOTE.D4, duration: 0.12, volume: 0.13 });
        tone({ frequency: NOTE.EB4, delay: 0.11, duration: 0.12, volume: 0.13 });
        tone({ frequency: NOTE.D4, delay: 0.22, duration: 0.16, volume: 0.11 });
        break;
      case "elimination":
        noise({ duration: 0.28, volume: 0.15, frequency: 620 });
        tone({
          frequency: NOTE.D4,
          endFrequency: NOTE.A3,
          duration: 0.3,
          volume: 0.17,
          type: "sawtooth",
        });
        tone({
          frequency: NOTE.A3,
          endFrequency: NOTE.D3,
          delay: 0.22,
          duration: 0.42,
          volume: 0.15,
          type: "triangle",
        });
        break;
      case "win":
        [NOTE.D4, NOTE.F4, NOTE.A4, NOTE.D5].forEach((frequency, index) => {
          tone({
            frequency,
            delay: index * 0.11,
            duration: 0.24,
            volume: 0.14 - index * 0.01,
            type: index % 2 ? "square" : "triangle",
          });
        });
        break;
      case "lose":
        [NOTE.D4, NOTE.C4, NOTE.A3, NOTE.D3].forEach((frequency, index) => {
          tone({
            frequency,
            delay: index * 0.13,
            duration: 0.3,
            volume: 0.13 - index * 0.012,
            type: "triangle",
          });
        });
        break;
      default:
        return false;
    }
    return true;
  }

  function updateControl() {
    if (!control) return;
    if (!AudioContextType) {
      control.hidden = true;
      return;
    }
    control.hidden = false;
    control.setAttribute("aria-pressed", String(enabled));
    control.setAttribute(
      "aria-label",
      enabled ? translate("nav.sound_mute") : translate("nav.sound_enable"),
    );
    control.title = enabled
      ? translate("nav.sound_mute")
      : translate("nav.sound_enable");
    if (controlLabel) {
      controlLabel.textContent = enabled
        ? translate("nav.sound")
        : translate("nav.sound_off");
    }
  }

  function bindControl() {
    control = document.getElementById("sound-toggle");
    controlLabel = document.getElementById("sound-toggle-label");
    if (!control) return;
    updateControl();
    control.addEventListener("click", async () => {
      if (enabled) {
        enabled = false;
        persistPreference();
        updateControl();
        stopMusic(0);
        applyMix(0.1);
        return;
      }
      enabled = true;
      persistPreference();
      updateControl();
      if (
        scene === "silent"
        && document.body?.dataset?.screen === "join"
      ) {
        transitionScene("landing");
      }
      if (await unlock()) play("confirm");
    });
  }

  window.addEventListener("impostral:voice-start", () => {
    voiceDepth += 1;
    applyMix(0.035);
  });
  window.addEventListener("impostral:voice-end", () => {
    voiceDepth = Math.max(0, voiceDepth - 1);
    applyMix(0.42);
  });
  window.addEventListener("impostral:recording-start", () => {
    recordingDepth += 1;
    applyMix(0);
  });
  window.addEventListener("impostral:recording-end", () => {
    recordingDepth = Math.max(0, recordingDepth - 1);
    applyMix(0.2);
  });

  document.addEventListener("visibilitychange", () => {
    if (!context) return;
    if (document.hidden) {
      stopMusic(0);
      void context.suspend().catch(() => {});
      return;
    }
    void context.resume()
      .then(() => {
        applyMix(0.18);
        startMusic();
      })
      .catch(() => {});
  });

  window.addEventListener("pagehide", () => {
    stopMusic(0);
    if (context) void context.suspend().catch(() => {});
  });
  window.addEventListener("pageshow", () => {
    if (!context || !enabled) return;
    void context.resume()
      .then(() => {
        applyMix(0.18);
        startMusic();
      })
      .catch(() => {});
  });

  bindControl();
  window.addEventListener("impostral:language", updateControl);

  window.ImpostralSound = {
    unlock,
    startLandingFromGesture,
    beginEntry,
    playResult,
    play,
    setPhase,
    setGameActive,
    returnToLanding,
    isEnabled: () => enabled,
  };
})();
