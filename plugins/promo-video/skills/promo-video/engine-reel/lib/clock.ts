// The beat clock: every storyboard time is a bar/beat, turned into a frame here. The
// promo's music.json (music-prepare.sh) gives the tempo and where bar 0 falls.
import { type AudioTrack, readJson } from "reel";

/** What music.json says (other fields it carries, such as `beats` and `bars`, are kept). */
export type Music = {
  bpm: number;
  /** Seconds per beat. */
  beat: number;
  /** Video seconds of bar 0's downbeat (≤ 0). */
  barOrigin: number;
  /** Seconds into the track where the video starts. */
  start: number;
  [k: string]: unknown;
};

/** Reads a music.json (relative to the scene file, e.g. "../music/music.json"). */
export const readMusic = (path: string): Music => readJson<Music>(path);

/**
 * The clock for `music` at `fps`: `at(bar, beat)` is the frame of a bar's beat (beats from 1,
 * fractional bars and beats are fine), `seconds(bar, beat)` the video time, `beatFrames` and
 * `barFrames` the lengths. `music` is the parsed music.json or its path.
 */
export const makeClock = (music: Music | string, fps = 60) => {
  const m = typeof music === "string" ? readMusic(music) : music;
  const seconds = (bar: number, beat = 1) => m.barOrigin + (bar * 4 + (beat - 1)) * m.beat;
  return {
    fps,
    music: m,
    /** `at(5, 3)` = frame of bar 5, beat 3. */
    at: (bar: number, beat = 1) => Math.max(0, Math.round(seconds(bar, beat) * fps)),
    seconds,
    beatFrames: m.beat * fps,
    barFrames: m.beat * 4 * fps,
  };
};
export type Clock = ReturnType<typeof makeClock>;

/**
 * The music bed for `config.audio`: the track (relative to the scene file, e.g.
 * "../music/track.mp3") from music.json's `start`, faded in briefly and out over the last
 * bar, as render.sh mixed it (set `loudness: -14` in the config for its loudnorm).
 * `opts` overrides any field (`volume`, `fadeOut`, `duck` under a voice-over).
 */
export const musicTrack = (music: Music, src: string, opts: Partial<AudioTrack> = {}): AudioTrack => ({
  src,
  from: music.start,
  fadeIn: 0.25,
  fadeOut: music.beat * 4,
  ...opts,
});
