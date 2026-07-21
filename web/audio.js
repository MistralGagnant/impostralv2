// Push-to-talk microphone capture and queued TTS playback.
// Exposed globally through window.ImpostralAudio.

(function () {
  let capture = null;
  let captureGeneration = 0;

  function emit(name, detail = {}) {
    if (typeof window.dispatchEvent !== "function" || typeof CustomEvent !== "function") return;
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function endCaptureSound(current) {
    if (!current?.soundActive) return;
    current.soundActive = false;
    emit("impostral:recording-end");
  }

  function releaseStream(stream) {
    if (!stream) return;
    for (const track of stream.getTracks()) {
      try { track.stop(); } catch { /* The track may already be stopped. */ }
    }
  }

  function toBase64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  // Invalidate pending permission requests and discard any active capture.
  function cancelRecording() {
    captureGeneration += 1;
    const current = capture;
    capture = null;
    if (!current) return;

    current.discarded = true;
    releaseStream(current.stream);
    endCaptureSound(current);
    if (current.recorder.state !== "inactive") {
      try { current.recorder.stop(); } catch { /* It may have stopped meanwhile. */ }
    }
    current.chunks.length = 0;
  }

  // Start recording. Returns true on success.
  async function startRecording() {
    cancelRecording();
    const generation = ++captureGeneration;
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generation !== captureGeneration) {
        releaseStream(stream);
        return false;
      }

      const recorder = new MediaRecorder(stream);
      const current = {
        stream,
        recorder,
        chunks: [],
        mimeType: recorder.mimeType || "",
        discarded: false,
        stopPromise: null,
        soundActive: false,
      };
      recorder.ondataavailable = (event) => {
        if (!current.discarded && event.data && event.data.size > 0) {
          current.chunks.push(event.data);
        }
      };
      capture = current;
      recorder.start();
      current.soundActive = true;
      emit("impostral:recording-start");
      return true;
    } catch (err) {
      releaseStream(stream);
      if (generation !== captureGeneration) return false;
      capture = null;
      console.warn("Microphone unavailable:", err);
      return false;
    }
  }

  // Stop, release the microphone, and preserve the browser's actual audio type.
  function stopRecording() {
    const current = capture;
    if (!current || current.recorder.state === "inactive") {
      if (current) {
        releaseStream(current.stream);
        endCaptureSound(current);
        capture = null;
      }
      return Promise.resolve(null);
    }
    if (current.stopPromise) return current.stopPromise;

    current.stopPromise = new Promise((resolve) => {
      let settled = false;
      const finish = async (failed = false) => {
        if (settled) return;
        settled = true;
        try {
          if (failed || current.discarded) {
            resolve(null);
            return;
          }
          const chunkType = current.chunks.find((chunk) => chunk.type)?.type || "";
          const audioMime = current.mimeType || chunkType;
          const blob = new Blob(current.chunks, audioMime ? { type: audioMime } : {});
          if (!blob.size) {
            resolve(null);
            return;
          }
          resolve({
            audio_b64: toBase64(await blob.arrayBuffer()),
            audio_mime: audioMime || null,
          });
        } catch (err) {
          console.warn("Could not finalize microphone recording:", err);
          resolve(null);
        } finally {
          current.discarded = true;
          releaseStream(current.stream);
          endCaptureSound(current);
          current.chunks.length = 0;
          if (capture === current) capture = null;
        }
      };

      current.recorder.addEventListener("stop", () => { void finish(); }, { once: true });
      current.recorder.addEventListener("error", () => { void finish(true); }, { once: true });
      try {
        current.recorder.stop();
      } catch {
        void finish(true);
      }
    });
    return current.stopPromise;
  }

  function isRecording() {
    return Boolean(capture && capture.recorder.state === "recording");
  }

  // --- Audio playback queue: TTS clips never overlap ---
  const SILENT_WAV_URL = "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";
  const PLAYBACK_STALL_MS = 20_000;
  const PLAYBACK_FAILSAFE_MS = 55_000;
  const queue = [];
  const playbackAudio = new Audio();
  playbackAudio.preload = "auto";
  playbackAudio.playsInline = true;
  let playing = false;
  let playbackRate = 1.1;
  let currentPlayback = null;
  let playbackUnlocked = false;
  let unlockPromise = null;

  function setPlaybackRate(rate) {
    const parsed = Number(rate);
    if (Number.isFinite(parsed)) playbackRate = Math.min(2, Math.max(0.5, parsed));
  }

  function enqueue(url, onComplete) {
    if (!url) {
      if (onComplete) onComplete();
      return;
    }
    queue.push({ url, onComplete });
    pump();
  }

  // WebKit grants autoplay permission per media element. Prime the same element
  // later used for every seat voice while the Enter click is still active.
  function unlockPlayback() {
    if (playbackUnlocked) return Promise.resolve(true);
    if (currentPlayback) {
      return currentPlayback.blocked ? retryPlayback() : Promise.resolve(true);
    }
    if (unlockPromise) return unlockPromise;

    playbackAudio.onended = null;
    playbackAudio.onerror = null;
    playbackAudio.onabort = null;
    playbackAudio.src = SILENT_WAV_URL;
    playbackAudio.playbackRate = 1;
    playbackAudio.volume = 1;
    let playResult;
    try {
      // Keep this direct play() call synchronous with the user's gesture.
      playResult = playbackAudio.play();
    } catch {
      return Promise.resolve(false);
    }
    unlockPromise = Promise.resolve(playResult)
      .then(() => {
        playbackUnlocked = true;
        try { playbackAudio.pause(); } catch { /* The silent clip may already be over. */ }
        return true;
      })
      .catch(() => false)
      .finally(() => { unlockPromise = null; });
    return unlockPromise;
  }

  function clearPlaybackTimers(playback) {
    if (playback.watchdog) clearTimeout(playback.watchdog);
    if (playback.failSafe) clearTimeout(playback.failSafe);
    playback.watchdog = null;
    playback.failSafe = null;
  }

  function blockPlayback(playback, reason) {
    if (playback.completed || playback.blocked) return;
    if (playback.watchdog) clearTimeout(playback.watchdog);
    playback.watchdog = null;
    playback.attempt = null;
    playback.blocked = true;
    if (playback.voiceStarted) {
      playback.voiceStarted = false;
      emit("impostral:voice-end");
    }
    try {
      playback.audio.pause();
      playback.audio.currentTime = 0;
    } catch { /* The element may not have loaded enough data to seek. */ }
    emit("impostral:voice-blocked", { reason });
  }

  function attemptPlayback(playback) {
    if (playback.completed) return Promise.resolve(false);
    if (playback.attempt) return playback.attempt;
    playback.blocked = false;
    let playResult;
    try {
      // This stays direct so retryPlayback() can be called from the fallback tap.
      playResult = playback.audio.play();
    } catch (error) {
      if (error?.name === "NotAllowedError") blockPlayback(playback, "autoplay");
      else playback.finish(true);
      return Promise.resolve(false);
    }
    const attempt = Promise.resolve(playResult)
      .then(() => {
        if (playback.completed) return false;
        playbackUnlocked = true;
        playback.voiceStarted = true;
        emit("impostral:voice-start");
        playback.watchdog = setTimeout(
          () => blockPlayback(playback, "stalled"),
          PLAYBACK_STALL_MS,
        );
        return true;
      })
      .catch((error) => {
        if (playback.completed) return false;
        if (error?.name === "NotAllowedError") {
          blockPlayback(playback, "autoplay");
        } else {
          playback.finish(true);
        }
        return false;
      })
      .finally(() => {
        if (playback.attempt === attempt) playback.attempt = null;
      });
    playback.attempt = attempt;
    return attempt;
  }

  function pump() {
    if (playing || queue.length === 0) return;
    playing = true;
    const { url, onComplete } = queue.shift();
    const audio = playbackAudio;
    try { audio.pause(); } catch { /* The previous clip may already have ended. */ }
    audio.src = url;
    audio.volume = 1;
    audio.playbackRate = playbackRate;
    const playback = {
      audio,
      attempt: null,
      blocked: false,
      completed: false,
      failSafe: null,
      voiceStarted: false,
      watchdog: null,
      finish: null,
    };
    currentPlayback = playback;
    const finish = (notify = true) => {
      if (playback.completed) return;
      playback.completed = true;
      audio.onended = null;
      audio.onerror = null;
      audio.onabort = null;
      clearPlaybackTimers(playback);
      if (currentPlayback === playback) currentPlayback = null;
      playing = false;
      if (playback.voiceStarted) {
        playback.voiceStarted = false;
        emit("impostral:voice-end");
      }
      try {
        if (notify && onComplete) onComplete();
      } catch (err) {
        console.warn("Audio completion callback failed:", err);
      } finally {
        pump();
      }
    };
    playback.finish = finish;
    audio.onended = audio.onerror = () => finish(true);
    audio.onabort = () => {
      // Assigning `src` above runs the media load algorithm, which fires
      // `abort` at the shared element for the resource being replaced. That
      // abort belongs to the previous clip, not this one, so it must never
      // raise the voice gate: the gate is for autoplay refusals only.
      // An abort once playback has started does mean this clip will not
      // finish, so move on to the next seat instead of stalling the reveal.
      if (playback.voiceStarted) finish(true);
    };
    playback.failSafe = setTimeout(() => {
      if (playback.completed) return;
      emit("impostral:voice-unavailable");
      finish(true);
    }, PLAYBACK_FAILSAFE_MS);
    void attemptPlayback(playback);
  }

  function retryPlayback() {
    const playback = currentPlayback;
    if (!playback) return unlockPlayback();
    if (!playback.blocked) return Promise.resolve(true);
    try { playback.audio.currentTime = 0; } catch { /* Seeking is optional. */ }
    return attemptPlayback(playback);
  }

  // Stop stale speech on disconnect without acknowledging it on a new socket.
  function cancelPlayback() {
    queue.length = 0;
    const playback = currentPlayback;
    if (!playback) {
      playing = false;
      return;
    }
    playback.audio.onended = null;
    playback.audio.onerror = null;
    playback.audio.onabort = null;
    try { playback.audio.pause(); } catch { /* Playback may already have ended. */ }
    try {
      playback.audio.removeAttribute("src");
      playback.audio.load();
    } catch { /* Some test and legacy media elements expose only pause(). */ }
    playback.finish(false);
  }

  function isPlaying() {
    return playing;
  }

  window.ImpostralAudio = {
    startRecording, stopRecording, cancelRecording, isRecording,
    enqueue, unlockPlayback, retryPlayback, cancelPlayback, isPlaying, setPlaybackRate,
  };
})();
