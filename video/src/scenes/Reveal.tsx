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
import {theme, fonts, PLAYERS} from '../theme';

const FLIP_START = 20;
const FLIP_GAP = 14;
const PUNCH = FLIP_START + 6 * FLIP_GAP + 40; // "the most human player was not human"
const OUTRO = PUNCH + 78; // powered by mistral

// reveal final : les cartes se retournent une a une, puis la punchline, puis mistral
export const Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const punchIn = spring({frame: frame - PUNCH, fps, config: {damping: 12, stiffness: 150}});
  const outroIn = spring({frame: frame - OUTRO, fps, config: {damping: 13}});
  const gridOut = interpolate(frame, [PUNCH - 12, PUNCH], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const punchOut = interpolate(frame, [OUTRO - 10, OUTRO], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <Backdrop glow={0.7}>
      {/* phase 1 : la grille des roles */}
      {gridOut > 0 && (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 50, opacity: gridOut}}>
          <div style={{fontFamily: fonts.pixel, fontSize: 52, color: theme.orange, letterSpacing: 5}}>
            FINAL REVEAL
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: 30}}>
            {PLAYERS.map((p, i) => {
              const f = frame - FLIP_START - i * FLIP_GAP;
              const flip = spring({frame: f, fps, config: {damping: 14, stiffness: 120}});
              const deg = interpolate(flip, [0, 1], [0, 180]);
              const showBack = deg > 90;
              const isAgent = p.role !== 'HUMAN';
              return (
                <div key={p.name} style={{perspective: 1200}}>
                  <div
                    style={{
                      width: 420,
                      height: 200,
                      position: 'relative',
                      transformStyle: 'preserve-3d',
                      transform: `rotateY(${deg}deg)`,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backfaceVisibility: 'hidden',
                        backgroundColor: theme.card,
                        border: `3px solid ${theme.cardBorder}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 24,
                      }}
                    >
                      <Img
                        src={staticFile(p.avatar)}
                        style={{width: 110, height: 110, imageRendering: 'pixelated'}}
                      />
                      <div style={{fontFamily: fonts.pixel, fontSize: 26, color: theme.ink}}>
                        {p.name}
                      </div>
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                        backgroundColor: isAgent ? '#241205' : theme.card,
                        border: `3px solid ${isAgent ? theme.orange : theme.cardBorder}`,
                        boxShadow: showBack && isAgent ? `0 0 34px ${theme.orange}55` : undefined,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                      }}
                    >
                      <div style={{fontFamily: fonts.term, fontSize: 34, color: theme.dim, letterSpacing: 3}}>
                        {p.name}
                      </div>
                      <div
                        style={{
                          fontFamily: fonts.pixel,
                          fontSize: isAgent ? 24 : 32,
                          color: isAgent ? theme.orange : theme.ink,
                          letterSpacing: 3,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.role}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      )}

      {/* phase 2 : la punchline seule */}
      {frame >= PUNCH && punchOut > 0 && (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: punchOut}}>
          <div
            style={{
              fontFamily: fonts.pixel,
              fontSize: 58,
              color: theme.ink,
              letterSpacing: 4,
              textAlign: 'center',
              lineHeight: 1.7,
              maxWidth: 1500,
              transform: `scale(${interpolate(punchIn, [0, 1], [1.7, 1])})`,
              opacity: punchIn,
            }}
          >
            THE MOST <span style={{color: theme.orange}}>HUMAN</span> PLAYER
            <br />
            WAS <span style={{color: theme.red}}>NOT HUMAN.</span>
          </div>
        </AbsoluteFill>
      )}

      {/* phase 3 : logo + powered by mistral */}
      {frame >= OUTRO && (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 36}}>
          <Img
            src={staticFile('logo.png')}
            style={{
              width: 300,
              imageRendering: 'pixelated',
              transform: `scale(${interpolate(outroIn, [0, 1], [0, 1])})`,
              filter: `drop-shadow(0 0 40px ${theme.orange}66)`,
            }}
          />
          <Img src={staticFile('impostral.png')} style={{width: 620, opacity: outroIn}} />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 22,
              opacity: interpolate(frame, [OUTRO + 16, OUTRO + 30], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            {/* petit drapeau mistral en bandes */}
            <div style={{display: 'flex', flexDirection: 'column', gap: 3}}>
              {['#FFD800', '#FFAF00', '#FF8205', '#FA500F', '#E10500'].map((c) => (
                <div key={c} style={{width: 52, height: 9, backgroundColor: c}} />
              ))}
            </div>
            <div style={{fontFamily: fonts.pixel, fontSize: 34, color: theme.ink, letterSpacing: 4}}>
              POWERED BY MISTRAL
            </div>
          </div>
        </AbsoluteFill>
      )}
    </Backdrop>
  );
};
