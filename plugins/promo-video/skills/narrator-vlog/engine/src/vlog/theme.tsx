// The vlog's look: colours, the font and the pointer sticker. Each vlog sets its own from the
// product's identity (look.ts in the template) and wraps the composition in <ThemeProvider>.
import React from 'react';
import {staticFile} from 'remotion';

export type Theme = {
  // Display font family, and its file in public/ (loaded by <FontFace/>), if not a system font.
  font: string;
  fontFile?: string;
  // Text and outlines.
  ink: string;
  inkDeep: string;
  // The highlight colour (AFTER tags, rings, the pink word) and a deeper shade of it.
  accent: string;
  accentDeep: string;
  // Pills, card borders, sticker outlines.
  paper: string;
  // Card backgrounds: light footage, and dark footage (wireframes, x-rays).
  card: string;
  cardDark: string;
  // The pointer sticker in public/ (a paw, a hand, the mascot's mitten): drawn pointing UP.
  pointer: string;
  // The page behind the cards (any CSS background).
  background: string;
};

export const DEFAULT_THEME: Theme = {
  font: 'sans-serif',
  ink: '#3b2f45',
  inkDeep: '#241b2b',
  accent: '#ff768a',
  accentDeep: '#e2516a',
  paper: '#fff9f6',
  card: '#f3eaf7',
  cardDark: '#2b1a33',
  pointer: 'pointer.png',
  background: 'linear-gradient(180deg, #ece0ff 0%, #f8e6f3 55%, #ffdbe7 100%)',
};

const ThemeContext = React.createContext<Theme>(DEFAULT_THEME);
export const ThemeProvider = ThemeContext.Provider;
export const useTheme = () => React.useContext(ThemeContext);

// The theme's font file, loaded once.
export const FontFace: React.FC = () => {
  const t = useTheme();
  if (!t.fontFile) return null;
  return <style>{`@font-face{font-family:'${t.font}';font-weight:700;src:url('${staticFile(t.fontFile)}');}`}</style>;
};
