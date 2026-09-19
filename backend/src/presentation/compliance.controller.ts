import type { Response } from 'express';
import { z } from 'zod';
import { ComplianceService } from '../application/compliance/compliance.service.js';
import type { AuthedRequest } from './auth.middleware.js';

const listQuery = z.object({
  year: z.coerce.number().optional(),
  month: z.coerce.number().optional(),
  search: z.string().optional(),
  department: z.string().optional(),
  participationStatus: z.string().optional(),
  accountabilityStatus: z.string().optional(),
  overdue: z.coerce.boolean().optional(),
  exceeded: z.coerce.boolean().optional(),
  earlyWarning: z.coerce.boolean().optional(),
  monthlyExceeded: z.coerce.boolean().optional(),
  monthlyLimit: z.coerce.boolean().optional(),
  overlap: z.coerce.boolean().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});

const previewBody = z.object({
  title: z.string().optional(),
  activityDate: z.union([z.string(), z.null()]).optional(),
  endDate: z.union([z.string(), z.null()]).optional(),
  excludeActivityId: z.string().optional().nullable(),
  year: z.coerce.number().optional(),
  participants: z
    .array(
      z.object({
        name: z.string().optional(),
        phone: z.string().optional().nullable(),
        title: z.string().optional().nullable(),
        personId: z.string().optional().nullable(),
      }),
    )
    .optional(),
});

export function complianceController(service: ComplianceService) {
  return {
    async overview(req: AuthedRequest, res: Response) {
      res.json(await service.overview(req.actor!, listQuery.parse(req.query)));
    },
    async participation(req: AuthedRequest, res: Response) {
      res.json(await service.participation(req.actor!, listQuery.parse(req.query)));
    },
    async participationOne(req: AuthedRequest, res: Response) {
      const year = req.query.year ? Number(req.query.year) : undefined;
      res.json(await service.person(req.actor!, req.params.participantId, year));
    },
    async accountabilities(req: AuthedRequest, res: Response) {
      res.json(await service.accountabilities(req.actor!, listQuery.parse(req.query)));
    },
    async person(req: AuthedRequest, res: Response) {
      const year = req.query.year ? Number(req.query.year) : undefined;
      res.json(await service.person(req.actor!, req.params.participantId, year));
    },
    async monthly(req: AuthedRequest, res: Response) {
      res.json(await service.monthly(req.actor!, listQuery.parse(req.query)));
    },
    async annual(req: AuthedRequest, res: Response) {
      res.json(await service.annual(req.actor!, listQuery.parse(req.query)));
    },
    async overlaps(req: AuthedRequest, res: Response) {
      res.json(await service.overlaps(req.actor!, listQuery.parse(req.query)));
    },
    async preview(req: AuthedRequest, res: Response) {
      res.json(await service.preview(req.actor!, previewBody.parse(req.body || {})));
    },
    async activityPreview(req: AuthedRequest, res: Response) {
      const body = previewBody.parse(req.body || {});
      res.json(
        await service.preview(req.actor!, {
          ...body,
          excludeActivityId: req.params.id,
        }),
      );
    },
  };
}
