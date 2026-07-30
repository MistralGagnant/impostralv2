"""Static contracts for user-facing web behavior."""
from __future__ import annotations

import re
import unittest
from pathlib import Path

from app.rooms import MAX_SEAT_NAME_LENGTH


ROOT = Path(__file__).resolve().parent.parent
ASSET_VERSION = "20260730-v39"


class WebUiTest(unittest.TestCase):
    def test_static_assets_are_cache_busted(self) -> None:
        index_html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        stats_html = (ROOT / "web" / "stats.html").read_text(encoding="utf-8")
        board_html = (ROOT / "web" / "leaderboard.html").read_text(encoding="utf-8")
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
        self.assertIn(f"/static/style.css?v={ASSET_VERSION}", board_html)
        self.assertIn(f"/static/leaderboard.js?v={ASSET_VERSION}", board_html)
        about_html = (ROOT / "web" / "about.html").read_text(encoding="utf-8")
        for asset in ("style.css", "i18n.js", "about.js"):
            self.assertIn(f"/static/{asset}?v={ASSET_VERSION}", about_html)
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
        self.assertIn("<loc>https://impostral.com/leaderboard.html</loc>", sitemap)

    def test_every_page_wears_the_landing_header(self) -> None:
        css = (ROOT / "web" / "style.css").read_text(encoding="utf-8")

        for page in ("stats.html", "leaderboard.html", "about.html"):
            html = (ROOT / "web" / page).read_text(encoding="utf-8")
            self.assertIn('<body data-screen="page">', html, page)

        # The flat header is shared, not duplicated: each landing rule that
        # draws it carries the page selector alongside.
        for rule in ('body[data-screen="page"] .hud-header',
                     'body[data-screen="page"] .hud-nav a',
                     'body[data-screen="page"] .hud-nav a:hover',
                     'body[data-screen="page"] .brand'):
            self.assertIn(rule, css)

    def test_leaderboard_is_reachable_from_the_header_of_every_page(self) -> None:
        index_html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        stats_html = (ROOT / "web" / "stats.html").read_text(encoding="utf-8")
        board_html = (ROOT / "web" / "leaderboard.html").read_text(encoding="utf-8")

        self.assertIn('href="/leaderboard.html"', index_html)
        self.assertIn('data-i18n="nav.leaderboard"', index_html)
        # The narrow-screen spelling exists too: the HUD nav is full at 560 px.
        self.assertIn('data-i18n="nav.leaderboard_short"', index_html)
        self.assertIn('href="/leaderboard.html"', stats_html)
        self.assertIn('href="/stats.html"', board_html)

    def test_the_pseudonym_is_offered_before_the_private_lobby_panel(self) -> None:
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")

        # It gates the leaderboard and applies to public matchmaking too, so it
        # must not sit inside the "play with friends" panel a public player
        # never opens.
        self.assertLess(
            html.index('id="name-input"'),
            html.index('<details id="advanced-options"'),
        )

    def test_the_codename_is_one_value_shown_in_two_places(self) -> None:
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        app_js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")

        self.assertIn(
            f'id="name-input-private" type="text" maxlength="{MAX_SEAT_NAME_LENGTH}"',
            html,
        )
        # Every entry path reads the shared value, never one of the two fields:
        # entering a private game under a different name than the ranked one is
        # exactly what the second field would otherwise allow.
        self.assertNotIn('$("name-input").value', app_js)
        self.assertGreaterEqual(app_js.count("name: currentCodename(),"), 3)
        # The suggestion is saved on first sight, or it would be redrawn on
        # every page load instead of following the player around the site.
        self.assertIn("storeCodename(currentCodename());", app_js)

    def test_a_suggested_codename_always_fits_the_seat_limit(self) -> None:
        app_js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")

        words = re.search(
            r"const CODENAME_WORDS = \[(.*?)\];", app_js, re.S).group(1)
        words = re.findall(r'"([^"]+)"', words)

        self.assertTrue(words)
        # `input.value` set from script ignores `maxlength`, so an over-long
        # word would show a name the server then truncates to something else.
        longest = max(words, key=len)
        self.assertLessEqual(
            len(longest) + 3, MAX_SEAT_NAME_LENGTH, f"{longest} + 3 digits")

    def test_back_to_game_returns_to_the_running_game(self) -> None:
        app_js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")

        # The HUD links leave the page, so "Back to game" is a fresh load of
        # "/": without reading the remembered match back, it lands on the home
        # screen and the seat the server still holds becomes unreachable.
        self.assertIn('sessionStorage.getItem("impostral.activeMatch")', app_js)
        self.assertIn("const restorableMatch = pageWasReloaded()", app_js)
        self.assertIn(
            "connect(restorableMatch, { reconnecting: true });", app_js)
        # A reload stays the way out of a running game.
        self.assertIn('entry?.type === "reload"', app_js)
        # A match without the seat secret would only be refused by the server.
        self.assertIn(
            'if (typeof match.reconnectToken !== "string" '
            "|| !match.reconnectToken) {",
            app_js,
        )

    def test_about_page_links_every_author_and_the_repository(self) -> None:
        html = (ROOT / "web" / "about.html").read_text(encoding="utf-8")
        main = (ROOT / "app" / "main.py").read_text(encoding="utf-8")
        sitemap = (ROOT / "web" / "sitemap.xml").read_text(encoding="utf-8")
        image = ROOT / "assets" / "mistral-vibe-hackathon.jpeg"

        for url in (
            "https://louenpottier.github.io/",
            "https://louisguichard.fr/",
            "https://mathieuastruc.com/",
            "https://www.linkedin.com/in/arthur-solere/",
            "https://github.com/MistralGagnant/impostralv2/",
        ):
            self.assertIn(f'href="{url}"', html)
        # Outbound links open elsewhere, so they must not hand the opener over.
        self.assertEqual(
            html.count('target="_blank" rel="noopener noreferrer"'),
            html.count('target="_blank"'),
        )
        self.assertTrue(image.is_file())
        self.assertIn('src="/assets/mistral-vibe-hackathon.jpeg"', html)
        self.assertIn('@app.get("/about.html")', main)
        self.assertIn("<loc>https://impostral.com/about.html</loc>", sitemap)

        # Names are shuffled client-side: no position on that page is a rank.
        about_js = (ROOT / "web" / "about.js").read_text(encoding="utf-8")
        self.assertIn("Math.random()", about_js)
        self.assertIn(".ab-people", about_js)

        index_html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        self.assertIn('href="/about.html"', index_html)
        # The French label does not fit the mobile bar; a short spelling does.
        self.assertIn('data-i18n="nav.about_short"', index_html)

    def test_about_page_is_translated_without_stealing_the_landing_title(self) -> None:
        html = (ROOT / "web" / "about.html").read_text(encoding="utf-8")
        i18n = (ROOT / "web" / "i18n.js").read_text(encoding="utf-8")

        # `apply()` sets document.title, so a page that does not name its own
        # key would silently wear the landing's title.
        self.assertIn('data-i18n-title="meta.title_about"', html)
        self.assertIn("dataset?.i18nTitle", i18n)
        for key in ("about.title", "about.claim", "about.team_title",
                    "about.repo_link"):
            self.assertIn(f'data-i18n="{key}"', html)
        self.assertIn('data-i18n-alt="about.image_alt"', html)
        for key in ("meta.title_about", "about.claim", "about.repo_link",
                    "nav.back"):
            self.assertEqual(
                i18n.count(f'"{key}":'), 2, f"{key} must exist in EN and FR")

    def test_codename_is_explicitly_optional(self) -> None:
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")

        self.assertIn('data-i18n="landing.codename">Pseudo', html)
        self.assertIn('data-i18n="landing.codename_note">(optional, 8 characters)', html)
        # The input states the same bound the seat enforces server-side.
        self.assertIn(f'id="name-input" type="text" maxlength="{MAX_SEAT_NAME_LENGTH}"', html)
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

    def test_rules_panel_states_both_rulesets_from_the_header(self) -> None:
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        app_js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
        i18n_js = (ROOT / "web" / "i18n.js").read_text(encoding="utf-8")
        css = (ROOT / "web" / "style.css").read_text(encoding="utf-8")

        self.assertIn('<button id="rules-btn" class="nav-btn"', html)
        self.assertIn('<dialog id="rules-dialog"', html)
        self.assertIn("rulesDialog.showModal()", app_js)
        self.assertIn(".rules-dialog::backdrop", css)

        # Le bouton doit suivre les liens de la nav partout, sinon il garde le
        # gabarit encadré du HUD au milieu des liens plats de la landing.
        self.assertIn('body[data-screen="join"] .hud-nav .nav-btn,', css)
        self.assertIn('body[data-screen="join"] .hud-nav .nav-btn:hover,', css)
        self.assertIn("  .hud-nav .nav-btn,\n  .sound-toggle {", css)

        # Les deux règlements sont décrits côte à côte, en anglais et en
        # français : la landing ne connaît pas encore le mode du salon.
        keys = (
            "rules.lede",
            "rules.standard_humans",
            "rules.standard_agents",
            "rules.hardcore_agents",
            "rules.tip",
        )
        for key in keys:
            self.assertIn(f'data-i18n="{key}"', html)
            self.assertEqual(i18n_js.count(f'"{key}":'), 2, key)

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

    def test_speaking_bubble_shows_a_voice_level_meter(self) -> None:
        css = (ROOT / "web" / "style.css").read_text(encoding="utf-8")
        arena = (ROOT / "web" / "arena3d.js").read_text(encoding="utf-8")
        app_js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")

        # The meter belongs to the seat holding the floor, and only while it does.
        self.assertIn(".arena-tag.is-speaking .arena-tag-meter { display: flex; }", css)
        self.assertIn(".arena-tag-meter {\n  display: none;", css)
        # Every bar of the meter is mapped to a level, newest on the right.
        for index in range(4):
            self.assertIn(f"var(--vu-{index}, 0)", css)

        # No caret: the growing line is signal enough that a seat is mid-sentence.
        self.assertNotIn("is-typing", css)
        self.assertNotIn("is-typing", arena)
        self.assertNotIn("tag-caret", css)

        # Bar heights are pushed by the reveal loop, one level per character, and
        # written in a single assignment rather than twenty invalidations.
        self.assertIn("setVoiceLevel,", arena)
        self.assertIn("endSpeaking,", arena)
        self.assertIn("record.dom.meter.style.cssText = css", arena)
        self.assertIn("arena3d?.setVoiceLevel?.(state.seatId, state.level)", app_js)
        self.assertIn("levels: voiceEnvelope(full)", app_js)

        # A held speaking state outlives the old fixed flash: the pace of a line
        # is only known once its clip plays, and it routinely runs past 2.5 s.
        self.assertIn("record.speakingHeld || record.speakingUntil > now", arena)
        self.assertIn("arena3d?.setSpeaking(seatId, 0, true)", app_js)
        self.assertNotIn("flashSpeaking(msg.seat)", app_js)

        # No analyser on the shared <audio> element: an AudioContext that the
        # autoplay policy can suspend must never sit in front of the voices.
        self.assertNotIn("createMediaElementSource", app_js)
        self.assertNotIn("AnalyserNode", app_js)
        self.assertNotIn("createAnalyser", app_js)

    def test_arena_labels_dodge_the_hud_and_each_other(self) -> None:
        arena = (ROOT / "web" / "arena3d.js").read_text(encoding="utf-8")

        # The HUD paints above the label layer, so a bubble under a panel is lost,
        # not dimmed. Every panel that can cover the arena is an obstacle.
        for selector in (
            ".hud-header",
            ".mission-panel",
            "#vote-panel",
            "#input-panel",
            ".question-frame",
        ):
            self.assertIn(f'"{selector}"', arena)
        # Measured off the frame path: panels only move on resize, phase change
        # and when a ballot opens.
        self.assertIn("now - hudMeasuredAt < HUD_REFRESH_MS", arena)
        # The ballot's space is kept clear even while it is hidden, or the bubbles
        # on that side spread into it between rounds and jump aside at every vote.
        self.assertIn('const HUD_RESERVED = { "#vote-panel": "right" }', arena)
        # The seat holding the floor is placed first, so the bubble being read
        # keeps its spot and the others yield; then nearest first, which is also
        # the paint order. Both used to fall out of creation order.
        self.assertIn("b.floor === a.floor ? b.depth - a.depth", arena)
        self.assertIn("LABEL_BLEND_FLOOR", arena)
        self.assertIn("label.style.zIndex", arena)
        # A placed label becomes an obstacle for the seats behind it.
        self.assertIn("blockers.push(", arena)
        # Targets move in steps (a bubble growing a line, a neighbour taking the
        # floor), so the label is eased towards them instead of cut to them.
        self.assertIn("(targetEdge - previous.edge) * ease", arena)
        self.assertIn("width 200ms", (ROOT / "web" / "style.css").read_text(encoding="utf-8"))
        # Held by the edge nearest its side of the arena, so a bubble up against
        # the live feed or the ballot widens away from it instead of sliding.
        self.assertIn("const anchorRight = target.x >", arena)
        self.assertIn("translate(-100%, -50%)", arena)
        # The tail lands beside the head, not on it.
        self.assertIn("item.headX + TAIL_AIM_OFFSET", arena)

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

    def test_roles_are_never_revealed_before_the_verdict_covers_the_arena(
        self,
    ) -> None:
        """Le rôle des sièges vivants ne doit pas clignoter dans l'arène.

        `game_over` arrive une seconde et demie après la dernière élimination
        et porte le modèle de chaque IA, y compris celles encore en jeu. Tant
        que l'overlay du verdict n'est pas opaque, l'arène reste visible
        derrière : révéler les sièges avant la fin du fondu afficherait tous
        les modèles pendant un demi-tour de jeu.
        """
        app_js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
        css = (ROOT / "web" / "style.css").read_text(encoding="utf-8")

        fade = re.search(r"animation: result-overlay-in (\d+)ms", css)
        delay = re.search(r"RESULT_REVEAL_DELAY_MS = (\d+)", app_js)
        self.assertIsNotNone(fade)
        self.assertIsNotNone(delay)
        self.assertGreaterEqual(int(delay.group(1)), int(fade.group(1)))

        # La révélation vit hors de onGameOver, derrière ce délai.
        game_over = app_js.index("function onGameOver(msg)")
        reveal = app_js.index("function revealEveryone(msg, outcome)")
        body = app_js[game_over:reveal]
        self.assertLess(body.index("showResult(msg"), body.index("revealEveryone("))
        self.assertNotIn("seats = seats.map(", body)
        self.assertNotIn("showGameOver", body)
        self.assertIn("}, RESULT_REVEAL_DELAY_MS);", app_js[reveal:])

        # Le dialogue lit donc le verdict, pas l'état encore masqué des sièges.
        self.assertIn("const revealedRole = msg.roles?.[seat.id] || seat.role;", app_js)
        self.assertIn("const personalRole = msg.roles?.[you] || personalSeat?.role;", app_js)

    def test_final_verdict_is_read_from_the_human_side(self) -> None:
        app_js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
        arena_js = (ROOT / "web" / "arena3d.js").read_text(encoding="utf-8")
        i18n_js = (ROOT / "web" / "i18n.js").read_text(encoding="utf-8")
        css = (ROOT / "web" / "style.css").read_text(encoding="utf-8")

        # Victoire, défaite ou égalité : jamais un « Résultat » neutre.
        self.assertIn("function humanOutcome(msg)", app_js)
        self.assertIn("const outcome = humanOutcome(msg);", app_js)
        self.assertNotIn("result.complete", app_js)
        self.assertNotIn('"result.complete"', i18n_js)

        # Une table vidée de ses humains est une défaite, même quand chaque IA
        # encore assise a perdu en faisant éliminer un humain.
        self.assertIn(
            'if (!humanSeats.some((seat) => seat.alive)) return "lose";', app_js
        )
        # L'égalité exige plusieurs humains au départ, un survivant humain et
        # une IA survivante ; sinon un humain en vie signe une victoire.
        self.assertIn(
            'return agentAlive && humanSeats.length > 1 ? "draw" : "win";', app_js
        )

        # Le décor 3D, la partition et le bandeau suivent la même lecture.
        self.assertIn('["win", "lose", "draw"].includes(declared)', arena_js)
        self.assertIn('outcome === "win"\n        ? "human"', app_js)
        self.assertIn('.result-overlay[data-outcome="draw"],', css)

        keys = (
            "result.tie",
            "result.tie_title",
            "result.duel_solo_title",
            "result.humans_survived_title",
        )
        for key in keys:
            self.assertEqual(i18n_js.count(f'"{key}":'), 2, key)

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

    def test_hardcore_entry_points_are_offered_in_red(self) -> None:
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        app_js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
        css = (ROOT / "web" / "style.css").read_text(encoding="utf-8")
        i18n = (ROOT / "web" / "i18n.js").read_text(encoding="utf-8")

        # Le bouton rouge se place sous le bouton orange, même gabarit.
        self.assertIn('id="play-hardcore-btn"', html)
        self.assertIn('class="play-btn play-btn--hardcore"', html)
        self.assertIn('id="join-hardcore-btn"', html)
        self.assertIn('play("hardcore")', app_js)
        self.assertIn('enterRoom("hardcore")', app_js)
        self.assertIn("payload.mode = ruleset", app_js)
        self.assertIn("mode: ruleset", app_js)
        self.assertIn('body[data-screen="join"] .play-btn--hardcore {', css)
        self.assertIn('"landing.enter_hardcore": "Enter a hardcore game"', i18n)
        self.assertIn(
            '"landing.enter_hardcore": "Entrer dans une partie hardcore"', i18n
        )
        self.assertIn('"landing.create_hardcore": "Créer un salon hardcore"', i18n)

    def test_the_hardcore_ruleset_is_visible_during_the_game(self) -> None:
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        app_js = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
        css = (ROOT / "web" / "style.css").read_text(encoding="utf-8")

        self.assertIn('id="mode-badge"', html)
        self.assertIn('data-i18n="hud.hardcore"', html)
        self.assertIn("document.body.dataset.mode = msg.mode", app_js)
        self.assertIn('body[data-mode="hardcore"] .mode-badge {', css)
        # Le panneau de règles décrit toujours les deux règlements ; seul le
        # rouge du titre hardcore le distingue de la partie normale.
        self.assertIn('<section class="rules-mode-hardcore">', html)
        self.assertIn(".rules-mode-hardcore h3 { color: var(--red); }", css)


if __name__ == "__main__":
    unittest.main()
