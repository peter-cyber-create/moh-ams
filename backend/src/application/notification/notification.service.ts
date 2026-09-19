import { prisma } from '../../infrastructure/prisma.js';
import type { NotifyInput } from '../../domain/notification/types.js';

export class NotificationService {
  /** Create once; ignore duplicates (refresh-safe). */
  async notify(input: NotifyInput) {
    if (!input.recipientUserId || !input.dedupeKey) return null;
    try {
      return await prisma.notification.create({
        data: {
          recipientUserId: input.recipientUserId,
          type: input.type,
          title: input.title,
          message: input.message,
          referenceType: input.referenceType || null,
          referenceId: input.referenceId || null,
          href: input.href || null,
          dedupeKey: input.dedupeKey,
        },
      });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'P2002') return null;
      throw err;
    }
  }

  async list(recipientUserId: string, opts: { unreadOnly?: boolean; limit?: number } = {}) {
    const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
    const where = {
      recipientUserId,
      ...(opts.unreadOnly ? { isRead: false } : {}),
    };
    const [data, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({ where: { recipientUserId, isRead: false } }),
    ]);
    return { unreadCount, data };
  }

  async markRead(recipientUserId: string, id: string) {
    const row = await prisma.notification.findFirst({ where: { id, recipientUserId } });
    if (!row) return null;
    if (row.isRead) return row;
    return prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(recipientUserId: string) {
    await prisma.notification.updateMany({
      where: { recipientUserId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { ok: true };
  }
}
