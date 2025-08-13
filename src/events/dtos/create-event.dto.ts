import {
  IsString, IsIn, IsOptional, IsISO8601,
  IsInt, Min, Max, ValidateIf, Matches
} from 'class-validator';

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateEventDto {
  @IsString()
  title!: string;

  @IsString()
  userId!: string;

  @IsIn(['none', 'daily', 'weekly'])
  recurrence!: 'none' | 'daily' | 'weekly';

  // -------- none (one-off) requires ISO datetimes --------
  @ValidateIf(o => o.recurrence === 'none')
  @IsISO8601()
  startTime?: string;

  @ValidateIf(o => o.recurrence === 'none')
  @IsISO8601()
  endTime?: string;

  // -------- daily uses HH:mm only --------
  @ValidateIf(o => o.recurrence === 'daily')
  @Matches(HH_MM, { message: 'startTimeOfDay must be HH:mm' })
  startTimeOfDay?: string;

  @ValidateIf(o => o.recurrence === 'daily')
  @Matches(HH_MM, { message: 'endTimeOfDay must be HH:mm' })
  endTimeOfDay?: string;

  // -------- weekly uses weekday + HH:mm only --------
  @ValidateIf(o => o.recurrence === 'weekly')
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number; // 0..6 (Sun..Sat)

  @ValidateIf(o => o.recurrence === 'weekly')
  @Matches(HH_MM, { message: 'weeklyStartTimeOfDay must be HH:mm' })
  weeklyStartTimeOfDay?: string;

  @ValidateIf(o => o.recurrence === 'weekly')
  @Matches(HH_MM, { message: 'weeklyEndTimeOfDay must be HH:mm' })
  weeklyEndTimeOfDay?: string;

  // -------- optional for all --------
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  reminderMinutes?: number;
}
