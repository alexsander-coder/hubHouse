import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { BudgetCategory } from '../../common/types/roles';

export class UpdateBudgetGoalDto {
  @IsOptional()
  @IsEnum(BudgetCategory)
  category?: BudgetCategory;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}\-(0[1-9]|1[0-2])$/)
  competenceMonth?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000000)
  targetCents?: number;
}
