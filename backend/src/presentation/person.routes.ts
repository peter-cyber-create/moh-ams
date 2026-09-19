import { Router } from 'express';
import type { personController } from './person.controller.js';

export function personRoutes(controller: ReturnType<typeof personController>) {
  const router = Router();
  router.get('/', (req, res, next) => controller.list(req, res).catch(next));
  router.post('/', (req, res, next) => controller.create(req, res).catch(next));
  router.get('/quality', (req, res, next) => controller.quality(req, res).catch(next));
  router.get('/:id', (req, res, next) => controller.getOne(req, res).catch(next));
  router.patch('/:id', (req, res, next) => controller.update(req, res).catch(next));
  router.get('/:id/participation', (req, res, next) => controller.participation(req, res).catch(next));
  router.get('/:id/accountabilities', (req, res, next) => controller.accountabilities(req, res).catch(next));
  router.get('/:id/compliance', (req, res, next) => controller.complianceOne(req, res).catch(next));
  router.post('/:id/link-user', (req, res, next) => controller.linkUser(req, res).catch(next));
  router.post('/:id/link-participant', (req, res, next) => controller.linkParticipant(req, res).catch(next));
  router.post('/:id/merge', (req, res, next) => controller.merge(req, res).catch(next));
  return router;
}
