import {Composition} from 'remotion';
import {Thumbnail} from './Thumbnail';
import {TOTAL, Vlog} from './Vlog';

export const Root = () => (
  <>
    <Composition id="Vlog" component={Vlog} durationInFrames={TOTAL} fps={60} width={1920} height={1080} />
    <Composition id="Thumbnail" component={Thumbnail} durationInFrames={1} fps={60} width={1280} height={720} />
  </>
);
