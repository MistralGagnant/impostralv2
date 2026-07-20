import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Backdrop} from '../components/Backdrop';
import {GlitchTitle} from '../components/GlitchTitle';
import {PlayerCard} from '../components/PlayerCard';
import {Typewriter} from '../components/Typewriter';
import {theme, fonts, PLAYERS} from '../theme';

// interrogatoire : ambiance rouge, ligne pixel entre l'interrogateur et sa cible
export const Interrogation: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const cardL = spring({frame: frame - 10, fps, config: {damping: 13}});
  const cardR = spring({frame: frame - 16, fps, config: {damping: 13}});
  // la ligne rouge avance par crans de pixels
  const lineProgress = interpolate(frame, [26, 44], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const segments = 22;
  const lit = Math.floor(lineProgress * segments);

  return (
    <Backdrop tint={theme.red} glow={0.7}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 50}}>
        <GlitchTitle text="INTERROGATION PHASE" color={theme.red} fontSize={62} />

        <div style={{display: 'flex', alignItems: 'center', gap: 30}}>
          <div
            style={{
              transform: `translateX(${interpolate(cardL, [0, 1], [-500, 0])}px)`,
              opacity: cardL,
            }}
          >
            <PlayerCard
              name="PLAYER 02"
              avatar={PLAYERS[1].avatar}
              width={320}
              status="ASKING"
              statusColor={theme.red}
              seed={1}
            />
          </div>

          {/* ligne pixelisee qui se charge de gauche a droite */}
          <div style={{display: 'flex', gap: 6, alignItems: 'center'}}>
            {Array.from({length: segments}, (_, i) => (
              <div
                key={i}
                style={{
                  width: 14,
                  height: i % 2 ? 8 : 14,
                  backgroundColor: i < lit ? theme.red : theme.cardBorder,
                  boxShadow: i < lit ? `0 0 12px ${theme.red}` : undefined,
                }}
              />
            ))}
            <div
              style={{
                fontFamily: fonts.pixel,
                fontSize: 40,
                color: theme.red,
                opacity: lit >= segments ? 1 : 0,
              }}
            >
              ▶
            </div>
          </div>

          <div
            style={{
              transform: `translateX(${interpolate(cardR, [0, 1], [500, 0])}px)`,
              opacity: cardR,
            }}
          >
            <PlayerCard
              name="PLAYER 05"
              avatar={PLAYERS[4].avatar}
              width={320}
              status="TARGET"
              statusColor={theme.gold}
              speaking={false}
              seed={4}
              glitch
            />
          </div>
        </div>

        <div
          style={{
            width: 1000,
            backgroundColor: theme.card,
            border: `3px solid ${theme.red}66`,
            padding: '26px 40px',
            textAlign: 'center',
          }}
        >
          <Typewriter
            text={'"What did you order at that restaurant?"'}
            startFrame={48}
            charsPerFrame={1}
            fontSize={54}
            color={theme.ink}
            cursorColor={theme.red}
          />
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};
