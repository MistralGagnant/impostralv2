"""Static contracts for user-facing web behavior."""
from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
ASSET_VERSION = "20260721-v21"


class WebUiTest(unittest.TestCase):
    def test_static_assets_are_cache_busted(self) -> None:
        index_html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        stats_html = (ROOT / "web" / "stats.html").read_text(encoding="utf-8")
        loader = (ROOT / "web" / "arena3d-loader.js").read_text(encoding="utf-8")

        index_assets = (
            "style.css",
            "i18n.js",
            "audio.js",
            "sound.js",
            "arena3d-loader.js",
            "app.js",
        )
        for asset in index_assets:
            self.assertIn(f"/static/{asset}?v={ASSET_VERSION}", index_html)
        self.assertIn(f"/static/style.css?v={ASSET_VERSION}", stats_html)
        self.assertIn(f"/static/stats.js?v={ASSET_VERSION}", stats_html)
        self.assertIn(f"/static/arena3d.js?v={ASSET_VERSION}", loader)

    def test_home_page_has_search_and_social_metadata(self) -> None:
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")

        self.assertIn('<link rel="canonical" href="https://impostral.com/"', html)
        self.assertIn('property="og:image" content="https://impostral.com/assets/logo.png"', html)
        self.assertIn('name="twitter:card" content="summary_large_image"', html)
        self.assertIn('type="application/ld+json"', html)

    def test_favicon_is_linked_and_available_at_the_standard_url(self) -> None:
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        main = (ROOT / "app" / "main.py").read_text(encoding="utf-8")
        favicon = ROOT / "assets" / "favicon.ico"

        self.assertTrue(favicon.is_file())
        self.assertEqual(favicon.read_bytes()[:4], b"\x00\x00\x01\x00")
        self.assertIn('href="/favicon.ico"', html)
        self.assertIn('@app.get("/favicon.ico", include_in_schema=False)', main)

    def test_crawler_files_use_canonical_urls(self) -> None:
        robots = (ROOT / "web" / "robots.txt").read_text(encoding="utf-8")
        sitemap = (ROOT / "web" / "sitemap.xml").read_text(encoding="utf-8")

        self.assertIn("Sitemap: https://impostral.com/sitemap.xml", robots)
        self.assertIn("<loc>https://impostral.com/</loc>", sitemap)
        self.assertIn("<loc>https://impostral.com/stats.html</loc>", sitemap)

    def test_codename_is_explicitly_optional(self) -> None:
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")

        self.assertIn('data-i18n="landing.codename">Pseudo', html)
        self.assertIn('data-i18n="landing.codename_note">(optional)', html)
        self.assertNotIn('id="name-input" required', html)

    def test_lobby_code_is_generated_and_required_when_joining(self) -> None:
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        app_js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
        i18n = (ROOT / "web" / "i18n.js").read_text(encoding="utf-8")

        # Le champ part vide dans le HTML : c'est app.js qui tire le code.
        self.assertIn('id="room-input" type="text" value=""', html)
        self.assertIn("function randomLobbyCode()", app_js)
        self.assertIn("ABCDEFGHIJKLMNOPQRSTUVWXYZ", app_js)
        self.assertIn("roomInput.value = generatedLobbyCode", app_js)
        # Rejoindre : champ vide signalé, bouton verrouillé tant qu'il l'est.
        self.assertIn('roomInput.classList.toggle("field-missing", missing)', app_js)
        self.assertIn("joinBtn.disabled = missing", app_js)
        self.assertIn('"landing.lobby_code_ask": "ask it to your friend"', i18n)
        self.assertIn('"landing.lobby_code_ask": "à remplir"', i18n)

    def test_landing_leads_with_the_game_mechanic_and_one_primary_entry(self) -> None:
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        app_js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
        css = (ROOT / "web" / "style.css").read_text(encoding="utf-8")

        self.assertIn("Could you spot the AI?", html)
        self.assertIn("Independent Mistral agents infiltrate a group of humans", html)
        self.assertEqual(html.count('id="play-btn"'), 1)
        self.assertIn('<span data-i18n="landing.enter">Enter a game</span>', html)
        self.assertIn('t("landing.enter")', app_js)
        self.assertEqual(html.count("<figure style="), 10)
        self.assertIn('src="/assets/impostral.png"', html)
        self.assertIn('width="1410"', html)
        self.assertIn('fetchpriority="high"', html)
        self.assertIn("aspect-ratio: 1262 / 236", css)
        self.assertIn("top: -147.0339%", css)
        self.assertIn("left: -6.4184%", css)
        self.assertNotIn("Question 01", html)
        self.assertIn("--landing-bg: #0b0a08", (ROOT / "web" / "style.css").read_text(encoding="utf-8"))

    def test_game_language_is_a_visible_persistent_menu_choice(self) -> None:
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        app_js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
        i18n_js = (ROOT / "web" / "i18n.js").read_text(encoding="utf-8")
        css = (ROOT / "web" / "style.css").read_text(encoding="utf-8")

        self.assertIn('id="game-language-label"', html)
        self.assertIn('role="radiogroup" aria-labelledby="game-language-label"', html)
        self.assertIn('data-game-language="en"', html)
        self.assertIn('data-game-language="fr"', html)
        self.assertIn("button.dataset.gameLanguage", app_js)
        self.assertIn("persist: true", app_js)
        self.assertIn('const STORAGE_KEY = "impostral.language"', i18n_js)
        self.assertIn(".language-switch button[aria-checked=\"true\"]", css)

    def test_game_arena_progressively_enhances_the_existing_dom(self) -> None:
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        css = (ROOT / "web" / "style.css").read_text(encoding="utf-8")
        loader = (ROOT / "web" / "arena3d-loader.js").read_text(encoding="utf-8")
        arena = (ROOT / "web" / "arena3d.js").read_text(encoding="utf-8")
        app_js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")

        self.assertIn('id="arena-canvas"', html)
        self.assertLess(html.index('id="arena-canvas"'), html.index('id="seats"'))
        self.assertLess(
            html.index(f'src="/static/arena3d-loader.js?v={ASSET_VERSION}"'),
            html.index(f'src="/static/app.js?v={ASSET_VERSION}"'),
        )
        self.assertIn("3D arena unavailable; using the 2D fallback.", loader)
        self.assertIn(".arena-viz.webgl-ready #arena-canvas", css)
        self.assertIn(".arena-viz.webgl-ready #seats", css)
        self.assertIn("Math.min(devicePixelRatio || 1, ratioLimit)", arena)
        self.assertIn('document.addEventListener("visibilitychange"', arena)
        self.assertIn('canvas.addEventListener("webglcontextlost"', arena)
        self.assertIn("renderer.dispose()", arena)
        self.assertNotIn("WebSocket", arena)
        self.assertIn("arena3d?.eliminate", app_js)
        self.assertIn("arena3d?.showVoteResult", app_js)
        self.assertIn('case "answer_turn": return onAnswerTurn(msg)', app_js)
        self.assertIn('id="turn-status"', html)
        self.assertIn('" active-turn"', app_js)
        self.assertIn("arena3d.setAnswerTurn", app_js)
        self.assertIn("setAnswerTurn,", arena)
        self.assertIn(".arena-tag.is-answering", css)
        answer_turn_handler = app_js.split("function onAnswerTurn(msg)", 1)[1].split(
            "function phaseFallback", 1
        )[0]
        self.assertNotIn("msg.role", answer_turn_handler)
        self.assertNotIn("msg.kind", answer_turn_handler)
        self.assertNotIn("msg.model", answer_turn_handler)
        self.assertIn('"ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"', app_js)

    def test_seat_answers_are_not_line_clamped(self) -> None:
        css = (ROOT / "web" / "style.css").read_text(encoding="utf-8")
        answer_rule = css.split(".seat-answer {", 1)[1].split("}", 1)[0]

        self.assertIn("overflow: visible", answer_rule)
        self.assertIn("white-space: normal", answer_rule)
        self.assertNotIn("line-clamp", answer_rule)

    def test_tts_playback_is_accelerated(self) -> None:
        audio_js = (ROOT / "web" / "audio.js").read_text(encoding="utf-8")

        self.assertIn("let playbackRate = 1.1", audio_js)
        self.assertIn("audio.playbackRate = playbackRate", audio_js)

    def test_adaptive_soundtrack_is_accessible_and_voice_aware(self) -> None:
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        css = (ROOT / "web" / "style.css").read_text(encoding="utf-8")
        app_js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
        audio_js = (ROOT / "web" / "audio.js").read_text(encoding="utf-8")
        sound_js = (ROOT / "web" / "sound.js").read_text(encoding="utf-8")

        self.assertIn('id="sound-toggle"', html)
        self.assertIn('aria-label="Mute music and sound effects"', html)
        self.assertIn('id="voice-gate"', html)
        self.assertIn('id="voice-unlock-btn"', html)
        self.assertLess(
            html.index(f'src="/static/audio.js?v={ASSET_VERSION}"'),
            html.index(f'src="/static/sound.js?v={ASSET_VERSION}"'),
        )
        self.assertLess(
            html.index(f'src="/static/sound.js?v={ASSET_VERSION}"'),
            html.index(f'src="/static/app.js?v={ASSET_VERSION}"'),
        )
        self.assertIn(".sound-meter", css)
        self.assertIn("@keyframes sound-meter-pulse", css)
        self.assertIn('const STORAGE_KEY = "impostral.soundEnabled"', sound_js)
        self.assertIn("createDynamicsCompressor", sound_js)
        self.assertIn("SCHEDULE_AHEAD_SECONDS", sound_js)
        self.assertIn("DUCKED_SFX_LEVEL", sound_js)
        self.assertIn('document.addEventListener("visibilitychange"', sound_js)
        self.assertIn('"impostral:voice-start"', audio_js)
        self.assertIn('"impostral:voice-end"', audio_js)
        self.assertIn('"impostral:recording-start"', audio_js)
        self.assertIn('"impostral:recording-end"', audio_js)
        self.assertIn("const playbackAudio = new Audio()", audio_js)
        self.assertIn("PLAYBACK_STALL_MS", audio_js)
        self.assertIn("unlockPlayback", audio_js)
        self.assertIn("retryPlayback", audio_js)
        self.assertIn("S?.setGameActive(true)", app_js)
        self.assertIn('S?.setPhase("game_over")', app_js)
        self.assertIn("void A.unlockPlayback?.()", app_js)
        self.assertIn('"impostral:voice-blocked"', app_js)
        self.assertIn('const phaseSoundKey = msg.phase === "question"', app_js)
        self.assertNotIn('S?.play("text-reveal")', app_js)
        self.assertIn("onTick = null", app_js)
        self.assertIn('remaining === 1 ? "tick-final" : "tick"', app_js)

    def test_game_over_has_a_complete_accessible_result_sequence(self) -> None:
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        app_js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
        arena_js = (ROOT / "web" / "arena3d.js").read_text(encoding="utf-8")
        sound_js = (ROOT / "web" / "sound.js").read_text(encoding="utf-8")
        css = (ROOT / "web" / "style.css").read_text(encoding="utf-8")

        self.assertIn('id="result-overlay"', html)
        self.assertIn('role="dialog"', html)
        self.assertIn('aria-modal="true"', html)
        self.assertIn('id="result-roster"', html)
        self.assertIn('id="result-replay"', html)
        self.assertIn('id="result-menu"', html)
        self.assertIn("renderResultRoster(msg, winners)", app_js)
        self.assertIn("arena3d.showGameOver(arenaPayload)", app_js)
        self.assertIn("S?.playResult?.(soundtrack)", app_js)
        self.assertIn("closeCurrentSocket()", app_js)
        self.assertIn("function showGameOver", arena_js)
        self.assertIn("function playResult", sound_js)
        self.assertIn(".result-player.is-winner", css)
        self.assertIn("@media (prefers-reduced-motion: reduce)", css)

    def test_microphone_is_released_and_preserves_its_media_type(self) -> None:
        audio_js = (ROOT / "web" / "audio.js").read_text(encoding="utf-8")
        app_js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")

        self.assertIn("track.stop()", audio_js)
        self.assertIn("captureGeneration", audio_js)
        self.assertIn("cancelRecording", audio_js)
        self.assertIn("audio_mime: audioMime", audio_js)
        self.assertIn("A.cancelRecording()", app_js)
        self.assertIn("A.cancelPlayback?.()", app_js)
        self.assertIn("audio?.audio_mime", app_js)
        self.assertIn("request_id: msg.request_id", app_js)
        self.assertIn("request_id: requestId", app_js)
        self.assertIn("onExpire", app_js)

    def test_lobby_wait_is_explained_clearly(self) -> None:
        app_js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
        css = (ROOT / "web" / "style.css").read_text(encoding="utf-8")

        self.assertIn("let humanWaitSeconds = 15", app_js)
        self.assertIn('phasePrompt.textContent = t("arena.waiting")', app_js)
        self.assertIn('label.textContent = t("lobby.wait_others")', app_js)
        self.assertIn("phasePrompt.replaceChildren(label, countdown)", app_js)
        self.assertIn(".lobby-countdown {", css)
        self.assertIn("font-size: clamp(2.8rem, 8vh, 5.4rem)", css)

    def test_question_flow_locks_then_reveals_without_timing_tells(self) -> None:
        app_js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
        i18n_js = (ROOT / "web" / "i18n.js").read_text(encoding="utf-8")

        self.assertIn("let currentQuestionAct", app_js)
        self.assertIn('t("question.instruction"', app_js)
        self.assertIn('"question.instruction": "{act} // ONE SENTENCE · {seconds} SECONDS"', i18n_js)
        self.assertIn('t("reveal.status"', app_js)
        self.assertIn("mockMode = Boolean(config?.mock_mode)", app_js)
        self.assertIn("ta.maxLength = 100", app_js)
        self.assertIn("panel.submitDraft(true)", app_js)
        self.assertIn('t("answer.locking")', app_js)
        self.assertIn('case "input_status": return onInputStatus(msg)', app_js)
        self.assertIn('case "playback_cancel":', app_js)
        self.assertIn("A.cancelPlayback?.();", app_js)
        self.assertIn('t("answer.locked")', app_js)
        self.assertIn("msg.answers", app_js)

    def test_private_lobby_has_live_count_and_host_start_control(self) -> None:
        app_js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
        css = (ROOT / "web" / "style.css").read_text(encoding="utf-8")

        self.assertIn('msg.visibility === "private"', app_js)
        self.assertIn('t("lobby.wait_host")', app_js)
        self.assertIn('caption.textContent = t("lobby.connected")', app_js)
        self.assertIn('type: "start_game"', app_js)
        self.assertNotIn('type: "ready"', app_js)
        self.assertIn(".lobby-player-count {", css)

    def test_every_game_entry_uses_turnstile(self) -> None:
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        app_js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")

        self.assertIn('id="turnstile-container"', html)
        self.assertIn('rel="preconnect" href="https://challenges.cloudflare.com"', html)
        self.assertIn("TURNSTILE_TOKEN_MAX_AGE_MS = 4 * 60 * 1000", app_js)
        self.assertIn("void primeTurnstileToken().catch(() => {})", app_js)
        self.assertIn("consumeCachedTurnstileToken()", app_js)
        self.assertIn("requestTurnstileToken()", app_js)
        self.assertIn('action: "enter_game"', app_js)
        self.assertIn("turnstile_token: turnstileToken", app_js)
        self.assertIn("/lobby/${encodeURIComponent(room)}/join", app_js)


if __name__ == "__main__":
    unittest.main()
