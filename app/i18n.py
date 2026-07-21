"""Small, deterministic localization layer for server-owned game copy.

English is the canonical language. A room chooses one supported language at
creation time, and every participant, agent, prompt, and audio service follows
that room language for the lifetime of the game.
"""
from __future__ import annotations

from typing import Final

DEFAULT_LANGUAGE: Final = "en"
SUPPORTED_LANGUAGES: Final = ("en", "fr")


def normalize_language(value: object) -> str:
    """Return ``fr`` for a French locale and English for everything else."""
    cleaned = str(value or "").strip().lower().replace("_", "-")
    return "fr" if cleaned == "fr" or cleaned.startswith("fr-") else DEFAULT_LANGUAGE


_COPY: dict[str, dict[str, str]] = {
    "en": {
        "round": "— Round {round_no} —",
        "no_answer": "No answer.",
        "tie_runoff": "Tie between {seats}. Runoff vote: tied seats only.",
        "runoff_prompt": "Runoff: vote between {seats}.",
        "tie_break": (
            "The runoff is still tied. Prior suspicion breaks the tie; "
            "{seat} is eliminated."
        ),
        "eliminated_ai_model": "{seat} is out… they were an AI ({model}).",
        "eliminated_ai": "{seat} is out… they were an AI.",
        "eliminated_human": "{seat} is out… they were human.",
        "eliminated_hidden": "{seat} is out.",
        "no_elimination": "No one is eliminated this round.",
        "agents_no_humans": (
            "{winners} survived independently. No human remains."
        ),
        "final_duel_shared": (
            "{human} survived to the final duel and {agent} was never exposed. "
            "Both sides win."
        ),
        "agents_round_limit_one": (
            "{winner} remained undetected at the round limit and wins individually."
        ),
        "agents_round_limit_many": (
            "{winners} remained undetected at the round limit and each wins "
            "individually."
        ),
        "humans_win": "The humans have won — every AI was eliminated.",
        "humans_win_hunted": (
            "The humans have won. Every AI still hidden had voted a human out, "
            "which costs an AI the game."
        ),
        "no_winner": "No winner could be determined.",
        "game_over": "Game over. {result}",
        "internal_error": "An internal error interrupted the game.",
        "starting_humans": "Starting with {count} human player{plural}.",
        "waiting_humans": (
            "Waiting up to {seconds} seconds for more human players. "
            "It should be quick."
        ),
        "room_missing": "No lobby named “{room}”. Create it first.",
        "reservation_expired": (
            "Your seat reservation expired. Click Play or join again."
        ),
        "player_joined": "A player joined.",
        "host_only": "Only the private lobby host can start the game.",
        "player_disconnected": "A player disconnected.",
    },
    "fr": {
        "round": "— Manche {round_no} —",
        "no_answer": "Aucune réponse.",
        "tie_runoff": (
            "Égalité entre {seats}. Second vote réservé à ces joueurs."
        ),
        "runoff_prompt": "Second vote : choisissez entre {seats}.",
        "tie_break": (
            "L’égalité persiste. Les soupçons des manches précédentes "
            "départagent le vote ; {seat} est éliminé."
        ),
        "eliminated_ai_model": "{seat} est éliminé… c’était une IA ({model}).",
        "eliminated_ai": "{seat} est éliminé… c’était une IA.",
        "eliminated_human": "{seat} est éliminé… c’était un humain.",
        "eliminated_hidden": "{seat} est éliminé.",
        "no_elimination": "Personne n’est éliminé pendant cette manche.",
        "agents_no_humans": (
            "{winners} ont survécu chacun pour soi. Il ne reste aucun humain."
        ),
        "final_duel_shared": (
            "{human} survit jusqu’au duel final et {agent} n’a jamais été "
            "démasquée. Les deux camps gagnent."
        ),
        "agents_round_limit_one": (
            "{winner} reste indétecté à la fin des manches et gagne seul."
        ),
        "agents_round_limit_many": (
            "{winners} restent indétectés à la fin des manches et gagnent "
            "chacun individuellement."
        ),
        "humans_win": "Les humains ont gagné — toutes les IA ont été éliminées.",
        "humans_win_hunted": (
            "Les humains ont gagné. Chaque IA encore cachée avait fait "
            "éliminer un humain, ce qui lui coûte la partie."
        ),
        "no_winner": "Aucun vainqueur n’a pu être déterminé.",
        "game_over": "Fin de partie. {result}",
        "internal_error": "Une erreur interne a interrompu la partie.",
        "starting_humans": "La partie commence avec {count} joueur{plural} humain{plural}.",
        "waiting_humans": (
            "Nous attendons encore des joueurs humains pendant {seconds} secondes "
            "maximum."
        ),
        "room_missing": "Aucun salon nommé « {room} ». Créez-le d’abord.",
        "reservation_expired": (
            "Votre réservation a expiré. Relancez une partie ou rejoignez le salon."
        ),
        "player_joined": "Un joueur a rejoint la partie.",
        "host_only": "Seul l’hôte du salon privé peut lancer la partie.",
        "player_disconnected": "Un joueur s’est déconnecté.",
    },
}


def tr(language: object, key: str, **values: object) -> str:
    """Format one server-owned message, falling back to canonical English."""
    normalized = normalize_language(language)
    template = _COPY.get(normalized, {}).get(key) or _COPY["en"].get(key) or key
    return template.format(**values)
