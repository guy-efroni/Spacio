import { IWallSegment } from '../geometry/wall.interface';

export const DEFAULT_WALL_HEIGHT = 3;
export const DEFAULT_WALL_THICKNESS = 0.2;
export const DEFAULT_WALL_COLOR = '#e2e8f0';
export const MIN_WALL_HEIGHT = 0.5;
export const MAX_WALL_HEIGHT = 6.0;
export const MIN_WALL_THICKNESS = 0.05;
export const MAX_WALL_THICKNESS = 1.0;
export const DEFAULT_ROOM_HALF_SIZE = 4;

export const WALL_COLOR_PRESETS: readonly { name: string; value: string }[] = [
  { name: 'Crisp White', value: '#f8fafc' },
  { name: 'Warm Plaster', value: '#f5f0e8' },
  { name: 'Concrete Gray', value: '#9ca3af' },
  { name: 'Charcoal', value: '#374151' },
  { name: 'Terracotta', value: '#c2410c' },
] as const;

export const INITIAL_SQUARE_ROOM: ReadonlyArray<IWallSegment> = [
  {
    id: 'wall-1',
    start: { x: -DEFAULT_ROOM_HALF_SIZE, y: -DEFAULT_ROOM_HALF_SIZE },
    end: { x: DEFAULT_ROOM_HALF_SIZE, y: -DEFAULT_ROOM_HALF_SIZE },
    height: DEFAULT_WALL_HEIGHT,
    thickness: DEFAULT_WALL_THICKNESS,
    color: DEFAULT_WALL_COLOR,
  },
  {
    id: 'wall-2',
    start: { x: DEFAULT_ROOM_HALF_SIZE, y: -DEFAULT_ROOM_HALF_SIZE },
    end: { x: DEFAULT_ROOM_HALF_SIZE, y: DEFAULT_ROOM_HALF_SIZE },
    height: DEFAULT_WALL_HEIGHT,
    thickness: DEFAULT_WALL_THICKNESS,
    color: DEFAULT_WALL_COLOR,
  },
  {
    id: 'wall-3',
    start: { x: DEFAULT_ROOM_HALF_SIZE, y: DEFAULT_ROOM_HALF_SIZE },
    end: { x: -DEFAULT_ROOM_HALF_SIZE, y: DEFAULT_ROOM_HALF_SIZE },
    height: DEFAULT_WALL_HEIGHT,
    thickness: DEFAULT_WALL_THICKNESS,
    color: DEFAULT_WALL_COLOR,
  },
  {
    id: 'wall-4',
    start: { x: -DEFAULT_ROOM_HALF_SIZE, y: DEFAULT_ROOM_HALF_SIZE },
    end: { x: -DEFAULT_ROOM_HALF_SIZE, y: -DEFAULT_ROOM_HALF_SIZE },
    height: DEFAULT_WALL_HEIGHT,
    thickness: DEFAULT_WALL_THICKNESS,
    color: DEFAULT_WALL_COLOR,
  },
];
