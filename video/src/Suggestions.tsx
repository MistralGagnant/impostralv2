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
import {Backdrop} from './components/Backdrop';
import {GlitchTitle} from './components/GlitchTitle';
import {theme, fonts, PLAYERS} from './theme';

const rand = (seed: number) => {
  const x = Math.sin(seed * 91.7 + 47.3) * 43758.5453;
  return x - Math.floor(x);
};

// zoom-punch : petite claque de scale qui retombe, pour donner du beat a chaque cut
const punchScale = (frame: number, hit: number, amount = 0.12) => {
  const t = frame - hit;
  if (t < 0) return 1;
  return 1 + amount * Math.exp(-t / 5);
};

export const SUGGESTIONS_DURATION = 240 + 360 + 360 + 330 + 360;

// intro kinetic : un mot par beat, fond qui s'inverse, aucun temps mort
const KineticIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const beats = [
    {at: 0, len: 30, text: '6 PLAYERS', fg: theme.ink, bg: theme.bg, size: 150},
    {at: 30, len: 26, text: '2 HUMANS', fg: theme.bg, bg: theme.ink, size: 150},
    {at: 56, len: 26, text: '4 AI AGENTS', fg: theme.bg, bg: theme.orange, size: 140},
    {at: 82, len: 30, text: 'NOBODY KNOWS WHO', fg: theme.orange, bg: theme.bg, size: 100},
  ];
  const current = beats.find((b) => frame >= b.at && frame < b.at + b.len);

  // strobe d'avatars : chacun 7 frames plein ecran
  const strobeStart = 112;
  const strobeEnd = strobeStart + 6 * 7;
  const strobeIdx = Math.floor((frame - strobeStart) / 7);

  // fin : la question qui reste a l'ecran
  const holdIn = spring({
    frame: frame - strobeEnd - 4,
    fps: 30,
    config: {damping: 10, stiffness: 200},
  });

  if (current) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: current.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontFamily: fonts.pixel,
            fontSize: current.size,
            color: current.fg,
            letterSpacing: 8,
            transform: `scale(${punchScale(frame, current.at, 0.25)}) rotate(${
              (rand(current.at) - 0.5) * 4
            }deg)`,
          }}
        >
          {current.text}
        </div>
      </AbsoluteFill>
    );
  }

  if (frame >= strobeStart && frame < strobeEnd) {
    const p = PLAYERS[strobeIdx % 6];
    const inverted = strobeIdx % 2 === 1;
    return (
      <AbsoluteFill
        style={{
          backgroundColor: inverted ? theme.orange : theme.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Img
          src={staticFile(p.avatar)}
          style={{
            width: 560,
            height: 560,
            imageRendering: 'pixelated',
            filter: inverted ? 'invert(1)' : undefined,
            transform: `scale(${punchScale(frame, strobeStart + strobeIdx * 7, 0.2)})`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 90,
            fontFamily: fonts.pixel,
            fontSize: 44,
            color: inverted ? theme.bg : theme.dim,
            letterSpacing: 6,
          }}
        >
          {strobeIdx % 2 ? 'AI?' : 'HUMAN?'}
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <Backdrop glow={0.7}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div style={{transform: `scale(${interpolate(holdIn, [0, 1], [2.6, 1])})`, opacity: holdIn}}>
          <GlitchTitle text="CAN YOU TELL?" color={theme.ink} fontSize={120} />
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

// rafale de reponses : la question puis 6 bulles qui claquent en alternance
const QuestionBurst: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const answers = [
    {p: 0, text: 'i said i was "5 minutes away". i was home.'},
    {p: 1, text: 'told my boss the train was late. it was not.'},
    {p: 2, text: 'i pretended to know that movie. never saw it.'},
    {p: 3, text: '"yes mom, i eat vegetables every day."'},
    {p: 4, text: 'i said "great question!" to buy time. classic.'},
    {p: 5, text: 'faked a bad connection to leave a call.'},
  ];
  const firstAt = 70;
  const gap = 34;

  const qIn = spring({frame, fps, config: {damping: 11, stiffness: 190}});
  // camera qui pompe a chaque bulle
  const lastHit = answers.reduce((acc, _, i) => (frame >= firstAt + i * gap ? firstAt + i * gap : acc), 0);

  return (
    <Backdrop glow={0.55}>
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${punchScale(frame, lastHit, 0.05)})`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 90,
            fontFamily: fonts.pixel,
            fontSize: 46,
            color: theme.orange,
            letterSpacing: 3,
            transform: `scale(${interpolate(qIn, [0, 1], [2, 1])})`,
            opacity: qIn,
            textShadow: `0 0 30px ${theme.orange}66`,
          }}
        >
          "WHAT SMALL LIE DID YOU TELL RECENTLY?"
        </div>

        <div style={{display: 'flex', flexDirection: 'column', gap: 24, marginTop: 90}}>
          {answers.map((a, i) => {
            const at = firstAt + i * gap;
            const s = spring({frame: frame - at, fps, config: {damping: 11, stiffness: 210}});
            const fromLeft = i % 2 === 0;
            if (frame < at) return <div key={i} style={{height: 96}} />;
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: fromLeft ? 'row' : 'row-reverse',
                  alignItems: 'center',
                  gap: 22,
                  alignSelf: fromLeft ? 'flex-start' : 'flex-end',
                  marginLeft: fromLeft ? 180 : 0,
                  marginRight: fromLeft ? 0 : 180,
                  transform: `translateX(${interpolate(s, [0, 1], [fromLeft ? -700 : 700, 0])}px)`,
                  opacity: s,
                }}
              >
                <Img
                  src={staticFile(PLAYERS[a.p].avatar)}
                  style={{width: 86, height: 86, imageRendering: 'pixelated'}}
                />
                <div
                  style={{
                    fontFamily: fonts.term,
                    fontSize: 40,
                    color: theme.ink,
                    letterSpacing: 1,
                    backgroundColor: theme.card,
                    border: `3px solid ${theme.cardBorder}`,
                    padding: '14px 26px',
                    boxShadow: '0 6px 0 #00000066',
                  }}
                >
                  {a.text}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 70,
            fontFamily: fonts.pixel,
            fontSize: 38,
            color: theme.red,
            letterSpacing: 4,
            opacity: interpolate(frame, [290, 305], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            textShadow: `0 0 26px ${theme.red}66`,
          }}
        >
          4 OF THESE WERE WRITTEN BY AI.
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

// toile de soupcon : accusations qui fusent entre les avatars, tampons qui claquent
const SuspicionWeb: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cx = 960;
  const cy = 560;
  const R = 330;

  const pos = (i: number) => {
    const ang = (i / 6) * Math.PI * 2 - Math.PI / 2;
    return {x: cx + Math.cos(ang) * R * 1.35, y: cy + Math.sin(ang) * R * 0.78};
  };

  // accusations : (de, vers, frame)
  const accusations = [
    {from: 0, to: 3, at: 40},
    {from: 3, to: 1, at: 80},
    {from: 4, to: 0, at: 120},
    {from: 2, to: 5, at: 160},
    {from: 5, to: 2, at: 185},
    {from: 1, to: 4, at: 210},
  ];
  const lastHit = accusations.reduce((acc, a) => (frame >= a.at ? a.at : acc), 0);

  // tampons ai?/human? qui claquent sur des avatars au hasard
  const stamps = [
    {i: 3, at: 95, label: 'AI?', c: theme.orange},
    {i: 0, at: 140, label: 'HUMAN?', c: theme.green},
    {i: 5, at: 200, label: 'AI?', c: theme.orange},
    {i: 2, at: 240, label: 'AI?', c: theme.red},
  ];

  const shake = frame - lastHit < 5 ? (frame % 2 ? 7 : -7) : 0;

  return (
    <Backdrop tint={theme.red} glow={0.6}>
      <AbsoluteFill style={{transform: `translateX(${shake}px) scale(${punchScale(frame, lastHit, 0.06)})`}}>
        <div
          style={{
            position: 'absolute',
            top: 100,
            width: '100%',
            textAlign: 'center',
          }}
        >
          <GlitchTitle text="TRUST NO ONE" color={theme.red} fontSize={90} />
        </div>

        {/* les fleches d'accusation */}
        <svg style={{position: 'absolute', inset: 0}} width={1920} height={1080}>
          {accusations
            .filter((a) => frame >= a.at)
            .map((a, k) => {
              const p1 = pos(a.from);
              const p2 = pos(a.to);
              const grow = interpolate(frame, [a.at, a.at + 10], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              const x2 = p1.x + (p2.x - p1.x) * grow;
              const y2 = p1.y + (p2.y - p1.y) * grow;
              const fade = interpolate(frame, [a.at + 55, a.at + 85], [0.9, 0.25], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              return (
                <line
                  key={k}
                  x1={p1.x}
                  y1={p1.y}
                  x2={x2}
                  y2={y2}
                  stroke={theme.red}
                  strokeWidth={7}
                  strokeDasharray="18 10"
                  opacity={fade}
                />
              );
            })}
        </svg>

        {PLAYERS.map((p, i) => {
          const {x, y} = pos(i);
          const cardIn = spring({frame: frame - 6 - i * 4, fps, config: {damping: 12}});
          const stamp = stamps.find((s) => s.i === i && frame >= s.at);
          const sIn = stamp
            ? spring({frame: frame - stamp.at, fps, config: {damping: 9, stiffness: 260}})
            : 0;
          return (
            <div
              key={p.name}
              style={{
                position: 'absolute',
                left: x - 95,
                top: y - 95,
                transform: `scale(${cardIn})`,
              }}
            >
              <Img
                src={staticFile(p.avatar)}
                style={{
                  width: 190,
                  height: 190,
                  imageRendering: 'pixelated',
                  filter: `drop-shadow(0 6px 0 #00000088)`,
                }}
              />
              {stamp && (
                <div
                  style={{
                    position: 'absolute',
                    top: 50,
                    left: -20,
                    fontFamily: fonts.pixel,
                    fontSize: 46,
                    color: stamp.c,
                    border: `5px solid ${stamp.c}`,
                    padding: '6px 14px',
                    letterSpacing: 3,
                    backgroundColor: `${theme.bg}AA`,
                    transform: `scale(${interpolate(sIn, [0, 1], [2.6, 1])}) rotate(${
                      (rand(i * 13) - 0.5) * 24
                    }deg)`,
                    opacity: sIn,
                    textShadow: `0 0 24px ${stamp.c}77`,
                  }}
                >
                  {stamp.label}
                </div>
              )}
            </div>
          );
        })}

        <div
          style={{
            position: 'absolute',
            bottom: 80,
            width: '100%',
            textAlign: 'center',
            fontFamily: fonts.term,
            fontSize: 44,
            color: theme.dim,
            letterSpacing: 4,
            opacity: interpolate(frame, [250, 270], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          EVERY ACCUSATION TELLS THEM HOW YOU THINK.
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

// le vote en course : les jauges montent en direct puis tout se verrouille
const VoteRush: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // player 04 finit en tete, la course reste serree
  const finals = [2, 1, 3, 6, 2, 1];
  const lockAt = 170;
  const locked = frame >= lockAt;
  const lockIn = spring({frame: frame - lockAt, fps, config: {damping: 9, stiffness: 220}});

  // l'avatar du perdant explose en pixels sur la fin
  const explodeAt = 230;
  const GRID = 10;
  const SIZE = 240;
  const tile = SIZE / GRID;

  return (
    <Backdrop tint={theme.gold} glow={0.55}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 40}}>
        {frame < explodeAt ? (
          <>
            <div
              style={{
                fontFamily: fonts.pixel,
                fontSize: 56,
                color: theme.ink,
                letterSpacing: 4,
                transform: `scale(${punchScale(frame, 0, 0.2)})`,
              }}
            >
              VOTES ARE <span style={{color: theme.gold}}>LIVE</span>
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: 26}}>
              {PLAYERS.map((p, i) => {
                const v = interpolate(frame, [20, lockAt - 10], [0, finals[i]], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                });
                const leading = i === 3 && frame > 90;
                return (
                  <div key={p.name} style={{display: 'flex', alignItems: 'center', gap: 22}}>
                    <Img
                      src={staticFile(p.avatar)}
                      style={{width: 74, height: 74, imageRendering: 'pixelated'}}
                    />
                    <div
                      style={{
                        fontFamily: fonts.pixel,
                        fontSize: 22,
                        color: leading ? theme.red : theme.ink,
                        width: 240,
                        letterSpacing: 2,
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      style={{
                        width: 760,
                        height: 40,
                        border: `3px solid ${leading ? theme.red : theme.cardBorder}`,
                        boxShadow: leading ? `0 0 24px ${theme.red}55` : undefined,
                      }}
                    >
                      <div
                        style={{
                          width: `${(v / 6) * 100}%`,
                          height: '100%',
                          background: leading
                            ? `linear-gradient(90deg, ${theme.orangeHot}, ${theme.red})`
                            : `linear-gradient(90deg, ${theme.gold}, ${theme.orange})`,
                        }}
                      />
                    </div>
                    <div style={{fontFamily: fonts.pixel, fontSize: 30, color: theme.gold, width: 50}}>
                      {Math.round(v)}
                    </div>
                  </div>
                );
              })}
            </div>
            {locked && (
              <div
                style={{
                  position: 'absolute',
                  fontFamily: fonts.pixel,
                  fontSize: 110,
                  color: theme.red,
                  letterSpacing: 6,
                  transform: `scale(${interpolate(lockIn, [0, 1], [3, 1])}) rotate(-6deg)`,
                  opacity: lockIn,
                  textShadow: `0 0 60px ${theme.red}88`,
                  backgroundColor: `${theme.bg}CC`,
                  padding: '20px 50px',
                  border: `8px solid ${theme.red}`,
                }}
              >
                VOTE LOCKED
              </div>
            )}
          </>
        ) : (
          <>
            {/* l'explosion pixel du vote perdu */}
            <div style={{position: 'relative', width: SIZE, height: SIZE}}>
              {Array.from({length: GRID * GRID}, (_, i) => {
                const cx2 = i % GRID;
                const cy2 = Math.floor(i / GRID);
                const t = Math.max(0, (frame - explodeAt - rand(i) * 8) / 18);
                const dx = (rand(i + 500) - 0.5) * 900 * t;
                const dy = (rand(i + 900) - 0.5) * 700 * t + 180 * t * t;
                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: cx2 * tile,
                      top: cy2 * tile,
                      width: tile,
                      height: tile,
                      backgroundImage: `url(${staticFile(PLAYERS[3].avatar)})`,
                      backgroundSize: `${SIZE}px ${SIZE}px`,
                      backgroundPosition: `-${cx2 * tile}px -${cy2 * tile}px`,
                      imageRendering: 'pixelated',
                      transform: `translate(${dx}px, ${dy}px) rotate(${(rand(i + 42) - 0.5) * 360 * t}deg)`,
                      opacity: Math.max(0, 1 - t * 1.2),
                    }}
                  />
                );
              })}
            </div>
            <div
              style={{
                fontFamily: fonts.pixel,
                fontSize: 62,
                color: theme.red,
                letterSpacing: 5,
                transform: `scale(${punchScale(frame, explodeAt + 8, 0.25)})`,
                opacity: interpolate(frame, [explodeAt + 6, explodeAt + 14], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
                textShadow: `0 0 40px ${theme.red}77`,
              }}
            >
              PLAYER 04 ELIMINATED
            </div>
            <div
              style={{
                fontFamily: fonts.term,
                fontSize: 42,
                color: theme.dim,
                letterSpacing: 3,
                opacity: interpolate(frame, [explodeAt + 40, explodeAt + 55], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              HE WAS HUMAN. THE AGENTS ARE STILL IN.
            </div>
          </>
        )}
      </AbsoluteFill>
    </Backdrop>
  );
};

// finale : battement de coeur textuel puis le logo et l'appel a jouer
const Finale: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const beats = [
    {at: 20, text: 'THE MOST HUMAN PLAYER', c: theme.ink},
    {at: 80, text: 'WAS NOT HUMAN.', c: theme.orange},
  ];
  const logoAt = 150;
  const logoIn = spring({frame: frame - logoAt, fps, config: {damping: 10, stiffness: 170}});
  const flash = frame >= logoAt + 3 && frame <= logoAt + 5;
  const current = frame < logoAt ? beats.filter((b) => frame >= b.at).slice(-1)[0] : undefined;

  return (
    <Backdrop glow={frame >= logoAt ? 0.85 : 0.35}>
      {flash && <AbsoluteFill style={{backgroundColor: theme.ink, opacity: 0.8}} />}
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 46}}>
        {current && (
          <div
            style={{
              fontFamily: fonts.pixel,
              fontSize: 84,
              color: current.c,
              letterSpacing: 5,
              textAlign: 'center',
              transform: `scale(${punchScale(frame, current.at, 0.3)})`,
              textShadow: current.c === theme.orange ? `0 0 50px ${theme.orange}77` : undefined,
            }}
          >
            {current.text}
          </div>
        )}

        {frame >= logoAt && (
          <>
            <Img
              src={staticFile('logo.png')}
              style={{
                width: 260,
                imageRendering: 'pixelated',
                transform: `scale(${interpolate(logoIn, [0, 1], [0, 1])})`,
                filter: `drop-shadow(0 0 40px ${theme.orange}77)`,
              }}
            />
            <Img
              src={staticFile('impostral.png')}
              style={{
                width: 900,
                transform: `scale(${interpolate(logoIn, [0, 1], [2.4, 1])})`,
                opacity: logoIn,
                filter: `drop-shadow(0 0 36px ${theme.orange}66)`,
              }}
            />
            <div
              style={{
                fontFamily: fonts.pixel,
                fontSize: 40,
                color: theme.ink,
                letterSpacing: 4,
                opacity: interpolate(frame, [logoAt + 40, logoAt + 55], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              [ PLAY NOW — <span style={{color: theme.orange}}>IF YOU DARE</span> ]
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                opacity: interpolate(frame, [logoAt + 70, logoAt + 85], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              <div style={{display: 'flex', flexDirection: 'column', gap: 3}}>
                {['#FFD800', '#FFAF00', '#FF8205', '#FA500F', '#E10500'].map((c) => (
                  <div key={c} style={{width: 46, height: 8, backgroundColor: c}} />
                ))}
              </div>
              <div style={{fontFamily: fonts.pixel, fontSize: 28, color: theme.dim, letterSpacing: 4}}>
                POWERED BY MISTRAL
              </div>
            </div>
          </>
        )}
      </AbsoluteFill>
    </Backdrop>
  );
};

// version trailer ~55s : cuts secs, zooms punch, zero transition douce
export const Suggestions: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={240}>
        <KineticIntro />
      </Series.Sequence>
      <Series.Sequence durationInFrames={360}>
        <QuestionBurst />
      </Series.Sequence>
      <Series.Sequence durationInFrames={360}>
        <SuspicionWeb />
      </Series.Sequence>
      <Series.Sequence durationInFrames={330}>
        <VoteRush />
      </Series.Sequence>
      <Series.Sequence durationInFrames={360}>
        <Finale />
      </Series.Sequence>
    </Series>
  );
};
