import { Router } from 'express';
import type { dashboardController, notificationController } from './dashboard.controller.js';

export function notificationRoutes(controller: ReturnType<typeof notificationController>) {
  const router = Router();
  router.get('/', (req, res, next) => controller.list(req, res).catch(next));
  router.post('/read-all', (req, res, next) => controller.markAllRead(req, res).catch(next));
  router.post('/:id/read', (req, res, next) => controller.markRead(req, res).catch(next));
  return router;
}

export function dashboardRoutes(controller: ReturnType<typeof dashboardController>) {
  const router = Router();
  router.get('/home', (req, res, next) => controller.home(req, res).catch(next));
  router.get('/overview', (req, res, next) => controller.overview(req, res).catch(next));
  return router;
}
