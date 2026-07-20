import React from 'react';
import {Img, staticFile, useCurrentFrame} from 'remotion';
import {theme, fonts} from '../theme';
import {Waveform} from './Waveform';

type Props = {
  name: string;
  avatar: string;
  status?: string;
  statusColor?: string;
  speaking?: boolean;
  width?: number;
  glitch?: boolean; // micro tremblement pour donner vie aux cartes
  seed?: number;
  dimmed?: boolean;
};

// carte joueur du lobby : avatar pixel, pseudo, waveform, statut. zero indice humain/ia
export const PlayerCard: React.FC<Props> = ({
  name,
  avatar,
  status = 'READY',
  statusColor = theme.green,
  speaking = false,
  width = 300,
  glitch = false,
  seed = 0,
  dimmed = false,
}) => {
  const frame = useCurrentFrame();
  const jitterX = glitch && frame % 37 < 2 ? 3 : 0;
  const scale = width / 300;

  return (
    <div
      style={{
        width,
        padding: 18 * scale,
        backgroundColor: theme.card,
        border: `${Math.max(2, 3 * scale)}px solid ${speaking ? theme.orange : theme.cardBorder}`,
        boxShadow: speaking ? `0 0 ${40 * scale}px ${theme.orange}66` : `0 ${8 * scale}px 0 #00000066`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10 * scale,
        transform: `translateX(${jitterX}px)`,
        opacity: dimmed ? 0.35 : 1,
      }}
    >
      <Img
        src={staticFile(avatar)}
        style={{
          width: 150 * scale,
          height: 150 * scale,
          imageRendering: 'pixelated',
          // les yeux bougent un peu grace a un micro translate periodique
          transform: glitch ? `translateX(${Math.sin(frame * 0.08 + seed) * 3}px)` : undefined,
        }}
      />
      <div
        style={{
          fontFamily: fonts.pixel,
          fontSize: 20 * scale,
          color: theme.ink,
          letterSpacing: 2,
        }}
      >
        {name}
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 12 * scale}}>
        <Waveform
          width={110 * scale}
          height={26 * scale}
          bars={9}
          color={speaking ? theme.orange : theme.dim}
          active={speaking}
          seed={seed}
        />
        <div
          style={{
            fontFamily: fonts.term,
            fontSize: 26 * scale,
            color: statusColor,
            letterSpacing: 2,
          }}
        >
          {status}
        </div>
      </div>
    </div>
  );
};
