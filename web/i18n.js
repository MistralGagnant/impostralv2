// Browser localization. English is canonical; French is selected for fr-* users.
(function () {
  const COPY = {
    en: {
      "meta.title": "Impostral • Can you spot the AI?",
      "brand.home": "Impostral — home",
      "nav.sound_mute": "Mute music and sound effects",
      "nav.sound_enable": "Enable music and sound effects",
      "nav.sound": "Music + FX",
      "nav.sound_off": "Music + FX off",
      "nav.stats": "Stats",
      "voice.paused": "Your browser paused the game voices.",
      "voice.enable": "Enable voices",
      "voice.starting": "Starting…",
      "voice.retry_copy": "Voices are still paused. Tap once more.",
      "voice.retry": "Try again",
      "voice.unavailable": "Voice playback unavailable — follow the text transcript.",
      "landing.kicker": "Mistral is the player.",
      "landing.title": "Could you spot the AI?",
      "landing.lede": "Independent Mistral agents infiltrate a group of humans — and try to survive by acting human.",
      "landing.rule": "One question. One sentence. One vote.",
      "landing.language": "Game language",
      "landing.language_en": "Play in English",
      "landing.language_fr": "Play in French",
      "landing.enter": "Enter a game",
      "landing.private": "Play with friends in a private room",
      "landing.codename": "Codename",
      "landing.codename_note": "optional · private",
      "landing.codename_placeholder": "Leave blank to stay anonymous",
      "landing.mode": "Lobby mode",
      "landing.create": "Create lobby",
      "landing.join": "Join lobby",
      "landing.lobby_name": "Lobby name",
      "landing.humans": "Human players",
      "landing.including_you": "including you",
      "landing.create_enter": "Create & enter",
      "landing.note": "Free · anonymous · no download",
      "landing.caption": "Who would you vote for?",
      "landing.award": "3rd place · Mistral Vibe Hackathon 2026",
      "landing.source": "Open source ↗",
      "hud.round": "Round",
      "hud.players": "Players",
      "hud.time": "Time",
      "hud.phase": "Phase",
      "hud.feed": "Live feed",
      "hud.feed_empty": "Anonymous channel ready.",
      "hud.round_status": "Round status",
      "arena.label": "Game arena",
      "arena.players": "Players",
      "arena.live_prompt": "Live prompt",
      "arena.waiting": "Waiting for players…",
      "input.action": "Your action",
      "vote.label": "Vote",
      "vote.help": "Vote out the player you think is an AI. Most voted is eliminated.",
      "vote.submit": "Submit vote",
      "phase.lobby": "Lobby",
      "phase.question": "Question",
      "phase.vote": "Vote",
      "phase.resolution": "Resolution",
      "phase.game_over": "Game over",
      "phase.live": "Live status",
      "phase.wait_all": "Waiting for all players…",
      "phase.who_ai": "Who is the AI?",
      "phase.counting": "Counting votes…",
      "phase.hunt_over": "The hunt is over.",
      "phase.wait": "Waiting…",
      "question.instruction": "{act} // ONE SENTENCE · {seconds} SECONDS",
      "reveal.you": "YOUR SIGNAL",
      "reveal.status": "REVEAL {position}/{total} · {subject}",
      "lobby.host_ready": "Start whenever your group is ready",
      "lobby.wait_host": "Waiting for the host to start…",
      "lobby.connected": "human players connected",
      "lobby.start_count": "Start game with {count} {players}",
      "lobby.player_one": "player",
      "lobby.player_many": "players",
      "lobby.starting": "Starting game…",
      "lobby.wait_others": "Waiting for other players…",
      "seat.human": "Human",
      "seat.ai": "AI",
      "seat.masked": "identity masked",
      "seat.you": "You",
      "seat.player_prefix": "Player",
      "seat.vote_one": "{count} vote",
      "seat.vote_many": "{count} votes",
      "answer.silence": "(silence)",
      "answer.context": "answer",
      "answer.locking": "LOCKING ANSWER…",
      "answer.locked": "ANSWER LOCKED · WATCH THE TABLE",
      "answer.closed": "WINDOW CLOSED · NO ANSWER",
      "answer.late": "Your answer arrived after the window closed.",
      "answer.lock_prefix": "Lock your answer: ",
      "answer.placeholder_mic": "One sentence… type or use the mic",
      "answer.placeholder_text": "One sentence… type your answer",
      "answer.mic": "● Mic",
      "answer.type": "Type an answer",
      "answer.opening_mic": "Opening mic…",
      "answer.stop_send": "■ Stop & send",
      "answer.send": "Send",
      "answer.mic_unavailable": "Mic unavailable — type your answer",
      "vote.late": "Your vote arrived after the window closed.",
      "vote.none": "none",
      "vote.log": "Votes — {tally}{outcome}",
      "vote.eliminated": " → {seat} eliminated.",
      "vote.runoff": " → runoff between {seats}.",
      "elimination.you_prompt": "You have been eliminated.",
      "elimination.you": "You are eliminated",
      "elimination.other": "Eliminated",
      "elimination.role_prefix": "They were ",
      "elimination.human": "human",
      "elimination.ai": "an AI",
      "game.you_eliminated": "You were eliminated. {result}",
      "game.single_winner": "{winner} wins the game!",
      "game.multi_winner": "{winners} each survive and win.",
      "game.over": "Game over.",
      "result.victory": "Victory",
      "result.defeat": "Defeat",
      "result.complete": "Result",
      "result.humans_title": "The humans exposed every agent",
      "result.agent_title": "An agent survived the hunt",
      "result.agents_title": "The agents survived the hunt",
      "result.none_title": "No side survived",
      "result.reason_all_agents_exposed": "Every AI identity was exposed.",
      "result.reason_human_extinction": "No human remained at the table.",
      "result.reason_agent_reached_final_two": "An agent reached the final duel.",
      "result.reason_round_limit": "At least one agent stayed hidden through the final round.",
      "result.reason_unknown": "The hunt has ended.",
      "result.your_role": "You were {role}",
      "result.identities": "Identity reveal",
      "result.winner": "Winner",
      "result.survived": "Survived",
      "result.eliminated": "Eliminated",
      "result.you": "You",
      "result.play_again": "Play again",
      "result.back_menu": "Back to menu",
      "result.dialog": "Final game result",
      "connection.closed": "Connection closed. Try again.",
      "connection.interrupted": "Connection interrupted.",
      "connection.unresponsive": "The channel is not responding.",
      "connection.restarted": "The server restarted. Click Play to find a new game.",
      "connection.lost": "Connection lost. Reconnecting ({attempt}/8)…",
      "connection.connecting": "Connecting…",
      "connection.reconnecting": "Reconnecting…",
      "connection.reconnecting_game": "Reconnecting to your game…",
      "connection.opening": "Opening channel “{room}”…",
      "entry.security_failed": "Security check failed. Disable any VPN or content blocker, then try again.",
      "entry.security_unavailable": "Security check unavailable. Please try again in a moment.",
      "entry.exists": "This lobby already exists. Join it instead.",
      "entry.missing": "No lobby with that name exists yet.",
      "entry.full": "This lobby is full.",
      "entry.started": "This lobby has already started.",
      "entry.finding": "Finding a game…",
      "entry.checking": "Checking…",
      "entry.looking": "Looking for the first available game…",
      "entry.finishing_check": "Finishing a quick security check…",
      "entry.find_failed": "Could not find a game. Try again.",
      "entry.room_required": "Enter a lobby name.",
      "entry.creating": "Creating…",
      "entry.joining": "Joining…",
      "entry.creating_room": "Creating lobby “{room}”…",
      "entry.joining_room": "Joining lobby “{room}”…",
      "entry.bad_humans": "Choose between {min} and {max} human players.",
      "entry.exists_named": "Lobby “{room}” already exists. Join it instead.",
      "entry.lobby_failed": "Could not reach the lobby. Try again.",
    },
    fr: {
      "meta.title": "Impostral • Saurez-vous repérer l’IA ?",
      "brand.home": "Impostral — accueil",
      "nav.sound_mute": "Couper la musique et les effets sonores",
      "nav.sound_enable": "Activer la musique et les effets sonores",
      "nav.sound": "Musique + FX",
      "nav.sound_off": "Musique + FX coupés",
      "nav.stats": "Stats",
      "voice.paused": "Votre navigateur a mis les voix du jeu en pause.",
      "voice.enable": "Activer les voix",
      "voice.starting": "Démarrage…",
      "voice.retry_copy": "Les voix sont toujours en pause. Appuyez encore une fois.",
      "voice.retry": "Réessayer",
      "voice.unavailable": "Voix indisponibles — suivez la transcription.",
      "landing.kicker": "Mistral est le joueur.",
      "landing.title": "Saurez-vous repérer l’IA ?",
      "landing.lede": "Des agents Mistral indépendants infiltrent un groupe d’humains — et tentent de survivre en se faisant passer pour eux.",
      "landing.rule": "Une question. Une phrase. Un vote.",
      "landing.language": "Langue de la partie",
      "landing.language_en": "Jouer en anglais",
      "landing.language_fr": "Jouer en français",
      "landing.enter": "Entrer dans une partie",
      "landing.private": "Jouer entre amis dans un salon privé",
      "landing.codename": "Nom de code",
      "landing.codename_note": "facultatif · privé",
      "landing.codename_placeholder": "Laissez vide pour rester anonyme",
      "landing.mode": "Mode du salon",
      "landing.create": "Créer un salon",
      "landing.join": "Rejoindre",
      "landing.lobby_name": "Nom du salon",
      "landing.humans": "Joueurs humains",
      "landing.including_you": "vous compris",
      "landing.create_enter": "Créer et entrer",
      "landing.note": "Gratuit · anonyme · sans téléchargement",
      "landing.caption": "Pour qui voteriez-vous ?",
      "landing.award": "3e place · Mistral Vibe Hackathon 2026",
      "landing.source": "Open source ↗",
      "hud.round": "Manche",
      "hud.players": "Joueurs",
      "hud.time": "Temps",
      "hud.phase": "Phase",
      "hud.feed": "Fil en direct",
      "hud.feed_empty": "Canal anonyme prêt.",
      "hud.round_status": "État de la manche",
      "arena.label": "Arène de jeu",
      "arena.players": "Joueurs",
      "arena.live_prompt": "Question en direct",
      "arena.waiting": "En attente des joueurs…",
      "input.action": "Votre action",
      "vote.label": "Vote",
      "vote.help": "Éliminez le joueur que vous pensez être une IA. Le plus ciblé sort.",
      "vote.submit": "Valider le vote",
      "phase.lobby": "Salon",
      "phase.question": "Question",
      "phase.vote": "Vote",
      "phase.resolution": "Résolution",
      "phase.game_over": "Fin de partie",
      "phase.live": "État en direct",
      "phase.wait_all": "En attente de tous les joueurs…",
      "phase.who_ai": "Qui est l’IA ?",
      "phase.counting": "Décompte des votes…",
      "phase.hunt_over": "La traque est terminée.",
      "phase.wait": "En attente…",
      "question.instruction": "{act} // UNE PHRASE · {seconds} SECONDES",
      "reveal.you": "VOTRE SIGNAL",
      "reveal.status": "RÉVÉLATION {position}/{total} · {subject}",
      "lobby.host_ready": "Lancez quand votre groupe est prêt",
      "lobby.wait_host": "En attente du lancement par l’hôte…",
      "lobby.connected": "joueurs humains connectés",
      "lobby.start_count": "Lancer avec {count} {players}",
      "lobby.player_one": "joueur",
      "lobby.player_many": "joueurs",
      "lobby.starting": "Lancement de la partie…",
      "lobby.wait_others": "En attente d’autres joueurs…",
      "seat.human": "Humain",
      "seat.ai": "IA",
      "seat.masked": "identité masquée",
      "seat.you": "Vous",
      "seat.player_prefix": "Joueur",
      "seat.vote_one": "{count} vote",
      "seat.vote_many": "{count} votes",
      "answer.silence": "(silence)",
      "answer.context": "réponse",
      "answer.locking": "VERROUILLAGE DE LA RÉPONSE…",
      "answer.locked": "RÉPONSE VERROUILLÉE · OBSERVEZ LA TABLE",
      "answer.closed": "TEMPS ÉCOULÉ · AUCUNE RÉPONSE",
      "answer.late": "Votre réponse est arrivée après la fin du temps.",
      "answer.lock_prefix": "Verrouillage : ",
      "answer.placeholder_mic": "Une phrase… écrivez ou utilisez le micro",
      "answer.placeholder_text": "Une phrase… écrivez votre réponse",
      "answer.mic": "● Micro",
      "answer.type": "Écrire une réponse",
      "answer.opening_mic": "Ouverture du micro…",
      "answer.stop_send": "■ Arrêter et envoyer",
      "answer.send": "Envoyer",
      "answer.mic_unavailable": "Micro indisponible — écrivez votre réponse",
      "vote.late": "Votre vote est arrivé après la fin du temps.",
      "vote.none": "aucun",
      "vote.log": "Votes — {tally}{outcome}",
      "vote.eliminated": " → {seat} éliminé.",
      "vote.runoff": " → second vote entre {seats}.",
      "elimination.you_prompt": "Vous avez été éliminé.",
      "elimination.you": "Vous êtes éliminé",
      "elimination.other": "Éliminé",
      "elimination.role_prefix": "C’était ",
      "elimination.human": "un humain",
      "elimination.ai": "une IA",
      "game.you_eliminated": "Vous avez été éliminé. {result}",
      "game.single_winner": "{winner} gagne la partie !",
      "game.multi_winner": "{winners} survivent et gagnent individuellement.",
      "game.over": "Fin de partie.",
      "result.victory": "Victoire",
      "result.defeat": "Défaite",
      "result.complete": "Résultat",
      "result.humans_title": "Les humains ont exposé toutes les IA",
      "result.agent_title": "Une IA a survécu à la traque",
      "result.agents_title": "Les IA ont survécu à la traque",
      "result.none_title": "Aucun camp n’a survécu",
      "result.reason_all_agents_exposed": "Toutes les identités artificielles ont été exposées.",
      "result.reason_human_extinction": "Il ne restait plus aucun humain à la table.",
      "result.reason_agent_reached_final_two": "Une IA a atteint le duel final.",
      "result.reason_round_limit": "Au moins une IA est restée cachée jusqu’à la dernière manche.",
      "result.reason_unknown": "La traque est terminée.",
      "result.your_role": "Vous étiez {role}",
      "result.identities": "Révélation des identités",
      "result.winner": "Vainqueur",
      "result.survived": "En vie",
      "result.eliminated": "Éliminé",
      "result.you": "Vous",
      "result.play_again": "Rejouer",
      "result.back_menu": "Retour au menu",
      "result.dialog": "Résultat final de la partie",
      "connection.closed": "Connexion fermée. Réessayez.",
      "connection.interrupted": "Connexion interrompue.",
      "connection.unresponsive": "Le canal ne répond pas.",
      "connection.restarted": "Le serveur a redémarré. Relancez une partie.",
      "connection.lost": "Connexion perdue. Reconnexion ({attempt}/8)…",
      "connection.connecting": "Connexion…",
      "connection.reconnecting": "Reconnexion…",
      "connection.reconnecting_game": "Reconnexion à votre partie…",
      "connection.opening": "Ouverture du canal « {room} »…",
      "entry.security_failed": "Le contrôle de sécurité a échoué. Désactivez le VPN ou le bloqueur, puis réessayez.",
      "entry.security_unavailable": "Contrôle de sécurité indisponible. Réessayez dans un instant.",
      "entry.exists": "Ce salon existe déjà. Rejoignez-le.",
      "entry.missing": "Aucun salon ne porte ce nom.",
      "entry.full": "Ce salon est complet.",
      "entry.started": "La partie de ce salon a déjà commencé.",
      "entry.finding": "Recherche d’une partie…",
      "entry.checking": "Vérification…",
      "entry.looking": "Recherche de la première partie disponible…",
      "entry.finishing_check": "Fin du contrôle de sécurité…",
      "entry.find_failed": "Impossible de trouver une partie. Réessayez.",
      "entry.room_required": "Saisissez un nom de salon.",
      "entry.creating": "Création…",
      "entry.joining": "Connexion…",
      "entry.creating_room": "Création du salon « {room} »…",
      "entry.joining_room": "Connexion au salon « {room} »…",
      "entry.bad_humans": "Choisissez entre {min} et {max} joueurs humains.",
      "entry.exists_named": "Le salon « {room} » existe déjà. Rejoignez-le.",
      "entry.lobby_failed": "Impossible de rejoindre le salon. Réessayez.",
    },
  };

  function normalize(value) {
    const cleaned = String(value || "").trim().toLowerCase().replaceAll("_", "-");
    return cleaned === "fr" || cleaned.startsWith("fr-") ? "fr" : "en";
  }

  const STORAGE_KEY = "impostral.language";

  function readPreference() {
    try {
      const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
      return stored ? normalize(stored) : "";
    } catch {
      return "";
    }
  }

  function writePreference(next) {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, next);
    } catch {
      // Language choice remains valid for this page when storage is blocked.
    }
  }

  function detect() {
    const requested = new URLSearchParams(location.search).get("lang");
    if (requested) return normalize(requested);
    const stored = readPreference();
    if (stored) return stored;
    const candidates = navigator.languages?.length
      ? navigator.languages
      : [navigator.language || "en"];
    return normalize(candidates[0]);
  }

  let language = detect();
  let preferredLanguage = language;

  function t(key, values = {}) {
    const template = COPY[language]?.[key] ?? COPY.en[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (_, name) =>
      values[name] === undefined ? `{${name}}` : String(values[name])
    );
  }

  function apply(root = document) {
    document.documentElement.lang = language;
    document.title = t("meta.title");
    root.querySelectorAll?.("[data-i18n]").forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    root.querySelectorAll?.("[data-i18n-placeholder]").forEach((node) => {
      node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
    });
    root.querySelectorAll?.("[data-i18n-aria-label]").forEach((node) => {
      node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
    });
  }

  function setLanguage(next, { persist = true } = {}) {
    const normalized = normalize(next);
    if (persist) {
      preferredLanguage = normalized;
      writePreference(normalized);
    }
    if (normalized === language) return language;
    language = normalized;
    apply();
    window.dispatchEvent(new CustomEvent("impostral:language", {
      detail: { language },
    }));
    return language;
  }

  function seat(id) {
    if (language !== "fr") return id;
    return String(id || "").replace(/^Player\b/, t("seat.player_prefix"));
  }

  window.ImpostralI18n = {
    get language() { return language; },
    get preferred() { return preferredLanguage; },
    supported: Object.freeze(["en", "fr"]),
    normalize,
    detect,
    t,
    apply,
    setLanguage,
    seat,
  };
  apply();
})();
