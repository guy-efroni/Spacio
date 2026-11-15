import { TestBed } from '@angular/core/testing';
import {
  IWallOpening,
  IWallSegment,
  MIN_OPENING_GAP,
  MIN_WALL_PIER,
} from '@spacio/shared-types';
import { getWallLength } from '../../shared/utils/opening.util';
import { FloorplanService } from './floorplan.service';

describe('FloorplanService opening validation', () => {
  const wallId: string = 'wall-1';

  let service: FloorplanService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FloorplanService);
  });

  const getWall = (): IWallSegment => {
    const wall: IWallSegment | undefined = service.walls().find(
      (item: IWallSegment) => item.id === wallId
    );
    if (!wall) {
      throw new Error('Test wall is missing');
    }
    return wall;
  };

  const getOpenings = (): IWallOpening[] => {
    return service
      .openings()
      .filter((opening: IWallOpening) => opening.wallId === wallId)
      .sort(
        (a: IWallOpening, b: IWallOpening) =>
          a.positionAlongWall - b.positionAlongWall
      );
  };

  it('adds multiple openings without overlapping them', () => {
    expect(service.addOpeningToWall(wallId, 'door')).toBe(true);
    expect(service.addOpeningToWall(wallId, 'window')).toBe(true);

    const openings: IWallOpening[] = getOpenings();
    expect(openings.length).toBe(2);

    const wallLength: number = getWallLength(getWall());
    expect(openings[0].positionAlongWall).toBeGreaterThanOrEqual(MIN_WALL_PIER);
    expect(
      openings[1].positionAlongWall + openings[1].width
    ).toBeLessThanOrEqual(wallLength - MIN_WALL_PIER);
    expect(openings[1].positionAlongWall).toBeGreaterThanOrEqual(
      openings[0].positionAlongWall + openings[0].width + MIN_OPENING_GAP
    );
  });

  it('rejects or clamps an update that would collide with a neighbouring opening', () => {
    service.addOpeningToWall(wallId, 'door');
    service.addOpeningToWall(wallId, 'window');

    const openings: IWallOpening[] = getOpenings();
    const left: IWallOpening = openings[0];
    const right: IWallOpening = openings[1];

    service.updateOpening(right.id, { positionAlongWall: left.positionAlongWall });

    const updated: IWallOpening | undefined = service
      .openings()
      .find((opening: IWallOpening) => opening.id === right.id);

    expect(updated).toBeDefined();
    expect(updated!.positionAlongWall).toBeGreaterThanOrEqual(
      left.positionAlongWall + left.width + MIN_OPENING_GAP
    );
  });

  it('jumps an opening to the next free gap when it passes a neighbour', () => {
    service.addOpeningToWall(wallId, 'door');
    service.addOpeningToWall(wallId, 'window');

    const openings: IWallOpening[] = getOpenings();
    const left: IWallOpening = openings[0];
    const right: IWallOpening = openings[1];

    service.updateOpening(left.id, {
      positionAlongWall: right.positionAlongWall + right.width + MIN_OPENING_GAP + 0.5,
    });

    const updated: IWallOpening | undefined = service
      .openings()
      .find((opening: IWallOpening) => opening.id === left.id);

    expect(updated).toBeDefined();
    expect(updated!.positionAlongWall).toBeGreaterThanOrEqual(
      right.positionAlongWall + right.width + MIN_OPENING_GAP
    );
  });

  it('clamps opening positions and widths to the wall boundaries', () => {
    service.addOpeningToWall(wallId, 'door');
    const opening: IWallOpening = getOpenings()[0];
    const wallLength: number = getWallLength(getWall());

    service.updateOpening(opening.id, { positionAlongWall: -5, width: 100 });

    const updated: IWallOpening | undefined = service
      .openings()
      .find((item: IWallOpening) => item.id === opening.id);

    expect(updated).toBeDefined();
    expect(updated!.positionAlongWall).toBeGreaterThanOrEqual(MIN_WALL_PIER);
    expect(updated!.positionAlongWall + updated!.width).toBeLessThanOrEqual(
      wallLength - MIN_WALL_PIER
    );
  });
});
