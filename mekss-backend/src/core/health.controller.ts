import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  live() {
    return { status: 'ok', service: 'mekss-backend', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', dependencies: { database: 'ok' }, timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({ status: 'not_ready', dependencies: { database: 'unavailable' } });
    }
  }
}
