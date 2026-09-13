import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FILE_UPLOAD_CONFIG } from '../shared/constants';
import { AuthenticatedUser } from './auth.guard';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';

export const MEDIA_DOMAINS = [
  'avatar',
  'logo',
  'document',
  'invoice',
  'gate-pass',
  'advertisement',
  'request',
  'message',
  'announcement',
] as const;

export type MediaDomain = (typeof MEDIA_DOMAINS)[number];

const DOMAIN_RULES: Record<
  MediaDomain,
  { bucket: string; maxBytes: number; mimeTypes: readonly string[]; personalOk: boolean }
> = {
  avatar: {
    bucket: 'avatars',
    maxBytes: 2 * 1024 * 1024,
    mimeTypes: FILE_UPLOAD_CONFIG.ALLOWED_IMAGE_TYPES,
    personalOk: true,
  },
  logo: {
    bucket: 'media',
    maxBytes: 2 * 1024 * 1024,
    mimeTypes: FILE_UPLOAD_CONFIG.ALLOWED_IMAGE_TYPES,
    personalOk: true,
  },
  document: {
    bucket: 'documents',
    maxBytes: FILE_UPLOAD_CONFIG.MAX_FILE_SIZE,
    mimeTypes: [...FILE_UPLOAD_CONFIG.ALLOWED_IMAGE_TYPES, ...FILE_UPLOAD_CONFIG.ALLOWED_DOCUMENT_TYPES],
    personalOk: true,
  },
  invoice: {
    bucket: 'invoices',
    maxBytes: FILE_UPLOAD_CONFIG.MAX_FILE_SIZE,
    mimeTypes: ['application/pdf', ...FILE_UPLOAD_CONFIG.ALLOWED_IMAGE_TYPES],
    personalOk: false,
  },
  'gate-pass': {
    bucket: 'gate-passes',
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: FILE_UPLOAD_CONFIG.ALLOWED_IMAGE_TYPES,
    personalOk: false,
  },
  advertisement: {
    bucket: 'media',
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: FILE_UPLOAD_CONFIG.ALLOWED_IMAGE_TYPES,
    personalOk: false,
  },
  request: {
    bucket: 'documents',
    maxBytes: FILE_UPLOAD_CONFIG.MAX_FILE_SIZE,
    mimeTypes: [...FILE_UPLOAD_CONFIG.ALLOWED_IMAGE_TYPES, ...FILE_UPLOAD_CONFIG.ALLOWED_DOCUMENT_TYPES],
    personalOk: false,
  },
  message: {
    bucket: 'documents',
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: [...FILE_UPLOAD_CONFIG.ALLOWED_IMAGE_TYPES, ...FILE_UPLOAD_CONFIG.ALLOWED_DOCUMENT_TYPES],
    personalOk: true,
  },
  announcement: {
    bucket: 'announcements',
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: [...FILE_UPLOAD_CONFIG.ALLOWED_IMAGE_TYPES, ...FILE_UPLOAD_CONFIG.ALLOWED_DOCUMENT_TYPES],
    personalOk: false,
  },
};

const SAFE_NAME = /[^a-zA-Z0-9._\u0600-\u06FF-]+/g;

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  isDomain(value: string): value is MediaDomain {
    return (MEDIA_DOMAINS as readonly string[]).includes(value);
  }

  private sanitizeFilename(name: string): string {
    const base = (name || 'file').split(/[/\\]/).pop() || 'file';
    const cleaned = base.replace(SAFE_NAME, '_').slice(0, 180);
    return cleaned || 'file';
  }

  private extensionFor(originalName: string, contentType: string): string {
    const fromName = extname(originalName || '').toLowerCase();
    if (fromName && fromName.length <= 8) return fromName;
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
    };
    return map[contentType] || '';
  }

  private assertFile(domain: MediaDomain, file: Express.Multer.File) {
    const rules = DOMAIN_RULES[domain];
    if (!file?.buffer?.length) throw new BadRequestException('فایل خالی است');
    if (file.size > rules.maxBytes) {
      throw new BadRequestException(`حداکثر حجم مجاز برای این نوع فایل ${Math.round(rules.maxBytes / (1024 * 1024))} مگابایت است`);
    }
    if (!rules.mimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('نوع فایل مجاز نیست');
    }
  }

  private async assertScopeAccess(
    actor: AuthenticatedUser,
    parkId?: string | null,
    factoryId?: string | null,
  ) {
    if (!parkId && !factoryId) return;
    if (actor.role === Role.SUPER_ADMIN) return;

    if (factoryId) {
      const factory = await this.prisma.factory.findUnique({
        where: { id: factoryId },
        select: { id: true, parkId: true, managerId: true },
      });
      if (!factory) throw new BadRequestException('واحد صنعتی معتبر نیست');
      if (parkId && parkId !== factory.parkId) throw new BadRequestException('شهرک و واحد صنعتی هم‌خوان نیستند');

      if (actor.role === Role.FACTORY_OWNER && factory.managerId === actor.id) return;
      if (actor.role === Role.PARK_MANAGER) {
        const allowed = await this.prisma.industrialPark.count({
          where: { id: factory.parkId, managers: { some: { id: actor.id } } },
        });
        if (allowed) return;
      }
      if (actor.role === Role.EMPLOYEE) {
        const user = await this.prisma.user.findUnique({
          where: { id: actor.id },
          select: { employeeOfFactoryId: true },
        });
        if (user?.employeeOfFactoryId === factory.id) return;
      }
      throw new ForbiddenException('دسترسی به این واحد صنعتی ندارید');
    }

    if (parkId && actor.role === Role.PARK_MANAGER) {
      const allowed = await this.prisma.industrialPark.count({
        where: { id: parkId, managers: { some: { id: actor.id } } },
      });
      if (allowed) return;
      throw new ForbiddenException('دسترسی به این شهرک ندارید');
    }
  }

  private async canRead(actor: AuthenticatedUser, asset: { uploadedById: string; parkId: string | null; factoryId: string | null; domain: string }) {
    if (actor.role === Role.SUPER_ADMIN) return true;
    if (asset.uploadedById === actor.id) return true;
    if (asset.domain === 'avatar') return true; // profile photos readable by authenticated users
    try {
      await this.assertScopeAccess(actor, asset.parkId, asset.factoryId);
      return true;
    } catch {
      return false;
    }
  }

  async upload(
    actor: AuthenticatedUser,
    file: Express.Multer.File,
    input: { domain: string; parkId?: string; factoryId?: string },
  ) {
    if (!this.isDomain(input.domain)) {
      throw new BadRequestException(`دامنه فایل نامعتبر است. مجاز: ${MEDIA_DOMAINS.join(', ')}`);
    }
    const domain = input.domain;
    const rules = DOMAIN_RULES[domain];
    this.assertFile(domain, file);

    if (!rules.personalOk && !input.factoryId && !input.parkId && actor.role !== Role.SUPER_ADMIN) {
      throw new BadRequestException('برای این نوع فایل باید شهرک یا واحد صنعتی مشخص شود');
    }

    await this.assertScopeAccess(actor, input.parkId, input.factoryId);

    const id = uuidv4().replace(/-/g, '').slice(0, 24);
    const originalName = this.sanitizeFilename(file.originalname);
    const ext = this.extensionFor(originalName, file.mimetype);
    const objectKey = [
      domain,
      actor.id,
      input.parkId || 'personal',
      input.factoryId || 'none',
      `${id}${ext}`,
    ].join('/');

    await this.storage.putObject({
      bucket: rules.bucket,
      objectKey,
      body: file.buffer,
      contentType: file.mimetype,
      meta: {
        'x-amz-meta-original-name': encodeURIComponent(originalName),
        'x-amz-meta-uploader': actor.id,
        'x-amz-meta-domain': domain,
      },
    });

    const asset = await this.prisma.mediaAsset.create({
      data: {
        id,
        objectKey,
        bucket: rules.bucket,
        domain,
        originalName,
        contentType: file.mimetype,
        byteSize: file.size,
        parkId: input.parkId || null,
        factoryId: input.factoryId || null,
        uploadedById: actor.id,
      },
    });

    return this.toDto(asset);
  }

  async getMetadata(actor: AuthenticatedUser, id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('فایل یافت نشد');
    if (!(await this.canRead(actor, asset))) throw new ForbiddenException('دسترسی به این فایل ندارید');
    return this.toDto(asset);
  }

  async getContent(actor: AuthenticatedUser, id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('فایل یافت نشد');
    if (!(await this.canRead(actor, asset))) throw new ForbiddenException('دسترسی به این فایل ندارید');
    const buffer = await this.storage.getObjectBuffer(asset.bucket, asset.objectKey);
    return {
      buffer,
      contentType: asset.contentType,
      originalName: asset.originalName,
      byteSize: asset.byteSize,
    };
  }

  async remove(actor: AuthenticatedUser, id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('فایل یافت نشد');
    const owner = asset.uploadedById === actor.id;
    const admin = actor.role === Role.SUPER_ADMIN || actor.role === Role.PARK_MANAGER;
    if (!owner && !admin) throw new ForbiddenException('حذف این فایل مجاز نیست');

    try {
      await this.storage.removeObject(asset.bucket, asset.objectKey);
    } catch {
      // continue DB cleanup even if object already gone
    }
    await this.prisma.mediaAsset.delete({ where: { id } });
    return { message: 'فایل حذف شد' };
  }

  toDto(asset: {
    id: string;
    domain: string;
    originalName: string;
    contentType: string;
    byteSize: number;
    bucket: string;
    objectKey: string;
    parkId: string | null;
    factoryId: string | null;
    uploadedById: string;
    createdAt: Date;
  }) {
    return {
      id: asset.id,
      domain: asset.domain,
      originalName: asset.originalName,
      contentType: asset.contentType,
      byteSize: asset.byteSize,
      parkId: asset.parkId,
      factoryId: asset.factoryId,
      uploadedById: asset.uploadedById,
      createdAt: asset.createdAt,
      contentPath: `/api/v1/files/${asset.id}/content`,
      url: `/api/v1/files/${asset.id}/content`,
    };
  }
}
