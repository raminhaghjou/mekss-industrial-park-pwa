import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PlateReadEngine, PlateReadOutcome, PlateType, Prisma, Role } from '@prisma/client';
import sharp = require('sharp');
import type { AuthenticatedUser } from '../core/auth.guard';
import { ManagementService } from '../core/management.service';
import { PrismaService } from '../core/prisma.service';
import { StorageService } from '../core/storage.service';
import { canonicalPlateOrRaw, normalizePlate } from './plate-grammar';

const BUCKET = 'plate-reads';

export interface PlateReadRecord {
  actor: AuthenticatedUser;
  parkId?: string | null;
  sessionId?: string | null;
  engine: PlateReadEngine;
  outcome: PlateReadOutcome;
  rawText: string;
  plate: string;
  plateType?: string | null;
  confidence: number;
  frames?: number;
  latencyMs?: number | null;
  bbox?: { x: number; y: number; w: number; h: number } | null;
  gatePassId?: string | null;
  image?: Buffer | null;
}

export interface PlateReadConfirmation {
  plate?: string;
  gatePassId?: string;
}

/**
 * Persists every plate read (and optionally its frame + plate crop) so guard confirmations and
 * corrections become labelled data. Image upload never blocks the live scan response.
 */
@Injectable()
export class PlateReadAuditService {
  private readonly logger = new Logger(PlateReadAuditService.name);
  private readonly storeImages: boolean;
  private readonly imageRetentionDays: number;
  private readonly rowRetentionDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly management: ManagementService,
    config: ConfigService,
  ) {
    this.storeImages = config.get<string>('ANPR_AUDIT_IMAGES', 'true') !== 'false';
    this.imageRetentionDays = Math.max(1, Number(config.get<string>('ANPR_AUDIT_RETENTION_DAYS', '90')) || 90);
    this.rowRetentionDays = Math.max(this.imageRetentionDays, Number(config.get<string>('ANPR_AUDIT_ROW_RETENTION_DAYS', '365')) || 365);
  }

  async record(input: PlateReadRecord): Promise<string | null> {
    try {
      const plateType = toPlateType(input.plateType) ?? toPlateType(normalizePlate(input.plate).plateType);
      const row = await this.prisma.plateReadEvent.create({
        data: {
          sessionId: input.sessionId ?? null,
          rawText: input.rawText.slice(0, 64),
          plate: input.plate.slice(0, 32),
          plateType,
          confidence: clamp01(input.confidence),
          engine: input.engine,
          outcome: input.outcome,
          frames: Math.max(1, Math.round(input.frames ?? 1)),
          latencyMs: input.latencyMs == null ? null : Math.round(input.latencyMs),
          bbox: input.bbox ? (input.bbox as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          guardId: input.actor.id,
          parkId: input.parkId ?? null,
          gatePassId: input.gatePassId ?? null,
        },
        select: { id: true, createdAt: true },
      });
      if (this.storeImages && input.image?.length) {
        void this.uploadImages(row.id, row.createdAt, input.image, input.bbox ?? null);
      }
      return row.id;
    } catch (error) {
      this.logger.warn(`failed to record plate read: ${(error as Error).message}`);
      return null;
    }
  }

  async confirm(actor: AuthenticatedUser, id: string, input: PlateReadConfirmation) {
    const event = await this.prisma.plateReadEvent.findUnique({ where: { id }, select: { id: true, guardId: true, plate: true } });
    if (!event) throw new NotFoundException('Plate read not found');
    if (event.guardId !== actor.id && actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('You can only confirm your own plate reads');
    }
    let gatePassId: string | undefined;
    if (input.gatePassId) {
      const [pass] = await this.management.gatePassesForGuard(actor, [input.gatePassId]);
      if (!pass) throw new NotFoundException('Gate pass not found');
      gatePassId = pass.id;
    }
    const corrected = input.plate ? canonicalPlateOrRaw(input.plate) : null;
    const changed = Boolean(corrected && corrected !== event.plate);
    return this.prisma.plateReadEvent.update({
      where: { id },
      data: {
        outcome: changed ? PlateReadOutcome.CORRECTED : PlateReadOutcome.CONFIRMED,
        correctedPlate: changed ? corrected : null,
        confirmedAt: new Date(),
        ...(gatePassId ? { gatePassId } : {}),
      },
      select: { id: true, plate: true, correctedPlate: true, outcome: true, gatePassId: true, confirmedAt: true },
    });
  }

  @Cron('0 30 3 * * *')
  async purgeExpired(): Promise<void> {
    const imageCutoff = new Date(Date.now() - this.imageRetentionDays * 86_400_000);
    const rowCutoff = new Date(Date.now() - this.rowRetentionDays * 86_400_000);
    let images = 0;
    for (;;) {
      const batch = await this.prisma.plateReadEvent.findMany({
        where: { createdAt: { lt: imageCutoff }, OR: [{ imageKey: { not: null } }, { cropKey: { not: null } }] },
        select: { id: true, imageKey: true, cropKey: true },
        take: 200,
      });
      if (!batch.length) break;
      for (const row of batch) {
        for (const key of [row.imageKey, row.cropKey]) {
          if (key) await this.storage.removeObject(BUCKET, key).catch(() => undefined);
        }
      }
      await this.prisma.plateReadEvent.updateMany({ where: { id: { in: batch.map((r) => r.id) } }, data: { imageKey: null, cropKey: null } });
      images += batch.length;
    }
    const { count } = await this.prisma.plateReadEvent.deleteMany({ where: { createdAt: { lt: rowCutoff } } });
    if (images || count) this.logger.log(`plate-read retention: purged images of ${images} reads, deleted ${count} rows`);
  }

  private async uploadImages(id: string, createdAt: Date, image: Buffer, bbox: PlateReadRecord['bbox']): Promise<void> {
    try {
      const prefix = createdAt.toISOString().slice(0, 10).replace(/-/g, '/');
      const imageKey = `${prefix}/${id}.jpg`;
      await this.storage.putObject({ bucket: BUCKET, objectKey: imageKey, body: image, contentType: 'image/jpeg' });
      let cropKey: string | null = null;
      if (bbox && bbox.w > 4 && bbox.h > 4) {
        const crop = await cropPlate(image, bbox);
        if (crop) {
          cropKey = `${prefix}/${id}-crop.jpg`;
          await this.storage.putObject({ bucket: BUCKET, objectKey: cropKey, body: crop, contentType: 'image/jpeg' });
        }
      }
      await this.prisma.plateReadEvent.update({ where: { id }, data: { imageKey, cropKey } });
    } catch (error) {
      this.logger.warn(`failed to store plate-read images for ${id}: ${(error as Error).message}`);
    }
  }
}

async function cropPlate(image: Buffer, bbox: { x: number; y: number; w: number; h: number }): Promise<Buffer | null> {
  const meta = await sharp(image).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  const padX = bbox.w * 0.08;
  const padY = bbox.h * 0.2;
  const left = Math.max(0, Math.floor(bbox.x - padX));
  const top = Math.max(0, Math.floor(bbox.y - padY));
  const width = Math.min(W - left, Math.ceil(bbox.w + 2 * padX));
  const height = Math.min(H - top, Math.ceil(bbox.h + 2 * padY));
  if (width < 4 || height < 4) return null;
  return sharp(image).extract({ left, top, width, height }).jpeg({ quality: 90 }).toBuffer();
}

function toPlateType(value: string | null | undefined): PlateType | null {
  return value && (Object.values(PlateType) as string[]).includes(value) ? (value as PlateType) : null;
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
