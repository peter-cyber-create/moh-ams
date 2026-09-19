import type { PersonEventRow, PersonIdentityStatus, PersonRecord } from '../../domain/person/types.js';
import type { PersonResolution } from '../../domain/person/matching.js';

export type ParticipantIdentityInput = {
  name: string;
  phone?: string | null;
  title?: string | null;
  organisation?: string | null;
  email?: string | null;
  personId?: string | null;
};

export type PersonResolveResult = {
  person: PersonRecord;
  resolution: PersonResolution;
};

export type PersonListFilters = {
  search?: string;
  personReference?: string;
  phone?: string;
  email?: string;
  organisation?: string;
  department?: string;
  status?: string;
  identityStatus?: string;
  page?: number;
  limit?: number;
};

export type QualitySample = {
  id: string;
  label: string;
  detail?: string | null;
};

export type QualitySnapshot = {
  counts: {
    peopleWithoutPhone: number;
    duplicatePhoneCandidates: number;
    participantsWithoutPerson: number;
    identityUsersWithoutPerson: number;
    legacyDurationRecords: number;
    activitiesMissingEndDate: number;
    crossYearActivities: number;
    nameOnlyParticipants: number;
  };
  samples: {
    peopleWithoutPhone: QualitySample[];
    duplicatePhoneCandidates: QualitySample[];
    participantsWithoutPerson: QualitySample[];
    identityUsersWithoutPerson: QualitySample[];
    legacyDurationRecords: QualitySample[];
    activitiesMissingEndDate: QualitySample[];
    crossYearActivities: QualitySample[];
    nameOnlyParticipants: QualitySample[];
  };
};

export type LinkedParticipant = {
  id: string;
  activityId: string;
  personId: string | null;
  name: string;
  phone: string | null;
};

export type CreatePersonInput = {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  organisation?: string | null;
  title?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  identityStatus?: PersonIdentityStatus;
  identityUserId?: string | null;
};

export type PersonRepository = {
  nextReference(): Promise<string>;
  create(input: CreatePersonInput & { personReference: string }): Promise<PersonRecord>;
  update(
    id: string,
    patch: Partial<Omit<CreatePersonInput, 'identityUserId'>> & { identityUserId?: string | null; status?: string },
  ): Promise<PersonRecord>;
  getById(id: string): Promise<PersonRecord | null>;
  getByReference(reference: string): Promise<PersonRecord | null>;
  getByIdentityUserId(userId: string): Promise<PersonRecord | null>;
  findByPhoneNormalized(phoneNormalized: string): Promise<PersonRecord[]>;
  findByEmail(email: string): Promise<PersonRecord[]>;
  nameExists(normalizedName: string, excludeId?: string): Promise<boolean>;
  list(filters: PersonListFilters): Promise<{ data: PersonRecord[]; total: number; page: number; limit: number }>;
  addEvent(event: {
    personId: string;
    action: string;
    summary?: string | null;
    meta?: unknown;
    actorUserId?: string | null;
  }): Promise<PersonEventRow>;
  listEvents(personId: string): Promise<PersonEventRow[]>;
  getParticipant(participantId: string): Promise<LinkedParticipant | null>;
  setParticipantPerson(participantId: string, personId: string): Promise<LinkedParticipant>;
  qualitySnapshot(): Promise<QualitySnapshot>;
};

export type IdentityUserLookup = {
  getById(id: string): Promise<{
    id: string;
    name: string;
    email: string;
    departmentId?: string | null;
    departmentName?: string | null;
  } | null>;
};
