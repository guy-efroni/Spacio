import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FurnitureBlueprintsController } from './furniture-blueprints.controller';
import { FurnitureBlueprintsService } from './furniture-blueprints.service';

@Module({
  imports: [AuthModule],
  controllers: [FurnitureBlueprintsController],
  providers: [FurnitureBlueprintsService],
  exports: [FurnitureBlueprintsService],
})
export class FurnitureBlueprintsModule {}
