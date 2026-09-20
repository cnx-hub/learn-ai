import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Configuration,
  GenerationResult,
  MultiModalConversation,
} from 'dashscope-sdk-official';
import { ImageDto } from './dto/image.dto';
import { ImageRecord } from './image-record.interface';
import { ImageStoreService } from './image-store.service';
// import { OssService } from './oss.service';

interface WanImageOptions {
  size?: string;
  promptExtend: boolean;
  watermark: boolean;
}

interface MultiModalConversationInternal {
  syncRequest(data: Record<string, unknown>): Promise<GenerationResult>;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: MultiModalConversation;

  constructor(
    private readonly config: ConfigService,
    // private readonly ossService: OssService,
    private readonly imageStore: ImageStoreService,
  ) {
    this.client = new MultiModalConversation(
      new Configuration({
        apiKey: this.config.getOrThrow<string>('OPENAI_API_KEY'),
      }),
    );
  }
}
