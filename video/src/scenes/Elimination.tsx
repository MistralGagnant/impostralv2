import React from 'react';
import {AbsoluteFill, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {theme, fonts, PLAYERS} from '../theme';

const rand = (seed: number) => {
  const x = Math.sin(seed * 91.7 + 47.3) * 43758.5453;
  return x - Math.floor(x);
};

const GRID = 12; // l'avatar se decoupe en 12x12 tuiles qui s'envolent
const SIZE = 340;
const DISSOLVE_START = 55;

// elimination : ecran quasi vide, l'avatar du joueur 04 se desintegre en pixels
export const Elimination: React.FC = () => {
  const frame = useCurrentFrame();
  const tile = SIZE / GRID;

  const nameIn = interpolate(frame, [8, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const elimIn = interpolate(frame, [26, 38], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{backgroundColor: '#050508', alignItems: 'center', justifyContent: 'center'}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 40%, ${theme.red}12 0%, transparent 55%)`,
        }}
      />
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 50}}>
        {/* avatar en tuiles : chacune part avec sa propre trajectoire */}
        <div style={{position: 'relative', width: SIZE, height: SIZE}}>
          {Array.from({length: GRID * GRID}, (_, i) => {
            const cx = i % GRID;
            const cy = Math.floor(i / GRID);
            // les tuiles du haut partent en premier
            const delay = DISSOLVE_START + cy * 2.2 + rand(i) * 10;
            const p = Math.max(0, (frame - delay) / 26);
            const dx = (rand(i + 500) - 0.5) * 500 * p;
            const dy = -(60 + rand(i + 900) * 320) * p + 140 * p * p;
            const o = Math.max(0, 1 - p * 1.3);
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: cx * tile,
                  top: cy * tile,
                  width: tile,
                  height: tile,
                  backgroundImage: `url(${staticFile(PLAYERS[3].avatar)})`,
                  backgroundSize: `${SIZE}px ${SIZE}px`,
                  backgroundPosition: `-${cx * tile}px -${cy * tile}px`,
                  imageRendering: 'pixelated',
                  transform: `translate(${dx}px, ${dy}px) rotate(${(rand(i + 42) - 0.5) * 200 * p}deg)`,
                  opacity: o,
                }}
              />
            );
          })}
        </div>

        <div
          style={{
            fontFamily: fonts.pixel,
            fontSize: 74,
            color: theme.ink,
            letterSpacing: 6,
            opacity: nameIn,
          }}
        >
          PLAYER 04
        </div>
        <div
          style={{
            fontFamily: fonts.pixel,
            fontSize: 40,
            color: theme.red,
            letterSpacing: 5,
            opacity: elimIn,
            textShadow: `0 0 26px ${theme.red}77`,
          }}
        >
          HAS BEEN ELIMINATED
        </div>
        <div
          style={{
            fontFamily: fonts.term,
            fontSize: 34,
            color: theme.dim,
            letterSpacing: 3,
            opacity: interpolate(frame, [90, 104], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          ROLE STAYS HIDDEN. THE GAME GOES ON.
        </div>
      </div>
    </AbsoluteFill>
  );
};
