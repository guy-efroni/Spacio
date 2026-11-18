import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { FurnitureBlueprintEntity } from './entities/furniture-blueprint.entity';
import { FurnitureBlueprintsController } from './furniture-blueprints.controller';
import { FurnitureBlueprintsService } from './furniture-blueprints.service';

@Module({
  imports: [TypeOrmModule.forFeature([FurnitureBlueprintEntity]), AuthModule],
  controllers: [FurnitureBlueprintsController],
  providers: [FurnitureBlueprintsService],
  exports: [FurnitureBlueprintsService],
})
export class FurnitureBlueprintsModule {}
