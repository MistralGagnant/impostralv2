import React from 'react';
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {slide} from '@remotion/transitions/slide';
import {fade} from '@remotion/transitions/fade';
import {Title} from './scenes/Title';
import {Lobby} from './scenes/Lobby';
import {Speaking} from './scenes/Speaking';
import {Interrogation} from './scenes/Interrogation';
import {Vote} from './scenes/Vote';
import {Elimination} from './scenes/Elimination';
import {Reveal} from './scenes/Reveal';

// ~36s total, rythme nerveux, une idee par scene
export const DURATIONS = {
  title: 125,
  lobby: 110,
  speaking: 150,
  interrogation: 130,
  vote: 135,
  elimination: 130,
  reveal: 320,
};

const T = 10; // les transitions grignotent autant sur chaque scene

export const TOTAL_DURATION = Object.values(DURATIONS).reduce((a, b) => a + b, 0) - 6 * T;

const timing = linearTiming({durationInFrames: T});

export const Video: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={DURATIONS.title}>
        <Title />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({direction: 'from-right'})} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={DURATIONS.lobby}>
        <Lobby />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={DURATIONS.speaking}>
        <Speaking />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({direction: 'from-bottom'})} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={DURATIONS.interrogation}>
        <Interrogation />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({direction: 'from-right'})} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={DURATIONS.vote}>
        <Vote />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={DURATIONS.elimination}>
        <Elimination />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={DURATIONS.reveal}>
        <Reveal />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
