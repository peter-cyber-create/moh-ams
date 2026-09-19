import 'express-async-errors';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { config } from './config.js';
import { ActivityService } from './application/activity/activity.service.js';
import { AccountabilityService } from './application/accountability/accountability.service.js';
import { ComplianceService } from './application/compliance/compliance.service.js';
import { DashboardService } from './application/dashboard/dashboard.service.js';
import { NotificationService } from './application/notification/notification.service.js';
import { PersonService } from './application/person/person.service.js';
import { ActivityReportQueries } from './application/activity/reports.js';
import { PrismaActivityRepository } from './infrastructure/prisma-activity.repository.js';
import { PrismaAccountabilityRepository, PrismaIdentityLookup } from './infrastructure/prisma-accountability.repository.js';
import { PrismaComplianceReadPort } from './infrastructure/prisma-compliance.repository.js';
import { PrismaPersonRepository } from './infrastructure/prisma-person.repository.js';
import { LocalFileStore } from './infrastructure/local-file-store.js';
import { FinanceIdentityDirectory } from './infrastructure/finance-identity.js';
import { activityController } from './presentation/activity.controller.js';
import { accountabilityController } from './presentation/accountability.controller.js';
import { complianceController } from './presentation/compliance.controller.js';
import { dashboardController, notificationController } from './presentation/dashboard.controller.js';
import { adminController } from './presentation/admin.controller.js';
import { personController } from './presentation/person.controller.js';
import { activityRoutes, reportRoutes } from './presentation/activity.routes.js';
import { accountabilityRoutes } from './presentation/accountability.routes.js';
import { complianceRoutes } from './presentation/compliance.routes.js';
import { dashboardRoutes, notificationRoutes } from './presentation/dashboard.routes.js';
import { adminRoutes } from './presentation/admin.routes.js';
import { personRoutes } from './presentation/person.routes.js';
import { requireAuth } from './presentation/auth.middleware.js';
import { errorHandler, notFound } from './presentation/errorHandler.js';
import { AdminUserService } from './application/admin/admin-user.service.js';

export function createApp() {
  const repo = new PrismaActivityRepository();
  const files = new LocalFileStore();
  const accFiles = new LocalFileStore(
    path.resolve(process.cwd(), config.uploadDir, 'accountability'),
    '/uploads/accountability',
  );
  const personRepo = new PrismaPersonRepository();
  const identityLookup = new PrismaIdentityLookup();
  const personService = new PersonService(personRepo, identityLookup);
  const service = new ActivityService(repo, files, personService);
  const notifications = new NotificationService();
  const accRepo = new PrismaAccountabilityRepository();
  const accService = new AccountabilityService(accRepo, repo, accFiles, identityLookup, personService, notifications);
  const reports = new ActivityReportQueries(repo);
  const controller = activityController(service, reports);
  const accController = accountabilityController(accService);
  const compliance = new ComplianceService(new PrismaComplianceReadPort());
  const compController = complianceController(compliance);
  const peopleController = personController(personService, compliance);
  const identity = new FinanceIdentityDirectory();
  const dashboard = new DashboardService(service, accService, compliance, notifications);
  const dashController = dashboardController(dashboard);
  const notifController = notificationController(notifications);
  const adminService = new AdminUserService(identity);
  const admController = adminController(adminService);

  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use('/uploads', express.static(path.resolve(process.cwd(), config.uploadDir)));
  app.get('/health', (_req, res) =>
    res.json({ status: 'ok', service: 'ams-activity', timestamp: new Date().toISOString() }),
  );

  const auth = requireAuth(identity);
  app.use('/api/v1/activities', auth, activityRoutes(controller));
  app.use('/api/v1/reports', auth, reportRoutes(controller));
  app.use('/api/v1/accountabilities', auth, accountabilityRoutes(accController));
  app.use('/api/v1/compliance', auth, complianceRoutes(compController));
  app.use('/api/v1/persons', auth, personRoutes(peopleController));
  app.use('/api/v1/dashboard', auth, dashboardRoutes(dashController));
  app.use('/api/v1/notifications', auth, notificationRoutes(notifController));
  app.use('/api/v1/admin', auth, adminRoutes(admController));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
