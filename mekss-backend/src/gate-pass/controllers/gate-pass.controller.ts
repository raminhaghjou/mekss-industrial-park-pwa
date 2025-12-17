import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  ParseEnumPipe,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { GatePassService } from '../services/gate-pass.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role, GatePassStatus, CargoType, VehicleType } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CreateGatePassDto } from '../dto/create-gate-pass.dto';
import { UpdateGatePassDto } from '../dto/update-gate-pass.dto';

@ApiTags('Gate Pass')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/gate-passes')
export class GatePassController {
  constructor(private readonly gatePassService: GatePassService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all gate passes with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: GatePassStatus })
  @ApiQuery({ name: 'factoryId', required: false, type: String })
  @ApiQuery({ name: 'driverName', required: false, type: String })
  @ApiQuery({ name: 'licensePlate', required: false, type: String })
  async findAll(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: GatePassStatus,
    @Query('factoryId') factoryId?: string,
    @Query('driverName') driverName?: string,
    @Query('licensePlate') licensePlate?: string,
  ) {
    const filters = {
      status,
      factoryId,
      driverName,
      licensePlate,
    };

    return this.gatePassService.findAll(req.user, {
      page,
      limit,
      filters,
    });
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get gate pass by ID' })
  @ApiResponse({ status: 200, description: 'Gate pass retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Gate pass not found' })
  async findOne(@Param('id') id: string, @Request() req) {
    return this.gatePassService.findOne(id, req.user);
  }

  @Post()
  @Roles(Role.FACTORY_MANAGER, Role.PARK_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new gate pass' })
  @ApiResponse({ status: 201, description: 'Gate pass created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(@Body() createGatePassDto: CreateGatePassDto, @Request() req) {
    return this.gatePassService.create(createGatePassDto, req.user);
  }

  @Put(':id')
  @Roles(Role.FACTORY_MANAGER, Role.PARK_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update gate pass' })
  @ApiResponse({ status: 200, description: 'Gate pass updated successfully' })
  @ApiResponse({ status: 404, description: 'Gate pass not found' })
  async update(
    @Param('id') id: string,
    @Body() updateGatePassDto: UpdateGatePassDto,
    @Request() req,
  ) {
    return this.gatePassService.update(id, updateGatePassDto, req.user);
  }

  @Put(':id/approve')
  @Roles(Role.PARK_MANAGER, Role.FACTORY_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve gate pass' })
  @ApiResponse({ status: 200, description: 'Gate pass approved successfully' })
  @ApiResponse({ status: 404, description: 'Gate pass not found' })
  async approve(@Param('id') id: string, @Request() req) {
    return this.gatePassService.updateStatus(id, GatePassStatus.APPROVED, req.user);
  }

  @Put(':id/reject')
  @Roles(Role.PARK_MANAGER, Role.FACTORY_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject gate pass' })
  @ApiResponse({ status: 200, description: 'Gate pass rejected successfully' })
  @ApiResponse({ status: 404, description: 'Gate pass not found' })
  async reject(@Param('id') id: string, @Body('reason') reason: string, @Request() req) {
    return this.gatePassService.updateStatus(id, GatePassStatus.REJECTED, req.user, reason);
  }

  @Put(':id/verify')
  @Roles(Role.SECURITY_GUARD)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify gate pass at security gate' })
  @ApiResponse({ status: 200, description: 'Gate pass verified successfully' })
  @ApiResponse({ status: 404, description: 'Gate pass not found' })
  async verify(@Param('id') id: string, @Request() req) {
    return this.gatePassService.verify(id, req.user);
  }

  @Put(':id/complete')
  @Roles(Role.SECURITY_GUARD)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete gate pass (vehicle returned)' })
  @ApiResponse({ status: 200, description: 'Gate pass completed successfully' })
  @ApiResponse({ status: 404, description: 'Gate pass not found' })
  async complete(@Param('id') id: string, @Request() req) {
    return this.gatePassService.updateStatus(id, GatePassStatus.COMPLETED, req.user);
  }

  @Get('history/export')
  @Roles(Role.PARK_MANAGER, Role.FACTORY_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export gate pass history to Excel' })
  @ApiResponse({ status: 200, description: 'Export successful' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'factoryId', required: false, type: String })
  async exportHistory(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('factoryId') factoryId?: string,
  ) {
    const filters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      factoryId,
    };

    return this.gatePassService.exportHistory(req.user, filters);
  }

  @Get('stats/summary')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get gate pass statistics summary' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStats(@Request() req) {
    return this.gatePassService.getStats(req.user);
  }

  @Get('qr/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get QR code data for gate pass' })
  @ApiResponse({ status: 200, description: 'QR code data retrieved successfully' })
  async getQrCode(@Param('id') id: string, @Request() req) {
    return this.gatePassService.getQrCode(id, req.user);
  }

  @Delete(':id')
  @Roles(Role.FACTORY_MANAGER, Role.PARK_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete gate pass (soft delete)' })
  @ApiResponse({ status: 200, description: 'Gate pass deleted successfully' })
  @ApiResponse({ status: 404, description: 'Gate pass not found' })
  async remove(@Param('id') id: string, @Request() req) {
    return this.gatePassService.remove(id, req.user);
  }
}