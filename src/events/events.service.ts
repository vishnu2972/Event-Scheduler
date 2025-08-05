import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateEventDto } from './dtos/create-event.dto';
import { Event } from './interfaces/event.interface';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { readEvents, writeEvents } from './utils/file-storage';

dayjs.extend(isBetween);

@Injectable()
export class EventsService {
  private events: Event[] = readEvents();

  createEvent(dto: CreateEventDto): Event {
    const { title, startTime, endTime, recurrence, reminderMinutes } = dto;
    const start = dayjs(startTime);
    const end = dayjs(endTime);

    if (!start.isBefore(end)) {
      throw new BadRequestException('Start time must be before end time');
    }

    if (reminderMinutes && start.subtract(reminderMinutes, 'minute').isAfter(start)) {
      throw new BadRequestException('Reminder must be before event start time');
    }

    for (const event of this.events) {
      const conflict = this.hasConflict(start, end, event);
      if (conflict) {
        throw new BadRequestException(`Time conflict with existing event: ${event.title}`);
      }
    }

    const newEvent: Event = {
      id: uuidv4(),
      title,
      startTime,
      endTime,
      recurrence,
      reminderMinutes,
    };

    this.events.push(newEvent);
    writeEvents(this.events);
    return newEvent;
  }

  getTodaysEvents(): Event[] {
    const today = dayjs().startOf('day');
    const tomorrow = today.add(1, 'day');

    return this.events.filter((event) => {
      const start = dayjs(event.startTime);
      if (event.recurrence === 'none') {
        return start.isAfter(today) && start.isBefore(tomorrow);
      } else if (event.recurrence === 'daily') {
        return true;
      } else if (event.recurrence === 'weekly') {
        return start.day() === today.day();
      }
    });
  }

  private hasConflict(newStart: dayjs.Dayjs, newEnd: dayjs.Dayjs, existing: Event): boolean {
    const existingStart = dayjs(existing.startTime);
    const existingEnd = dayjs(existing.endTime);

    if (existing.recurrence === 'none') {
      return newStart.isBefore(existingEnd) && newEnd.isAfter(existingStart);
    }

    const now = dayjs();
    const checkDays = existing.recurrence === 'daily' ? [0,1,2,3,4,5,6] : [existingStart.day()];
    return checkDays.includes(now.day()) &&
      newStart.format('HH:mm') < existingEnd.format('HH:mm') &&
      newEnd.format('HH:mm') > existingStart.format('HH:mm');
  }
}
