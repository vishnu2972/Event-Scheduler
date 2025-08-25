import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

import { CreateEventDto } from './dtos/create-event.dto';
import { UpdateEventDto } from './dtos/update-event.dto';
import { QueryEventsDto } from './dtos/query-events.dto';
import { Event, EventDocument } from './schemas/event.schema';

dayjs.extend(utc);

/* ---------------- Helpers ---------------- */
function minutesOfDayFromHHMM(hhmm?: string): number {
  if (typeof hhmm !== 'string') {
    throw new BadRequestException('Time-of-day (HH:mm) is required.');
  }
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr), m = Number(mStr);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new BadRequestException('Time-of-day must be HH:mm (00–23:00–59).');
  }
  return h * 60 + m;
}
function minutesOfDayFromISO(iso?: string): number {
  const d = dayjs.utc(iso);
  if (!d.isValid()) throw new BadRequestException('Invalid ISO datetime');
  return d.hour() * 60 + d.minute();
}
function overlapsByMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/* ---------------- Service ---------------- */
@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private readonly eventModel: Model<EventDocument>,
  ) {}

  /* ---------- CREATE ---------- */
  async createEvent(dto: CreateEventDto): Promise<Event> {
    // shape guards
    this.validateShape(dto);

    // ordering + reminder
    this.validateOrderingAndReminder(dto);

    // conflicts (same user)
    const userEvents = await this.eventModel.find({ userId: dto.userId }).lean<Event[]>();
    for (const existing of userEvents) {
      if (this.hasConflict(dto, existing)) {
        throw new BadRequestException(`Time conflict with existing event: ${existing.title}`);
      }
    }

    const created = await this.eventModel.create({
      userId: dto.userId,
      title: dto.title,
      recurrence: dto.recurrence,
      startTime: dto.startTime,
      endTime: dto.endTime,
      startTimeOfDay: dto.startTimeOfDay,
      endTimeOfDay: dto.endTimeOfDay,
      weekday: dto.weekday,
      weeklyStartTimeOfDay: dto.weeklyStartTimeOfDay,
      weeklyEndTimeOfDay: dto.weeklyEndTimeOfDay,
      reminderMinutes: dto.reminderMinutes,
    });
    return created.toObject();
  }

  /* ---------- READ: TODAY ---------- */
  async getTodaysEvents(): Promise<Event[]> {
    const todayStart = dayjs.utc().startOf('day');
    const weekday = todayStart.day(); // 0..6

    const candidates = await this.eventModel.find({
      $or: [
        { recurrence: 'daily' },
        { recurrence: 'weekly', weekday },
        {
          recurrence: 'none',
          startTime: {
            $gte: todayStart.toISOString(),
            $lt: todayStart.add(1, 'day').toISOString(),
          },
        },
      ],
    }).lean<Event[]>();

    return candidates.map((e) => {
      if (e.recurrence === 'daily') {
        const [sh, sm] = e.startTimeOfDay!.split(':').map(Number);
        const [eh, em] = e.endTimeOfDay!.split(':').map(Number);
        return {
          ...e,
          startTime: todayStart.add(sh, 'hour').add(sm, 'minute').toISOString(),
          endTime: todayStart.add(eh, 'hour').add(em, 'minute').toISOString(),
        };
      }
      if (e.recurrence === 'weekly') {
        const [sh, sm] = e.weeklyStartTimeOfDay!.split(':').map(Number);
        const [eh, em] = e.weeklyEndTimeOfDay!.split(':').map(Number);
        return {
          ...e,
          startTime: todayStart.add(sh, 'hour').add(sm, 'minute').toISOString(),
          endTime: todayStart.add(eh, 'hour').add(em, 'minute').toISOString(),
        };
      }
      return e; // none
    });
  }

  /* ---------- READ: SEARCH + PAGINATION ---------- */
  async listEvents(q: QueryEventsDto): Promise<{
    data: Event[];
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
  }> {
    const {
      userId,
      recurrence,
      q: text,
      from,
      to,
      weekday,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = q;

    const filter: any = { userId };

    if (recurrence) filter.recurrence = recurrence;
    if (typeof weekday === 'number') filter.weekday = weekday;
    if (text) filter.title = { $regex: text, $options: 'i' };

    // Range (applies to one-off startTime)
    if (from || to) {
      filter.startTime = {};
      if (from) filter.startTime.$gte = from;
      if (to) filter.startTime.$lt = to;
    }

    const skip = (page - 1) * limit;
    const total = await this.eventModel.countDocuments(filter);
    const data = await this.eventModel
      .find(filter)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit)
      .lean<Event[]>();

    return {
      data,
      page,
      limit,
      total,
      hasNext: page * limit < total,
    };
  }

  /* ---------- READ: BY ID ---------- */
  async findById(id: string): Promise<Event> {
    const doc = await this.eventModel.findById(id).lean<Event | null>();
    if (!doc) throw new NotFoundException('Event not found');
    return doc;
  }

  /* ---------- UPDATE (PATCH semantics) ---------- */
  async updateEvent(id: string, patch: UpdateEventDto): Promise<Event> {
    const existing = await this.eventModel.findById(id).lean<Event | null>();
    if (!existing) throw new NotFoundException('Event not found');

    // prevent userId change (security)
    if (patch.userId && patch.userId !== existing.userId) {
      throw new BadRequestException('Cannot change userId of the event');
    }

    // Merge → derive a full DTO-like object
    const merged: CreateEventDto = {
      // base from existing (convert to DTO shape)
      userId: existing.userId,
      title: patch.title ?? existing.title,
      recurrence: patch.recurrence ?? (existing.recurrence as any),
      startTime: patch.startTime ?? existing.startTime,
      endTime: patch.endTime ?? existing.endTime,
      startTimeOfDay: patch.startTimeOfDay ?? existing.startTimeOfDay,
      endTimeOfDay: patch.endTimeOfDay ?? existing.endTimeOfDay,
      weekday: typeof patch.weekday === 'number' ? patch.weekday : existing.weekday,
      weeklyStartTimeOfDay: patch.weeklyStartTimeOfDay ?? existing.weeklyStartTimeOfDay,
      weeklyEndTimeOfDay: patch.weeklyEndTimeOfDay ?? existing.weeklyEndTimeOfDay,
      reminderMinutes: typeof patch.reminderMinutes === 'number'
        ? patch.reminderMinutes
        : existing.reminderMinutes,
    };

    // Normalize fields to match recurrence (strip irrelevant fields)
    this.stripIrrelevantFieldsByRecurrence(merged);

    // Full validation on the merged payload
    this.validateShape(merged);
    this.validateOrderingAndReminder(merged);

    // Conflict check vs other events of same user (exclude self)
    const others = await this.eventModel.find({
      userId: merged.userId,
      _id: { $ne: id },
    }).lean<Event[]>();

    for (const ev of others) {
      if (this.hasConflict(merged, ev)) {
        throw new BadRequestException(`Time conflict with existing event: ${ev.title}`);
      }
    }

    // Persist changes
    const updateDoc: Partial<Event> = {
      title: merged.title,
      recurrence: merged.recurrence,
      startTime: merged.startTime,
      endTime: merged.endTime,
      startTimeOfDay: merged.startTimeOfDay,
      endTimeOfDay: merged.endTimeOfDay,
      weekday: merged.weekday,
      weeklyStartTimeOfDay: merged.weeklyStartTimeOfDay,
      weeklyEndTimeOfDay: merged.weeklyEndTimeOfDay,
      reminderMinutes: merged.reminderMinutes,
    };

    const updated = await this.eventModel.findByIdAndUpdate(id, updateDoc, { new: true }).lean<Event | null>();
    if (!updated) throw new NotFoundException('Event not found after update');
    return updated;
  }

  /* ---------- DELETE ---------- */
  async deleteEvent(id: string): Promise<{ deleted: boolean }> {
    const res = await this.eventModel.deleteOne({ _id: id });
    return { deleted: res.deletedCount === 1 };
  }

  /* ---------- Shape & business validation ---------- */
  private validateShape(dto: CreateEventDto) {
    const { recurrence } = dto;

    if (recurrence === 'none') {
      if (!dto.startTime || !dto.endTime)
        throw new BadRequestException('For recurrence=none, startTime and endTime (ISO) are required.');
      if (dto.startTimeOfDay || dto.endTimeOfDay || dto.weekday !== undefined ||
          dto.weeklyStartTimeOfDay || dto.weeklyEndTimeOfDay) {
        throw new BadRequestException('For recurrence=none, do not send daily/weekly time-of-day fields.');
      }
      return;
    }

    if (recurrence === 'daily') {
      if (!dto.startTimeOfDay || !dto.endTimeOfDay)
        throw new BadRequestException('For recurrence=daily, startTimeOfDay and endTimeOfDay are required.');
      if (dto.startTime || dto.endTime || dto.weekday !== undefined ||
          dto.weeklyStartTimeOfDay || dto.weeklyEndTimeOfDay) {
        throw new BadRequestException('For recurrence=daily, do not send ISO or weekly fields.');
      }
      return;
    }

    if (recurrence === 'weekly') {
      if (
        dto.weekday === undefined ||
        dto.weekday === null ||
        dto.weeklyStartTimeOfDay === undefined ||
        dto.weeklyEndTimeOfDay === undefined
      ) {
        throw new BadRequestException('For recurrence=weekly, weekday (0..6) and weeklyStart/EndTimeOfDay are required.');
      }
      if (dto.startTime || dto.endTime || dto.startTimeOfDay || dto.endTimeOfDay) {
        throw new BadRequestException('For recurrence=weekly, do not send ISO or daily fields.');
      }
      if (dto.weekday < 0 || dto.weekday > 6) {
        throw new BadRequestException('weekday must be between 0 (Sun) and 6 (Sat).');
      }
      return;
    }

    throw new BadRequestException('Invalid recurrence type.');
  }

  private validateOrderingAndReminder(dto: CreateEventDto) {
    const { recurrence, reminderMinutes } = dto;

    if (typeof reminderMinutes === 'number') {
      if (reminderMinutes < 0 || reminderMinutes > 60) {
        throw new BadRequestException('reminderMinutes must be between 0 and 60');
      }
    }

    if (recurrence === 'none') {
      const start = dayjs.utc(dto.startTime!);
      const end = dayjs.utc(dto.endTime!);
      if (!start.isValid() || !end.isValid()) throw new BadRequestException('Invalid ISO startTime/endTime');
      if (!start.isBefore(end)) throw new BadRequestException('Start time must be before end time');

      if (typeof reminderMinutes === 'number') {
        const reminderInstant = start.subtract(reminderMinutes, 'minute');
        if (!reminderInstant.isBefore(start)) {
          throw new BadRequestException('Reminder must be before event start time');
        }
      }
      return;
    }

    if (recurrence === 'daily') {
      const startM = minutesOfDayFromHHMM(dto.startTimeOfDay);
      const endM = minutesOfDayFromHHMM(dto.endTimeOfDay);
      if (!(startM < endM)) throw new BadRequestException('startTimeOfDay must be before endTimeOfDay');
      return;
    }

    if (recurrence === 'weekly') {
      const startM = minutesOfDayFromHHMM(dto.weeklyStartTimeOfDay);
      const endM = minutesOfDayFromHHMM(dto.weeklyEndTimeOfDay);
      if (!(startM < endM)) throw new BadRequestException('weeklyStartTimeOfDay must be before weeklyEndTimeOfDay');
      return;
    }
  }

  private stripIrrelevantFieldsByRecurrence(dto: CreateEventDto) {
    if (dto.recurrence === 'none') {
      delete dto.startTimeOfDay;
      delete dto.endTimeOfDay;
      delete dto.weekday;
      delete dto.weeklyStartTimeOfDay;
      delete dto.weeklyEndTimeOfDay;
    } else if (dto.recurrence === 'daily') {
      delete dto.startTime;
      delete dto.endTime;
      delete dto.weekday;
      delete dto.weeklyStartTimeOfDay;
      delete dto.weeklyEndTimeOfDay;
    } else if (dto.recurrence === 'weekly') {
      delete dto.startTime;
      delete dto.endTime;
      delete dto.startTimeOfDay;
      delete dto.endTimeOfDay;
    }
  }

  /* ----- Conflict logic across types (same user) ----- */
  private hasConflict(newDto: CreateEventDto, existing: Event): boolean {
    const newType = newDto.recurrence;
    const exType = existing.recurrence;

    // daily involved → compare by time-of-day
    if (newType === 'daily' || exType === 'daily') {
      const [ns, ne] = newType === 'daily'
        ? [
            minutesOfDayFromHHMM(newDto.startTimeOfDay),
            minutesOfDayFromHHMM(newDto.endTimeOfDay),
          ]
        : [
            minutesOfDayFromISO(newDto.startTime),
            minutesOfDayFromISO(newDto.endTime),
          ];

      const [es, ee] = exType === 'daily'
        ? [
            existing.startTimeOfDay
              ? minutesOfDayFromHHMM(existing.startTimeOfDay)
              : minutesOfDayFromISO(existing.startTime),
            existing.endTimeOfDay
              ? minutesOfDayFromHHMM(existing.endTimeOfDay)
              : minutesOfDayFromISO(existing.endTime),
          ]
        : [
            minutesOfDayFromISO(existing.startTime),
            minutesOfDayFromISO(existing.endTime),
          ];

      return overlapsByMinutes(ns, ne, es, ee);
    }

    // weekly vs weekly
    if (newType === 'weekly' && exType === 'weekly') {
      if (newDto.weekday !== existing.weekday) return false;
      const ns = minutesOfDayFromHHMM(newDto.weeklyStartTimeOfDay);
      const ne = minutesOfDayFromHHMM(newDto.weeklyEndTimeOfDay);
      const es = existing.weeklyStartTimeOfDay
        ? minutesOfDayFromHHMM(existing.weeklyStartTimeOfDay)
        : minutesOfDayFromISO(existing.startTime);
      const ee = existing.weeklyEndTimeOfDay
        ? minutesOfDayFromHHMM(existing.weeklyEndTimeOfDay)
        : minutesOfDayFromISO(existing.endTime);
      return overlapsByMinutes(ns, ne, es, ee);
    }

    // weekly vs none
    if (newType === 'weekly' && exType === 'none') {
      const eStart = dayjs.utc(existing.startTime);
      if (eStart.day() !== newDto.weekday) return false;
      const ns = minutesOfDayFromHHMM(newDto.weeklyStartTimeOfDay);
      const ne = minutesOfDayFromHHMM(newDto.weeklyEndTimeOfDay);
      const es = minutesOfDayFromISO(existing.startTime);
      const ee = minutesOfDayFromISO(existing.endTime);
      return overlapsByMinutes(ns, ne, es, ee);
    }
    if (newType === 'none' && exType === 'weekly') {
      const nStart = dayjs.utc(newDto.startTime);
      if (nStart.day() !== existing.weekday) return false;
      const ns = minutesOfDayFromISO(newDto.startTime);
      const ne = minutesOfDayFromISO(newDto.endTime);
      const es = existing.weeklyStartTimeOfDay
        ? minutesOfDayFromHHMM(existing.weeklyStartTimeOfDay)
        : minutesOfDayFromISO(existing.startTime);
      const ee = existing.weeklyEndTimeOfDay
        ? minutesOfDayFromHHMM(existing.weeklyEndTimeOfDay)
        : minutesOfDayFromISO(existing.endTime);
      return overlapsByMinutes(ns, ne, es, ee);
    }

    // none vs none
    if (newType === 'none' && exType === 'none') {
      const nStart = dayjs.utc(newDto.startTime);
      const nEnd = dayjs.utc(newDto.endTime);
      const eStart = dayjs.utc(existing.startTime);
      const eEnd = dayjs.utc(existing.endTime);
      return nStart.isBefore(eEnd) && nEnd.isAfter(eStart);
    }

    return false;
  }
}
