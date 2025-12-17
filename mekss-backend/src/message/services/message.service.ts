import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { QueueService } from '../../shared/services/queue.service';
import { MessageStatus, Role } from '@prisma/client';

interface SendMessageDto {
  receiverId: string;
  subject: string;
  body: string;
}

interface PaginationOptions {
  page: number;
  limit: number;
  filters?: any;
}

@Injectable()
export class MessageService {
  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
  ) {}

  async sendMessage(data: SendMessageDto, senderId: string) {
    const message = await this.prisma.message.create({
      data: {
        senderId,
        receiverId: data.receiverId,
        subject: data.subject,
        body: data.body,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
          },
        },
      },
    });

    // Add notification job
    await this.queueService.addNotificationJob({
      userId: data.receiverId,
      title: 'پیام جدید',
      message: `شما یک پیام جدید از ${message.sender.name} دارید: ${data.subject}`,
      type: 'info',
    });

    return message;
  }

  async getMessages(userId: string, options: PaginationOptions) {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId },
            { receiverId: userId },
          ],
        },
        skip,
        take: limit,
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.message.count({
        where: {
          OR: [
            { senderId: userId },
            { receiverId: userId },
          ],
        },
      }),
    ]);

    return {
      data: messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.message.count({
      where: {
        receiverId: userId,
        status: MessageStatus.UNREAD,
      },
    });

    return { count };
  }

  async markAsRead(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.receiverId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: { status: MessageStatus.READ },
    });

    return { message: 'Message marked as read' };
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Users can only delete their own messages
    if (message.senderId !== userId && message.receiverId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.message.delete({
      where: { id: messageId },
    });

    return { message: 'Message deleted successfully' };
  }

  async getConversation(userId: string, otherUserId: string) {
    const messages = await this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return messages;
  }
}