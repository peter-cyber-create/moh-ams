import { Router } from 'express';
import type { adminController } from './admin.controller.js';

export function adminRoutes(controller: ReturnType<typeof adminController>) {
  const router = Router();
  router.get('/roles', (req, res, next) => controller.listRoles(req, res).catch(next));
  router.get('/access-matrix', (req, res, next) => controller.accessMatrix(req, res).catch(next));
  router.get('/departments', (req, res, next) => controller.listDepartments(req, res).catch(next));
  router.get('/users', (req, res, next) => controller.listUsers(req, res).catch(next));
  router.post('/users', (req, res, next) => controller.createUser(req, res).catch(next));
  router.get('/users/:id', (req, res, next) => controller.getUser(req, res).catch(next));
  router.patch('/users/:id', (req, res, next) => controller.updateUser(req, res).catch(next));
  router.post('/users/:id/deactivate', (req, res, next) => controller.deactivate(req, res).catch(next));
  router.post('/users/:id/reactivate', (req, res, next) => controller.reactivate(req, res).catch(next));
  router.post('/users/:id/reset-password', (req, res, next) => controller.resetPassword(req, res).catch(next));
  return router;
}
