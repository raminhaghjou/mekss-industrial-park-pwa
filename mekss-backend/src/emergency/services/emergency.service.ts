import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { LoggerService } from '../../shared/services/logger.service';
import { NotificationService } from '../../shared/services/notification.service';
import { SmsService } from '../../shared/services/sms.service';
import { CreateEmergencyAlertDto } from '../dto/create-emergency-alert.dto';
import { EmergencyResponseDto, EmergencyListResponseDto, EmergencyStatsDto, EmergencyActionDto } from '../dto/emergency-response.dto';
import { EmergencyStatus, EmergencySeverity, UserRole, EmergencyType } from '@prisma/client';
import { Prisma } from '@prisma/client';

@Injectable()
export class EmergencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly notificationService: NotificationService,
    private readonly smsService: SmsService,
  ) {}

  async create(createEmergencyDto: CreateEmergencyAlertDto, userId: number): Promise<EmergencyResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Validate park access for park managers
      if (user.role === UserRole.PARK_MANAGER && createEmergencyDto.parkId !== user.parkId) {
        throw new ForbiddenException('You can only create emergency alerts for your park');
      }

      const emergency = await this.prisma.emergencyAlert.create({
        data: {
          title: createEmergencyDto.title,
          description: createEmergencyDto.description,
          type: createEmergencyDto.type,
          severity: createEmergencyDto.severity,
          status: EmergencyStatus.ACTIVE,
          parkId: createEmergencyDto.parkId,
          location: createEmergencyDto.location,
          coordinates: createEmergencyDto.coordinates,
          affectedFactories: createEmergencyDto.affectedFactories || [],
          affectedRadius: createEmergencyDto.affectedRadius,
          instructions: createEmergencyDto.instructions,
          contactInfo: createEmergencyDto.contactInfo,
          images: createEmergencyDto.images || [],
          documents: createEmergencyDto.documents || [],
          createdBy: userId,
        },
        include: {
          park: true,
        },
      });

      // Send emergency notifications
      await this.handleEmergencyNotifications(emergency, createEmergencyDto);

      this.logger.log(`Emergency alert created: ${emergency.id}`, 'EmergencyService');
      return this.mapToResponseDto(emergency);
    } catch (error) {
      this.logger.error(`Failed to create emergency alert: ${error.message}`, 'EmergencyService');
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
      severity?: string;
      parkId?: number;
      status?: string;
    }
  ): Promise<EmergencyListResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { factory: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      let whereClause: Prisma.EmergencyAlertWhereInput = {};

      // Role-based filtering
      if (userRole === UserRole.FACTORY_OWNER) {
        whereClause.affectedFactories = { has: user.factoryId };
      } else if (userRole === UserRole.PARK_MANAGER) {
        whereClause.parkId = user.parkId;
      }

      // Apply additional filters
      if (filters?.type) whereClause.type = filters.type;
      if (filters?.severity) whereClause.severity = filters.severity;
      if (filters?.parkId) whereClause.parkId = filters.parkId;
      if (filters?.status) whereClause.status = filters.status;

      const [emergencies, total] = await this.prisma.$transaction([
        this.prisma.emergencyAlert.findMany({
          where: whereClause,
          include: {
            park: true,
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [
            { severity: 'desc' },
            { createdAt: 'desc' },
          ],
        }),
        this.prisma.emergencyAlert.count({ where: whereClause }),
      ]);

      return {
        emergencies: emergencies.map(emergency => this.mapToResponseDto(emergency)),
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch emergency alerts: ${error.message}`, 'EmergencyService');
      throw error;
    }
  }

  async findOne(id: number, userId: number, userRole: UserRole): Promise<EmergencyResponseDto> {
    try {
      const emergency = await this.prisma.emergencyAlert.findUnique({
        where: { id },
        include: {
          park: true,
        },
      });

      if (!emergency) {
        throw new NotFoundException('Emergency alert not found');
      }

      // Check access permissions
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      
      if (userRole === UserRole.FACTORY_OWNER && user.factoryId) {
        if (!emergency.affectedFactories.includes(user.factoryId)) {
          throw new ForbiddenException('Access denied');
        }
      } else if (userRole === UserRole.PARK_MANAGER) {
        if (emergency.parkId !== user.parkId) {
          throw new ForbiddenException('Access denied');
        }
      }

      return this.mapToResponseDto(emergency);
    } catch (error) {
      this.logger.error(`Failed to fetch emergency alert: ${error.message}`, 'EmergencyService');
      throw error;
    }
  }

  async update(
    id: number,
    updateData: Partial<CreateEmergencyAlertDto>,
    userId: number,
    userRole: UserRole
  ): Promise<EmergencyResponseDto> {
    try {
      const emergency = await this.prisma.emergencyAlert.findUnique({
        where: { id },
      });

      if (!emergency) {
        throw new NotFoundException('Emergency alert not found');
      }

      // Check permissions
      if (userRole === UserRole.PARK_MANAGER && emergency.parkId !== userId) {
        throw new ForbiddenException('You can only update emergency alerts for your park');
      }

      // Cannot update resolved emergencies
      if (emergency.status === EmergencyStatus.RESOLVED) {
        throw new BadRequestException('Cannot update resolved emergency alerts');
      }

      const updatedEmergency = await this.prisma.emergencyAlert.update({
        where: { id },
        data: {
          ...updateData,
          updatedBy: userId,
        },
        include: {
          park: true,
        },
      });

      this.logger.log(`Emergency alert updated: ${id}`, 'EmergencyService');
      return this.mapToResponseDto(updatedEmergency);
    } catch (error) {
      this.logger.error(`Failed to update emergency alert: ${error.message}`, 'EmergencyService');
      throw error;
    }
  }

  async takeAction(
    id: number,
    actionDto: EmergencyActionDto,
    userId: number,
    userRole: UserRole
  ): Promise<EmergencyResponseDto> {
    try {
      const emergency = await this.prisma.emergencyAlert.findUnique({
        where: { id },
      });

      if (!emergency) {
        throw new NotFoundException('Emergency alert not found');
      }

      // Check permissions
      if (userRole === UserRole.PARK_MANAGER && emergency.parkId !== userId) {
        throw new ForbiddenException('You can only take actions on emergency alerts for your park');
      }

      let updateData: any = {
        updatedBy: userId,
      };

      switch (actionDto.action) {
        case 'assign_team':
          updateData.responseTeam = actionDto.data?.team;
          break;
        case 'resolve':
          updateData.status = EmergencyStatus.RESOLVED;
          updateData.resolvedAt = new Date();
          updateData.resolutionNotes = actionDto.data?.notes;
          break;
        case 'escalate':
          updateData.severity = this.getNextSeverityLevel(emergency.severity);
          break;
        case 'update_status':
          updateData.status = actionDto.data?.status;
          break;
        default:
          throw new BadRequestException('Invalid action');
      }

      const updatedEmergency = await this.prisma.emergencyAlert.update({
        where: { id },
        data: updateData,
        include: {
          park: true,
        },
      });

      // Send notification about the action
      await this.sendActionNotification(emergency, actionDto, userId);

      this.logger.log(`Action ${actionDto.action} taken on emergency: ${id}`, 'EmergencyService');
      return this.mapToResponseDto(updatedEmergency);
    } catch (error) {
      this.logger.error(`Failed to take action on emergency: ${error.message}`, 'EmergencyService');
      throw error;
    }
  }

  async delete(id: number, userId: number, userRole: UserRole): Promise<void> {
    try {
      const emergency = await this.prisma.emergencyAlert.findUnique({
        where: { id },
      });

      if (!emergency) {
        throw new NotFoundException('Emergency alert not found');
      }

      // Check permissions
      if (userRole === UserRole.PARK_MANAGER && emergency.parkId !== userId) {
        throw new ForbiddenException('You can only delete emergency alerts for your park');
      }

      // Cannot delete resolved emergencies (should be archived instead)
      if (emergency.status === EmergencyStatus.RESOLVED) {
        throw new BadRequestException('Cannot delete resolved emergency alerts');
      }

      await this.prisma.emergencyAlert.delete({
        where: { id },
      });

      this.logger.log(`Emergency alert deleted: ${id}`, 'EmergencyService');
    } catch (error) {
      this.logger.error(`Failed to delete emergency alert: ${error.message}`, 'EmergencyService');
      throw error;
    }
  }

  async getStatistics(parkId?: number): Promise<EmergencyStatsDto> {
    try {
      const whereClause: Prisma.EmergencyAlertWhereInput = parkId ? { parkId } : {};

      const [stats, severityStats, typeStats] = await this.prisma.$transaction([
        this.prisma.emergencyAlert.groupBy({
          by: ['status'],
          where: whereClause,
          _count: true,
        }),
        this.prisma.emergencyAlert.groupBy({
          by: ['severity'],
          where: whereClause,
          _count: true,
        }),
        this.prisma.emergencyAlert.groupBy({
          by: ['type'],
          where: whereClause,
          _count: true,
        }),
      ]);

      const total = await this.prisma.emergencyAlert.count({ where: whereClause });
      const active = await this.prisma.emergencyAlert.count({ 
        where: { ...whereClause, status: EmergencyStatus.ACTIVE } 
      });
      const resolved = await this.prisma.emergencyAlert.count({ 
        where: { ...whereClause, status: EmergencyStatus.RESOLVED } 
      });

      // Calculate average response time
      const resolvedEmergencies = await this.prisma.emergencyAlert.findMany({
        where: { ...whereClause, status: EmergencyStatus.RESOLVED },
        select: { createdAt: true, resolvedAt: true },
      });

      const avgResponseTime = resolvedEmergencies.length > 0
        ? resolvedEmergencies.reduce((sum, emergency) => {
            const responseTime = emergency.resolvedAt.getTime() - emergency.createdAt.getTime();
            return sum + (responseTime / (1000 * 60)); // Convert to minutes
          }, 0) / resolvedEmergencies.length
        : 0;

      const bySeverity = {};
      severityStats.forEach(item => {
        bySeverity[item.severity] = item._count;
      });

      const byType = {};
      typeStats.forEach(item => {
        byType[item.type] = item._count;
      });

      return {
        total,
        active,
        resolved,
        bySeverity,
        byType,
        averageResponseTime: Math.round(avgResponseTime),
      };
    } catch (error) {
      this.logger.error(`Failed to get statistics: ${error.message}`, 'EmergencyService');
      throw error;
    }
  }

  private async handleEmergencyNotifications(emergency: any, createEmergencyDto: CreateEmergencyAlertDto): Promise<void> {
    const recipients = await this.getEmergencyRecipients(emergency);

    // Send push notification
    if (createEmergencyDto.sendPushNotification) {
      await this.notificationService.sendNotification({
        title: `🚨 ${emergency.title}`,
        message: emergency.description,
        type: 'EMERGENCY',
        recipients,
        priority: this.getNotificationPriority(emergency.severity),
        metadata: {
          emergencyId: emergency.id,
          type: emergency.type,
          severity: emergency.severity,
          location: emergency.location,
          coordinates: emergency.coordinates,
        },
      });
    }

    // Send SMS alert
    if (createEmergencyDto.sendSmsAlert) {
      const phoneNumbers = await this.getEmergencyPhoneNumbers(emergency);
      const smsMessage = this.generateEmergencySms(emergency);
      
      for (const phoneNumber of phoneNumbers) {
        await this.smsService.sendSms(phoneNumber, smsMessage);
      }
    }

    // Trigger alarm system (would integrate with physical alarm system)
    if (createEmergencyDto.triggerAlarm) {
      this.triggerPhysicalAlarm(emergency);
    }
  }

  private async sendActionNotification(emergency: any, actionDto: EmergencyActionDto, userId: number): Promise<void> {
    const recipients = await this.getEmergencyRecipients(emergency);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    let title = `بروزرسانی وضعیت اضطراری: ${emergency.title}`;
    let message = `عملیات "${actionDto.action}" توسط ${user.name} انجام شد.`;

    if (actionDto.data?.notes) {
      message += ` توضیحات: ${actionDto.data.notes}`;
    }

    await this.notificationService.sendNotification({
      title,
      message,
      type: 'EMERGENCY_UPDATE',
      recipients,
      priority: this.getNotificationPriority(emergency.severity),
      metadata: {
        emergencyId: emergency.id,
        action: actionDto.action,
        updatedBy: user.name,
      },
    });
  }

  private async getEmergencyRecipients(emergency: any): Promise<number[]> {
    const whereClause: Prisma.UserWhereInput = {};

    if (emergency.parkId) {
      whereClause.parkId = emergency.parkId;
    }

    if (emergency.affectedFactories && emergency.affectedFactories.length > 0) {
      whereClause.OR = [
        { factoryId: { in: emergency.affectedFactories } },
        { role: UserRole.PARK_MANAGER },
        { role: UserRole.ADMIN },
        { role: UserRole.SECURITY_GUARD },
      ];
    }

    const users = await this.prisma.user.findMany({
      where: whereClause,
      select: { id: true },
    });

    return users.map(user => user.id);
  }

  private async getEmergencyPhoneNumbers(emergency: any): Promise<string[]> {
    const whereClause: Prisma.UserWhereInput = {
      phoneNumber: { not: null },
    };

    if (emergency.parkId) {
      whereClause.parkId = emergency.parkId;
    }

    if (emergency.affectedFactories && emergency.affectedFactories.length > 0) {
      whereClause.OR = [
        { factoryId: { in: emergency.affectedFactories } },
        { role: UserRole.PARK_MANAGER },
        { role: UserRole.SECURITY_GUARD },
      ];
    }

    const users = await this.prisma.user.findMany({
      where: whereClause,
      select: { phoneNumber: true },
    });

    return users.map(user => user.phoneNumber).filter(Boolean);
  }

  private generateEmergencySms(emergency: any): string {
    let message = `🚨 هشدار اضطراری: ${emergency.title}\n\n`;
    message += `${emergency.description}\n\n`;
    
    if (emergency.location) {
      message += `محل: ${emergency.location}\n`;
    }
    
    if (emergency.instructions) {
      message += `دستورالعمل: ${emergency.instructions}\n`;
    }
    
    if (emergency.contactInfo) {
      message += `تماس: ${emergency.contactInfo}`;
    }

    return message;
  }

  private triggerPhysicalAlarm(emergency: any): void {
    // This would integrate with the physical alarm system
    this.logger.warn(`Physical alarm triggered for emergency: ${emergency.id}`, 'EmergencyService');
  }

  private getNotificationPriority(severity: EmergencySeverity): string {
    switch (severity) {
      case EmergencySeverity.CRITICAL:
        return 'high';
      case EmergencySeverity.HIGH:
        return 'high';
      case EmergencySeverity.MEDIUM:
        return 'normal';
      case EmergencySeverity.LOW:
        return 'normal';
      default:
        return 'normal';
    }
  }

  private getNextSeverityLevel(currentSeverity: EmergencySeverity): EmergencySeverity {
    const severityOrder = [
      EmergencySeverity.LOW,
      EmergencySeverity.MEDIUM,
      EmergencySeverity.HIGH,
      EmergencySeverity.CRITICAL,
    ];

    const currentIndex = severityOrder.indexOf(currentSeverity);
    if (currentIndex < severityOrder.length - 1) {
      return severityOrder[currentIndex + 1];
    }
    return currentSeverity;
  }

  private mapToResponseDto(emergency: any): EmergencyResponseDto {
    return {
      id: emergency.id,
      title: emergency.title,
      description: emergency.description,
      type: emergency.type,
      severity: emergency.severity,
      status: emergency.status,
      parkId: emergency.parkId,
      parkName: emergency.park?.name,
      location: emergency.location,
      coordinates: emergency.coordinates,
      affectedFactories: emergency.affectedFactories || [],
      affectedRadius: emergency.affectedRadius,
      instructions: emergency.instructions,
      contactInfo: emergency.contactInfo,
      images: emergency.images || [],
      documents: emergency.documents || [],
      responseTeam: emergency.responseTeam,
      resolutionNotes: emergency.resolutionNotes,
      resolvedAt: emergency.resolvedAt,
      createdByName: emergency.createdByUser?.name || 'System',
      createdAt: emergency.createdAt,
      updatedAt: emergency.updatedAt,
    };
  }
}
