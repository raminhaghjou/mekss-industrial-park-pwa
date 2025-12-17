import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { LoggerService } from './logger.service';

export interface UploadOptions {
  bucket: string;
  filename: string;
  file: Buffer;
  contentType?: string;
}

@Injectable()
export class StorageService {
  private readonly minioClient: Minio.Client;
  private readonly logger: LoggerService;

  constructor(
    private configService: ConfigService,
    logger: LoggerService,
  ) {
    this.logger = logger;

    const endPoint = this.configService.get<string>('MINIO_ENDPOINT') || 'localhost';
    const port = parseInt(this.configService.get<string>('MINIO_PORT')) || 9000;
    const useSSL = this.configService.get<boolean>('MINIO_USE_SSL') || false;
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY') || 'minioadmin';
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY') || 'minioadmin';

    this.minioClient = new Minio.Client({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });

    this.initializeBuckets();
  }

  private async initializeBuckets() {
    const buckets = ['avatars', 'documents', 'gate-passes', 'invoices', 'announcements'];
    
    for (const bucket of buckets) {
      try {
        const exists = await this.minioClient.bucketExists(bucket);
        if (!exists) {
          await this.minioClient.makeBucket(bucket);
          this.logger.log(`Bucket ${bucket} created successfully`);
        }
      } catch (error) {
        this.logger.error(`Failed to create bucket ${bucket}`, error);
      }
    }
  }

  async uploadFile(options: UploadOptions): Promise<string> {
    try {
      await this.minioClient.putObject(
        options.bucket,
        options.filename,
        options.file,
        options.file.length,
        {
          'Content-Type': options.contentType || 'application/octet-stream',
        },
      );

      const url = await this.getFileUrl(options.bucket, options.filename);
      this.logger.log(`File uploaded successfully: ${url}`);
      return url;
    } catch (error) {
      this.logger.error(`Failed to upload file: ${options.filename}`, error);
      throw error;
    }
  }

  async getFileUrl(bucket: string, filename: string): Promise<string> {
    try {
      return await this.minioClient.presignedGetObject(bucket, filename, 24 * 60 * 60); // 24 hours
    } catch (error) {
      this.logger.error(`Failed to get file URL: ${filename}`, error);
      throw error;
    }
  }

  async deleteFile(bucket: string, filename: string): Promise<void> {
    try {
      await this.minioClient.removeObject(bucket, filename);
      this.logger.log(`File deleted successfully: ${filename}`);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${filename}`, error);
      throw error;
    }
  }

  async uploadAvatar(file: Buffer, filename: string): Promise<string> {
    return this.uploadFile({
      bucket: 'avatars',
      filename,
      file,
      contentType: 'image/jpeg',
    });
  }

  async uploadDocument(file: Buffer, filename: string): Promise<string> {
    return this.uploadFile({
      bucket: 'documents',
      filename,
      file,
    });
  }

  async uploadGatePassPhoto(file: Buffer, filename: string): Promise<string> {
    return this.uploadFile({
      bucket: 'gate-passes',
      filename,
      file,
      contentType: 'image/jpeg',
    });
  }

  async uploadInvoiceFile(file: Buffer, filename: string): Promise<string> {
    return this.uploadFile({
      bucket: 'invoices',
      filename,
      file,
      contentType: 'application/pdf',
    });
  }
}