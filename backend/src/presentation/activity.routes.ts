import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config.js';
import { MAX_REPORT_BYTES, isAllowedReportExtension } from '../infrastructure/local-file-store.js';
import type { activityController } from './activity.controller.js';

export function activityRoutes(controller: ReturnType<typeof activityController>) {
  const router = Router();
  const reportsDir = path.resolve(process.cwd(), config.uploadDir, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const reportUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, reportsDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        cb(null, `activity-report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
      },
    }),
    limits: { fileSize: MAX_REPORT_BYTES },
    fileFilter: (_req, file, cb) => {
      if (!isAllowedReportExtension(file.originalname)) {
        cb(new Error('Invalid file type. Allowed: pdf, doc, docx.'));
        return;
      }
      cb(null, true);
    },
  });
  const sheetUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_REPORT_BYTES } });

  function handleReport(req: Parameters<typeof controller.uploadReport>[0], res: Parameters<typeof controller.uploadReport>[1], next: () => void) {
    reportUpload.single('activityReport')(req, res, (err) => {
      if (!err) {
        next();
        return;
      }
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'File is too large. Maximum size is 5MB.' });
        return;
      }
      res.status(400).json({ error: err.message || 'Upload failed' });
    });
  }

  router.get('/', (req, res, next) => controller.list(req, res).catch(next));
  router.post('/', (req, res, next) => controller.create(req, res).catch(next));
  router.get('/templates', (req, res, next) => controller.listTemplates(req, res).catch(next));
  router.get('/templates/participants', (req, res, next) =>
    controller.downloadParticipantTemplate(req, res).catch(next),
  );
  router.post('/participants/import', sheetUpload.single('file'), (req, res, next) =>
    controller.importParticipants(req, res).catch(next),
  );
  router.get('/:id', (req, res, next) => controller.getOne(req, res).catch(next));
  router.patch('/:id', (req, res, next) => controller.update(req, res).catch(next));
  router.delete('/:id', (req, res, next) => controller.discard(req, res).catch(next));
  router.post('/:id/submit', (req, res, next) => controller.submit(req, res).catch(next));
  router.get('/:id/timeline', (req, res, next) => controller.timeline(req, res).catch(next));
  router.get('/:id/participants', (req, res, next) => controller.listParticipants(req, res).catch(next));
  router.put('/:id/participants', (req, res, next) => controller.replaceParticipants(req, res).catch(next));
  router.post('/:id/report', handleReport, (req, res, next) => controller.uploadReport(req, res).catch(next));
  return router;
}

export function reportRoutes(controller: ReturnType<typeof activityController>) {
  const router = Router();
  router.get('/activities', (req, res, next) => controller.byDate(req, res).catch(next));
  router.get('/funding', (req, res, next) => controller.byFunding(req, res).catch(next));
  router.get('/person', (req, res, next) => controller.byPerson(req, res).catch(next));
  router.get('/missing-report', (req, res, next) => controller.missingReport(req, res).catch(next));
  router.get('/flagged', (req, res, next) => controller.flagged(req, res).catch(next));
  router.get('/participant-activity', (req, res, next) => controller.participantActivity(req, res).catch(next));
  router.get('/amounts', (req, res, next) => controller.amounts(req, res).catch(next));
  return router;
}
