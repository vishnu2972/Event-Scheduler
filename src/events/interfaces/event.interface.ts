export type Recurrence = 'none' | 'daily' | 'weekly';

export interface Event {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  recurrence: Recurrence;
  reminderMinutes?: number;
}
