// The YouTube thumbnail (1280×720, under 2 MB): before and after side by side, big, under a
// two- or three-word headline, the product's logo below. It has to read at a phone's
// thumbnail size, so: few words, big faces, high contrast. EDIT the clips and frames.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {Clip, FontFace, OutlineWord, Pill, sticker, ThemeProvider, useTheme, view, type Box} from './vlog';
import {LOOK, TEXT} from './look';

const Side: React.FC<{name: string; box: Box; tilt: number; tag: 'before' | 'after'}> = ({name, box, tilt, tag}) => {
  const t = useTheme();
  return (
    <div
      style={{
        position: 'absolute',
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        borderRadius: 40,
        overflow: 'hidden',
        border: `8px solid ${t.paper}`,
        boxShadow: '0 24px 50px rgba(40,25,50,0.35)',
        background: t.card,
        transform: `rotate(${tilt}deg)`,
      }}
    >
      <Clip name={name} f={0} start={0} still={0} v={view(box, 1.3)} />
      <div style={{position: 'absolute', left: 20, top: 16}}>
        <Pill size={34} bg={tag === 'before' ? t.ink : t.accentDeep} color="#fff" style={{border: '3px solid #fff'}}>
          {tag === 'before' ? 'BEFORE' : 'AFTER'}
        </Pill>
      </div>
    </div>
  );
};

const Inner: React.FC = () => {
  const t = useTheme();
  return (
    <AbsoluteFill style={{background: t.background, fontFamily: t.font}}>
      <FontFace />
      <div style={{position: 'absolute', left: 0, right: 0, top: 26, textAlign: 'center'}}>
        <span style={sticker(t, 92)}>{TEXT.thumbLead} </span>
        <OutlineWord size={128}>{TEXT.thumbWord}</OutlineWord>
      </div>
      <Side name="old_hero" box={{x: 64, y: 196, w: 520, h: 440}} tilt={-4} tag="before" />
      <Side name="new_hero" box={{x: 696, y: 196, w: 520, h: 440}} tilt={4} tag="after" />
      <div style={{position: 'absolute', left: 0, right: 0, top: 604, textAlign: 'center'}}>
        <Img src={staticFile('logo.png')} style={{height: 104, filter: 'drop-shadow(0 6px 10px rgba(40,25,50,0.3))'}} />
      </div>
    </AbsoluteFill>
  );
};

export const Thumbnail: React.FC = () => (
  <ThemeProvider value={LOOK}>
    <Inner />
  </ThemeProvider>
);
