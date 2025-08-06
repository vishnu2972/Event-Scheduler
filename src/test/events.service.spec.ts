import { EventsService } from '../events/events.service';
import { CreateEventDto } from '../events/dtos/create-event.dto';

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(() => {
    service = new EventsService();
  });

  it('should create a valid event', () => {
    const dto: CreateEventDto = {
      title: 'Test Event',
      startTime: '2025-08-08T10:00:00Z',
      endTime: '2025-08-08T11:00:00Z',
      recurrence: 'none',
      reminderMinutes: 15,
    };

    const result = service.createEvent(dto);
    expect(result).toHaveProperty('id');
    expect(result.title).toBe('Test Event');
  });

  it('should throw for invalid time conflict', () => {
    const dto: CreateEventDto = {
      title: 'Event 1',
      startTime: '2025-08-06T10:00:00Z',
      endTime: '2025-08-06T11:00:00Z',
      recurrence: 'none',
    };

    service.createEvent(dto);

    const conflictDto: CreateEventDto = {
      title: 'Conflict Event',
      startTime: '2025-08-06T10:30:00Z',
      endTime: '2025-08-06T11:30:00Z',
      recurrence: 'none',
    };

    expect(() => service.createEvent(conflictDto)).toThrow('Time conflict with existing event: Test Event');
  });
});
