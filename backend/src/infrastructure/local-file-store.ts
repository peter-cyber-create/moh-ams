import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config.js';

const ALLOWED = new Set(['.pdf', '.doc', '.docx']);
export const MAX_REPORT_BYTES = 5 * 1024 * 1024;

export function isAllowedReportExtension(filename: string) {
  return ALLOWED.has(path.extname(filename || '').toLowerCase());
}

/** Resolve a request path under the upload root. Rejects traversal. */
export function resolveUploadFile(uploadRoot: string, requestPath: string) {
  const root = path.resolve(uploadRoot);
  let rel = requestPath || '';
  try {
    rel = decodeURIComponent(rel);
  } catch {
    return null;
  }
  rel = rel.replace(/^\/+/, '');
  if (!rel || rel.includes('\0')) return null;
  const full = path.resolve(root, rel);
  if (full !== root && !full.startsWith(`${root}${path.sep}`)) return null;
  if (!isAllowedReportExtension(full)) return null;
  return full;
}

export class LocalFileStore {
  constructor(
    private readonly root = path.resolve(process.cwd(), config.uploadDir, 'reports'),
    private readonly publicPrefix = '/uploads/reports',
  ) {
    fs.mkdirSync(this.root, { recursive: true });
  }

  async save(file: { originalname: string; mimetype?: string; size?: number; filename?: string; path?: string }) {
    if (!isAllowedReportExtension(file.originalname)) {
      if (file.path) fs.unlink(file.path, () => undefined);
      throw Object.assign(new Error('Invalid file type. Allowed: pdf, doc, docx.'), { statusCode: 400 });
    }
    const ext = path.extname(file.originalname || '').toLowerCase();
    const filename = file.filename || `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const storedPath = `${this.publicPrefix}/${filename}`;
    return {
      storedPath,
      originalName: file.originalname,
      mimeType: file.mimetype || null,
      sizeBytes: file.size ?? null,
    };
  }
}
