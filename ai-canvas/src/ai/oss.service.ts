import {
  Injectable,
  Logger,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  GetBucketPolicyCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface MinioUploadSignature {
  url: string;
  fields: Record<string, string>;
  publicUrl: string;
}

@Injectable()
export class OssService implements OnModuleInit {
  private readonly logger = new Logger(OssService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly publicPrefix: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.trimEnv('MINIO_BUCKET');
    this.endpoint = this.trimEnv('MINIO_ENDPOINT');
    this.publicPrefix = this.config.get<string>(
      'OSS_PUBLIC_PREFIX',
      'ai-canvas',
    );
    const accessKey = this.trimEnv('MINIO_ACCESS_KEY');
    const secretKey = this.trimEnv('MINIO_SECRET_KEY');

    this.client = new S3Client({
      region: 'us-east-1',
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucket();
  }

  /** 启动时确保桶存在，并开放图片前缀的匿名只读；失败只告警，不阻塞应用启动 */
  private async ensureBucket(): Promise<void> {
    try {
      try {
        await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      } catch {
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
        this.logger.log(`MinIO bucket "${this.bucket}" created`);
      }
      await this.ensurePublicReadPolicy();
    } catch (error) {
      this.logger.warn(
        `MinIO bucket "${this.bucket}" unavailable: ${
          (error as Error)?.message ?? error
        }`,
      );
    }
  }

  /** 前端直接用 publicUrl 渲染图片，需要给对应前缀加匿名 GetObject 策略 */
  private async ensurePublicReadPolicy(): Promise<void> {
    const resource = `arn:aws:s3:::${this.bucket}/${this.publicPrefix}/*`;

    try {
      const current = await this.client.send(
        new GetBucketPolicyCommand({ Bucket: this.bucket }),
      );
      if (current.Policy?.includes(resource)) {
        return;
      }
    } catch {
      // 桶还没有任何策略（NoSuchBucketPolicy），继续写入
    }

    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [resource],
        },
      ],
    };

    await this.client.send(
      new PutBucketPolicyCommand({
        Bucket: this.bucket,
        Policy: JSON.stringify(policy),
      }),
    );
    this.logger.log(`MinIO anonymous read enabled for ${resource}`);
  }

  async createUploadPolicy(ext = '.jpg'): Promise<MinioUploadSignature> {
    const prefix = this.config.get<string>(
      'OSS_UPLOAD_PREFIX',
      'ai-canvas/uploads',
    );
    const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`;
    const key = `${prefix}/${Date.now()}-${randomUUID()}${normalizedExt}`;

    try {
      const presignedPost = await createPresignedPost(this.client, {
        Bucket: this.bucket,
        Key: key,
        Conditions: [['content-length-range', 0, 1048576000]],
        Expires: 60 * 60,
      });

      const publicUrl = `${this.endpoint}/${this.bucket}`;

      return {
        url: presignedPost.url,
        fields: { ...presignedPost.fields, key },
        publicUrl,
      };
    } catch (error) {
      throw this.wrapOssError(error, 'create upload signature');
    }
  }

  /**
   * DashScope 拒绝 localhost/内网图片地址，本地 MinIO 的图要读出来转成 base64 data URL；
   * 已经是公网地址的原样返回。
   */
  async resolveModelImage(imageUrl: string): Promise<string> {
    const objectKey = this.extractObjectKey(imageUrl);
    if (!objectKey) {
      return imageUrl;
    }

    try {
      const object = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      const buffer = Buffer.from(await object.Body!.transformToByteArray());
      return `data:${this.mimeOf(objectKey)};base64,${buffer.toString('base64')}`;
    } catch (error) {
      throw this.wrapOssError(error, `read "${objectKey}" from MinIO`);
    }
  }

  /** 属于本服务 MinIO 的地址返回对象 key，否则返回 null（视为公网可直接访问） */
  private extractObjectKey(imageUrl: string): string | null {
    const prefix = `${this.endpoint.replace(/\/+$/, '')}/${this.bucket}/`;
    if (!imageUrl.startsWith(prefix)) {
      return null;
    }
    return decodeURIComponent(imageUrl.slice(prefix.length).split('?')[0]);
  }

  private mimeOf(objectKey: string): string {
    switch (extname(objectKey).toLowerCase()) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.webp':
        return 'image/webp';
      case '.bmp':
        return 'image/bmp';
      case '.tiff':
        return 'image/tiff';
      default:
        return 'image/png';
    }
  }

  async uploadBuffer(
    buffer: Buffer,
    prefix: string,
    filename: string,
  ): Promise<{ url: string; objectKey: string }> {
    const ext = extname(filename) || '.png';
    const objectKey = `${prefix}/${Date.now()}-${randomUUID()}${ext}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
          Body: buffer,
        }),
      );
      const url = `${this.endpoint}/${this.bucket}/${objectKey}`;
      return { url, objectKey };
    } catch (error) {
      throw this.wrapOssError(error, 'upload to MinIO');
    }
  }

  async getSignedUrl(objectKey: string, expires = 3600): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });
    return getSignedUrl(this.client, command, { expiresIn: expires });
  }

  async uploadFromUrl(sourceUrl: string): Promise<string> {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new InternalServerErrorException(
        `Failed to fetch generated image: ${response.status}`,
      );
    }

    const prefix = this.config.get<string>('OSS_PREFIX', 'ai-canvas/edited');
    const buffer = Buffer.from(await response.arrayBuffer());
    const { url } = await this.uploadBuffer(buffer, prefix, 'result.png');

    return url;
  }

  private trimEnv(key: string): string {
    return this.config.getOrThrow<string>(key).trim();
  }

  private wrapOssError(error: unknown, action: string): Error {
    this.logger.error(
      `MinIO ${action} failed: ${(error as Error)?.message ?? error}`,
    );
    return new InternalServerErrorException(
      `MinIO ${action} failed: ${(error as Error)?.message ?? 'unknown error'}`,
    );
  }
}
