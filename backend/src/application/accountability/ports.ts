import type { Actor } from '../../domain/activity/permissions.js';
import type { ActivityAggregate } from '../../domain/activity/types.js';

export type AccLineRow = {
  id: string;
  accountabilityId: string;
  kind: string;
  description: string;
  amount: number;
  sortOrder: number;
};

export type AccDocumentRow = {
  id: string;
  accountabilityId: string;
  kind: string;
  storedPath: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedById: string | null;
  createdAt: Date;
};

export type AccEventRow = {
  id: string;
  accountabilityId: string;
  action: string;
  summary: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  meta: unknown;
  actorUserId: string | null;
  createdAt: Date;
};

export type AccClarificationRow = {
  id: string;
  accountabilityId: string;
  question: string;
  requestedById: string;
  requestedAt: Date;
  response: string | null;
  respondedById: string | null;
  respondedAt: Date | null;
  status: string;
};

export type AccCommentRow = {
  id: string;
  accountabilityId: string;
  kind: string;
  body: string;
  actorUserId: string;
  createdAt: Date;
};

export type AccountabilityRecord = {
  id: string;
  referenceNumber: string;
  activityId: string;
  personId: string | null;
  status: string;
  currency: string;
  amountAdvanced: number;
  amountReturned: number;
  dueDate: Date;
  submittedById: string;
  submittedAt: Date | null;
  reviewerId: string | null;
  assignedAt: Date | null;
  assignedById: string | null;
  reviewedAt: Date | null;
  approvedAt: Date | null;
  approvedById: string | null;
  rejectedAt: Date | null;
  rejectedById: string | null;
  rejectionReason: string | null;
  closedAt: Date | null;
  closedById: string | null;
  closureReason: string | null;
  returnReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  activityTitle: string;
  activityDepartmentName: string | null;
  activityCreatedById: string;
  activityHasReport: boolean;
  lines: AccLineRow[];
  documents: AccDocumentRow[];
  clarifications: AccClarificationRow[];
  comments: AccCommentRow[];
};

export type AccListFilters = {
  view?: string;
  status?: string;
  search?: string;
  activityId?: string;
  reviewerId?: string;
  submittedById?: string;
  department?: string;
  overdue?: boolean;
  page?: number;
  limit?: number;
  sort?: 'createdAt' | 'dueDate' | 'referenceNumber';
  order?: 'asc' | 'desc';
  actor?: Actor;
};

export type AccFinancialTotals = {
  amountAdvanced: number;
  amountAccounted: number;
  amountReturned: number;
  outstanding: number;
  variance: number;
};

export type AccountabilityRepository = {
  nextReference(year: number): Promise<string>;
  list(filters: AccListFilters): Promise<{ data: AccountabilityRecord[]; total: number; page: number; limit: number }>;
  financialTotals(filters: { actor?: Actor }): Promise<AccFinancialTotals>;
  getById(id: string): Promise<AccountabilityRecord | null>;
  findOpenByActivity(activityId: string): Promise<AccountabilityRecord | null>;
  create(input: {
    referenceNumber: string;
    activityId: string;
    status: string;
    amountAdvanced: number;
    amountReturned: number;
    dueDate: Date;
    submittedById: string;
    personId?: string | null;
    lines: { kind: string; description: string; amount: number }[];
  }): Promise<AccountabilityRecord>;
  update(id: string, patch: Partial<{
    status: string;
    amountReturned: number;
    dueDate: Date;
    submittedAt: Date | null;
    reviewerId: string | null;
    assignedAt: Date | null;
    assignedById: string | null;
    reviewedAt: Date | null;
    approvedAt: Date | null;
    approvedById: string | null;
    rejectedAt: Date | null;
    rejectedById: string | null;
    rejectionReason: string | null;
    closedAt: Date | null;
    closedById: string | null;
    closureReason: string | null;
    returnReason: string | null;
    lines: { kind: string; description: string; amount: number }[];
  }>): Promise<AccountabilityRecord>;
  addDocument(id: string, doc: Omit<AccDocumentRow, 'id' | 'accountabilityId' | 'createdAt'>): Promise<AccountabilityRecord>;
  addEvent(event: Omit<AccEventRow, 'id' | 'createdAt'>): Promise<AccEventRow>;
  timeline(id: string): Promise<AccEventRow[]>;
  addComment(comment: Omit<AccCommentRow, 'id' | 'createdAt'>): Promise<AccCommentRow>;
  addClarification(row: Omit<AccClarificationRow, 'id' | 'requestedAt' | 'response' | 'respondedById' | 'respondedAt' | 'status'> & { question: string }): Promise<AccClarificationRow>;
  respondClarification(id: string, clarificationId: string, response: string, actorId: string): Promise<AccClarificationRow>;
};

export type ActivityLookup = {
  getById(id: string): Promise<ActivityAggregate | null>;
};

export type IdentityLookup = {
  getById(id: string): Promise<Actor | null>;
  listReviewers(): Promise<Actor[]>;
};
