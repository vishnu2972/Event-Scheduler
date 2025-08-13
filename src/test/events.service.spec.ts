// test/events.service.spec.ts
import { EventsService } from '../events/events.service';
import { CreateEventDto } from '../events/dtos/create-event.dto';
import { Event } from '../events/schemas/event.schema';

// Minimal mock for Mongoose Model<EventDocument>
type FindReturn = { lean: () => Promise<Event[]> };
const makeFindReturn = (rows: Event[]): FindReturn => ({
  lean: () => Promise.resolve(rows),
});

describe('EventsService (with mocked Mongoose model)', () => {
  let service: EventsService;

  // Reusable mock model with jest fns
  const mockEventModel = {
    find: jest.fn(),             // .find(filter).lean() -> Promise<Event[]>
    create: jest.fn(),           // .create(doc) -> doc with toObject()
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: no events found
    mockEventModel.find.mockReturnValue(makeFindReturn([]));

    // Default: echo created doc with toObject()
    mockEventModel.create.mockImplementation(async (doc: any) => ({
      ...doc,
      id: 'generated-id',
      toObject() { return this; },
    }));

    service = new EventsService(mockEventModel);
  });

  it('should create a valid one-off event (none)', async () => {
    const dto: CreateEventDto = {
      title: 'Test Event',
      userId: 'u1',
      recurrence: 'none',
      startTime: '2025-08-06T10:00:00Z',
      endTime: '2025-08-06T11:00:00Z',
      reminderMinutes: 15,
    };

    const result = await service.createEvent(dto);
    expect(result).toHaveProperty('id');
    expect(result.title).toBe('Test Event');
    expect(mockEventModel.find).toHaveBeenCalled();   // conflict check query
    expect(mockEventModel.create).toHaveBeenCalled(); // persistence
  });

  it('should throw for overlapping event for the same user', async () => {
    // Seed find() to return one existing event that overlaps
    const existing: Event[] = [
      {
        userId: 'u1',
        title: 'Existing',
        recurrence: 'none',
        startTime: '2025-08-06T10:00:00Z',
        endTime: '2025-08-06T11:00:00Z',
        reminderMinutes: 10,
      } as any,
    ];
    mockEventModel.find.mockReturnValueOnce(makeFindReturn(existing));

    const conflictDto: CreateEventDto = {
      title: 'Conflict',
      userId: 'u1', // same user → should conflict
      recurrence: 'none',
      startTime: '2025-08-06T10:30:00Z',
      endTime: '2025-08-06T11:30:00Z',
    };

    await expect(service.createEvent(conflictDto))
      .rejects
      .toThrow('Time conflict with existing event: Existing');
  });

  it('should NOT conflict across different users', async () => {
    // Existing belongs to another user
    const existing: Event[] = [
      {
        userId: 'u2',
        title: 'Other User',
        recurrence: 'none',
        startTime: '2025-08-06T10:00:00Z',
        endTime: '2025-08-06T11:00:00Z',
      } as any,
    ];
    mockEventModel.find.mockReturnValueOnce(makeFindReturn(existing));

    const dto: CreateEventDto = {
      title: 'My Event',
      userId: 'u1',
      recurrence: 'none',
      startTime: '2025-08-06T10:30:00Z',
      endTime: '2025-08-06T11:30:00Z',
    };

    await expect(service.createEvent(dto)).resolves.toHaveProperty('id');
  });

  it('should create a daily event with HH:mm only', async () => {
    mockEventModel.find.mockReturnValueOnce(makeFindReturn([])); // no conflicts

    const dto: CreateEventDto = {
      title: 'Daily Standup',
      userId: 'u1',
      recurrence: 'daily',
      startTimeOfDay: '09:30',
      endTimeOfDay: '09:45',
      reminderMinutes: 5,
    };

    const result = await service.createEvent(dto);
    expect(result.title).toBe('Daily Standup');
  });

  it('should create a weekly event with weekday + HH:mm', async () => {
    mockEventModel.find.mockReturnValueOnce(makeFindReturn([]));

    const dto: CreateEventDto = {
      title: 'Weekly Sync',
      userId: 'u1',
      recurrence: 'weekly',
      weekday: 1, // Monday
      weeklyStartTimeOfDay: '11:00',
      weeklyEndTimeOfDay: '11:30',
      reminderMinutes: 10,
    };

    const result = await service.createEvent(dto);
    expect(result.title).toBe('Weekly Sync');
  });
});
