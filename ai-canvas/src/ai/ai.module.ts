import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { ImageStoreService } from './image-store.service';

@Module({
  controllers: [AiController],
  providers: [AiService, ImageStoreService],
})
export class AiModule {}
