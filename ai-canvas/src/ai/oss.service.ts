import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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
export class OssService {
  private readonly logger = new Logger(OssService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.trimEnv('MINIO_BUCKET');
    this.endpoint = this.trimEnv('MINIO_ENDPOINT');
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

  resolveReadableUrl(imageUrl: string): string {
    if (!imageUrl.includes(this.endpoint.replace(/^https?:\/\//, ''))) {
      return imageUrl;
    }
    return imageUrl;
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
