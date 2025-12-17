import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { LoggerService } from '../../shared/services/logger.service';
import { CreateAdvertisementDto } from '../dto/create-advertisement.dto';
import { AdvertisementResponseDto, AdvertisementListResponseDto, AdvertisementStatsDto } from '../dto/advertisement-response.dto';
import { AdvertisementStatus, UserRole } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class AdvertisementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async create(createAdvertisementDto: CreateAdvertisementDto, userId: number): Promise<AdvertisementResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Validate park access for park managers
      if (user.role === UserRole.PARK_MANAGER && createAdvertisementDto.parkId !== user.parkId) {
        throw new ForbiddenException('You can only create advertisements for your park');
      }

      // Validate factory ownership for factory owners
      if (user.role === UserRole.FACTORY_OWNER && createAdvertisementDto.factoryId !== user.factoryId) {
        throw new ForbiddenException('You can only create advertisements for your factory');
      }

      // Validate date range
      const startDate = new Date(createAdvertisementDto.startDate);
      const endDate = new Date(createAdvertisementDto.endDate);
      
      if (endDate <= startDate) {
        throw new BadRequestException('End date must be after start date');
      }

      const status = this.determineStatus(startDate);

      const advertisement = await this.prisma.advertisement.create({
        data: {
          title: createAdvertisementDto.title,
          description: createAdvertisementDto.description,
          type: createAdvertisementDto.type,
          placement: createAdvertisementDto.placement,
          parkId: createAdvertisementDto.parkId,
          factoryId: createAdvertisementDto.factoryId,
          imageUrl: createAdvertisementDto.imageUrl,
          targetUrl: createAdvertisementDto.targetUrl,
          startDate,
          endDate,
          priority: createAdvertisementDto.priority || 1,
          status,
          maxDailyImpressions: createAdvertisementDto.maxDailyImpressions,
          maxTotalImpressions: createAdvertisementDto.maxTotalImpressions,
          isActive: createAdvertisementDto.isActive,
          metadata: createAdvertisementDto.metadata || {},
          tags: createAdvertisementDto.tags || [],
          createdBy: userId,
        },
        include: {
          park: true,
          factory: true,
        },
      });

      this.logger.log(`Advertisement created: ${advertisement.id}`, 'AdvertisementService');
      return this.mapToResponseDto(advertisement);
    } catch (error) {
      this.logger.error(`Failed to create advertisement: ${error.message}`, 'AdvertisementService');
      throw error;
    }
  }

  async findAll(
    userId: number,
    userRole: UserRole,
    page: number = 1,
    limit: number = 10,
    filters?: {
      type?: string;
      placement?: string;
      parkId?: number;
      factoryId?: number;
      status?: string;
      isActive?: boolean;
    }
  ): Promise<AdvertisementListResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { factory: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      let whereClause: Prisma.AdvertisementWhereInput = {};

      // Role-based filtering
      if (userRole === UserRole.FACTORY_OWNER) {
        whereClause.factoryId = user.factoryId;
      } else if (userRole === UserRole.PARK_MANAGER) {
        whereClause.parkId = user.parkId;
      }

      // Apply additional filters
      if (filters?.type) whereClause.type = filters.type;
      if (filters?.placement) whereClause.placement = filters.placement;
      if (filters?.parkId) whereClause.parkId = filters.parkId;
      if (filters?.factoryId) whereClause.factoryId = filters.factoryId;
      if (filters?.status) whereClause.status = filters.status;
      if (filters?.isActive !== undefined) whereClause.isActive = filters.isActive;

      const [advertisements, total] = await this.prisma.$transaction([
        this.prisma.advertisement.findMany({
          where: whereClause,
          include: {
            park: true,
            factory: true,
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [
            { priority: 'desc' },
            { createdAt: 'desc' },
          ],
        }),
        this.prisma.advertisement.count({ where: whereClause }),
      ]);

      return {
        advertisements: advertisements.map(ad => this.mapToResponseDto(ad)),
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch advertisements: ${error.message}`, 'AdvertisementService');
      throw error;
    }
  }

  async findActiveForPlacement(
    placement: string,
    userId: number,
    userRole: UserRole,
    limit: number = 5
  ): Promise<AdvertisementResponseDto[]> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { factory: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      let whereClause: Prisma.AdvertisementWhereInput = {
        placement,
        status: AdvertisementStatus.ACTIVE,
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
        OR: [
          // System-wide advertisements
          { parkId: null },
          // Park-specific advertisements
          { parkId: user.parkId },
        ],
      };

      // Apply role-based filtering
      if (userRole === UserRole.FACTORY_OWNER && user.factoryId) {
        whereClause.OR = [
          { targetFactories: { has: user.factoryId } },
          { targetFactories: { isEmpty: true } },
        ];
      }

      const advertisements = await this.prisma.advertisement.findMany({
        where: whereClause,
        include: {
          park: true,
          factory: true,
        },
        take: limit,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      return advertisements.map(ad => this.mapToResponseDto(ad));
    } catch (error) {
      this.logger.error(`Failed to fetch active advertisements: ${error.message}`, 'AdvertisementService');
      throw error;
    }
  }

  async findOne(id: number, userId: number, userRole: UserRole): Promise<AdvertisementResponseDto> {
    try {
      const advertisement = await this.prisma.advertisement.findUnique({
        where: { id },
        include: {
          park: true,
          factory: true,
        },
      });

      if (!advertisement) {
        throw new NotFoundException('Advertisement not found');
      }

      // Check access permissions
      if (userRole === UserRole.FACTORY_OWNER && advertisement.factoryId !== userId) {
        throw new ForbiddenException('Access denied');
      }

      if (userRole === UserRole.PARK_MANAGER && advertisement.parkId !== userId) {
        throw new ForbiddenException('Access denied');
      }

      return this.mapToResponseDto(advertisement);
    } catch (error) {
      this.logger.error(`Failed to fetch advertisement: ${error.message}`, 'AdvertisementService');
      throw error;
    }
  }

  async update(
    id: number,
    updateData: Partial<CreateAdvertisementDto>,
    userId: number,
    userRole: UserRole
  ): Promise<AdvertisementResponseDto> {
    try {
      const advertisement = await this.prisma.advertisement.findUnique({
        where: { id },
      });

      if (!advertisement) {
        throw new NotFoundException('Advertisement not found');
      }

      // Check permissions
      if (userRole === UserRole.FACTORY_OWNER && advertisement.factoryId !== userId) {
        throw new ForbiddenException('You can only update your own advertisements');
      }

      if (userRole === UserRole.PARK_MANAGER && advertisement.parkId !== userId) {
        throw new ForbiddenException('You can only update advertisements for your park');
      }

      // Validate date range if updating dates
      if (updateData.startDate || updateData.endDate) {
        const startDate = updateData.startDate ? new Date(updateData.startDate) : advertisement.startDate;
        const endDate = updateData.endDate ? new Date(updateData.endDate) : advertisement.endDate;
        
        if (endDate <= startDate) {
          throw new BadRequestException('End date must be after start date');
        }
      }

      const status = updateData.startDate ? 
        this.determineStatus(new Date(updateData.startDate)) : 
        advertisement.status;

      const updatedAdvertisement = await this.prisma.advertisement.update({
        where: { id },
        data: {
          ...updateData,
          startDate: updateData.startDate ? new Date(updateData.startDate) : undefined,
          endDate: updateData.endDate ? new Date(updateData.endDate) : undefined,
          status,
          updatedBy: userId,
        },
        include: {
          park: true,
          factory: true,
        },
      });

      this.logger.log(`Advertisement updated: ${id}`, 'AdvertisementService');
      return this.mapToResponseDto(updatedAdvertisement);
    } catch (error) {
      this.logger.error(`Failed to update advertisement: ${error.message}`, 'AdvertisementService');
      throw error;
    }
  }

  async delete(id: number, userId: number, userRole: UserRole): Promise<void> {
    try {
      const advertisement = await this.prisma.advertisement.findUnique({
        where: { id },
      });

      if (!advertisement) {
        throw new NotFoundException('Advertisement not found');
      }

      // Check permissions
      if (userRole === UserRole.FACTORY_OWNER && advertisement.factoryId !== userId) {
        throw new ForbiddenException('You can only delete your own advertisements');
      }

      if (userRole === UserRole.PARK_MANAGER && advertisement.parkId !== userId) {
        throw new ForbiddenException('You can only delete advertisements for your park');
      }

      await this.prisma.advertisement.delete({
        where: { id },
      });

      this.logger.log(`Advertisement deleted: ${id}`, 'AdvertisementService');
    } catch (error) {
      this.logger.error(`Failed to delete advertisement: ${error.message}`, 'AdvertisementService');
      throw error;
    }
  }

  async recordImpression(id: number, userId?: number): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Update total impressions
      await this.prisma.advertisement.update({
        where: { id },
        data: {
          currentImpressions: { increment: 1 },
        },
      });

      // Create impression record for analytics
      await this.prisma.advertisementImpression.create({
        data: {
          advertisementId: id,
          userId: userId || null,
          date: today,
        },
      });

      this.logger.log(`Impression recorded for advertisement: ${id}`, 'AdvertisementService');
    } catch (error) {
      this.logger.error(`Failed to record impression: ${error.message}`, 'AdvertisementService');
      throw error;
    }
  }

  async recordClick(id: number, userId?: number): Promise<void> {
    try {
      await this.prisma.advertisement.update({
        where: { id },
        data: {
          clickCount: { increment: 1 },
        },
      });

      // Create click record for analytics
      await this.prisma.advertisementClick.create({
        data: {
          advertisementId: id,
          userId: userId || null,
        },
      });

      this.logger.log(`Click recorded for advertisement: ${id}`, 'AdvertisementService');
    } catch (error) {
      this.logger.error(`Failed to record click: ${error.message}`, 'AdvertisementService');
      throw error;
    }
  }

  async getStatistics(parkId?: number, factoryId?: number): Promise<AdvertisementStatsDto> {
    try {
      const whereClause: Prisma.AdvertisementWhereInput = {};
      
      if (parkId) whereClause.parkId = parkId;
      if (factoryId) whereClause.factoryId = factoryId;

      const advertisements = await this.prisma.advertisement.findMany({
        where: whereClause,
      });

      const total = advertisements.length;
      const active = advertisements.filter(ad => ad.isActive && ad.status === 'ACTIVE').length;
      const inactive = total - active;

      const totalImpressions = advertisements.reduce((sum, ad) => sum + ad.currentImpressions, 0);
      const totalClicks = advertisements.reduce((sum, ad) => sum + ad.clickCount, 0);
      const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

      const performanceByPlacement = {};
      const placements = [...new Set(advertisements.map(ad => ad.placement))];
      
      placements.forEach(placement => {
        const placementAds = advertisements.filter(ad => ad.placement === placement);
        const impressions = placementAds.reduce((sum, ad) => sum + ad.currentImpressions, 0);
        const clicks = placementAds.reduce((sum, ad) => sum + ad.clickCount, 0);
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        
        performanceByPlacement[placement] = { impressions, clicks, ctr };
      });

      return {
        total,
        active,
        inactive,
        totalImpressions,
        totalClicks,
        averageCtr,
        performanceByPlacement,
      };
    } catch (error) {
      this.logger.error(`Failed to get statistics: ${error.message}`, 'AdvertisementService');
      throw error;
    }
  }

  // Scheduled task to update advertisement statuses
  @Cron(CronExpression.EVERY_HOUR)
  async updateAdvertisementStatuses() {
    try {
      const now = new Date();

      // Activate advertisements that should be active
      await this.prisma.advertisement.updateMany({
        where: {
          status: AdvertisementStatus.PENDING,
          startDate: { lte: now },
          endDate: { gte: now },
          isActive: true,
        },
        data: {
          status: AdvertisementStatus.ACTIVE,
        },
      });

      // Deactivate expired advertisements
      await this.prisma.advertisement.updateMany({
        where: {
          status: AdvertisementStatus.ACTIVE,
          endDate: { lt: now },
        },
        data: {
          status: AdvertisementStatus.EXPIRED,
          isActive: false,
        },
      });

      this.logger.log('Advertisement statuses updated', 'AdvertisementService');
    } catch (error) {
      this.logger.error(`Failed to update advertisement statuses: ${error.message}`, 'AdvertisementService');
    }
  }

  // Scheduled task to reset daily impressions
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resetDailyImpressions() {
    try {
      await this.prisma.advertisement.updateMany({
        where: {
          status: AdvertisementStatus.ACTIVE,
        },
        data: {
          currentDailyImpressions: 0,
        },
      });

      this.logger.log('Daily impressions reset', 'AdvertisementService');
    } catch (error) {
      this.logger.error(`Failed to reset daily impressions: ${error.message}`, 'AdvertisementService');
    }
  }

  private determineStatus(startDate: Date): AdvertisementStatus {
    const now = new Date();
    if (startDate > now) {
      return AdvertisementStatus.PENDING;
    }
    return AdvertisementStatus.ACTIVE;
  }

  private mapToResponseDto(advertisement: any): AdvertisementResponseDto {
    const ctr = advertisement.currentImpressions > 0 ? 
      (advertisement.clickCount / advertisement.currentImpressions) * 100 : 0;

    return {
      id: advertisement.id,
      title: advertisement.title,
      description: advertisement.description,
      type: advertisement.type,
      placement: advertisement.placement,
      parkId: advertisement.parkId,
      parkName: advertisement.park?.name,
      factoryId: advertisement.factoryId,
      factoryName: advertisement.factory?.name,
      imageUrl: advertisement.imageUrl,
      targetUrl: advertisement.targetUrl,
      startDate: advertisement.startDate,
      endDate: advertisement.endDate,
      priority: advertisement.priority,
      status: advertisement.status,
      maxDailyImpressions: advertisement.maxDailyImpressions,
      maxTotalImpressions: advertisement.maxTotalImpressions,
      currentImpressions: advertisement.currentImpressions,
      currentDailyImpressions: advertisement.currentDailyImpressions,
      clickCount: advertisement.clickCount,
      ctr: parseFloat(ctr.toFixed(2)),
      isActive: advertisement.isActive,
      metadata: advertisement.metadata,
      tags: advertisement.tags,
      createdByName: advertisement.createdByUser?.name || 'System',
      createdAt: advertisement.createdAt,
      updatedAt: advertisement.updatedAt,
    };
  }
}
