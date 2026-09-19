import type { Response } from 'express';
import { z } from 'zod';
import { PersonService } from '../application/person/person.service.js';
import { ComplianceService } from '../application/compliance/compliance.service.js';
import type { AuthedRequest } from './auth.middleware.js';

const listQuery = z.object({
  search: z.string().optional(),
  personReference: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  organisation: z.string().optional(),
  department: z.string().optional(),
  status: z.string().optional(),
  identityStatus: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});

export function personController(service: PersonService, compliance: ComplianceService) {
  return {
    async list(req: AuthedRequest, res: Response) {
      res.json(await service.list(req.actor!, listQuery.parse(req.query)));
    },
    async quality(req: AuthedRequest, res: Response) {
      res.json(await service.quality(req.actor!));
    },
    async create(req: AuthedRequest, res: Response) {
      const created = await service.create(req.actor!, req.body);
      res.status(201).json(created);
    },
    async getOne(req: AuthedRequest, res: Response) {
      res.json(await service.getById(req.actor!, req.params.id));
    },
    async update(req: AuthedRequest, res: Response) {
      res.json(await service.update(req.actor!, req.params.id, req.body));
    },
    async participation(req: AuthedRequest, res: Response) {
      const year = req.query.year ? Number(req.query.year) : undefined;
      res.json(await compliance.person(req.actor!, req.params.id, year));
    },
    async accountabilities(req: AuthedRequest, res: Response) {
      const year = req.query.year ? Number(req.query.year) : undefined;
      const row = await compliance.person(req.actor!, req.params.id, year);
      res.json({ data: row.accountabilities, year: row.year, pendingCount: row.pendingCount, overdueCount: row.overdueCount });
    },
    async complianceOne(req: AuthedRequest, res: Response) {
      const year = req.query.year ? Number(req.query.year) : undefined;
      res.json(await compliance.person(req.actor!, req.params.id, year));
    },
    async linkUser(req: AuthedRequest, res: Response) {
      res.json(await service.linkUser(req.actor!, req.params.id, req.body || {}));
    },
    async linkParticipant(req: AuthedRequest, res: Response) {
      res.json(await service.linkParticipant(req.actor!, req.params.id, req.body || {}));
    },
    async merge(req: AuthedRequest, res: Response) {
      await service.merge(req.actor!);
      res.status(501).json({ error: 'Person merge is not implemented in Wave 4.' });
    },
  };
}
