import { IsEnum, IsInt, IsString, Matches, Max, Min } from 'class-validator';
import { BudgetCategory } from '../../common/types/roles';

export class CreateBudgetGoalDto {
  @IsEnum(BudgetCategory)
  category!: BudgetCategory;

  @IsString()
  @Matches(/^\d{4}\-(0[1-9]|1[0-2])$/)
  competenceMonth!: string;

  @IsInt()
  @Min(0)
  @Max(1000000000)
  targetCents!: number;
}
