// test/events.service.spec.ts
import { EventsService } from '../events/events.service';
import { CreateEventDto } from '../events/dtos/create-event.dto';
import { UpdateEventDto } from '../events/dtos/update-event.dto';
import { QueryEventsDto } from '../events/dtos/query-events.dto';
import { Event } from '../events/schemas/event.schema';

// Helpers to mock Mongoose's chained query API
const chain = (rows: any[]) => {
  const q: any = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(rows),
  };
  return q;
};
const findLean = (rows: any[]) => ({ lean: jest.fn().mockResolvedValue(rows) });
const findByIdLean = (row: any | null) => ({ lean: jest.fn().mockResolvedValue(row) });

describe('EventsService (CRUD + search + pagination)', () => {
  let service: EventsService;
  const model: any = {
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // default mocks
    model.find.mockReturnValue(findLean([]));
    model.countDocuments.mockResolvedValue(0);
    model.create.mockImplementation(async (doc: any) => ({ ...doc, id: 'gen-id', toObject() { return this; } }));
    model.findById.mockImplementation((id: string) => findByIdLean(null));
    model.findByIdAndUpdate.mockImplementation((id: string, update: any) => findByIdLean(null));
    model.deleteOne.mockResolvedValue({ deletedCount: 0 });

    service = new EventsService(model);
  });

  it('creates a one-off event', async () => {
    const dto: CreateEventDto = {
      title: 'Interview',
      userId: 'u1',
      recurrence: 'none',
      startTime: '2025-08-20T10:00:00Z',
      endTime: '2025-08-20T11:00:00Z',
      reminderMinutes: 15,
    };
    // no conflicts
    model.find.mockReturnValueOnce(findLean([]));

    const res = await service.createEvent(dto);
    expect(res).toHaveProperty('id');
    expect(res.title).toBe('Interview');
    expect(model.create).toHaveBeenCalled();
  });

  it('rejects overlapping event for same user', async () => {
    const existing: Event[] = [
      { userId: 'u1', title: 'Existing', recurrence: 'none', startTime: '2025-08-20T10:00:00Z', endTime: '2025-08-20T11:00:00Z' } as any,
    ];
    model.find.mockReturnValueOnce(findLean(existing));

    const dto: CreateEventDto = {
      title: 'Conflict',
      userId: 'u1',
      recurrence: 'none',
      startTime: '2025-08-20T10:30:00Z',
      endTime: '2025-08-20T11:30:00Z',
    };
    await expect(service.createEvent(dto)).rejects.toThrow('Time conflict with existing event: Existing');
  });

  it('lists events with pagination + search', async () => {
    const rows: Event[] = [
      { userId: 'u1', title: 'A', recurrence: 'none', startTime: '2025-08-20T10:00:00Z', endTime: '2025-08-20T11:00:00Z' } as any,
      { userId: 'u1', title: 'B', recurrence: 'daily', startTimeOfDay: '10:00', endTimeOfDay: '10:15' } as any,
    ];
    model.countDocuments.mockResolvedValueOnce(2);
    model.find.mockReturnValueOnce(chain(rows));

    const q: QueryEventsDto = { userId: 'u1', page: 1, limit: 2, q: 'a' } as any;
    const res = await service.listEvents(q);
    expect(res.total).toBe(2);
    expect(res.data.length).toBeLessThanOrEqual(2);
    expect(model.find).toHaveBeenCalled();
  });

  it('finds by id', async () => {
    const doc: Event = { userId: 'u1', title: 'FindMe', recurrence: 'none', startTime: '2025-08-20T10:00:00Z', endTime: '2025-08-20T11:00:00Z' } as any;
    model.findById.mockReturnValueOnce(findByIdLean(doc));

    const res = await service.findById('some-id');
    expect(res.title).toBe('FindMe');
  });

  it('updates (PATCH) an event', async () => {
    const existing: Event = { userId: 'u1', title: 'Old', recurrence: 'none', startTime: '2025-08-20T10:00:00Z', endTime: '2025-08-20T11:00:00Z' } as any;
    model.findById.mockReturnValueOnce(findByIdLean(existing)); // load existing
    model.find.mockReturnValueOnce(findLean([])); // others (no conflicts)
    model.findByIdAndUpdate.mockReturnValueOnce(findByIdLean({ ...existing, title: 'New Title' }));

    const patch: UpdateEventDto = { title: 'New Title' };
    const res = await service.updateEvent('id-1', patch);
    expect(res.title).toBe('New Title');
  });

  it('deletes by id', async () => {
    model.deleteOne.mockResolvedValueOnce({ deletedCount: 1 });
    const res = await service.deleteEvent('id-1');
    expect(res.deleted).toBe(true);
  });
});
