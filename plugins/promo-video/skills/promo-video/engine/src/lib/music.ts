// The beat clock: every storyboard time is a bar/beat, turned into a frame here.
export type Music = {
  bpm: number;
  beat: number; // seconds per beat
  barOrigin: number; // video seconds of bar 0's downbeat (≤ 0)
  start: number; // offset into the track where the video starts
};

export const makeClock = (music: Music, fps: number) => {
  const seconds = (bar: number, beat = 1) => music.barOrigin + (bar * 4 + (beat - 1)) * music.beat;
  return {
    fps,
    // `at(5, 3)` = frame of bar 5, beat 3. Fractional bars/beats are fine.
    at: (bar: number, beat = 1) => Math.max(0, Math.round(seconds(bar, beat) * fps)),
    seconds,
    beatFrames: music.beat * fps,
    barFrames: music.beat * 4 * fps,
  };
};
export type Clock = ReturnType<typeof makeClock>;
