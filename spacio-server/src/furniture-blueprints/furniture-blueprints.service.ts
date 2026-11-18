import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { cloneBlueprint } from '@spacio/shared-types';
import type { IFurnitureBlueprint, IUserProfile } from '@spacio/shared-types';
import {
  CreateBlueprintDto,
  toBlueprintDefinition,
} from './dto/create-blueprint.dto';
import { BLUEPRINT_PRESETS } from './seeds/blueprint-presets';

interface IStoredBlueprint {
  definition: IFurnitureBlueprint;
  ownerId: string | null;
  isPreset: boolean;
}

@Injectable()
export class FurnitureBlueprintsService {
  private readonly _blueprints: Map<string, IStoredBlueprint> = new Map<
    string,
    IStoredBlueprint
  >();

  constructor() {
    for (const preset of BLUEPRINT_PRESETS) {
      this._blueprints.set(
        preset.id,
        this._toStored(preset, preset.userId, true),
      );
    }
  }

  public async findAll(
    user: IUserProfile | null,
  ): Promise<IFurnitureBlueprint[]> {
    await Promise.resolve();
    return [...this._blueprints.values()]
      .filter(
        (stored: IStoredBlueprint): boolean =>
          stored.isPreset || (user !== null && stored.ownerId === user.id),
      )
      .sort((left: IStoredBlueprint, right: IStoredBlueprint): number => {
        if (left.isPreset !== right.isPreset) return left.isPreset ? -1 : 1;
        return left.definition.name.localeCompare(right.definition.name);
      })
      .map((stored: IStoredBlueprint): IFurnitureBlueprint =>
        this.toBlueprint(stored),
      );
  }

  public async findByName(
    name: string,
    user: IUserProfile | null,
  ): Promise<IFurnitureBlueprint> {
    await Promise.resolve();
    const normalized: string = name.trim();
    const stored: IStoredBlueprint | undefined = [
      ...this._blueprints.values(),
    ].find(
      (item: IStoredBlueprint): boolean =>
        item.definition.name === normalized &&
        (item.isPreset || (user !== null && item.ownerId === user.id)),
    );
    if (!stored) throw new NotFoundException(`Blueprint "${name}" not found`);
    return this.toBlueprint(stored);
  }

  public async create(
    dto: CreateBlueprintDto,
    user: IUserProfile,
  ): Promise<IFurnitureBlueprint> {
    await Promise.resolve();
    const name: string = dto.name.trim();
    this._assertNameAvailable(name, user.id);

    const definition: IFurnitureBlueprint = {
      ...toBlueprintDefinition(dto),
      id: randomUUID(),
      userId: user.id,
      name,
      isPreset: false,
    };
    this._blueprints.set(
      definition.id,
      this._toStored(definition, user.id, false),
    );
    return this.toBlueprint(
      this._blueprints.get(definition.id) as IStoredBlueprint,
    );
  }

  public async update(
    id: string,
    dto: CreateBlueprintDto,
    user: IUserProfile,
  ): Promise<IFurnitureBlueprint> {
    await Promise.resolve();
    this._getOwned(id, user);
    const name: string = dto.name.trim();
    this._assertNameAvailable(name, user.id, id);

    const definition: IFurnitureBlueprint = {
      ...toBlueprintDefinition(dto),
      id,
      userId: user.id,
      name,
      isPreset: false,
    };
    this._blueprints.set(id, this._toStored(definition, user.id, false));
    return this.toBlueprint(this._blueprints.get(id) as IStoredBlueprint);
  }

  public async remove(id: string, user: IUserProfile): Promise<void> {
    await Promise.resolve();
    this._getOwned(id, user);
    this._blueprints.delete(id);
  }

  public toBlueprint(stored: IStoredBlueprint): IFurnitureBlueprint {
    return cloneBlueprint(stored.definition, stored.definition.id);
  }

  private _toStored(
    blueprint: IFurnitureBlueprint,
    ownerId: string | null,
    isPreset: boolean,
  ): IStoredBlueprint {
    const definition: IFurnitureBlueprint = cloneBlueprint(
      blueprint,
      blueprint.id,
    );
    definition.userId = ownerId;
    definition.isPreset = isPreset;
    definition.thumbnailDataUrl = blueprint.thumbnailDataUrl;
    return { definition, ownerId, isPreset };
  }

  private _getOwned(id: string, user: IUserProfile): IStoredBlueprint {
    const stored: IStoredBlueprint | undefined = this._blueprints.get(id);
    if (!stored) throw new NotFoundException('Blueprint not found');
    if (stored.isPreset)
      throw new ForbiddenException('Built-in presets cannot be modified');
    if (stored.ownerId !== user.id)
      throw new ForbiddenException('You do not own this blueprint');
    return stored;
  }

  private _assertNameAvailable(
    name: string,
    ownerId: string,
    excludeId?: string,
  ): void {
    const duplicate: boolean = [...this._blueprints.values()].some(
      (stored: IStoredBlueprint): boolean =>
        !stored.isPreset &&
        stored.ownerId === ownerId &&
        stored.definition.name === name &&
        stored.definition.id !== excludeId,
    );
    if (duplicate)
      throw new ConflictException(`Blueprint "${name}" already exists`);
  }
}
