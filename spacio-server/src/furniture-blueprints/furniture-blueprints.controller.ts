import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { FurnitureBlueprintsService } from './furniture-blueprints.service';
import { CreateBlueprintDto, UpdateBlueprintDto } from './dto';

@Controller('blueprints')
export class FurnitureBlueprintsController {
  constructor(private readonly service: FurnitureBlueprintsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateBlueprintDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBlueprintDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
