import { Controller, Post, Body, Get, Param, Query, Patch, Delete, UseGuards, Req } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dtos/create-event.dto';
import { UpdateEventDto } from './dtos/update-event.dto';
import { QueryEventsDto } from './dtos/query-events.dto';
import { Event } from './schemas/event.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  createEvent(@Body() body: CreateEventDto, @Req() req: Request): Promise<Event> {
    const user = req.user as { sub: string };
    // Force userId from token, ignore incoming body.userId if present
    return this.eventsService.createEvent({ ...body, userId: user.sub });
  }

  @Get('today')
  getTodaysEvents(): Promise<Event[]> {
    return this.eventsService.getTodaysEvents();
  }

  @Get()
  list(@Query() query: QueryEventsDto, @Req() req: Request) {
    const user = req.user as { sub: string };
    // Force scope to token user
    return this.eventsService.listEvents({ ...query, userId: user.sub });
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Event> {
    return this.eventsService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateEventDto, @Req() req: Request): Promise<Event> {
    const user = req.user as { sub: string };
    // Optional: enforce owner checks in service (you likely already scope by user on lookups)
    return this.eventsService.updateEvent(id, { ...body, userId: user.sub } as any);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<{ deleted: boolean }> {
    return this.eventsService.deleteEvent(id);
  }
}
