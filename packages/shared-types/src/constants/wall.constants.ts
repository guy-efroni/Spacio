import { IWallSegment } from '../geometry/wall.interface';

export const DEFAULT_WALL_HEIGHT = 3;
export const DEFAULT_WALL_THICKNESS = 0.2;
export const MIN_WALL_HEIGHT = 0.1;
export const MAX_WALL_HEIGHT = 10;
export const DEFAULT_ROOM_HALF_SIZE = 4;

export const INITIAL_SQUARE_ROOM: ReadonlyArray<IWallSegment> = [
  {
    id: 'wall-1',
    start: { x: -DEFAULT_ROOM_HALF_SIZE, y: -DEFAULT_ROOM_HALF_SIZE },
    end: { x: DEFAULT_ROOM_HALF_SIZE, y: -DEFAULT_ROOM_HALF_SIZE },
    height: DEFAULT_WALL_HEIGHT,
    thickness: DEFAULT_WALL_THICKNESS,
  },
  {
    id: 'wall-2',
    start: { x: DEFAULT_ROOM_HALF_SIZE, y: -DEFAULT_ROOM_HALF_SIZE },
    end: { x: DEFAULT_ROOM_HALF_SIZE, y: DEFAULT_ROOM_HALF_SIZE },
    height: DEFAULT_WALL_HEIGHT,
    thickness: DEFAULT_WALL_THICKNESS,
  },
  {
    id: 'wall-3',
    start: { x: DEFAULT_ROOM_HALF_SIZE, y: DEFAULT_ROOM_HALF_SIZE },
    end: { x: -DEFAULT_ROOM_HALF_SIZE, y: DEFAULT_ROOM_HALF_SIZE },
    height: DEFAULT_WALL_HEIGHT,
    thickness: DEFAULT_WALL_THICKNESS,
  },
  {
    id: 'wall-4',
    start: { x: -DEFAULT_ROOM_HALF_SIZE, y: DEFAULT_ROOM_HALF_SIZE },
    end: { x: -DEFAULT_ROOM_HALF_SIZE, y: -DEFAULT_ROOM_HALF_SIZE },
    height: DEFAULT_WALL_HEIGHT,
    thickness: DEFAULT_WALL_THICKNESS,
  },
];
