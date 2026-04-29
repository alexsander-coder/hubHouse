import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { BudgetCategory } from '../../common/types/roles';

export class UpdateBudgetEntryDto {
  @IsOptional()
  @IsEnum(BudgetCategory)
  category?: BudgetCategory;

  @IsOptional()
  @Matches(/^\d{4}\-(0[1-9]|1[0-2])$/, {
    message: 'competenceMonth deve seguir o formato YYYY-MM.',
  })
  competenceMonth?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
