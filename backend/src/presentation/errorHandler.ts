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
  const status =
    err instanceof DomainError || err instanceof AppError
      ? (err as DomainError).statusCode
      : (err as { statusCode?: number }).statusCode || 500;
  const message = status === 500 ? err.message || 'Internal server error' : err.message;
  res.status(status).json({ error: message });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}
