import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { EventCategory, EventRecurrence } from '../../common/types/roles';

export class CreateEventDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsEnum(EventCategory)
  category: EventCategory;

  @IsEnum(EventRecurrence)
  recurrence: EventRecurrence;

  @IsDateString()
  startsAt: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reminderMinutes?: number;

  @IsUUID()
  ownerMemberId: string;
}
