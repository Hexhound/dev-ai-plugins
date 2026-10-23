// The devlog's YouTube thumbnail (1280x720): the old fox and the new one, side by side, under
// "the glow-up", the game's logo below. Few words, big faces: it has to read at a phone's
// thumbnail size.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {C, Confetti, FONT, FontFace, Pill, Sky, sticker} from './chibi/look';
import {RoundWord} from './RoundWord';

const Face: React.FC<{src: string; x: number; tilt: number; tag: 'before' | 'after'}> = ({src, x, tilt, tag}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: 196,
      width: 520,
      height: 440,
      borderRadius: 40,
      overflow: 'hidden',
      border: `8px solid ${C.cream}`,
      boxShadow: '0 24px 50px rgba(90,57,77,0.35)',
      background: '#f3eaf7',
      transform: `rotate(${tilt}deg)`,
    }}
  >
    <Img src={staticFile(src)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.3)', transformOrigin: '50% 48%'}} />
    <div style={{position: 'absolute', left: 20, top: 16}}>
      <Pill size={34} bg={tag === 'before' ? C.plum : C.pinkDeep} color="#fff" style={{border: '3px solid #fff'}}>
        {tag === 'before' ? 'BEFORE' : 'AFTER'}
      </Pill>
    </div>
  </div>
);

export const Thumbnail: React.FC = () => (
  <AbsoluteFill style={{fontFamily: FONT}}>
    <FontFace />
    <Sky />
    <Confetti opacity={0.4} seed="thumb-b" count={10} />
    <div style={{position: 'absolute', left: 0, right: 0, top: 26, textAlign: 'center'}}>
      <span style={sticker(92)}>the </span>
      <RoundWord size={128}>glow-up!</RoundWord>
    </div>
    <Face src="capture/old_fox/0000.jpg" x={64} tilt={-4} tag="before" />
    <Face src="capture/new_fox/0000.jpg" x={696} tilt={4} tag="after" />
    <Img src={staticFile('stickers/paw.png')} style={{position: 'absolute', left: 570, top: 360, width: 140, transform: 'rotate(90deg)', filter: 'drop-shadow(0 8px 10px rgba(90,57,77,0.35))'}} />
    <div style={{position: 'absolute', left: 0, right: 0, top: 604, textAlign: 'center'}}>
      <Img src={staticFile('logo_sticker.png')} style={{width: 470, filter: 'drop-shadow(0 6px 10px rgba(90,57,77,0.3))'}} />
    </div>
  </AbsoluteFill>
);
