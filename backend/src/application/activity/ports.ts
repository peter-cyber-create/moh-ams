import type { ActivityAggregate, ActivityRecord, DocumentRow, EventRow, ParticipantRow } from '../../domain/activity/types.js';
import type { ParticipantRecord } from '../../domain/activity/participants.js';

export type ListFilters = {
  search?: string;
  status?: string;
  funder?: string;
  createdById?: string;
  excludeDrafts?: boolean;
  missingReport?: boolean;
  year?: number;
  page?: number;
  limit?: number;
  sort?: 'createdAt' | 'activityDate' | 'title';
  order?: 'asc' | 'desc';
};

export type ActivityCountStats = {
  total: number;
  thisMonth: number;
  ongoing: number;
  upcoming: number;
  reportsPending: number;
  reportsSubmitted: number;
  recentlyClosed: number;
};

export type ActivityCountFilters = {
  year: number;
  month?: number;
  createdById?: string;
  now?: Date;
};

export type CreateActivityInput = {
  title: string;
  description?: string | null;
  requestedBy?: string | null;
  location?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  activityDate?: Date | null;
  endDate?: Date | null;
  budgetAmount: number;
  funder?: string | null;
  referenceNumber?: string | null;
  activityType?: string | null;
  days?: number | null;
  status: string;
  createdById: string;
  participants?: ParticipantRecord[];
};

export type UpdateActivityInput = Partial<Omit<CreateActivityInput, 'createdById' | 'status' | 'participants'>> & {
  status?: string;
  participants?: ParticipantRecord[] | null;
};

export type ActivityRepository = {
  list(filters: ListFilters): Promise<{ data: ActivityAggregate[]; total: number; page: number; limit: number }>;
  countStats(filters: ActivityCountFilters): Promise<ActivityCountStats>;
  getById(id: string): Promise<ActivityAggregate | null>;
  create(input: CreateActivityInput): Promise<ActivityAggregate>;
  update(id: string, input: UpdateActivityInput): Promise<ActivityAggregate>;
  delete(id: string): Promise<void>;
  replaceParticipants(id: string, participants: ParticipantRecord[]): Promise<ActivityAggregate>;
  addDocument(id: string, doc: Omit<DocumentRow, 'id' | 'activityId' | 'createdAt'> & { createdAt?: Date }): Promise<ActivityAggregate>;
  addEvent(event: Omit<EventRow, 'id' | 'createdAt'> & { createdAt?: Date }): Promise<EventRow>;
  timeline(id: string): Promise<EventRow[]>;
  allParticipants(): Promise<
    (ParticipantRow & {
      activityTitle: string;
      activityDate: Date | null;
      endDate: Date | null;
      activityDays: number | null;
      activityStatus: string;
      departmentName: string | null;
      funder: string | null;
      referenceNumber: string | null;
    })[]
  >;
};

export type FileStore = {
  save(file: { originalname: string; mimetype?: string; size?: number; buffer?: Buffer; path?: string }): Promise<{
    storedPath: string;
    originalName: string;
    mimeType: string | null;
    sizeBytes: number | null;
  }>;
};

export type { ActivityRecord };
