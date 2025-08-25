import { IsInt, IsOptional, Min, IsIn, IsString, Matches } from 'class-validator';

export class QueryEventsDto {
  @IsString()
  userId!: string; // scope all queries to a user

  @IsOptional()
  @IsIn(['none', 'daily', 'weekly'])
  recurrence?: 'none' | 'daily' | 'weekly';

  @IsOptional()
  @IsString()
  q?: string; // fuzzy title search

  // Range filters (apply to one-off events' startTime by default)
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/, { message: 'from must be ISO string (UTC) like 2025-08-20T10:00:00Z' })
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/, { message: 'to must be ISO string (UTC) like 2025-08-20T11:00:00Z' })
  to?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  weekday?: number; // for weekly filter (0..6)

  // pagination
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;

  // sorting
  @IsOptional()
  @IsIn(['createdAt', 'startTime', 'title'])
  sortBy?: 'createdAt' | 'startTime' | 'title' = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
