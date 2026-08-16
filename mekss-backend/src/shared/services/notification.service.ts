import { Injectable } from '@nestjs/common';
import { LoggerService } from './logger.service';

@Injectable()
export class NotificationService {
  constructor(private readonly logger: LoggerService) {}

  async send(userId: string | number, title: string, message: string, type: string = 'info') {
    this.logger.log(
      `Notification queued for user ${userId}: [${type}] ${title} - ${message}`,
      'NotificationService',
    );
    return true;
  }

  async notifyUsers(userIds: Array<string | number>, title: string, message: string) {
    await Promise.all(userIds.map((id) => this.send(id, title, message)));
    return true;
  }
}
