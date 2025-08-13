import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dtos/create-event.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  createEvent(@Body() body: CreateEventDto) {
    return this.eventsService.createEvent(body);
  }

  @Get('today')
  getTodaysEvents() {
    return this.eventsService.getTodaysEvents();
  }

  @Get(':userId')
  getEventsForUser(@Param('userId') userId: string) {
    return this.eventsService.getEventsByUserId(userId);
  }
}
