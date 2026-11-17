import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type {
  IFurnitureBlueprint,
  TFurnitureCategory,
} from '../interfaces/furniture-blueprint.interface';

@Entity('furniture_blueprints')
export class FurnitureBlueprintEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  category: TFurnitureCategory;

  @Column({ name: 'is_preset', type: 'boolean', default: false })
  isPreset: boolean;

  @Column({ name: 'thumbnail_data_url', type: 'text', nullable: true })
  thumbnailDataUrl: string | null;

  @Column({ type: 'jsonb' })
  definition: IFurnitureBlueprint;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
