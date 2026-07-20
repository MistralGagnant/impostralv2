"""Curated question cards for the Impostral deduction loop.

The deck follows a compact dramatic arc. Early cards ask for an immediate
trace; later cards ask for a quirk, a choice, a memory, then an alibi. The arc
is compressed to the number of rounds the current room can actually play.
"""
from __future__ import annotations

from dataclasses import dataclass
import random


SUPPORTED_LOCALES = ("en", "fr")
DEFAULT_LOCALE = "en"


@dataclass(frozen=True, slots=True)
class LocalizedQuestion:
    """Localized player-facing copy for one canonical question card."""

    prompt: str
    mock_answers: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class QuestionCard:
    """One safe, short prompt and the metadata needed to pace a round."""

    id: str
    prompt: str
    act: str
    mode: str
    similarity_key: str
    mock_answers: tuple[str, ...]

    @property
    def kicker(self) -> str:
        return self.act

    def localized(self, locale: str | None = None) -> LocalizedQuestion:
        """Return this card's copy in a supported locale."""
        return localize_question(self, locale)

    def prompt_for(self, locale: str | None = None) -> str:
        """Return the player-facing prompt in a supported locale."""
        return self.localized(locale).prompt

    def mock_answers_for(self, locale: str | None = None) -> tuple[str, ...]:
        """Return the local demo answers in a supported locale."""
        return self.localized(locale).mock_answers


ACTS = ("TRACE", "TELL", "FRICTION", "ECHO", "ALIBI")


def playable_rounds(seat_count: int, round_cap: int) -> int:
    """Return the maximum rounds possible before a final two-seat showdown."""
    return min(max(1, int(round_cap)), max(1, int(seat_count) - 2))


def _card(
    card_id: str,
    prompt: str,
    act: str,
    mode: str,
    similarity_key: str,
    *mock_answers: str,
) -> QuestionCard:
    return QuestionCard(
        id=card_id,
        prompt=prompt,
        act=act,
        mode=mode,
        similarity_key=similarity_key,
        mock_answers=tuple(mock_answers),
    )


QUESTIONS: tuple[QuestionCard, ...] = (
    # TRACE — an immediate detail that is easy to answer after one listen.
    _card(
        "trace_last_touch",
        "What was the last thing you touched before joining this game?",
        "TRACE", "observation", "touch",
        "The cold rim of my coffee mug.",
        "My phone charger, it was tangled again.",
        "The back of this chair.",
        "A door handle with wet paint.",
    ),
    _card(
        "trace_sound",
        "What can you hear right now besides this game?",
        "TRACE", "observation", "sound",
        "My laptop fan fighting for its life.",
        "A scooter stopping outside.",
        "Someone washing dishes upstairs.",
        "The fridge clicking on and off.",
    ),
    _card(
        "trace_wrong_place",
        "What is one object near you that is in the wrong place?",
        "TRACE", "observation", "nearby_object",
        "A spoon beside my keyboard.",
        "One shoe under the desk.",
        "A towel on the sofa.",
        "My keys inside an empty glass.",
    ),
    _card(
        "trace_last_drink",
        "What did you drink most recently?",
        "TRACE", "observation", "drink",
        "Warm water I forgot about.",
        "An aggressively sweet iced coffee.",
        "Orange juice straight from the bottle.",
        "Tea that has gone completely cold.",
    ),
    _card(
        "trace_oldest_visible",
        "What is the oldest thing you can see from where you are?",
        "TRACE", "observation", "nearby_object",
        "A scratched wooden desk from school.",
        "My grandmother's little wall clock.",
        "A paperback with yellow pages.",
        "A chipped mug from my first flat.",
    ),
    _card(
        "trace_unfinished",
        "What tiny task did you leave unfinished before joining?",
        "TRACE", "observation", "unfinished",
        "I left one plate in the sink.",
        "A message is still sitting unsent.",
        "I never folded the last shirt.",
        "The kettle is full but still cold.",
    ),
    _card(
        "trace_within_reach",
        "What is within reach that you use every day?",
        "TRACE", "observation", "nearby_object",
        "A pen with almost no ink.",
        "My cracked phone charger.",
        "A water bottle covered in stickers.",
        "A tiny notebook I rarely finish.",
    ),
    _card(
        "trace_last_door",
        "What was the last door you opened?",
        "TRACE", "observation", "door",
        "The fridge, looking for nothing.",
        "My bedroom door with my elbow.",
        "The cupboard under the sink.",
        "The front door for a delivery.",
    ),

    # TELL — harmless flaws and quirks that create affection and personality.
    _card(
        "tell_small_lie",
        "What harmless lie did you tell most recently?",
        "TELL", "confession", "lie",
        "I said I was already on my way.",
        "I called leftovers a proper dinner.",
        "I said I had not seen the message.",
        "I claimed the train was late.",
    ),
    _card(
        "tell_app",
        "What app do you open without meaning to?",
        "TELL", "confession", "phone",
        "Maps, even when I know the route.",
        "The weather app every ten minutes.",
        "My notes, then I forget why.",
        "Instagram before I even notice.",
    ),
    _card(
        "tell_chore",
        "What chore do you postpone until it becomes a problem?",
        "TELL", "confession", "procrastination",
        "Laundry, until socks become currency.",
        "Taking out all the cardboard.",
        "Changing the bed sheets.",
        "Answering anything marked important.",
    ),
    _card(
        "tell_food",
        "What food do you eat in a way other people judge?",
        "TELL", "confession", "food",
        "I peel croissants layer by layer.",
        "Fries dipped in vanilla ice cream.",
        "I eat pizza crust first.",
        "Cereal with barely any milk.",
    ),
    _card(
        "tell_notice",
        "What do you pretend not to care about but always notice?",
        "TELL", "confession", "notice",
        "Whether someone replies with a full stop.",
        "Crooked picture frames.",
        "Who gets thanked in a group.",
        "When someone changes their perfume.",
    ),
    _card(
        "tell_screenshot",
        "What useless screenshot have you kept for too long?",
        "TELL", "confession", "screenshot",
        "A weather forecast from last summer.",
        "A typo in a restaurant menu.",
        "Directions to a place that closed.",
        "A meme nobody else found funny.",
    ),
    _card(
        "tell_purchase",
        "What tiny purchase do you keep defending?",
        "TELL", "confession", "purchase",
        "A ridiculously small desk vacuum.",
        "An expensive pen with cheap ink.",
        "A lamp shaped like a mushroom.",
        "Socks printed with tiny lemons.",
    ),
    _card(
        "tell_tomorrow",
        "What do you always say you will do tomorrow?",
        "TELL", "confession", "procrastination",
        "Sort the photos on my phone.",
        "Go to bed before midnight.",
        "Cancel one useless subscription.",
        "Finally clean behind the sofa.",
    ),

    # FRICTION — small social choices that expose instinct and values.
    _card(
        "friction_can_we_talk",
        "A message says “Can we talk?” What is your first assumption?",
        "FRICTION", "scenario", "message",
        "I have forgotten something important.",
        "They are about to cancel a plan.",
        "I reread my last three messages.",
        "It is bad news, never good news.",
    ),
    _card(
        "friction_late_friend",
        "A friend is fifteen minutes late. What do you do first?",
        "FRICTION", "scenario", "lateness",
        "Order without them and send a photo.",
        "Check whether I got the place wrong.",
        "Walk around instead of waiting still.",
        "Text one question mark, nothing else.",
    ),
    _card(
        "friction_wrong_meal",
        "Your meal arrives wrong but tastes good. What exactly do you do?",
        "FRICTION", "scenario", "restaurant",
        "Eat it and mention nothing.",
        "Keep it, but check the bill.",
        "Tell them after I finish it.",
        "Offer one bite to whoever ordered it.",
    ),
    _card(
        "friction_wrong_name",
        "A stranger calls you the wrong name. How do you correct them?",
        "FRICTION", "scenario", "name",
        "I answer once, then quietly correct them.",
        "I let it happen until it gets awkward.",
        "I repeat my name like they misheard.",
        "I blame the room for being loud.",
    ),
    _card(
        "friction_found_cash",
        "You find cash on an empty seat. What is your first move?",
        "FRICTION", "scenario", "lost_cash",
        "Look around for someone searching.",
        "Hand it to whoever runs the place.",
        "Leave it there for one minute.",
        "Ask nearby people without naming the amount.",
    ),
    _card(
        "friction_queue",
        "Someone cuts ahead of you in a queue. What do you say?",
        "FRICTION", "scenario", "queue",
        "Sorry, the line starts back there.",
        "I say nothing and stare too hard.",
        "I ask if they are joining someone.",
        "I let the person behind me speak first.",
    ),
    _card(
        "friction_bad_gift",
        "You receive a gift you dislike. What does your face do?",
        "FRICTION", "scenario", "gift",
        "My eyebrows celebrate before I do.",
        "I inspect it to buy time.",
        "I smile and immediately read the label.",
        "My face asks what it is.",
    ),
    _card(
        "friction_battery",
        "Your battery hits one percent. What do you use it for?",
        "FRICTION", "scenario", "battery",
        "Send my location to one person.",
        "Screenshot the route home.",
        "Change the music, obviously.",
        "Text that my phone is dying.",
    ),

    # ECHO — one odd lived detail under a little more pressure.
    _card(
        "echo_small_accident",
        "What small accident became a story people still tell about you?",
        "ECHO", "memory", "accident",
        "I walked into a glass door at lunch.",
        "I dropped a cake before the candles.",
        "I locked myself onto a balcony.",
        "I flooded a kitchen making pasta.",
    ),
    _card(
        "echo_compliment",
        "What compliment do you remember because it was oddly specific?",
        "ECHO", "memory", "compliment",
        "Someone said I choose excellent oranges.",
        "A teacher liked how I stapled papers.",
        "I was told my sneezes sound polite.",
        "A stranger admired my calm handwriting.",
    ),
    _card(
        "echo_broke",
        "What did you break and hope nobody would notice?",
        "ECHO", "memory", "object_mishap",
        "A mug handle I carefully balanced back.",
        "The tiny lock on a bathroom window.",
        "One slat under a guest bed.",
        "A remote button I pushed back in.",
    ),
    _card(
        "echo_minor_rule",
        "What minor rule did you learn only after breaking it?",
        "ECHO", "memory", "rule",
        "Museum benches are sometimes exhibits.",
        "That café does not let you move tables.",
        "You cannot photograph that old ceiling.",
        "The quiet carriage is genuinely quiet.",
    ),
    _card(
        "echo_rehearsed",
        "What conversation did you rehearse and then never have?",
        "ECHO", "memory", "conversation",
        "Asking a neighbour to turn music down.",
        "Quitting a job I ended up keeping.",
        "Returning a very bad haircut.",
        "Admitting I lost someone’s book.",
    ),
    _card(
        "echo_lost_item",
        "What item did you lose and find somewhere ridiculous?",
        "ECHO", "memory", "object_mishap",
        "My keys were inside the fridge.",
        "A sock was in my backpack pocket.",
        "My phone was under the cat.",
        "My glasses were in the bread drawer.",
    ),
    _card(
        "echo_misunderstanding",
        "What tiny misunderstanding lasted much longer than it should have?",
        "ECHO", "memory", "misunderstanding",
        "We both waited at different cafés.",
        "They thought my nickname was official.",
        "I kept feeding the wrong neighbour's cat.",
        "Everyone thought I hated birthdays.",
    ),
    _card(
        "echo_smell",
        "What ordinary smell takes you back to one exact place?",
        "ECHO", "memory", "smell",
        "Warm dust smells like my school library.",
        "Diesel takes me to a ferry deck.",
        "Cut grass means my grandparents' garden.",
        "Bleach takes me to the public pool.",
    ),

    # ALIBI — an ordinary truth that has to survive suspicion.
    _card(
        "alibi_fabricated",
        "What true detail from today sounds completely fabricated?",
        "ALIBI", "alibi", "odd_truth",
        "A pigeon stole half my breakfast.",
        "I found a lemon in my coat.",
        "Two strangers wore my exact shirt.",
        "My lift stopped on every empty floor.",
    ),
    _card(
        "alibi_unimpressive",
        "What is the least impressive true thing about your day?",
        "ALIBI", "alibi", "ordinary_day",
        "I matched three socks correctly.",
        "I remembered to charge my headphones.",
        "I opened a letter immediately.",
        "I drank water before coffee.",
    ),
    _card(
        "alibi_tiny_mistake",
        "What tiny mistake did you make before anyone noticed?",
        "ALIBI", "alibi", "autopilot_mistake",
        "I sent a message to myself.",
        "I wore my shirt inside out.",
        "I salted coffee instead of eggs.",
        "I confidently entered the wrong shop.",
    ),
    _card(
        "alibi_autopilot",
        "What did you do on autopilot and only notice afterward?",
        "ALIBI", "alibi", "autopilot_mistake",
        "I put my phone in the cutlery drawer.",
        "I walked toward my old address.",
        "I made coffee without a mug.",
        "I locked a door I was still using.",
    ),
    _card(
        "alibi_hard_to_invent",
        "What ordinary detail from today would be hardest to invent?",
        "ALIBI", "alibi", "odd_truth",
        "A receipt stuck to my wet shoe.",
        "One elevator button had blue tape.",
        "My apple had exactly one soft side.",
        "The bus smelled faintly of toast.",
    ),
    _card(
        "alibi_generic_fact",
        "What true fact about you sounds suspiciously generic?",
        "ALIBI", "alibi", "generic_truth",
        "I genuinely enjoy long walks.",
        "Coffee is my whole morning personality.",
        "I have a playlist for everything.",
        "I always forget people's birthdays.",
    ),
    _card(
        "alibi_suspicious",
        "Complete this honestly: “I probably look suspicious because…”",
        "ALIBI", "alibi", "self_read",
        "I pause before very easy questions.",
        "My true stories sound rehearsed.",
        "I keep answers annoyingly short.",
        "I smile when I am nervous.",
    ),
    _card(
        "alibi_rephrase",
        "Which earlier answer would you phrase differently now?",
        "ALIBI", "alibi", "continuity",
        "My first answer, I made it sound too neat.",
        "The shortest one, I left out the odd detail.",
        "My last answer, I rushed the wording.",
        "None, changing one would look worse.",
    ),
)


FRENCH_QUESTION_COPY: dict[str, LocalizedQuestion] = {
    # TRACE
    "trace_last_touch": LocalizedQuestion(
        "Quelle est la dernière chose que tu as touchée avant de rejoindre la partie ?",
        (
            "Le bord froid de ma tasse de café.",
            "Mon chargeur de téléphone, encore tout emmêlé.",
            "Le dossier de cette chaise.",
            "Une poignée de porte avec de la peinture fraîche.",
        ),
    ),
    "trace_sound": LocalizedQuestion(
        "Qu’est-ce que tu entends en ce moment, à part le jeu ?",
        (
            "Le ventilateur de mon ordi qui lutte pour survivre.",
            "Un scooter qui s’arrête dans la rue.",
            "Quelqu’un qui fait la vaisselle à l’étage.",
            "Le frigo qui se déclenche puis s’arrête.",
        ),
    ),
    "trace_wrong_place": LocalizedQuestion(
        "Quel objet près de toi n’est vraiment pas à sa place ?",
        (
            "Une cuillère à côté de mon clavier.",
            "Une chaussure sous le bureau.",
            "Une serviette sur le canapé.",
            "Mes clés dans un verre vide.",
        ),
    ),
    "trace_last_drink": LocalizedQuestion(
        "Qu’est-ce que tu as bu en dernier ?",
        (
            "De l’eau tiède que j’avais oubliée.",
            "Un café glacé beaucoup trop sucré.",
            "Du jus d’orange à même la bouteille.",
            "Un thé devenu complètement froid.",
        ),
    ),
    "trace_oldest_visible": LocalizedQuestion(
        "Quel est l’objet le plus ancien que tu vois d’ici ?",
        (
            "Un bureau en bois rayé qui date du collège.",
            "Une petite horloge murale héritée de ma famille.",
            "Un livre de poche aux pages jaunies.",
            "Une tasse ébréchée de mon premier appart.",
        ),
    ),
    "trace_unfinished": LocalizedQuestion(
        "Quelle petite tâche as-tu laissée en plan avant de venir ?",
        (
            "J’ai laissé une assiette dans l’évier.",
            "Un message reste encore dans mes brouillons.",
            "Il reste un vêtement à plier.",
            "La bouilloire est pleine mais toujours froide.",
        ),
    ),
    "trace_within_reach": LocalizedQuestion(
        "Qu’as-tu à portée de main que tu utilises tous les jours ?",
        (
            "Un stylo qui n’a presque plus d’encre.",
            "Mon câble de charge complètement abîmé.",
            "Une gourde couverte d’autocollants.",
            "Un petit carnet que je ne termine jamais.",
        ),
    ),
    "trace_last_door": LocalizedQuestion(
        "Quelle est la dernière porte que tu as ouverte ?",
        (
            "Le frigo, sans vraiment chercher quelque chose.",
            "La porte de ma chambre avec le coude.",
            "Le placard sous l’évier.",
            "La porte d’entrée pour une livraison.",
        ),
    ),

    # TELL
    "tell_small_lie": LocalizedQuestion(
        "Quel petit mensonge sans conséquence as-tu raconté récemment ?",
        (
            "J’ai dit que j’étais déjà en route.",
            "J’ai présenté des restes comme un vrai dîner.",
            "J’ai dit que je n’avais pas vu le message.",
            "J’ai prétendu que le train était en retard.",
        ),
    ),
    "tell_app": LocalizedQuestion(
        "Quelle appli ouvres-tu sans même t’en rendre compte ?",
        (
            "Plans, même quand je connais le chemin.",
            "La météo, toutes les dix minutes.",
            "Mes notes, puis j’oublie pourquoi.",
            "Instagram avant même de m’en rendre compte.",
        ),
    ),
    "tell_chore": LocalizedQuestion(
        "Quelle corvée repousses-tu jusqu’à ce que ça devienne un problème ?",
        (
            "La lessive, jusqu’à manquer de chaussettes.",
            "Descendre toute la pile de cartons.",
            "Changer les draps du lit.",
            "Répondre à tout ce qui est marqué urgent.",
        ),
    ),
    "tell_food": LocalizedQuestion(
        "Quel aliment manges-tu d’une façon que les autres jugent ?",
        (
            "J’effeuille les croissants couche par couche.",
            "Je trempe mes frites dans une glace à la vanille.",
            "Je mange d’abord la croûte de la pizza.",
            "Mes céréales avec presque pas de lait.",
        ),
    ),
    "tell_notice": LocalizedQuestion(
        "De quoi fais-tu semblant de te moquer, mais que tu remarques toujours ?",
        (
            "Quand quelqu’un termine son message par un point.",
            "Les cadres légèrement de travers.",
            "Qui est remercié dans un groupe.",
            "Quand quelqu’un change de parfum.",
        ),
    ),
    "tell_screenshot": LocalizedQuestion(
        "Quelle capture d’écran inutile gardes-tu depuis bien trop longtemps ?",
        (
            "La météo d’un jour de l’été dernier.",
            "Une faute sur le menu d’un restaurant.",
            "L’itinéraire vers un endroit qui a fermé.",
            "Un mème que personne d’autre n’a trouvé drôle.",
        ),
    ),
    "tell_purchase": LocalizedQuestion(
        "Quel petit achat continues-tu de défendre envers et contre tout ?",
        (
            "Un aspirateur de bureau ridiculement petit.",
            "Un stylo cher avec une encre médiocre.",
            "Une lampe en forme de champignon.",
            "Des chaussettes couvertes de petits citrons.",
        ),
    ),
    "tell_tomorrow": LocalizedQuestion(
        "Qu’est-ce que tu promets toujours de faire demain ?",
        (
            "Trier les photos de mon téléphone.",
            "Me coucher avant minuit.",
            "Résilier un abonnement inutile.",
            "Enfin nettoyer derrière le canapé.",
        ),
    ),

    # FRICTION
    "friction_can_we_talk": LocalizedQuestion(
        "Tu reçois « On peut parler ? ». Quelle est ta première pensée ?",
        (
            "J’ai forcément oublié quelque chose d’important.",
            "On va annuler quelque chose au dernier moment.",
            "Je relis mes trois derniers messages.",
            "C’est une mauvaise nouvelle, jamais une bonne.",
        ),
    ),
    "friction_late_friend": LocalizedQuestion(
        "Un ami a quinze minutes de retard. Que fais-tu en premier ?",
        (
            "Je commande sans lui et j’envoie une photo.",
            "Je vérifie d’abord l’adresse.",
            "Je marche un peu au lieu d’attendre sur place.",
            "J’envoie juste un point d’interrogation.",
        ),
    ),
    "friction_wrong_meal": LocalizedQuestion(
        "On t’apporte le mauvais plat, mais il est bon. Que fais-tu exactement ?",
        (
            "Je le mange sans rien dire.",
            "Je le garde, mais je vérifie l’addition.",
            "Je le signale après l’avoir terminé.",
            "J’en propose une bouchée à la personne qui avait commandé ce plat.",
        ),
    ),
    "friction_wrong_name": LocalizedQuestion(
        "Un inconnu t’appelle par le mauvais prénom. Comment le corriges-tu ?",
        (
            "Je réponds une fois, puis je le corrige discrètement.",
            "Je laisse passer jusqu’à ce que ça devienne gênant.",
            "Je répète mon prénom comme s’il avait mal entendu.",
            "Je mets ça sur le compte du bruit.",
        ),
    ),
    "friction_found_cash": LocalizedQuestion(
        "Tu trouves de l’argent sur un siège vide. Quel est ton premier réflexe ?",
        (
            "Je regarde si quelqu’un semble chercher quelque chose.",
            "Je le donne à la personne qui gère l’endroit.",
            "Je le laisse là pendant une minute.",
            "Je demande autour de moi sans annoncer la somme.",
        ),
    ),
    "friction_queue": LocalizedQuestion(
        "Quelqu’un te passe devant dans une file. Que lui dis-tu ?",
        (
            "Pardon, la file commence derrière.",
            "Je ne dis rien, mais mon regard insiste beaucoup trop.",
            "Je demande si la personne rejoint quelqu’un.",
            "J’attends que la personne derrière moi réagisse.",
        ),
    ),
    "friction_bad_gift": LocalizedQuestion(
        "On t’offre un cadeau que tu n’aimes pas. Que fait ton visage ?",
        (
            "Mes sourcils ont l’air plus ravis que moi.",
            "Je l’examine pour gagner du temps.",
            "Je souris et je lis aussitôt l’étiquette.",
            "Mon visage demande clairement ce que c’est.",
        ),
    ),
    "friction_battery": LocalizedQuestion(
        "Il te reste un pour cent de batterie. À quoi va-t-il servir ?",
        (
            "J’envoie ma position à une personne.",
            "Je fais une capture du trajet pour rentrer.",
            "Je change la musique, évidemment.",
            "J’écris que mon téléphone va s’éteindre.",
        ),
    ),

    # ECHO
    "echo_small_accident": LocalizedQuestion(
        "Quel petit accident est devenu une histoire qu’on raconte encore sur toi ?",
        (
            "J’ai foncé dans une porte vitrée à midi.",
            "J’ai fait tomber un gâteau avant les bougies.",
            "La porte du balcon s’est refermée derrière moi.",
            "J’ai inondé une cuisine en faisant des pâtes.",
        ),
    ),
    "echo_compliment": LocalizedQuestion(
        "Quel compliment te reste en tête parce qu’il était étrangement précis ?",
        (
            "On m’a dit que je choisissais très bien les oranges.",
            "Un prof aimait ma façon d’agrafer les feuilles.",
            "On m’a dit que mes éternuements semblaient polis.",
            "Un inconnu a admiré mon écriture très posée.",
        ),
    ),
    "echo_broke": LocalizedQuestion(
        "Qu’as-tu cassé en espérant que personne ne le remarque ?",
        (
            "L’anse d’une tasse que j’ai remise en équilibre.",
            "Le petit verrou d’une fenêtre de salle de bain.",
            "Une latte du lit dans la chambre d’amis.",
            "Un bouton de télécommande que j’ai remis en place.",
        ),
    ),
    "echo_minor_rule": LocalizedQuestion(
        "Quelle petite règle as-tu découverte seulement après l’avoir enfreinte ?",
        (
            "Les bancs d’un musée sont parfois des œuvres.",
            "Ce café interdit de déplacer les tables.",
            "On ne peut pas photographier ce vieux plafond.",
            "Le wagon silencieux est vraiment silencieux.",
        ),
    ),
    "echo_rehearsed": LocalizedQuestion(
        "Quelle conversation as-tu préparée dans ta tête sans jamais l’avoir ?",
        (
            "Demander à un voisin de baisser la musique.",
            "Quitter un travail que j’ai finalement gardé.",
            "Retourner chez le coiffeur après une très mauvaise coupe.",
            "Avouer que j’avais perdu le livre de quelqu’un.",
        ),
    ),
    "echo_lost_item": LocalizedQuestion(
        "Quel objet as-tu perdu avant de le retrouver dans un endroit ridicule ?",
        (
            "Mes clés étaient dans le frigo.",
            "Une chaussette était dans une poche de mon sac.",
            "Mon téléphone était sous le chat.",
            "Mes lunettes étaient dans le tiroir à pain.",
        ),
    ),
    "echo_misunderstanding": LocalizedQuestion(
        "Quel petit malentendu a duré beaucoup trop longtemps ?",
        (
            "On attendait dans deux cafés différents.",
            "On croyait que mon surnom était officiel.",
            "Je nourrissais le chat du mauvais voisin.",
            "Tout le monde pensait que je détestais les anniversaires.",
        ),
    ),
    "echo_smell": LocalizedQuestion(
        "Quelle odeur banale te ramène à un endroit très précis ?",
        (
            "La poussière chaude me ramène à la bibliothèque du collège.",
            "Le diesel me ramène sur le pont d’un ferry.",
            "L’herbe coupée me ramène au jardin familial.",
            "La javel me ramène à la piscine municipale.",
        ),
    ),

    # ALIBI
    "alibi_fabricated": LocalizedQuestion(
        "Quel détail vrai de ta journée semble complètement inventé ?",
        (
            "Un pigeon a volé la moitié de mon petit déjeuner.",
            "J’ai trouvé un citron dans mon manteau.",
            "Deux inconnus portaient exactement ma chemise.",
            "Mon ascenseur s’est arrêté à chaque étage vide.",
        ),
    ),
    "alibi_unimpressive": LocalizedQuestion(
        "Quelle est la chose vraie la moins impressionnante de ta journée ?",
        (
            "J’ai réussi à assortir trois chaussettes.",
            "J’ai pensé à charger mon casque.",
            "J’ai ouvert une lettre tout de suite.",
            "J’ai bu de l’eau avant mon café.",
        ),
    ),
    "alibi_tiny_mistake": LocalizedQuestion(
        "Quelle petite erreur as-tu faite avant que quelqu’un la remarque ?",
        (
            "J’ai envoyé un message à mon propre numéro.",
            "J’ai porté mon haut à l’envers.",
            "J’ai salé mon café au lieu des œufs.",
            "J’ai franchi avec assurance la porte du mauvais magasin.",
        ),
    ),
    "alibi_autopilot": LocalizedQuestion(
        "Qu’as-tu fait machinalement avant de t’en rendre compte ?",
        (
            "J’ai rangé mon téléphone avec les couverts.",
            "J’ai marché vers mon ancienne adresse.",
            "J’ai préparé du café sans mettre de tasse.",
            "J’ai fermé à clé une porte que j’utilisais encore.",
        ),
    ),
    "alibi_hard_to_invent": LocalizedQuestion(
        "Quel détail banal de ta journée serait le plus difficile à inventer ?",
        (
            "Un ticket de caisse collé à ma chaussure mouillée.",
            "Un bouton d’ascenseur couvert de ruban bleu.",
            "Ma pomme avait exactement un côté mou.",
            "Le bus sentait légèrement le pain grillé.",
        ),
    ),
    "alibi_generic_fact": LocalizedQuestion(
        "Quelle vérité sur toi semble étrangement générique ?",
        (
            "J’aime sincèrement les longues promenades.",
            "Le café résume toute ma personnalité du matin.",
            "J’ai une playlist pour absolument tout.",
            "J’oublie toujours les anniversaires.",
        ),
    ),
    "alibi_suspicious": LocalizedQuestion(
        "Complète honnêtement : « J’ai probablement l’air suspect parce que… »",
        (
            "Je marque une pause avant les questions très faciles.",
            "Mes histoires vraies ont l’air répétées à l’avance.",
            "Je réponds toujours de façon agaçante et brève.",
            "Le stress me fait sourire.",
        ),
    ),
    "alibi_rephrase": LocalizedQuestion(
        "Quelle réponse précédente reformulerais-tu maintenant ?",
        (
            "La première, elle sonnait beaucoup trop bien préparée.",
            "La plus courte, j’ai oublié le détail étrange.",
            "La dernière, j’ai choisi mes mots trop vite.",
            "Aucune, en changer une paraîtrait encore pire.",
        ),
    ),
}

_BY_ID = {card.id: card for card in QUESTIONS}
_BY_PROMPT = {card.prompt: card for card in QUESTIONS}
_BY_FRENCH_PROMPT = {
    copy.prompt: _BY_ID[card_id]
    for card_id, copy in FRENCH_QUESTION_COPY.items()
    if card_id in _BY_ID
}


def normalize_locale(locale: str | None = None) -> str:
    """Reduce a browser locale to French or the canonical English fallback."""
    base = str(locale or "").strip().lower().replace("_", "-").partition("-")[0]
    return base if base in SUPPORTED_LOCALES else DEFAULT_LOCALE


def localize_question(
    card_or_id: QuestionCard | str,
    locale: str | None = None,
) -> LocalizedQuestion:
    """Return localized copy while keeping card IDs and English text canonical."""
    card = (
        card_or_id
        if isinstance(card_or_id, QuestionCard)
        else _BY_ID.get(card_or_id)
        or _BY_PROMPT.get(card_or_id)
        or _BY_FRENCH_PROMPT.get(card_or_id)
    )
    if card is None:
        raise KeyError(f"Unknown question card: {card_or_id}")
    if normalize_locale(locale) == "fr":
        return FRENCH_QUESTION_COPY[card.id]
    return LocalizedQuestion(card.prompt, card.mock_answers)


def act_for_round(round_no: int, total_rounds: int) -> str:
    """Return a dramatic act compressed to the room's playable round count."""
    total = max(1, int(total_rounds))
    current = min(max(1, int(round_no)), total)
    schedules = {
        1: (0,),
        2: (0, 4),
        3: (0, 2, 4),
        4: (0, 1, 3, 4),
        5: (0, 1, 2, 3, 4),
    }
    if total <= len(ACTS):
        return ACTS[schedules[total][current - 1]]
    position = round((current - 1) * (len(ACTS) - 1) / (total - 1))
    return ACTS[position]


def pick_question(
    exclude: set[str] | None = None,
    *,
    round_no: int = 1,
    total_rounds: int = 5,
) -> QuestionCard:
    """Pick a stage-safe card without repeating its prompt or semantic family."""
    excluded = exclude or set()
    act = act_for_round(round_no, total_rounds)
    used_cards = {
        card
        for key in excluded
        if (card := _BY_ID.get(key) or _BY_PROMPT.get(key)) is not None
    }
    used_families = {card.similarity_key for card in used_cards}
    act_cards = [card for card in QUESTIONS if card.act == act]
    pool = [
        card
        for card in act_cards
        if card.id not in excluded
        and card.prompt not in excluded
        and card.similarity_key not in used_families
    ]
    if not pool:
        pool = [
            card
            for card in act_cards
            if card.id not in excluded and card.prompt not in excluded
        ]
    return random.choice(pool or act_cards)


def mock_answers_for(
    prompt_or_id: str,
    locale: str | None = None,
) -> tuple[str, ...]:
    """Return localized demo answers for a card ID or known localized prompt."""
    card = _BY_ID.get(prompt_or_id) or _BY_PROMPT.get(prompt_or_id)
    inferred_locale = None
    if card is None:
        card = _BY_FRENCH_PROMPT.get(prompt_or_id)
        if card is not None:
            inferred_locale = "fr"
    if card is None:
        return ()
    selected_locale = locale if locale is not None else inferred_locale
    return card.mock_answers_for(selected_locale)
