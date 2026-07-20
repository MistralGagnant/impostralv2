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
import {Waveform} from './components/Waveform';
import {theme, PLAYERS} from './theme';

const rand = (seed: number) => {
  const x = Math.sin(seed * 91.7 + 47.3) * 43758.5453;
  return x - Math.floor(x);
};

// icones pixel dessinees en bitmap, pour rester 100% illustration sans texte
const BITMAPS: Record<string, string[]> = {
  play: ['.X......', '.XXX....', '.XXXXX..', '.XXXXXX.', '.XXXXX..', '.XXX....', '.X......'],
  gem: ['..XXXXXX..', '.X.XXXX.X.', 'XXXXXXXXXX', '.XXXXXXXX.', '..XXXXXX..', '...XXXX...', '....XX....'],
  trophy: [
    'XXXXXXXXXX',
    'X.XXXXXX.X',
    'X.XXXXXX.X',
    '.XXXXXXXX.',
    '..XXXXXX..',
    '...XXXX...',
    '....XX....',
    '...XXXX...',
    '..XXXXXX..',
  ],
  gear: [
    '...XXXX...',
    '.X.XXXX.X.',
    '.XXXXXXXX.',
    'XXXX..XXXX',
    'XXX....XXX',
    'XXX....XXX',
    'XXXX..XXXX',
    '.XXXXXXXX.',
    '.X.XXXX.X.',
    '...XXXX...',
  ],
  crown: ['X...XX...X', 'XX.XXXX.XX', 'XXXXXXXXXX', 'XXXXXXXXXX', '.XXXXXXXX.', '.XXXXXXXX.'],
  heart: [
    '.XX....XX.',
    'XXXX..XXXX',
    'XXXXXXXXXX',
    'XXXXXXXXXX',
    '.XXXXXXXX.',
    '..XXXXXX..',
    '...XXXX...',
    '....XX....',
  ],
  question: [
    '..XXXX..',
    '.XX..XX.',
    '.XX..XX.',
    '....XX..',
    '...XX...',
    '...XX...',
    '........',
    '...XX...',
  ],
  cross: [
    'XX......XX',
    'XXX....XXX',
    '.XXX..XXX.',
    '..XXXXXX..',
    '...XXXX...',
    '..XXXXXX..',
    '.XXX..XXX.',
    'XXX....XXX',
    'XX......XX',
  ],
};

const PixelIcon: React.FC<{name: keyof typeof BITMAPS; size?: number; color: string; glow?: boolean}> = ({
  name,
  size = 12,
  color,
  glow = false,
}) => {
  const map = BITMAPS[name];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        filter: glow ? `drop-shadow(0 0 14px ${color})` : undefined,
      }}
    >
      {map.map((row, y) => (
        <div key={y} style={{display: 'flex'}}>
          {row.split('').map((c, x) => (
            <div
              key={x}
              style={{width: size, height: size, backgroundColor: c === 'X' ? color : 'transparent'}}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

// mini salle de jeu : un cadre avec 2-3 avatars dedans, aucun texte
const MiniRoom: React.FC<{seed: number; width: number; lit?: boolean}> = ({seed, width, lit = false}) => {
  const n = 2 + Math.floor(rand(seed) * 2);
  const avatars = Array.from({length: n}, (_, i) => PLAYERS[Math.floor(rand(seed * 7 + i) * 6)].avatar);
  return (
    <div
      style={{
        width,
        padding: width * 0.07,
        backgroundColor: theme.card,
        border: `3px solid ${lit ? theme.orange : theme.cardBorder}`,
        boxShadow: lit ? `0 0 24px ${theme.orange}44` : '0 5px 0 #00000055',
        display: 'flex',
        justifyContent: 'center',
        gap: width * 0.06,
      }}
    >
      {avatars.map((a, i) => (
        <Img
          key={i}
          src={staticFile(a)}
          style={{width: width * 0.26, height: width * 0.26, imageRendering: 'pixelated'}}
        />
      ))}
    </div>
  );
};

// s1 : une partie devient une constellation de parties (le jeu ne s'arrete pas la)
const OneRoomToMany: React.FC = () => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [30, 170], [2.4, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const rooms = Array.from({length: 24}, (_, i) => ({
    x: (i % 6) * 330 + 40,
    y: Math.floor(i / 6) * 260 + 30,
    at: 40 + rand(i) * 110,
  }));

  return (
    <Backdrop glow={0.5}>
      <AbsoluteFill style={{transform: `scale(${zoom})`, transformOrigin: '50% 46%'}}>
        {rooms.map((r, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: r.x,
              top: r.y,
              opacity: interpolate(frame, [r.at, r.at + 14], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            <MiniRoom seed={i + 3} width={280} lit={rand(i * 3) > 0.6} />
          </div>
        ))}
        {/* la salle d'origine au centre, en avant */}
        <div
          style={{
            position: 'absolute',
            left: 960 - 210,
            top: 460 - 90,
            transform: 'scale(1.5)',
            filter: `drop-shadow(0 0 40px ${theme.orange}66)`,
          }}
        >
          <MiniRoom seed={999} width={420} lit />
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

// s2 : le monde des benchmarks statiques, gris, fige, scanne
const StaticWorld: React.FC = () => {
  const frame = useCurrentFrame();
  const scanY = (frame * 6) % 1080;

  return (
    <Backdrop tint={theme.dim} glow={0.15}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 90, flexDirection: 'row'}}>
        {/* barres figees qui tremblent a peine sans jamais bouger */}
        <div style={{display: 'flex', alignItems: 'flex-end', gap: 26}}>
          {[220, 340, 160, 290, 250].map((h, i) => {
            const stuck = h + Math.sin(frame * 0.4 + i) * 2;
            return (
              <div
                key={i}
                style={{
                  width: 64,
                  height: stuck,
                  backgroundColor: theme.cardBorder,
                  border: `3px solid ${theme.dim}55`,
                }}
              />
            );
          })}
        </div>

        {/* pile de documents gris */}
        <div style={{display: 'flex', flexDirection: 'column', gap: 18}}>
          {Array.from({length: 4}, (_, i) => (
            <div
              key={i}
              style={{
                width: 380,
                padding: 22,
                backgroundColor: theme.card,
                border: `3px solid ${theme.cardBorder}`,
                opacity: 0.8,
              }}
            >
              {Array.from({length: 3}, (_, l) => (
                <div
                  key={l}
                  style={{
                    height: 12,
                    width: `${50 + rand(i * 5 + l) * 45}%`,
                    backgroundColor: theme.cardBorder,
                    marginBottom: 12,
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* un avatar grise, immobile, mesure par un scan */}
        <div style={{position: 'relative'}}>
          <Img
            src={staticFile(PLAYERS[1].avatar)}
            style={{
              width: 320,
              height: 320,
              imageRendering: 'pixelated',
              filter: 'grayscale(1) brightness(0.8)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: -30,
              right: -30,
              top: ((frame * 3) % 380) - 30,
              height: 5,
              backgroundColor: theme.dim,
              opacity: 0.8,
            }}
          />
        </div>
      </AbsoluteFill>
      {/* grand scan horizontal froid sur tout l'ecran */}
      <AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            top: scanY,
            width: '100%',
            height: 3,
            backgroundColor: `${theme.dim}66`,
          }}
        />
      </AbsoluteFill>
    </Backdrop>
  );
};

// s3 : l'arene — quatre agents differents, quatre salles identiques, memes conditions
const Arena: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const contenders = [
    {a: PLAYERS[1].avatar, c: '#2DAAFF'},
    {a: PLAYERS[2].avatar, c: theme.gold},
    {a: PLAYERS[4].avatar, c: theme.red},
    {a: PLAYERS[5].avatar, c: theme.green},
  ];
  const pulse = 1 + 0.03 * Math.sin(frame * 0.25);

  return (
    <Backdrop glow={0.55}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 46}}>
        <div style={{display: 'flex', gap: 44}}>
          {contenders.map((k, i) => {
            const drop = spring({frame: frame - 20 - i * 8, fps, config: {damping: 12}});
            const litSync = frame > 120 && Math.floor(frame / 22) % 2 === 0;
            return (
              <div
                key={i}
                style={{
                  width: 360,
                  height: 560,
                  backgroundColor: theme.card,
                  border: `4px solid ${litSync ? theme.orange : theme.cardBorder}`,
                  boxShadow: litSync ? `0 0 34px ${theme.orange}44` : '0 8px 0 #00000066',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 30,
                  transform: `scale(${pulse})`,
                }}
              >
                {/* le meme motif dans chaque salle : conditions identiques */}
                <div style={{display: 'flex', gap: 12}}>
                  {[0, 1, 2].map((d) => (
                    <div key={d} style={{width: 26, height: 26, backgroundColor: theme.cardBorder}} />
                  ))}
                </div>
                <div
                  style={{
                    transform: `translateY(${interpolate(drop, [0, 1], [-500, 0])}px)`,
                    filter: `drop-shadow(0 0 30px ${k.c})`,
                  }}
                >
                  <Img
                    src={staticFile(k.a)}
                    style={{width: 220, height: 220, imageRendering: 'pixelated'}}
                  />
                </div>
                <Waveform width={220} height={40} bars={12} color={k.c} seed={i * 5} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

// s4 : quatre vignettes — survie, adaptation, persuasion, resistance au scan
const Metrics: React.FC = () => {
  const frame = useCurrentFrame();
  const phase = Math.floor(frame / 80); // 4 x 80 frames
  const local = frame % 80;

  // 1. survie : esquiver les croix qui tombent
  if (phase === 0) {
    const dodge = Math.sin(local * 0.12) * 320;
    return (
      <Backdrop tint={theme.red} glow={0.5}>
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          {Array.from({length: 8}, (_, i) => {
            const fall = ((local * (7 + rand(i) * 5) + rand(i * 3) * 900) % 1000) - 120;
            return (
              <div key={i} style={{position: 'absolute', left: 250 + rand(i * 9) * 1420, top: fall}}>
                <PixelIcon name="cross" size={9} color={theme.red} />
              </div>
            );
          })}
          <div style={{transform: `translateX(${dodge}px)`, marginTop: 300}}>
            <Img
              src={staticFile(PLAYERS[3].avatar)}
              style={{width: 260, height: 260, imageRendering: 'pixelated'}}
            />
          </div>
        </AbsoluteFill>
      </Backdrop>
    );
  }

  // 2. adaptation : la piece change, l'avatar change avec elle
  if (phase === 1) {
    const mood = Math.floor(local / 27) % 3;
    const tints = [theme.orange, '#2DAAFF', theme.green];
    const hues = ['0deg', '160deg', '260deg'];
    return (
      <Backdrop tint={tints[mood]} glow={0.7}>
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <div
            style={{
              padding: 60,
              border: `6px solid ${tints[mood]}`,
              backgroundColor: `${tints[mood]}11`,
              boxShadow: `0 0 60px ${tints[mood]}44`,
            }}
          >
            <Img
              src={staticFile(PLAYERS[2].avatar)}
              style={{
                width: 300,
                height: 300,
                imageRendering: 'pixelated',
                filter: `hue-rotate(${hues[mood]})`,
              }}
            />
          </div>
        </AbsoluteFill>
      </Backdrop>
    );
  }

  // 3. persuasion : un avatar parle, les autres tombent sous le charme
  if (phase === 2) {
    return (
      <Backdrop tint={theme.gold} glow={0.6}>
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 90}}>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20}}>
            <Img
              src={staticFile(PLAYERS[5].avatar)}
              style={{width: 300, height: 300, imageRendering: 'pixelated'}}
            />
            <Waveform width={240} height={50} bars={14} color={theme.gold} seed={2} />
          </div>
          {[PLAYERS[0], PLAYERS[3]].map((p, i) => {
            const lean = Math.min(30, local * 0.8);
            const heartUp = ((local * 3 + i * 40) % 120);
            return (
              <div key={i} style={{position: 'relative', transform: `translateX(${-lean}px)`}}>
                <Img
                  src={staticFile(p.avatar)}
                  style={{width: 210, height: 210, imageRendering: 'pixelated'}}
                />
                <div style={{position: 'absolute', top: -heartUp, left: 70, opacity: 1 - heartUp / 120}}>
                  <PixelIcon name="heart" size={7} color={theme.orange} glow />
                </div>
              </div>
            );
          })}
        </AbsoluteFill>
      </Backdrop>
    );
  }

  // 4. resistance : le radar balaie, l'avatar passe inapercu
  const beamX = ((local * 30) % 2200) - 150;
  const nearBeam = Math.abs(beamX - 960) < 260;
  return (
    <Backdrop tint={theme.green} glow={0.4}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div
          style={{
            position: 'absolute',
            left: beamX,
            top: 0,
            width: 14,
            height: 1080,
            background: `linear-gradient(180deg, transparent, ${theme.green}AA, transparent)`,
          }}
        />
        <div style={{filter: nearBeam ? 'brightness(0.45)' : 'none'}}>
          <Img
            src={staticFile(PLAYERS[4].avatar)}
            style={{width: 300, height: 300, imageRendering: 'pixelated'}}
          />
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

// s5 : les parties se multiplient partout + amis, communautes, streamers, tournois
const Everywhere: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const icons: Array<{name: keyof typeof BITMAPS; c: string}> = [
    {name: 'heart', c: theme.red},
    {name: 'gem', c: '#2DAAFF'},
    {name: 'play', c: theme.green},
    {name: 'trophy', c: theme.gold},
  ];

  return (
    <Backdrop glow={0.55}>
      <AbsoluteFill>
        {/* fenetres de parties qui poppent partout */}
        {Array.from({length: 12}, (_, i) => {
          const at = 8 + i * 12;
          const s = spring({frame: frame - at, fps, config: {damping: 11, stiffness: 200}});
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 60 + rand(i * 11) * 1500,
                top: 40 + rand(i * 17) * 600,
                transform: `scale(${s}) rotate(${(rand(i) - 0.5) * 8}deg)`,
                opacity: s,
              }}
            >
              <MiniRoom seed={i * 13 + 1} width={230 + rand(i) * 120} lit={i % 3 === 0} />
            </div>
          );
        })}

        {/* les 4 pictos qui claquent en bas, un par beat */}
        <div
          style={{
            position: 'absolute',
            bottom: 70,
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            gap: 130,
          }}
        >
          {icons.map((ic, i) => {
            const at = 160 + i * 26;
            const s = spring({frame: frame - at, fps, config: {damping: 9, stiffness: 240}});
            return (
              <div
                key={ic.name}
                style={{
                  transform: `scale(${interpolate(s, [0, 1], [3, 1])})`,
                  opacity: s,
                }}
              >
                <PixelIcon name={ic.name} size={13} color={ic.c} glow />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

// s6 : la roadmap en plateformes, la mascotte saute de l'une a l'autre
const Roadmap: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const steps: Array<{name: keyof typeof BITMAPS; c: string}> = [
    {name: 'play', c: theme.green},
    {name: 'gem', c: theme.gold},
    {name: 'trophy', c: theme.orange},
    {name: 'gear', c: theme.red},
  ];
  const hopDur = 45;
  const seg = Math.min(Math.floor(frame / hopDur), 3);
  const t = Math.min((frame % hopDur) / 30, 1);
  const px = (i: number) => 330 + i * 430;
  const py = (i: number) => 760 - i * 110;
  const curX = seg >= 3 ? px(3) : px(seg) + (px(seg + 1) - px(seg)) * t;
  const arc = seg >= 3 ? 0 : Math.sin(t * Math.PI) * 180;
  const curY = (seg >= 3 ? py(3) : py(seg) + (py(seg + 1) - py(seg)) * t) - arc;

  return (
    <Backdrop glow={0.55}>
      <AbsoluteFill>
        {steps.map((s, i) => {
          const on = seg >= i;
          const sIn = spring({frame: frame - 4 - i * 6, fps, config: {damping: 12}});
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: px(i) - 150,
                top: py(i),
                width: 300,
                height: 110 + i * 30,
                backgroundColor: theme.card,
                border: `5px solid ${on ? s.c : theme.cardBorder}`,
                boxShadow: on ? `0 0 34px ${s.c}55` : '0 8px 0 #00000066',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${sIn})`,
              }}
            >
              <PixelIcon name={s.name} size={11} color={on ? s.c : theme.dim} glow={on} />
            </div>
          );
        })}
        {/* la mascotte qui progresse en sautant */}
        <Img
          src={staticFile('logo.png')}
          style={{
            position: 'absolute',
            left: curX - 90,
            top: curY - 150,
            width: 180,
            imageRendering: 'pixelated',
            filter: `drop-shadow(0 0 24px ${theme.orange}66)`,
          }}
        />
      </AbsoluteFill>
    </Backdrop>
  );
};

// s7 : face a face avec son double — l'un des deux glitche, on le vit
const Mirror: React.FC = () => {
  const frame = useCurrentFrame();
  const glitchStart = 110;
  const glitchy = frame > glitchStart && (frame % 23 < 4 || frame % 37 < 3);
  const sync = Math.sin(frame * 0.1) * 14;

  return (
    <Backdrop glow={0.5}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 60}}>
        <div style={{transform: `translateY(${sync}px)`}}>
          <Img
            src={staticFile(PLAYERS[0].avatar)}
            style={{width: 380, height: 380, imageRendering: 'pixelated'}}
          />
        </div>
        {/* le trait de separation, comme un miroir */}
        <div style={{width: 6, height: 640, backgroundColor: theme.cardBorder}} />
        <div
          style={{
            transform: `translateY(${frame > glitchStart ? -sync : sync}px) translateX(${glitchy ? 8 : 0}px) scaleX(-1)`,
          }}
        >
          <Img
            src={staticFile(PLAYERS[0].avatar)}
            style={{
              width: 380,
              height: 380,
              imageRendering: 'pixelated',
              filter: glitchy ? 'invert(1) hue-rotate(180deg)' : frame > glitchStart ? 'sepia(1) saturate(3) hue-rotate(-15deg)' : 'none',
            }}
          />
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

// s8 : la peur qui devient curiosite, uniquement par la couleur et la posture
const FearCuriosity: React.FC = () => {
  const frame = useCurrentFrame();
  const warm = interpolate(frame, [90, 150], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const crowd = [0, 2, 3, 5];

  return (
    <Backdrop tint={warm > 0.5 ? theme.orange : theme.red} glow={0.4 + warm * 0.4}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        {/* le masque qui domine */}
        <Img
          src={staticFile('logo.png')}
          style={{
            width: 460,
            imageRendering: 'pixelated',
            marginBottom: 120,
            filter:
              warm > 0.5
                ? `drop-shadow(0 0 60px ${theme.orange}88)`
                : `drop-shadow(0 0 60px ${theme.red}66) brightness(0.75)`,
            transform: `scale(${1 + Math.sin(frame * 0.06) * 0.03})`,
          }}
        />
        {/* la foule : recule en tremblant, puis se rapproche curieuse */}
        {crowd.map((p, i) => {
          const away = (1 - warm) * (90 + rand(i) * 60);
          const tremble = warm < 0.5 ? Math.sin(frame * 0.9 + i * 2) * 5 : 0;
          const closeIn = warm * (60 + rand(i * 3) * 40);
          const baseX = 420 + i * 360;
          return (
            <Img
              key={i}
              src={staticFile(PLAYERS[p].avatar)}
              style={{
                position: 'absolute',
                left: baseX + tremble,
                bottom: 40 - away + closeIn,
                width: 190,
                height: 190,
                imageRendering: 'pixelated',
                filter: warm < 0.5 ? 'brightness(0.6)' : 'brightness(1)',
              }}
            />
          );
        })}
      </AbsoluteFill>
    </Backdrop>
  );
};

// s9 : la couronne hesite entre le cerveau-machine et le plus humain, et choisit
const CrownScene: React.FC = () => {
  const frame = useCurrentFrame();
  const leftX = 620;
  const rightX = 1300;
  // la couronne descend sur la gauche, hesite, puis glisse a droite
  const crownX = interpolate(frame, [30, 80, 110, 150], [leftX, leftX, rightX, rightX], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const crownY = interpolate(frame, [10, 60, 110, 150], [-140, 240, 240, 330], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const landed = frame >= 150;

  return (
    <Backdrop glow={0.6}>
      <AbsoluteFill>
        {/* le candidat "machine" : entoure de circuits froids */}
        <div style={{position: 'absolute', left: leftX - 150, top: 420}}>
          <div
            style={{
              padding: 30,
              border: '4px solid #2DAAFF',
              boxShadow: '0 0 40px #2DAAFF33',
              position: 'relative',
            }}
          >
            <Img
              src={staticFile(PLAYERS[4].avatar)}
              style={{width: 240, height: 240, imageRendering: 'pixelated', filter: 'saturate(0.4)'}}
            />
            {Array.from({length: 5}, (_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: -40,
                  top: 30 + i * 50,
                  width: 34,
                  height: 5,
                  backgroundColor: '#2DAAFF',
                  opacity: frame % 17 < 9 ? 0.9 : 0.3,
                }}
              />
            ))}
          </div>
        </div>

        {/* le candidat "humain" : chaleureux, coeur qui bat */}
        <div style={{position: 'absolute', left: rightX - 150, top: 420}}>
          <div
            style={{
              padding: 30,
              border: `4px solid ${theme.orange}`,
              boxShadow: `0 0 40px ${theme.orange}44`,
              transform: `scale(${1 + Math.sin(frame * 0.18) * 0.02})`,
            }}
          >
            <Img
              src={staticFile(PLAYERS[2].avatar)}
              style={{width: 240, height: 240, imageRendering: 'pixelated'}}
            />
          </div>
        </div>

        {/* la couronne qui tranche */}
        <div
          style={{
            position: 'absolute',
            left: crownX - 55,
            top: crownY,
            filter: `drop-shadow(0 0 20px ${theme.gold})`,
            transform: landed ? `rotate(${Math.sin(frame * 0.3) * 3}deg)` : undefined,
          }}
        >
          <PixelIcon name="crown" size={11} color={theme.gold} />
        </div>

        {/* confettis quand elle se pose */}
        {landed &&
          Array.from({length: 16}, (_, i) => {
            const t = (frame - 150) / 22;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: rightX + (rand(i) - 0.5) * 500 * t,
                  top: 400 - 200 * t + 260 * t * t,
                  width: 12,
                  height: 12,
                  backgroundColor: [theme.gold, theme.orange, theme.ink][i % 3],
                  opacity: Math.max(0, 1 - t),
                }}
              />
            );
          })}
      </AbsoluteFill>
    </Backdrop>
  );
};

// s10 : l'engrenage-outil se brise, la mascotte prend un siege de joueur
const ToolToPlayer: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const breakAt = 70;
  const broken = frame >= breakAt;
  const jump = spring({frame: frame - breakAt, fps, config: {damping: 11, stiffness: 120}});
  const seats = [PLAYERS[0], PLAYERS[2], null, PLAYERS[3], PLAYERS[5]]; // le siege du milieu est vide

  return (
    <Backdrop glow={0.6}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 80}}>
        {/* l'engrenage qui explose en morceaux */}
        <div style={{position: 'relative', height: 220}}>
          {!broken ? (
            <div style={{opacity: 0.9}}>
              <PixelIcon name="gear" size={20} color={theme.dim} />
            </div>
          ) : (
            Array.from({length: 12}, (_, i) => {
              const t = (frame - breakAt) / 20;
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: 100 + (rand(i) - 0.5) * 700 * t,
                    top: 80 + (rand(i * 3) - 0.5) * 500 * t + 120 * t * t,
                    width: 22,
                    height: 22,
                    backgroundColor: theme.dim,
                    transform: `rotate(${rand(i) * 360 * t}deg)`,
                    opacity: Math.max(0, 1 - t * 0.9),
                  }}
                />
              );
            })
          )}
          {/* la mascotte saute hors de l'outil vers son siege */}
          <Img
            src={staticFile('logo.png')}
            style={{
              position: 'absolute',
              left: 30,
              top: interpolate(jump, [0, 1], [20, 240]) - Math.sin(jump * Math.PI) * 160,
              width: 170,
              imageRendering: 'pixelated',
              filter: `drop-shadow(0 0 24px ${theme.orange}77)`,
            }}
          />
        </div>

        {/* la rangee de sieges de joueurs */}
        <div style={{display: 'flex', gap: 30}}>
          {seats.map((p, i) => {
            const isMascot = p === null;
            const litUp = isMascot && frame > breakAt + 24;
            return (
              <div
                key={i}
                style={{
                  width: 230,
                  height: 250,
                  backgroundColor: theme.card,
                  border: `4px solid ${litUp ? theme.orange : theme.cardBorder}`,
                  boxShadow: litUp
                    ? `0 0 44px ${theme.orange}66`
                    : '0 8px 0 #00000066',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: litUp ? `scale(${1 + Math.sin(frame * 0.2) * 0.03})` : undefined,
                }}
              >
                {p ? (
                  <Img
                    src={staticFile(p.avatar)}
                    style={{width: 150, height: 150, imageRendering: 'pixelated'}}
                  />
                ) : (
                  litUp && (
                    <Img
                      src={staticFile('logo.png')}
                      style={{width: 170, imageRendering: 'pixelated'}}
                    />
                  )
                )}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

// s11 : tout le monde se tourne vers vous — et si l'impostor c'etait vous
const YouScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const flipAt = 110;
  const flip = spring({frame: frame - flipAt, fps, config: {damping: 13, stiffness: 110}});
  const deg = interpolate(flip, [0, 1], [0, 180]);
  const qIn = spring({frame: frame - flipAt - 40, fps, config: {damping: 9, stiffness: 220}});

  const cx = 960;
  const cy = 560;

  return (
    <Backdrop tint={theme.red} glow={0.6}>
      <AbsoluteFill>
        {/* le cercle des accusateurs, tous tournes vers le centre */}
        {PLAYERS.map((p, i) => {
          const ang = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(ang) * 560;
          const y = cy + Math.sin(ang) * 330;
          const closeIn = interpolate(frame, [20, flipAt], [0, 60], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <Img
              key={i}
              src={staticFile(p.avatar)}
              style={{
                position: 'absolute',
                left: x - 80 - Math.cos(ang) * closeIn,
                top: y - 80 - Math.sin(ang) * closeIn,
                width: 160,
                height: 160,
                imageRendering: 'pixelated',
                filter: frame > flipAt ? 'brightness(0.55)' : 'none',
              }}
            />
          );
        })}

        {/* votre carte au centre, qui se retourne et revele le masque */}
        <div style={{position: 'absolute', left: cx - 160, top: cy - 200, perspective: 1200}}>
          <div
            style={{
              width: 320,
              height: 400,
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
                border: `5px solid ${theme.cardBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Img
                src={staticFile(PLAYERS[3].avatar)}
                style={{width: 200, height: 200, imageRendering: 'pixelated'}}
              />
            </div>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                backgroundColor: '#1A0505',
                border: `5px solid ${theme.red}`,
                boxShadow: `0 0 70px ${theme.red}88`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Img
                src={staticFile('logo.png')}
                style={{width: 240, imageRendering: 'pixelated', filter: 'hue-rotate(-40deg) saturate(2)'}}
              />
            </div>
          </div>
        </div>

        {/* le grand point d'interrogation pixel */}
        <div
          style={{
            position: 'absolute',
            left: cx - 60,
            top: 60,
            transform: `scale(${interpolate(qIn, [0, 1], [3, 1])})`,
            opacity: qIn,
            filter: `drop-shadow(0 0 24px ${theme.red})`,
          }}
        >
          <PixelIcon name="question" size={15} color={theme.red} />
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

// s12 : le carton final, logo et drapeau, rien d'autre
const Logo: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const logoIn = spring({frame: frame - 12, fps, config: {damping: 11, stiffness: 160}});
  const flash = frame >= 16 && frame <= 18;

  return (
    <Backdrop glow={0.85}>
      {flash && <AbsoluteFill style={{backgroundColor: theme.ink, opacity: 0.8}} />}
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 50}}>
        <Img
          src={staticFile('logo.png')}
          style={{
            width: 300,
            imageRendering: 'pixelated',
            transform: `scale(${interpolate(logoIn, [0, 1], [0, 1])})`,
            filter: `drop-shadow(0 0 50px ${theme.orange}88)`,
          }}
        />
        <Img
          src={staticFile('impostral.png')}
          style={{
            width: 1000,
            transform: `scale(${interpolate(logoIn, [0, 1], [2.4, 1])})`,
            opacity: logoIn,
            filter: `drop-shadow(0 0 40px ${theme.orange}66)`,
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            opacity: interpolate(frame, [60, 80], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          {['#FFD800', '#FFAF00', '#FF8205', '#FA500F', '#E10500'].map((c) => (
            <div key={c} style={{width: 220, height: 12, backgroundColor: c}} />
          ))}
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

export const END_DURATION =
  180 + 240 + 280 + 320 + 280 + 240 + 220 + 220 + 220 + 220 + 240 + 240;

// impact + closing, 100% illustration : la voix off porte le texte
export const End: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={180}>
        <OneRoomToMany />
      </Series.Sequence>
      <Series.Sequence durationInFrames={240}>
        <StaticWorld />
      </Series.Sequence>
      <Series.Sequence durationInFrames={280}>
        <Arena />
      </Series.Sequence>
      <Series.Sequence durationInFrames={320}>
        <Metrics />
      </Series.Sequence>
      <Series.Sequence durationInFrames={280}>
        <Everywhere />
      </Series.Sequence>
      <Series.Sequence durationInFrames={240}>
        <Roadmap />
      </Series.Sequence>
      <Series.Sequence durationInFrames={220}>
        <Mirror />
      </Series.Sequence>
      <Series.Sequence durationInFrames={220}>
        <FearCuriosity />
      </Series.Sequence>
      <Series.Sequence durationInFrames={220}>
        <CrownScene />
      </Series.Sequence>
      <Series.Sequence durationInFrames={220}>
        <ToolToPlayer />
      </Series.Sequence>
      <Series.Sequence durationInFrames={240}>
        <YouScene />
      </Series.Sequence>
      <Series.Sequence durationInFrames={240}>
        <Logo />
      </Series.Sequence>
    </Series>
  );
};
