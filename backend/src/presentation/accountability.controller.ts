import type { Response } from 'express';
import { z } from 'zod';
import { AccountabilityService } from '../application/accountability/accountability.service.js';
import { badRequest } from '../domain/activity/errors.js';
import { isAllowedReportExtension, MAX_REPORT_BYTES } from '../infrastructure/local-file-store.js';
import type { AuthedRequest } from './auth.middleware.js';

const listQuery = z.object({
  view: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  activityId: z.string().optional(),
  reviewerId: z.string().optional(),
  department: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  sort: z.enum(['createdAt', 'dueDate', 'referenceNumber']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

export function accountabilityController(service: AccountabilityService) {
  return {
    async list(req: AuthedRequest, res: Response) {
      const q = listQuery.parse(req.query);
      res.json(await service.list(req.actor!, q));
    },
    async getOne(req: AuthedRequest, res: Response) {
      res.json(await service.getById(req.actor!, req.params.id));
    },
    async create(req: AuthedRequest, res: Response) {
      const created = await service.create(req.actor!, req.body);
      res.status(201).json(created);
    },
    async update(req: AuthedRequest, res: Response) {
      res.json(await service.update(req.actor!, req.params.id, req.body));
    },
    async submit(req: AuthedRequest, res: Response) {
      res.json(await service.submit(req.actor!, req.params.id));
    },
    async assign(req: AuthedRequest, res: Response) {
      res.json(await service.assign(req.actor!, req.params.id, req.body || {}));
    },
    async returnCase(req: AuthedRequest, res: Response) {
      res.json(await service.returnCase(req.actor!, req.params.id, req.body || {}));
    },
    async requestClarification(req: AuthedRequest, res: Response) {
      res.json(await service.requestClarification(req.actor!, req.params.id, req.body || {}));
    },
    async respondClarification(req: AuthedRequest, res: Response) {
      res.json(
        await service.respondClarification(req.actor!, req.params.id, req.params.clarificationId, req.body || {}),
      );
    },
    async resubmit(req: AuthedRequest, res: Response) {
      res.json(await service.resubmit(req.actor!, req.params.id));
    },
    async approve(req: AuthedRequest, res: Response) {
      res.json(await service.approve(req.actor!, req.params.id, req.body || {}));
    },
    async reject(req: AuthedRequest, res: Response) {
      res.json(await service.reject(req.actor!, req.params.id, req.body || {}));
    },
    async close(req: AuthedRequest, res: Response) {
      res.json(await service.close(req.actor!, req.params.id, req.body || {}));
    },
    async timeline(req: AuthedRequest, res: Response) {
      res.json(await service.timeline(req.actor!, req.params.id));
    },
    async documents(req: AuthedRequest, res: Response) {
      res.json(await service.documents(req.actor!, req.params.id));
    },
    async uploadDocument(req: AuthedRequest, res: Response) {
      const file = (req as AuthedRequest & { file?: Express.Multer.File }).file;
      if (!file) throw badRequest('Supporting document is required');
      if (!isAllowedReportExtension(file.originalname)) {
        throw badRequest('Invalid file type. Allowed: pdf, doc, docx.');
      }
      if (file.size > MAX_REPORT_BYTES) throw badRequest('File is too large. Maximum size is 5MB.');
      res.json(await service.addDocument(req.actor!, req.params.id, file));
    },
    async reviewers(req: AuthedRequest, res: Response) {
      res.json(await service.listReviewers(req.actor!));
    },
  };
}
