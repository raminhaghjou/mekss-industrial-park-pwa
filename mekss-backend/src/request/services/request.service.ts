import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { LoggerService } from '../../shared/services/logger.service';
import { NotificationService } from '../../shared/services/notification.service';
import { CreateRequestDto } from '../dto/create-request.dto';
import { UpdateRequestDto, ApproveRequestDto, RejectRequestDto } from '../dto/update-request.dto';
import { RequestResponseDto, RequestListResponseDto } from '../dto/request-response.dto';
import { RequestStatus, RequestType, UserRole } from '@prisma/client';
import { Prisma } from '@prisma/client';

@Injectable()
export class RequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(createRequestDto: CreateRequestDto, userId: number): Promise<RequestResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { factory: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Validate factory ownership
      if (user.role === UserRole.FACTORY_OWNER && user.factoryId !== createRequestDto.factoryId) {
        throw new ForbiddenException('You can only create requests for your own factory');
      }

      const request = await this.prisma.request.create({
        data: {
          title: createRequestDto.title,
          description: createRequestDto.description,
          type: createRequestDto.type,
          priority: createRequestDto.priority,
          status: RequestStatus.PENDING,
          factoryId: createRequestDto.factoryId,
          parkId: createRequestDto.parkId,
          metadata: createRequestDto.metadata?.metadata || {},
          documents: createRequestDto.documents || [],
          createdBy: userId,
        },
        include: {
          factory: true,
          park: true,
        },
      });

      // Send notification to park managers and admins
      await this.notificationService.sendNotification({
        title: 'درخواست جدید ثبت شد',
        message: `درخواست جدید با عنوان "${request.title}" از کارخانه ${request.factory.name} ثبت شد.`,
        type: 'REQUEST_CREATED',
        recipients: await this.getParkManagersAndAdmins(request.parkId),
        metadata: {
          requestId: request.id,
          factoryId: request.factoryId,
          type: request.type,
        },
      });

      this.logger.log(`Request created: ${request.id}`, 'RequestService');
      return this.mapToResponseDto(request);
    } catch (error) {
      this.logger.error(`Failed to create request: ${error.message}`, 'RequestService');
      throw error;
    }
  }

  async findAll(
    userId: number,
    userRole: UserRole,
    page: number = 1,
    limit: number = 10,
    filters?: {
      status?: RequestStatus;
      type?: RequestType;
      priority?: string;
      factoryId?: number;
      parkId?: number;
    }
  ): Promise<RequestListResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { factory: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      let whereClause: Prisma.RequestWhereInput = {};

      // Role-based filtering
      if (userRole === UserRole.FACTORY_OWNER) {
        whereClause.factoryId = user.factoryId;
      } else if (userRole === UserRole.PARK_MANAGER) {
        whereClause.parkId = user.parkId;
      }

      // Apply additional filters
      if (filters?.status) whereClause.status = filters.status;
      if (filters?.type) whereClause.type = filters.type;
      if (filters?.priority) whereClause.priority = filters.priority;
      if (filters?.factoryId) whereClause.factoryId = filters.factoryId;
      if (filters?.parkId) whereClause.parkId = filters.parkId;

      const [requests, total] = await this.prisma.$transaction([
        this.prisma.request.findMany({
          where: whereClause,
          include: {
            factory: true,
            park: true,
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [
            { priority: 'desc' },
            { createdAt: 'desc' },
          ],
        }),
        this.prisma.request.count({ where: whereClause }),
      ]);

      return {
        requests: requests.map(request => this.mapToResponseDto(request)),
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch requests: ${error.message}`, 'RequestService');
      throw error;
    }
  }

  async findOne(id: number, userId: number, userRole: UserRole): Promise<RequestResponseDto> {
    try {
      const request = await this.prisma.request.findUnique({
        where: { id },
        include: {
          factory: true,
          park: true,
        },
      });

      if (!request) {
        throw new NotFoundException('Request not found');
      }

      // Check access permissions
      if (userRole === UserRole.FACTORY_OWNER) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (user.factoryId !== request.factoryId) {
          throw new ForbiddenException('Access denied');
        }
      } else if (userRole === UserRole.PARK_MANAGER) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (user.parkId !== request.parkId) {
          throw new ForbiddenException('Access denied');
        }
      }

      return this.mapToResponseDto(request);
    } catch (error) {
      this.logger.error(`Failed to fetch request: ${error.message}`, 'RequestService');
      throw error;
    }
  }

  async update(
    id: number,
    updateRequestDto: UpdateRequestDto,
    userId: number,
    userRole: UserRole
  ): Promise<RequestResponseDto> {
    try {
      const request = await this.prisma.request.findUnique({
        where: { id },
        include: { factory: true },
      });

      if (!request) {
        throw new NotFoundException('Request not found');
      }

      // Check permissions
      if (userRole === UserRole.FACTORY_OWNER && request.factoryId !== userId) {
        throw new ForbiddenException('You can only update your own requests');
      }

      // Factory owners can only update pending requests
      if (userRole === UserRole.FACTORY_OWNER && request.status !== RequestStatus.PENDING) {
        throw new BadRequestException('Cannot update request that is not pending');
      }

      const updatedRequest = await this.prisma.request.update({
        where: { id },
        data: {
          ...updateRequestDto,
          updatedBy: userId,
        },
        include: {
          factory: true,
          park: true,
        },
      });

      this.logger.log(`Request updated: ${id}`, 'RequestService');
      return this.mapToResponseDto(updatedRequest);
    } catch (error) {
      this.logger.error(`Failed to update request: ${error.message}`, 'RequestService');
      throw error;
    }
  }

  async approve(
    id: number,
    approveRequestDto: ApproveRequestDto,
    userId: number
  ): Promise<RequestResponseDto> {
    try {
      const request = await this.prisma.request.findUnique({
        where: { id },
        include: { factory: true },
      });

      if (!request) {
        throw new NotFoundException('Request not found');
      }

      if (request.status !== RequestStatus.PENDING) {
        throw new BadRequestException('Only pending requests can be approved');
      }

      const updatedRequest = await this.prisma.request.update({
        where: { id },
        data: {
          status: RequestStatus.APPROVED,
          adminComments: approveRequestDto.comments,
          metadata: {
            ...request.metadata,
            approvalData: approveRequestDto.approvalData,
            approvedAt: new Date(),
            approvedBy: userId,
          },
          updatedBy: userId,
        },
        include: {
          factory: true,
          park: true,
        },
      });

      // Send notification to factory owner
      await this.notificationService.sendNotification({
        title: 'درخواست شما تایید شد',
        message: `درخواست "${request.title}" شما تایید شد.`,
        type: 'REQUEST_APPROVED',
        recipients: [request.factory.ownerId],
        metadata: {
          requestId: request.id,
          factoryId: request.factoryId,
        },
      });

      this.logger.log(`Request approved: ${id}`, 'RequestService');
      return this.mapToResponseDto(updatedRequest);
    } catch (error) {
      this.logger.error(`Failed to approve request: ${error.message}`, 'RequestService');
      throw error;
    }
  }

  async reject(
    id: number,
    rejectRequestDto: RejectRequestDto,
    userId: number
  ): Promise<RequestResponseDto> {
    try {
      const request = await this.prisma.request.findUnique({
        where: { id },
        include: { factory: true },
      });

      if (!request) {
        throw new NotFoundException('Request not found');
      }

      if (request.status !== RequestStatus.PENDING) {
        throw new BadRequestException('Only pending requests can be rejected');
      }

      const updatedRequest = await this.prisma.request.update({
        where: { id },
        data: {
          status: RequestStatus.REJECTED,
          adminComments: rejectRequestDto.reason,
          metadata: {
            ...request.metadata,
            rejectionData: rejectRequestDto.rejectionData,
            rejectedAt: new Date(),
            rejectedBy: userId,
          },
          updatedBy: userId,
        },
        include: {
          factory: true,
          park: true,
        },
      });

      // Send notification to factory owner
      await this.notificationService.sendNotification({
        title: 'درخواست شما رد شد',
        message: `درخواست "${request.title}" شما رد شد. دلیل: ${rejectRequestDto.reason}`,
        type: 'REQUEST_REJECTED',
        recipients: [request.factory.ownerId],
        metadata: {
          requestId: request.id,
          factoryId: request.factoryId,
          reason: rejectRequestDto.reason,
        },
      });

      this.logger.log(`Request rejected: ${id}`, 'RequestService');
      return this.mapToResponseDto(updatedRequest);
    } catch (error) {
      this.logger.error(`Failed to reject request: ${error.message}`, 'RequestService');
      throw error;
    }
  }

  async delete(id: number, userId: number, userRole: UserRole): Promise<void> {
    try {
      const request = await this.prisma.request.findUnique({
        where: { id },
      });

      if (!request) {
        throw new NotFoundException('Request not found');
      }

      // Check permissions
      if (userRole === UserRole.FACTORY_OWNER && request.factoryId !== userId) {
        throw new ForbiddenException('You can only delete your own requests');
      }

      if (request.status !== RequestStatus.PENDING) {
        throw new BadRequestException('Only pending requests can be deleted');
      }

      await this.prisma.request.delete({
        where: { id },
      });

      this.logger.log(`Request deleted: ${id}`, 'RequestService');
    } catch (error) {
      this.logger.error(`Failed to delete request: ${error.message}`, 'RequestService');
      throw error;
    }
  }

  async getStatistics(parkId?: number): Promise<any> {
    try {
      const whereClause: Prisma.RequestWhereInput = parkId ? { parkId } : {};

      const [stats, typeStats, priorityStats] = await this.prisma.$transaction([
        this.prisma.request.groupBy({
          by: ['status'],
          where: whereClause,
          _count: true,
        }),
        this.prisma.request.groupBy({
          by: ['type'],
          where: whereClause,
          _count: true,
        }),
        this.prisma.request.groupBy({
          by: ['priority'],
          where: whereClause,
          _count: true,
        }),
      ]);

      return {
        statusStats: stats,
        typeStats,
        priorityStats,
        total: await this.prisma.request.count({ where: whereClause }),
      };
    } catch (error) {
      this.logger.error(`Failed to get statistics: ${error.message}`, 'RequestService');
      throw error;
    }
  }

  private async getParkManagersAndAdmins(parkId: number): Promise<number[]> {
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { role: UserRole.PARK_MANAGER, parkId },
          { role: UserRole.ADMIN },
        ],
      },
      select: { id: true },
    });

    return users.map(user => user.id);
  }

  private mapToResponseDto(request: any): RequestResponseDto {
    return {
      id: request.id,
      title: request.title,
      description: request.description,
      type: request.type,
      priority: request.priority,
      status: request.status,
      factoryId: request.factoryId,
      factoryName: request.factory?.name || '',
      parkId: request.parkId,
      parkName: request.park?.name || '',
      metadata: request.metadata,
      adminComments: request.adminComments,
      documents: request.documents || [],
      createdBy: request.createdBy.toString(),
      updatedBy: request.updatedBy?.toString(),
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }
}
