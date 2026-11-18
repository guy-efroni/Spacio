import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { FurnitureBlueprintsModule } from './furniture-blueprints/furniture-blueprints.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    AuthModule,
    FurnitureBlueprintsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
