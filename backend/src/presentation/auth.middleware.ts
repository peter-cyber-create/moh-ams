import type { NextFunction, Request, Response } from 'express';
import type { Actor } from '../domain/activity/permissions.js';
import { unauthorized } from '../domain/activity/errors.js';
import type { FinanceIdentityDirectory } from '../infrastructure/finance-identity.js';

export interface AuthedRequest extends Request {
  actor?: Actor;
  token?: string;
}

export function requireAuth(identity: FinanceIdentityDirectory) {
  return async (req: AuthedRequest, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) throw unauthorized('Authentication required');
      const token = header.slice(7);
      req.token = token;
      req.actor = await identity.resolveFromToken(token);
      next();
    } catch (err) {
      next(err);
    }
  };
}
