import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Backdrop} from '../components/Backdrop';
import {PlayerCard} from '../components/PlayerCard';
import {theme, fonts, PLAYERS} from '../theme';

// lobby : les 6 cartes claquent une par une, aucun moyen de savoir qui est quoi
export const Lobby: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const headerIn = spring({frame, fps, config: {damping: 13}});

  return (
    <Backdrop glow={0.4}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 44}}>
        <div
          style={{
            fontFamily: fonts.pixel,
            fontSize: 40,
            color: theme.ink,
            letterSpacing: 4,
            opacity: headerIn,
            transform: `translateY(${interpolate(headerIn, [0, 1], [-40, 0])}px)`,
          }}
        >
          LOBBY <span style={{color: theme.orange}}>// 6 / 6 PLAYERS</span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, auto)',
            gap: 34,
          }}
        >
          {PLAYERS.map((p, i) => {
            const cardIn = spring({
              frame: frame - 8 - i * 6,
              fps,
              config: {damping: 12, stiffness: 180},
            });
            return (
              <div
                key={p.name}
                style={{
                  transform: `scale(${interpolate(cardIn, [0, 1], [0, 1])}) rotate(${interpolate(
                    cardIn,
                    [0, 1],
                    [i % 2 ? 8 : -8, 0],
                  )}deg)`,
                  opacity: cardIn,
                }}
              >
                <PlayerCard name={p.name} avatar={p.avatar} seed={i} glitch />
              </div>
            );
          })}
        </div>

        <div
          style={{
            fontFamily: fonts.term,
            fontSize: 36,
            color: theme.dim,
            letterSpacing: 3,
            opacity: interpolate(frame, [64, 76], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
          }}
        >
          2 HUMANS. 4 AI AGENTS. NOBODY KNOWS WHO IS WHO.
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};
