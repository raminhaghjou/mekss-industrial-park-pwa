import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { LoggerService } from '../../shared/services/logger.service';
import { NotificationService } from '../../shared/services/notification.service';
import { CreateAnnouncementDto } from '../dto/create-announcement.dto';
import { AnnouncementResponseDto, AnnouncementListResponseDto, AnnouncementStatsDto } from '../dto/announcement-response.dto';
import { AnnouncementStatus, UserRole, AnnouncementType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class AnnouncementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(createAnnouncementDto: CreateAnnouncementDto, userId: number): Promise<AnnouncementResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Validate park access for park managers
      if (user.role === UserRole.PARK_MANAGER && createAnnouncementDto.parkId !== user.parkId) {
        throw new ForbiddenException('You can only create announcements for your park');
      }

      const status = this.determineStatus(createAnnouncementDto);

      const announcement = await this.prisma.announcement.create({
        data: {
          title: createAnnouncementDto.title,
          content: createAnnouncementDto.content,
          type: createAnnouncementDto.type,
          priority: createAnnouncementDto.priority,
          status,
          parkId: createAnnouncementDto.parkId,
          targetRoles: createAnnouncementDto.targetRoles || [],
          targetFactories: createAnnouncementDto.targetFactories || [],
          scheduledFor: createAnnouncementDto.scheduledFor ? new Date(createAnnouncementDto.scheduledFor) : null,
          expiresAt: createAnnouncementDto.expiresAt ? new Date(createAnnouncementDto.expiresAt) : null,
          images: createAnnouncementDto.images || [],
          attachments: createAnnouncementDto.attachments || [],
          createdBy: userId,
        },
        include: {
          park: true,
        },
      });

      // Send notifications if published immediately
      if (status === AnnouncementStatus.PUBLISHED && createAnnouncementDto.sendNotification) {
        await this.sendAnnouncementNotifications(announcement);
      }

      // Schedule SMS notifications if requested
      if (status === AnnouncementStatus.PUBLISHED && createAnnouncementDto.sendSms) {
        await this.scheduleSmsNotifications(announcement);
      }

      this.logger.log(`Announcement created: ${announcement.id}`, 'AnnouncementService');
      return this.mapToResponseDto(announcement);
    } catch (error) {
      this.logger.error(`Failed to create announcement: ${error.message}`, 'AnnouncementService');
      throw error;
    }
  }

  async findAll(
    userId: number,
    userRole: UserRole,
    page: number = 1,
    limit: number = 10,
    filters?: {
      type?: AnnouncementType;
      priority?: string;
      parkId?: number;
      status?: AnnouncementStatus;
    }
  ): Promise<AnnouncementListResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { factory: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      let whereClause: Prisma.AnnouncementWhereInput = {
        OR: [
          // System-wide announcements
          { parkId: null },
          // Park-specific announcements user has access to
          { parkId: user.parkId },
        ],
        status: AnnouncementStatus.PUBLISHED,
      };

      // Apply role-based filtering
      if (userRole === UserRole.FACTORY_OWNER && user.factoryId) {
        whereClause.OR = [
          { targetFactories: { has: user.factoryId } },
          { targetFactories: { isEmpty: true } },
        ];
      }

      // Apply additional filters
      if (filters?.type) whereClause.type = filters.type;
      if (filters?.priority) whereClause.priority = filters.priority;
      if (filters?.parkId) whereClause.parkId = filters.parkId;
      if (filters?.status) whereClause.status = filters.status;

      const [announcements, total] = await this.prisma.$transaction([
        this.prisma.announcement.findMany({
          where: whereClause,
          include: {
            park: true,
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [
            { priority: 'desc' },
            { publishedAt: 'desc' },
            { createdAt: 'desc' },
          ],
        }),
        this.prisma.announcement.count({ where: whereClause }),
      ]);

      return {
        announcements: announcements.map(announcement => this.mapToResponseDto(announcement)),
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch announcements: ${error.message}`, 'AnnouncementService');
      throw error;
    }
  }

  async findOne(id: number, userId: number, userRole: UserRole): Promise<AnnouncementResponseDto> {
    try {
      const announcement = await this.prisma.announcement.findUnique({
        where: { id },
        include: {
          park: true,
        },
      });

      if (!announcement) {
        throw new NotFoundException('Announcement not found');
      }

      // Check access permissions
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      
      if (announcement.parkId && user.parkId !== announcement.parkId) {
        throw new ForbiddenException('Access denied');
      }

      if (userRole === UserRole.FACTORY_OWNER && user.factoryId) {
        if (announcement.targetFactories.length > 0 && 
            !announcement.targetFactories.includes(user.factoryId)) {
          throw new ForbiddenException('Access denied');
        }
      }

      // Increment view count
      await this.prisma.announcement.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      });

      return this.mapToResponseDto(announcement);
    } catch (error) {
      this.logger.error(`Failed to fetch announcement: ${error.message}`, 'AnnouncementService');
      throw error;
    }
  }

  async update(
    id: number,
    updateData: Partial<CreateAnnouncementDto>,
    userId: number,
    userRole: UserRole
  ): Promise<AnnouncementResponseDto> {
    try {
      const announcement = await this.prisma.announcement.findUnique({
        where: { id },
      });

      if (!announcement) {
        throw new NotFoundException('Announcement not found');
      }

      // Check permissions
      if (userRole === UserRole.PARK_MANAGER && announcement.parkId !== userId) {
        throw new ForbiddenException('You can only update announcements for your park');
      }

      const status = updateData.scheduledFor ? 
        AnnouncementStatus.SCHEDULED : 
        this.determineStatus({ ...announcement, ...updateData });

      const updatedAnnouncement = await this.prisma.announcement.update({
        where: { id },
        data: {
          ...updateData,
          scheduledFor: updateData.scheduledFor ? new Date(updateData.scheduledFor) : undefined,
          expiresAt: updateData.expiresAt ? new Date(updateData.expiresAt) : undefined,
          status,
          updatedBy: userId,
        },
        include: {
          park: true,
        },
      });

      this.logger.log(`Announcement updated: ${id}`, 'AnnouncementService');
      return this.mapToResponseDto(updatedAnnouncement);
    } catch (error) {
      this.logger.error(`Failed to update announcement: ${error.message}`, 'AnnouncementService');
      throw error;
    }
  }

  async publish(id: number, userId: number, userRole: UserRole): Promise<AnnouncementResponseDto> {
    try {
      const announcement = await this.prisma.announcement.findUnique({
        where: { id },
      });

      if (!announcement) {
        throw new NotFoundException('Announcement not found');
      }

      // Check permissions
      if (userRole === UserRole.PARK_MANAGER && announcement.parkId !== userId) {
        throw new ForbiddenException('You can only publish announcements for your park');
      }

      const publishedAnnouncement = await this.prisma.announcement.update({
        where: { id },
        data: {
          status: AnnouncementStatus.PUBLISHED,
          publishedAt: new Date(),
          updatedBy: userId,
        },
        include: {
          park: true,
        },
      });

      // Send notifications
      await this.sendAnnouncementNotifications(publishedAnnouncement);

      this.logger.log(`Announcement published: ${id}`, 'AnnouncementService');
      return this.mapToResponseDto(publishedAnnouncement);
    } catch (error) {
      this.logger.error(`Failed to publish announcement: ${error.message}`, 'AnnouncementService');
      throw error;
    }
  }

  async delete(id: number, userId: number, userRole: UserRole): Promise<void> {
    try {
      const announcement = await this.prisma.announcement.findUnique({
        where: { id },
      });

      if (!announcement) {
        throw new NotFoundException('Announcement not found');
      }

      // Check permissions
      if (userRole === UserRole.PARK_MANAGER && announcement.parkId !== userId) {
        throw new ForbiddenException('You can only delete announcements for your park');
      }

      await this.prisma.announcement.delete({
        where: { id },
      });

      this.logger.log(`Announcement deleted: ${id}`, 'AnnouncementService');
    } catch (error) {
      this.logger.error(`Failed to delete announcement: ${error.message}`, 'AnnouncementService');
      throw error;
    }
  }

  async getStatistics(parkId?: number): Promise<AnnouncementStatsDto> {
    try {
      const whereClause: Prisma.AnnouncementWhereInput = parkId ? { parkId } : {};

      const [stats, viewsByType] = await this.prisma.$transaction([
        this.prisma.announcement.groupBy({
          by: ['status'],
          where: whereClause,
          _count: true,
        }),
        this.prisma.announcement.groupBy({
          by: ['type'],
          where: { ...whereClause, status: AnnouncementStatus.PUBLISHED },
          _sum: { viewCount: true },
        }),
      ]);

      const total = await this.prisma.announcement.count({ where: whereClause });
      const published = await this.prisma.announcement.count({ 
        where: { ...whereClause, status: AnnouncementStatus.PUBLISHED } 
      });
      const draft = await this.prisma.announcement.count({ 
        where: { ...whereClause, status: AnnouncementStatus.DRAFT } 
      });
      const scheduled = await this.prisma.announcement.count({ 
        where: { ...whereClause, status: AnnouncementStatus.SCHEDULED } 
      });

      const viewsMap = {};
      viewsByType.forEach(item => {
        viewsMap[item.type] = item._sum.viewCount || 0;
      });

      return {
        total,
        published,
        draft,
        scheduled,
        viewsByType: viewsMap,
      };
    } catch (error) {
      this.logger.error(`Failed to get statistics: ${error.message}`, 'AnnouncementService');
      throw error;
    }
  }

  // Scheduled task to publish scheduled announcements
  @Cron(CronExpression.EVERY_MINUTE)
  async publishScheduledAnnouncements() {
    try {
      const scheduledAnnouncements = await this.prisma.announcement.findMany({
        where: {
          status: AnnouncementStatus.SCHEDULED,
          scheduledFor: {
            lte: new Date(),
          },
        },
      });

      for (const announcement of scheduledAnnouncements) {
        await this.prisma.announcement.update({
          where: { id: announcement.id },
          data: {
            status: AnnouncementStatus.PUBLISHED,
            publishedAt: new Date(),
          },
        });

        await this.sendAnnouncementNotifications(announcement);
        this.logger.log(`Published scheduled announcement: ${announcement.id}`, 'AnnouncementService');
      }
    } catch (error) {
      this.logger.error(`Failed to publish scheduled announcements: ${error.message}`, 'AnnouncementService');
    }
  }

  private determineStatus(createAnnouncementDto: CreateAnnouncementDto): AnnouncementStatus {
    if (createAnnouncementDto.scheduledFor) {
      return AnnouncementStatus.SCHEDULED;
    }
    return AnnouncementStatus.PUBLISHED;
  }

  private async sendAnnouncementNotifications(announcement: any): Promise<void> {
    const recipients = await this.getTargetRecipients(announcement);
    
    await this.notificationService.sendNotification({
      title: announcement.title,
      message: announcement.content,
      type: 'ANNOUNCEMENT',
      recipients,
      priority: announcement.priority,
      metadata: {
        announcementId: announcement.id,
        type: announcement.type,
        parkId: announcement.parkId,
      },
    });
  }

  private async scheduleSmsNotifications(announcement: any): Promise<void> {
    // Implementation for SMS scheduling would go here
    // This would integrate with the SMS service and queue system
    this.logger.log(`SMS notifications scheduled for announcement: ${announcement.id}`, 'AnnouncementService');
  }

  private async getTargetRecipients(announcement: any): Promise<number[]> {
    const whereClause: Prisma.UserWhereInput = {};

    if (announcement.parkId) {
      whereClause.parkId = announcement.parkId;
    }

    if (announcement.targetRoles && announcement.targetRoles.length > 0) {
      whereClause.role = { in: announcement.targetRoles };
    }

    if (announcement.targetFactories && announcement.targetFactories.length > 0) {
      whereClause.factoryId = { in: announcement.targetFactories };
    }

    const users = await this.prisma.user.findMany({
      where: whereClause,
      select: { id: true },
    });

    return users.map(user => user.id);
  }

  private mapToResponseDto(announcement: any): AnnouncementResponseDto {
    return {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      priority: announcement.priority,
      status: announcement.status,
      parkId: announcement.parkId,
      parkName: announcement.park?.name,
      targetRoles: announcement.targetRoles || [],
      targetFactories: announcement.targetFactories || [],
      scheduledFor: announcement.scheduledFor,
      publishedAt: announcement.publishedAt,
      expiresAt: announcement.expiresAt,
      images: announcement.images || [],
      attachments: announcement.attachments || [],
      viewCount: announcement.viewCount || 0,
      createdByName: announcement.createdByUser?.name || 'System',
      createdAt: announcement.createdAt,
      updatedAt: announcement.updatedAt,
    };
  }
}
