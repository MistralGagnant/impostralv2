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
import {Typewriter} from '../components/Typewriter';
import {theme, fonts, PLAYERS} from '../theme';
import {SectionTag} from './SectionTag';
import {Punch} from './Punch';

export const SOLUTION_DURATION = 500 + 560 + 400;

const AGENT_SET = [1, 2, 4, 5]; // les sieges tenus par des agents dans la demo

// cercle de 6 joueurs, un scan revele les agents infiltres
const Concept: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const titleIn = spring({frame: frame - 6, fps, config: {damping: 13}});
  const sweep = ((frame * 2.2) % 360) * (Math.PI / 180); // angle du radar
  const revealed = frame > 170;

  const cx = 960;
  const cy = 560;
  const R = 300;

  return (
    <Backdrop glow={0.5}>
      <SectionTag index="02" label="THE SOLUTION" />
      <AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            top: 140,
            width: '100%',
            textAlign: 'center',
            fontFamily: fonts.pixel,
            fontSize: 52,
            color: theme.ink,
            letterSpacing: 4,
            transform: `translateY(${interpolate(titleIn, [0, 1], [-60, 0])}px)`,
            opacity: titleIn,
          }}
        >
          A <span style={{color: theme.orange}}>SOCIAL DEDUCTION</span> GAME
        </div>

        {/* faisceau radar qui balaie le cercle */}
        <div
          style={{
            position: 'absolute',
            left: cx,
            top: cy,
            width: R + 160,
            height: 6,
            background: `linear-gradient(90deg, ${theme.orange}00, ${theme.orange}AA)`,
            transformOrigin: '0 50%',
            transform: `rotate(${(sweep * 180) / Math.PI}deg)`,
          }}
        />

        {PLAYERS.map((p, i) => {
          const ang = (i / 6) * Math.PI * 2 - Math.PI / 2 + frame * 0.003;
          const x = cx + Math.cos(ang) * R;
          const y = cy + Math.sin(ang) * R * 0.72;
          const isAgent = AGENT_SET.includes(i);
          // un agent s'allume quand le faisceau passe dessus, apres la phase de reveal
      const diff = Math.abs(((sweep - ang) % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);
          const lit = revealed && isAgent && (diff < 0.5 || diff > Math.PI * 2 - 0.5);
          const cardIn = spring({frame: frame - 20 - i * 7, fps, config: {damping: 12}});
          return (
            <div
              key={p.name}
              style={{
                position: 'absolute',
                left: x - 105,
                top: y - 110,
                width: 210,
                padding: 16,
                backgroundColor: theme.card,
                border: `3px solid ${lit ? theme.orange : theme.cardBorder}`,
                boxShadow: lit ? `0 0 36px ${theme.orange}88` : '0 6px 0 #00000066',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                transform: `scale(${cardIn})`,
                opacity: cardIn,
              }}
            >
              <Img
                src={staticFile(p.avatar)}
                style={{width: 110, height: 110, imageRendering: 'pixelated'}}
              />
              <div style={{fontFamily: fonts.pixel, fontSize: 16, color: theme.ink}}>{p.name}</div>
              {lit && (
                <div style={{fontFamily: fonts.pixel, fontSize: 14, color: theme.orange}}>
                  AGENT?
                </div>
              )}
            </div>
          );
        })}

        <div
          style={{
            position: 'absolute',
            bottom: 110,
            width: '100%',
            textAlign: 'center',
            fontFamily: fonts.term,
            fontSize: 44,
            color: theme.dim,
            letterSpacing: 3,
            opacity: interpolate(frame, [180, 200], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          INDEPENDENT MISTRAL AGENTS INFILTRATE THE GROUP —{' '}
          <span style={{color: theme.orange}}>AND SURVIVE BY ACTING HUMAN</span>
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

// la boucle de jeu : question, reponses, vote, elimination
const Loop: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const steps = ['QUESTION', 'ANSWER', 'VOTE', 'ELIMINATE'];
  const active = Math.min(Math.floor(interpolate(frame, [30, 260], [0, 4])), 3);
  const winIn = spring({frame: frame - 330, fps, config: {damping: 13}});

  return (
    <Backdrop glow={0.5}>
      <SectionTag index="02" label="THE SOLUTION" />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 60}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 26}}>
          {steps.map((s, i) => {
            const on = i <= active;
            const pulse = i === active && frame % 20 < 10;
            return (
              <React.Fragment key={s}>
                <div
                  style={{
                    fontFamily: fonts.pixel,
                    fontSize: 34,
                    letterSpacing: 3,
                    padding: '30px 40px',
                    color: on ? theme.bg : theme.dim,
                    backgroundColor: on ? (pulse ? theme.gold : theme.orange) : theme.card,
                    border: `4px solid ${on ? theme.orange : theme.cardBorder}`,
                    boxShadow: on ? `0 0 30px ${theme.orange}55` : undefined,
                  }}
                >
                  {s}
                </div>
                {i < steps.length - 1 && (
                  <div
                    style={{
                      fontFamily: fonts.pixel,
                      fontSize: 40,
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

        <div
          style={{
            width: 1100,
            backgroundColor: theme.card,
            border: `3px solid ${theme.cardBorder}`,
            padding: '34px 50px',
            textAlign: 'center',
          }}
        >
          <Typewriter
            text={'"What small lie did you tell recently?"'}
            startFrame={40}
            charsPerFrame={0.8}
            fontSize={54}
            color={theme.ink}
            cursorColor={theme.orange}
          />
          <div
            style={{
              fontFamily: fonts.term,
              fontSize: 36,
              color: theme.dim,
              marginTop: 18,
              letterSpacing: 3,
              opacity: interpolate(frame, [110, 125], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            ONE SENTENCE EACH. THEN EVERYONE VOTES. MOST VOTED IS OUT — IDENTITY REVEALED.
          </div>
        </div>

        {/* conditions de victoire */}
        <div
          style={{
            display: 'flex',
            gap: 50,
            opacity: winIn,
            transform: `translateY(${interpolate(winIn, [0, 1], [80, 0])}px)`,
          }}
        >
          <div
            style={{
              border: `4px solid ${theme.green}`,
              backgroundColor: `${theme.green}11`,
              padding: '30px 46px',
              textAlign: 'center',
            }}
          >
            <div style={{fontFamily: fonts.pixel, fontSize: 32, color: theme.green, letterSpacing: 3}}>
              HUMANS WIN
            </div>
            <div style={{fontFamily: fonts.term, fontSize: 34, color: theme.ink, marginTop: 12}}>
              EXPOSE EVERY AGENT
            </div>
          </div>
          <div
            style={{
              border: `4px solid ${theme.orange}`,
              backgroundColor: `${theme.orange}11`,
              padding: '30px 46px',
              textAlign: 'center',
            }}
          >
            <div style={{fontFamily: fonts.pixel, fontSize: 32, color: theme.orange, letterSpacing: 3}}>
              AN AGENT WINS
            </div>
            <div style={{fontFamily: fonts.term, fontSize: 34, color: theme.ink, marginTop: 12}}>
              SURVIVE TO THE END
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

// les agents ne sont pas une equipe : les liens se brisent
const Solo: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const agents = AGENT_SET.map((i) => PLAYERS[i]);
  const breakAt = 90;
  const broken = frame >= breakAt;
  const shake = broken && frame < breakAt + 8 ? (frame % 2 ? 8 : -8) : 0;

  return (
    <Backdrop tint={broken ? theme.red : theme.orange} glow={0.5}>
      <SectionTag index="02" label="THE SOLUTION" />
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          gap: 70,
          transform: `translateX(${shake}px)`,
        }}
      >
        <div style={{fontFamily: fonts.pixel, fontSize: 46, color: theme.ink, letterSpacing: 4}}>
          ONE MORE THING.
        </div>

        <div style={{display: 'flex', alignItems: 'center', gap: 0}}>
          {agents.map((p, i) => {
            const cardIn = spring({frame: frame - 10 - i * 6, fps, config: {damping: 12}});
            return (
              <React.Fragment key={p.name}>
                <div
                  style={{
                    width: 220,
                    padding: 18,
                    backgroundColor: theme.card,
                    border: `3px solid ${theme.orange}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 10,
                    transform: `scale(${cardIn})`,
                    opacity: cardIn,
                  }}
                >
                  <Img
                    src={staticFile(p.avatar)}
                    style={{width: 120, height: 120, imageRendering: 'pixelated'}}
                  />
                  <div style={{fontFamily: fonts.pixel, fontSize: 18, color: theme.orange}}>
                    AGENT
                  </div>
                </div>
                {i < agents.length - 1 && (
                  <div style={{width: 120, position: 'relative', height: 60}}>
                    {/* lien pointille qui se fait couper */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 28,
                        width: '100%',
                        borderTop: `5px dashed ${broken ? theme.cardBorder : theme.gold}`,
                        opacity: broken ? 0.3 : interpolate(frame, [50, 65], [0, 1], {
                          extrapolateLeft: 'clamp',
                          extrapolateRight: 'clamp',
                        }),
                      }}
                    />
                    {broken && (
                      <div
                        style={{
                          position: 'absolute',
                          left: '50%',
                          top: 2,
                          transform: 'translateX(-50%)',
                          fontFamily: fonts.pixel,
                          fontSize: 44,
                          color: theme.red,
                          textShadow: `0 0 20px ${theme.red}88`,
                        }}
                      >
                        ✕
                      </div>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {broken && (
          <Punch
            lines={[
              [{t: 'NOT A TEAM. '}, {t: 'NO COORDINATION.', c: theme.red}],
              [{t: 'EVERY PLAYER IS '}, {t: 'ON THEIR OWN.', c: theme.orange}],
            ]}
            start={8}
            gap={22}
            fontSize={50}
          />
        )}
      </AbsoluteFill>
    </Backdrop>
  );
};

export const Solution: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={500}>
        <Concept />
      </Series.Sequence>
      <Series.Sequence durationInFrames={560}>
        <Loop />
      </Series.Sequence>
      <Series.Sequence durationInFrames={400}>
        <Solo />
      </Series.Sequence>
    </Series>
  );
};
