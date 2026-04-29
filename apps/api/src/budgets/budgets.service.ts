import { HttpStatus, Injectable } from '@nestjs/common';
import { BudgetCategory } from '../common/types/roles';
import { BusinessErrorCode } from '../common/errors/business-error-code';
import { BusinessException } from '../common/errors/business-exception';
import { PlansService } from '../plans/plans.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBudgetEntryDto } from './dto/create-budget-entry.dto';
import { CreateBudgetGoalDto } from './dto/create-budget-goal.dto';
import { UpdateBudgetEntryDto } from './dto/update-budget-entry.dto';
import { UpdateBudgetGoalDto } from './dto/update-budget-goal.dto';

@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plansService: PlansService,
  ) {}

  async listEntries(householdId: string, userId: string, month?: string) {
    await this.ensureProFeatureAndMembership(householdId, userId);

    const parsedMonth = month ? this.parseCompetenceMonth(month) : null;
    const where = {
      householdId,
      ...(parsedMonth
        ? {
            competenceMonth: {
              gte: parsedMonth.start,
              lt: parsedMonth.next,
            },
          }
        : {}),
    };

    const entries = await this.budgetRepo().findMany({
      where,
      orderBy: [{ competenceMonth: 'desc' }, { category: 'asc' }],
    });

    return entries.map((entry: (typeof entries)[number]) => ({
      id: entry.id,
      category: entry.category,
      competenceMonth: entry.competenceMonth.toISOString().slice(0, 7),
      amountCents: entry.amountCents,
      notes: entry.notes,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }));
  }

  async createEntry(householdId: string, userId: string, body: CreateBudgetEntryDto) {
    const membership = await this.ensureProFeatureAndMembership(householdId, userId);
    this.ensureCanManageBudget(membership.role);
    const parsedMonth = this.parseCompetenceMonth(body.competenceMonth);

    try {
      const created = await this.budgetRepo().create({
        data: {
          householdId,
          createdByUserId: userId,
          category: body.category,
          competenceMonth: parsedMonth.start,
          amountCents: body.amountCents,
          notes: body.notes ?? null,
        },
      });

      await this.checkAndNotifyGoalExceeded(householdId, body.category, parsedMonth.start, userId);
      return {
        id: created.id,
        category: created.category,
        competenceMonth: created.competenceMonth.toISOString().slice(0, 7),
        amountCents: created.amountCents,
        notes: created.notes,
      };
    } catch {
      throw new BusinessException(
        BusinessErrorCode.ORCAMENTO_CATEGORIA_DUPLICADA,
        'Já existe lançamento para esta categoria no mês informado.',
        HttpStatus.CONFLICT,
      );
    }
  }

  async updateEntry(householdId: string, entryId: string, userId: string, body: UpdateBudgetEntryDto) {
    const membership = await this.ensureProFeatureAndMembership(householdId, userId);
    this.ensureCanManageBudget(membership.role);

    const existing = await this.budgetRepo().findUnique({
      where: { id: entryId },
      select: { id: true, householdId: true, category: true, competenceMonth: true },
    });
    if (!existing || existing.householdId !== householdId) {
      throw new BusinessException(
        BusinessErrorCode.ORCAMENTO_LANCAMENTO_NAO_ENCONTRADO,
        'Lançamento de orçamento não encontrado.',
        HttpStatus.NOT_FOUND,
      );
    }

    const parsedMonth = body.competenceMonth ? this.parseCompetenceMonth(body.competenceMonth) : null;

    try {
      const updated = await this.budgetRepo().update({
        where: { id: entryId },
        data: {
          ...(body.category ? { category: body.category } : {}),
          ...(parsedMonth ? { competenceMonth: parsedMonth.start } : {}),
          ...(body.amountCents !== undefined ? { amountCents: body.amountCents } : {}),
          ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
        },
      });

      await this.checkAndNotifyGoalExceeded(
        householdId,
        (body.category ?? existing.category) as BudgetCategory,
        parsedMonth?.start ?? existing.competenceMonth,
        userId,
      );
      return {
        id: updated.id,
        category: updated.category,
        competenceMonth: updated.competenceMonth.toISOString().slice(0, 7),
        amountCents: updated.amountCents,
        notes: updated.notes,
      };
    } catch {
      throw new BusinessException(
        BusinessErrorCode.ORCAMENTO_CATEGORIA_DUPLICADA,
        'Já existe lançamento para esta categoria no mês informado.',
        HttpStatus.CONFLICT,
      );
    }
  }

  async removeEntry(householdId: string, entryId: string, userId: string) {
    const membership = await this.ensureProFeatureAndMembership(householdId, userId);
    this.ensureCanManageBudget(membership.role);

    const existing = await this.budgetRepo().findUnique({
      where: { id: entryId },
      select: { id: true, householdId: true },
    });
    if (!existing || existing.householdId !== householdId) {
      throw new BusinessException(
        BusinessErrorCode.ORCAMENTO_LANCAMENTO_NAO_ENCONTRADO,
        'Lançamento de orçamento não encontrado.',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.budgetRepo().delete({ where: { id: entryId } });
  }

  async getMonthlySummary(householdId: string, userId: string, month: string) {
    await this.ensureProFeatureAndMembership(householdId, userId);
    const current = this.parseCompetenceMonth(month);
    const previous = new Date(current.start);
    previous.setMonth(previous.getMonth() - 1);
    const previousParsed = this.parseCompetenceMonth(previous.toISOString().slice(0, 7));

    const [currentEntries, previousEntries, goals] = await Promise.all([
      this.budgetRepo().findMany({
        where: {
          householdId,
          competenceMonth: { gte: current.start, lt: current.next },
        },
      }),
      this.budgetRepo().findMany({
        where: {
          householdId,
          competenceMonth: { gte: previousParsed.start, lt: previousParsed.next },
        },
      }),
      this.goalRepo().findMany({
        where: {
          householdId,
          competenceMonth: { gte: current.start, lt: current.next },
        },
      }),
    ]);

    const currentTotal = currentEntries.reduce((sum: number, entry: (typeof currentEntries)[number]) => sum + entry.amountCents, 0);
    const previousTotal = previousEntries.reduce((sum: number, entry: (typeof previousEntries)[number]) => sum + entry.amountCents, 0);
    const diff = currentTotal - previousTotal;

    const currentByCategory = new Map<BudgetCategory, number>();
    const previousByCategory = new Map<BudgetCategory, number>();
    for (const entry of currentEntries) {
      currentByCategory.set(entry.category as BudgetCategory, (currentByCategory.get(entry.category as BudgetCategory) ?? 0) + entry.amountCents);
    }
    for (const entry of previousEntries) {
      previousByCategory.set(entry.category as BudgetCategory, (previousByCategory.get(entry.category as BudgetCategory) ?? 0) + entry.amountCents);
    }

    const categories = Object.values(BudgetCategory).map((category) => {
      const currentValue = currentByCategory.get(category) ?? 0;
      const previousValue = previousByCategory.get(category) ?? 0;
      return {
        category,
        currentAmountCents: currentValue,
        previousAmountCents: previousValue,
        diffAmountCents: currentValue - previousValue,
        trend: currentValue > previousValue ? 'UP' : currentValue < previousValue ? 'DOWN' : 'STABLE',
      };
    });

    return {
      month,
      previousMonth: previous.toISOString().slice(0, 7),
      currentTotalCents: currentTotal,
      previousTotalCents: previousTotal,
      diffTotalCents: diff,
      trend: diff > 0 ? 'UP' : diff < 0 ? 'DOWN' : 'STABLE',
      categories,
      goals: goals.map((goal: (typeof goals)[number]) => ({
        id: goal.id,
        category: goal.category,
        targetCents: goal.targetCents,
        competenceMonth: goal.competenceMonth.toISOString().slice(0, 7),
      })),
    };
  }

  async listGoals(householdId: string, userId: string, month: string) {
    await this.ensureProFeatureAndMembership(householdId, userId);
    const parsed = this.parseCompetenceMonth(month);
    const goals = await this.goalRepo().findMany({
      where: {
        householdId,
        competenceMonth: { gte: parsed.start, lt: parsed.next },
      },
      orderBy: [{ category: 'asc' }],
    });

    return goals.map((goal: (typeof goals)[number]) => ({
      id: goal.id,
      category: goal.category,
      targetCents: goal.targetCents,
      competenceMonth: goal.competenceMonth.toISOString().slice(0, 7),
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
    }));
  }

  async createGoal(householdId: string, userId: string, body: CreateBudgetGoalDto) {
    const membership = await this.ensureProFeatureAndMembership(householdId, userId);
    this.ensureCanManageBudget(membership.role);
    const parsed = this.parseCompetenceMonth(body.competenceMonth);
    try {
      const created = await this.goalRepo().create({
        data: {
          householdId,
          createdByUserId: userId,
          category: body.category,
          competenceMonth: parsed.start,
          targetCents: body.targetCents,
        },
      });
      return {
        id: created.id,
        category: created.category,
        targetCents: created.targetCents,
        competenceMonth: created.competenceMonth.toISOString().slice(0, 7),
      };
    } catch {
      throw new BusinessException(
        BusinessErrorCode.ORCAMENTO_META_DUPLICADA,
        'Já existe meta para esta categoria no mês informado.',
        HttpStatus.CONFLICT,
      );
    }
  }

  async updateGoal(householdId: string, goalId: string, userId: string, body: UpdateBudgetGoalDto) {
    const membership = await this.ensureProFeatureAndMembership(householdId, userId);
    this.ensureCanManageBudget(membership.role);

    const existing = await this.goalRepo().findUnique({
      where: { id: goalId },
      select: { id: true, householdId: true, category: true, competenceMonth: true },
    });
    if (!existing || existing.householdId !== householdId) {
      throw new BusinessException(
        BusinessErrorCode.ORCAMENTO_META_NAO_ENCONTRADA,
        'Meta de orçamento não encontrada.',
        HttpStatus.NOT_FOUND,
      );
    }

    const parsed = body.competenceMonth ? this.parseCompetenceMonth(body.competenceMonth) : null;
    try {
      const updated = await this.goalRepo().update({
        where: { id: goalId },
        data: {
          ...(body.category ? { category: body.category } : {}),
          ...(parsed ? { competenceMonth: parsed.start } : {}),
          ...(body.targetCents !== undefined ? { targetCents: body.targetCents } : {}),
        },
      });
      return {
        id: updated.id,
        category: updated.category,
        targetCents: updated.targetCents,
        competenceMonth: updated.competenceMonth.toISOString().slice(0, 7),
      };
    } catch {
      throw new BusinessException(
        BusinessErrorCode.ORCAMENTO_META_DUPLICADA,
        'Já existe meta para esta categoria no mês informado.',
        HttpStatus.CONFLICT,
      );
    }
  }

  async removeGoal(householdId: string, goalId: string, userId: string) {
    const membership = await this.ensureProFeatureAndMembership(householdId, userId);
    this.ensureCanManageBudget(membership.role);

    const existing = await this.goalRepo().findUnique({
      where: { id: goalId },
      select: { id: true, householdId: true },
    });
    if (!existing || existing.householdId !== householdId) {
      throw new BusinessException(
        BusinessErrorCode.ORCAMENTO_META_NAO_ENCONTRADA,
        'Meta de orçamento não encontrada.',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.goalRepo().delete({ where: { id: goalId } });
  }

  private async ensureProFeatureAndMembership(householdId: string, userId: string) {
    const membership = await this.prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId } },
      select: { id: true, role: true },
    });
    if (!membership) {
      throw new BusinessException(
        BusinessErrorCode.LAR_NAO_ENCONTRADO,
        'Lar não encontrado ou sem permissão de acesso.',
        HttpStatus.NOT_FOUND,
      );
    }

    const household = await this.prisma.household.findUnique({
      where: { id: householdId },
      select: { ownerUserId: true },
    });
    if (!household) {
      throw new BusinessException(
        BusinessErrorCode.LAR_NAO_ENCONTRADO,
        'Lar não encontrado.',
        HttpStatus.NOT_FOUND,
      );
    }

    const plan = await this.plansService.getPlanForUser(household.ownerUserId);
    if (plan !== 'PRO') {
      throw new BusinessException(
        BusinessErrorCode.PLANO_RECURSO_PRO,
        'Recurso disponível apenas para o plano PRO.',
        HttpStatus.FORBIDDEN,
      );
    }

    return membership;
  }

  private ensureCanManageBudget(role: 'HOST' | 'ADMIN' | 'EDITOR' | 'VIEWER') {
    if (role === 'VIEWER') {
      throw new BusinessException(
        BusinessErrorCode.SEM_PERMISSAO_ORCAMENTO,
        'Você não tem permissão para gerenciar orçamentos neste lar.',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private parseCompetenceMonth(month: string) {
    if (!/^\d{4}\-(0[1-9]|1[0-2])$/.test(month)) {
      throw new BusinessException(
        BusinessErrorCode.ORCAMENTO_LANCAMENTO_NAO_ENCONTRADO,
        'Mês de competência inválido. Use o formato YYYY-MM.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const [yearRaw, monthRaw] = month.split('-');
    const year = Number(yearRaw);
    const monthIndex = Number(monthRaw) - 1;
    const start = new Date(Date.UTC(year, monthIndex, 1));
    const next = new Date(Date.UTC(year, monthIndex + 1, 1));
    return { start, next };
  }

  private budgetRepo() {
    return (this.prisma as unknown as { budgetEntry: any }).budgetEntry;
  }

  private goalRepo() {
    return (this.prisma as unknown as { budgetGoal: any }).budgetGoal;
  }

  private async checkAndNotifyGoalExceeded(
    householdId: string,
    category: BudgetCategory,
    competenceMonthStart: Date,
    actorUserId: string,
  ) {
    const monthRef = competenceMonthStart.toISOString().slice(0, 7);
    const parsed = this.parseCompetenceMonth(monthRef);
    const [goal, entries] = await Promise.all([
      this.goalRepo().findFirst({
        where: {
          householdId,
          category,
          competenceMonth: { gte: parsed.start, lt: parsed.next },
        },
      }),
      this.budgetRepo().findMany({
        where: {
          householdId,
          category,
          competenceMonth: { gte: parsed.start, lt: parsed.next },
        },
      }),
    ]);

    if (!goal) return;
    const total = entries.reduce((sum: number, entry: (typeof entries)[number]) => sum + entry.amountCents, 0);
    if (total <= goal.targetCents) return;

    const members = await this.prisma.householdMember.findMany({
      where: { householdId },
      select: { userId: true, role: true },
    });
    const recipients = members
      .filter((member) => member.role === 'HOST' || member.role === 'ADMIN' || member.userId === actorUserId)
      .map((member) => member.userId);

    const uniqueRecipients = Array.from(new Set(recipients));
    const label = category.toLowerCase();
    await this.prisma.notification.createMany({
      data: uniqueRecipients.map((userId) => ({
        userId,
        householdId,
        title: 'Meta de despesa excedida',
        message: `A categoria ${label} excedeu a meta de ${goal.targetCents / 100} no mês ${monthRef}.`,
      })),
    });
  }
}
