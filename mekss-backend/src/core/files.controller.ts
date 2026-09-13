import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { AuthenticatedUser, JwtAuthGuard } from './auth.guard';
import { FilesService, MEDIA_DOMAINS } from './files.service';
import { FILE_UPLOAD_CONFIG } from '../shared/constants';

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'domain'],
      properties: {
        file: { type: 'string', format: 'binary' },
        domain: { type: 'string', enum: [...MEDIA_DOMAINS] },
        parkId: { type: 'string' },
        factoryId: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: FILE_UPLOAD_CONFIG.MAX_FILE_SIZE, files: 1 },
    }),
  )
  upload(
    @Req() request: { user: AuthenticatedUser },
    @UploadedFile() file: Express.Multer.File,
    @Query('domain') domainQuery?: string,
    @Query('parkId') parkIdQuery?: string,
    @Query('factoryId') factoryIdQuery?: string,
  ) {
    // Prefer multipart fields; fall back to query for clients that only set FormData file + query.
    const body = (request as any).body || {};
    const domain = String(body.domain || domainQuery || '').trim();
    const parkId = String(body.parkId || parkIdQuery || '').trim() || undefined;
    const factoryId = String(body.factoryId || factoryIdQuery || '').trim() || undefined;
    if (!file) throw new BadRequestException('فایل ارسال نشده است');
    if (!domain) throw new BadRequestException('domain الزامی است');
    return this.files.upload(request.user, file, { domain, parkId, factoryId });
  }

  @Get(':id')
  metadata(@Req() request: { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.files.getMetadata(request.user, id);
  }

  @Get(':id/content')
  async content(
    @Req() request: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Res() res: Response,
    @Query('download') download?: string,
  ) {
    const payload = await this.files.getContent(request.user, id);
    res.setHeader('Content-Type', payload.contentType);
    res.setHeader('Content-Length', String(payload.byteSize));
    res.setHeader('Cache-Control', 'private, max-age=300');
    const disposition = download === '1' || download === 'true' ? 'attachment' : 'inline';
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename*=UTF-8''${encodeURIComponent(payload.originalName)}`,
    );
    res.send(payload.buffer);
  }

  @Delete(':id')
  remove(@Req() request: { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.files.remove(request.user, id);
  }
}
