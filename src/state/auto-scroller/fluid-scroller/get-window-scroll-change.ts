import type { Position, Rect } from 'css-box-model';
import type { Viewport } from '../../../types';
import getScroll from './get-scroll';
import { canScrollWindow } from '../can-scroll';

interface Args {
  viewport: Viewport;
  subject: Rect;
  center: Position;
  dragStartTime: number;
  shouldUseTimeDampening: boolean;
}

export default ({
  viewport,
  subject,
  center,
  dragStartTime,
  shouldUseTimeDampening,
}: Args): Position | null => {
  const scroll: Position | null = getScroll({
    dragStartTime,
    container: viewport.frame,
    subject,
    center,
    shouldUseTimeDampening,
  });

  return scroll && canScrollWindow(viewport, scroll) ? scroll : null;
};
