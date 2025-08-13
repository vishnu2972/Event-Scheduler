import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type Recurrence = 'none' | 'daily' | 'weekly';

@Schema({ timestamps: true })
export class Event {
  @Prop({ required: true }) userId!: string;
  @Prop({ required: true }) title!: string;
  @Prop({ required: true, enum: ['none', 'daily', 'weekly'] })
  recurrence!: Recurrence;

  // one-off (none)
  @Prop() startTime?: string;  // ISO UTC
  @Prop() endTime?: string;

  // daily
  @Prop() startTimeOfDay?: string; // "HH:mm"
  @Prop() endTimeOfDay?: string;

  // weekly
  @Prop() weekday?: number; // 0..6
  @Prop() weeklyStartTimeOfDay?: string; // "HH:mm"
  @Prop() weeklyEndTimeOfDay?: string;   // "HH:mm"

  @Prop({ min: 0, max: 60 }) reminderMinutes?: number;
}

export type EventDocument = HydratedDocument<Event>;
export const EventSchema = SchemaFactory.createForClass(Event);

// Helpful indexes
EventSchema.index({ userId: 1, recurrence: 1 });
EventSchema.index({ userId: 1, startTime: 1 });
EventSchema.index({ userId: 1, weekday: 1, weeklyStartTimeOfDay: 1 });
