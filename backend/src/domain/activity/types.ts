export type ActivityRecord = {
  id: string;
  financeActivityId: string | null;
  title: string;
  description: string | null;
  requestedBy: string | null;
  location: string | null;
  departmentId: string | null;
  departmentName: string | null;
  activityDate: Date | null;
  endDate: Date | null;
  budgetAmount: number;
  funder: string | null;
  referenceNumber: string | null;
  activityType: string | null;
  days: number | null;
  status: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ParticipantRow = {
  id: string;
  activityId: string;
  personId?: string | null;
  name: string;
  title: string | null;
  phone: string | null;
  amount: number;
  days: number;
  sortOrder: number;
};

export type DocumentRow = {
  id: string;
  activityId: string;
  kind: string;
  storedPath: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedById: string | null;
  createdAt: Date;
};

export type EventRow = {
  id: string;
  activityId: string;
  action: string;
  summary: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  meta: unknown;
  actorUserId: string | null;
  createdAt: Date;
};

export type ActivityAggregate = ActivityRecord & {
  participants: ParticipantRow[];
  documents: DocumentRow[];
};
