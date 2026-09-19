import type { DurationProvenance } from '../../domain/compliance/participation.js';

export type ParticipationSourceRow = {
  personId: string | null;
  name: string;
  phone: string | null;
  title: string | null;
  activityId: string;
  activityTitle: string;
  activityStatus: string;
  activityDate: Date | null;
  endDate: Date | null;
  activityDays: number | null;
  departmentName: string | null;
  referenceNumber: string | null;
};

export type AccountabilitySourceRow = {
  id: string;
  referenceNumber: string;
  status: string;
  dueDate: Date;
  submittedById: string;
  personId: string | null;
  activityId: string;
  activityTitle: string;
};

export type IdentityPerson = {
  id: string;
  name: string;
  email: string;
  departmentName: string | null;
};

export type DirectoryPerson = {
  id: string;
  personReference: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  organisation: string | null;
  title: string | null;
  departmentName: string | null;
  identityStatus: string;
  identityUserId: string | null;
  phoneNormalized?: string | null;
};

export type ComplianceReadPort = {
  participationRows(year: number): Promise<ParticipationSourceRow[]>;
  accountabilityRows(): Promise<AccountabilitySourceRow[]>;
  identityPeople(ids: string[]): Promise<IdentityPerson[]>;
  directoryPeople(ids: string[]): Promise<DirectoryPerson[]>;
  findPeopleByPhoneNormalized(phoneNormalized: string): Promise<DirectoryPerson[]>;
};

export type ComplianceListFilters = {
  year?: number;
  month?: number;
  search?: string;
  department?: string;
  participationStatus?: string;
  accountabilityStatus?: string;
  overdue?: boolean;
  exceeded?: boolean;
  earlyWarning?: boolean;
  monthlyExceeded?: boolean;
  monthlyLimit?: boolean;
  overlap?: boolean;
  page?: number;
  limit?: number;
};

export type PreviewParticipantInput = {
  name?: string;
  phone?: string | null;
  title?: string | null;
  personId?: string | null;
};

export type CompliancePreviewInput = {
  title?: string;
  activityDate?: string | Date | null;
  endDate?: string | Date | null;
  participants?: PreviewParticipantInput[];
  excludeActivityId?: string | null;
  year?: number;
};

export type { DurationProvenance };
