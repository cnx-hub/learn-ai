import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

@Injectable()
export class RustfsService implements OnModuleInit {
  private readonly logger = new Logger(RustfsService.name);
  private client: S3Client | null = null;
  private enabled = false;
  private bucket = '';
  private publicBaseUrl = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.enabled =
      this.config.get<string>('RUSTFS_ENABLED', 'true').toLowerCase() !==
      'false';

    if (!this.enabled) {
      this.logger.warn('RustFS 已禁用（RUSTFS_ENABLED=false），文件上传将跳过');
      return;
    }
  }
}
