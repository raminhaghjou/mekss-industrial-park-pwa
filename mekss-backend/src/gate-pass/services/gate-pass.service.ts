import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { SmsService } from '../../shared/services/sms.service';
import { QueueService } from '../../shared/services/queue.service';
import { UtilService } from '../../shared/services/util.service';
import { GatePassStatus, CargoType, VehicleType, Role } from '@prisma/client';
import { CreateGatePassDto } from '../dto/create-gate-pass.dto';
import { UpdateGatePassDto } from '../dto/update-gate-pass.dto';

interface PaginationOptions {
  page: number;
  limit: number;
  filters?: any;
}

@Injectable()
export class GatePassService {
  constructor(
    private prisma: PrismaService,
    private smsService: SmsService,
    private queueService: QueueService,
    private utilService: UtilService,
  ) {}

  async findAll(user: any, options: PaginationOptions) {
    const { page, limit, filters = {} } = options;
    const skip = (page - 1) * limit;

    // Build where clause based on user role and filters
    const where: any = {};

    if (user.role === Role.FACTORY_MANAGER) {
      where.factoryId = user.factoryId;
    } else if (user.role === Role.PARK_MANAGER) {
      // OPTIMIZED: Replaced N+1 query with a single relation filter.
      // This avoids fetching all factories first, improving performance.
      where.factory = {
        parkId: user.parkId,
      };
    }

    // Apply filters
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.factoryId) {
      where.factoryId = filters.factoryId;
    }
    if (filters.driverName) {
      where.driverName = { contains: filters.driverName, mode: 'insensitive' };
    }
    if (filters.licensePlate) {
      where.licensePlate = { contains: filters.licensePlate, mode: 'insensitive' };
    }

    const [gatePasses, total] = await Promise.all([
      this.prisma.gatePass.findMany({
        where,
        skip,
        take: limit,
        include: {
          factory: {
            select: {
              id: true,
              name: true,
              licenseNumber: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              name: true,
            },
          },
          verifiedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.gatePass.count({ where }),
    ]);

    return {
      data: gatePasses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, user: any) {
    const gatePass = await this.prisma.gatePass.findUnique({
      where: { id },
      include: {
        factory: {
          select: {
            id: true,
            name: true,
            licenseNumber: true,
            phoneNumber: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        verifiedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!gatePass) {
      throw new NotFoundException('Gate pass not found');
    }

    // Check access permissions
    if (user.role === Role.FACTORY_MANAGER && gatePass.factoryId !== user.factoryId) {
      throw new ForbiddenException('Access denied');
    }

    if (user.role === Role.PARK_MANAGER) {
      const factory = await this.prisma.factory.findUnique({
        where: { id: gatePass.factoryId },
      });
      if (factory?.parkId !== user.parkId) {
        throw new ForbiddenException('Access denied');
      }
    }

    return gatePass;
  }

  async create(createGatePassDto: CreateGatePassDto, user: any) {
    // Validate factory access
    if (user.role === Role.FACTORY_MANAGER && createGatePassDto.factoryId !== user.factoryId) {
      throw new ForbiddenException('Access denied');
    }

    if (user.role === Role.PARK_MANAGER) {
      const factory = await this.prisma.factory.findUnique({
        where: { id: createGatePassDto.factoryId },
      });
      if (factory?.parkId !== user.parkId) {
        throw new ForbiddenException('Access denied');
      }
    }

    // Validate exit date
    const exitDate = new Date(createGatePassDto.exitDate);
    if (exitDate < new Date()) {
      throw new BadRequestException('Exit date cannot be in the past');
    }

    // Generate gate pass number and QR code
    const gatePassNumber = this.utilService.generateGatePassNumber();
    const qrCode = this.utilService.generateQrCodeData(gatePassNumber, createGatePassDto.factoryId);

    const gatePass = await this.prisma.gatePass.create({
      data: {
        ...createGatePassDto,
        gatePassNumber,
        qrCode,
        status: GatePassStatus.PENDING,
        createdById: user.id,
      },
      include: {
        factory: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            manager: {
              select: {
                phoneNumber: true,
              },
            },
          },
        },
      },
    });

    // Send SMS notification to factory manager
    if (gatePass.factory.manager?.phoneNumber) {
      const message = `برگ خروج شماره ${gatePassNumber} برای ${createGatePassDto.driverName} ثبت شد. لطفاً تایید فرمایید.`;
      await this.smsService.sendSms({
        phoneNumber: gatePass.factory.manager.phoneNumber,
        message,
      });
    }

    // Add notification job
    await this.queueService.addNotificationJob({
      userId: user.id,
      title: 'ثبت برگ خروج',
      message: `برگ خروج شماره ${gatePassNumber} با موفقیت ثبت شد.`,
      type: 'success',
    });

    return gatePass;
  }

  async update(id: string, updateGatePassDto: UpdateGatePassDto, user: any) {
    const gatePass = await this.findOne(id, user);

    // Check if can be updated
    if (gatePass.status !== GatePassStatus.PENDING) {
      throw new BadRequestException('Cannot update approved/rejected gate pass');
    }

    const updated = await this.prisma.gatePass.update({
      where: { id },
      data: updateGatePassDto,
      include: {
        factory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return updated;
  }

  async updateStatus(id: string, status: GatePassStatus, user: any, reason?: string) {
    const gatePass = await this.findOne(id, user);

    // Validate status transition
    const validTransitions = {
      [GatePassStatus.PENDING]: [GatePassStatus.APPROVED, GatePassStatus.REJECTED],
      [GatePassStatus.APPROVED]: [GatePassStatus.COMPLETED],
      [GatePassStatus.REJECTED]: [],
      [GatePassStatus.COMPLETED]: [],
      [GatePassStatus.EXPIRED]: [],
    };

    if (!validTransitions[gatePass.status].includes(status)) {
      throw new BadRequestException(`Cannot change status from ${gatePass.status} to ${status}`);
    }

    const updated = await this.prisma.gatePass.update({
      where: { id },
      data: {
        status,
        ...(status === GatePassStatus.APPROVED && { approvedById: user.id }),
        ...(status === GatePassStatus.REJECTED && { 
          approvedById: user.id,
          notes: reason || gatePass.notes,
        }),
        ...(status === GatePassStatus.COMPLETED && { 
          verifiedById: user.id,
          entryDate: new Date(),
        }),
      },
      include: {
        factory: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
          },
        },
        createdBy: {
          select: {
            phoneNumber: true,
          },
        },
      },
    });

    // Send SMS notifications
    const notifications = [];
    
    if (status === GatePassStatus.APPROVED) {
      const message = `برگ خروج شماره ${updated.gatePassNumber} تایید شد.`;
      notifications.push({
        phoneNumber: updated.createdBy.phoneNumber,
        message,
        type: 'gatepass',
      } as any);
    } else if (status === GatePassStatus.REJECTED) {
      const message = `برگ خروج شماره ${updated.gatePassNumber} رد شد. علت: ${reason || 'نامشخص'}`;
      notifications.push({
        phoneNumber: updated.createdBy.phoneNumber,
        message,
        type: 'gatepass',
      } as any);
    }

    // Send notifications
    for (const notification of notifications) {
      await this.smsService.sendSms(notification);
    }

    // Add notification job
    await this.queueService.addNotificationJob({
      userId: updated.createdById,
      title: status === GatePassStatus.APPROVED ? 'تایید برگ خروج' : 'رد برگ خروج',
      message: `برگ خروج شماره ${updated.gatePassNumber} ${status === GatePassStatus.APPROVED ? 'تایید شد' : 'رد شد'}.`,
      type: status === GatePassStatus.APPROVED ? 'success' : 'error',
    });

    return updated;
  }

  async verify(id: string, user: any) {
    const gatePass = await this.findOne(id, user);

    if (gatePass.status !== GatePassStatus.APPROVED) {
      throw new BadRequestException('Only approved gate passes can be verified');
    }

    // Generate new QR code for verification
    const verificationCode = this.utilService.generateToken(16);

    const updated = await this.prisma.gatePass.update({
      where: { id },
      data: {
        verifiedById: user.id,
        verifiedAt: new Date(),
        notes: `Verified by ${user.name} at ${new Date().toISOString()}`,
      },
    });

    return {
      ...updated,
      verificationCode,
    };
  }

  async getQrCode(id: string, user: any) {
    const gatePass = await this.findOne(id, user);
    return { qrCode: gatePass.qrCode };
  }

  async getStats(user: any) {
    const where: any = {};

    if (user.role === Role.FACTORY_MANAGER) {
      where.factoryId = user.factoryId;
    } else if (user.role === Role.PARK_MANAGER) {
      // OPTIMIZED: Replaced N+1 query with a single relation filter.
      where.factory = {
        parkId: user.parkId,
      };
    }

    const stats = await this.prisma.gatePass.groupBy({
      by: ['status'],
      where,
      _count: {
        status: true,
      },
    });

    const total = await this.prisma.gatePass.count({ where });
    const today = await this.prisma.gatePass.count({
      where: {
        ...where,
        createdAt: {
          gte: new Date(new Date().toDateString()),
        },
      },
    });

    const statusMap = {
      [GatePassStatus.PENDING]: 0,
      [GatePassStatus.APPROVED]: 0,
      [GatePassStatus.REJECTED]: 0,
      [GatePassStatus.COMPLETED]: 0,
      [GatePassStatus.EXPIRED]: 0,
    };

    stats.forEach(stat => {
      statusMap[stat.status] = stat._count.status;
    });

    return {
      total,
      today,
      byStatus: statusMap,
    };
  }

  async exportHistory(user: any, filters: any) {
    const where: any = {};

    if (user.role === Role.FACTORY_MANAGER) {
      where.factoryId = user.factoryId;
    } else if (user.role === Role.PARK_MANAGER) {
      // OPTIMIZED: Replaced N+1 query with a single relation filter.
      where.factory = {
        parkId: user.parkId,
      };
    }

    if (filters.startDate) {
      where.createdAt = { gte: filters.startDate };
    }
    if (filters.endDate) {
      where.createdAt = { ...where.createdAt, lte: filters.endDate };
    }
    if (filters.factoryId) {
      where.factoryId = filters.factoryId;
    }

    const gatePasses = await this.prisma.gatePass.findMany({
      where,
      include: {
        factory: {
          select: {
            name: true,
            licenseNumber: true,
          },
        },
        createdBy: {
          select: {
            name: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Convert to CSV format
    const csvData = gatePasses.map(pass => ({
      'شماره برگ خروج': pass.gatePassNumber,
      'نام کارخانه': pass.factory.name,
      'نام راننده': pass.driverName,
      'کد ملی راننده': pass.driverNationalId,
      'شماره تماس راننده': pass.driverPhone,
      'نوع بار': pass.cargoType,
      'نوع وسیله نقلیه': pass.vehicleType,
      'پلاک': pass.licensePlate,
      'تاریخ خروج': pass.exitDate,
      'تاریخ ورود': pass.entryDate,
      'وضعیت': pass.status,
      'تاریخ ایجاد': pass.createdAt,
    }));

    return {
      data: csvData,
      count: csvData.length,
    };
  }

  async remove(id: string, user: any) {
    const gatePass = await this.findOne(id, user);

    if (gatePass.status !== GatePassStatus.PENDING) {
      throw new BadRequestException('Cannot delete approved/rejected gate pass');
    }

    // Soft delete by updating status
    const deleted = await this.prisma.gatePass.update({
      where: { id },
      data: {
        status: GatePassStatus.EXPIRED,
        notes: `Deleted by ${user.name} at ${new Date().toISOString()}`,
      },
    });

    return {
      message: 'Gate pass deleted successfully',
      data: deleted,
    };
  }
}