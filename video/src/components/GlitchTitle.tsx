import React from 'react';
import {useCurrentFrame} from 'remotion';
import {fonts} from '../theme';

type Props = {
  text: string;
  color: string;
  fontSize?: number;
  intensity?: number; // 0 = statique, 1 = glitch bien visible
};

// titre pixel avec un glitch rgb qui claque par intermittence
export const GlitchTitle: React.FC<Props> = ({text, color, fontSize = 70, intensity = 1}) => {
  const frame = useCurrentFrame();
  const burst = frame % 47 < 3 || frame % 31 < 2;
  const off = burst ? 5 * intensity : 0;

  const base: React.CSSProperties = {
    fontFamily: fonts.pixel,
    fontSize,
    letterSpacing: 4,
    lineHeight: 1.3,
    whiteSpace: 'pre',
  };

  return (
    <div style={{position: 'relative'}}>
      {off > 0 && (
        <>
          <div style={{...base, color: '#FF2D3E', position: 'absolute', left: -off, top: 0, opacity: 0.8}}>
            {text}
          </div>
          <div style={{...base, color: '#2DAAFF', position: 'absolute', left: off, top: 0, opacity: 0.8}}>
            {text}
          </div>
        </>
      )}
      <div style={{...base, color, position: 'relative'}}>{text}</div>
    </div>
  );
};
