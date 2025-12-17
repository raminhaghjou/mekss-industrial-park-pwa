import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { LoggerService } from './logger.service';

export interface SmsJob {
  phoneNumber: string;
  message: string;
  type: 'otp' | 'notification' | 'invoice' | 'gatepass' | 'request';
}

export interface EmailJob {
  to: string;
  subject: string;
  template: string;
  data: any;
}

export interface NotificationJob {
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

@Injectable()
export class QueueService implements OnModuleInit {
  constructor(
    @InjectQueue('sms') private smsQueue: Queue<SmsJob>,
    @InjectQueue('email') private emailQueue: Queue<EmailJob>,
    @InjectQueue('notification') private notificationQueue: Queue<NotificationJob>,
    private logger: LoggerService,
  ) {}

  async onModuleInit() {
    this.logger.log('Queue service initialized');
  }

  async addSmsJob(job: SmsJob): Promise<void> {
    try {
      await this.smsQueue.add('send-sms', job, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });
      this.logger.log(`SMS job added to queue for ${job.phoneNumber}`);
    } catch (error) {
      this.logger.error(`Failed to add SMS job to queue`, error);
      throw error;
    }
  }

  async addEmailJob(job: EmailJob): Promise<void> {
    try {
      await this.emailQueue.add('send-email', job, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });
      this.logger.log(`Email job added to queue for ${job.to}`);
    } catch (error) {
      this.logger.error(`Failed to add email job to queue`, error);
      throw error;
    }
  }

  async addNotificationJob(job: NotificationJob): Promise<void> {
    try {
      await this.notificationQueue.add('send-notification', job, {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });
      this.logger.log(`Notification job added to queue for user ${job.userId}`);
    } catch (error) {
      this.logger.error(`Failed to add notification job to queue`, error);
      throw error;
    }
  }

  async addBulkSmsJobs(jobs: SmsJob[]): Promise<void> {
    try {
      const bulkJobs = jobs.map(job => ({
        data: job,
        opts: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      }));

      await this.smsQueue.addBulk(bulkJobs);
      this.logger.log(`${jobs.length} SMS jobs added to queue in bulk`);
    } catch (error) {
      this.logger.error(`Failed to add bulk SMS jobs to queue`, error);
      throw error;
    }
  }

  async getQueueStats(queueName: 'sms' | 'email' | 'notification'): Promise<any> {
    const queue = queueName === 'sms' ? this.smsQueue : 
                  queueName === 'email' ? this.emailQueue : 
                  this.notificationQueue;

    try {
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
      };
    } catch (error) {
      this.logger.error(`Failed to get queue stats for ${queueName}`, error);
      throw error;
    }
  }
}