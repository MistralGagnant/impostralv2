import React from 'react';
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {slide} from '@remotion/transitions/slide';
import {fade} from '@remotion/transitions/fade';
import {Problem, PROBLEM_DURATION} from './pitch/Problem';
import {Solution, SOLUTION_DURATION} from './pitch/Solution';
import {DemoBlock, DEMOBLOCK_DURATION} from './pitch/DemoBlock';
import {Agents, AGENTS_DURATION} from './pitch/Agents';
import {Impact, IMPACT_DURATION} from './pitch/Impact';
import {Closing, CLOSING_DURATION} from './pitch/Closing';

// la version pitch complete ~4min50 : probleme, solution, demo integrale, tech, business, closing
const T = 10;

export const PITCH_DURATION =
  PROBLEM_DURATION +
  SOLUTION_DURATION +
  DEMOBLOCK_DURATION +
  AGENTS_DURATION +
  IMPACT_DURATION +
  CLOSING_DURATION -
  5 * T;

const timing = linearTiming({durationInFrames: T});

export const Pitch: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={PROBLEM_DURATION}>
        <Problem />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({direction: 'from-right'})} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={SOLUTION_DURATION}>
        <Solution />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={DEMOBLOCK_DURATION}>
        <DemoBlock />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({direction: 'from-bottom'})} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={AGENTS_DURATION}>
        <Agents />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({direction: 'from-right'})} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={IMPACT_DURATION}>
        <Impact />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={CLOSING_DURATION}>
        <Closing />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
