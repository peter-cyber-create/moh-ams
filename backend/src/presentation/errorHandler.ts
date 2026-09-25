import type { NextFunction, Request, Response } from 'express';
import { DomainError } from '../domain/activity/errors.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  const coded = err as { statusCode?: number; status?: number };
  const status =
    err instanceof DomainError || err instanceof AppError ? (err as DomainError).statusCode : coded.statusCode || coded.status || 500;
  if (status >= 500) {
    console.error(err);
    res.status(status).json({ error: 'Internal server error' });
    return;
  }
  res.status(status).json({ error: err.message || 'Request failed' });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}
