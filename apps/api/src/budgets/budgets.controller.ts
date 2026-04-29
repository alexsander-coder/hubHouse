import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuccessCode } from '../common/errors/success-code';
import { BudgetsService } from './budgets.service';
import { CreateBudgetEntryDto } from './dto/create-budget-entry.dto';
import { CreateBudgetGoalDto } from './dto/create-budget-goal.dto';
import { UpdateBudgetEntryDto } from './dto/update-budget-entry.dto';
import { UpdateBudgetGoalDto } from './dto/update-budget-goal.dto';

@Controller('budgets')
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get('households/:householdId')
  async listEntries(
    @Param('householdId') householdId: string,
    @CurrentUser() user: { userId: string },
    @Query('month') month?: string,
  ) {
    return {
      code: SuccessCode.ORCAMENTO_LANCAMENTOS_LISTADOS,
      message: 'Lançamentos de orçamento carregados com sucesso.',
      items: await this.budgetsService.listEntries(householdId, user.userId, month),
    };
  }

  @Get('households/:householdId/summary')
  async summary(
    @Param('householdId') householdId: string,
    @CurrentUser() user: { userId: string },
    @Query('month') month: string,
  ) {
    return {
      code: SuccessCode.ORCAMENTO_RESUMO_CARREGADO,
      message: 'Resumo de orçamento carregado com sucesso.',
      summary: await this.budgetsService.getMonthlySummary(householdId, user.userId, month),
    };
  }

  @Get('households/:householdId/goals')
  async listGoals(
    @Param('householdId') householdId: string,
    @CurrentUser() user: { userId: string },
    @Query('month') month: string,
  ) {
    return {
      code: SuccessCode.ORCAMENTO_METAS_LISTADAS,
      message: 'Metas de despesas carregadas com sucesso.',
      items: await this.budgetsService.listGoals(householdId, user.userId, month),
    };
  }

  @Post('households/:householdId/goals')
  async createGoal(
    @Param('householdId') householdId: string,
    @CurrentUser() user: { userId: string },
    @Body() body: CreateBudgetGoalDto,
  ) {
    return {
      code: SuccessCode.ORCAMENTO_META_CRIADA,
      message: 'Meta de despesa criada com sucesso.',
      goal: await this.budgetsService.createGoal(householdId, user.userId, body),
    };
  }

  @Patch('households/:householdId/goals/:goalId')
  async updateGoal(
    @Param('householdId') householdId: string,
    @Param('goalId') goalId: string,
    @CurrentUser() user: { userId: string },
    @Body() body: UpdateBudgetGoalDto,
  ) {
    return {
      code: SuccessCode.ORCAMENTO_META_ATUALIZADA,
      message: 'Meta de despesa atualizada com sucesso.',
      goal: await this.budgetsService.updateGoal(householdId, goalId, user.userId, body),
    };
  }

  @Delete('households/:householdId/goals/:goalId')
  async deleteGoal(
    @Param('householdId') householdId: string,
    @Param('goalId') goalId: string,
    @CurrentUser() user: { userId: string },
  ) {
    await this.budgetsService.removeGoal(householdId, goalId, user.userId);
    return {
      code: SuccessCode.ORCAMENTO_META_REMOVIDA,
      message: 'Meta de despesa removida com sucesso.',
    };
  }

  @Post('households/:householdId')
  async createEntry(
    @Param('householdId') householdId: string,
    @CurrentUser() user: { userId: string },
    @Body() body: CreateBudgetEntryDto,
  ) {
    return {
      code: SuccessCode.ORCAMENTO_LANCAMENTO_CRIADO,
      message: 'Lançamento de orçamento criado com sucesso.',
      entry: await this.budgetsService.createEntry(householdId, user.userId, body),
    };
  }

  @Patch('households/:householdId/:entryId')
  async updateEntry(
    @Param('householdId') householdId: string,
    @Param('entryId') entryId: string,
    @CurrentUser() user: { userId: string },
    @Body() body: UpdateBudgetEntryDto,
  ) {
    return {
      code: SuccessCode.ORCAMENTO_LANCAMENTO_ATUALIZADO,
      message: 'Lançamento de orçamento atualizado com sucesso.',
      entry: await this.budgetsService.updateEntry(householdId, entryId, user.userId, body),
    };
  }

  @Delete('households/:householdId/:entryId')
  async deleteEntry(
    @Param('householdId') householdId: string,
    @Param('entryId') entryId: string,
    @CurrentUser() user: { userId: string },
  ) {
    await this.budgetsService.removeEntry(householdId, entryId, user.userId);
    return {
      code: SuccessCode.ORCAMENTO_LANCAMENTO_REMOVIDO,
      message: 'Lançamento de orçamento removido com sucesso.',
    };
  }
}
