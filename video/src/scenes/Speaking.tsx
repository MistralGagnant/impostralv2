import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Backdrop} from '../components/Backdrop';
import {PlayerCard} from '../components/PlayerCard';
import {Typewriter} from '../components/Typewriter';
import {Waveform} from '../components/Waveform';
import {theme, fonts, PLAYERS} from '../theme';

// tour de parole : la carte du joueur 03 grossit, sa reponse se tape a l'ecran
export const Speaking: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const zoom = spring({frame, fps, config: {damping: 13, stiffness: 130}});
  const others = PLAYERS.filter((_, i) => i !== 2);

  return (
    <Backdrop glow={0.6}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        {/* les autres joueurs en retrait sur les bords */}
        {others.map((p, i) => {
          const left = i < 3 ? 70 : 1920 - 70 - 210;
          const top = 190 + (i % 3) * 260;
          return (
            <div key={p.name} style={{position: 'absolute', left, top}}>
              <PlayerCard name={p.name} avatar={p.avatar} width={210} seed={i} glitch dimmed />
            </div>
          );
        })}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 34,
            transform: `scale(${interpolate(zoom, [0, 1], [0.6, 1])})`,
            opacity: zoom,
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 26}}>
            <div style={{fontFamily: fonts.pixel, fontSize: 36, color: theme.orange, letterSpacing: 3}}>
              PLAYER 03 IS SPEAKING
            </div>
            <Waveform width={140} height={40} color={theme.orange} seed={9} />
          </div>

          <PlayerCard
            name="PLAYER 03"
            avatar={PLAYERS[2].avatar}
            width={360}
            status="SPEAKING"
            statusColor={theme.orange}
            speaking
            seed={2}
          />

          <div
            style={{
              width: 900,
              minHeight: 150,
              backgroundColor: theme.card,
              border: `3px solid ${theme.cardBorder}`,
              padding: '30px 40px',
              boxShadow: '0 10px 0 #00000066',
            }}
          >
            <Typewriter
              text={'"Honestly, I once pretended to be sick\n just to avoid a birthday dinner."'}
              startFrame={22}
              charsPerFrame={0.85}
              fontSize={52}
              color={theme.ink}
              cursorColor={theme.orange}
            />
          </div>
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};
