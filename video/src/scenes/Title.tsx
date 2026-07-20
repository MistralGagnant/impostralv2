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
import {theme, fonts} from '../theme';

// ecran d'accueil : logo qui claque, 4 stats qui tombent, boutons + mascotte qui espionne
export const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const logoIn = spring({frame, fps, config: {damping: 11, stiffness: 160}});
  const logoScale = interpolate(logoIn, [0, 1], [2.6, 1]);
  const flash = frame >= 4 && frame <= 6;

  const stats = [
    {n: '6', label: 'PLAYERS', color: theme.ink},
    {n: '2', label: 'HUMANS', color: theme.ink},
    {n: '4', label: 'AGENTS', color: theme.orange},
    {n: '1', label: 'SURVIVOR', color: theme.red},
  ];

  const buttonsIn = spring({frame: frame - 66, fps, config: {damping: 14}});
  // la mascotte monte doucement derriere le bouton create room
  const peek = interpolate(spring({frame: frame - 84, fps, config: {damping: 16}}), [0, 1], [0, 74]);

  return (
    <Backdrop glow={0.8}>
      {flash && <AbsoluteFill style={{backgroundColor: theme.ink, opacity: 0.7}} />}
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 46}}>
        <Img
          src={staticFile('impostral.png')}
          style={{
            width: 860,
            transform: `scale(${logoScale})`,
            opacity: logoIn,
            filter: `drop-shadow(0 0 30px ${theme.orange}88)`,
          }}
        />

        <div style={{display: 'flex', gap: 70}}>
          {stats.map((s, i) => {
            const d = 22 + i * 9;
            const sIn = spring({frame: frame - d, fps, config: {damping: 10, stiffness: 200}});
            return (
              <div
                key={s.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  transform: `scale(${interpolate(sIn, [0, 1], [2.2, 1])})`,
                  opacity: sIn,
                }}
              >
                <div style={{fontFamily: fonts.pixel, fontSize: 84, color: s.color}}>{s.n}</div>
                <div
                  style={{
                    fontFamily: fonts.pixel,
                    fontSize: 24,
                    color: theme.dim,
                    marginTop: 14,
                    letterSpacing: 3,
                  }}
                >
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 50,
            marginTop: 10,
            opacity: buttonsIn,
            transform: `translateY(${interpolate(buttonsIn, [0, 1], [60, 0])}px)`,
          }}
        >
          <div style={{position: 'relative'}}>
            {/* la mascotte depasse derriere le bouton et observe */}
            <Img
              src={staticFile('logo.png')}
              style={{
                position: 'absolute',
                width: 150,
                left: 100,
                top: -peek,
                imageRendering: 'pixelated',
              }}
            />
            <div
              style={{
                position: 'relative',
                fontFamily: fonts.pixel,
                fontSize: 30,
                color: theme.bg,
                backgroundColor: theme.orange,
                padding: '26px 44px',
                boxShadow: `0 8px 0 ${theme.orangeHot}`,
              }}
            >
              [ CREATE ROOM ]
            </div>
          </div>
          <div
            style={{
              fontFamily: fonts.pixel,
              fontSize: 30,
              color: theme.ink,
              border: `4px solid ${theme.cardBorder}`,
              padding: '22px 44px',
              backgroundColor: theme.card,
            }}
          >
            [ JOIN ROOM ]
          </div>
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};
