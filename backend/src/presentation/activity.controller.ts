import type { Response } from 'express';
import { z } from 'zod';
import { ActivityService } from '../application/activity/activity.service.js';
import { ActivityReportQueries } from '../application/activity/reports.js';
import { badRequest, forbidden } from '../domain/activity/errors.js';
import { hasPermission, PERMISSIONS } from '../domain/activity/permissions.js';
import {
  PARTICIPANT_TEMPLATE,
  TEMPLATE_CATALOG,
  buildParticipantTemplateBuffer,
} from '../domain/activity/templates.js';
import { isAllowedReportExtension, MAX_REPORT_BYTES } from '../infrastructure/local-file-store.js';
import type { AuthedRequest } from './auth.middleware.js';
import XLSX from 'xlsx';

const listQuery = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  funder: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  sort: z.enum(['createdAt', 'activityDate', 'title']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

function sendXlsx(res: Response, buffer: Buffer, fileName: string) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
}

export function activityController(service: ActivityService, reports: ActivityReportQueries) {
  return {
    async list(req: AuthedRequest, res: Response) {
      const q = listQuery.parse(req.query);
      const result = await service.list(req.actor!, q);
      res.json(result);
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
      res.json(await service.submitDraft(req.actor!, req.params.id));
    },
    async discard(req: AuthedRequest, res: Response) {
      await service.discardDraft(req.actor!, req.params.id);
      res.status(204).send();
    },
    async timeline(req: AuthedRequest, res: Response) {
      res.json(await service.timeline(req.actor!, req.params.id));
    },
    async replaceParticipants(req: AuthedRequest, res: Response) {
      res.json(await service.replaceParticipants(req.actor!, req.params.id, req.body.participants ?? req.body));
    },
    async listParticipants(req: AuthedRequest, res: Response) {
      res.json(await service.listParticipants(req.actor!, req.params.id));
    },
    async listTemplates(req: AuthedRequest, res: Response) {
      if (!hasPermission(req.actor!, PERMISSIONS.CREATE) && !hasPermission(req.actor!, PERMISSIONS.VIEW)) {
        throw forbidden();
      }
      res.json({
        data: TEMPLATE_CATALOG,
        participantColumns: PARTICIPANT_TEMPLATE.columns,
      });
    },
    async downloadParticipantTemplate(req: AuthedRequest, res: Response) {
      if (!hasPermission(req.actor!, PERMISSIONS.CREATE) && !hasPermission(req.actor!, PERMISSIONS.VIEW)) {
        throw forbidden();
      }
      sendXlsx(res, buildParticipantTemplateBuffer(), PARTICIPANT_TEMPLATE.fileName);
    },
    async importParticipants(req: AuthedRequest, res: Response) {
      const file = (req as AuthedRequest & { file?: Express.Multer.File }).file;
      if (!file?.buffer) throw badRequest('File is required');
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName =
        workbook.SheetNames.find((n) => n.toLowerCase().includes('participant')) || workbook.SheetNames[0];
      if (!sheetName) throw badRequest('No sheets found in workbook');
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' });
      const activityId = String(req.query.activityId || req.body?.activityId || '') || undefined;
      res.json(await service.importSpreadsheet(req.actor!, rawRows, activityId));
    },
    async uploadReport(req: AuthedRequest, res: Response) {
      const file = (req as AuthedRequest & { file?: Express.Multer.File }).file;
      if (!file) throw badRequest('Report file is required');
      if (!isAllowedReportExtension(file.originalname)) {
        throw badRequest('Invalid file type. Allowed: pdf, doc, docx.');
      }
      if (file.size > MAX_REPORT_BYTES) throw badRequest('File is too large. Maximum size is 5MB.');
      res.json(await service.submitReport(req.actor!, req.params.id, file));
    },
    async missingReport(req: AuthedRequest, res: Response) {
      res.json(await reports.missingReport(req.actor!));
    },
    async flagged(req: AuthedRequest, res: Response) {
      res.json(await reports.flagged(req.actor!));
    },
    async byDate(req: AuthedRequest, res: Response) {
      res.json(await reports.byDate(req.actor!));
    },
    async byFunding(req: AuthedRequest, res: Response) {
      res.json(await reports.byFunding(req.actor!, String(req.query.funder || '') || undefined));
    },
    async byPerson(req: AuthedRequest, res: Response) {
      res.json(await reports.byPerson(req.actor!, String(req.query.name || '') || undefined));
    },
    async amounts(req: AuthedRequest, res: Response) {
      res.json(await reports.amounts(req.actor!));
    },
    async participantActivity(req: AuthedRequest, res: Response) {
      res.json(await reports.participantActivity(req.actor!));
    },
  };
}
