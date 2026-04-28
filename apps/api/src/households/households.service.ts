import { Injectable } from '@nestjs/common';
import { HouseholdRole } from '../common/types/roles';
import { PlansService } from '../plans/plans.service';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/errors/business-exception';
import { BusinessErrorCode } from '../common/errors/business-error-code';

@Injectable()
export class HouseholdsService {
  constructor(
    private readonly plansService: PlansService,
    private readonly prisma: PrismaService,
  ) {}

  async create(ownerUserId: string, name: string) {
    const ownerHouseholdsCount = await this.prisma.household.count({
      where: { ownerUserId },
    });
    const householdLimit =
      await this.plansService.getHouseholdLimit(ownerUserId);

    if (ownerHouseholdsCount >= householdLimit) {
      throw new BusinessException(
        BusinessErrorCode.PLANO_LIMITE_LARES,
        `Limite do plano atingido: ${householdLimit} lar(es) permitido(s).`,
        403,
      );
    }

    return this.prisma.household.create({
      data: {
        name,
        ownerUserId,
        members: {
          create: {
            userId: ownerUserId,
            role: HouseholdRole.HOST,
          },
        },
      },
      include: {
        members: true,
      },
    });
  }

  findByUser(userId: string) {
    return this.prisma.household.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        members: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  countByUser(userId: string) {
    return this.prisma.household.count({
      where: {
        members: {
          some: { userId },
        },
      },
    });
  }

  findById(householdId: string) {
    return this.prisma.household.findUnique({
      where: { id: householdId },
      include: { members: true },
    });
  }

  async getMemberLimitForHousehold(householdId: string): Promise<number> {
    const household = await this.prisma.household.findUnique({
      where: { id: householdId },
      select: { ownerUserId: true },
    });
    if (!household) {
      throw new BusinessException(
        BusinessErrorCode.LAR_NAO_ENCONTRADO,
        'Lar não encontrado.',
        404,
      );
    }
    return this.plansService.getMemberLimitPerHousehold(household.ownerUserId);
  }

  async addMember(
    householdId: string,
    userId: string,
    role: HouseholdRole,
    actorUserId: string,
  ) {
    const household = await this.prisma.household.findUnique({
      where: { id: householdId },
      include: { members: true },
    });
    if (!household) {
      throw new BusinessException(
        BusinessErrorCode.LAR_NAO_ENCONTRADO,
        'Lar não encontrado.',
        404,
      );
    }

    if (household.ownerUserId !== actorUserId) {
      throw new BusinessException(
        BusinessErrorCode.APENAS_ANFITRIAO,
        'Somente o anfitrião pode adicionar membros.',
        403,
      );
    }

    if (
      household.members.some(
        (member: { userId: string }) => member.userId === userId,
      )
    ) {
      return household;
    }

    const memberLimit = await this.plansService.getMemberLimitPerHousehold(
      household.ownerUserId,
    );
    if (household.members.length >= memberLimit) {
      throw new BusinessException(
        BusinessErrorCode.PLANO_LIMITE_MEMBROS,
        `Limite do plano atingido: ${memberLimit} membro(s) permitido(s) neste lar.`,
        403,
      );
    }

    await this.prisma.householdMember.create({
      data: {
        householdId,
        userId,
        role,
      },
    });

    return this.findById(householdId);
  }
}
