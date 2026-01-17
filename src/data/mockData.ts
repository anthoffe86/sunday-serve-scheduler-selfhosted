import { Volunteer, SundayService, SwapRequest, Availability } from '@/types';

export const mockVolunteers: Volunteer[] = [
  {
    id: '1',
    name: 'Sarah Mitchell',
    email: 'sarah@example.com',
    active: true,
    rolePreferences: ['reader', 'intercessions', 'sidesman-welcome'],
    familyGroupId: 'mitchell-family',
    serviceHistory: [
      { date: '2024-01-07', role: 'reader' },
      { date: '2024-01-14', role: 'intercessions' },
    ],
  },
  {
    id: '2',
    name: 'James Mitchell',
    email: 'james@example.com',
    active: true,
    rolePreferences: ['sidesman-sound', 'sidesman-standard', 'collection'],
    familyGroupId: 'mitchell-family',
    serviceHistory: [
      { date: '2024-01-07', role: 'sidesman-sound' },
      { date: '2024-01-21', role: 'collection' },
    ],
  },
  {
    id: '3',
    name: 'Elizabeth Carter',
    email: 'elizabeth@example.com',
    active: true,
    rolePreferences: ['intercessions', 'reader'],
    serviceHistory: [
      { date: '2024-01-14', role: 'reader' },
    ],
  },
  {
    id: '4',
    name: 'Michael Thompson',
    email: 'michael@example.com',
    active: true,
    rolePreferences: ['sidesman-standard', 'sidesman-welcome', 'collection'],
    serviceHistory: [
      { date: '2024-01-07', role: 'sidesman-standard' },
      { date: '2024-01-14', role: 'sidesman-welcome' },
      { date: '2024-01-21', role: 'sidesman-standard' },
    ],
  },
  {
    id: '5',
    name: 'Patricia Wong',
    email: 'patricia@example.com',
    active: true,
    rolePreferences: ['collection', 'sidesman-standard'],
    serviceHistory: [
      { date: '2024-01-07', role: 'collection' },
    ],
  },
  {
    id: '6',
    name: 'David Harris',
    email: 'david@example.com',
    active: true,
    rolePreferences: ['sidesman-sound', 'reader'],
    serviceHistory: [],
  },
  {
    id: '7',
    name: 'Margaret Chen',
    email: 'margaret@example.com',
    active: true,
    rolePreferences: ['reader', 'intercessions', 'sidesman-welcome'],
    familyGroupId: 'chen-family',
    serviceHistory: [
      { date: '2024-01-21', role: 'reader' },
    ],
  },
  {
    id: '8',
    name: 'Robert Chen',
    email: 'robert@example.com',
    active: true,
    rolePreferences: ['sidesman-standard', 'collection'],
    familyGroupId: 'chen-family',
    serviceHistory: [
      { date: '2024-01-21', role: 'sidesman-standard' },
    ],
  },
];

export const currentUser: Volunteer = mockVolunteers[0];

// Generate upcoming Sundays
const getUpcomingSundays = (count: number): string[] => {
  const sundays: string[] = [];
  const today = new Date();
  let date = new Date(today);
  
  // Find next Sunday
  const dayOfWeek = date.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  date.setDate(date.getDate() + daysUntilSunday);
  
  for (let i = 0; i < count; i++) {
    sundays.push(date.toISOString().split('T')[0]);
    date.setDate(date.getDate() + 7);
  }
  
  return sundays;
};

export const upcomingSundays = getUpcomingSundays(8);

export const mockSchedule: SundayService[] = [
  {
    date: upcomingSundays[0],
    status: 'published',
    assignments: [
      { role: 'sidesman-standard', volunteerId: '4', volunteerName: 'Michael Thompson' },
      { role: 'sidesman-standard', volunteerId: '8', volunteerName: 'Robert Chen' },
      { role: 'sidesman-sound', volunteerId: '2', volunteerName: 'James Mitchell' },
      { role: 'sidesman-welcome', volunteerId: '1', volunteerName: 'Sarah Mitchell' },
      { role: 'reader', volunteerId: '7', volunteerName: 'Margaret Chen' },
      { role: 'intercessions', volunteerId: '3', volunteerName: 'Elizabeth Carter' },
      { role: 'collection', volunteerId: '5', volunteerName: 'Patricia Wong' },
      { role: 'collection', volunteerId: '6', volunteerName: 'David Harris' },
    ],
  },
  {
    date: upcomingSundays[1],
    status: 'published',
    assignments: [
      { role: 'sidesman-standard', volunteerId: '8', volunteerName: 'Robert Chen' },
      { role: 'sidesman-standard', volunteerId: '5', volunteerName: 'Patricia Wong' },
      { role: 'sidesman-sound', volunteerId: '6', volunteerName: 'David Harris' },
      { role: 'sidesman-welcome', volunteerId: '4', volunteerName: 'Michael Thompson' },
      { role: 'reader', volunteerId: '1', volunteerName: 'Sarah Mitchell' },
      { role: 'intercessions', volunteerId: '7', volunteerName: 'Margaret Chen' },
      { role: 'collection', volunteerId: '2', volunteerName: 'James Mitchell' },
      { role: 'collection', volunteerId: '3', volunteerName: 'Elizabeth Carter' },
    ],
  },
  {
    date: upcomingSundays[2],
    status: 'draft',
    assignments: [
      { role: 'sidesman-standard', volunteerId: '4', volunteerName: 'Michael Thompson' },
      { role: 'sidesman-standard', volunteerId: '2', volunteerName: 'James Mitchell' },
      { role: 'sidesman-sound', volunteerId: '6', volunteerName: 'David Harris' },
      { role: 'sidesman-welcome', volunteerId: '8', volunteerName: 'Robert Chen' },
      { role: 'reader', volunteerId: '3', volunteerName: 'Elizabeth Carter' },
      { role: 'intercessions', volunteerId: '1', volunteerName: 'Sarah Mitchell' },
      { role: 'collection', volunteerId: '5', volunteerName: 'Patricia Wong' },
      { role: 'collection', volunteerId: '7', volunteerName: 'Margaret Chen' },
    ],
  },
];

export const mockAvailability: Availability[] = [
  { volunteerId: '1', date: upcomingSundays[2], available: false },
  { volunteerId: '3', date: upcomingSundays[1], available: false },
  { volunteerId: '5', date: upcomingSundays[3], available: false },
];

export const mockSwapRequests: SwapRequest[] = [
  {
    id: 'swap-1',
    date: upcomingSundays[1],
    role: 'reader',
    fromVolunteerId: '1',
    fromVolunteerName: 'Sarah Mitchell',
    toVolunteerId: '3',
    toVolunteerName: 'Elizabeth Carter',
    status: 'pending',
    createdAt: new Date().toISOString(),
  },
];
