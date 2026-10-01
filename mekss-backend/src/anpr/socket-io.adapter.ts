import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

/** Socket.IO adapter sharing the HTTP CORS allow-list and bounding message size for camera frames. */
export class CorsIoAdapter extends IoAdapter {
  constructor(app: INestApplicationContext, private readonly origins: string[]) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) =>
          callback(null, !origin || this.origins.includes(origin)),
        credentials: true,
      },
      maxHttpBufferSize: 512 * 1024,
      pingInterval: 20_000,
      pingTimeout: 20_000,
      perMessageDeflate: false,
    });
  }
}
