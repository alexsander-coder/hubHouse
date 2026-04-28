import { HttpStatus, Injectable } from '@nestjs/common';
import { BusinessErrorCode } from '../common/errors/business-error-code';
import { BusinessException } from '../common/errors/business-exception';
import { EventCategory, EventRecurrence, HouseholdRole } from '../common/types/roles';
import { PlansService } from '../plans/plans.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

type ListEventsFilters = {
  category?: EventCategory;
  ownerMemberId?: string;
  startsAt?: string;
  endsAt?: string;
};

@Injectable()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plansService: PlansService,
  ) {}

  async listMembers(householdId: string, userId: string) {
    await this.ensureMembership(householdId, userId);

    const members = await this.prisma.householdMember.findMany({
      where: { householdId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((member: (typeof members)[number]) => ({
      id: member.id,
      role: member.role,
      user: member.user,
    }));
  }

  async listByHousehold(householdId: string, userId: string, filters: ListEventsFilters) {
    await this.ensureMembership(householdId, userId);

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
    const limit = this.getEventsLimit(plan);
    const totalCount = await this.prisma.event.count({ where: { householdId } });

    const events = await this.prisma.event.findMany({
      where: {
        householdId,
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.ownerMemberId ? { ownerMemberId: filters.ownerMemberId } : {}),
        ...(filters.startsAt || filters.endsAt
          ? {
              startsAt: {
                ...(filters.startsAt ? { gte: new Date(filters.startsAt) } : {}),
                ...(filters.endsAt ? { lte: new Date(filters.endsAt) } : {}),
              },
            }
          : {}),
      },
      include: {
        ownerMember: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });

    return {
      totalCount,
      limit,
      items: events.map((event: (typeof events)[number]) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        category: event.category,
        recurrence: event.recurrence,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        reminderMinutes: event.reminderMinutes,
        createdAt: event.createdAt,
        ownerMember: {
          id: event.ownerMember.id,
          role: event.ownerMember.role,
          user: event.ownerMember.user,
        },
      })),
    };
  }

  async create(householdId: string, userId: string, body: CreateEventDto) {
    const membership = await this.ensureMembership(householdId, userId);
    if (membership.role === HouseholdRole.VIEWER) {
      throw new BusinessException(
        BusinessErrorCode.SEM_PERMISSAO_EVENTO,
        'Você não tem permissão para cadastrar eventos neste lar.',
        HttpStatus.FORBIDDEN,
      );
    }

    const ownerMember = await this.prisma.householdMember.findUnique({
      where: { id: body.ownerMemberId },
      select: { id: true, householdId: true },
    });
    if (!ownerMember || ownerMember.householdId !== householdId) {
      throw new BusinessException(
        BusinessErrorCode.MEMBRO_EVENTO_INVALIDO,
        'Membro selecionado não pertence ao lar informado.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (body.endsAt && new Date(body.endsAt).getTime() < new Date(body.startsAt).getTime()) {
      throw new BusinessException(
        BusinessErrorCode.EVENTO_PERIODO_INVALIDO,
        'A data final não pode ser anterior ao início do evento.',
        HttpStatus.BAD_REQUEST,
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
    const limit = this.getEventsLimit(plan);
    const currentCount = await this.prisma.event.count({ where: { householdId } });
    if (currentCount >= limit) {
      throw new BusinessException(
        BusinessErrorCode.PLANO_LIMITE_AGENDA,
        `Limite do plano atingido: ${limit} evento(s) permitido(s) neste lar.`,
        HttpStatus.FORBIDDEN,
      );
    }

    return this.prisma.event.create({
      data: {
        householdId,
        ownerMemberId: body.ownerMemberId,
        createdByUserId: userId,
        title: body.title,
        description: body.description ?? null,
        category: body.category,
        recurrence: body.recurrence ?? EventRecurrence.NONE,
        startsAt: new Date(body.startsAt),
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        reminderMinutes: body.reminderMinutes ?? null,
      },
      include: {
        ownerMember: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
  }

  private async ensureMembership(householdId: string, userId: string) {
    const membership = await this.prisma.householdMember.findUnique({
      where: {
        householdId_userId: { householdId, userId },
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!membership) {
      throw new BusinessException(
        BusinessErrorCode.LAR_NAO_ENCONTRADO,
        'Lar não encontrado ou sem permissão de acesso.',
        HttpStatus.NOT_FOUND,
      );
    }

    return membership;
  }

  private getEventsLimit(plan: 'FREE' | 'PRO'): number {
    return plan === 'PRO' ? 500 : 40;
  }
}
