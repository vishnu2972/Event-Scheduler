import { IsString, IsOptional, IsNumber, Min, IsIn, IsISO8601 } from 'class-validator';

export class CreateEventDto {
  @IsString()
  title!: string;

  @IsISO8601()
  startTime!: string;

  @IsISO8601()
  endTime!: string;

  @IsIn(['none', 'daily', 'weekly'])
  recurrence!: 'none' | 'daily' | 'weekly';

  @IsOptional()
  @IsNumber()
  @Min(1)
  reminderMinutes?: number;
}
