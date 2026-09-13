import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { Readable } from 'stream';

export type StoragePutResult = {
  bucket: string;
  objectKey: string;
  etag?: string;
};

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Minio.Client;
  private readonly buckets = ['avatars', 'documents', 'gate-passes', 'invoices', 'announcements', 'media'] as const;

  constructor(private readonly config: ConfigService) {
    const endPoint = this.config.get<string>('MINIO_ENDPOINT') || 'localhost';
    const port = Number(this.config.get<string>('MINIO_PORT') || 9000);
    const useSSL = String(this.config.get<string>('MINIO_USE_SSL') || 'false') === 'true';
    const accessKey = this.config.get<string>('MINIO_ACCESS_KEY') || 'minioadmin';
    const secretKey = this.config.get<string>('MINIO_SECRET_KEY') || 'minioadmin';

    this.client = new Minio.Client({ endPoint, port, useSSL, accessKey, secretKey });
  }

  async onModuleInit() {
    await this.ensureBuckets();
  }

  private async ensureBuckets() {
    for (const bucket of this.buckets) {
      try {
        const exists = await this.client.bucketExists(bucket);
        if (!exists) {
          await this.client.makeBucket(bucket);
          this.logger.log(`Created MinIO bucket: ${bucket}`);
        }
      } catch (error) {
        this.logger.error(`Failed to ensure bucket ${bucket}`, error instanceof Error ? error.stack : String(error));
      }
    }
  }

  async putObject(input: {
    bucket: string;
    objectKey: string;
    body: Buffer;
    contentType: string;
    meta?: Record<string, string>;
  }): Promise<StoragePutResult> {
    const result = await this.client.putObject(
      input.bucket,
      input.objectKey,
      input.body,
      input.body.length,
      {
        'Content-Type': input.contentType,
        ...(input.meta || {}),
      },
    );
    return {
      bucket: input.bucket,
      objectKey: input.objectKey,
      etag: typeof result === 'string' ? result : result?.etag,
    };
  }

  async getObjectStream(bucket: string, objectKey: string): Promise<Readable> {
    return this.client.getObject(bucket, objectKey);
  }

  async getObjectBuffer(bucket: string, objectKey: string): Promise<Buffer> {
    const stream = await this.getObjectStream(bucket, objectKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async statObject(bucket: string, objectKey: string) {
    return this.client.statObject(bucket, objectKey);
  }

  async removeObject(bucket: string, objectKey: string): Promise<void> {
    await this.client.removeObject(bucket, objectKey);
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.listBuckets();
      return true;
    } catch {
      return false;
    }
  }
}
