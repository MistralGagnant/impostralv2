import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fonts, theme} from '../theme';

export type PunchLine = Array<{t: string; c?: string}>;

type Props = {
  lines: PunchLine[];
  start?: number; // frame de depart de la premiere ligne
  gap?: number; // frames entre chaque ligne
  fontSize?: number;
  out?: number; // frame ou tout disparait (optionnel)
};

// punchline plein ecran : chaque ligne claque l'une apres l'autre
export const Punch: React.FC<Props> = ({lines, start = 0, gap = 16, fontSize = 60, out}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const fade =
    out === undefined
      ? 1
      : interpolate(frame, [out - 10, out], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 44,
        opacity: fade,
      }}
    >
      {lines.map((segments, i) => {
        const s = spring({
          frame: frame - start - i * gap,
          fps,
          config: {damping: 12, stiffness: 170},
        });
        return (
          <div
            key={i}
            style={{
              fontFamily: fonts.pixel,
              fontSize,
              letterSpacing: 4,
              lineHeight: 1.6,
              textAlign: 'center',
              transform: `scale(${interpolate(s, [0, 1], [1.9, 1])})`,
              opacity: s,
            }}
          >
            {segments.map((seg, j) => (
              <span key={j} style={{color: seg.c ?? theme.ink}}>
                {seg.t}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
};
