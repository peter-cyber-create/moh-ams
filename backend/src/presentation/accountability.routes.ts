import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config.js';
import { MAX_REPORT_BYTES, isAllowedReportExtension } from '../infrastructure/local-file-store.js';
import type { accountabilityController } from './accountability.controller.js';

export function accountabilityRoutes(controller: ReturnType<typeof accountabilityController>) {
  const router = Router();
  const docsDir = path.resolve(process.cwd(), config.uploadDir, 'accountability');
  fs.mkdirSync(docsDir, { recursive: true });
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, docsDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        cb(null, `accountability-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
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

  function handleUpload(
    req: Parameters<typeof controller.uploadDocument>[0],
    res: Parameters<typeof controller.uploadDocument>[1],
    next: () => void,
  ) {
    upload.single('document')(req, res, (err) => {
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
  router.get('/reviewers', (req, res, next) => controller.reviewers(req, res).catch(next));
  router.get('/:id', (req, res, next) => controller.getOne(req, res).catch(next));
  router.patch('/:id', (req, res, next) => controller.update(req, res).catch(next));
  router.post('/:id/submit', (req, res, next) => controller.submit(req, res).catch(next));
  router.post('/:id/assign', (req, res, next) => controller.assign(req, res).catch(next));
  router.post('/:id/return', (req, res, next) => controller.returnCase(req, res).catch(next));
  router.post('/:id/clarification', (req, res, next) => controller.requestClarification(req, res).catch(next));
  router.post('/:id/clarification/:clarificationId/respond', (req, res, next) =>
    controller.respondClarification(req, res).catch(next),
  );
  router.post('/:id/resubmit', (req, res, next) => controller.resubmit(req, res).catch(next));
  router.post('/:id/approve', (req, res, next) => controller.approve(req, res).catch(next));
  router.post('/:id/reject', (req, res, next) => controller.reject(req, res).catch(next));
  router.post('/:id/close', (req, res, next) => controller.close(req, res).catch(next));
  router.get('/:id/timeline', (req, res, next) => controller.timeline(req, res).catch(next));
  router.get('/:id/documents', (req, res, next) => controller.documents(req, res).catch(next));
  router.post('/:id/documents', handleUpload, (req, res, next) => controller.uploadDocument(req, res).catch(next));
  return router;
}
