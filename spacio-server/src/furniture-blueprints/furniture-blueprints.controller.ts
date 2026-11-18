import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { IFurnitureBlueprint } from '@spacio/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type {
  IAuthenticatedRequest,
  IOptionalAuthenticatedRequest,
} from '../auth/interfaces/authenticated-request.interface';
import { FurnitureBlueprintsService } from './furniture-blueprints.service';
import { CreateBlueprintDto, UpdateBlueprintDto } from './dto';

@Controller('blueprints')
export class FurnitureBlueprintsController {
  constructor(private readonly service: FurnitureBlueprintsService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  public findAll(
    @Req() request: IOptionalAuthenticatedRequest,
  ): Promise<IFurnitureBlueprint[]> {
    return this.service.findAll(request.user ?? null);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('by-name/:name')
  public findByName(
    @Param('name') name: string,
    @Req() request: IOptionalAuthenticatedRequest,
  ): Promise<IFurnitureBlueprint> {
    return this.service.findByName(
      decodeURIComponent(name),
      request.user ?? null,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  public create(
    @Body() dto: CreateBlueprintDto,
    @Req() request: IAuthenticatedRequest,
  ): Promise<IFurnitureBlueprint> {
    return this.service.create(dto, request.user);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  public update(
    @Param('id') id: string,
    @Body() dto: UpdateBlueprintDto,
    @Req() request: IAuthenticatedRequest,
  ): Promise<IFurnitureBlueprint> {
    return this.service.update(id, dto, request.user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  public remove(
    @Param('id') id: string,
    @Req() request: IAuthenticatedRequest,
  ): Promise<void> {
    return this.service.remove(id, request.user);
  }
}
