import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BusinessErrorCode } from '../common/errors/business-error-code';
import { BusinessException } from '../common/errors/business-exception';
import { EventCategory, EventRecurrence, HouseholdRole } from '../common/types/roles';
import { PlansService } from '../plans/plans.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

type ListEventsFilters = {
  category?: EventCategory;
  ownerMemberId?: string;
  startsAt?: string;
  endsAt?: string;
  eventId?: string;
  page?: string;
  limit?: string;
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
    const planLimit = this.getEventsLimit(plan);
    const totalCount = await this.prisma.event.count({ where: { householdId } });
    const page = this.parsePositiveInt(filters.page, 1);
    const pageSize = this.parsePositiveInt(filters.limit, 20);
    const limit = Math.min(50, Math.max(1, pageSize));
    const skip = (page - 1) * limit;

    const events = await this.prisma.event.findMany({
      where: {
        householdId,
        ...(filters.eventId ? { id: filters.eventId } : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.ownerMemberId
          ? {
              OR: [
                { ownerMemberId: filters.ownerMemberId },
                { assignments: { some: { memberId: filters.ownerMemberId } } },
              ],
            }
          : {}),
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
        assignments: {
          include: {
            member: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    });

    return {
      totalCount,
      limit: planLimit,
      page,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
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
        participants: event.assignments.map((assignment: (typeof event.assignments)[number]) => ({
          id: assignment.member.id,
          role: assignment.member.role,
          user: assignment.member.user,
        })),
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

    const participantIds = Array.from(new Set([body.ownerMemberId, ...body.participantMemberIds]));
    const participantMembers = await this.prisma.householdMember.findMany({
      where: { id: { in: participantIds }, householdId },
      include: { user: { select: { id: true, name: true } } },
    });
    if (participantMembers.length !== participantIds.length) {
      throw new BusinessException(
        BusinessErrorCode.MEMBRO_EVENTO_INVALIDO,
        'Um ou mais membros participantes não pertencem ao lar informado.',
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
    if (new Date(body.startsAt).getTime() < Date.now()) {
      throw new BusinessException(
        BusinessErrorCode.EVENTO_PERIODO_INVALIDO,
        'Não é permitido criar eventos com data/horário no passado.',
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

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const createdEvent = await tx.event.create({
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
          assignments: {
            create: participantIds.map((memberId) => ({ memberId })),
          },
        },
        include: {
          ownerMember: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          assignments: {
            include: {
              member: {
                include: {
                  user: { select: { id: true, name: true, email: true } },
                },
              },
            },
          },
        },
      });

      const usersToNotify = participantMembers
        .map((member: (typeof participantMembers)[number]) => member.user)
        .filter((user: { id: string; name: string }) => user.id !== userId);

      if (usersToNotify.length > 0) {
        await tx.notification.createMany({
          data: usersToNotify.map((user: { id: string; name: string }) => ({
            userId: user.id,
            householdId,
            eventId: createdEvent.id,
            title: 'Novo evento atribuído',
            message: `${createdEvent.title} foi criado e atribuído para você.`,
          })),
        });
      }

      return {
        ...createdEvent,
        participants: createdEvent.assignments.map((assignment: (typeof createdEvent.assignments)[number]) => ({
          id: assignment.member.id,
          role: assignment.member.role,
          user: assignment.member.user,
        })),
      };
    });
  }

  async update(householdId: string, eventId: string, userId: string, body: UpdateEventDto) {
    const membership = await this.ensureMembership(householdId, userId);
    if (membership.role === HouseholdRole.VIEWER) {
      throw new BusinessException(
        BusinessErrorCode.SEM_PERMISSAO_EVENTO,
        'Você não tem permissão para atualizar eventos neste lar.',
        HttpStatus.FORBIDDEN,
      );
    }

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, householdId: true, startsAt: true, endsAt: true, ownerMemberId: true },
    });
    if (!event || event.householdId !== householdId) {
      throw new BusinessException(
        BusinessErrorCode.LAR_NAO_ENCONTRADO,
        'Evento não encontrado neste lar.',
        HttpStatus.NOT_FOUND,
      );
    }

    const participantIds =
      body.participantMemberIds !== undefined
        ? Array.from(new Set([body.ownerMemberId ?? event.ownerMemberId, ...body.participantMemberIds]))
        : undefined;
    if (participantIds) {
      const participantMembers = await this.prisma.householdMember.findMany({
        where: { id: { in: participantIds }, householdId },
      });
      if (participantMembers.length !== participantIds.length) {
        throw new BusinessException(
          BusinessErrorCode.MEMBRO_EVENTO_INVALIDO,
          'Um ou mais membros participantes não pertencem ao lar informado.',
          HttpStatus.BAD_REQUEST,
        );
      }
    } else if (body.ownerMemberId) {
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
    }

    const startsAt = body.startsAt ? new Date(body.startsAt) : event.startsAt;
    const endsAt = body.endsAt ? new Date(body.endsAt) : body.endsAt === undefined ? event.endsAt : null;
    if (endsAt && endsAt.getTime() < startsAt.getTime()) {
      throw new BusinessException(
        BusinessErrorCode.EVENTO_PERIODO_INVALIDO,
        'A data final não pode ser anterior ao início do evento.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updatedEvent = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description || null } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.recurrence !== undefined ? { recurrence: body.recurrence } : {}),
        ...(body.startsAt !== undefined ? { startsAt } : {}),
        ...(body.endsAt !== undefined ? { endsAt } : {}),
        ...(body.reminderMinutes !== undefined ? { reminderMinutes: body.reminderMinutes === 0 ? null : body.reminderMinutes } : {}),
        ...(body.ownerMemberId !== undefined ? { ownerMemberId: body.ownerMemberId } : {}),
        ...(participantIds
          ? {
              assignments: {
                deleteMany: {},
                create: participantIds.map((memberId) => ({ memberId })),
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
        assignments: {
          include: {
            member: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
    });

    return {
      ...updatedEvent,
      participants: updatedEvent.assignments.map((assignment: (typeof updatedEvent.assignments)[number]) => ({
        id: assignment.member.id,
        role: assignment.member.role,
        user: assignment.member.user,
      })),
    };
  }

  async remove(householdId: string, eventId: string, userId: string) {
    const membership = await this.ensureMembership(householdId, userId);
    if (membership.role === HouseholdRole.VIEWER) {
      throw new BusinessException(
        BusinessErrorCode.SEM_PERMISSAO_EVENTO,
        'Você não tem permissão para remover eventos neste lar.',
        HttpStatus.FORBIDDEN,
      );
    }

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, householdId: true },
    });
    if (!event || event.householdId !== householdId) {
      throw new BusinessException(
        BusinessErrorCode.LAR_NAO_ENCONTRADO,
        'Evento não encontrado neste lar.',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.prisma.event.delete({ where: { id: eventId } });
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

  private parsePositiveInt(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.floor(parsed);
  }
}
