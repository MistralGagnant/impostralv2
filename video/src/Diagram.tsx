import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {theme, fonts, PLAYERS} from './theme';

// poster explicatif fixe : l'architecture reelle du repo, dans la da du jeu
// canvas 2400x1700, rendu en still --scale=2

const ACCENTS = {
  client: '#2DAAFF',
  server: theme.ink,
  engine: theme.orange,
  agents: theme.gold,
  voice: theme.green,
  stats: theme.red,
};

const Box: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  accent: string;
  children?: React.ReactNode;
}> = ({x, y, w, h, title, sub, accent, children}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: w,
      height: h,
      backgroundColor: `${theme.card}F2`,
      border: `4px solid ${accent}`,
      boxShadow: `0 0 34px ${accent}33, 0 10px 0 #00000066`,
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 18,
        padding: '20px 26px 12px',
        borderBottom: `3px solid ${accent}44`,
      }}
    >
      <div style={{width: 14, height: 14, backgroundColor: accent}} />
      <div style={{fontFamily: fonts.pixel, fontSize: 26, color: accent, letterSpacing: 3}}>
        {title}
      </div>
      {sub && (
        <div style={{fontFamily: fonts.term, fontSize: 24, color: theme.dim, letterSpacing: 2}}>
          {sub}
        </div>
      )}
    </div>
    <div style={{padding: '16px 26px'}}>{children}</div>
  </div>
);

const Line: React.FC<{text: React.ReactNode; c?: string}> = ({text, c}) => (
  <div
    style={{
      fontFamily: fonts.term,
      fontSize: 26,
      color: c ?? theme.ink,
      letterSpacing: 1,
      lineHeight: 1.4,
    }}
  >
    {text}
  </div>
);

const Chip: React.FC<{text: string; c: string}> = ({text, c}) => (
  <div
    style={{
      display: 'inline-block',
      fontFamily: fonts.term,
      fontSize: 23,
      color: c,
      border: `2px solid ${c}66`,
      backgroundColor: `${c}11`,
      padding: '2px 12px',
      marginRight: 10,
      marginBottom: 8,
      letterSpacing: 1,
    }}
  >
    {text}
  </div>
);

// fleche pixel en pointilles, horizontale ou verticale
const Arrow: React.FC<{
  x: number;
  y: number;
  length: number;
  dir: 'right' | 'left' | 'down' | 'up' | 'both-h' | 'both-v';
  color: string;
  label?: string;
}> = ({x, y, length, dir, color, label}) => {
  const horizontal = dir === 'right' || dir === 'left' || dir === 'both-h';
  const n = Math.floor(length / 26);
  return (
    <div style={{position: 'absolute', left: x, top: y}}>
      <div
        style={{
          display: 'flex',
          flexDirection: horizontal ? 'row' : 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {(dir === 'left' || dir === 'both-h') && (
          <div style={{fontFamily: fonts.pixel, fontSize: 26, color}}>◀</div>
        )}
        {(dir === 'up' || dir === 'both-v') && (
          <div style={{fontFamily: fonts.pixel, fontSize: 26, color}}>▲</div>
        )}
        {Array.from({length: n}, (_, i) => (
          <div
            key={i}
            style={{
              width: horizontal ? 14 : 8,
              height: horizontal ? 8 : 14,
              backgroundColor: color,
              opacity: 0.85,
            }}
          />
        ))}
        {(dir === 'right' || dir === 'both-h') && (
          <div style={{fontFamily: fonts.pixel, fontSize: 26, color}}>▶</div>
        )}
        {(dir === 'down' || dir === 'both-v') && (
          <div style={{fontFamily: fonts.pixel, fontSize: 26, color}}>▼</div>
        )}
      </div>
      {label && (
        <div
          style={{
            position: 'absolute',
            top: horizontal ? -38 : length / 2 - 16,
            left: horizontal ? length / 2 - 90 : 34,
            width: 220,
            fontFamily: fonts.term,
            fontSize: 24,
            color,
            letterSpacing: 1,
            textAlign: horizontal ? 'center' : 'left',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

const phaseNode = (label: string, sub: string, c: string) => (
  <div style={{textAlign: 'center'}}>
    <div
      style={{
        fontFamily: fonts.pixel,
        fontSize: 24,
        color: theme.bg,
        backgroundColor: c,
        border: `3px solid ${c}`,
        padding: '16px 22px',
        letterSpacing: 2,
      }}
    >
      {label}
    </div>
    <div style={{fontFamily: fonts.term, fontSize: 23, color: theme.dim, marginTop: 8}}>{sub}</div>
  </div>
);

export const Diagram: React.FC = () => {
  const agents = [
    {avatar: PLAYERS[1].avatar, model: 'mistral-large', persona: 'THE ANALYST', c: '#2DAAFF'},
    {avatar: PLAYERS[2].avatar, model: 'mistral-medium', persona: 'THE SOCIAL ONE', c: theme.gold},
    {avatar: PLAYERS[4].avatar, model: 'mistral-small', persona: 'THE SKEPTIC', c: theme.red},
    {avatar: PLAYERS[5].avatar, model: 'ministral-8b', persona: 'THE DREAMER', c: theme.green},
  ];

  return (
    <AbsoluteFill style={{backgroundColor: theme.bg, overflow: 'hidden'}}>
      {/* grille + lueur, la meme ambiance que les videos */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${theme.cardBorder}44 1px, transparent 1px), linear-gradient(90deg, ${theme.cardBorder}44 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
          opacity: 0.4,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${theme.orange}14 0%, transparent 55%)`,
        }}
      />

      {/* ---------------- header ---------------- */}
      <Img
        src={staticFile('impostral.png')}
        style={{position: 'absolute', left: 60, top: 26, width: 560}}
      />
      <div
        style={{
          position: 'absolute',
          left: 680,
          top: 64,
          maxWidth: 1380,
          lineHeight: 1.5,
          fontFamily: fonts.pixel,
          fontSize: 28,
          color: theme.ink,
          letterSpacing: 4,
        }}
      >
        HOW IT WORKS —{' '}
        <span style={{color: theme.orange}}>HUMANS VS MISTRAL AGENTS, ONE SHARED ROOM</span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 683,
          top: 158,
          fontFamily: fonts.term,
          fontSize: 28,
          color: theme.dim,
          letterSpacing: 2,
        }}
      >
        2 HUMANS + 4 AI AGENTS · NOBODY SEES THE ROLES · ONE ELIMINATION PER ROUND
      </div>
      <Img
        src={staticFile('logo.png')}
        style={{position: 'absolute', right: 60, top: 10, width: 190, imageRendering: 'pixelated'}}
      />

      {/* ---------------- row 1 ---------------- */}
      <Box x={50} y={230} w={560} h={560} title="CLIENT" sub="web/ · vanilla js" accent={ACCENTS.client}>
        <div style={{display: 'flex', gap: 20, marginBottom: 14}}>
          {[PLAYERS[0], PLAYERS[3]].map((p, i) => (
            <div
              key={i}
              style={{
                border: `3px solid ${theme.cardBorder}`,
                backgroundColor: theme.bg2,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Img
                src={staticFile(p.avatar)}
                style={{width: 90, height: 90, imageRendering: 'pixelated'}}
              />
              <div style={{fontFamily: fonts.term, fontSize: 22, color: ACCENTS.client}}>
                HUMAN TAB
              </div>
            </div>
          ))}
          <div style={{flex: 1}}>
            <Line text="one browser tab per human player" />
            <Line text="radial arena UI + countdowns" c={theme.dim} />
            <Line text="mic capture, audio playback" c={theme.dim} />
          </div>
        </div>
        <Chip text="join lobby" c={ACCENTS.client} />
        <Chip text="ready up" c={ACCENTS.client} />
        <Chip text="speak / type answer" c={ACCENTS.client} />
        <Chip text="secret vote" c={ACCENTS.client} />
        <div style={{marginTop: 12}}>
          <Line
            text={
              <>
                <span style={{color: ACCENTS.stats}}>stats.html</span> — live model comparison
                dashboard
              </>
            }
            c={theme.dim}
          />
        </div>
      </Box>

      <Box
        x={760}
        y={230}
        w={560}
        h={560}
        title="SERVER"
        sub="app/main.py · fastapi + websockets"
        accent={ACCENTS.server}
      >
        <Line text={<><span style={{color: theme.orange}}>POST /lobby</span> creates a room · seats: humans + 4 agents</>} />
        <Line text={<><span style={{color: theme.orange}}>rooms.py</span> routes every seat the same way</>} />
        <Line
          text={<span style={{color: ACCENTS.stats}}>roles are never sent over the wire (events.py)</span>}
        />
        <div style={{marginTop: 16, marginBottom: 6}}>
          <Line text="client ▶ server" c={ACCENTS.client} />
        </div>
        <Chip text="join" c={ACCENTS.client} />
        <Chip text="ready" c={ACCENTS.client} />
        <Chip text="audio_blob" c={ACCENTS.client} />
        <Chip text="submit_vote" c={ACCENTS.client} />
        <div style={{marginTop: 12, marginBottom: 6}}>
          <Line text="server ▶ client" c={theme.orange} />
        </div>
        <Chip text="room_state" c={theme.orange} />
        <Chip text="phase_change" c={theme.orange} />
        <Chip text="utterance" c={theme.orange} />
        <Chip text="request_input" c={theme.orange} />
        <Chip text="vote_result" c={theme.orange} />
        <Chip text="elimination" c={theme.orange} />
        <Chip text="game_over" c={theme.orange} />
      </Box>

      <Box
        x={1470}
        y={230}
        w={880}
        h={560}
        title="GAME ENGINE"
        sub="app/game/state_machine.py"
        accent={ACCENTS.engine}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '10px 10px 0',
          }}
        >
          {phaseNode('QUESTION', '45s · same open question', ACCENTS.engine)}
          <div style={{fontFamily: fonts.pixel, fontSize: 30, color: ACCENTS.engine, marginTop: 20}}>
            ▶
          </div>
          {phaseNode('VOTE', '30s · every seat votes', ACCENTS.engine)}
          <div style={{fontFamily: fonts.pixel, fontSize: 30, color: ACCENTS.engine, marginTop: 20}}>
            ▶
          </div>
          {phaseNode('RESOLUTION', '1 seat out · role revealed', ACCENTS.stats)}
        </div>
        <div
          style={{
            fontFamily: fonts.term,
            fontSize: 24,
            color: theme.dim,
            textAlign: 'center',
            margin: '10px 0 16px',
          }}
        >
          ◀ ── repeats up to 5 rounds ── ▶
        </div>
        <Line
          text={
            <>
              answers buffered for the full window, then revealed{' '}
              <span style={{color: theme.orange}}>grouped, in random order</span> (1.2s cadence)
            </>
          }
        />
        <Line text={<>tied ballot ▶ <span style={{color: theme.orange}}>runoff</span> between tied seats · persistent tie broken randomly</>} />
        <div
          style={{
            marginTop: 16,
            border: `3px solid ${ACCENTS.engine}55`,
            backgroundColor: `${ACCENTS.engine}0D`,
            padding: '12px 18px',
          }}
        >
          <Line text={<><span style={{color: theme.green}}>humans win</span> — every agent exposed</>} />
          <Line text={<><span style={{color: theme.orange}}>an agent wins</span> — last AI eliminated · undetected AIs tie at round 5</>} />
        </div>
      </Box>

      {/* ---------------- row 2 ---------------- */}
      <Box
        x={50}
        y={900}
        w={1270}
        h={350}
        title="VOICE ANONYMIZATION"
        sub="app/audio/ · the fairness layer"
        accent={ACCENTS.voice}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 16, marginTop: 10}}>
          {[
            {t: 'MIC / AGENT TEXT', s: 'any seat speaks'},
            {t: 'VOXTRAL STT', s: 'voxtral-mini-latest'},
            {t: 'TRANSCRIPT', s: 'the only signal left'},
            {t: 'VOXTRAL TTS', s: 'voxtral-mini-tts'},
            {t: 'SAME VOICE PER SEAT', s: 'fixed preset voice'},
          ].map((n, i, arr) => (
            <React.Fragment key={n.t}>
              <div style={{textAlign: 'center', flex: 1}}>
                <div
                  style={{
                    fontFamily: fonts.pixel,
                    fontSize: 19,
                    color: i === 2 ? theme.bg : ACCENTS.voice,
                    backgroundColor: i === 2 ? ACCENTS.voice : `${ACCENTS.voice}11`,
                    border: `3px solid ${ACCENTS.voice}`,
                    padding: '14px 10px',
                    letterSpacing: 1,
                  }}
                >
                  {n.t}
                </div>
                <div style={{fontFamily: fonts.term, fontSize: 22, color: theme.dim, marginTop: 6}}>
                  {n.s}
                </div>
              </div>
              {i < arr.length - 1 && (
                <div style={{fontFamily: fonts.pixel, fontSize: 24, color: ACCENTS.voice}}>▶</div>
              )}
            </React.Fragment>
          ))}
        </div>
        <div style={{marginTop: 18}}>
          <Chip text="no real voices" c={ACCENTS.voice} />
          <Chip text="no timing tells" c={ACCENTS.voice} />
          <Chip text="random reveal order" c={ACCENTS.voice} />
          <Chip text="ephemeral FIFO store · /audio/{id}" c={theme.dim} />
          <Chip text="graceful text-only fallback (mock mode)" c={theme.dim} />
        </div>
      </Box>

      <Box
        x={50}
        y={1330}
        w={1270}
        h={290}
        title="MODEL TRACKING"
        sub="app/game/stats.py · behavioral evaluation"
        accent={ACCENTS.stats}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 24, marginTop: 8}}>
          <div
            style={{
              fontFamily: fonts.term,
              fontSize: 26,
              color: theme.ink,
              border: `3px solid ${theme.cardBorder}`,
              backgroundColor: theme.bg2,
              padding: '12px 20px',
            }}
          >
            every game ▶ data/results.jsonl
          </div>
          <div style={{fontFamily: fonts.pixel, fontSize: 24, color: ACCENTS.stats}}>▶</div>
          <div style={{flex: 1}}>
            <Chip text="wins" c={ACCENTS.stats} />
            <Chip text="survival" c={ACCENTS.stats} />
            <Chip text="elimination round" c={ACCENTS.stats} />
            <Chip text="vote accuracy" c={ACCENTS.stats} />
            <Line
              text={<>aggregated at <span style={{color: ACCENTS.stats}}>/stats</span> · per-model dashboard — same room, same rules, different models</>}
              c={theme.dim}
            />
          </div>
        </div>
      </Box>

      <Box
        x={1470}
        y={900}
        w={880}
        h={720}
        title="MISTRAL AGENTS"
        sub="app/agents/llm_agent.py"
        accent={ACCENTS.agents}
      >
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 6}}>
          {agents.map((a) => (
            <div
              key={a.model}
              style={{
                border: `3px solid ${a.c}`,
                backgroundColor: `${a.c}0D`,
                padding: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <Img
                src={staticFile(a.avatar)}
                style={{width: 84, height: 84, imageRendering: 'pixelated'}}
              />
              <div>
                <div style={{fontFamily: fonts.pixel, fontSize: 18, color: a.c, letterSpacing: 1}}>
                  {a.persona}
                </div>
                <div style={{fontFamily: fonts.term, fontSize: 24, color: theme.ink, marginTop: 6}}>
                  {a.model}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{marginTop: 14}}>
          <Line text="own persona · own temperature · own few-shot examples" />
          <Line text={<span style={{color: ACCENTS.stats}}>no shared strategy — agents only ever see the transcript</span>} />
        </div>
        <div
          style={{
            marginTop: 14,
            border: `3px solid ${theme.cardBorder}`,
            backgroundColor: '#07070C',
            padding: '14px 20px',
            fontFamily: fonts.term,
            fontSize: 25,
            lineHeight: 1.45,
            letterSpacing: 1,
          }}
        >
          <span style={{color: theme.dim}}>guided JSON schema — every reply:</span>
          <br />
          <span style={{color: theme.ink}}>{'{'}</span>
          <span style={{color: ACCENTS.stats}}> "thinking"</span>
          <span style={{color: theme.dim}}>: private reasoning,</span>
          <span style={{color: ACCENTS.voice}}> "output"</span>
          <span style={{color: theme.dim}}>: public, ≤100 chars </span>
          <span style={{color: theme.ink}}>{'}'}</span>
          <br />
          <span style={{color: theme.dim}}>only the output enters the transcript</span>
        </div>
        <div style={{marginTop: 14}}>
          <Chip text="answers the question" c={ACCENTS.agents} />
          <Chip text="challenges players" c={ACCENTS.agents} />
          <Chip text="casts its own vote" c={ACCENTS.agents} />
          <Chip text="mock fallback without api key" c={theme.dim} />
        </div>
      </Box>

      {/* ---------------- fleches ---------------- */}
      <Arrow x={618} y={480} length={110} dir="both-h" color={ACCENTS.client} label="websocket" />
      <Arrow x={1330} y={480} length={110} dir="both-h" color={ACCENTS.engine} label="phases" />
      <Arrow x={2170} y={800} length={70} dir="both-v" color={ACCENTS.agents} label="answers + votes" />
      <Arrow x={320} y={800} length={70} dir="down" color={ACCENTS.voice} label="speech in" />
      <Arrow x={1010} y={800} length={70} dir="up" color={ACCENTS.voice} label="synthetic voice out" />
      <Arrow x={1330} y={1470} length={110} dir="left" color={ACCENTS.stats} label="game records" />

      {/* pied de page */}
      <div
        style={{
          position: 'absolute',
          right: 70,
          bottom: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{display: 'flex', flexDirection: 'column', gap: 2}}>
          {['#FFD800', '#FFAF00', '#FF8205', '#FA500F', '#E10500'].map((c) => (
            <div key={c} style={{width: 34, height: 6, backgroundColor: c}} />
          ))}
        </div>
        <div style={{fontFamily: fonts.pixel, fontSize: 20, color: theme.dim, letterSpacing: 3}}>
          POWERED BY MISTRAL
        </div>
      </div>
    </AbsoluteFill>
  );
};
