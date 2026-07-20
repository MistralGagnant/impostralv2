import React from 'react';
import {Composition} from 'remotion';
import {Video, TOTAL_DURATION, DURATIONS} from './Video';
import {Pitch, PITCH_DURATION} from './Pitch';
import {Problem, PROBLEM_DURATION} from './pitch/Problem';
import {Solution, SOLUTION_DURATION} from './pitch/Solution';
import {Agents, AGENTS_DURATION} from './pitch/Agents';
import {Impact, IMPACT_DURATION} from './pitch/Impact';
import {Closing, CLOSING_DURATION} from './pitch/Closing';
import {Suggestions, SUGGESTIONS_DURATION} from './Suggestions';
import {End, END_DURATION} from './End';
import {Diagram} from './Diagram';
import {Title} from './scenes/Title';
import {Lobby} from './scenes/Lobby';
import {Speaking} from './scenes/Speaking';
import {Interrogation} from './scenes/Interrogation';
import {Vote} from './scenes/Vote';
import {Elimination} from './scenes/Elimination';
import {Reveal} from './scenes/Reveal';
import {FPS} from './theme';

const size = {width: 1920, height: 1080, fps: FPS};

// la compo principale + chaque scene seule pour iterer vite dans le studio
export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="ImpostralDemo"
        component={Video}
        durationInFrames={TOTAL_DURATION}
        {...size}
      />
      <Composition id="End" component={End} durationInFrames={END_DURATION} {...size} />
      <Composition
        id="Diagram"
        component={Diagram}
        durationInFrames={1}
        width={2400}
        height={1700}
        fps={FPS}
      />
      <Composition
        id="Suggestions"
        component={Suggestions}
        durationInFrames={SUGGESTIONS_DURATION}
        {...size}
      />
      <Composition
        id="ImpostralPitch"
        component={Pitch}
        durationInFrames={PITCH_DURATION}
        {...size}
      />
      <Composition id="PitchProblem" component={Problem} durationInFrames={PROBLEM_DURATION} {...size} />
      <Composition id="PitchSolution" component={Solution} durationInFrames={SOLUTION_DURATION} {...size} />
      <Composition id="PitchAgents" component={Agents} durationInFrames={AGENTS_DURATION} {...size} />
      <Composition id="PitchImpact" component={Impact} durationInFrames={IMPACT_DURATION} {...size} />
      <Composition id="PitchClosing" component={Closing} durationInFrames={CLOSING_DURATION} {...size} />
      <Composition id="Title" component={Title} durationInFrames={DURATIONS.title} {...size} />
      <Composition id="Lobby" component={Lobby} durationInFrames={DURATIONS.lobby} {...size} />
      <Composition id="Speaking" component={Speaking} durationInFrames={DURATIONS.speaking} {...size} />
      <Composition
        id="Interrogation"
        component={Interrogation}
        durationInFrames={DURATIONS.interrogation}
        {...size}
      />
      <Composition id="Vote" component={Vote} durationInFrames={DURATIONS.vote} {...size} />
      <Composition
        id="Elimination"
        component={Elimination}
        durationInFrames={DURATIONS.elimination}
        {...size}
      />
      <Composition id="Reveal" component={Reveal} durationInFrames={DURATIONS.reveal} {...size} />
    </>
  );
};
