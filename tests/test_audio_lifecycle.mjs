import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const audioSource = await readFile(new URL("../web/audio.js", import.meta.url), "utf8");

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function makeStream() {
  const track = {
    stopCalls: 0,
    stop() { this.stopCalls += 1; },
  };
  return { stream: { getTracks: () => [track] }, track };
}

function loadAudio({
  getUserMedia,
  mimeType = "audio/webm;codecs=opus",
  events = null,
}) {
  class FakeMediaRecorder {
    constructor(stream) {
      this.stream = stream;
      this.mimeType = mimeType;
      this.state = "inactive";
      this.listeners = new Map();
    }

    addEventListener(type, callback) {
      const callbacks = this.listeners.get(type) || [];
      callbacks.push(callback);
      this.listeners.set(type, callbacks);
    }

    dispatch(type) {
      for (const callback of this.listeners.get(type) || []) callback({ type });
    }

    start() {
      this.state = "recording";
    }

    stop() {
      if (this.state === "inactive") throw new Error("already stopped");
      this.state = "inactive";
      queueMicrotask(() => {
        this.ondataavailable?.({
          data: new Blob(["voice"], { type: this.mimeType }),
        });
        this.dispatch("stop");
      });
    }
  }

  const context = {
    Audio: class {},
    Blob,
    CustomEvent: class {
      constructor(type) { this.type = type; }
    },
    MediaRecorder: FakeMediaRecorder,
    Uint8Array,
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
    console: { ...console, warn() {} },
    navigator: { mediaDevices: { getUserMedia } },
    queueMicrotask,
    window: events
      ? { dispatchEvent: (event) => events.push(event.type) }
      : {},
  };
  vm.runInNewContext(audioSource, context, { filename: "web/audio.js" });
  return context.window.ImpostralAudio;
}

function loadPlaybackAudio({ playOutcomes = [], timers = null } = {}) {
  const events = [];
  const instances = [];

  class FakeAudio {
    constructor(url) {
      this._src = url || "";
      this.sourceHistory = [];
      this.playbackRate = 1;
      this.pauseCalls = 0;
      this.loadCalls = 0;
      this.playCalls = 0;
      this.currentTime = 0;
      this.onended = null;
      this.onerror = null;
      this.onabort = null;
      instances.push(this);
    }

    get src() {
      return this._src;
    }

    set src(value) {
      this._src = value;
      this.sourceHistory.push(value);
    }

    play() {
      this.playCalls += 1;
      const outcome = playOutcomes.shift();
      if (outcome instanceof Error) return Promise.reject(outcome);
      return Promise.resolve();
    }

    pause() {
      this.pauseCalls += 1;
    }

    removeAttribute(name) {
      if (name === "src") this._src = "";
    }

    load() {
      this.loadCalls += 1;
    }
  }

  class FakeCustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options?.detail;
    }
  }

  const context = {
    Audio: FakeAudio,
    Blob,
    CustomEvent: FakeCustomEvent,
    MediaRecorder: class {},
    Uint8Array,
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
    console: { ...console, warn() {} },
    navigator: { mediaDevices: { getUserMedia: async () => null } },
    Promise,
    clearTimeout: timers?.clearTimeout || clearTimeout,
    setTimeout: timers?.setTimeout || setTimeout,
    window: {
      dispatchEvent: (event) => events.push(event.type),
    },
  };
  vm.runInNewContext(audioSource, context, { filename: "web/audio.js" });
  return { audio: context.window.ImpostralAudio, events, instances };
}

test("stopRecording returns the real MIME type and releases every track", async () => {
  const { stream, track } = makeStream();
  const audio = loadAudio({
    getUserMedia: async () => stream,
    mimeType: "audio/mp4;codecs=mp4a.40.2",
  });

  assert.equal(await audio.startRecording(), true);
  assert.equal(audio.isRecording(), true);
  const result = await audio.stopRecording();

  assert.equal(result.audio_mime, "audio/mp4;codecs=mp4a.40.2");
  assert.equal(result.audio_b64, Buffer.from("voice").toString("base64"));
  assert.equal(track.stopCalls, 1);
  assert.equal(audio.isRecording(), false);
});

test("cancelRecording discards an active capture and releases its track", async () => {
  const { stream, track } = makeStream();
  const audio = loadAudio({ getUserMedia: async () => stream });

  assert.equal(await audio.startRecording(), true);
  audio.cancelRecording();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(track.stopCalls, 1);
  assert.equal(audio.isRecording(), false);
  assert.equal(await audio.stopRecording(), null);
});

test("microphone lifecycle events are emitted exactly once per capture", async () => {
  const events = [];
  const first = makeStream();
  const second = makeStream();
  const streams = [first.stream, second.stream];
  const audio = loadAudio({
    getUserMedia: async () => streams.shift(),
    events,
  });

  assert.equal(await audio.startRecording(), true);
  await audio.stopRecording();
  assert.deepEqual(events, [
    "impostral:recording-start",
    "impostral:recording-end",
  ]);

  assert.equal(await audio.startRecording(), true);
  audio.cancelRecording();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, [
    "impostral:recording-start",
    "impostral:recording-end",
    "impostral:recording-start",
    "impostral:recording-end",
  ]);
});

test("a permission request resolved after cancellation never starts recording", async () => {
  const permission = deferred();
  const { stream, track } = makeStream();
  const audio = loadAudio({ getUserMedia: () => permission.promise });

  const starting = audio.startRecording();
  audio.cancelRecording();
  permission.resolve(stream);

  assert.equal(await starting, false);
  assert.equal(track.stopCalls, 1);
  assert.equal(audio.isRecording(), false);
});

test("queued TTS announces voice playback and survives a failing callback", async () => {
  const { audio, events, instances } = loadPlaybackAudio();
  const completed = [];

  audio.enqueue("/audio/one", () => {
    completed.push("one");
    throw new Error("consumer failed");
  });
  audio.enqueue("/audio/two", () => completed.push("two"));
  await Promise.resolve();

  assert.deepEqual(events, ["impostral:voice-start"]);
  assert.equal(instances.length, 1);
  instances[0].onended();
  await Promise.resolve();

  assert.deepEqual(events, [
    "impostral:voice-start",
    "impostral:voice-end",
    "impostral:voice-start",
  ]);
  assert.equal(instances.length, 1);
  assert.deepEqual(instances[0].sourceHistory, ["/audio/one", "/audio/two"]);
  instances[0].onended();
  await Promise.resolve();

  assert.deepEqual(events, [
    "impostral:voice-start",
    "impostral:voice-end",
    "impostral:voice-start",
    "impostral:voice-end",
  ]);
  assert.deepEqual(completed, ["one", "two"]);
});

test("cancelPlayback drops stale speech without invoking socket callbacks", async () => {
  const { audio, events, instances } = loadPlaybackAudio();
  const completed = [];

  audio.enqueue("/audio/old", () => completed.push("old"));
  audio.enqueue("/audio/queued", () => completed.push("queued"));
  await Promise.resolve();
  assert.equal(audio.isPlaying(), true);

  audio.cancelPlayback();
  assert.equal(audio.isPlaying(), false);
  assert.ok(instances[0].pauseCalls >= 1);
  assert.equal(instances[0].loadCalls, 1);
  assert.deepEqual(events, [
    "impostral:voice-start",
    "impostral:voice-end",
  ]);
  assert.deepEqual(completed, []);
  assert.equal(instances.length, 1);

  audio.enqueue("/audio/new", () => completed.push("new"));
  await Promise.resolve();
  assert.equal(instances.length, 1);
  instances[0].onended();
  assert.deepEqual(completed, ["new"]);
});

test("one primed media element is reused for every delayed TTS clip", async () => {
  const { audio, instances } = loadPlaybackAudio();

  assert.equal(await audio.unlockPlayback(), true);
  assert.equal(instances.length, 1);
  assert.match(instances[0].sourceHistory[0], /^data:audio\/wav;base64,/);

  audio.enqueue("/audio/later", () => {});
  await Promise.resolve();
  assert.equal(instances.length, 1);
  assert.equal(instances[0].sourceHistory.at(-1), "/audio/later");
  instances[0].onended();
});

test("autoplay rejection waits for a user retry instead of skipping speech", async () => {
  const notAllowed = new Error("gesture required");
  notAllowed.name = "NotAllowedError";
  const { audio, events, instances } = loadPlaybackAudio({
    playOutcomes: [notAllowed, "allowed"],
  });
  const completed = [];

  audio.enqueue("/audio/protected", () => completed.push("done"));
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(events, ["impostral:voice-blocked"]);
  assert.deepEqual(completed, []);
  assert.equal(audio.isPlaying(), true);

  assert.equal(await audio.retryPlayback(), true);
  assert.deepEqual(events, [
    "impostral:voice-blocked",
    "impostral:voice-start",
  ]);
  instances[0].onended();
  assert.deepEqual(completed, ["done"]);
});

test("a stalled clip restores the mix and waits for an explicit retry", async () => {
  const scheduled = new Map();
  let nextTimer = 1;
  const timers = {
    setTimeout(callback, delay) {
      const id = nextTimer;
      nextTimer += 1;
      scheduled.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) {
      scheduled.delete(id);
    },
  };
  const { audio, events, instances } = loadPlaybackAudio({ timers });
  const completed = [];

  audio.enqueue("/audio/stalled", () => completed.push("done"));
  await Promise.resolve();
  const watchdog = [...scheduled.values()].find((timer) => timer.delay === 20_000);
  assert.ok(watchdog);
  watchdog.callback();

  assert.deepEqual(events, [
    "impostral:voice-start",
    "impostral:voice-end",
    "impostral:voice-blocked",
  ]);
  assert.deepEqual(completed, []);
  assert.equal(audio.isPlaying(), true);

  assert.equal(await audio.retryPlayback(), true);
  instances[0].onended();
  assert.deepEqual(completed, ["done"]);
});
