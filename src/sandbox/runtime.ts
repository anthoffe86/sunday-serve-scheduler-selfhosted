import { addWeeks, format, nextSunday, subWeeks } from 'date-fns';
import type { User } from '@supabase/supabase-js';

export type SandboxRole = 'admin' | 'volunteer';

type AssignmentStatus = 'proposed' | 'invited' | 'confirmed' | 'declined';

type EventStatus = 'draft' | 'published' | 'cancelled';

type SwapStatus = 'pending' | 'approved' | 'denied';

interface SandboxProfile {
  id: string;
  user_id: string;
  org_id: string;
  name: string;
  email: string;
  active: boolean;
  family_group_id: string | null;
  created_at: string;
  updated_at: string;
}

interface SandboxUserRole {
  user_id: string;
  role: SandboxRole;
  org_id: string;
}

interface SandboxRolePreference {
  id: string;
  user_id: string;
  role: string;
  preference_order: number;
}

interface SandboxAvailability {
  id: string;
  user_id: string;
  date: string;
  available: boolean;
  notes: string | null;
}

interface SandboxEventTemplate {
  id: string;
  name: string;
  description: string | null;
  day_of_week: number;
  start_time: string;
  is_recurring: boolean;
  recurrence_end_type: 'indefinite' | 'date' | 'count' | null;
  recurrence_end_date: string | null;
  recurrence_count: number | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface SandboxEventTemplateRole {
  id: string;
  template_id: string;
  role: string;
  quantity: number;
  created_at: string;
}

interface SandboxEvent {
  id: string;
  template_id: string | null;
  name: string;
  subheading: string | null;
  date: string;
  start_time: string;
  status: EventStatus;
  notes: string | null;
  reading: string | null;
  created_at: string;
  updated_at: string;
}

interface SandboxEventRole {
  id: string;
  event_id: string;
  role: string;
  quantity: number;
  created_at: string;
}

interface SandboxEventAssignment {
  id: string;
  org_id: string;
  event_id: string;
  role: string;
  volunteer_id: string;
  status: AssignmentStatus;
  invited_at: string | null;
  responded_at: string | null;
  decline_reason: string | null;
  invitation_token: string | null;
  created_at: string;
  updated_at: string;
}

interface SandboxSwapRequest {
  id: string;
  event_assignment_id: string | null;
  assignment_id: string | null;
  from_user_id: string;
  to_user_id: string | null;
  offered_assignment_id: string | null;
  status: SwapStatus;
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SandboxNotificationSettings {
  key: string;
  enabled: boolean;
}

interface SandboxSystemSetting {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

interface SandboxState {
  version: number;
  orgId: string;
  currentUserId: string;
  profiles: SandboxProfile[];
  userRoles: SandboxUserRole[];
  rolePreferences: SandboxRolePreference[];
  availability: SandboxAvailability[];
  eventTemplates: SandboxEventTemplate[];
  eventTemplateRoles: SandboxEventTemplateRole[];
  events: SandboxEvent[];
  eventRoles: SandboxEventRole[];
  eventAssignments: SandboxEventAssignment[];
  swapRequests: SandboxSwapRequest[];
  notificationSettings: SandboxNotificationSettings[];
  systemSettings: SandboxSystemSetting[];
  assignmentPickCounter: number;
}

const STORAGE_KEY = 'serveTogether.sandbox.v1';
const STATE_VERSION = 1;

const listeners = new Set<() => void>();

const nowIso = () => new Date().toISOString();
const nowDate = () => format(new Date(), 'yyyy-MM-dd');

const DEFAULT_ROLES = [
  { role: 'sidesman-standard', quantity: 2 },
  { role: 'sidesman-sound', quantity: 1 },
  { role: 'sidesman-welcome', quantity: 1 },
  { role: 'reader', quantity: 1 },
  { role: 'intercessions', quantity: 1 },
  { role: 'collection', quantity: 2 },
];

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildSeed(): SandboxState {
  const createdAt = nowIso();
  const orgId = 'sandbox-org';

  const users = [
    { id: 'sbx_admin', name: 'Alex Admin', email: 'admin@sandbox.local', role: 'admin' as SandboxRole },
    { id: 'sbx_vol_1', name: 'Jordan Bell', email: 'jordan@sandbox.local', role: 'volunteer' as SandboxRole },
    { id: 'sbx_vol_2', name: 'Riley Stone', email: 'riley@sandbox.local', role: 'volunteer' as SandboxRole },
    { id: 'sbx_vol_3', name: 'Morgan Lee', email: 'morgan@sandbox.local', role: 'volunteer' as SandboxRole },
    { id: 'sbx_vol_4', name: 'Casey Brooks', email: 'casey@sandbox.local', role: 'volunteer' as SandboxRole },
    { id: 'sbx_vol_5', name: 'Taylor Woods', email: 'taylor@sandbox.local', role: 'volunteer' as SandboxRole },
    { id: 'sbx_vol_6', name: 'Quinn Harper', email: 'quinn@sandbox.local', role: 'volunteer' as SandboxRole },
    { id: 'sbx_vol_7', name: 'Avery Hart', email: 'avery@sandbox.local', role: 'volunteer' as SandboxRole },
    { id: 'sbx_vol_8', name: 'Skyler King', email: 'skyler@sandbox.local', role: 'volunteer' as SandboxRole },
  ];

  const profiles: SandboxProfile[] = users.map((u) => ({
    id: makeId('profile'),
    user_id: u.id,
    org_id: orgId,
    name: u.name,
    email: u.email,
    active: true,
    family_group_id: null,
    created_at: createdAt,
    updated_at: createdAt,
  }));

  const rolePreferences: SandboxRolePreference[] = [];
  const preferenceLayouts: Record<string, string[]> = {
    sbx_vol_1: ['reader', 'intercessions', 'collection'],
    sbx_vol_2: ['sidesman-sound', 'sidesman-standard', 'collection'],
    sbx_vol_3: ['sidesman-welcome', 'reader'],
    sbx_vol_4: ['collection', 'reader', 'intercessions'],
    sbx_vol_5: ['sidesman-standard', 'sidesman-welcome'],
    sbx_vol_6: ['intercessions', 'reader'],
    sbx_vol_7: ['collection', 'sidesman-standard'],
    // sbx_vol_8 intentionally has no preferences, which should mean all roles are valid.
  };

  Object.entries(preferenceLayouts).forEach(([userId, roles]) => {
    roles.forEach((role, index) => {
      rolePreferences.push({
        id: makeId('pref'),
        user_id: userId,
        role,
        preference_order: index + 1,
      });
    });
  });

  const templateId = makeId('template');
  const eventTemplates: SandboxEventTemplate[] = [
    {
      id: templateId,
      name: 'Sunday Morning Service',
      description: 'Main weekly Sunday service',
      day_of_week: 0,
      start_time: '10:00:00',
      is_recurring: true,
      recurrence_end_type: 'count',
      recurrence_end_date: null,
      recurrence_count: 10,
      active: true,
      created_by: 'sbx_admin',
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];

  const eventTemplateRoles: SandboxEventTemplateRole[] = DEFAULT_ROLES.map((r) => ({
    id: makeId('template_role'),
    template_id: templateId,
    role: r.role,
    quantity: r.quantity,
    created_at: createdAt,
  }));

  const start = nextSunday(new Date());
  const events: SandboxEvent[] = [];
  const eventRoles: SandboxEventRole[] = [];
  const eventAssignments: SandboxEventAssignment[] = [];

  for (let i = -2; i < 8; i += 1) {
    const serviceDate = format(addWeeks(start, i), 'yyyy-MM-dd');
    const eventId = makeId('event');
    const status: EventStatus = i < 0 ? 'published' : 'draft';

    events.push({
      id: eventId,
      template_id: templateId,
      name: 'Sunday Morning Service',
      subheading: i < 0 ? 'Published service' : 'Upcoming service',
      date: serviceDate,
      start_time: '10:00:00',
      status,
      notes: null,
      reading: null,
      created_at: createdAt,
      updated_at: createdAt,
    });

    DEFAULT_ROLES.forEach((r) => {
      eventRoles.push({
        id: makeId('event_role'),
        event_id: eventId,
        role: r.role,
        quantity: r.quantity,
        created_at: createdAt,
      });
    });
  }

  const publishedEvents = events.filter((e) => e.status === 'published');
  const volunteerIds = users.filter((u) => u.role === 'volunteer').map((u) => u.id);
  let pick = 0;

  publishedEvents.forEach((event) => {
    const rolesForEvent = eventRoles.filter((r) => r.event_id === event.id);
    rolesForEvent.forEach((r) => {
      for (let i = 0; i < r.quantity; i += 1) {
        const volunteerId = volunteerIds[pick % volunteerIds.length];
        pick += 1;
        eventAssignments.push({
          id: makeId('assignment'),
          org_id: orgId,
          event_id: event.id,
          role: r.role,
          volunteer_id: volunteerId,
          status: 'confirmed',
          invited_at: createdAt,
          responded_at: createdAt,
          decline_reason: null,
          invitation_token: makeId('inv'),
          created_at: createdAt,
          updated_at: createdAt,
        });
      }
    });
  });

  const firstUpcoming = events.find((e) => e.status === 'draft');
  const availability: SandboxAvailability[] = firstUpcoming
    ? [
        {
          id: makeId('availability'),
          user_id: 'sbx_vol_2',
          date: firstUpcoming.date,
          available: false,
          notes: 'Traveling',
        },
        {
          id: makeId('availability'),
          user_id: 'sbx_vol_5',
          date: firstUpcoming.date,
          available: false,
          notes: 'Out of town',
        },
      ]
    : [];

  const userRoles = users.map((u) => ({
    user_id: u.id,
    role: u.role,
    org_id: orgId,
  }));

  const systemSettings: SandboxSystemSetting[] = [
    {
      key: 'organisation_name',
      value: 'ServeTogether Demo Church',
      description: 'Public organization name',
      updated_at: createdAt,
    },
    {
      key: 'organisation_short_name',
      value: 'SD',
      description: 'Public organization short name',
      updated_at: createdAt,
    },
  ];

  const notificationSettings: SandboxNotificationSettings[] = [
    'email_on_invite',
    'email_on_invitation_send',
    'email_on_publish',
    'email_on_swap_request',
    'email_on_assignment_add',
    'email_on_assignment_remove',
  ].map((key) => ({ key, enabled: true }));

  return {
    version: STATE_VERSION,
    orgId,
    currentUserId: 'sbx_admin',
    profiles,
    userRoles,
    rolePreferences,
    availability,
    eventTemplates,
    eventTemplateRoles,
    events,
    eventRoles,
    eventAssignments,
    swapRequests: [],
    notificationSettings,
    systemSettings,
    assignmentPickCounter: 0,
  };
}

function loadState(): SandboxState {
  if (typeof window === 'undefined') {
    return buildSeed();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return buildSeed();
  }

  try {
    const parsed = JSON.parse(raw) as SandboxState;
    if (parsed.version !== STATE_VERSION) {
      return buildSeed();
    }
    return parsed;
  } catch {
    return buildSeed();
  }
}

let state = loadState();

function persist() {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

function notify() {
  persist();
  listeners.forEach((listener) => listener());
}

function mutate(updater: (draft: SandboxState) => void) {
  const draft = structuredClone(state) as SandboxState;
  updater(draft);
  state = draft;
  notify();
}

function getProfileName(userId: string): string {
  return state.profiles.find((p) => p.user_id === userId)?.name || 'Unknown';
}

function getProfileEmail(userId: string): string {
  return state.profiles.find((p) => p.user_id === userId)?.email || '';
}

function getVolunteerIds(): string[] {
  return state.userRoles
    .filter((r) => r.role === 'volunteer')
    .map((r) => r.user_id)
    .filter((id) => state.profiles.some((p) => p.user_id === id && p.active));
}

function isUnavailable(userId: string, date: string): boolean {
  const row = state.availability.find((a) => a.user_id === userId && a.date === date);
  return row?.available === false;
}

function nextPick(candidates: string[]): string | null {
  if (candidates.length === 0) {
    return null;
  }

  const assignmentCounts = new Map<string, number>();
  getVolunteerIds().forEach((id) => assignmentCounts.set(id, 0));

  state.eventAssignments.forEach((a) => {
    if (a.status !== 'declined') {
      assignmentCounts.set(a.volunteer_id, (assignmentCounts.get(a.volunteer_id) || 0) + 1);
    }
  });

  const sorted = [...candidates].sort((a, b) => {
    const countDiff = (assignmentCounts.get(a) || 0) - (assignmentCounts.get(b) || 0);
    if (countDiff !== 0) {
      return countDiff;
    }

    const aName = getProfileName(a);
    const bName = getProfileName(b);
    return aName.localeCompare(bName);
  });

  const pickIndex = state.assignmentPickCounter % sorted.length;
  return sorted[pickIndex] ?? null;
}

function userHasRolePreference(userId: string, role: string): boolean {
  const prefs = state.rolePreferences
    .filter((p) => p.user_id === userId)
    .sort((a, b) => a.preference_order - b.preference_order);

  if (prefs.length === 0) {
    return true;
  }

  return prefs.some((p) => p.role === role);
}

function createInvitationToken(): string {
  return `inv_${Math.random().toString(36).slice(2, 12)}`;
}

function buildUserFromProfile(profile: SandboxProfile): User {
  return {
    id: profile.user_id,
    aud: 'authenticated',
    role: 'authenticated',
    email: profile.email,
    email_confirmed_at: nowIso(),
    phone: '',
    confirmed_at: nowIso(),
    last_sign_in_at: nowIso(),
    app_metadata: {},
    user_metadata: { name: profile.name },
    identities: [],
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    is_anonymous: false,
  };
}

export function subscribeSandboxState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetSandboxState() {
  state = buildSeed();
  notify();
}

export function getSandboxState() {
  return structuredClone(state) as SandboxState;
}

export function getSandboxPersonas() {
  return state.userRoles.map((role) => ({
    userId: role.user_id,
    name: getProfileName(role.user_id),
    email: getProfileEmail(role.user_id),
    role: role.role,
  }));
}

export function setSandboxPersona(userId: string) {
  if (!state.userRoles.some((r) => r.user_id === userId)) {
    return;
  }
  mutate((draft) => {
    draft.currentUserId = userId;
  });
}

export function getSandboxAuthContext() {
  const roleRow = state.userRoles.find((r) => r.user_id === state.currentUserId);
  const profile = state.profiles.find((p) => p.user_id === state.currentUserId);

  if (!roleRow || !profile) {
    const firstAdmin = state.userRoles.find((r) => r.role === 'admin');
    if (firstAdmin) {
      setSandboxPersona(firstAdmin.user_id);
      return getSandboxAuthContext();
    }
    return {
      user: null,
      isAdmin: false,
      isSuperAdmin: false,
      orgId: state.orgId,
    };
  }

  return {
    user: buildUserFromProfile(profile),
    isAdmin: roleRow.role === 'admin',
    isSuperAdmin: false,
    orgId: roleRow.org_id,
  };
}

export async function sandboxSignIn(email: string): Promise<{ error: Error | null }> {
  const match = state.profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());
  if (!match) {
    return { error: new Error('Invalid login credentials') };
  }

  setSandboxPersona(match.user_id);
  return { error: null };
}

export async function sandboxSignUp(email: string, _password: string, name: string): Promise<{ error: Error | null }> {
  if (state.profiles.some((p) => p.email.toLowerCase() === email.toLowerCase())) {
    return { error: new Error('User already exists') };
  }

  mutate((draft) => {
    const userId = makeId('sbx_user');
    draft.profiles.push({
      id: makeId('profile'),
      user_id: userId,
      org_id: draft.orgId,
      name,
      email,
      active: true,
      family_group_id: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    draft.userRoles.push({ user_id: userId, role: 'volunteer', org_id: draft.orgId });
    draft.currentUserId = userId;
  });

  return { error: null };
}

export async function sandboxSignOut(): Promise<void> {
  const admin = state.userRoles.find((r) => r.role === 'admin');
  if (admin) {
    setSandboxPersona(admin.user_id);
  }
}

export function getPublicOrgSettings() {
  const name = state.systemSettings.find((s) => s.key === 'organisation_name')?.value;
  const shortName = state.systemSettings.find((s) => s.key === 'organisation_short_name')?.value;
  return {
    organisationName: typeof name === 'string' && name.trim() ? name : 'ServeTogether Demo Church',
    organisationShortName: typeof shortName === 'string' && shortName.trim() ? shortName : 'SD',
  };
}

export function getProfiles() {
  return [...state.profiles].sort((a, b) => a.name.localeCompare(b.name));
}

export function getProfile(userId: string) {
  return state.profiles.find((p) => p.user_id === userId) ?? null;
}

export function updateProfile(userId: string, updates: Partial<SandboxProfile>) {
  mutate((draft) => {
    const profile = draft.profiles.find((p) => p.user_id === userId);
    if (!profile) return;
    Object.assign(profile, updates);
    profile.updated_at = nowIso();
  });
  return getProfile(userId);
}

export function getRolePreferences(userId: string) {
  return state.rolePreferences
    .filter((p) => p.user_id === userId)
    .sort((a, b) => a.preference_order - b.preference_order);
}

export function setRolePreferences(userId: string, preferences: { role: string; preference_order: number }[]) {
  mutate((draft) => {
    draft.rolePreferences = draft.rolePreferences.filter((p) => p.user_id !== userId);
    preferences.forEach((pref) => {
      draft.rolePreferences.push({
        id: makeId('pref'),
        user_id: userId,
        role: pref.role,
        preference_order: pref.preference_order,
      });
    });
  });
}

export function getAvailability(userId: string) {
  return state.availability.filter((a) => a.user_id === userId);
}

export function getAvailabilityForDate(date: string) {
  return state.availability.filter((a) => a.date === date);
}

export function upsertAvailability(userId: string, date: string, available: boolean, notes?: string | null) {
  mutate((draft) => {
    const existing = draft.availability.find((a) => a.user_id === userId && a.date === date);
    if (existing) {
      existing.available = available;
      existing.notes = notes ?? existing.notes;
      return;
    }

    draft.availability.push({
      id: makeId('availability'),
      user_id: userId,
      date,
      available,
      notes: notes ?? null,
    });
  });
}

export function upsertAvailabilityMany(userId: string, dates: string[], available: boolean, notes?: string) {
  mutate((draft) => {
    dates.forEach((date) => {
      const existing = draft.availability.find((a) => a.user_id === userId && a.date === date);
      if (existing) {
        existing.available = available;
        existing.notes = notes ?? existing.notes;
      } else {
        draft.availability.push({
          id: makeId('availability'),
          user_id: userId,
          date,
          available,
          notes: notes ?? null,
        });
      }
    });
  });
}

export function removeAvailability(userId: string, date: string) {
  mutate((draft) => {
    draft.availability = draft.availability.filter((a) => !(a.user_id === userId && a.date === date));
  });
}

export function updateAvailabilityNotes(userId: string, date: string, notes?: string) {
  mutate((draft) => {
    const row = draft.availability.find((a) => a.user_id === userId && a.date === date);
    if (row) {
      row.notes = notes ?? null;
    }
  });
}

export function getEventTemplates() {
  return [...state.eventTemplates]
    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
    .map((template) => ({
      ...template,
      roles: state.eventTemplateRoles.filter((role) => role.template_id === template.id),
    }));
}

export function createEventTemplate(data: {
  name: string;
  description?: string;
  day_of_week: number;
  start_time: string;
  is_recurring: boolean;
  recurrence_end_type?: 'indefinite' | 'date' | 'count';
  recurrence_end_date?: string;
  recurrence_count?: number | null;
  created_by?: string | null;
  roles: { role: string; quantity: number }[];
}) {
  const templateId = makeId('template');
  const stamp = nowIso();

  mutate((draft) => {
    draft.eventTemplates.push({
      id: templateId,
      name: data.name,
      description: data.description ?? null,
      day_of_week: data.day_of_week,
      start_time: data.start_time,
      is_recurring: data.is_recurring,
      recurrence_end_type: data.recurrence_end_type ?? null,
      recurrence_end_date: data.recurrence_end_date ?? null,
      recurrence_count: data.recurrence_count ?? null,
      active: true,
      created_by: data.created_by ?? null,
      created_at: stamp,
      updated_at: stamp,
    });

    data.roles.forEach((role) => {
      draft.eventTemplateRoles.push({
        id: makeId('template_role'),
        template_id: templateId,
        role: role.role,
        quantity: role.quantity,
        created_at: stamp,
      });
    });
  });

  return templateId;
}

export function updateEventTemplate(data: {
  id: string;
  name?: string;
  description?: string;
  day_of_week?: number;
  start_time?: string;
  is_recurring?: boolean;
  recurrence_end_type?: 'indefinite' | 'date' | 'count' | null;
  recurrence_end_date?: string | null;
  recurrence_count?: number | null;
  active?: boolean;
  roles?: { role: string; quantity: number }[];
  syncToEvents?: boolean;
}) {
  mutate((draft) => {
    const template = draft.eventTemplates.find((t) => t.id === data.id);
    if (!template) return;

    Object.assign(template, {
      ...data,
      updated_at: nowIso(),
    });

    if (data.roles) {
      draft.eventTemplateRoles = draft.eventTemplateRoles.filter((r) => r.template_id !== data.id);
      data.roles.forEach((role) => {
        draft.eventTemplateRoles.push({
          id: makeId('template_role'),
          template_id: data.id,
          role: role.role,
          quantity: role.quantity,
          created_at: nowIso(),
        });
      });

      if (data.syncToEvents !== false) {
        const today = nowDate();
        const targetEvents = draft.events.filter(
          (event) => event.template_id === data.id && event.status === 'draft' && event.date >= today
        );
        const targetEventIds = targetEvents.map((event) => event.id);

        draft.eventRoles = draft.eventRoles.filter((role) => !targetEventIds.includes(role.event_id));
        targetEventIds.forEach((eventId) => {
          data.roles?.forEach((role) => {
            draft.eventRoles.push({
              id: makeId('event_role'),
              event_id: eventId,
              role: role.role,
              quantity: role.quantity,
              created_at: nowIso(),
            });
          });
        });

        const validRoles = new Set(data.roles.map((r) => r.role));
        draft.eventAssignments = draft.eventAssignments.filter(
          (assignment) => !targetEventIds.includes(assignment.event_id) || validRoles.has(assignment.role)
        );
      }
    }
  });
}

export function deleteEventTemplate(templateId: string) {
  mutate((draft) => {
    const eventIds = draft.events.filter((event) => event.template_id === templateId).map((event) => event.id);

    draft.eventAssignments = draft.eventAssignments.filter((a) => !eventIds.includes(a.event_id));
    draft.eventRoles = draft.eventRoles.filter((r) => !eventIds.includes(r.event_id));
    draft.events = draft.events.filter((event) => event.template_id !== templateId);
    draft.eventTemplateRoles = draft.eventTemplateRoles.filter((r) => r.template_id !== templateId);
    draft.eventTemplates = draft.eventTemplates.filter((template) => template.id !== templateId);
  });
}

export function generateEvents(data: { templateId: string; startDate: string; endDate?: string; count?: number }) {
  const template = state.eventTemplates.find((t) => t.id === data.templateId);
  if (!template) {
    throw new Error('Template not found');
  }

  const templateRoles = state.eventTemplateRoles.filter((r) => r.template_id === data.templateId);
  const maxCount = data.count ?? 12;
  const endBoundary = data.endDate ?? format(addWeeks(new Date(data.startDate), maxCount), 'yyyy-MM-dd');

  const createdEventIds: string[] = [];

  mutate((draft) => {
    let cursor = new Date(data.startDate);
    while (cursor.getDay() !== template.day_of_week) {
      cursor.setDate(cursor.getDate() + 1);
    }

    while (createdEventIds.length < maxCount) {
      const date = format(cursor, 'yyyy-MM-dd');
      if (date > endBoundary) {
        break;
      }

      if (!draft.events.some((event) => event.template_id === data.templateId && event.date === date)) {
        const eventId = makeId('event');
        createdEventIds.push(eventId);

        draft.events.push({
          id: eventId,
          template_id: template.id,
          name: template.name,
          subheading: null,
          date,
          start_time: template.start_time,
          status: 'draft',
          notes: null,
          reading: null,
          created_at: nowIso(),
          updated_at: nowIso(),
        });

        templateRoles.forEach((role) => {
          draft.eventRoles.push({
            id: makeId('event_role'),
            event_id: eventId,
            role: role.role,
            quantity: role.quantity,
            created_at: nowIso(),
          });
        });
      }

      cursor = addWeeks(cursor, 1);
    }
  });

  return createdEventIds;
}

export function getEvents(options?: { startDate?: string; endDate?: string; status?: string }) {
  const profilesByUserId = new Map(state.profiles.map((p) => [p.user_id, p]));

  const events = [...state.events]
    .filter((event) => {
      if (options?.startDate && event.date < options.startDate) return false;
      if (options?.endDate && event.date > options.endDate) return false;
      if (options?.status && event.status !== options.status) return false;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
    .map((event) => ({
      ...event,
      roles: state.eventRoles.filter((role) => role.event_id === event.id),
      assignments: state.eventAssignments
        .filter((assignment) => assignment.event_id === event.id)
        .map((assignment) => ({
          ...assignment,
          volunteer_name: profilesByUserId.get(assignment.volunteer_id)?.name,
          volunteer_email: profilesByUserId.get(assignment.volunteer_id)?.email,
        })),
    }));

  return events;
}

export function updateEvent(data: {
  id: string;
  name?: string;
  subheading?: string | null;
  date?: string;
  start_time?: string;
  status?: EventStatus;
  notes?: string | null;
  reading?: string | null;
}) {
  mutate((draft) => {
    const event = draft.events.find((e) => e.id === data.id);
    if (!event) return;
    Object.assign(event, data);
    event.updated_at = nowIso();
  });
}

export function deleteEvent(eventId: string) {
  mutate((draft) => {
    draft.eventAssignments = draft.eventAssignments.filter((a) => a.event_id !== eventId);
    draft.eventRoles = draft.eventRoles.filter((r) => r.event_id !== eventId);
    draft.events = draft.events.filter((e) => e.id !== eventId);
  });
}

export function bulkDeleteEvents(eventIds: string[]) {
  mutate((draft) => {
    const targets = new Set(eventIds);
    draft.eventAssignments = draft.eventAssignments.filter((a) => !targets.has(a.event_id));
    draft.eventRoles = draft.eventRoles.filter((r) => !targets.has(r.event_id));
    draft.events = draft.events.filter((e) => !targets.has(e.id));
  });
}

export function assignVolunteer(data: { event_id: string; role: string; volunteer_id: string; status?: AssignmentStatus }) {
  const assignmentId = makeId('assignment');
  mutate((draft) => {
    draft.eventAssignments.push({
      id: assignmentId,
      org_id: draft.orgId,
      event_id: data.event_id,
      role: data.role,
      volunteer_id: data.volunteer_id,
      status: data.status ?? 'proposed',
      invited_at: null,
      responded_at: null,
      decline_reason: null,
      invitation_token: createInvitationToken(),
      created_at: nowIso(),
      updated_at: nowIso(),
    });
  });
  return assignmentId;
}

export function removeAssignment(assignmentId: string) {
  mutate((draft) => {
    draft.eventAssignments = draft.eventAssignments.filter((assignment) => assignment.id !== assignmentId);
  });
}

export function batchUpdateAssignments(data: {
  eventId: string;
  toAdd: { role: string; volunteer_id: string }[];
  toRemove: string[];
  eventStatus?: string;
}) {
  mutate((draft) => {
    const removeSet = new Set(data.toRemove);
    draft.eventAssignments = draft.eventAssignments.filter((a) => !removeSet.has(a.id));

    const status: AssignmentStatus = data.eventStatus === 'published' ? 'confirmed' : 'proposed';
    data.toAdd.forEach((item) => {
      draft.eventAssignments.push({
        id: makeId('assignment'),
        org_id: draft.orgId,
        event_id: data.eventId,
        role: item.role,
        volunteer_id: item.volunteer_id,
        status,
        invited_at: null,
        responded_at: null,
        decline_reason: null,
        invitation_token: createInvitationToken(),
        created_at: nowIso(),
        updated_at: nowIso(),
      });
    });
  });
}

export function bulkUpdateEventStatus(eventIds: string[], status: EventStatus) {
  mutate((draft) => {
    const targets = new Set(eventIds);
    draft.events.forEach((event) => {
      if (targets.has(event.id)) {
        event.status = status;
        event.updated_at = nowIso();
      }
    });
  });
}

export function updateEventRoles(eventId: string, roles: { role: string; quantity: number }[]) {
  mutate((draft) => {
    draft.eventRoles = draft.eventRoles.filter((r) => r.event_id !== eventId);
    roles.forEach((role) => {
      draft.eventRoles.push({
        id: makeId('event_role'),
        event_id: eventId,
        role: role.role,
        quantity: role.quantity,
        created_at: nowIso(),
      });
    });

    const validRoleSet = new Set(roles.map((r) => r.role));
    draft.eventAssignments = draft.eventAssignments.filter(
      (a) => a.event_id !== eventId || validRoleSet.has(a.role)
    );
  });
}

export function runAutoSchedule(data: { templateId?: string; eventIds?: string[] }) {
  const targetEventIds = data.eventIds
    ? data.eventIds
    : state.events
        .filter((event) => event.status === 'draft' && (!data.templateId || event.template_id === data.templateId))
        .map((event) => event.id);

  if (targetEventIds.length === 0) {
    return {
      message: 'No draft events found',
      assignments: [],
      totalEvents: 0,
      totalAssignments: 0,
    };
  }

  const created: Array<{
    event_id: string;
    event_date: string;
    role: string;
    volunteer_id: string;
    volunteer_name: string;
  }> = [];

  mutate((draft) => {
    const eventById = new Map(draft.events.map((event) => [event.id, event]));
    const volunteerIds = getVolunteerIds();

    for (const eventId of targetEventIds) {
      const event = eventById.get(eventId);
      if (!event) continue;

      const roles = draft.eventRoles.filter((r) => r.event_id === eventId);
      const existingAssignments = draft.eventAssignments.filter(
        (a) => a.event_id === eventId && a.status !== 'declined'
      );

      roles.forEach((roleReq) => {
        const already = existingAssignments.filter((assignment) => assignment.role === roleReq.role).length;
        const missing = Math.max(0, roleReq.quantity - already);

        for (let slot = 0; slot < missing; slot += 1) {
          const inEventVolunteerIds = new Set(
            draft.eventAssignments
              .filter((assignment) => assignment.event_id === eventId && assignment.status !== 'declined')
              .map((assignment) => assignment.volunteer_id)
          );

          const candidates = volunteerIds.filter((volunteerId) => {
            if (inEventVolunteerIds.has(volunteerId)) return false;
            if (isUnavailable(volunteerId, event.date)) return false;
            if (!userHasRolePreference(volunteerId, roleReq.role)) return false;
            return true;
          });

          const volunteerId = nextPick(candidates);
          if (!volunteerId) {
            continue;
          }

          draft.eventAssignments.push({
            id: makeId('assignment'),
            org_id: draft.orgId,
            event_id: eventId,
            role: roleReq.role,
            volunteer_id: volunteerId,
            status: 'proposed',
            invited_at: null,
            responded_at: null,
            decline_reason: null,
            invitation_token: createInvitationToken(),
            created_at: nowIso(),
            updated_at: nowIso(),
          });

          draft.assignmentPickCounter += 1;

          created.push({
            event_id: eventId,
            event_date: event.date,
            role: roleReq.role,
            volunteer_id: volunteerId,
            volunteer_name: getProfileName(volunteerId),
          });
        }
      });
    }
  });

  return {
    message: `Assigned ${created.length} volunteers`,
    assignments: created,
    totalEvents: targetEventIds.length,
    totalAssignments: created.length,
  };
}

export function sendInvitations(eventIds: string[]) {
  let totalAssignments = 0;

  mutate((draft) => {
    const targets = new Set(eventIds);
    draft.eventAssignments.forEach((assignment) => {
      if (!targets.has(assignment.event_id)) return;
      if (assignment.status !== 'proposed') return;

      totalAssignments += 1;
      assignment.status = 'confirmed';
      assignment.invited_at = nowIso();
      assignment.responded_at = nowIso();
      assignment.invitation_token = assignment.invitation_token || createInvitationToken();
      assignment.updated_at = nowIso();
    });
  });

  const uniqueVolunteerCount = new Set(
    state.eventAssignments
      .filter((assignment) => eventIds.includes(assignment.event_id) && assignment.responded_at)
      .map((assignment) => assignment.volunteer_id)
  ).size;

  return {
    success: true,
    emailsSent: 0,
    totalVolunteers: uniqueVolunteerCount,
    totalAssignments,
    sandboxAutoAccepted: totalAssignments,
  };
}

export function getPendingInvitations(userId: string) {
  const assignments = state.eventAssignments
    .filter((assignment) => assignment.volunteer_id === userId && assignment.status === 'invited')
    .map((assignment) => {
      const event = state.events.find((e) => e.id === assignment.event_id);
      if (!event) return null;
      return { assignment, event };
    })
    .filter((item): item is { assignment: SandboxEventAssignment; event: SandboxEvent } => item !== null)
    .sort((a, b) => a.event.date.localeCompare(b.event.date));

  return assignments;
}

export function respondToInvitation(data: { token: string; action: 'accept' | 'decline'; declineReason?: string }) {
  let updated = 0;

  mutate((draft) => {
    const assignment = draft.eventAssignments.find((a) => a.invitation_token === data.token);
    if (!assignment) {
      return;
    }

    assignment.status = data.action === 'accept' ? 'confirmed' : 'declined';
    assignment.responded_at = nowIso();
    assignment.decline_reason = data.action === 'decline' ? data.declineReason ?? null : null;
    assignment.updated_at = nowIso();
    updated += 1;
  });

  if (updated === 0) {
    throw new Error('Invitation not found');
  }

  return {
    success: true,
    message: data.action === 'accept' ? 'Invitation accepted' : 'Invitation declined',
    successCount: updated,
    failCount: 0,
  };
}

export function getSwapRequests() {
  const assignments = state.eventAssignments;
  const eventsById = new Map(state.events.map((e) => [e.id, e]));

  return state.swapRequests
    .map((swap) => {
      const assignment = assignments.find((a) => a.id === swap.event_assignment_id);
      if (!assignment) return null;
      const event = eventsById.get(assignment.event_id);
      if (!event) return null;

      const offeredAssignment = swap.offered_assignment_id
        ? assignments.find((a) => a.id === swap.offered_assignment_id)
        : null;
      const offeredEvent = offeredAssignment ? eventsById.get(offeredAssignment.event_id) : null;

      return {
        ...swap,
        from_user_name: getProfileName(swap.from_user_id),
        from_user_email: getProfileEmail(swap.from_user_id),
        to_user_name: swap.to_user_id ? getProfileName(swap.to_user_id) : undefined,
        event_name: event.name,
        event_date: event.date,
        event_start_time: event.start_time,
        role: assignment.role,
        offered_assignment: offeredAssignment && offeredEvent
          ? {
              id: offeredAssignment.id,
              event_name: offeredEvent.name,
              event_date: offeredEvent.date,
              event_start_time: offeredEvent.start_time,
              role: offeredAssignment.role,
            }
          : undefined,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.created_at.localeCompare(a!.created_at));
}

export function createSwapRequest(data: { eventAssignmentId: string; notes?: string; fromUserId: string }) {
  const id = makeId('swap');
  mutate((draft) => {
    draft.swapRequests.push({
      id,
      event_assignment_id: data.eventAssignmentId,
      assignment_id: null,
      from_user_id: data.fromUserId,
      to_user_id: null,
      offered_assignment_id: null,
      status: 'pending',
      notes: data.notes ?? null,
      approved_by: null,
      approved_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
  });

  return id;
}

export function acceptSwapRequest(data: { swapRequestId: string; currentUserId: string }) {
  mutate((draft) => {
    const swap = draft.swapRequests.find((s) => s.id === data.swapRequestId && s.status === 'pending');
    if (!swap || !swap.event_assignment_id) return;

    const assignment = draft.eventAssignments.find((a) => a.id === swap.event_assignment_id);
    if (!assignment) return;

    assignment.volunteer_id = data.currentUserId;
    assignment.status = 'confirmed';
    assignment.updated_at = nowIso();

    swap.status = 'approved';
    swap.approved_by = data.currentUserId;
    swap.approved_at = nowIso();
    swap.updated_at = nowIso();
  });

  return { success: true };
}

export function offerSwap(data: { swapRequestId: string; offeredAssignmentId: string; currentUserId: string }) {
  mutate((draft) => {
    const swap = draft.swapRequests.find((s) => s.id === data.swapRequestId && s.status === 'pending');
    if (!swap) return;

    swap.offered_assignment_id = data.offeredAssignmentId;
    swap.to_user_id = data.currentUserId;
    swap.updated_at = nowIso();
  });

  return { success: true };
}

export function confirmSwap(data: { swapRequestId: string; accept: boolean; currentUserId: string }) {
  let message = data.accept ? 'Swap confirmed' : 'Swap declined';

  mutate((draft) => {
    const swap = draft.swapRequests.find((s) => s.id === data.swapRequestId && s.status === 'pending');
    if (!swap) return;

    if (!data.accept) {
      swap.offered_assignment_id = null;
      swap.to_user_id = null;
      swap.updated_at = nowIso();
      return;
    }

    const requestedAssignment = swap.event_assignment_id
      ? draft.eventAssignments.find((a) => a.id === swap.event_assignment_id)
      : null;
    const offeredAssignment = swap.offered_assignment_id
      ? draft.eventAssignments.find((a) => a.id === swap.offered_assignment_id)
      : null;

    if (!requestedAssignment || !offeredAssignment) {
      message = 'Unable to complete swap';
      return;
    }

    const fromVolunteerId = requestedAssignment.volunteer_id;
    requestedAssignment.volunteer_id = offeredAssignment.volunteer_id;
    requestedAssignment.status = 'confirmed';
    requestedAssignment.updated_at = nowIso();

    offeredAssignment.volunteer_id = fromVolunteerId;
    offeredAssignment.status = 'confirmed';
    offeredAssignment.updated_at = nowIso();

    swap.status = 'approved';
    swap.approved_by = data.currentUserId;
    swap.approved_at = nowIso();
    swap.updated_at = nowIso();
  });

  return { success: true, action: data.accept ? 'accepted' : 'declined', message };
}

export function cancelSwapRequest(data: { swapRequestId: string; currentUserId: string }) {
  mutate((draft) => {
    draft.swapRequests = draft.swapRequests.filter(
      (swap) => !(swap.id === data.swapRequestId && swap.from_user_id === data.currentUserId)
    );
  });
}

export function getExistingSwapRequest(data: { eventAssignmentId: string; currentUserId: string }) {
  return (
    state.swapRequests.find(
      (swap) =>
        swap.event_assignment_id === data.eventAssignmentId &&
        swap.from_user_id === data.currentUserId &&
        swap.status === 'pending'
    ) ?? null
  );
}

export function getUserAssignmentsForSwap(userId: string) {
  const today = nowDate();
  return state.eventAssignments
    .filter((assignment) => assignment.volunteer_id === userId)
    .map((assignment) => {
      const event = state.events.find((e) => e.id === assignment.event_id);
      if (!event || event.date < today) return null;
      return {
        id: assignment.id,
        role: assignment.role,
        event_id: assignment.event_id,
        event_name: event.name,
        event_date: event.date,
        event_start_time: event.start_time,
        event_status: event.status,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a!.event_date.localeCompare(b!.event_date));
}

export function getOrgNotificationSettings() {
  return state.notificationSettings.reduce<Record<string, boolean>>((acc, setting) => {
    acc[setting.key] = setting.enabled;
    return acc;
  }, {});
}

export function updateOrgNotificationSetting(key: string, enabled: boolean) {
  mutate((draft) => {
    const existing = draft.notificationSettings.find((setting) => setting.key === key);
    if (existing) {
      existing.enabled = enabled;
    } else {
      draft.notificationSettings.push({ key, enabled });
    }
  });
}

export function getSystemSettings() {
  return [...state.systemSettings];
}

export function updateSystemSetting(key: string, value: unknown) {
  mutate((draft) => {
    const existing = draft.systemSettings.find((setting) => setting.key === key);
    if (existing) {
      existing.value = value;
      existing.updated_at = nowIso();
      return;
    }

    draft.systemSettings.push({
      key,
      value,
      description: null,
      updated_at: nowIso(),
    });
  });
}

export function getSandboxOrgName(): string {
  return getPublicOrgSettings().organisationName;
}

export function getSandboxOrgById(orgId: string): { id: string; name: string } | null {
  if (orgId !== state.orgId) {
    return null;
  }
  return { id: state.orgId, name: getSandboxOrgName() };
}
