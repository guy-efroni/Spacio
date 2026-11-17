import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { FurnitureBlueprintEntity } from './entities/furniture-blueprint.entity';
import type { IFurnitureBlueprint } from './interfaces/furniture-blueprint.interface';
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
    const count: number = await this.repository.count();
    if (count > 0) return;
    await this.repository.save(
      BLUEPRINT_PRESETS.map((blueprint: IFurnitureBlueprint) =>
        this.repository.create({
          id: blueprint.id,
          name: blueprint.name,
          category: blueprint.category,
          isPreset: true,
          thumbnailDataUrl: null,
          definition: blueprint,
        }),
      ),
    );
  }

  public async findAll(): Promise<IFurnitureBlueprint[]> {
    const entities: FurnitureBlueprintEntity[] = await this.repository.find({
      order: { isPreset: 'DESC', name: 'ASC' },
    });
    return entities.map((entity: FurnitureBlueprintEntity) =>
      this.toBlueprint(entity),
    );
  }

  public async create(dto: CreateBlueprintDto): Promise<IFurnitureBlueprint> {
    const definition: IFurnitureBlueprint = toBlueprintDefinition(dto);
    const entity: FurnitureBlueprintEntity = this.repository.create({
      id: randomUUID(),
      name: dto.name.trim(),
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
  ): Promise<IFurnitureBlueprint> {
    const entity: FurnitureBlueprintEntity | null =
      await this.repository.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`Blueprint ${id} not found`);
    if (entity.isPreset)
      throw new ForbiddenException('Built-in presets cannot be modified');

    const definition: IFurnitureBlueprint = toBlueprintDefinition(dto);
    entity.name = dto.name.trim();
    entity.category = dto.category;
    entity.thumbnailDataUrl = dto.thumbnailDataUrl ?? null;
    entity.definition = { ...definition, id };
    const saved: FurnitureBlueprintEntity = await this.repository.save(entity);
    return this.toBlueprint(saved);
  }

  public async remove(id: string): Promise<void> {
    const entity: FurnitureBlueprintEntity | null =
      await this.repository.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`Blueprint ${id} not found`);
    if (entity.isPreset)
      throw new ForbiddenException('Built-in presets cannot be deleted');
    await this.repository.remove(entity);
  }

  private toBlueprint(entity: FurnitureBlueprintEntity): IFurnitureBlueprint {
    return {
      ...entity.definition,
      id: entity.id,
      name: entity.name,
      category: entity.category,
      isPreset: entity.isPreset,
      thumbnailDataUrl: entity.thumbnailDataUrl ?? undefined,
    };
  }
}
