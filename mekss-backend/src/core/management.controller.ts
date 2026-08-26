import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthenticatedUser, JwtAuthGuard, Roles, RolesGuard } from './auth.guard';
import {
  CreateAnnouncementDto,
  CreateManagedUserDto,
  CreateParkDto,
  PaginationQueryDto,
  ReportQueryDto,
  ResetPasswordAdminDto,
  SendMessageDto,
  UpdateAnnouncementDto,
  UpdateManagedUserDto,
  UpdateParkDto,
} from './management.dto';
import { ManagementService } from './management.service';

const currentUser = (request: { user: AuthenticatedUser }) => request.user;

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1')
export class ManagementController {
  constructor(private readonly management: ManagementService) {}

  @Get('users') @Roles(Role.SUPER_ADMIN) @ApiTags('Users') users(@Query() query: PaginationQueryDto) { return this.management.users(query); }
  @Get('users/:id') @Roles(Role.SUPER_ADMIN) @ApiTags('Users') userDetail(@Param('id') id: string) { return this.management.userDetail(id); }
  @Post('users') @Roles(Role.SUPER_ADMIN) @ApiTags('Users') createUser(@Req() req: any, @Body() body: CreateManagedUserDto) { return this.management.createUser(currentUser(req), body); }
  @Patch('users/:id') @Roles(Role.SUPER_ADMIN) @ApiTags('Users') updateUser(@Req() req: any, @Param('id') id: string, @Body() body: UpdateManagedUserDto) { return this.management.updateUser(currentUser(req), id, body); }
  @Delete('users/:id') @Roles(Role.SUPER_ADMIN) @ApiTags('Users') deleteUser(@Req() req: any, @Param('id') id: string) { return this.management.deleteUser(currentUser(req), id); }
  @Post('users/:id/activate') @Roles(Role.SUPER_ADMIN) @ApiTags('Users') activateUser(@Req() req: any, @Param('id') id: string) { return this.management.setUserActive(currentUser(req), id, true); }
  @Post('users/:id/deactivate') @Roles(Role.SUPER_ADMIN) @ApiTags('Users') deactivateUser(@Req() req: any, @Param('id') id: string) { return this.management.setUserActive(currentUser(req), id, false); }
  @Post('users/:id/reset-password') @Roles(Role.SUPER_ADMIN) @ApiTags('Users') resetUserPassword(@Req() req: any, @Param('id') id: string, @Body() body: ResetPasswordAdminDto) { return this.management.resetUserPassword(currentUser(req), id, body.newPassword); }

  @Get('industrial-parks') @Roles(Role.SUPER_ADMIN) @ApiTags('Parks') parks(@Query() query: PaginationQueryDto) { return this.management.parks(query); }
  @Get('industrial-parks/:id') @Roles(Role.SUPER_ADMIN) @ApiTags('Parks') parkDetail(@Param('id') id: string) { return this.management.parkDetail(id); }
  @Post('industrial-parks') @Roles(Role.SUPER_ADMIN) @ApiTags('Parks') createPark(@Req() req: any, @Body() body: CreateParkDto) { return this.management.createPark(currentUser(req), body); }
  @Put('industrial-parks/:id') @Roles(Role.SUPER_ADMIN) @ApiTags('Parks') updatePark(@Req() req: any, @Param('id') id: string, @Body() body: UpdateParkDto) { return this.management.updatePark(currentUser(req), id, body); }
  @Delete('industrial-parks/:id') @Roles(Role.SUPER_ADMIN) @ApiTags('Parks') deletePark(@Req() req: any, @Param('id') id: string) { return this.management.deletePark(currentUser(req), id); }

  @Get('factories') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER, Role.SECURITY_GUARD, Role.GOVERNMENT_OFFICIAL) @ApiTags('Factories') factories(@Req() req: any) { return this.management.listFactories(currentUser(req)); }
  @Post('factories') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Factories') createFactory(@Req() req: any, @Body() body: any) { return this.management.createFactory(currentUser(req), body); }
  @Put('factories/:id') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER) @ApiTags('Factories') updateFactory(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.management.updateFactory(currentUser(req), id, body); }

  @Get('gate-passes') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER, Role.SECURITY_GUARD, Role.GOVERNMENT_OFFICIAL) @ApiTags('Gate passes') gatePasses(@Req() req: any) { return this.management.listGatePasses(currentUser(req)); }
  @Post('gate-passes') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER) @ApiTags('Gate passes') createGatePass(@Req() req: any, @Body() body: any) { return this.management.createGatePass(currentUser(req), body); }
  @Post('gate-passes/:id/approve') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Gate passes') approveGatePass(@Req() req: any, @Param('id') id: string) { return this.management.gatePassAction(currentUser(req), id, 'approve'); }
  @Post('gate-passes/:id/reject') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Gate passes') rejectGatePass(@Req() req: any, @Param('id') id: string, @Body('reason') reason?: string) { return this.management.gatePassAction(currentUser(req), id, 'reject', reason); }
  @Post('gate-passes/:id/verify') @Roles(Role.SUPER_ADMIN, Role.SECURITY_GUARD) @ApiTags('Gate passes') verifyGatePass(@Req() req: any, @Param('id') id: string) { return this.management.gatePassAction(currentUser(req), id, 'verify'); }
  @Post('gate-passes/:id/deny') @Roles(Role.SUPER_ADMIN, Role.SECURITY_GUARD) @ApiTags('Gate passes') denyGatePassExit(@Req() req: any, @Param('id') id: string, @Body('reason') reason?: string) { return this.management.gatePassAction(currentUser(req), id, 'deny', reason); }
  @Get('gate-passes/:id') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER, Role.SECURITY_GUARD, Role.GOVERNMENT_OFFICIAL) @ApiTags('Gate passes') gatePassDetail(@Req() req: any, @Param('id') id: string) { return this.management.gatePassDetail(currentUser(req), id); }

  @Get('invoices') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER, Role.GOVERNMENT_OFFICIAL) @ApiTags('Invoices') invoices(@Req() req: any) { return this.management.listInvoices(currentUser(req)); }
  @Post('invoices') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Invoices') createInvoice(@Req() req: any, @Body() body: any) { return this.management.createInvoice(currentUser(req), body); }
  @Post('invoices/:id/pay') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER) @ApiTags('Invoices') startPayment(@Req() req: any, @Param('id') id: string, @Headers('idempotency-key') idempotencyKey?: string) { return this.management.startPayment(currentUser(req), id, idempotencyKey); }

  @Get('requests') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER, Role.SECURITY_GUARD, Role.GOVERNMENT_OFFICIAL) @ApiTags('Requests') requests(@Req() req: any) { return this.management.listRequests(currentUser(req)); }
  @Post('requests') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER) @ApiTags('Requests') createRequest(@Req() req: any, @Body() body: any) { return this.management.createRequest(currentUser(req), body); }
  @Post('requests/:id/approve') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Requests') approveRequest(@Req() req: any, @Param('id') id: string) { return this.management.requestAction(currentUser(req), id, 'approve'); }
  @Post('requests/:id/reject') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Requests') rejectRequest(@Req() req: any, @Param('id') id: string, @Body('reason') reason?: string) { return this.management.requestAction(currentUser(req), id, 'reject', reason); }

  @Get('announcements') @ApiTags('Announcements') announcements() { return this.management.announcements(); }
  @Post('announcements') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Announcements') createAnnouncement(@Req() req: any, @Body() body: CreateAnnouncementDto) { return this.management.createAnnouncement(currentUser(req), body); }
  @Get('announcements/managed') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Announcements') managedAnnouncements(@Req() req: any) { return this.management.managedAnnouncements(currentUser(req)); }
  @Put('announcements/:id') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Announcements') updateAnnouncement(@Req() req: any, @Param('id') id: string, @Body() body: UpdateAnnouncementDto) { return this.management.updateAnnouncement(currentUser(req), id, body); }
  @Delete('announcements/:id') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Announcements') deleteAnnouncement(@Req() req: any, @Param('id') id: string) { return this.management.deleteAnnouncement(currentUser(req), id); }

  @Get('advertisements') @ApiTags('Advertisements') advertisements() { return this.management.advertisements(); }
  @Post('advertisements') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER) @ApiTags('Advertisements') createAdvertisement(@Req() req: any, @Body() body: any) { return this.management.createAdvertisement(currentUser(req), body); }
  @Get('advertisements/managed/pending') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Advertisements') managedPendingAdvertisements(@Req() req: any) { return this.management.managedAdvertisements(currentUser(req), 'PENDING'); }
  @Get('advertisements/managed/history') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Advertisements') managedHistoryAdvertisements(@Req() req: any) { return this.management.managedAdvertisements(currentUser(req), 'HISTORY'); }
  @Post('advertisements/:id/approve') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Advertisements') approveAdvertisement(@Req() req: any, @Param('id') id: string, @Body('approved') approved = true, @Body('rejectionReason') reason?: string) { return this.management.approveAdvertisement(currentUser(req), id, Boolean(approved), reason); }

  @Post('messages/batch') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Messages') sendBatchMessage(@Req() req: any, @Body() body: SendMessageDto) { return this.management.sendMessage(currentUser(req), body.recipientIds, body.subject, body.body); }
  @Get('messages/inbox') @ApiTags('Messages') inboxMessages(@Req() req: any) { return this.management.inboxMessages(currentUser(req)); }
  @Post('messages/:id/read') @ApiTags('Messages') markMessageRead(@Req() req: any, @Param('id') id: string) { return this.management.markMessageRead(currentUser(req), id); }

  @Get('reports') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.GOVERNMENT_OFFICIAL) @ApiTags('Reports') report(@Req() req: any, @Query() query: ReportQueryDto) { return this.management.report(currentUser(req), query.type as any, query.from, query.to); }

  @Get('sms/health') @Roles(Role.SUPER_ADMIN) @ApiTags('SMS') smsHealth() { return this.management.smsHealth(); }

  @Get('emergency') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER, Role.SECURITY_GUARD, Role.GOVERNMENT_OFFICIAL) @ApiTags('Emergency') emergencies() { return this.management.emergencies(); }
  @Post('emergency') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER, Role.SECURITY_GUARD) @ApiTags('Emergency') createEmergency(@Req() req: any, @Body() body: any) { return this.management.createEmergency(currentUser(req), body); }
  @Post('emergency/:id/acknowledge') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.SECURITY_GUARD) @ApiTags('Emergency') acknowledgeEmergency(@Req() req: any, @Param('id') id: string) { return this.management.emergencyAction(currentUser(req), id, 'acknowledge'); }
  @Post('emergency/:id/resolve') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Emergency') resolveEmergency(@Req() req: any, @Param('id') id: string) { return this.management.emergencyAction(currentUser(req), id, 'resolve'); }

  @Get('analytics/dashboard') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER, Role.SECURITY_GUARD, Role.GOVERNMENT_OFFICIAL) @ApiTags('Analytics') dashboard(@Req() req: any) { return this.management.dashboard(currentUser(req)); }
}

@Controller('api/v1/invoices/payment')
export class PaymentCallbackController {
  constructor(private readonly management: ManagementService) {}

  @Get('callback')
  @ApiTags('Invoices')
  callback(@Query('Authority') authority: string, @Query('Status') status: string) { return this.management.verifyPayment(authority, status); }
}
