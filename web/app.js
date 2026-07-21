// Impostral game client: WebSocket, state rendering, and contextual inputs.
(function () {
  const A = window.ImpostralAudio;
  const S = window.ImpostralSound;
  const I = window.ImpostralI18n;
  const t = (key, values) => I?.t(key, values) || key;
  const displaySeat = (seatId) => I?.seat(seatId) || seatId;
  const displayText = (text) => String(text || "").replace(
    /\bPlayer ([A-Z])\b/g,
    (match) => displaySeat(match),
  );
  let language = I?.language || "en";

  let ws = null;
  let you = null;
  let seats = [];
  let currentQuestion = "";
  let currentQuestionAct = "";
  let currentRound = 0;
  let maxRounds = 5;
  let humanWaitSeconds = 15;
  let answerInputSeconds = 25;
  let mockMode = false;
  let isLobbyHost = false;
  let gameFinished = false;
  let currentMatch = null;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let connectionSerial = 0;
  let admissionGeneration = 0;
  let admissionInFlight = false;
  const TURNSTILE_TOKEN_MAX_AGE_MS = 4 * 60 * 1000;
  let turnstileScriptPromise = null;
  let turnstileTokenPromise = null;
  let cachedTurnstileToken = "";
  let cachedTurnstileTokenAt = 0;
  let turnstileWidgetId = null;
  const latestUtterances = new Map();
  // Latest ballot: seat id -> votes received, shown as badges on the arena.
  let voteTally = {};
  let voteEliminated = null;
  let activeAnswerTurn = null;
  let activeAnswerRequestId = "";
  let arena3d = null;
  let lastPhaseSoundKey = "";
  let lastTurnSoundKey = "";
  let lastEliminationSoundKey = "";
  let lastRunoffSoundKey = "";

  async function unlockSound(cue = "", stillRelevant = () => true) {
    try {
      void A.unlockPlayback?.();
      if (!S) return false;
      const ready = await S.unlock();
      if (!ready || !stillRelevant()) return false;
      if (cue === "entry") S.beginEntry?.();
      else if (cue) S.play(cue);
      return true;
    } catch {
      // Sound is optional and must never prevent admission.
      return false;
    }
  }

  function resetSoundCues() {
    lastPhaseSoundKey = "";
    lastTurnSoundKey = "";
    lastEliminationSoundKey = "";
    lastRunoffSoundKey = "";
  }

  function randomId() {
    return globalThis.crypto?.randomUUID?.() ||
      `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  }

  function persistentId(storage, key) {
    try {
      let value = storage.getItem(key);
      if (!value) {
        value = randomId();
        storage.setItem(key, value);
      }
      return value;
    } catch {
      return randomId();
    }
  }

  // Anonymous technical identifiers only: no account or personal profile.
  const playerId = persistentId(localStorage, "impostral.playerId");
  const sessionId = persistentId(sessionStorage, "impostral.sessionId");

  // --- DOM elements ---
  const $ = (id) => document.getElementById(id);
  const joinScreen = $("join-screen");
  const gameScreen = $("game-screen");
  const seatsEl = $("seats");
  const transcriptEl = $("transcript");
  const phaseName = $("phase-name");
  const phaseTimer = $("phase-timer");
  const phasePrompt = $("phase-prompt");
  const turnStatus = $("turn-status");
  const inputPanel = $("input-panel");
  const inputControls = $("input-controls");
  const inputTimer = $("input-timer");
  const playBtn = $("play-btn");
  const joinBtn = $("join-btn");
  const joinHint = $("join-hint");
  const turnstileContainer = $("turnstile-container");
  const humansField = $("humans-field");
  const humansInput = $("humans-input");
  const modeCreate = $("mode-create");
  const modeJoin = $("mode-join");
  const votePanel = $("vote-panel");
  const voteOptions = $("vote-options");
  const submitVote = $("submit-vote");
  const voiceGate = $("voice-gate");
  const voiceGateCopy = $("voice-gate-copy");
  const voiceUnlockBtn = $("voice-unlock-btn");
  const languageButtons = [...document.querySelectorAll("[data-game-language]")];
  const resultOverlay = $("result-overlay");
  const resultOutcome = $("result-outcome");
  const resultTitle = $("result-title");
  const resultSummary = $("result-summary");
  const resultReason = $("result-reason");
  const resultYourRole = $("result-your-role");
  const resultRoster = $("result-roster");
  const resultReplay = $("result-replay");
  const resultMenu = $("result-menu");

  let phaseCountdown = null;
  let inputCountdown = null;
  let activeInputCleanup = null;

  function syncLanguagePicker() {
    for (const button of languageButtons) {
      const selected = button.dataset.gameLanguage === language;
      button.setAttribute("aria-checked", String(selected));
    }
  }

  function setLanguageControlsDisabled(disabled) {
    for (const button of languageButtons) button.disabled = Boolean(disabled);
  }

  function adoptLanguage(next, { persist = false } = {}) {
    language = I?.setLanguage(next, { persist }) || language;
    syncLanguagePicker();
    if (currentMatch && currentMatch.language !== language) {
      saveCurrentMatch({ ...currentMatch, language });
    }
    return language;
  }

  async function startLandingAmbience(event) {
    if (!S?.startLandingFromGesture || document.body.dataset.screen !== "join") return;
    if (!event.isTrusted) return;
    if (event.type === "keydown") {
      if (
        ["Tab", "Escape", "Meta", "Control", "Alt", "Shift"].includes(event.key)
        || event.metaKey
        || event.ctrlKey
        || event.altKey
      ) return;
      if (
        event.key === "Enter"
        && ["name-input", "room-input"].includes(event.target?.id)
      ) return;
    }
    if (event.target?.closest?.(
      "#sound-toggle, #play-btn, #join-btn, a",
    )) return;
    await S.startLandingFromGesture();
  }

  document.addEventListener("pointerdown", startLandingAmbience, { passive: true });
  document.addEventListener("keydown", startLandingAmbience);

  function hideVoiceGate() {
    voiceGate.classList.add("hidden");
    voiceUnlockBtn.disabled = false;
    voiceUnlockBtn.textContent = t("voice.enable");
  }

  window.addEventListener("impostral:voice-blocked", () => {
    voiceGateCopy.textContent = t("voice.paused");
    voiceUnlockBtn.disabled = false;
    voiceUnlockBtn.textContent = t("voice.enable");
    voiceGate.classList.remove("hidden");
  });
  window.addEventListener("impostral:voice-start", hideVoiceGate);
  window.addEventListener("impostral:voice-unavailable", () => {
    hideVoiceGate();
    if (!gameScreen.classList.contains("hidden")) {
      addLog(t("voice.unavailable"));
    }
  });
  voiceUnlockBtn.addEventListener("click", async () => {
    voiceUnlockBtn.disabled = true;
    voiceUnlockBtn.textContent = t("voice.starting");
    const [voiceReady] = await Promise.all([
      A.retryPlayback?.() || Promise.resolve(false),
      S?.unlock?.() || Promise.resolve(false),
    ]);
    if (!voiceReady) {
      voiceGateCopy.textContent = t("voice.retry_copy");
      voiceUnlockBtn.disabled = false;
      voiceUnlockBtn.textContent = t("voice.retry");
    }
  });

  if (window.ImpostralArena3DReady?.then) {
    window.ImpostralArena3DReady.then((instance) => {
      arena3d = instance;
      if (!arena3d) return;
      arena3d.setActive(!gameScreen.classList.contains("hidden"));
      syncArena();
    });
  }

  // A full page reload always starts fresh on the home screen.
  try { sessionStorage.removeItem("impostral.activeMatch"); } catch {}

  function saveCurrentMatch(match) {
    currentMatch = match;
    try {
      if (match) sessionStorage.setItem("impostral.activeMatch", JSON.stringify(match));
      else sessionStorage.removeItem("impostral.activeMatch");
    } catch { /* Storage may be unavailable in private browsing modes. */ }
  }

  const configReady = fetch("/config")
    .then((response) => response.ok ? response.json() : null)
    .then((config) => {
      if (config?.max_rounds) maxRounds = config.max_rounds;
      if (config?.tts_playback_rate) A.setPlaybackRate(config.tts_playback_rate);
      if (typeof config?.human_wait_seconds === "number") {
        humanWaitSeconds = config.human_wait_seconds;
      }
      if (typeof config?.answer_input_seconds === "number") {
        answerInputSeconds = config.answer_input_seconds;
      }
      mockMode = Boolean(config?.mock_mode);
      $("round-total").textContent = maxRounds;
      if (config) {
        humansInput.min = config.min_humans ?? 1;
        humansInput.max = config.max_humans ?? 8;
        humansInput.value = config.num_humans ?? 3;
      }
      return config;
    })
    .catch(() => null);

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (turnstileScriptPromise) return turnstileScriptPromise;

    turnstileScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const timeout = setTimeout(() => reject(new Error("security_check_unavailable")), 12000);
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        clearTimeout(timeout);
        if (window.turnstile) resolve(window.turnstile);
        else reject(new Error("security_check_unavailable"));
      };
      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("security_check_unavailable"));
      };
      document.head.appendChild(script);
    }).catch((error) => {
      turnstileScriptPromise = null;
      throw error;
    });
    return turnstileScriptPromise;
  }

  function removeTurnstileWidget() {
    if (turnstileWidgetId !== null && window.turnstile) {
      try { window.turnstile.remove(turnstileWidgetId); } catch { /* Already removed. */ }
    }
    turnstileWidgetId = null;
    turnstileContainer.replaceChildren();
  }

  function hasFreshTurnstileToken() {
    return Boolean(cachedTurnstileToken) &&
      Date.now() - cachedTurnstileTokenAt < TURNSTILE_TOKEN_MAX_AGE_MS;
  }

  function clearCachedTurnstileToken() {
    cachedTurnstileToken = "";
    cachedTurnstileTokenAt = 0;
  }

  function consumeCachedTurnstileToken() {
    if (!hasFreshTurnstileToken()) {
      clearCachedTurnstileToken();
      return "";
    }
    const token = cachedTurnstileToken;
    clearCachedTurnstileToken();
    return token;
  }

  async function generateTurnstileToken(config) {
    const turnstile = await loadTurnstile();
    removeTurnstileWidget();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        callback(value);
        setTimeout(removeTurnstileWidget, 0);
      };
      const fail = () => finish(reject, new Error("security_check_failed"));

      turnstileWidgetId = turnstile.render(turnstileContainer, {
        sitekey: config.turnstile_site_key,
        action: "enter_game",
        appearance: "interaction-only",
        execution: "execute",
        theme: "auto",
        language,
        retry: "auto",
        "refresh-expired": "auto",
        callback: (token) => finish(resolve, token),
        "error-callback": () => { fail(); return true; },
        "expired-callback": fail,
        "timeout-callback": fail,
        "unsupported-callback": fail,
      });
      turnstile.execute(turnstileWidgetId);
    });
  }

  function primeTurnstileToken() {
    if (hasFreshTurnstileToken()) return Promise.resolve(cachedTurnstileToken);
    if (turnstileTokenPromise) return turnstileTokenPromise;

    clearCachedTurnstileToken();
    turnstileTokenPromise = configReady
      .then(async (config) => {
        if (!config) throw new Error("security_check_unavailable");
        if (!config.turnstile_enabled) return "";
        if (!config.turnstile_site_key) throw new Error("security_check_unavailable");
        const token = await generateTurnstileToken(config);
        cachedTurnstileToken = token;
        cachedTurnstileTokenAt = Date.now();
        return token;
      })
      .finally(() => { turnstileTokenPromise = null; });
    return turnstileTokenPromise;
  }

  async function requestTurnstileToken() {
    const config = await configReady;
    if (!config) throw new Error("security_check_unavailable");
    if (!config.turnstile_enabled) return "";
    if (!config.turnstile_site_key) throw new Error("security_check_unavailable");

    let token = consumeCachedTurnstileToken();
    if (token) return token;
    await primeTurnstileToken();
    token = consumeCachedTurnstileToken();
    if (!token) throw new Error("security_check_failed");
    return token;
  }

  // Start the challenge while the visitor is reading the landing page. A failure
  // remains silent here: clicking an entry button retries it and shows the error.
  void primeTurnstileToken().catch(() => {});

  function entryErrorMessage(code, fallback) {
    if (code === "security_check_failed") {
      return t("entry.security_failed");
    }
    if (code === "security_check_unavailable") {
      return t("entry.security_unavailable");
    }
    if (code === "exists") return t("entry.exists");
    if (code === "missing") return t("entry.missing");
    if (code === "full") return t("entry.full");
    if (code === "started") return t("entry.started");
    return fallback;
  }

  // ------------------------------------------------------------------
  // Lobby mode: create a new lobby or join an existing one by name.
  // ------------------------------------------------------------------
  const roomInput = $("room-input");

  // Le code de salon se dicte à l'oral entre amis : 5 lettres majuscules, sans
  // chiffres ni casse mixte, tirées une fois pour toute la visite.
  function randomLobbyCode() {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 5; i += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
  }
  const generatedLobbyCode = randomLobbyCode();
  roomInput.value = generatedLobbyCode;

  // En mode « rejoindre », le code ne peut venir que de l'hôte : champ vide,
  // encadré en rouge, et bouton d'entrée verrouillé tant qu'il l'est.
  function syncRoomField() {
    const joining = mode === "join";
    const missing = joining && !roomInput.value.trim();
    roomInput.placeholder = joining ? t("landing.lobby_code_ask") : "";
    roomInput.classList.toggle("field-missing", missing);
    roomInput.setAttribute("aria-invalid", String(missing));
    if (!admissionInFlight) joinBtn.disabled = missing;
  }

  let mode = "create";
  function setMode(next) {
    const changed = mode !== next;
    mode = next;
    const creating = mode === "create";
    if (changed) {
      if (creating) {
        if (!roomInput.value.trim()) roomInput.value = generatedLobbyCode;
      } else if (roomInput.value.trim() === generatedLobbyCode) {
        roomInput.value = "";
      }
    }
    modeCreate.setAttribute("aria-selected", String(creating));
    modeJoin.setAttribute("aria-selected", String(!creating));
    humansField.classList.toggle("hidden", !creating);
    joinBtn.querySelector("span").textContent = creating
      ? t("landing.create_enter")
      : t("landing.join");
    joinHint.textContent = "";
    syncRoomField();
  }
  roomInput.addEventListener("input", syncRoomField);
  modeCreate.addEventListener("click", () => setMode("create"));
  modeJoin.addEventListener("click", () => setMode("join"));
  setMode(mode);
  for (const button of languageButtons) {
    button.addEventListener("click", () => {
      if (admissionInFlight) return;
      adoptLanguage(button.dataset.gameLanguage, { persist: true });
      setMode(mode);
      joinHint.textContent = "";
      S?.play?.("select");
    });
  }
  window.addEventListener("impostral:language", () => {
    language = I?.language || language;
    syncLanguagePicker();
    setMode(mode);
  });
  syncLanguagePicker();

  // ------------------------------------------------------------------
  // Salon privé : le panneau s'ouvre en superposition au-dessus de la copie
  // (cf. style.css), il doit donc se refermer comme tout calque — Échap ou
  // clic à l'extérieur — sinon il masque le bouton d'entrée en partie.
  // ------------------------------------------------------------------
  const advancedOptions = $("advanced-options");
  if (advancedOptions) {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !advancedOptions.open) return;
      advancedOptions.open = false;
      advancedOptions.querySelector("summary")?.focus();
    });
    const overlayMode = window.matchMedia("(min-width: 981px)");
    document.addEventListener("pointerdown", (event) => {
      // Sous 981 px le panneau reste dans le flux : le refermer sur un appui
      // extérieur casserait le défilement tactile pendant la saisie.
      if (!advancedOptions.open || !overlayMode.matches) return;
      if (!advancedOptions.contains(event.target)) advancedOptions.open = false;
    });
  }

  // ------------------------------------------------------------------
  // Connection
  // ------------------------------------------------------------------
  playBtn.addEventListener("click", play);
  joinBtn.addEventListener("click", enterRoom);
  $("name-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter") play();
  });
  $("room-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter") enterRoom();
  });

  function connectionActive() {
    return ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING);
  }

  function beginAdmission(sourceButton) {
    if (admissionInFlight || connectionActive() || sourceButton.disabled) return 0;
    admissionInFlight = true;
    admissionGeneration += 1;
    playBtn.disabled = true;
    joinBtn.disabled = true;
    setLanguageControlsDisabled(true);
    return admissionGeneration;
  }

  function isCurrentAdmission(generation) {
    return generation === admissionGeneration;
  }

  function completeAdmission(generation = admissionGeneration) {
    if (!isCurrentAdmission(generation)) return false;
    admissionInFlight = false;
    return true;
  }

  function invalidateAdmission(generation = admissionGeneration) {
    if (!isCurrentAdmission(generation)) return false;
    admissionGeneration += 1;
    admissionInFlight = false;
    return true;
  }

  function restoreEntryButtons() {
    playBtn.disabled = false;
    playBtn.querySelector("span").textContent = t("landing.enter");
    joinBtn.disabled = false;
    setLanguageControlsDisabled(false);
    joinBtn.querySelector("span").textContent = mode === "create"
      ? t("landing.create_enter")
      : t("landing.join");
    syncRoomField();
  }

  function entrySoundIsRelevant(generation) {
    const livePhase = document.body.dataset.phase;
    return isCurrentAdmission(generation) && (!livePhase || livePhase === "lobby");
  }

  async function play() {
    const admission = beginAdmission(playBtn);
    if (!admission) return;
    void unlockSound("entry", () => entrySoundIsRelevant(admission));
    resetSoundCues();
    gameFinished = false;
    const securityCheckReady = hasFreshTurnstileToken();
    playBtn.disabled = true;
    playBtn.querySelector("span").textContent = securityCheckReady
      ? t("entry.finding")
      : t("entry.checking");
    joinHint.textContent = securityCheckReady
      ? t("entry.looking")
      : t("entry.finishing_check");
    try {
      const turnstileToken = await requestTurnstileToken();
      if (!isCurrentAdmission(admission)) return;
      playBtn.querySelector("span").textContent = t("entry.finding");
      joinHint.textContent = t("entry.looking");
      const response = await fetch("/matchmaking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_id: playerId,
          session_id: sessionId,
          name: ($("name-input").value || "").trim(),
          turnstile_token: turnstileToken,
          language,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!isCurrentAdmission(admission)) return;
      if (!response.ok) throw new Error(body.error || "matchmaking_failed");
      const match = {
        room: body.room_id,
        reservationToken: body.reservation_token,
        quick: true,
        name: ($("name-input").value || "").trim(),
        language: body.language || language,
      };
      saveCurrentMatch(match);
      connect(match, { admissionToken: admission });
    } catch (error) {
      if (!invalidateAdmission(admission)) return;
      S?.returnToLanding?.();
      restoreEntryButtons();
      joinHint.textContent = entryErrorMessage(
        error.message,
        t("entry.find_failed"),
      );
      void primeTurnstileToken().catch(() => {});
    }
  }

  async function enterRoom() {
    const room = (roomInput.value || "").trim();
    if (!room) { joinHint.textContent = t("entry.room_required"); return; }

    const admission = beginAdmission(joinBtn);
    if (!admission) return;
    void unlockSound("entry", () => entrySoundIsRelevant(admission));
    resetSoundCues();
    gameFinished = false;
    const creating = mode === "create";
    const securityCheckReady = hasFreshTurnstileToken();
    joinBtn.disabled = true;
    joinBtn.querySelector("span").textContent = securityCheckReady
      ? (creating ? t("entry.creating") : t("entry.joining"))
      : t("entry.checking");
    joinHint.textContent = securityCheckReady
      ? (
        creating
          ? t("entry.creating_room", { room })
          : t("entry.joining_room", { room })
      )
      : t("entry.finishing_check");
    try {
      const turnstileToken = await requestTurnstileToken();
      if (!isCurrentAdmission(admission)) return;
      joinHint.textContent = creating
        ? t("entry.creating_room", { room })
        : t("entry.joining_room", { room });
      const url = creating ? "/lobby" : `/lobby/${encodeURIComponent(room)}/join`;
      const payload = {
        player_id: playerId,
        session_id: sessionId,
        turnstile_token: turnstileToken,
        language,
      };
      if (creating) {
        payload.name = room;
        payload.num_humans = parseInt(humansInput.value, 10) || undefined;
      }
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!isCurrentAdmission(admission)) return;
      if (!response.ok) {
        if (body.error === "bad_humans") {
          throw new Error(`bad_humans:${body.min}:${body.max}`);
        }
        throw new Error(body.error || "lobby_failed");
      }

      const match = {
        room: body.name || room,
        reservationToken: body.reservation_token,
        quick: false,
        name: ($("name-input").value || "").trim(),
        language: body.language || language,
      };
      saveCurrentMatch(match);
      connect(match, { admissionToken: admission });
    } catch (error) {
      if (!invalidateAdmission(admission)) return;
      S?.returnToLanding?.();
      restoreEntryButtons();
      if (error.message.startsWith("bad_humans:")) {
        const [, min, max] = error.message.split(":");
        joinHint.textContent = t("entry.bad_humans", { min, max });
      } else if (error.message === "exists") {
        joinHint.textContent = t("entry.exists_named", { room });
      } else {
        joinHint.textContent = entryErrorMessage(
          error.message,
          t("entry.lobby_failed"),
        );
      }
      void primeTurnstileToken().catch(() => {});
    }
  }

  function connect(match, { reconnecting = false, admissionToken = 0 } = {}) {
    if (connectionActive()) return;
    adoptLanguage(match.language || language);
    const serial = ++connectionSerial;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    playBtn.disabled = true;
    joinBtn.disabled = true;
    joinBtn.querySelector("span").textContent = t("connection.connecting");
    playBtn.querySelector("span").textContent = reconnecting
      ? t("connection.reconnecting")
      : t("connection.connecting");
    joinHint.textContent = reconnecting
      ? t("connection.reconnecting_game")
      : t("connection.opening", { room: match.room });
    ws = new WebSocket(`${proto}://${location.host}/ws/${encodeURIComponent(match.room)}`);

    ws.onopen = () => {
      reconnectAttempts = 0;
      ws.send(JSON.stringify({
        type: "join",
        name: match.name || "",
        player_id: playerId,
        session_id: sessionId,
        reservation_token: match.reservationToken || "",
        reconnect_token: match.reconnectToken || "",
        language: match.language || language,
      }));
    };
    ws.onmessage = (event) => {
      if (serial !== connectionSerial) return;
      const message = JSON.parse(event.data);
      if (
        message.type === "room_state"
        && admissionToken
        && !completeAdmission(admissionToken)
      ) {
        return;
      }
      handle(message);
    };
    ws.onclose = () => {
      if (serial !== connectionSerial) return;
      A.cancelPlayback?.();
      hideVoiceGate();
      hideInput();
      restoreEntryButtons();
      if (!gameFinished && currentMatch && joinScreen.classList.contains("hidden")) {
        scheduleReconnect();
        return;
      }
      if (!joinScreen.classList.contains("hidden")) {
        invalidateAdmission();
        S?.returnToLanding?.();
        resetSoundCues();
      }
      if (!joinScreen.classList.contains("hidden") && !joinHint.textContent) {
        joinHint.textContent = t("connection.closed");
      }
    };
    ws.onerror = () => {
      if (joinScreen.classList.contains("hidden")) addLog(t("connection.interrupted"));
      else joinHint.textContent = t("connection.unresponsive");
    };
  }

  function scheduleReconnect() {
    if (reconnectTimer || !currentMatch || gameFinished) return;
    if (reconnectAttempts >= 8) {
      returnToJoin(t("connection.restarted"));
      return;
    }
    const delay = Math.min(5000, 750 * (2 ** reconnectAttempts));
    reconnectAttempts += 1;
    addLog(t("connection.lost", { attempt: reconnectAttempts }));
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect(currentMatch, { reconnecting: true });
    }, delay);
  }

  function closeCurrentSocket() {
    const activeSocket = ws;
    ws = null;
    connectionSerial += 1;
    if (
      activeSocket
      && (
        activeSocket.readyState === WebSocket.OPEN
        || activeSocket.readyState === WebSocket.CONNECTING
      )
    ) {
      try { activeSocket.close(1000, "leaving"); } catch { /* Already closing. */ }
    }
  }

  function hideResult() {
    resultOverlay.classList.add("hidden");
    resultOverlay.dataset.outcome = "";
    resultRoster.replaceChildren();
  }

  function returnToJoin(message) {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    invalidateAdmission();
    closeCurrentSocket();
    A.cancelPlayback?.();
    hideVoiceGate();
    hideInput();
    hideVote();
    hideResult();
    saveCurrentMatch(null);
    you = null;
    isLobbyHost = false;
    gameFinished = false;
    seats = [];
    cancelTyping();
    latestUtterances.clear();
    voteTally = {};
    voteEliminated = null;
    currentRound = 0;
    gameScreen.classList.add("hidden");
    joinScreen.classList.remove("hidden");
    document.body.dataset.screen = "join";
    document.body.dataset.phase = "lobby";
    adoptLanguage(I?.preferred || language);
    S?.returnToLanding?.();
    S?.setPhase("lobby");
    resetSoundCues();
    restoreEntryButtons();
    joinHint.textContent = message || "";
    clearAnswerTurn();
    arena3d?.reset();
    void primeTurnstileToken().catch(() => {});
  }

  // ------------------------------------------------------------------
  // Server message dispatch
  // ------------------------------------------------------------------
  function handle(msg) {
    switch (msg.type) {
      case "session": return onSession(msg);
      case "room_state": return onRoomState(msg);
      case "system": return onSystem(msg);
      case "phase_change": return onPhaseChange(msg);
      case "answer_turn": return onAnswerTurn(msg);
      case "utterance": return onUtterance(msg);
      case "request_input": return onRequestInput(msg);
      case "input_status": return onInputStatus(msg);
      case "playback_cancel":
        A.cancelPlayback?.();
        hideVoiceGate();
        return;
      case "vote_result": return onVoteResult(msg);
      case "elimination": return onElimination(msg);
      case "game_over": return onGameOver(msg);
    }
  }

  function onSession(msg) {
    // Persist the seat's reconnect secret so an automatic retry can prove it is
    // the same browser session, not just someone who knows the anonymous ids.
    if (!msg.reconnect_token || !currentMatch) return;
    if (currentMatch.reconnectToken === msg.reconnect_token) return;
    saveCurrentMatch({ ...currentMatch, reconnectToken: msg.reconnect_token });
  }

  function onSystem(msg) {
    if (msg.code === "room_missing" || msg.code === "reservation_expired") {
      returnToJoin(msg.text);
      return;
    }
    // While still on the join screen, surface errors (e.g. missing lobby) in
    // the hint line rather than the hidden in-game log.
    if (!joinScreen.classList.contains("hidden")) {
      joinHint.textContent = displayText(msg.text);
    } else {
      addLog(displayText(msg.text));
    }
  }

  function onRoomState(msg) {
    if (msg.language) adoptLanguage(msg.language);
    const previousSeats = new Map(seats.map((seat) => [seat.id, seat]));
    seats = msg.seats.map((seat) => {
      const previous = previousSeats.get(seat.id) || {};
      return {
        ...previous,
        ...seat,
        role: seat.role || previous.role || null,
        model: seat.model || previous.model || null,
      };
    });
    if (msg.you) you = msg.you;
    if (typeof msg.is_host === "boolean") isLobbyHost = msg.is_host;
    if (typeof msg.round === "number" && msg.round !== currentRound) {
      currentRound = msg.round;
      latestUtterances.clear();
    }
    if (typeof msg.round_limit === "number") {
      maxRounds = msg.round_limit;
    }
    if (msg.phase === "question" && msg.answers && typeof msg.answers === "object") {
      // A state resync carries the authoritative answers: land any reveal in
      // flight instead of letting it type over them afterwards. Completing it
      // rather than dropping it matters — a dropped reveal would leave the seat
      // stuck on half a sentence with nothing left to finish it.
      finishTyping();
      latestUtterances.clear();
      for (const [seatId, answer] of Object.entries(msg.answers)) {
        latestUtterances.set(seatId, answer);
      }
    }
    joinScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    document.body.dataset.screen = "game";
    document.body.dataset.phase = msg.phase || "lobby";
    S?.setPhase(msg.phase || "lobby");
    S?.setGameActive(true);
    if (msg.phase) {
      phaseName.textContent = phaseLabel(msg.phase);
    }
    if (msg.phase === "question" && msg.prompt) {
      currentQuestion = msg.prompt;
      currentQuestionAct = msg.question_act || currentQuestionAct;
      answerInputSeconds = msg.answer_input_seconds ?? answerInputSeconds;
      phasePrompt.textContent = currentQuestion;
      if (!activeAnswerTurn) {
        turnStatus.textContent =
          t("question.instruction", {
            act: currentQuestionAct || "TRACE",
            seconds: Math.round(answerInputSeconds),
          });
      }
    } else if (msg.phase !== "question") {
      clearAnswerTurn();
      turnStatus.textContent = phaseLabel(msg.phase) || t("phase.live");
    }
    if (msg.phase === "lobby") phasePrompt.textContent = t("arena.waiting");
    renderMissionStatus();
    renderSeats();
    if (you && msg.phase === "lobby") {
      if (msg.started) {
        showGameStarting();
        return;
      }
      if (msg.visibility === "private") {
        showPrivateLobby(
          msg.connected_humans ?? 0,
          msg.expected_humans ?? 0,
        );
        return;
      }
      const remaining = typeof msg.lobby_wait_remaining === "number"
        ? msg.lobby_wait_remaining
        : humanWaitSeconds;
      showWaiting(remaining);
    }
  }

  function showWaiting(remaining = humanWaitSeconds) {
    inputPanel.classList.add("hidden");
    inputControls.innerHTML = "";
    startLobbyCountdown(remaining);
  }

  function showPrivateLobby(connectedHumans, expectedHumans) {
    if (inputCountdown) {
      clearInterval(inputCountdown);
      inputCountdown = null;
    }
    inputTimer.textContent = "";
    inputControls.innerHTML = "";

    const label = document.createElement("span");
    label.className = "lobby-wait-copy";
    label.textContent = isLobbyHost
      ? t("lobby.host_ready")
      : t("lobby.wait_host");
    const count = document.createElement("strong");
    count.className = "lobby-player-count";
    count.textContent = `${connectedHumans} / ${expectedHumans}`;
    const caption = document.createElement("small");
    caption.className = "lobby-player-caption";
    caption.textContent = t("lobby.connected");
    phasePrompt.replaceChildren(label, count, caption);

    if (!isLobbyHost) {
      inputPanel.classList.add("hidden");
      return;
    }

    inputPanel.classList.remove("hidden");
    const playerLabel = connectedHumans === 1
      ? t("lobby.player_one")
      : t("lobby.player_many");
    const btn = mkBtn(t("lobby.start_count", {
      count: connectedHumans,
      players: playerLabel,
    }), () => {
      S?.play("confirm");
      btn.disabled = true;
      btn.textContent = t("voice.starting");
      ws.send(JSON.stringify({ type: "start_game" }));
    });
    btn.disabled = connectedHumans < 1;
    inputControls.appendChild(btn);
  }

  function showGameStarting() {
    if (inputCountdown) {
      clearInterval(inputCountdown);
      inputCountdown = null;
    }
    inputPanel.classList.add("hidden");
    inputControls.innerHTML = "";
    phasePrompt.textContent = t("lobby.starting");
  }

  function startLobbyCountdown(remaining) {
    if (inputCountdown) clearInterval(inputCountdown);
    inputTimer.textContent = "";
    let seconds = Math.round(remaining);
    const tick = () => {
      if (seconds <= 0) {
        phasePrompt.textContent = t("lobby.starting");
        clearInterval(inputCountdown);
        inputCountdown = null;
        return;
      }
      const label = document.createElement("span");
      label.className = "lobby-wait-copy";
      label.textContent = t("lobby.wait_others");
      const countdown = document.createElement("strong");
      countdown.className = "lobby-countdown";
      countdown.textContent = `${seconds}s`;
      phasePrompt.replaceChildren(label, countdown);
      seconds -= 1;
    };
    inputCountdown = setInterval(tick, 1000);
    tick();
  }

  // ------------------------------------------------------------------
  // Seat rendering
  // ------------------------------------------------------------------
  function renderMissionStatus() {
    $("round-current").textContent = currentRound;
    $("round-total").textContent = maxRounds;
    $("players-alive").textContent = seats.filter((seat) => seat.alive).length;
    $("players-total").textContent = seats.length;
  }

  function renderSeats() {
    seatsEl.innerHTML = "";
    for (const [index, s] of seats.entries()) {
      const div = document.createElement("div");
      div.className = "seat"
        + (s.id === you ? " you" : "")
        + (s.alive ? "" : " dead")
        + (s.id === activeAnswerTurn?.seat ? " active-turn" : "");
      div.dataset.seat = s.id;
      const angle = (-90 + (360 / Math.max(seats.length, 1)) * index) * (Math.PI / 180);
      div.style.setProperty("--seat-x", `${50 + Math.cos(angle) * 38}%`);
      div.style.setProperty("--seat-y", `${50 + Math.sin(angle) * 32}%`);

      const avatarWrap = document.createElement("span");
      avatarWrap.className = "seat-avatar-wrap";
      const avatar = document.createElement("span");
      avatar.className = "seat-avatar";
      const avatarNumber = String((index % 10) + 1).padStart(2, "0");
      avatar.style.backgroundImage =
        `url("/assets/characters/character_${avatarNumber}.png")`;
      avatar.setAttribute("aria-hidden", "true");
      const seatIndex = document.createElement("span");
      seatIndex.className = "seat-index";
      seatIndex.textContent = String(index + 1);
      avatarWrap.append(avatar, seatIndex);

      const meta = document.createElement("span");
      meta.className = "seat-meta";
      const name = document.createElement("span");
      name.className = "seat-name";
      name.textContent = displaySeat(s.id);
      const role = document.createElement("span");
      role.className = "role" + (s.role ? (s.role === "human" ? " is-human" : " is-llm") : "");
      role.textContent = s.role
        ? (
          s.role === "human"
            ? t("seat.human")
            : (prettyModel(s.model) || t("seat.ai"))
        )
        : t("seat.masked");
      meta.append(name, role);
      const answer = document.createElement("span");
      answer.className = "seat-answer";
      answer.textContent = latestUtterances.get(s.id) || "";
      const votes = voteTally[s.id];
      if (votes) {
        const badge = document.createElement("span");
        badge.className = "vote-badge" + (s.id === voteEliminated ? " out" : "");
        badge.textContent = t(
          votes === 1 ? "seat.vote_one" : "seat.vote_many",
          { count: votes },
        );
        avatarWrap.appendChild(badge);
      }
      div.append(avatarWrap, meta, answer);
      seatsEl.appendChild(div);
    }
    renderMissionStatus();
    syncArena();
  }

  function syncArena() {
    if (!arena3d) return;
    arena3d.setActive(!gameScreen.classList.contains("hidden"));
    arena3d.sync({
      phase: document.body.dataset.phase || "lobby",
      prompt: phasePrompt.textContent || currentQuestion || "",
      round: currentRound,
      seats: seats.map((seat, index) => ({
        ...seat,
        avatarIndex: index,
        you: seat.id === you,
        answer: latestUtterances.get(seat.id) || "",
        votes: voteTally[seat.id] || 0,
        eliminated: seat.id === voteEliminated,
      })),
    });
    arena3d.setAnswerTurn(activeAnswerTurn?.seat || "");
  }

  function markDead(seatId, role, model) {
    const s = seats.find((x) => x.id === seatId);
    if (s) { s.alive = false; if (role) s.role = role; if (model) s.model = model; }
    renderSeats();
  }

  // "mistral-large-latest" -> "mistral-large" for a cleaner reveal label.
  function prettyModel(model) {
    return model ? model.replace(/-latest$/, "") : "";
  }

  function flashSpeaking(seatId) {
    arena3d?.setSpeaking(seatId, 2500);
    document.querySelectorAll(".seat").forEach((el) =>
      el.classList.toggle("speaking", el.dataset.seat === seatId)
    );
    setTimeout(() => {
      const el = document.querySelector(`.seat[data-seat="${CSS.escape(seatId)}"]`);
      if (el) el.classList.remove("speaking");
    }, 2500);
  }

  // ------------------------------------------------------------------
  // Phases and transcript
  // ------------------------------------------------------------------
  function phaseLabel(phase) {
    return ({
      lobby: t("phase.lobby"),
      question: t("phase.question"),
      vote: t("phase.vote"),
      resolution: t("phase.resolution"),
      game_over: t("phase.game_over"),
    })[phase] || phase;
  }

  function onPhaseChange(msg) {
    // A phase can turn over on the last seat's line; complete it rather than
    // leaving half a sentence frozen on the board.
    finishTyping();
    document.body.dataset.phase = msg.phase;
    phaseName.textContent = phaseLabel(msg.phase);
    if (typeof msg.round === "number" && msg.round !== currentRound) {
      currentRound = msg.round;
      latestUtterances.clear();
    }
    if (msg.phase === "question" && msg.prompt) {
      currentQuestion = msg.prompt;
      currentQuestionAct = msg.question_act || "TRACE";
      answerInputSeconds = msg.answer_input_seconds ?? answerInputSeconds;
    }
    const visiblePrompt = msg.phase === "question"
      ? currentQuestion || phaseFallback(msg.phase)
      : msg.prompt || phaseFallback(msg.phase);
    S?.setPhase(msg.phase);
    const phaseSoundKey = msg.phase === "question"
      ? `${currentRound}:question:${visiblePrompt}`
      : `${currentRound}:${msg.phase}`;
    if (phaseSoundKey !== lastPhaseSoundKey) {
      lastPhaseSoundKey = phaseSoundKey;
      if (msg.phase === "question") S?.play("question");
      else if (msg.phase === "vote") S?.play("vote-open");
    }
    phasePrompt.textContent = visiblePrompt;
    clearAnswerTurn();
    if (msg.phase === "question") {
      activeAnswerRequestId = "";
      turnStatus.textContent =
        t("question.instruction", {
          act: currentQuestionAct,
          seconds: Math.round(answerInputSeconds),
        });
      latestUtterances.clear();
      // Keep the last ballot visible while the elimination reveal plays out.
      if (!elimActive) {
        voteTally = {};
        voteEliminated = null;
      }
    } else {
      activeAnswerRequestId = "";
      turnStatus.textContent = phaseLabel(msg.phase) || t("phase.live");
    }
    hideInput();
    hideVote();
    renderSeats();
    arena3d?.setPhase(msg.phase, visiblePrompt);
    if (phaseCountdown) {
      clearInterval(phaseCountdown);
      phaseCountdown = null;
    }
    startCountdown(phaseTimer, msg.deadline, (h) => (phaseCountdown = h), "", true);
  }

  function clearAnswerTurn() {
    activeAnswerTurn = null;
    turnStatus.textContent = t("arena.live_prompt");
    arena3d?.setAnswerTurn("");
  }

  function onAnswerTurn(msg) {
    hideInput();
    activeAnswerTurn = {
      seat: msg.seat,
      position: msg.position,
      total: msg.total,
    };
    const turnSoundKey = `${currentRound}:${currentQuestion}:${msg.position}:${msg.seat}`;
    if (turnSoundKey !== lastTurnSoundKey) {
      lastTurnSoundKey = turnSoundKey;
      S?.play(msg.seat === you ? "your-turn" : "turn");
    }
    const subject = msg.seat === you
      ? t("reveal.you")
      : displaySeat(msg.seat).toUpperCase();
    turnStatus.textContent = t("reveal.status", {
      position: msg.position,
      total: msg.total,
      subject,
    });
    if (phaseCountdown) {
      clearInterval(phaseCountdown);
      phaseCountdown = null;
    }
    startCountdown(
      phaseTimer,
      msg.deadline,
      (handle) => (phaseCountdown = handle),
      "",
      true,
    );
    renderSeats();
  }

  function phaseFallback(phase) {
    const copy = {
      lobby: t("phase.wait_all"),
      vote: t("phase.who_ai"),
      resolution: t("phase.counting"),
      game_over: t("phase.hunt_over"),
    };
    return copy[phase] || t("phase.wait");
  }

  // ------------------------------------------------------------------
  // Progressive reveal
  // ------------------------------------------------------------------
  // A revealed answer is typed out rather than dropped in whole: the line
  // arrives at the pace of the voice, which is what makes a seat read as a
  // character speaking instead of a text field being filled. The 3D arena is
  // untouched — only the label text advances.
  const TYPE_CHARS_PER_SECOND = 48;   // pace used when a seat has no voice clip
  const TYPE_MIN_SECONDS = 0.35;
  // Stays under `answer_reveal_min_seconds` (2.6 s), the floor a voiceless
  // reveal is held for: a line must never still be typing when the next seat
  // takes over.
  const TYPE_MAX_SECONDS = 1.8;
  const VOICE_WAIT_MS = 350;          // grace for a clip that is still loading
  // The line runs ahead of the voice on purpose: it completes at 70 % of the
  // clip, and starts a beat early. Text lagging behind speech reads as broken;
  // text slightly ahead reads as subtitles.
  const VOICE_LEAD = 0.7;
  const VOICE_HEAD_START_MS = 250;
  // A reported clip length outside this range is not a spoken sentence: it is a
  // browser guessing from a partial download. Ignore it and read-along instead.
  const MIN_CLIP_SECONDS = 0.4;
  const MAX_CLIP_SECONDS = 25;
  const HARD_DEADLINE_MS = 6000;      // nothing may keep a line incomplete past this
  let typing = null;

  function reducedMotion() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }

  // The 2D seat node is cached: this runs once per frame and `renderSeats()`
  // only rebuilds those nodes on a state change, never mid-reveal.
  const seatAnswerNodes = new Map();
  let feedPinned = true;

  function seatAnswerNode(seatId) {
    const cached = seatAnswerNodes.get(seatId);
    if (cached?.isConnected) return cached;
    const node = document.querySelector(
      `.seat[data-seat="${CSS.escape(seatId)}"] .seat-answer`
    );
    if (node) seatAnswerNodes.set(seatId, node);
    else seatAnswerNodes.delete(seatId);
    return node;
  }

  function paintUtterance(seatId, text, feedNode) {
    latestUtterances.set(seatId, text);
    const seatAnswer = seatAnswerNode(seatId);
    if (seatAnswer) seatAnswer.textContent = text;
    if (feedNode) {
      feedNode.textContent = text;
      // The growing line must not push itself out of view, but a player who
      // scrolled up to re-read an earlier answer keeps their position.
      if (feedPinned) transcriptEl.scrollTop = transcriptEl.scrollHeight;
    }
    if (arena3d?.setSeatAnswer) arena3d.setSeatAnswer(seatId, text);
    else syncArena();
  }

  // Complete the line in place. Called before any new reveal and on every phase
  // change, so an interrupted seat is never left with half a sentence.
  function finishTyping() {
    if (!typing) return;
    const state = typing;
    typing = null;
    if (state.raf) cancelAnimationFrame(state.raf);
    paintUtterance(state.seatId, state.full, state.feedNode);
  }

  // Drop the reveal without painting it: used where the answers themselves are
  // being discarded (leaving a match, resetting the board).
  function cancelTyping() {
    if (!typing) return;
    const state = typing;
    typing = null;
    if (state.raf) cancelAnimationFrame(state.raf);
    if (arena3d?.setSeatAnswer) {
      arena3d.setSeatAnswer(state.seatId, latestUtterances.get(state.seatId) || "");
    }
  }

  // Fraction of the sentence that should be visible right now.
  //
  // Everything below is wall-clock, measured from the start of the reveal, and
  // the total duration is fixed once. `audio.duration` is only read to pick
  // that total, never to drive the progress: a browser is free to revise the
  // duration of an MP3 upwards while it plays, and pacing on a live
  // `currentTime / duration` ratio froze the line mid-sentence — sometimes for
  // seconds — every time it did, while the voice carried on.
  function typedRatio(state, now) {
    const elapsed = now - state.start;

    if (!state.paceMs) {
      const clip = state.audioUrl ? A.playbackProgress?.() : null;
      const mine = clip && clip.url === state.audioUrl && !clip.blocked ? clip : null;
      const clipSeconds = mine ? mine.duration / (mine.rate || 1) : 0;
      if (clipSeconds >= MIN_CLIP_SECONDS && clipSeconds <= MAX_CLIP_SECONDS) {
        // Speak-along pace, deliberately ahead of the voice.
        state.paceMs = clipSeconds * 1000 * VOICE_LEAD;
      } else if (!mine || elapsed >= VOICE_WAIT_MS) {
        // No voice for this seat, or no usable duration in time: read-along
        // pace rather than wait on metadata that may never come.
        state.paceMs = Math.min(
          TYPE_MAX_SECONDS * 1000,
          Math.max(TYPE_MIN_SECONDS * 1000, (state.full.length / TYPE_CHARS_PER_SECOND) * 1000),
        );
      } else {
        return 0;   // brief hold while the clip reports its length
      }
    }

    // The deadline is unconditional: whatever the audio does or fails to do,
    // the sentence is fully readable within it.
    return Math.max(
      (elapsed + VOICE_HEAD_START_MS) / state.paceMs,
      elapsed / HARD_DEADLINE_MS,
    );
  }

  function typeUtterance(seatId, full, feedNode, audioUrl) {
    finishTyping();
    if (!full || reducedMotion() || typeof requestAnimationFrame !== "function") {
      paintUtterance(seatId, full, feedNode);
      return;
    }
    const state = {
      seatId, full, feedNode, audioUrl,
      shown: -1,
      start: performance.now(),
      paceMs: 0,
      raf: 0,
    };
    typing = state;
    const step = () => {
      if (typing !== state) return;
      const ratio = Math.min(1, typedRatio(state, performance.now()));
      const count = Math.round(full.length * ratio);
      const done = count >= full.length;
      if (count !== state.shown) {
        state.shown = count;
        paintUtterance(seatId, full.slice(0, count), feedNode);
      }
      if (done) {
        typing = null;
        return;
      }
      state.raf = requestAnimationFrame(step);
    };
    state.raf = requestAnimationFrame(step);
  }

  function onUtterance(msg) {
    flashSpeaking(msg.seat);
    const spoken = msg.text || t("answer.silence");
    // Measured once, before the line starts growing: reading the scroll box on
    // every frame would force a layout next to a 60 fps canvas.
    feedPinned =
      transcriptEl.scrollHeight - transcriptEl.scrollTop - transcriptEl.clientHeight < 40;
    transcriptEl.querySelector(".transcript-empty")?.remove();
    const div = document.createElement("div");
    div.className = "utt";
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = displaySeat(msg.seat);
    div.appendChild(who);
    if (msg.context) {
      const context = document.createElement("span");
      context.className = "ctx";
      context.textContent = ` // ${
        msg.context === "answer" ? t("answer.context") : msg.context
      }`;
      div.appendChild(context);
    }
    const text = document.createElement("span");
    text.className = "utterance-text";
    div.appendChild(text);
    transcriptEl.appendChild(div);
    if (feedPinned) transcriptEl.scrollTop = transcriptEl.scrollHeight;
    // Queue the voice first: the reveal paces itself on that clip, so it has to
    // be the one playing when the first frame measures playback progress.
    if (msg.audio_url) {
      A.enqueue(msg.audio_url, () => {
        if (msg.playback_id && ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "playback_complete",
            playback_id: msg.playback_id,
          }));
        }
      });
    }
    typeUtterance(msg.seat, spoken, text, msg.audio_url || "");
  }

  // ------------------------------------------------------------------
  // Input panels
  // ------------------------------------------------------------------
  function onRequestInput(msg) {
    hideInput();
    if (msg.mode === "vote") {
      buildVotePanel(msg.targets || [], msg.request_id);
      return;
    }

    hideVote();
    arena3d?.setVoteTargets([]);
    inputPanel.classList.remove("hidden");
    inputControls.innerHTML = "";

    if (msg.mode === "answer") {
      activeAnswerRequestId = msg.request_id;
      const panel = buildSpeakPanel((payload) => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "audio_blob",
            request_id: msg.request_id,
            ...payload,
          }));
        }
        turnStatus.textContent = t("answer.locking");
        hideInput();
      });
      activeInputCleanup = panel.cleanup;
      startCountdown(
        inputTimer,
        msg.deadline,
        (handle) => (inputCountdown = handle),
        t("answer.lock_prefix"),
        false,
        () => { void panel.submitDraft(true); },
        (remaining) => {
          if (remaining > 0 && remaining <= 3) {
            S?.play(remaining === 1 ? "tick-final" : "tick");
          }
        },
      );
    }
  }

  function onInputStatus(msg) {
    if (msg.mode === "answer") {
      if (!activeAnswerRequestId || msg.request_id !== activeAnswerRequestId) return;
      activeAnswerRequestId = "";
      if (activeAnswerTurn) return;
      turnStatus.textContent = msg.accepted
        ? t("answer.locked")
        : t("answer.closed");
      if (msg.accepted) S?.play("submit");
      else S?.play("tick-final");
      return;
    }
    if (msg.mode === "vote" && !msg.accepted) {
      addLog(t("vote.late"));
    }
  }

  // Textarea plus a single action button: mic when empty, send when typing,
  // and "stop & send" while recording.
  function buildSpeakPanel(onSend) {
    const ta = document.createElement("textarea");
    const microphoneEnabled = !mockMode;
    ta.maxLength = 100;
    ta.placeholder = microphoneEnabled
      ? t("answer.placeholder_mic")
      : t("answer.placeholder_text");
    const btn = mkBtn(
      microphoneEnabled ? t("answer.mic") : t("answer.type"),
      null,
      "rec",
    );
    let recording = false;
    let starting = false;
    let cancelled = false;
    let sent = false;

    const refresh = () => {
      btn.disabled = starting || sent || (!microphoneEnabled && !ta.value.trim());
      if (starting) {
        btn.textContent = t("answer.opening_mic");
        btn.className = "rec";
      } else if (recording) {
        btn.textContent = t("answer.stop_send");
        btn.className = "rec recording";
      } else if (ta.value.trim()) {
        btn.textContent = t("answer.send");
        btn.className = "";
      } else {
        btn.textContent = microphoneEnabled ? t("answer.mic") : t("answer.type");
        btn.className = microphoneEnabled ? "rec" : "";
      }
    };

    const send = (payload) => {
      if (sent || cancelled) return;
      sent = true;
      refresh();
      onSend(payload);
    };

    const cleanup = () => {
      cancelled = true;
      recording = false;
      starting = false;
    };

    ta.addEventListener("input", refresh);
    ta.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && ta.value.trim()) {
        event.preventDefault();
        send({ audio_b64: null, audio_mime: null, text: ta.value.trim() });
      }
    });
    const submitDraft = async (finalize = false) => {
      if (sent || cancelled) return;
      if (starting) {
        if (finalize) {
          send({ audio_b64: null, audio_mime: null, text: ta.value.trim() });
        }
        return;
      }
      if (recording) {
        recording = false;
        starting = true;
        refresh();
        const audio = await A.stopRecording();
        starting = false;
        if (cancelled || sent) return;
        send({
          audio_b64: audio?.audio_b64 || null,
          audio_mime: audio?.audio_mime || null,
          text: ta.value.trim(),
        });
        return;
      }
      if (ta.value.trim() || finalize) {
        send({ audio_b64: null, audio_mime: null, text: ta.value.trim() });
        return;
      }
      if (!microphoneEnabled) {
        send({ audio_b64: null, audio_mime: null, text: "" });
        return;
      }
      starting = true;
      refresh();
      const ok = await A.startRecording();
      starting = false;
      if (cancelled || sent) {
        A.cancelRecording();
        return;
      }
      if (ok) recording = true;
      else ta.placeholder = t("answer.mic_unavailable");
      refresh();
    };
    btn.addEventListener("click", submitDraft);

    inputControls.append(ta, btn);
    return { textarea: ta, btn, cleanup, submitDraft };
  }

  function buildVotePanel(targets, requestId) {
    let selectedTarget = "";
    const options = [];
    voteOptions.innerHTML = "";
    submitVote.disabled = true;
    arena3d?.setVoteTargets(targets);
    for (const t of targets) {
      const seatIndex = Math.max(0, seats.findIndex((seat) => seat.id === t));
      const option = document.createElement("button");
      option.className = "vote-option";
      option.type = "button";
      option.setAttribute("role", "radio");
      option.setAttribute("aria-checked", "false");
      const img = document.createElement("img");
      img.src = `/assets/characters/character_${String((seatIndex % 10) + 1).padStart(2, "0")}.png`;
      img.alt = "";
      const label = document.createElement("span");
      label.textContent = displaySeat(t);
      option.append(img, label);
      option.addEventListener("click", () => {
        const changed = selectedTarget !== t;
        selectedTarget = t;
        submitVote.disabled = false;
        arena3d?.setSelected(t);
        voteOptions.querySelectorAll(".vote-option").forEach((node) =>
          node.setAttribute("aria-checked", String(node === option))
        );
        if (changed) S?.play("select");
      });
      option.addEventListener("keydown", (event) => {
        if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) return;
        event.preventDefault();
        const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
        const current = options.indexOf(option);
        const next = options[(current + direction + options.length) % options.length];
        next?.focus();
        next?.click();
      });
      options.push(option);
      voteOptions.appendChild(option);
    }
    submitVote.onclick = () => {
      if (!selectedTarget) return;
      S?.play("submit");
      ws.send(JSON.stringify({
        type: "submit_vote",
        request_id: requestId,
        target: selectedTarget,
      }));
      hideVote();
    };
    votePanel.classList.remove("hidden");
    gameScreen.classList.add("vote-open");
  }

  function onVoteResult(msg) {
    hideVote();
    voteTally = msg.tally || {};
    voteEliminated = msg.eliminated || null;
    renderSeats();
    arena3d?.showVoteResult({
      tally: voteTally,
      eliminated: voteEliminated,
      runoff: msg.runoff || [],
    });
    const parts = Object.entries(msg.tally).map(
      ([k, v]) => `${displaySeat(k)}: ${v}`,
    );
    if (!msg.eliminated && msg.runoff?.length) {
      const runoffSoundKey = `${currentRound}:${msg.runoff.join("|")}`;
      if (runoffSoundKey !== lastRunoffSoundKey) {
        lastRunoffSoundKey = runoffSoundKey;
        S?.play("runoff");
      }
    }
    const outcome = msg.eliminated
      ? t("vote.eliminated", { seat: displaySeat(msg.eliminated) })
      : msg.runoff?.length
        ? t("vote.runoff", {
          seats: msg.runoff.map(displaySeat).join(", "),
        })
        : "";
    addLog(t("vote.log", {
      tally: parts.join(", ") || t("vote.none"),
      outcome,
    }));
  }

  function onElimination(msg) {
    const eliminationSoundKey = `${currentRound}:${msg.seat}`;
    if (eliminationSoundKey !== lastEliminationSoundKey) {
      lastEliminationSoundKey = eliminationSoundKey;
      S?.play("elimination");
    }
    markDead(msg.seat, msg.role, msg.model);
    showElimination(msg.seat, msg.role, msg.model);
    if (msg.seat === you) {
      phasePrompt.textContent = t("elimination.you_prompt");
      hideInput();
      hideVote();
    }
  }

  let elimActive = false;

  // Full-arena overlay: eliminated avatar, red stamp, vote tally, role reveal.
  function showElimination(seatId, role, model) {
    const arena = document.querySelector(".arena-viz");
    if (!arena) return;
    arena.querySelector(".elim-overlay")?.remove();
    elimActive = true;
    arena3d?.eliminate(seatId, role, model);

    const overlay = document.createElement("div");
    overlay.className = "elim-overlay";
    const card = document.createElement("div");
    card.className = "elim-card";

    const index = Math.max(0, seats.findIndex((seat) => seat.id === seatId));
    const img = document.createElement("img");
    img.src = `/assets/characters/character_${String((index % 10) + 1).padStart(2, "0")}.png`;
    img.alt = "";

    const name = document.createElement("span");
    name.className = "elim-name";
    name.textContent = displaySeat(seatId);

    const stamp = document.createElement("span");
    stamp.className = "elim-stamp";
    stamp.textContent = seatId === you
      ? t("elimination.you")
      : t("elimination.other");

    card.append(img, name, stamp);
    const entries = Object.entries(voteTally).sort((a, b) => b[1] - a[1]);
    if (entries.length) {
      const tally = document.createElement("span");
      tally.className = "elim-tally";
      for (const [id, votes] of entries) {
        const item = document.createElement("span");
        item.className = "elim-tally-item" + (id === seatId ? " out" : "");
        item.textContent = `${displaySeat(id)} ×${votes}`;
        tally.appendChild(item);
      }
      card.append(tally);
    }
    if (role) {
      const reveal = document.createElement("span");
      reveal.className = "elim-role " + (role === "human" ? "is-human" : "is-llm");
      reveal.append(t("elimination.role_prefix"));
      const b = document.createElement("b");
      b.textContent = role === "human"
        ? t("elimination.human")
        : (prettyModel(model) || t("elimination.ai"));
      reveal.append(b);
      card.append(reveal);
    }
    overlay.appendChild(card);
    arena.appendChild(overlay);

    setTimeout(() => overlay.classList.add("leaving"), 3800);
    setTimeout(() => {
      overlay.remove();
      elimActive = false;
      voteTally = {};
      voteEliminated = null;
      renderSeats();
    }, 4300);
  }

  function resultHeadline(msg) {
    if (msg.winner === "humans") return t("result.humans_title");
    if (msg.winner === "agents") {
      return (msg.winners || []).length === 1
        ? t("result.agent_title")
        : t("result.agents_title");
    }
    return t("result.none_title");
  }

  function resultReasonCopy(reason) {
    const key = {
      all_agents_exposed: "result.reason_all_agents_exposed",
      human_extinction: "result.reason_human_extinction",
      agent_reached_final_two: "result.reason_agent_reached_final_two",
      round_limit: "result.reason_round_limit",
    }[reason] || "result.reason_unknown";
    return t(key);
  }

  function resultAvatar(index) {
    return `/assets/characters/character_${String((index % 10) + 1).padStart(2, "0")}.png`;
  }

  function renderResultRoster(msg, winners) {
    resultRoster.replaceChildren();
    const models = msg.models || {};
    const indexedSeats = seats.map((seat, index) => ({ seat, index }));
    indexedSeats.sort((left, right) =>
      Number(winners.has(right.seat.id)) - Number(winners.has(left.seat.id))
    );

    for (const { seat, index } of indexedSeats) {
      const won = winners.has(seat.id);
      const card = document.createElement("article");
      card.className = "result-player"
        + (won ? " is-winner" : "")
        + (seat.alive ? "" : " is-eliminated")
        + (seat.id === you ? " is-you" : "");

      const avatar = document.createElement("img");
      avatar.src = resultAvatar(index);
      avatar.alt = "";

      const copy = document.createElement("div");
      copy.className = "result-player-copy";
      const name = document.createElement("strong");
      name.className = "result-player-name";
      name.textContent = displaySeat(seat.id);

      const role = document.createElement("span");
      role.className = "result-player-role"
        + (seat.role === "human" ? " is-human" : " is-agent");
      role.textContent = seat.role === "human"
        ? t("seat.human")
        : (prettyModel(models[seat.id] || seat.model) || t("seat.ai"));

      const state = seat.alive ? t("result.survived") : t("result.eliminated");
      const status = document.createElement("span");
      status.className = "result-player-status";
      status.textContent = won ? `${t("result.winner")} · ${state}` : state;

      copy.append(name, role, status);
      card.append(avatar, copy);
      resultRoster.appendChild(card);
    }
  }

  function showResult(msg, { focus = true } = {}) {
    const winners = new Set(msg.winners || []);
    const hasPersonalResult = Boolean(you) && msg.winner !== "none";
    const didWin = hasPersonalResult && winners.has(you);
    const outcome = hasPersonalResult ? (didWin ? "win" : "lose") : "neutral";
    const personalSeat = seats.find((seat) => seat.id === you);
    const winnerIds = [...winners];
    const resultText = displayText(msg.message) || (winnerIds.length === 1
      ? t("game.single_winner", { winner: displaySeat(winnerIds[0]) })
      : winnerIds.length > 1
        ? t("game.multi_winner", {
          winners: winnerIds.map(displaySeat).join(", "),
        })
        : t("game.over"));

    resultOverlay.dataset.outcome = outcome;
    resultOutcome.textContent = outcome === "win"
      ? t("result.victory")
      : outcome === "lose"
        ? t("result.defeat")
        : t("result.complete");
    resultTitle.textContent = resultHeadline(msg);
    resultSummary.textContent = resultText;
    resultReason.textContent = resultReasonCopy(msg.reason);
    resultYourRole.textContent = personalSeat?.role
      ? t("result.your_role", {
        role: personalSeat.role === "human" ? t("seat.human") : t("seat.ai"),
      })
      : "";
    resultYourRole.classList.toggle("hidden", !resultYourRole.textContent);
    renderResultRoster(msg, winners);
    resultOverlay.classList.remove("hidden");

    if (focus) {
      setTimeout(() => resultReplay.focus({ preventScroll: true }), 120);
    }
  }

  resultReplay.addEventListener("click", () => {
    returnToJoin("");
    void play();
  });
  resultMenu.addEventListener("click", () => returnToJoin(""));

  function onGameOver(msg) {
    const firstGameOver = !gameFinished;
    gameFinished = true;
    saveCurrentMatch(null);
    hideInput();
    hideVote();
    document.body.dataset.phase = "game_over";
    S?.setPhase("game_over");
    clearAnswerTurn();
    phaseName.textContent = t("phase.game_over");
    phaseTimer.textContent = "";
    const models = msg.models || {};
    seats = seats.map((seat) => ({
      ...seat,
      role: msg.roles?.[seat.id] || seat.role,
      model: models[seat.id] || seat.model,
    }));
    renderSeats();

    const arenaPayload = {
      ...msg,
      phase: "game_over",
      prompt: t("phase.hunt_over"),
      you,
      seats: seats.map((seat, index) => ({
        ...seat,
        avatarIndex: index,
        you: seat.id === you,
        answer: latestUtterances.get(seat.id) || "",
        votes: voteTally[seat.id] || 0,
      })),
    };
    if (arena3d?.showGameOver) arena3d.showGameOver(arenaPayload);
    else arena3d?.gameOver?.(arenaPayload);

    if (firstGameOver) {
      const soundtrack = msg.winner === "humans"
        ? "human"
        : msg.winner === "agents"
          ? "agent"
          : "draw";
      if (!S?.playResult?.(soundtrack)) {
        S?.play((msg.winners || []).includes(you) ? "win" : "lose");
      }
    }

    phasePrompt.textContent = t("phase.hunt_over");
    document.querySelector(".arena-viz .elim-overlay")?.remove();
    document.querySelector(".winner")?.remove();
    elimActive = false;
    showResult(msg, { focus: firstGameOver });
  }

  // ------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------
  function hideInput() {
    if (activeInputCleanup) activeInputCleanup();
    activeInputCleanup = null;
    A.cancelRecording();
    inputPanel.classList.add("hidden");
    inputControls.innerHTML = "";
    if (inputCountdown) { clearInterval(inputCountdown); inputCountdown = null; }
    inputTimer.textContent = "";
  }

  function hideVote() {
    votePanel.classList.add("hidden");
    gameScreen.classList.remove("vote-open");
    voteOptions.innerHTML = "";
    submitVote.disabled = true;
    submitVote.onclick = null;
    arena3d?.setVoteTargets([]);
    arena3d?.setSelected("");
  }

  function startCountdown(
    el, seconds, store, prefix = "", compact = false, onExpire = null, onTick = null,
  ) {
    if (typeof seconds !== "number") { el.textContent = ""; return; }
    // Never display more time than the server still accepts, especially after
    // a reconnect with a sub-second deadline.
    let remaining = Math.max(0, Math.floor(seconds));
    let expired = false;
    const tick = () => {
      el.textContent = compact
        ? String(Math.max(0, remaining))
        : prefix + (remaining > 0 ? `${remaining}s` : "…");
      if (onTick) onTick(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(handle);
        if (!expired) {
          expired = true;
          if (onExpire) onExpire();
        }
        return;
      }
      remaining -= 1;
    };
    const handle = setInterval(tick, 1000);
    store(handle);
    tick();
  }

  window.addEventListener("pagehide", (event) => {
    A.cancelRecording();
    if (event.persisted) arena3d?.setActive(false);
    else arena3d?.destroy();
  });
  window.addEventListener("pageshow", () => {
    arena3d?.setActive(!gameScreen.classList.contains("hidden"));
  });

  function mkBtn(text, onClick, cls) {
    const b = document.createElement("button");
    b.textContent = text;
    if (cls) b.className = cls;
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }

  // System messages share the live feed with player utterances.
  function addLog(text) {
    transcriptEl.querySelector(".transcript-empty")?.remove();
    const d = document.createElement("p");
    d.className = "utt sys";
    d.textContent = text;
    transcriptEl.appendChild(d);
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }

})();
