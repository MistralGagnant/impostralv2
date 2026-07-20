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
import {theme, fonts, PLAYERS} from '../theme';
import {Punch} from './Punch';

export const CLOSING_DURATION = 200 + 170 + 170 + 240 + 260;

// la peur qui se transforme en curiosite, avec un swap glitche
const FearToCuriosity: React.FC = () => {
  const frame = useCurrentFrame();
  const swapAt = 90;
  const swapped = frame >= swapAt;
  const glitching = Math.abs(frame - swapAt) < 6;

  return (
    <Backdrop tint={swapped ? theme.orange : theme.red} glow={0.6}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 50}}>
        <div style={{fontFamily: fonts.pixel, fontSize: 48, color: theme.ink, letterSpacing: 4}}>
          AI DETECTION IS USUALLY ABOUT
        </div>
        <div style={{transform: glitching ? `translateX(${frame % 2 ? 10 : -10}px)` : undefined}}>
          <GlitchTitle
            text={swapped ? 'CURIOSITY.' : 'FEAR.'}
            color={swapped ? theme.orange : theme.red}
            fontSize={130}
            intensity={glitching ? 2 : 0.6}
          />
        </div>
        {swapped && (
          <div
            style={{
              fontFamily: fonts.term,
              fontSize: 44,
              color: theme.dim,
              letterSpacing: 4,
              opacity: interpolate(frame, [swapAt + 30, swapAt + 45], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            WE MADE IT A GAME YOU WANT TO PLAY AGAIN.
          </div>
        )}
      </AbsoluteFill>
    </Backdrop>
  );
};

const MostHuman: React.FC = () => {
  return (
    <Backdrop glow={0.6}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <Punch
          lines={[
            [{t: "THE SMARTEST ANSWER DOESN'T WIN."}],
            [{t: 'THE MOST '}, {t: 'HUMAN', c: theme.orange}, {t: ' ANSWER DOES.'}],
          ]}
          start={8}
          gap={30}
          fontSize={60}
        />
      </AbsoluteFill>
    </Backdrop>
  );
};

const ThePlayer: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const mascotIn = spring({frame: frame - 40, fps, config: {damping: 11, stiffness: 150}});

  return (
    <Backdrop glow={0.7}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 40}}>
        <Punch
          lines={[
            [{t: 'MISTRAL IS NO LONGER JUST A TOOL.'}],
            [{t: 'MISTRAL IS '}, {t: 'THE PLAYER.', c: theme.orange}],
          ]}
          start={4}
          gap={26}
          fontSize={58}
        />
        <Img
          src={staticFile('logo.png')}
          style={{
            width: 260,
            imageRendering: 'pixelated',
            transform: `scale(${mascotIn})`,
            filter: `drop-shadow(0 0 40px ${theme.orange}77)`,
          }}
        />
      </AbsoluteFill>
    </Backdrop>
  );
};

// le retournement final : et si l'impostor c'etait vous
const YouImpostor: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stampAt = 130;
  const stamp = spring({frame: frame - stampAt, fps, config: {damping: 9, stiffness: 240}});

  return (
    <Backdrop tint={theme.red} glow={0.6}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 56}}>
        <Punch
          lines={[
            [{t: 'COULD YOU SPOT THE AI —'}],
            [
              {t: 'BEFORE IT CONVINCES EVERYONE THAT '},
              {t: 'YOU', c: theme.red},
              {t: ' ARE THE IMPOSTOR?'},
            ],
          ]}
          start={8}
          gap={26}
          fontSize={48}
        />

        {/* votre carte de joueur qui se fait tamponner */}
        <div style={{position: 'relative'}}>
          <div
            style={{
              width: 560,
              padding: 30,
              backgroundColor: theme.card,
              border: `4px solid ${frame >= stampAt ? theme.red : theme.cardBorder}`,
              display: 'flex',
              alignItems: 'center',
              gap: 26,
              justifyContent: 'center',
              boxShadow: frame >= stampAt ? `0 0 50px ${theme.red}66` : '0 8px 0 #00000066',
            }}
          >
            <Img
              src={staticFile(PLAYERS[3].avatar)}
              style={{width: 150, height: 150, imageRendering: 'pixelated'}}
            />
            <div style={{fontFamily: fonts.pixel, fontSize: 40, color: theme.ink, letterSpacing: 3}}>
              YOU
            </div>
          </div>
          {frame >= stampAt && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${interpolate(stamp, [0, 1], [3, 1])}) rotate(-12deg)`,
                opacity: stamp,
              }}
            >
              <div
                style={{
                  fontFamily: fonts.pixel,
                  fontSize: 38,
                  color: theme.red,
                  border: `5px solid ${theme.red}`,
                  padding: '10px 20px',
                  letterSpacing: 4,
                  textShadow: `0 0 30px ${theme.red}88`,
                }}
              >
                IMPOSTOR
              </div>
            </div>
          )}
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

// carton final
const Welcome: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const logoIn = spring({frame: frame - 14, fps, config: {damping: 11, stiffness: 150}});
  const flash = frame >= 18 && frame <= 20;

  return (
    <Backdrop glow={0.8}>
      {flash && <AbsoluteFill style={{backgroundColor: theme.ink, opacity: 0.7}} />}
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 44}}>
        <div
          style={{
            fontFamily: fonts.pixel,
            fontSize: 40,
            color: theme.dim,
            letterSpacing: 6,
            opacity: interpolate(frame, [4, 14], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          WELCOME TO
        </div>
        <Img
          src={staticFile('impostral.png')}
          style={{
            width: 1050,
            transform: `scale(${interpolate(logoIn, [0, 1], [2.6, 1])})`,
            opacity: logoIn,
            filter: `drop-shadow(0 0 44px ${theme.orange}88)`,
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 22,
            opacity: interpolate(frame, [60, 78], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
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
    </Backdrop>
  );
};

export const Closing: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={200}>
        <FearToCuriosity />
      </Series.Sequence>
      <Series.Sequence durationInFrames={170}>
        <MostHuman />
      </Series.Sequence>
      <Series.Sequence durationInFrames={170}>
        <ThePlayer />
      </Series.Sequence>
      <Series.Sequence durationInFrames={240}>
        <YouImpostor />
      </Series.Sequence>
      <Series.Sequence durationInFrames={260}>
        <Welcome />
      </Series.Sequence>
    </Series>
  );
};
