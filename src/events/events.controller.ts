import { Controller, Post, Body, Get } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dtos/create-event.dto';
import { Event } from './interfaces/event.interface';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  createEvent(@Body() createEventDto: CreateEventDto): Event {
    return this.eventsService.createEvent(createEventDto);
  }

  @Get('today')
  getTodaysEvents(): Event[] {
    return this.eventsService.getTodaysEvents();
  }
}
