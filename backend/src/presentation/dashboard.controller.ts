import type { Response } from 'express';
import { z } from 'zod';
import { NotificationService } from '../application/notification/notification.service.js';
import { DashboardService } from '../application/dashboard/dashboard.service.js';
import type { AuthedRequest } from './auth.middleware.js';

export function notificationController(service: NotificationService) {
  return {
    async list(req: AuthedRequest, res: Response) {
      const q = z
        .object({
          unreadOnly: z.coerce.boolean().optional(),
          limit: z.coerce.number().optional(),
        })
        .parse(req.query);
      res.json(await service.list(req.actor!.id, q));
    },
    async markRead(req: AuthedRequest, res: Response) {
      const row = await service.markRead(req.actor!.id, req.params.id);
      if (!row) {
        res.status(404).json({ error: 'Notification not found.' });
        return;
      }
      res.json(row);
    },
    async markAllRead(req: AuthedRequest, res: Response) {
      res.json(await service.markAllRead(req.actor!.id));
    },
  };
}

export function dashboardController(service: DashboardService) {
  return {
    async home(req: AuthedRequest, res: Response) {
      res.json(await service.getHome(req.actor!));
    },
    async overview(req: AuthedRequest, res: Response) {
      const q = z.object({ year: z.coerce.number().optional() }).parse(req.query);
      res.json(await service.getOverview(req.actor!, q.year));
    },
  };
}
