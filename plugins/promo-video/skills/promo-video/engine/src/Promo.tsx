// Starter only — replace with this promo's storyboard. See examples/omaphoto/video/src/Promo.tsx.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {makeClock} from './lib/music';
import musicJson from './data/music.json';

const c = makeClock(musicJson, 60);
export const TOTAL = c.at(20);

export const Promo: React.FC = () => <AbsoluteFill style={{background: '#000'}} />;
