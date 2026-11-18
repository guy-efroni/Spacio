import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type {
  IFurnitureBlueprint,
  TFurnitureCategory,
} from '../interfaces/furniture-blueprint.interface';

@Entity('furniture_blueprints')
@Index('UQ_furniture_blueprint_user_name', ['userId', 'name'], { unique: true })
export class FurnitureBlueprintEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

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
