import React from 'react';
import {
  AbsoluteFill,
  Img,
  Series,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {Backdrop} from '../components/Backdrop';
import {GlitchTitle} from '../components/GlitchTitle';
import {Typewriter} from '../components/Typewriter';
import {theme, fonts, PLAYERS} from '../theme';
import {SectionTag} from './SectionTag';
import {Punch} from './Punch';

const rand = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const PROBLEM_DURATION = 300 + 450 + 400 + 400;

// intro : "today, we are introducing" puis le logo qui claque
const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const logoIn = spring({frame: frame - 92, fps, config: {damping: 11, stiffness: 150}});
  const flash = frame >= 96 && frame <= 98;

  return (
    <Backdrop glow={0.7}>
      {flash && <AbsoluteFill style={{backgroundColor: theme.ink, opacity: 0.7}} />}
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 70}}>
        <Typewriter
          text="TODAY, WE ARE INTRODUCING"
          startFrame={12}
          charsPerFrame={0.55}
          fontSize={52}
          color={theme.dim}
          cursorColor={theme.orange}
        />
        {frame >= 92 && (
          <Img
            src={staticFile('impostral.png')}
            style={{
              width: 1000,
              transform: `scale(${interpolate(logoIn, [0, 1], [2.8, 1])})`,
              opacity: logoIn,
              filter: `drop-shadow(0 0 40px ${theme.orange}88)`,
            }}
          />
        )}
        <div
          style={{
            fontFamily: fonts.term,
            fontSize: 40,
            color: theme.dim,
            letterSpacing: 4,
            opacity: interpolate(frame, [150, 165], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          A GAME ABOUT THE QUESTION NOBODY CAN ANSWER ANYMORE
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

// mur de contenu qui defile, de plus en plus tague "ai"
const Feed: React.FC = () => {
  const frame = useCurrentFrame();
  const pct = Math.round(
    interpolate(frame, [30, 380], [8, 94], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
  );

  const cols = 5;
  const rows = 9;
  const cardW = 340;
  const cardH = 190;

  return (
    <Backdrop glow={0.3}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        {/* la grille scrolle vers le haut en continu */}
        <div style={{position: 'absolute', inset: 0, opacity: 0.85}}>
          {Array.from({length: cols * rows}, (_, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const scroll = (frame * (1.6 + (col % 2) * 0.8)) % (rows * (cardH + 26));
            const y = row * (cardH + 26) - scroll;
            const yWrapped = y < -cardH ? y + rows * (cardH + 26) : y;
            // chaque carte devient "ai" a un moment qui lui est propre
            const turnsAi = frame > 40 + rand(i) * 320;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 40 + col * (cardW + 40),
                  top: yWrapped,
                  width: cardW,
                  height: cardH,
                  backgroundColor: theme.card,
                  border: `3px solid ${turnsAi ? theme.orange : theme.cardBorder}`,
                  padding: 20,
                  boxShadow: turnsAi ? `0 0 24px ${theme.orange}44` : undefined,
                }}
              >
                {/* fausses lignes de texte */}
                {Array.from({length: 4}, (_, l) => (
                  <div
                    key={l}
                    style={{
                      height: 14,
                      width: `${45 + rand(i * 7 + l) * 50}%`,
                      backgroundColor: turnsAi ? `${theme.orange}55` : theme.cardBorder,
                      marginBottom: 14,
                    }}
                  />
                ))}
                {turnsAi && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      fontFamily: fonts.pixel,
                      fontSize: 16,
                      color: theme.bg,
                      backgroundColor: theme.orange,
                      padding: '6px 10px',
                    }}
                  >
                    AI
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* bandeau central */}
        <div
          style={{
            position: 'relative',
            backgroundColor: `${theme.bg}EE`,
            border: `4px solid ${theme.cardBorder}`,
            padding: '50px 80px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 30,
          }}
        >
          <Punch
            lines={[
              [{t: 'MORE OF WHAT YOU '}, {t: 'READ, WATCH, HEAR', c: theme.orange}],
              [{t: 'IS GENERATED BY '}, {t: 'AI.', c: theme.orange}],
            ]}
            start={40}
            fontSize={42}
          />
          <div
            style={{
              fontFamily: fonts.pixel,
              fontSize: 60,
              color: pct > 60 ? theme.red : theme.orange,
              letterSpacing: 3,
              opacity: interpolate(frame, [70, 85], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            {pct}%
          </div>
        </div>
      </AbsoluteFill>
      <SectionTag index="01" label="THE PROBLEM" />
    </Backdrop>
  );
};

// la question centrale : humain ou machine, avec le meme avatar en deux versions
const Question: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cardL = spring({frame: frame - 60, fps, config: {damping: 13}});
  const cardR = spring({frame: frame - 74, fps, config: {damping: 13}});
  // la version machine glitche par bouffees
  const glitchy = frame % 41 < 4 || frame % 67 < 3;

  return (
    <Backdrop glow={0.55}>
      <SectionTag index="01" label="THE PROBLEM" />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 60}}>
        <div style={{textAlign: 'center'}}>
          <Typewriter
            text="AM I TALKING TO A HUMAN..."
            startFrame={8}
            charsPerFrame={0.7}
            fontSize={64}
            color={theme.ink}
            cursorColor={theme.orange}
          />
        </div>

        <div style={{display: 'flex', gap: 140, alignItems: 'center'}}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
              transform: `translateX(${interpolate(cardL, [0, 1], [-400, 0])}px)`,
              opacity: cardL,
            }}
          >
            <Img
              src={staticFile(PLAYERS[0].avatar)}
              style={{width: 260, height: 260, imageRendering: 'pixelated'}}
            />
            <div style={{fontFamily: fonts.pixel, fontSize: 30, color: theme.ink, letterSpacing: 3}}>
              HUMAN?
            </div>
          </div>

          <div style={{fontFamily: fonts.pixel, fontSize: 70, color: theme.dim}}>/</div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
              transform: `translateX(${interpolate(cardR, [0, 1], [400, 0])}px) translateX(${glitchy ? 6 : 0}px)`,
              opacity: cardR,
            }}
          >
            <Img
              src={staticFile(PLAYERS[0].avatar)}
              style={{
                width: 260,
                height: 260,
                imageRendering: 'pixelated',
                filter: glitchy
                  ? 'invert(1) hue-rotate(180deg) saturate(3)'
                  : `sepia(1) saturate(4) hue-rotate(-18deg)`,
              }}
            />
            <div
              style={{fontFamily: fonts.pixel, fontSize: 30, color: theme.orange, letterSpacing: 3}}
            >
              MACHINE?
            </div>
          </div>
        </div>

        {frame >= 150 && (
          <GlitchTitle text="...OR A MACHINE?" color={theme.orange} fontSize={64} />
        )}
      </AbsoluteFill>
    </Backdrop>
  );
};

// benchmarks barres puis gros non : on veut le ressentir, pas le mesurer
const Benchmarks: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const bars = [
    {label: 'DETECTOR ACCURACY', v: 87},
    {label: 'BENCHMARK SCORE', v: 91},
    {label: 'TURING METRIC', v: 78},
  ];
  const xIn = spring({frame: frame - 120, fps, config: {damping: 10, stiffness: 200}});
  const punchPhase = frame >= 190;

  return (
    <Backdrop tint={punchPhase ? theme.orange : theme.dim} glow={punchPhase ? 0.7 : 0.3}>
      <SectionTag index="01" label="THE PROBLEM" />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 50}}>
        {!punchPhase && (
          <>
            <div style={{fontFamily: fonts.pixel, fontSize: 44, color: theme.dim, letterSpacing: 4}}>
              UNTIL NOW: A TECHNICAL PROBLEM
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: 34}}>
              {bars.map((b, i) => {
                const w = interpolate(frame, [20 + i * 12, 60 + i * 12], [0, b.v], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                });
                return (
                  <div key={b.label} style={{display: 'flex', alignItems: 'center', gap: 30}}>
                    <div
                      style={{
                        fontFamily: fonts.term,
                        fontSize: 36,
                        color: theme.dim,
                        width: 420,
                        textAlign: 'right',
                        letterSpacing: 2,
                      }}
                    >
                      {b.label}
                    </div>
                    <div style={{width: 600, height: 34, border: `3px solid ${theme.cardBorder}`}}>
                      <div style={{width: `${w}%`, height: '100%', backgroundColor: theme.dim}} />
                    </div>
                    <div style={{fontFamily: fonts.pixel, fontSize: 30, color: theme.dim}}>
                      {Math.round(w)}%
                    </div>
                  </div>
                );
              })}
            </div>
            {/* la grosse croix rouge qui barre tout */}
            <div
              style={{
                position: 'absolute',
                fontFamily: fonts.pixel,
                fontSize: 380,
                color: theme.red,
                opacity: xIn * 0.9,
                transform: `scale(${interpolate(xIn, [0, 1], [3, 1])}) rotate(-8deg)`,
                textShadow: `0 0 60px ${theme.red}66`,
              }}
            >
              ✕
            </div>
          </>
        )}
        {punchPhase && (
          <Punch
            lines={[
              [{t: 'WE WANTED PEOPLE TO '}, {t: 'FEEL IT.', c: theme.orange}],
              [{t: 'NOT A BENCHMARK.'}],
              [{t: 'A '}, {t: 'GAME.', c: theme.orange}],
            ]}
            start={200 - 190}
            gap={26}
            fontSize={52}
          />
        )}
      </AbsoluteFill>
    </Backdrop>
  );
};

export const Problem: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={300}>
        <ColdOpen />
      </Series.Sequence>
      <Series.Sequence durationInFrames={450}>
        <Feed />
      </Series.Sequence>
      <Series.Sequence durationInFrames={400}>
        <Question />
      </Series.Sequence>
      <Series.Sequence durationInFrames={400}>
        <Benchmarks />
      </Series.Sequence>
    </Series>
  );
};
