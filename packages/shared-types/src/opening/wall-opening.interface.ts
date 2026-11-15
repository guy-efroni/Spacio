export interface IWallOpening {
  id: string;
  wallId: string;
  type: 'door' | 'window';
  positionAlongWall: number;
  width: number;
  height: number;
  elevation: number;
}