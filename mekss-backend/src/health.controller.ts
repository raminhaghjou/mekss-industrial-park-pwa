import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'mekss-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
