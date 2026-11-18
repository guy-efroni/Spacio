import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import type { IFurnitureBlueprint, IUserProfile } from '@spacio/shared-types';
import { FurnitureBlueprintEntity } from './entities/furniture-blueprint.entity';
import {
  CreateBlueprintDto,
  toBlueprintDefinition,
} from './dto/create-blueprint.dto';
import { BLUEPRINT_PRESETS } from './seeds/blueprint-presets';

@Injectable()
export class FurnitureBlueprintsService implements OnModuleInit {
  constructor(
    @InjectRepository(FurnitureBlueprintEntity)
    private readonly repository: Repository<FurnitureBlueprintEntity>,
  ) {}

  public async onModuleInit(): Promise<void> {
    const presetCount: number = await this.repository.count({
      where: { isPreset: true },
    });
    if (presetCount > 0) return;
    await this.repository.save(
      BLUEPRINT_PRESETS.map((blueprint: IFurnitureBlueprint) =>
        this.repository.create({
          id: blueprint.id,
          userId: blueprint.userId,
          name: blueprint.name,
          category: blueprint.category,
          isPreset: true,
          thumbnailDataUrl: blueprint.thumbnailDataUrl ?? null,
          definition: { ...blueprint, id: '' },
        }),
      ),
    );
  }

  public async findAll(
    user: IUserProfile | null,
  ): Promise<IFurnitureBlueprint[]> {
    const entities: FurnitureBlueprintEntity[] = user
      ? await this.repository.find({
          where: [{ isPreset: true }, { userId: user.id }],
          order: { isPreset: 'DESC', name: 'ASC' },
        })
      : await this.repository.find({
          where: { isPreset: true },
          order: { name: 'ASC' },
        });
    return entities.map((entity: FurnitureBlueprintEntity) =>
      this.toBlueprint(entity),
    );
  }

  public async findByName(
    name: string,
    user: IUserProfile | null,
  ): Promise<IFurnitureBlueprint> {
    const normalized: string = name.trim();
    const entity: FurnitureBlueprintEntity | null =
      await this.repository.findOne({
        where: user
          ? [
              { isPreset: true, name: normalized },
              { userId: user.id, name: normalized },
            ]
          : { isPreset: true, name: normalized },
      });
    if (!entity) throw new NotFoundException(`Blueprint "${name}" not found`);
    return this.toBlueprint(entity);
  }

  public async create(
    dto: CreateBlueprintDto,
    user: IUserProfile,
  ): Promise<IFurnitureBlueprint> {
    const name: string = dto.name.trim();
    const duplicate: FurnitureBlueprintEntity | null =
      await this.repository.findOne({ where: { userId: user.id, name } });
    if (duplicate) {
      throw new ConflictException(`Blueprint "${name}" already exists`);
    }

    const definition: IFurnitureBlueprint = toBlueprintDefinition(dto);
    const entity: FurnitureBlueprintEntity = this.repository.create({
      id: randomUUID(),
      userId: user.id,
      name,
      category: dto.category,
      isPreset: false,
      thumbnailDataUrl: dto.thumbnailDataUrl ?? null,
      definition: { ...definition, id: '' },
    });
    const saved: FurnitureBlueprintEntity = await this.repository.save(entity);
    return this.toBlueprint(saved);
  }

  public async update(
    id: string,
    dto: CreateBlueprintDto,
    user: IUserProfile,
  ): Promise<IFurnitureBlueprint> {
    const entity: FurnitureBlueprintEntity | null =
      await this.repository.findOne({ where: { id } });
    this._assertOwned(entity, user);

    const name: string = dto.name.trim();
    const duplicate: FurnitureBlueprintEntity | null =
      await this.repository.findOne({
        where: { userId: user.id, name, id: Not(id) },
      });
    if (duplicate) {
      throw new ConflictException(`Blueprint "${name}" already exists`);
    }

    const definition: IFurnitureBlueprint = toBlueprintDefinition(dto);
    entity.name = name;
    entity.category = dto.category;
    entity.thumbnailDataUrl = dto.thumbnailDataUrl ?? null;
    entity.definition = { ...definition, id: '' };
    const saved: FurnitureBlueprintEntity = await this.repository.save(entity);
    return this.toBlueprint(saved);
  }

  public async remove(id: string, user: IUserProfile): Promise<void> {
    const entity: FurnitureBlueprintEntity | null =
      await this.repository.findOne({ where: { id } });
    this._assertOwned(entity, user);
    await this.repository.remove(entity);
  }

  private _assertOwned(
    entity: FurnitureBlueprintEntity | null,
    user: IUserProfile,
  ): asserts entity is FurnitureBlueprintEntity {
    if (!entity) throw new NotFoundException('Blueprint not found');
    if (entity.isPreset) {
      throw new ForbiddenException('Built-in presets cannot be modified');
    }
    if (entity.userId !== user.id) {
      throw new ForbiddenException('You do not own this blueprint');
    }
  }

  private toBlueprint(entity: FurnitureBlueprintEntity): IFurnitureBlueprint {
    return {
      ...entity.definition,
      id: entity.id,
      userId: entity.userId,
      name: entity.name,
      category: entity.category,
      isPreset: entity.isPreset,
      thumbnailDataUrl: entity.thumbnailDataUrl ?? undefined,
    };
  }
}
