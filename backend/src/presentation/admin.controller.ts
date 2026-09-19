import type { Response } from 'express';
import { z } from 'zod';
import { AdminUserService } from '../application/admin/admin-user.service.js';
import type { AuthedRequest } from './auth.middleware.js';

export function adminController(service: AdminUserService) {
  const tokenOf = (req: AuthedRequest) => String(req.token || req.headers.authorization?.replace(/^Bearer\s+/i, '') || '');

  return {
    async listRoles(req: AuthedRequest, res: Response) {
      res.json(await service.listRoles(req.actor!));
    },
    async accessMatrix(req: AuthedRequest, res: Response) {
      res.json(service.accessMatrix(req.actor!));
    },
    async listDepartments(req: AuthedRequest, res: Response) {
      res.json(await service.listDepartments(req.actor!, tokenOf(req)));
    },
    async listUsers(req: AuthedRequest, res: Response) {
      const q = z
        .object({
          search: z.string().optional(),
          page: z.coerce.number().optional(),
          limit: z.coerce.number().optional(),
          status: z.string().optional(),
          role: z.string().optional(),
          departmentId: z.string().optional(),
        })
        .parse(req.query);
      res.json(await service.list(req.actor!, tokenOf(req), q));
    },
    async getUser(req: AuthedRequest, res: Response) {
      res.json(await service.getById(req.actor!, tokenOf(req), req.params.id));
    },
    async createUser(req: AuthedRequest, res: Response) {
      const body = z
        .object({
          name: z.string(),
          email: z.string(),
          phone: z.string().optional(),
          departmentId: z.string().optional(),
          accessRole: z.string(),
          password: z.string(),
          confirmPassword: z.string(),
          status: z.string().optional(),
        })
        .parse(req.body);
      res.status(201).json(await service.create(req.actor!, tokenOf(req), body));
    },
    async updateUser(req: AuthedRequest, res: Response) {
      const body = z
        .object({
          name: z.string().optional(),
          phone: z.string().nullable().optional(),
          departmentId: z.string().nullable().optional(),
          accessRole: z.string().optional(),
          status: z.string().optional(),
          confirmRoleChange: z.boolean().optional(),
        })
        .parse(req.body);
      res.json(await service.update(req.actor!, tokenOf(req), req.params.id, body));
    },
    async deactivate(req: AuthedRequest, res: Response) {
      res.json(await service.deactivate(req.actor!, tokenOf(req), req.params.id));
    },
    async reactivate(req: AuthedRequest, res: Response) {
      res.json(await service.reactivate(req.actor!, tokenOf(req), req.params.id));
    },
    async resetPassword(req: AuthedRequest, res: Response) {
      const body = z
        .object({
          password: z.string(),
          confirmPassword: z.string(),
        })
        .parse(req.body);
      res.json(await service.resetPassword(req.actor!, tokenOf(req), req.params.id, body));
    },
  };
}
