import React from 'react';
import {
  AbsoluteFill,
  Series,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {Backdrop} from '../components/Backdrop';
import {theme, fonts} from '../theme';
import {SectionTag} from './SectionTag';
import {Punch} from './Punch';

export const IMPACT_DURATION = 520 + 470 + 260;

// eval comportementale : ce que les benchmarks ne mesurent pas
const Evaluation: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stats = [
    {label: 'SURVIVAL', v: 87},
    {label: 'ADAPTABILITY', v: 92},
    {label: 'PERSUASION', v: 78},
    {label: 'DETECTION RESISTANCE', v: 84},
  ];
  const headIn = spring({frame: frame - 6, fps, config: {damping: 13}});

  return (
    <Backdrop glow={0.5}>
      <SectionTag index="05" label="IMPACT & BUSINESS" />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 50}}>
        <div
          style={{
            fontFamily: fonts.pixel,
            fontSize: 44,
            color: theme.ink,
            letterSpacing: 4,
            opacity: headIn,
            transform: `translateY(${interpolate(headIn, [0, 1], [-50, 0])}px)`,
          }}
        >
          A <span style={{color: theme.orange}}>BEHAVIORAL EVALUATION</span> PLATFORM
        </div>

        <div style={{display: 'flex', gap: 60, alignItems: 'stretch'}}>
          {/* avant : datasets statiques, tout gris */}
          <div
            style={{
              width: 520,
              padding: 34,
              backgroundColor: theme.card,
              border: `3px solid ${theme.cardBorder}`,
              opacity: 0.55,
            }}
          >
            <div
              style={{
                fontFamily: fonts.pixel,
                fontSize: 26,
                color: theme.dim,
                letterSpacing: 3,
                marginBottom: 26,
              }}
            >
              STATIC BENCHMARKS
            </div>
            {['ACCURACY', 'REASONING', 'DATASET SCORE'].map((l, i) => (
              <div key={l} style={{display: 'flex', alignItems: 'center', gap: 18, marginBottom: 20}}>
                <div style={{fontFamily: fonts.term, fontSize: 32, color: theme.dim, width: 250}}>
                  {l}
                </div>
                <div style={{flex: 1, height: 22, border: `2px solid ${theme.cardBorder}`}}>
                  <div
                    style={{
                      width: `${70 + i * 8}%`,
                      height: '100%',
                      backgroundColor: theme.cardBorder,
                    }}
                  />
                </div>
              </div>
            ))}
            <div style={{fontFamily: fonts.term, fontSize: 30, color: theme.dim, marginTop: 10}}>
              FROZEN. PREDICTABLE. GAMED.
            </div>
          </div>

          {/* apres : l'arene vivante */}
          <div
            style={{
              width: 640,
              padding: 34,
              backgroundColor: '#1A0E04',
              border: `3px solid ${theme.orange}`,
              boxShadow: `0 0 40px ${theme.orange}33`,
            }}
          >
            <div
              style={{
                fontFamily: fonts.pixel,
                fontSize: 26,
                color: theme.orange,
                letterSpacing: 3,
                marginBottom: 26,
              }}
            >
              THE IMPOSTRAL ARENA
            </div>
            {stats.map((s, i) => {
              const w = interpolate(frame, [50 + i * 16, 110 + i * 16], [0, s.v], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              return (
                <div
                  key={s.label}
                  style={{display: 'flex', alignItems: 'center', gap: 18, marginBottom: 20}}
                >
                  <div
                    style={{
                      fontFamily: fonts.term,
                      fontSize: 32,
                      color: theme.ink,
                      width: 330,
                      letterSpacing: 2,
                    }}
                  >
                    {s.label}
                  </div>
                  <div style={{flex: 1, height: 22, border: `2px solid ${theme.orange}66`}}>
                    <div
                      style={{
                        width: `${w}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, ${theme.gold}, ${theme.orangeHot})`,
                      }}
                    />
                  </div>
                  <div style={{fontFamily: fonts.pixel, fontSize: 22, color: theme.gold, width: 60}}>
                    {Math.round(w)}
                  </div>
                </div>
              );
            })}
            <div style={{fontFamily: fonts.term, fontSize: 30, color: theme.gold, marginTop: 10}}>
              SAME ROOM. SAME RULES. DIFFERENT MODELS & PROMPTS.
            </div>
          </div>
        </div>

        <div
          style={{
            fontFamily: fonts.pixel,
            fontSize: 34,
            color: theme.ink,
            letterSpacing: 3,
            opacity: interpolate(frame, [200, 220], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          MEASURING WHAT BENCHMARKS <span style={{color: theme.red}}>CAN'T.</span>
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

// le produit : jeu gratuit puis niveaux de monetisation, comme une progression de jeu
const Product: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const steps = [
    {label: 'FREE WEB GAME', sub: 'PLAY IN SECONDS', c: theme.green},
    {label: 'PREMIUM ROOMS', sub: 'FRIENDS & COMMUNITIES', c: theme.gold},
    {label: 'TOURNAMENTS', sub: 'STREAMERS & EVENTS', c: theme.orange},
    {label: 'CUSTOM AGENTS', sub: 'BUILD YOUR IMPOSTOR', c: theme.red},
  ];

  return (
    <Backdrop glow={0.5}>
      <SectionTag index="05" label="IMPACT & BUSINESS" />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 70}}>
        <Punch
          lines={[
            [
              {t: 'INSTANTLY '},
              {t: 'UNDERSTANDABLE. ', c: theme.orange},
              {t: 'ENDLESSLY '},
              {t: 'REPLAYABLE.', c: theme.gold},
            ],
          ]}
          start={6}
          fontSize={36}
        />

        <div style={{display: 'flex', alignItems: 'flex-end', gap: 30}}>
          {steps.map((s, i) => {
            const sIn = spring({frame: frame - 40 - i * 20, fps, config: {damping: 12}});
            return (
              <React.Fragment key={s.label}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 16,
                    transform: `translateY(${interpolate(sIn, [0, 1], [140, 0])}px)`,
                    opacity: sIn,
                  }}
                >
                  {/* la marche monte a chaque etape */}
                  <div
                    style={{
                      width: 330,
                      height: 130 + i * 55,
                      backgroundColor: theme.card,
                      border: `4px solid ${s.c}`,
                      boxShadow: `0 0 26px ${s.c}33`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 14,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: fonts.pixel,
                        fontSize: 20,
                        color: s.c,
                        letterSpacing: 2,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.label}
                    </div>
                    <div style={{fontFamily: fonts.term, fontSize: 28, color: theme.dim, letterSpacing: 2}}>
                      {s.sub}
                    </div>
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div
                    style={{
                      fontFamily: fonts.pixel,
                      fontSize: 40,
                      color: theme.dim,
                      paddingBottom: 60,
                      opacity: sIn,
                    }}
                  >
                    ▶
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div
          style={{
            fontFamily: fonts.term,
            fontSize: 40,
            color: theme.dim,
            letterSpacing: 3,
            opacity: interpolate(frame, [160, 180], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          EVERY ROOM CREATES NEW PERSONALITIES, NEW SUSPICIONS,{' '}
          <span style={{color: theme.orange}}>NEW STORIES.</span>
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

// la vraie pedagogie ia : pas entendue, vecue
const Literacy: React.FC = () => {
  return (
    <Backdrop glow={0.6}>
      <SectionTag index="05" label="IMPACT & BUSINESS" />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <Punch
          lines={[
            [{t: 'AND IT MAKES '}, {t: 'AI LITERACY', c: theme.orange}, {t: ' REAL.'}],
            [{t: "PEOPLE DON'T HEAR THAT AI SOUNDS HUMAN."}],
            [{t: 'THEY '}, {t: 'EXPERIENCE IT.', c: theme.gold}],
          ]}
          start={10}
          gap={30}
          fontSize={54}
        />
      </AbsoluteFill>
    </Backdrop>
  );
};

export const Impact: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={520}>
        <Evaluation />
      </Series.Sequence>
      <Series.Sequence durationInFrames={470}>
        <Product />
      </Series.Sequence>
      <Series.Sequence durationInFrames={260}>
        <Literacy />
      </Series.Sequence>
    </Series>
  );
};
