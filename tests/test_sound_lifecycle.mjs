import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const soundSource = await readFile(new URL("../web/sound.js", import.meta.url), "utf8");
const appSource = await readFile(new URL("../web/app.js", import.meta.url), "utf8");

class EventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) || [];
    callbacks.push(callback);
    this.listeners.set(type, callbacks);
  }

  async dispatch(type) {
    for (const callback of this.listeners.get(type) || []) {
      await callback({ type, preventDefault() {} });
    }
  }
}

class FakeParam {
  constructor(value = 0) {
    this.value = value;
  }

  cancelScheduledValues() {}
  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
}

class FakeNode {
  connect() { return this; }
  disconnect() {}
}

class FakeGain extends FakeNode {
  constructor() {
    super();
    this.gain = new FakeParam(1);
  }
}

class FakeFilter extends FakeNode {
  constructor() {
    super();
    this.frequency = new FakeParam();
    this.Q = new FakeParam();
    this.type = "lowpass";
  }
}

class FakeCompressor extends FakeNode {
  constructor() {
    super();
    this.threshold = new FakeParam();
    this.knee = new FakeParam();
    this.ratio = new FakeParam();
    this.attack = new FakeParam();
    this.release = new FakeParam();
  }
}

class FakeSource extends FakeNode {
  constructor() {
    super();
    this.frequency = new FakeParam();
    this.buffer = null;
    this.type = "sine";
    this.onended = null;
    this.stopCalls = [];
  }

  start() {}
  stop(at) {
    this.stopCalls.push(at);
    queueMicrotask(() => this.onended?.());
  }
}

function loadSound({ supported = true, initialState = "suspended" } = {}) {
  const windowTarget = new EventTarget();
  const documentTarget = new EventTarget();
  const control = new EventTarget();
  control.attributes = new Map();
  control.hidden = false;
  control.title = "";
  control.setAttribute = (name, value) => control.attributes.set(name, value);
  const label = { textContent: "" };
  documentTarget.hidden = false;
  documentTarget.getElementById = (id) => {
    if (id === "sound-toggle") return control;
    if (id === "sound-toggle-label") return label;
    return null;
  };

  const contexts = [];
  class FakeAudioContext {
    constructor() {
      this.state = initialState;
      this.currentTime = 0;
      this.sampleRate = 48000;
      this.destination = new FakeNode();
      this.gains = [];
      this.filters = [];
      this.sources = [];
      contexts.push(this);
    }

    createGain() {
      const gain = new FakeGain();
      this.gains.push(gain);
      return gain;
    }

    createBiquadFilter() {
      const filter = new FakeFilter();
      this.filters.push(filter);
      return filter;
    }
    createDynamicsCompressor() { return new FakeCompressor(); }
    createOscillator() {
      const source = new FakeSource();
      this.sources.push(source);
      return source;
    }
    createBufferSource() {
      const source = new FakeSource();
      this.sources.push(source);
      return source;
    }
    createBuffer(_channels, length) {
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    }

    async resume() {
      this.state = "running";
    }

    async suspend() {
      this.state = "suspended";
    }
  }

  const storage = new Map();
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  const intervals = new Map();
  let nextInterval = 1;
  const context = {
    Date,
    Float32Array,
    Math,
    clearInterval: (id) => intervals.delete(id),
    console,
    document: documentTarget,
    localStorage,
    queueMicrotask,
    setInterval: (callback) => {
      const id = nextInterval;
      nextInterval += 1;
      intervals.set(id, callback);
      return id;
    },
    window: windowTarget,
  };
  windowTarget.AudioContext = supported ? FakeAudioContext : undefined;
  vm.runInNewContext(soundSource, context, { filename: "web/sound.js" });

  return {
    api: windowTarget.ImpostralSound,
    context: () => contexts[0],
    contextCount: () => contexts.length,
    control,
    documentTarget,
    intervals,
    label,
    storage,
    windowTarget,
    advance(seconds) {
      contexts[0].currentTime += seconds;
      for (const callback of [...intervals.values()]) callback();
    },
  };
}

test("soundtrack uses one lazy context and an idempotent scheduler", async () => {
  const sound = loadSound();

  assert.equal(sound.contextCount(), 0);
  assert.equal(sound.control.attributes.get("aria-pressed"), "true");
  assert.equal(sound.label.textContent, "Music + FX");
  assert.equal(await sound.api.unlock(), true);
  assert.equal(sound.contextCount(), 1);

  sound.api.setPhase("question");
  sound.api.setGameActive(true);
  assert.equal(sound.intervals.size, 1);
  sound.api.setGameActive(true);
  assert.equal(sound.intervals.size, 1);

  await sound.api.unlock();
  assert.equal(sound.contextCount(), 1);

  await sound.windowTarget.dispatch("pagehide");
  assert.equal(sound.context().state, "suspended");
  assert.equal(sound.intervals.size, 0);
  await sound.windowTarget.dispatch("pageshow");
  await Promise.resolve();
  assert.equal(sound.context().state, "running");
  assert.equal(sound.intervals.size, 1);

  sound.api.setGameActive(false);
  assert.equal(sound.intervals.size, 1);
});

test("landing ambience is gesture-started, lazy, quiet, and idempotent", async () => {
  const sound = loadSound();

  assert.equal(sound.contextCount(), 0);
  const start = sound.api.startLandingFromGesture();
  assert.equal(sound.contextCount(), 1);
  assert.equal(await start, true);
  assert.equal(sound.intervals.size, 1);
  assert.equal(sound.context().gains[1].gain.value, 0.07);
  assert.ok(sound.context().sources.length >= 6);

  const sources = sound.context().sources.length;
  assert.equal(await sound.api.startLandingFromGesture(), false);
  assert.equal(sound.contextCount(), 1);
  assert.equal(sound.intervals.size, 1);
  assert.equal(sound.context().sources.length, sources);
});

test("landing can be armed without creating audio before the next gesture", async () => {
  const sound = loadSound();

  assert.equal(sound.api.returnToLanding(), true);
  assert.equal(sound.contextCount(), 0);
  assert.equal(sound.intervals.size, 0);

  assert.equal(await sound.api.startLandingFromGesture(), true);
  assert.equal(sound.contextCount(), 1);
  assert.equal(sound.intervals.size, 1);
});

test("landing, entry, and retry share one transport and crossfade levels", async () => {
  const sound = loadSound();
  await sound.api.startLandingFromGesture();
  const schedulerId = [...sound.intervals.keys()][0];
  const landingSources = sound.context().sources.length;

  assert.equal(sound.api.beginEntry(), true);
  assert.equal([...sound.intervals.keys()][0], schedulerId);
  assert.equal(sound.context().sources.length, landingSources + 2);

  sound.advance(0.4);
  assert.equal([...sound.intervals.keys()][0], schedulerId);
  assert.equal(sound.context().gains[1].gain.value, 0.16);
  assert.ok(sound.context().sources.length > landingSources + 2);
  assert.equal(sound.api.beginEntry(), false);

  assert.equal(sound.api.returnToLanding(), true);
  sound.advance(0.4);
  assert.equal([...sound.intervals.keys()][0], schedulerId);
  assert.equal(sound.context().gains[1].gain.value, 0.07);
  assert.equal(sound.api.beginEntry(), true);
});

test("entry music is immersive, idempotent, phase-aware, and rearmable", async () => {
  const sound = loadSound();
  await sound.api.unlock();

  assert.equal(sound.api.beginEntry(), true);
  assert.equal(sound.intervals.size, 1);
  const initialSources = sound.context().sources.length;
  assert.ok(initialSources >= 8);

  assert.equal(sound.api.beginEntry(), false);
  assert.equal(sound.intervals.size, 1);
  assert.equal(sound.context().sources.length, initialSources);

  sound.api.setPhase("question");
  for (let index = 0; index < 9; index += 1) sound.advance(0.4);
  assert.equal(sound.context().filters[0].frequency.value, 1650);

  sound.api.setGameActive(false);
  sound.advance(0.4);
  assert.equal(sound.intervals.size, 1);
  assert.equal(sound.context().filters[0].frequency.value, 920);
  assert.equal(sound.api.beginEntry(), true);
  assert.equal(sound.intervals.size, 1);
  sound.api.setGameActive(false);
});

test("canceling an entry retires its live music generation before retry", async () => {
  const sound = loadSound();
  await sound.api.unlock();

  sound.api.beginEntry();
  const firstGeneration = [...sound.context().sources];
  sound.api.setGameActive(false);
  sound.advance(0.4);
  const retiredMusic = firstGeneration.filter((source) => source.stopCalls.length >= 2);
  assert.ok(retiredMusic.length >= 6);

  const sourceCount = sound.context().sources.length;
  assert.equal(sound.api.beginEntry(), true);
  assert.ok(sound.context().sources.length > sourceCount);
  assert.ok(retiredMusic.every((source) => source.stopCalls.length >= 2));
  sound.api.setGameActive(false);
});

test("finite result scores distinguish human, agent, and draw outcomes", async () => {
  const signatures = new Map();

  for (const outcome of ["human", "agent", "draw"]) {
    const sound = loadSound();
    await sound.api.unlock();

    assert.equal(sound.api.playResult(outcome), true);
    assert.equal(sound.intervals.size, 1);
    assert.equal(sound.context().gains[1].gain.value, 0.14);
    const initialSources = sound.context().sources.length;
    assert.ok(initialSources >= 5);

    const signature = sound.context().sources
      .map((source) => source.frequency.value)
      .filter(Boolean)
      .join(",");
    signatures.set(outcome, signature);

    assert.equal(sound.api.playResult(outcome), false);
    assert.equal(sound.context().sources.length, initialSources);
    assert.equal(sound.intervals.size, 1);

    for (let index = 0; index < 60; index += 1) sound.advance(0.4);
    assert.equal(sound.intervals.size, 0);
    assert.equal(sound.api.playResult(outcome), false);
  }

  assert.notEqual(signatures.get("human"), signatures.get("agent"));
  assert.notEqual(signatures.get("human"), signatures.get("draw"));
  assert.notEqual(signatures.get("agent"), signatures.get("draw"));
});

test("result score keeps the shared context and transport and ignores late phase resets", async () => {
  const sound = loadSound();
  await sound.api.unlock();
  sound.api.setGameActive(true);
  const context = sound.context();
  const schedulerId = [...sound.intervals.keys()][0];

  assert.equal(sound.api.playResult("agents"), true);
  assert.equal(sound.context(), context);
  assert.equal([...sound.intervals.keys()][0], schedulerId);

  sound.api.setPhase("game_over");
  sound.api.setGameActive(true);
  assert.equal(sound.context(), context);
  assert.equal([...sound.intervals.keys()][0], schedulerId);
  assert.equal(sound.api.playResult("human"), false);
});

test("result score ducks under narration and pauses for capture", async () => {
  const sound = loadSound();
  await sound.api.unlock();
  sound.api.playResult("human");
  const musicGain = sound.context().gains[1].gain;

  assert.equal(musicGain.value, 0.14);
  await sound.windowTarget.dispatch("impostral:voice-start");
  assert.equal(musicGain.value, 0.018);
  await sound.windowTarget.dispatch("impostral:recording-start");
  assert.equal(musicGain.value, 0.0001);
  await sound.windowTarget.dispatch("impostral:recording-end");
  assert.equal(musicGain.value, 0.018);
  await sound.windowTarget.dispatch("impostral:voice-end");
  assert.equal(musicGain.value, 0.14);
});

test("muted or hidden result scores resume safely and never replay after completion", async () => {
  const sound = loadSound();
  await sound.api.unlock();
  await sound.control.dispatch("click");
  assert.equal(sound.api.isEnabled(), false);

  assert.equal(sound.api.playResult("neutral"), true);
  assert.equal(sound.intervals.size, 0);
  await sound.control.dispatch("click");
  assert.equal(sound.api.isEnabled(), true);
  assert.equal(sound.intervals.size, 1);

  sound.documentTarget.hidden = true;
  await sound.documentTarget.dispatch("visibilitychange");
  assert.equal(sound.context().state, "suspended");
  assert.equal(sound.intervals.size, 0);
  sound.documentTarget.hidden = false;
  await sound.documentTarget.dispatch("visibilitychange");
  await Promise.resolve();
  assert.equal(sound.context().state, "running");
  assert.equal(sound.intervals.size, 1);

  for (let index = 0; index < 60; index += 1) sound.advance(0.4);
  assert.equal(sound.intervals.size, 0);
  await sound.windowTarget.dispatch("pagehide");
  await sound.windowTarget.dispatch("pageshow");
  await Promise.resolve();
  assert.equal(sound.intervals.size, 0);
});

test("admission uses one shared generation and never waits for optional sound", () => {
  assert.match(appSource, /let admissionGeneration = 0;/);
  assert.match(appSource, /let admissionInFlight = false;/);
  assert.match(appSource, /function beginAdmission\(sourceButton\)/);
  assert.match(appSource, /void unlockSound\("entry"/);
  assert.doesNotMatch(appSource, /await unlockSound\("entry"/);
  assert.match(appSource, /function entrySoundIsRelevant\(generation\)/);
  assert.match(appSource, /if \(!invalidateAdmission\(admission\)\) return;/);
  assert.match(appSource, /connect\(match, \{ admissionToken: admission \}\)/);
  assert.match(appSource, /&& !completeAdmission\(admissionToken\)/);
});

test("voice ducking and microphone capture protect gameplay audio", async () => {
  const sound = loadSound();
  await sound.api.unlock();
  sound.api.setGameActive(true);
  const audioContext = sound.context();
  const musicGain = audioContext.gains[1].gain;
  const sfxGain = audioContext.gains[2].gain;

  assert.equal(musicGain.value, 0.12);
  await sound.windowTarget.dispatch("impostral:voice-start");
  assert.equal(musicGain.value, 0.018);
  assert.equal(sfxGain.value, 0.15);

  await sound.windowTarget.dispatch("impostral:recording-start");
  assert.equal(musicGain.value, 0.0001);
  assert.equal(sfxGain.value, 0.0001);
  await sound.windowTarget.dispatch("impostral:voice-end");
  assert.equal(musicGain.value, 0.0001);
  assert.equal(sfxGain.value, 0.0001);
  await sound.windowTarget.dispatch("impostral:recording-end");
  assert.equal(musicGain.value, 0.12);
  assert.equal(sfxGain.value, 0.32);

  await sound.windowTarget.dispatch("impostral:voice-start");
  await sound.windowTarget.dispatch("impostral:recording-start");
  assert.equal(musicGain.value, 0.0001);
  assert.equal(sfxGain.value, 0.0001);
  await sound.windowTarget.dispatch("impostral:recording-end");
  assert.equal(musicGain.value, 0.018);
  assert.equal(sfxGain.value, 0.15);
  await sound.windowTarget.dispatch("impostral:voice-end");
  assert.equal(musicGain.value, 0.12);
  assert.equal(sfxGain.value, 0.32);

  sound.api.setGameActive(false);
});

test("the accessible control persists mute without affecting TTS", async () => {
  const sound = loadSound();
  await sound.api.unlock();
  sound.api.setGameActive(true);

  await sound.control.dispatch("click");
  assert.equal(sound.api.isEnabled(), false);
  assert.equal(sound.storage.get("impostral.soundEnabled"), "false");
  assert.equal(sound.control.attributes.get("aria-pressed"), "false");
  assert.equal(sound.label.textContent, "Music + FX off");
  assert.equal(sound.intervals.size, 0);

  await sound.control.dispatch("click");
  assert.equal(sound.api.isEnabled(), true);
  assert.equal(sound.storage.get("impostral.soundEnabled"), "true");
  assert.equal(sound.control.attributes.get("aria-pressed"), "true");
  assert.equal(sound.intervals.size, 1);
  sound.api.setGameActive(false);
});

test("unsupported Web Audio hides the optional control", async () => {
  const sound = loadSound({ supported: false });

  assert.equal(sound.control.hidden, true);
  assert.equal(await sound.api.unlock(), false);
  assert.equal(sound.contextCount(), 0);
});

test("unlock resumes WebKit interrupted contexts", async () => {
  const sound = loadSound({ initialState: "interrupted" });

  assert.equal(await sound.api.unlock(), true);
  assert.equal(sound.context().state, "running");
});
