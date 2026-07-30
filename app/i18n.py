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
        "agents_no_humans_one": (
            "{winners} survived alone. No human remains at the table."
        ),
        "agents_no_humans_many": (
            "{winners} survived independently. No human remains at the table."
        ),
        "final_duel_shared": (
            "{human} survived to the final duel and {agent} was never unmasked. "
            "Both sides win."
        ),
        "agents_round_limit_one": (
            "{winners} was never unmasked and wins alone at the round limit."
        ),
        "agents_round_limit_many": (
            "{winners} were never unmasked and each wins individually at the "
            "round limit."
        ),
        # Several agents outlasted the humans, but some of them lost their
        # claim. The verdict names both groups, because the roster alone cannot
        # say why a living agent is not a winner. The two rulesets bar opposite
        # seats: `hunted` voted a human out, `idle` never did.
        "agents_no_humans_mixed_hunted_one": (
            "{survivors} survived, but {winners} was the only one that never "
            "voted a human out. No human remains at the table."
        ),
        "agents_no_humans_mixed_hunted_many": (
            "{survivors} survived, but only {winners} never voted a human out. "
            "No human remains at the table."
        ),
        "agents_round_limit_mixed_hunted_one": (
            "{survivors} survived to the round limit, but {winners} was the "
            "only one that never voted a human out."
        ),
        "agents_round_limit_mixed_hunted_many": (
            "{survivors} survived to the round limit, but only {winners} never "
            "voted a human out."
        ),
        "agents_no_humans_mixed_idle_one": (
            "{survivors} survived, but {winners} was the only one that managed "
            "to vote a human out. No human remains at the table."
        ),
        "agents_no_humans_mixed_idle_many": (
            "{survivors} survived, but only {winners} managed to vote a human "
            "out. No human remains at the table."
        ),
        "agents_round_limit_mixed_idle_one": (
            "{survivors} survived to the round limit, but {winners} was the "
            "only one that managed to vote a human out."
        ),
        "agents_round_limit_mixed_idle_many": (
            "{survivors} survived to the round limit, but only {winners} "
            "managed to vote a human out."
        ),
        "humans_win": "The humans have won — every AI was unmasked.",
        "humans_win_hunted_one": (
            "The humans have won. {agents} was still alive, but it had voted a "
            "human out, which costs an AI the game."
        ),
        "humans_win_hunted_many": (
            "The humans have won. {agents} were still alive, but each had voted "
            "a human out, which costs an AI the game."
        ),
        "humans_win_idle_one": (
            "The humans have won. {agents} was still alive, but it never voted "
            "a human out, and hardcore gives it nothing for hiding alone."
        ),
        "humans_win_idle_many": (
            "The humans have won. {agents} were still alive, but none of them "
            "ever voted a human out, and hardcore gives them nothing for "
            "hiding alone."
        ),
        "no_winner_hunted_one": (
            "No human survived. {agents} was still alive, but it had voted a "
            "human out, which costs an AI the game. Nobody wins."
        ),
        "no_winner_hunted_many": (
            "No human survived. {agents} were still alive, but each had voted a "
            "human out, which costs an AI the game. Nobody wins."
        ),
        "no_winner_idle_one": (
            "No human survived, but the humans brought that on themselves: "
            "{agents} was still alive and never voted a single one out, which "
            "wins nothing in hardcore. Nobody wins."
        ),
        "no_winner_idle_many": (
            "No human survived, but the humans brought that on themselves: "
            "{agents} were still alive and never voted a single one out, which "
            "wins nothing in hardcore. Nobody wins."
        ),
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
        "agents_no_humans_one": (
            "{winners} a survécu seul. Il ne reste aucun humain à table."
        ),
        "agents_no_humans_many": (
            "{winners} ont survécu chacun pour soi. Il ne reste aucun humain "
            "à table."
        ),
        "final_duel_shared": (
            "{human} survit jusqu’au duel final et {agent} n’a jamais été "
            "démasqué. Les deux camps gagnent."
        ),
        "agents_round_limit_one": (
            "{winners} n’a jamais été démasqué et gagne seul à la fin des "
            "manches."
        ),
        "agents_round_limit_many": (
            "{winners} n’ont jamais été démasqués et gagnent chacun "
            "individuellement à la fin des manches."
        ),
        "agents_no_humans_mixed_hunted_one": (
            "{survivors} ont survécu, mais seul {winners} a réussi à ne pas "
            "éliminer de joueur humain. Il ne reste aucun humain à table."
        ),
        "agents_no_humans_mixed_hunted_many": (
            "{survivors} ont survécu, mais seuls {winners} ont réussi à ne pas "
            "éliminer de joueur humain. Il ne reste aucun humain à table."
        ),
        "agents_round_limit_mixed_hunted_one": (
            "{survivors} ont survécu jusqu’à la fin des manches, mais seul "
            "{winners} a réussi à ne pas éliminer de joueur humain."
        ),
        "agents_round_limit_mixed_hunted_many": (
            "{survivors} ont survécu jusqu’à la fin des manches, mais seuls "
            "{winners} ont réussi à ne pas éliminer de joueur humain."
        ),
        "agents_no_humans_mixed_idle_one": (
            "{survivors} ont survécu, mais seul {winners} a réussi à éliminer "
            "des joueurs humains. Il ne reste aucun humain à table."
        ),
        "agents_no_humans_mixed_idle_many": (
            "{survivors} ont survécu, mais seuls {winners} ont réussi à "
            "éliminer des joueurs humains. Il ne reste aucun humain à table."
        ),
        "agents_round_limit_mixed_idle_one": (
            "{survivors} ont survécu jusqu’à la fin des manches, mais seul "
            "{winners} a réussi à éliminer des joueurs humains."
        ),
        "agents_round_limit_mixed_idle_many": (
            "{survivors} ont survécu jusqu’à la fin des manches, mais seuls "
            "{winners} ont réussi à éliminer des joueurs humains."
        ),
        "humans_win": (
            "Les humains ont gagné — toutes les IA ont été démasquées."
        ),
        "humans_win_hunted_one": (
            "Les humains ont gagné. {agents} était encore en vie, mais avait "
            "fait éliminer un humain : cela lui coûte la partie."
        ),
        "humans_win_hunted_many": (
            "Les humains ont gagné. {agents} étaient encore en vie, mais "
            "avaient chacun fait éliminer un humain : cela leur coûte la "
            "partie."
        ),
        "humans_win_idle_one": (
            "Les humains ont gagné. {agents} était encore en vie, mais n’a "
            "jamais fait éliminer d’humain, et le hardcore ne récompense pas "
            "une IA qui s’est contentée de se cacher."
        ),
        "humans_win_idle_many": (
            "Les humains ont gagné. {agents} étaient encore en vie, mais aucun "
            "n’a fait éliminer d’humain, et le hardcore ne récompense pas une "
            "IA qui s’est contentée de se cacher."
        ),
        "no_winner_hunted_one": (
            "Aucun humain n’a survécu. {agents} était encore en vie, mais "
            "avait fait éliminer un humain : cela lui coûte la partie. "
            "Personne ne gagne."
        ),
        "no_winner_hunted_many": (
            "Aucun humain n’a survécu. {agents} étaient encore en vie, mais "
            "avaient chacun fait éliminer un humain : cela leur coûte la "
            "partie. Personne ne gagne."
        ),
        "no_winner_idle_one": (
            "Aucun humain n’a survécu, mais les humains se sont sortis "
            "eux-mêmes : {agents} était encore en vie sans en avoir fait "
            "éliminer un seul, ce qui ne vaut rien en hardcore. Personne ne "
            "gagne."
        ),
        "no_winner_idle_many": (
            "Aucun humain n’a survécu, mais les humains se sont sortis "
            "eux-mêmes : {agents} étaient encore en vie sans en avoir fait "
            "éliminer un seul, ce qui ne vaut rien en hardcore. Personne ne "
            "gagne."
        ),
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
