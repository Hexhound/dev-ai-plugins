// This vlog's look and words, from the product's identity (EDIT): its colours, its font
// (the file goes in assets/, copied to public/ by prep-vlog.sh), the pointer sticker, and
// the title and credits text.
import {DEFAULT_THEME, type Theme} from './vlog';

export const LOOK: Theme = {
  ...DEFAULT_THEME,
  // font: 'Comfortaa', fontFile: 'Comfortaa-Bold.otf',
  // ink: '#5A394D', accent: '#FF768A', accentDeep: '#e2516a', paper: '#FFF9F6',
  // pointer: 'pointer.png',
};

export const TEXT = {
  titleLead: 'Devlog: the',
  titleWord: 'glow-up',
  // The thumbnail's headline: a small lead word and one big word.
  thumbLead: 'the',
  thumbWord: 'glow-up!',
  // The music file in public/ (assets/), or '' for none.
  music: 'music.ogg',
  credits: 'Music: <title> by <artist> · Voice: Kokoro (af_heart)',
};
