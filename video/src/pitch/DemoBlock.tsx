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
import {theme, fonts, PLAYERS} from '../theme';
import {SectionTag} from './SectionTag';
import {Punch} from './Punch';
import {Video as DemoVideo, TOTAL_DURATION as DEMO_DURATION} from '../Video';

export const DEMOBLOCK_DURATION = 250 + DEMO_DURATION + 380;

// avant la demo : on pose l'enjeu puis compte a rebours
const DemoIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const countdownStart = 140;
  const n = 3 - Math.floor((frame - countdownStart) / 30);
  const inCount = frame >= countdownStart && n >= 1;
  const digitIn = spring({
    frame: (frame - countdownStart) % 30,
    fps,
    config: {damping: 9, stiffness: 220},
  });

  return (
    <Backdrop glow={0.6}>
      <SectionTag index="03" label="THE DEMO" />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 60}}>
        {!inCount && (
          <Punch
            lines={[
              [{t: 'EXPLAINING IT IS ONE THING.'}],
              [{t: 'EXPERIENCING IT', c: theme.orange}, {t: ' IS ANOTHER.'}],
            ]}
            start={10}
            gap={26}
            fontSize={58}
            out={countdownStart}
          />
        )}
        {inCount && (
          <>
            <div
              style={{
                fontFamily: fonts.pixel,
                fontSize: 300,
                color: theme.orange,
                transform: `scale(${interpolate(digitIn, [0, 1], [2.4, 1])})`,
                textShadow: `0 0 80px ${theme.orange}77`,
              }}
            >
              {n}
            </div>
            <div style={{fontFamily: fonts.term, fontSize: 44, color: theme.dim, letterSpacing: 6}}>
              LIVE GAMEPLAY
            </div>
          </>
        )}
      </AbsoluteFill>
    </Backdrop>
  );
};

// apres la demo : et vous, vous auriez vote qui ?
const DemoOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const headIn = spring({frame: frame - 6, fps, config: {damping: 12, stiffness: 160}});

  return (
    <Backdrop tint={theme.gold} glow={0.5}>
      <SectionTag index="03" label="THE DEMO" />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 60}}>
        <div
          style={{
            fontFamily: fonts.pixel,
            fontSize: 42,
            color: theme.ink,
            letterSpacing: 4,
            textAlign: 'center',
            maxWidth: 1700,
            transform: `scale(${interpolate(headIn, [0, 1], [1.8, 1])})`,
            opacity: headIn,
          }}
        >
          SO — <span style={{color: theme.orange}}>WHO WOULD YOU HAVE VOTED FOR?</span>
        </div>

        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: 26}}>
          {PLAYERS.map((p, i) => {
            const bIn = spring({frame: frame - 20 - i * 5, fps, config: {damping: 12}});
            const blink = Math.floor(frame / 14) % 6 === i;
            return (
              <div
                key={p.name}
                style={{
                  padding: '24px 40px',
                  fontFamily: fonts.pixel,
                  fontSize: 24,
                  whiteSpace: 'nowrap',
                  letterSpacing: 2,
                  color: blink ? theme.gold : theme.ink,
                  backgroundColor: theme.card,
                  border: `4px solid ${blink ? theme.gold : theme.cardBorder}`,
                  transform: `scale(${bIn})`,
                  opacity: bIn,
                }}
              >
                [ {p.name} ] <span style={{color: theme.dim}}>?</span>
              </div>
            );
          })}
        </div>

        <div
          style={{
            fontFamily: fonts.term,
            fontSize: 42,
            color: theme.dim,
            letterSpacing: 3,
            textAlign: 'center',
            lineHeight: 1.5,
            opacity: interpolate(frame, [150, 170], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          THE MOST CONFIDENT PLAYER MIGHT BE HUMAN. THE MOST AWKWARD ONE TOO.
          <br />
          <span style={{color: theme.orange}}>
            THE BEST PERSONAL STORY MIGHT NOT BE HUMAN AT ALL.
          </span>
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

export const DemoBlock: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={250}>
        <DemoIntro />
      </Series.Sequence>
      <Series.Sequence durationInFrames={DEMO_DURATION}>
        <DemoVideo />
      </Series.Sequence>
      <Series.Sequence durationInFrames={380}>
        <DemoOutro />
      </Series.Sequence>
    </Series>
  );
};
