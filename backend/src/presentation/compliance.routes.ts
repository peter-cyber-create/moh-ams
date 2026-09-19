import { Router } from 'express';
import type { complianceController } from './compliance.controller.js';

export function complianceRoutes(controller: ReturnType<typeof complianceController>) {
  const router = Router();
  router.get('/overview', (req, res, next) => controller.overview(req, res).catch(next));
  router.get('/participation', (req, res, next) => controller.participation(req, res).catch(next));
  router.get('/participation/:participantId', (req, res, next) => controller.participationOne(req, res).catch(next));
  router.get('/accountabilities', (req, res, next) => controller.accountabilities(req, res).catch(next));
  router.get('/participants/:participantId', (req, res, next) => controller.person(req, res).catch(next));
  router.get('/monthly', (req, res, next) => controller.monthly(req, res).catch(next));
  router.get('/annual', (req, res, next) => controller.annual(req, res).catch(next));
  router.get('/overlaps', (req, res, next) => controller.overlaps(req, res).catch(next));
  router.post('/preview', (req, res, next) => controller.preview(req, res).catch(next));
  return router;
}
