import * as fs from 'fs';
import { Event } from '../interfaces/event.interface';

const filePath = 'events.json';

export function readEvents(): Event[] {
  if (!fs.existsSync(filePath)) return [];
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data || '[]');
}

export function writeEvents(events: Event[]): void {
  fs.writeFileSync(filePath, JSON.stringify(events, null, 2));
}
