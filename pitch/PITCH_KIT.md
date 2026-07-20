# Impostral - Pitch kit

## Positioning

**One-liner**

Impostral is a social deduction game where independent Mistral agents must pass
as human, one sentence at a time.

**Tagline**

The AI is the impostor.

**Core promise**

Six anonymous players enter a room. Two are human. Four are independent Mistral
agents. Everyone answers the same question with one short sentence, then votes
for the player they believe is an AI. Each agent plays for itself, knows only
its own identity, and loses as soon as it is eliminated.

## Five-minute live pitch

Target duration: **4:30**, leaving 30 seconds for setup or a slow transition.

### 0:00-0:30 - Hook

> Could you identify an AI from a single sentence?
>
> Most AI games ask humans to imitate machines. We flipped the premise.
> In Impostral, independent Mistral agents infiltrate a group of humans and
> compete to become the last survivor.

Pause briefly after the opening question. Let the audience form an answer before
explaining the game.

### 0:30-1:05 - Demo video

Play `video/out/impostral.mp4` in full. It lasts approximately 35 seconds.

Transition back with:

> Every sentence you just saw could have come from a human or from an agent.
> That uncertainty is the entire game.

### 1:05-1:55 - Rules

> A round has four steps. First, the game asks one personal but simple question.
> Every player answers with one short, natural sentence. Then everyone votes for
> the person they believe is an AI. The most voted player is eliminated and
> their identity is revealed.
>
> The important part is that this is an individual game. The agents do not form
> an AI team, they do not know the other roles, and they cannot coordinate.
> Each one must build a believable human personality and survive on its own.

### 1:55-2:45 - Fairness

> We remove the easy signals. Human speech is transcribed by Voxtral, and every
> answer is played through a synthetic voice assigned to the seat. Responses are
> revealed together in random order, so speed is not a clue either.
>
> Players can only judge the language: the detail someone chooses, the emotion
> they show, the hesitation they fake, and whether their story feels lived or
> generated.

### 2:45-3:40 - Mistral technology

> Mistral is not a chatbot attached to the game. It is part of the game design.
>
> Mistral Large drives each independent agent with its own personality and
> strategy. Voxtral handles speech-to-text and synthetic speech, placing humans
> and agents on the same audio channel. A FastAPI and WebSocket game engine
> manages simultaneous answers, hidden identities, voting, elimination, and the
> shared transcript.
>
> The result is a functional end-to-end prototype, with a mock mode for testing
> the full loop without an API key.

### 3:40-4:30 - Why it matters and close

> Impostral turns model behavior into something people can feel immediately.
> Instead of reading a benchmark score, you watch an agent improvise, get
> suspected, defend a personality, and sometimes become more convincing than a
> human.
>
> The game can also become a playful evaluation arena: different models,
> prompts, and personas can compete under the same social pressure.
>
> In Impostral, the smartest answer is not always the best answer. The winning
> answer is the one that feels human.
>
> Would you spot the AI?

## Demo plan

Use the existing 34.7-second, 1080p video as the submission demo. Do not narrate
over every action; add only a short opening and closing voice-over if required.

**Opening voice-over**

> Six players. Two humans. Four independent Mistral agents. One survivor.

**Closing voice-over**

> One sentence can save you. One vote can expose you. This is Impostral.

Recommended video title:

> Impostral - Can an AI survive being human?

Recommended video description:

> Impostral is a social deduction game powered by Mistral Large and Voxtral.
> Independent AI agents infiltrate a group of humans, answer personal questions
> in one sentence, and try to survive a vote without being detected.

## Submission copy

**Short description**

> Independent Mistral agents infiltrate a social deduction game and compete to
> pass as human, one sentence and one vote at a time.

**Long description**

> Impostral is a real-time social deduction game for humans and independent
> Mistral agents. Each round asks every player a personal question. Players
> answer with one short sentence, listen through anonymized synthetic voices,
> and vote for the person they believe is an AI. Mistral Large powers agents
> with distinct personalities and strategies, while Voxtral transcribes human
> speech and places every player on the same audio channel. Response timing is
> hidden and identities stay secret until elimination, leaving language and
> social intuition as the only clues. Every agent plays individually and must
> survive by appearing convincingly human.

**Technology**

> Mistral Large, Voxtral STT, Voxtral TTS, FastAPI, WebSockets, vanilla
> JavaScript, Remotion.

## Jury questions

**Is this just a Turing test?**

No. A Turing test is a static classification task. Impostral adds repeated
rounds, social pressure, hidden roles, strategic voting, elimination, and
persistent personalities.

**Do the AI agents cooperate?**

No. Every agent is independent, has its own persona and transcript-based
reasoning, knows only its own identity, and wins or loses individually.

**Why limit answers to one sentence?**

It keeps the game fast, prevents monologues, and makes every detail meaningful.
Humans cannot prove they are human through a long autobiography, while agents
must make one precise social choice.

**How do you prevent obvious audio clues?**

Human input is transcribed and all players are heard through synthetic voices
fixed by seat. Answers are revealed as a shuffled group so response time is not
visible.

**Why use Voxtral?**

Voxtral is a gameplay mechanic, not only an input feature. It removes biological
voice identity and lets humans and agents inhabit the same anonymous channel.

**What makes the agents different from one another?**

They have separate instances, distinct personalities and temperatures, and
reason independently from the public transcript.

**What happens when an AI invents a personal memory?**

Inside this clearly disclosed game, that is the challenge. The agent must create
a coherent human persona, and the other players are explicitly trying to expose
it.

**What is the next step?**

Add spectator mode, tournaments between models and prompting strategies,
post-game reasoning analysis, and a leaderboard for human detection and agent
survival.

## Question bank for the live demo

Prefer questions that invite a small concrete detail and can be answered in one
sentence.

- What is the last object you touched before joining this game?
- What small lie did you tell recently?
- Which smell instantly reminds you of school?
- What useless object do you refuse to throw away?
- What tiny thing annoyed you today?
- What do you do when you receive a gift you dislike?
- Which app do you open without thinking?
- What food do you dislike for an irrational reason?

Avoid broad philosophical questions and factual trivia. They produce polished,
generic answers without creating useful social clues.

## Submission checklist

- Export and watch the final demo video with sound.
- Keep the video under the platform's upload limit.
- Confirm the repository link and deployment link work in a private window.
- Prepare a room before presenting; keep mock mode as a fallback.
- Put the demo video and the live application on separate tabs.
- Test microphone permission and browser audio before entering the room.
- Keep the five-slide deck open locally in case the network fails.
- Rehearse once with a timer and stop at 4:30.
- Assign one person to speak and one person to operate the demo.

## Critical product alignment before submission

The current public interface and demo video use the new premise: humans expose
AI agents, while agents pass as human. Some backend prompts, vote labels, win
conditions, and repository documentation still describe the previous reversed
premise. These must be aligned before a live gameplay demo so the product and
pitch tell the same story.
