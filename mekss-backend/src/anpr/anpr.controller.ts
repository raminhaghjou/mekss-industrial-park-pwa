import { BadRequestException, Body, Controller, Get, HttpCode, Param, PayloadTooLargeException, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthenticatedUser, JwtAuthGuard, Roles, RolesGuard } from '../core/auth.guard';
import { OpaqueIdParamDto } from '../core/management.dto';
import { AnprEngineService } from './anpr-engine.service';
import { ConfirmPlateReadDto, MatchPlateDto, RecognizeQueryDto, SessionParamDto } from './anpr.dto';
import { ANPR_MAX_FRAME_BYTES } from './anpr.gateway';
import { AnprService } from './anpr.service';
import { PlateReadAuditService } from './plate-read-audit.service';

type AnprRequest = { user: AuthenticatedUser; body: unknown };

/** HTTP fallback for clients whose WebSocket cannot connect, plus device/manual matching and guard confirmation. */
@ApiBearerAuth()
@ApiTags('ANPR')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SECURITY_GUARD, Role.PARK_MANAGER, Role.SUPER_ADMIN)
@Controller('api/v1/anpr')
export class AnprController {
  constructor(
    private readonly anpr: AnprService,
    private readonly engines: AnprEngineService,
    private readonly audit: PlateReadAuditService,
  ) {}

  @Post('recognize')
  @HttpCode(200)
  @ApiConsumes('image/jpeg', 'image/png', 'image/webp', 'application/octet-stream')
  recognize(@Req() req: AnprRequest, @Query() query: RecognizeQueryDto) {
    const image = req.body;
    if (!Buffer.isBuffer(image) || !image.length) throw new BadRequestException('Send the frame as a raw image/jpeg body');
    if (image.length > ANPR_MAX_FRAME_BYTES * 5) throw new PayloadTooLargeException('Frame too large');
    if (query.mode === 'photo') return this.anpr.processPhoto(req.user, image);
    const sessionId = query.sessionId ?? `rest-${Date.now().toString(36)}`;
    const key = AnprService.sessionKey(req.user, sessionId);
    return this.anpr.processFrame(req.user, key, image).then((outcome) => {
      if (!query.sessionId) this.anpr.dropSession(key);
      return { ...outcome, sessionId };
    });
  }

  @Post('sessions/:sessionId/reset')
  @HttpCode(200)
  resetSession(@Req() req: AnprRequest, @Param() params: SessionParamDto) {
    this.anpr.resetSession(AnprService.sessionKey(req.user, params.sessionId));
    return { ok: true };
  }

  @Post('match')
  @HttpCode(200)
  match(@Req() req: AnprRequest, @Body() body: MatchPlateDto) {
    return this.anpr.matchPlate(req.user, body);
  }

  @Post('reads/:id/confirm')
  @HttpCode(200)
  confirm(@Req() req: AnprRequest, @Param() params: OpaqueIdParamDto, @Body() body: ConfirmPlateReadDto) {
    return this.audit.confirm(req.user, params.id, body);
  }

  @Get('status')
  status() {
    return this.engines.status();
  }
}
