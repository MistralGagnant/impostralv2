import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme, fonts} from '../theme';

// petit marqueur de chapitre en haut a gauche, style hud de jeu
export const SectionTag: React.FC<{index: string; label: string}> = ({index, label}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const slideIn = spring({frame: frame - 4, fps, config: {damping: 14}});

  return (
    <div
      style={{
        position: 'absolute',
        top: 54,
        left: 64,
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        transform: `translateX(${interpolate(slideIn, [0, 1], [-350, 0])}px)`,
        opacity: slideIn,
      }}
    >
      <div style={{width: 16, height: 16, backgroundColor: theme.orange}} />
      <div style={{fontFamily: fonts.pixel, fontSize: 22, color: theme.orange, letterSpacing: 3}}>
        {index}
      </div>
      <div style={{fontFamily: fonts.pixel, fontSize: 22, color: theme.dim, letterSpacing: 4}}>
        {label}
      </div>
    </div>
  );
};
