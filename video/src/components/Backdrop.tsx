import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {theme} from '../theme';

// petit prng deterministe pour placer les particules toujours pareil
const rand = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

type Props = {
  tint?: string; // couleur des particules / de la lueur
  glow?: number; // intensite de la lueur centrale 0..1
  children?: React.ReactNode;
};

// fond sombre commun : degrade radial, grille discrete, particules pixel qui montent
export const Backdrop: React.FC<Props> = ({tint = theme.orange, glow = 0.5, children}) => {
  const frame = useCurrentFrame();

  const particles = Array.from({length: 26}, (_, i) => {
    const x = rand(i) * 1920;
    const speed = 0.4 + rand(i + 50) * 1.1;
    const y = 1180 - ((frame * speed + rand(i + 100) * 1200) % 1300);
    const size = 4 + Math.floor(rand(i + 200) * 3) * 4;
    const opacity = 0.12 + rand(i + 300) * 0.4;
    return {x, y, size, opacity};
  });

  return (
    <AbsoluteFill style={{backgroundColor: theme.bg, overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 45%, ${tint}${Math.round(glow * 20)
            .toString(16)
            .padStart(2, '0')} 0%, transparent 55%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${theme.cardBorder}55 1px, transparent 1px), linear-gradient(90deg, ${theme.cardBorder}55 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
          opacity: 0.35,
        }}
      />
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            backgroundColor: tint,
            opacity: p.opacity,
          }}
        />
      ))}
      {children}
      {/* vignette + scanlines par dessus tout */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at center, transparent 55%, #000000AA 100%)',
          pointerEvents: 'none',
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: 'linear-gradient(transparent 3px, #00000030 4px)',
          backgroundSize: '100% 4px',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
