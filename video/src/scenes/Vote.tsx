import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {Backdrop} from '../components/Backdrop';
import {GlitchTitle} from '../components/GlitchTitle';
import {theme, fonts, PLAYERS} from '../theme';

const CLICK_FRAME = 74; // moment ou le curseur valide player 04

// vote : un curseur pixel survole les cibles puis verrouille son choix
export const Vote: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // positions des 6 boutons dans une grille 3x2 centree
  const cell = (i: number) => ({
    x: 960 + (i % 3 - 1) * 420,
    y: 470 + Math.floor(i / 3) * 160,
  });

  // le curseur passe sur 01 -> 05 -> 02 -> 04 puis clique
  const path = [cell(0), cell(4), cell(1), cell(3)];
  const seg = interpolate(frame, [16, 34, 50, 66], [0, 1, 2, 3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const a = path[Math.min(Math.floor(seg), path.length - 1)];
  const b = path[Math.min(Math.floor(seg) + 1, path.length - 1)];
  const t = seg - Math.floor(seg);
  const cursor = {x: a.x + (b.x - a.x) * t + 60, y: a.y + (b.y - a.y) * t + 40};

  const hovered = seg > 2.9 ? 3 : seg > 1.9 ? 1 : seg > 0.9 ? 4 : 0;
  const clicked = frame >= CLICK_FRAME;
  const lockIn = spring({frame: frame - CLICK_FRAME - 6, fps, config: {damping: 11, stiffness: 190}});

  return (
    <Backdrop tint={theme.gold} glow={0.5}>
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 150}}>
          <GlitchTitle text="WHO IS THE IMPOSTOR?" color={theme.ink} fontSize={64} intensity={0.6} />
        </div>

        {PLAYERS.map((p, i) => {
          const pos = cell(i);
          const isTarget = i === 3 && clicked;
          const hover = hovered === i && !clicked;
          return (
            <div
              key={p.name}
              style={{
                position: 'absolute',
                left: pos.x - 195,
                top: pos.y,
                width: 390,
                padding: '24px 0',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                fontFamily: fonts.pixel,
                fontSize: 24,
                letterSpacing: 2,
                color: isTarget ? theme.bg : hover ? theme.gold : theme.ink,
                backgroundColor: isTarget ? theme.red : theme.card,
                border: `4px solid ${isTarget ? theme.red : hover ? theme.gold : theme.cardBorder}`,
                boxShadow: isTarget ? `0 0 40px ${theme.red}AA` : '0 8px 0 #00000066',
                transform: hover ? 'scale(1.06)' : 'scale(1)',
                opacity: clicked && !isTarget ? 0.35 : 1,
              }}
            >
              [ {p.name} ]
            </div>
          );
        })}

        {/* curseur pixel */}
        {!clicked && (
          <div
            style={{
              position: 'absolute',
              left: cursor.x,
              top: cursor.y,
              fontSize: 54,
              color: theme.ink,
              textShadow: '3px 3px 0 #000',
              fontFamily: fonts.term,
            }}
          >
            ➤
          </div>
        )}

        {clicked && (
          <div
            style={{
              position: 'absolute',
              top: 800,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 18,
              transform: `scale(${interpolate(lockIn, [0, 1], [2.4, 1])})`,
              opacity: lockIn,
            }}
          >
            <div
              style={{
                fontFamily: fonts.pixel,
                fontSize: 54,
                color: theme.red,
                letterSpacing: 4,
                textShadow: `0 0 30px ${theme.red}88`,
              }}
            >
              VOTE LOCKED
            </div>
            <div style={{fontFamily: fonts.term, fontSize: 38, color: theme.dim, letterSpacing: 3}}>
              NO ONE CAN SEE YOUR CHOICE
            </div>
          </div>
        )}

        {/* la mascotte observe le vote depuis le coin */}
        <Img
          src={staticFile('logo.png')}
          style={{
            position: 'absolute',
            right: -40,
            bottom: -50,
            width: 240,
            imageRendering: 'pixelated',
            opacity: 0.9,
            transform: `translateY(${interpolate(
              spring({frame: frame - 20, fps, config: {damping: 15}}),
              [0, 1],
              [140, 0],
            )}px)`,
          }}
        />
      </AbsoluteFill>
    </Backdrop>
  );
};
