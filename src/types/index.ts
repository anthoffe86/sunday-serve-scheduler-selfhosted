export type Role = 
  | 'sidesman-standard'
  | 'sidesman-sound'
  | 'sidesman-welcome'
  | 'reader'
  | 'intercessions'
  | 'collection';

export interface Volunteer {
  id: string;
  name: string;
  email: string;
  active: boolean;
  rolePreferences: Role[];
  familyGroupId?: string;
  serviceHistory: ServiceRecord[];
  avatarUrl?: string;
}

export interface ServiceRecord {
  date: string;
  role: Role;
}

export interface Availability {
  volunteerId: string;
  date: string;
  available: boolean;
}

export interface Assignment {
  role: Role;
  volunteerId: string;
  volunteerName: string;
}

export interface SundayService {
  date: string;
  assignments: Assignment[];
  status: 'draft' | 'published';
}

export interface SwapRequest {
  id: string;
  date: string;
  role: Role;
  fromVolunteerId: string;
  fromVolunteerName: string;
  toVolunteerId?: string;
  toVolunteerName?: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  'sidesman-standard': 'Sidesman',
  'sidesman-sound': 'Sidesman (Sound)',
  'sidesman-welcome': 'Sidesman (Welcome)',
  'reader': 'Reader',
  'intercessions': 'Intercessions',
  'collection': 'Collection Count',
};

export const ROLE_COLORS: Record<Role, string> = {
  'sidesman-standard': 'bg-role-sidesman',
  'sidesman-sound': 'bg-role-sidesman',
  'sidesman-welcome': 'bg-role-sidesman',
  'reader': 'bg-role-reader',
  'intercessions': 'bg-role-intercessions',
  'collection': 'bg-role-collection',
};

export const ROLES_PER_SUNDAY: { role: Role; count: number }[] = [
  { role: 'sidesman-standard', count: 2 },
  { role: 'sidesman-sound', count: 1 },
  { role: 'sidesman-welcome', count: 1 },
  { role: 'reader', count: 1 },
  { role: 'intercessions', count: 1 },
  { role: 'collection', count: 2 },
];
