import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request as Req,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL, UserRole.FACTORY_OWNER)
  @ApiOperation({ summary: 'Get comprehensive dashboard data' })
  @ApiQuery({ name: 'parkId', required: false, type: Number, description: 'Filter by park ID (admin only)' })
  @ApiQuery({ name: 'factoryId', required: false, type: Number, description: 'Filter by factory ID (park manager only)' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  async getDashboard(
    @Req() req: any,
    @Query('parkId') parkId?: number,
    @Query('factoryId') factoryId?: number
  ): Promise<any> {
    return this.analyticsService.getDashboardData(req.user.id, req.user.role, parkId, factoryId);
  }

  @Get('factories')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL)
  @ApiOperation({ summary: 'Get factory analytics' })
  @ApiQuery({ name: 'parkId', required: false, type: Number, description: 'Filter by park ID' })
  @ApiQuery({ name: 'factoryId', required: false, type: Number, description: 'Filter by factory ID' })
  @ApiResponse({ status: 200, description: 'Factory analytics retrieved successfully' })
  async getFactoryAnalytics(
    @Query('parkId') parkId?: number,
    @Query('factoryId') factoryId?: number
  ): Promise<any> {
    return this.analyticsService.getFactoryAnalytics(parkId, factoryId);
  }

  @Get('gate-passes')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL, UserRole.FACTORY_OWNER)
  @ApiOperation({ summary: 'Get gate pass analytics' })
  @ApiQuery({ name: 'parkId', required: false, type: Number, description: 'Filter by park ID' })
  @ApiQuery({ name: 'factoryId', required: false, type: Number, description: 'Filter by factory ID' })
  @ApiResponse({ status: 200, description: 'Gate pass analytics retrieved successfully' })
  async getGatePassAnalytics(
    @Req() req: any,
    @Query('parkId') parkId?: number,
    @Query('factoryId') factoryId?: number
  ): Promise<any> {
    // Apply role-based filtering
    if (req.user.role === UserRole.PARK_MANAGER) {
      parkId = req.user.parkId;
    } else if (req.user.role === UserRole.FACTORY_OWNER) {
      factoryId = req.user.factoryId;
    }
    return this.analyticsService.getGatePassAnalytics(parkId, factoryId);
  }

  @Get('invoices')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL, UserRole.FACTORY_OWNER)
  @ApiOperation({ summary: 'Get invoice analytics' })
  @ApiQuery({ name: 'parkId', required: false, type: Number, description: 'Filter by park ID' })
  @ApiQuery({ name: 'factoryId', required: false, type: Number, description: 'Filter by factory ID' })
  @ApiResponse({ status: 200, description: 'Invoice analytics retrieved successfully' })
  async getInvoiceAnalytics(
    @Req() req: any,
    @Query('parkId') parkId?: number,
    @Query('factoryId') factoryId?: number
  ): Promise<any> {
    // Apply role-based filtering
    if (req.user.role === UserRole.PARK_MANAGER) {
      parkId = req.user.parkId;
    } else if (req.user.role === UserRole.FACTORY_OWNER) {
      factoryId = req.user.factoryId;
    }
    return this.analyticsService.getInvoiceAnalytics(parkId, factoryId);
  }

  @Get('requests')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL, UserRole.FACTORY_OWNER)
  @ApiOperation({ summary: 'Get request analytics' })
  @ApiQuery({ name: 'parkId', required: false, type: Number, description: 'Filter by park ID' })
  @ApiQuery({ name: 'factoryId', required: false, type: Number, description: 'Filter by factory ID' })
  @ApiResponse({ status: 200, description: 'Request analytics retrieved successfully' })
  async getRequestAnalytics(
    @Req() req: any,
    @Query('parkId') parkId?: number,
    @Query('factoryId') factoryId?: number
  ): Promise<any> {
    // Apply role-based filtering
    if (req.user.role === UserRole.PARK_MANAGER) {
      parkId = req.user.parkId;
    } else if (req.user.role === UserRole.FACTORY_OWNER) {
      factoryId = req.user.factoryId;
    }
    return this.analyticsService.getRequestAnalytics(parkId, factoryId);
  }

  @Get('emergencies')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL)
  @ApiOperation({ summary: 'Get emergency analytics' })
  @ApiQuery({ name: 'parkId', required: false, type: Number, description: 'Filter by park ID' })
  @ApiResponse({ status: 200, description: 'Emergency analytics retrieved successfully' })
  async getEmergencyAnalytics(
    @Query('parkId') parkId?: number
  ): Promise<any> {
    return this.analyticsService.getEmergencyAnalytics(parkId);
  }

  @Get('announcements')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL)
  @ApiOperation({ summary: 'Get announcement analytics' })
  @ApiQuery({ name: 'parkId', required: false, type: Number, description: 'Filter by park ID' })
  @ApiResponse({ status: 200, description: 'Announcement analytics retrieved successfully' })
  async getAnnouncementAnalytics(
    @Query('parkId') parkId?: number
  ): Promise<any> {
    return this.analyticsService.getAnnouncementAnalytics(parkId);
  }

  @Get('advertisements')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL)
  @ApiOperation({ summary: 'Get advertisement analytics' })
  @ApiQuery({ name: 'parkId', required: false, type: Number, description: 'Filter by park ID' })
  @ApiQuery({ name: 'factoryId', required: false, type: Number, description: 'Filter by factory ID' })
  @ApiResponse({ status: 200, description: 'Advertisement analytics retrieved successfully' })
  async getAdvertisementAnalytics(
    @Query('parkId') parkId?: number,
    @Query('factoryId') factoryId?: number
  ): Promise<any> {
    return this.analyticsService.getAdvertisementAnalytics(parkId, factoryId);
  }

  @Get('users')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL)
  @ApiOperation({ summary: 'Get user analytics' })
  @ApiQuery({ name: 'parkId', required: false, type: Number, description: 'Filter by park ID' })
  @ApiQuery({ name: 'factoryId', required: false, type: Number, description: 'Filter by factory ID' })
  @ApiResponse({ status: 200, description: 'User analytics retrieved successfully' })
  async getUserAnalytics(
    @Query('parkId') parkId?: number,
    @Query('factoryId') factoryId?: number
  ): Promise<any> {
    return this.analyticsService.getUserAnalytics(parkId, factoryId);
  }

  @Get('activity')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL, UserRole.FACTORY_OWNER)
  @ApiOperation({ summary: 'Get recent activity feed' })
  @ApiQuery({ name: 'parkId', required: false, type: Number, description: 'Filter by park ID' })
  @ApiQuery({ name: 'factoryId', required: false, type: Number, description: 'Filter by factory ID' })
  @ApiResponse({ status: 200, description: 'Recent activity retrieved successfully' })
  async getRecentActivity(
    @Req() req: any,
    @Query('parkId') parkId?: number,
    @Query('factoryId') factoryId?: number
  ): Promise<any> {
    // Apply role-based filtering
    if (req.user.role === UserRole.PARK_MANAGER) {
      parkId = req.user.parkId;
    } else if (req.user.role === UserRole.FACTORY_OWNER) {
      factoryId = req.user.factoryId;
    }
    return this.analyticsService.getRecentActivity(parkId, factoryId);
  }

  @Post('reports')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL)
  @ApiOperation({ summary: 'Generate custom analytics report' })
  @ApiResponse({ status: 200, description: 'Report generated successfully' })
  async generateReport(
    @Body() reportRequest: {
      reportType: string;
      dateRange: { start: Date; end: Date };
      filters?: any;
    },
    @Req() req: any
  ): Promise<any> {
    return this.analyticsService.generateReport(
      reportRequest.reportType,
      reportRequest.dateRange,
      req.user.id,
      req.user.role,
      reportRequest.filters
    );
  }
}
