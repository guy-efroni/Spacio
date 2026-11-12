export interface IWallSegment {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  height: number;
  thickness: number;
}
