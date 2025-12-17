import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/services/prisma.service';
import { LoggerService } from '../shared/services/logger.service';
import { UserRole } from '@prisma/client';
import { Prisma } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async getDashboardData(userId: number, userRole: UserRole, parkId?: number, factoryId?: number) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { factory: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Apply role-based filtering
      let effectiveParkId = parkId;
      let effectiveFactoryId = factoryId;

      if (userRole === UserRole.PARK_MANAGER) {
        effectiveParkId = user.parkId;
      } else if (userRole === UserRole.FACTORY_OWNER) {
        effectiveFactoryId = user.factoryId;
      }

      const [
        factoryStats,
        gatePassStats,
        invoiceStats,
        requestStats,
        emergencyStats,
        announcementStats,
        advertisementStats,
        userStats,
        recentActivity
      ] = await Promise.all([
        this.getFactoryAnalytics(effectiveParkId, effectiveFactoryId),
        this.getGatePassAnalytics(effectiveParkId, effectiveFactoryId),
        this.getInvoiceAnalytics(effectiveParkId, effectiveFactoryId),
        this.getRequestAnalytics(effectiveParkId, effectiveFactoryId),
        this.getEmergencyAnalytics(effectiveParkId),
        this.getAnnouncementAnalytics(effectiveParkId),
        this.getAdvertisementAnalytics(effectiveParkId, effectiveFactoryId),
        this.getUserAnalytics(effectiveParkId, effectiveFactoryId),
        this.getRecentActivity(effectiveParkId, effectiveFactoryId)
      ]);

      return {
        factoryStats,
        gatePassStats,
        invoiceStats,
        requestStats,
        emergencyStats,
        announcementStats,
        advertisementStats,
        userStats,
        recentActivity,
      };
    } catch (error) {
      this.logger.error(`Failed to get dashboard data: ${error.message}`, 'AnalyticsService');
      throw error;
    }
  }

  async getFactoryAnalytics(parkId?: number, factoryId?: number) {
    const whereClause: Prisma.FactoryWhereInput = {};
    if (parkId) whereClause.parkId = parkId;
    if (factoryId) whereClause.id = factoryId;

    const [total, active, inactive, byType] = await this.prisma.$transaction([
      this.prisma.factory.count({ where: whereClause }),
      this.prisma.factory.count({ where: { ...whereClause, status: 'ACTIVE' } }),
      this.prisma.factory.count({ where: { ...whereClause, status: 'INACTIVE' } }),
      this.prisma.factory.groupBy({
        by: ['type'],
        where: whereClause,
        _count: true,
      }),
    ]);

    const typeDistribution = {};
    byType.forEach(item => {
      typeDistribution[item.type] = item._count;
    });

    return {
      total,
      active,
      inactive,
      typeDistribution,
    };
  }

  async getGatePassAnalytics(parkId?: number, factoryId?: number) {
    const whereClause: Prisma.GatePassWhereInput = {};
    if (parkId) whereClause.parkId = parkId;
    if (factoryId) whereClause.factoryId = factoryId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      total,
      todayCount,
      thisMonthCount,
      byStatus,
      byType,
      recent
    ] = await this.prisma.$transaction([
      this.prisma.gatePass.count({ where: whereClause }),
      this.prisma.gatePass.count({ where: { ...whereClause, createdAt: { gte: today } } }),
      this.prisma.gatePass.count({ where: { ...whereClause, createdAt: { gte: thisMonth } } }),
      this.prisma.gatePass.groupBy({
        by: ['status'],
        where: whereClause,
        _count: true,
      }),
      this.prisma.gatePass.groupBy({
        by: ['type'],
        where: whereClause,
        _count: true,
      }),
      this.prisma.gatePass.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          factory: true,
          employee: true,
        },
      }),
    ]);

    const statusDistribution = {};
    byStatus.forEach(item => {
      statusDistribution[item.status] = item._count;
    });

    const typeDistribution = {};
    byType.forEach(item => {
      typeDistribution[item.type] = item._count;
    });

    return {
      total,
      todayCount,
      thisMonthCount,
      statusDistribution,
      typeDistribution,
      recent,
    };
  }

  async getInvoiceAnalytics(parkId?: number, factoryId?: number) {
    const whereClause: Prisma.InvoiceWhereInput = {};
    if (parkId) whereClause.parkId = parkId;
    if (factoryId) whereClause.factoryId = factoryId;

    const thisMonth = new Date();
    thisMonth.setMonth(thisMonth.getMonth(), 1);
    thisMonth.setHours(0, 0, 0, 0);

    const [
      total,
      totalAmount,
      thisMonthAmount,
      byStatus,
      monthlyTrend,
      overdue
    ] = await this.prisma.$transaction([
      this.prisma.invoice.count({ where: whereClause }),
      this.prisma.invoice.aggregate({
        where: whereClause,
        _sum: { totalAmount: true },
      }),
      this.prisma.invoice.aggregate({
        where: { ...whereClause, createdAt: { gte: thisMonth } },
        _sum: { totalAmount: true },
      }),
      this.prisma.invoice.groupBy({
        by: ['status'],
        where: whereClause,
        _count: true,
        _sum: { totalAmount: true },
      }),
      this.prisma.invoice.groupBy({
        by: ['createdAt'],
        where: whereClause,
        _sum: { totalAmount: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.invoice.count({
        where: {
          ...whereClause,
          status: 'PENDING',
          dueDate: { lt: new Date() },
        },
      }),
    ]);

    const statusDistribution = {};
    byStatus.forEach(item => {
      statusDistribution[item.status] = {
        count: item._count,
        amount: item._sum.totalAmount || 0,
      };
    });

    return {
      total,
      totalAmount: totalAmount._sum.totalAmount || 0,
      thisMonthAmount: thisMonthAmount._sum.totalAmount || 0,
      statusDistribution,
      monthlyTrend,
      overdue,
    };
  }

  async getRequestAnalytics(parkId?: number, factoryId?: number) {
    const whereClause: Prisma.RequestWhereInput = {};
    if (parkId) whereClause.parkId = parkId;
    if (factoryId) whereClause.factoryId = factoryId;

    const [
      total,
      byStatus,
      byType,
      byPriority,
      pendingTime
    ] = await this.prisma.$transaction([
      this.prisma.request.count({ where: whereClause }),
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
      this.prisma.request.findMany({
        where: { ...whereClause, status: 'PENDING' },
        select: { createdAt: true },
      }),
    ]);

    const statusDistribution = {};
    byStatus.forEach(item => {
      statusDistribution[item.status] = item._count;
    });

    const typeDistribution = {};
    byType.forEach(item => {
      typeDistribution[item.type] = item._count;
    });

    const priorityDistribution = {};
    byPriority.forEach(item => {
      priorityDistribution[item.priority] = item._count;
    });

    const avgPendingTime = pendingTime.length > 0
      ? pendingTime.reduce((sum, req) => {
          return sum + (Date.now() - req.createdAt.getTime());
        }, 0) / pendingTime.length / (1000 * 60 * 60) // Convert to hours
      : 0;

    return {
      total,
      statusDistribution,
      typeDistribution,
      priorityDistribution,
      avgPendingTime: Math.round(avgPendingTime),
    };
  }

  async getEmergencyAnalytics(parkId?: number) {
    const whereClause: Prisma.EmergencyAlertWhereInput = {};
    if (parkId) whereClause.parkId = parkId;

    const [
      total,
      active,
      bySeverity,
      byType,
      recent
    ] = await this.prisma.$transaction([
      this.prisma.emergencyAlert.count({ where: whereClause }),
      this.prisma.emergencyAlert.count({ where: { ...whereClause, status: 'ACTIVE' } }),
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
      this.prisma.emergencyAlert.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const severityDistribution = {};
    bySeverity.forEach(item => {
      severityDistribution[item.severity] = item._count;
    });

    const typeDistribution = {};
    byType.forEach(item => {
      typeDistribution[item.type] = item._count;
    });

    return {
      total,
      active,
      severityDistribution,
      typeDistribution,
      recent,
    };
  }

  async getAnnouncementAnalytics(parkId?: number) {
    const whereClause: Prisma.AnnouncementWhereInput = {};
    if (parkId) whereClause.parkId = parkId;

    const [
      total,
      published,
      byType,
      recent
    ] = await this.prisma.$transaction([
      this.prisma.announcement.count({ where: whereClause }),
      this.prisma.announcement.count({ where: { ...whereClause, status: 'PUBLISHED' } }),
      this.prisma.announcement.groupBy({
        by: ['type'],
        where: whereClause,
        _count: true,
      }),
      this.prisma.announcement.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const typeDistribution = {};
    byType.forEach(item => {
      typeDistribution[item.type] = item._count;
    });

    return {
      total,
      published,
      typeDistribution,
      recent,
    };
  }

  async getAdvertisementAnalytics(parkId?: number, factoryId?: number) {
    const whereClause: Prisma.AdvertisementWhereInput = {};
    if (parkId) whereClause.parkId = parkId;
    if (factoryId) whereClause.factoryId = factoryId;

    const [
      total,
      active,
      performance
    ] = await this.prisma.$transaction([
      this.prisma.advertisement.count({ where: whereClause }),
      this.prisma.advertisement.count({ where: { ...whereClause, isActive: true, status: 'ACTIVE' } }),
      this.prisma.advertisement.aggregate({
        where: whereClause,
        _sum: {
          currentImpressions: true,
          clickCount: true,
        },
      }),
    ]);

    const totalImpressions = performance._sum.currentImpressions || 0;
    const totalClicks = performance._sum.clickCount || 0;
    const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    return {
      total,
      active,
      totalImpressions,
      totalClicks,
      averageCtr: parseFloat(averageCtr.toFixed(2)),
    };
  }

  async getUserAnalytics(parkId?: number, factoryId?: number) {
    const whereClause: Prisma.UserWhereInput = {};
    if (parkId) whereClause.parkId = parkId;
    if (factoryId) whereClause.factoryId = factoryId;

    const [
      total,
      byRole,
      recent
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: whereClause }),
      this.prisma.user.groupBy({
        by: ['role'],
        where: whereClause,
        _count: true,
      }),
      this.prisma.user.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, name: true, role: true, createdAt: true },
      }),
    ]);

    const roleDistribution = {};
    byRole.forEach(item => {
      roleDistribution[item.role] = item._count;
    });

    return {
      total,
      roleDistribution,
      recent,
    };
  }

  async getRecentActivity(parkId?: number, factoryId?: number) {
    const limit = 20;
    const activities = [];

    // Get recent gate passes
    const gatePasses = await this.prisma.gatePass.findMany({
      where: {
        ...(parkId && { parkId }),
        ...(factoryId && { factoryId }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        factory: true,
        employee: true,
      },
    });

    gatePasses.forEach(pass => {
      activities.push({
        id: `gatepass_${pass.id}`,
        type: 'GATE_PASS',
        action: `مجوز ${pass.type} برای ${pass.employee?.name}`,
        timestamp: pass.createdAt,
        status: pass.status,
        metadata: {
          passId: pass.id,
          employeeName: pass.employee?.name,
          factoryName: pass.factory?.name,
        },
      });
    });

    // Get recent invoices
    const invoices = await this.prisma.invoice.findMany({
      where: {
        ...(parkId && { parkId }),
        ...(factoryId && { factoryId }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        factory: true,
      },
    });

    invoices.forEach(invoice => {
      activities.push({
        id: `invoice_${invoice.id}`,
        type: 'INVOICE',
        action: `فاکتور ${invoice.invoiceNumber} - ${invoice.totalAmount?.toLocaleString()} ریال`,
        timestamp: invoice.createdAt,
        status: invoice.status,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.totalAmount,
          factoryName: invoice.factory?.name,
        },
      });
    });

    // Get recent requests
    const requests = await this.prisma.request.findMany({
      where: {
        ...(parkId && { parkId }),
        ...(factoryId && { factoryId }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        factory: true,
      },
    });

    requests.forEach(request => {
      activities.push({
        id: `request_${request.id}`,
        type: 'REQUEST',
        action: `درخواست ${request.title}`,
        timestamp: request.createdAt,
        status: request.status,
        metadata: {
          requestId: request.id,
          title: request.title,
          type: request.type,
          factoryName: request.factory?.name,
        },
      });
    });

    // Sort by timestamp and limit
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return activities.slice(0, limit);
  }

  async generateReport(
    reportType: string,
    dateRange: { start: Date; end: Date },
    userId: number,
    userRole: UserRole,
    filters?: any
  ) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      
      let parkId = filters?.parkId;
      let factoryId = filters?.factoryId;

      if (userRole === UserRole.PARK_MANAGER) {
        parkId = user.parkId;
      } else if (userRole === UserRole.FACTORY_OWNER) {
        factoryId = user.factoryId;
      }

      const reportData = {
        generatedAt: new Date(),
        dateRange,
        filters: { parkId, factoryId, ...filters },
      };

      switch (reportType) {
        case 'comprehensive':
          return {
            ...reportData,
            data: await this.getDashboardData(userId, userRole, parkId, factoryId),
          };
        case 'gate_pass':
          return {
            ...reportData,
            data: await this.getGatePassAnalytics(parkId, factoryId),
          };
        case 'invoice':
          return {
            ...reportData,
            data: await this.getInvoiceAnalytics(parkId, factoryId),
          };
        case 'emergency':
          return {
            ...reportData,
            data: await this.getEmergencyAnalytics(parkId),
          };
        default:
          throw new Error('Invalid report type');
      }
    } catch (error) {
      this.logger.error(`Failed to generate report: ${error.message}`, 'AnalyticsService');
      throw error;
    }
  }
}
