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
import {Waveform} from '../components/Waveform';
import {theme, fonts, PLAYERS} from '../theme';
import {SectionTag} from './SectionTag';
import {Punch} from './Punch';

export const AGENTS_DURATION = 400 + 520 + 520 + 330;

// l'idee cle : mistral n'est pas l'assistant, c'est le joueur
const PlayerNotTool: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const slamAt = 120;
  const slam = spring({frame: frame - slamAt, fps, config: {damping: 10, stiffness: 180}});
  const mascotIn = spring({frame: frame - slamAt - 20, fps, config: {damping: 13}});

  return (
    <Backdrop glow={0.6}>
      <SectionTag index="04" label="MISTRAL AGENTS" />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 60}}>
        <div
          style={{
            fontFamily: fonts.term,
            fontSize: 46,
            color: theme.dim,
            letterSpacing: 3,
            opacity: interpolate(frame, [10, 25], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }) * interpolate(frame, [slamAt - 12, slamAt], [1, 0.35], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          IN MOST PRODUCTS, THE MODEL IS AN ASSISTANT. A FEATURE. A BACKGROUND CHARACTER.
        </div>

        {frame >= slamAt && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 50,
              transform: `scale(${interpolate(slam, [0, 1], [2.2, 1])})`,
              opacity: slam,
            }}
          >
            <Img
              src={staticFile('logo.png')}
              style={{
                width: 220,
                imageRendering: 'pixelated',
                transform: `translateY(${interpolate(mascotIn, [0, 1], [60, 0])}px)`,
                opacity: mascotIn,
                filter: `drop-shadow(0 0 30px ${theme.orange}66)`,
              }}
            />
            <div
              style={{
                fontFamily: fonts.pixel,
                fontSize: 56,
                color: theme.ink,
                letterSpacing: 4,
                lineHeight: 1.5,
              }}
            >
              IN IMPOSTRAL,
              <br />
              <span style={{color: theme.orange, textShadow: `0 0 40px ${theme.orange}66`}}>
                MISTRAL IS THE PLAYER.
              </span>
            </div>
          </div>
        )}
      </AbsoluteFill>
    </Backdrop>
  );
};

// 4 agents independants poses sur le socle mistral large
const Personalities: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const personas = [
    {p: PLAYERS[1], label: 'ANALYTICAL', c: '#2DAAFF'},
    {p: PLAYERS[2], label: 'WARM', c: theme.gold},
    {p: PLAYERS[4], label: 'SUSPICIOUS', c: theme.red},
    {p: PLAYERS[5], label: 'BOLD', c: theme.green},
  ];
  const baseIn = spring({frame: frame - 8, fps, config: {damping: 13}});

  return (
    <Backdrop glow={0.5}>
      <SectionTag index="04" label="MISTRAL AGENTS" />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 44}}>
        <div style={{fontFamily: fonts.pixel, fontSize: 42, color: theme.ink, letterSpacing: 4}}>
          EVERY AI SEAT = <span style={{color: theme.orange}}>ITS OWN AGENT</span>
        </div>

        <div style={{display: 'flex', gap: 40, alignItems: 'flex-end'}}>
          {personas.map((a, i) => {
            const cardIn = spring({frame: frame - 30 - i * 14, fps, config: {damping: 12}});
            return (
              <div
                key={a.label}
                style={{
                  width: 280,
                  padding: 22,
                  backgroundColor: theme.card,
                  border: `3px solid ${a.c}`,
                  boxShadow: `0 0 26px ${a.c}33`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 14,
                  transform: `translateY(${interpolate(cardIn, [0, 1], [180, 0])}px)`,
                  opacity: cardIn,
                }}
              >
                <Img
                  src={staticFile(a.p.avatar)}
                  style={{width: 130, height: 130, imageRendering: 'pixelated'}}
                />
                <div
                  style={{
                    fontFamily: fonts.pixel,
                    fontSize: 17,
                    color: a.c,
                    letterSpacing: 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.label}
                </div>
                <Waveform width={140} height={26} bars={10} color={a.c} seed={i * 3 + 1} />
                <div style={{fontFamily: fonts.term, fontSize: 24, color: theme.dim, letterSpacing: 2}}>
                  OWN VOICE · OWN VOTE
                </div>
              </div>
            );
          })}
        </div>

        {/* le socle commun */}
        <div
          style={{
            width: 1240,
            padding: '26px 0',
            textAlign: 'center',
            backgroundColor: '#241205',
            border: `4px solid ${theme.orange}`,
            fontFamily: fonts.pixel,
            fontSize: 34,
            color: theme.orange,
            letterSpacing: 6,
            boxShadow: `0 0 40px ${theme.orange}44`,
            transform: `scaleX(${baseIn})`,
          }}
        >
          BUILT ON MISTRAL LARGE
        </div>

        <div
          style={{
            fontFamily: fonts.term,
            fontSize: 40,
            color: theme.dim,
            letterSpacing: 3,
            opacity: interpolate(frame, [120, 140], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          READS. ANSWERS. CHALLENGES. VOTES. —{' '}
          <span style={{color: theme.red}}>NO SHARED STRATEGY. NO CENTRAL INTELLIGENCE.</span>
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

// voxtral : tout le monde passe par la meme voix, il ne reste que le langage
const Voxtral: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const nodes = ['🎙 SPEECH', 'VOXTRAL STT', 'TEXT', 'SYNTHETIC VOICE'];
  const active = Math.min(Math.floor(interpolate(frame, [30, 150], [0, 4])), 3);
  const rules = ['SAME VOICE FOR EVERYONE', 'RESPONSE TIMES HIDDEN', 'ANSWERS IN RANDOM ORDER'];
  const punchAt = 330;

  return (
    <Backdrop glow={0.55}>
      <SectionTag index="04" label="MISTRAL AGENTS" />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 56}}>
        {frame < punchAt ? (
          <>
            <div
              style={{
                fontFamily: fonts.pixel,
                fontSize: 34,
                color: theme.ink,
                letterSpacing: 4,
                textAlign: 'center',
                maxWidth: 1600,
                lineHeight: 1.6,
              }}
            >
              THEN THERE'S <span style={{color: theme.orange}}>VOXTRAL.</span> IT MAKES THE GAME{' '}
              <span style={{color: theme.green}}>FAIR.</span>
            </div>

            <div style={{display: 'flex', alignItems: 'center', gap: 20}}>
              {nodes.map((nd, i) => {
                const on = i <= active;
                return (
                  <React.Fragment key={nd}>
                    <div
                      style={{
                        fontFamily: fonts.pixel,
                        fontSize: 26,
                        letterSpacing: 2,
                        whiteSpace: 'nowrap',
                        padding: '26px 34px',
                        color: on ? theme.bg : theme.dim,
                        backgroundColor: on ? theme.orange : theme.card,
                        border: `4px solid ${on ? theme.orange : theme.cardBorder}`,
                        boxShadow: on ? `0 0 26px ${theme.orange}55` : undefined,
                      }}
                    >
                      {nd}
                    </div>
                    {i < nodes.length - 1 && (
                      <div
                        style={{
                          fontFamily: fonts.pixel,
                          fontSize: 34,
                          color: i < active ? theme.orange : theme.dim,
                        }}
                      >
                        ▶
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: 22}}>
              {rules.map((r, i) => {
                const rIn = spring({frame: frame - 170 - i * 22, fps, config: {damping: 11, stiffness: 190}});
                return (
                  <div
                    key={r}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 24,
                      transform: `scale(${interpolate(rIn, [0, 1], [1.6, 1])})`,
                      opacity: rIn,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: fonts.pixel,
                        fontSize: 30,
                        color: theme.green,
                      }}
                    >
                      ✓
                    </div>
                    <div
                      style={{fontFamily: fonts.term, fontSize: 44, color: theme.ink, letterSpacing: 3}}
                    >
                      {r}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <Punch
            lines={[
              [{t: 'NO REAL VOICE. NO SPEED TELLS.'}],
              [{t: 'ALL YOU HAVE IS '}, {t: 'LANGUAGE.', c: theme.orange}],
            ]}
            start={6}
            gap={24}
            fontSize={60}
          />
        )}
      </AbsoluteFill>
    </Backdrop>
  );
};

// le moteur temps reel qui orchestre tout
const Engine: React.FC = () => {
  const frame = useCurrentFrame();
  const logs = [
    {t: 'room #4F2A · round 3 started', c: theme.dim},
    {t: 'question broadcast to 6 players', c: theme.dim},
    {t: 'P01 answer received (hidden)', c: theme.ink},
    {t: 'P03 agent reasoning… done', c: theme.orange},
    {t: 'P05 agent reasoning… done', c: theme.orange},
    {t: 'answers shuffled · playing via TTS', c: theme.ink},
    {t: 'vote window open', c: theme.gold},
    {t: 'P02 voted (secret)', c: theme.ink},
    {t: 'P06 agent voted (secret)', c: theme.orange},
    {t: 'elimination: P04 · identity revealed', c: theme.red},
  ];
  const shown = Math.min(Math.floor(interpolate(frame, [10, 160], [0, logs.length])), logs.length);
  const punchAt = 190;

  return (
    <Backdrop glow={0.45}>
      <SectionTag index="04" label="MISTRAL AGENTS" />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 50}}>
        {frame < punchAt ? (
          <>
            <div style={{fontFamily: fonts.pixel, fontSize: 40, color: theme.ink, letterSpacing: 4}}>
              UNDERNEATH: A <span style={{color: theme.orange}}>REAL-TIME ENGINE</span>
            </div>
            <div
              style={{
                width: 1150,
                minHeight: 520,
                backgroundColor: '#07070C',
                border: `3px solid ${theme.cardBorder}`,
                padding: '30px 44px',
                boxShadow: '0 12px 0 #00000066',
              }}
            >
              {logs.slice(0, shown).map((l, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: fonts.term,
                    fontSize: 40,
                    color: l.c,
                    letterSpacing: 2,
                    lineHeight: 1.25,
                  }}
                >
                  <span style={{color: theme.dim}}>{'>'}</span> {l.t}
                </div>
              ))}
              <span
                style={{
                  fontFamily: fonts.term,
                  fontSize: 40,
                  color: theme.orange,
                  opacity: Math.floor(frame / 8) % 2 ? 1 : 0,
                }}
              >
                █
              </span>
            </div>
          </>
        ) : (
          <Punch
            lines={[
              [{t: 'MORE THAN TEXT GENERATION.'}],
              [
                {t: 'AGENTS THAT '},
                {t: 'REASON, ADAPT', c: theme.orange},
                {t: ' — AND '},
                {t: 'COMPETE.', c: theme.red},
              ],
            ]}
            start={6}
            gap={24}
            fontSize={54}
          />
        )}
      </AbsoluteFill>
    </Backdrop>
  );
};

export const Agents: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={400}>
        <PlayerNotTool />
      </Series.Sequence>
      <Series.Sequence durationInFrames={520}>
        <Personalities />
      </Series.Sequence>
      <Series.Sequence durationInFrames={520}>
        <Voxtral />
      </Series.Sequence>
      <Series.Sequence durationInFrames={330}>
        <Engine />
      </Series.Sequence>
    </Series>
  );
};
