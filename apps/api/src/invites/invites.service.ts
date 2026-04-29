import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { HttpStatus } from '@nestjs/common';
import { HouseholdRole } from '../common/types/roles';
import { HouseholdsService } from '../households/households.service';
import { PlansService } from '../plans/plans.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/errors/business-exception';
import { BusinessErrorCode } from '../common/errors/business-error-code';

@Injectable()
export class InvitesService {
  constructor(
    private readonly householdsService: HouseholdsService,
    private readonly plansService: PlansService,
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  async createInvite(
    householdId: string,
    email: string,
    role: HouseholdRole,
    invitedByUserId: string,
  ) {
    const household = await this.householdsService.findById(householdId);
    if (!household) {
      throw new BusinessException(
        BusinessErrorCode.LAR_NAO_ENCONTRADO,
        'Lar não encontrado.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (household.ownerUserId !== invitedByUserId) {
      throw new BusinessException(
        BusinessErrorCode.APENAS_ANFITRIAO,
        'Somente o anfitrião pode enviar convites.',
        HttpStatus.FORBIDDEN,
      );
    }

    const memberLimit =
      await this.householdsService.getMemberLimitForHousehold(householdId);
    if (household.members.length >= memberLimit) {
      throw new BusinessException(
        BusinessErrorCode.PLANO_LIMITE_MEMBROS,
        `Limite do plano atingido: ${memberLimit} membro(s) permitido(s) neste lar.`,
        HttpStatus.FORBIDDEN,
      );
    }

    const normalizedEmail = email.toLowerCase();
    const alreadyMember = await this.prisma.householdMember.findFirst({
      where: {
        householdId,
        user: {
          email: normalizedEmail,
        },
      },
    });
    if (alreadyMember) {
      throw new BusinessException(
        BusinessErrorCode.USUARIO_JA_NO_LAR,
        'Este usuário já pertence ao lar.',
        HttpStatus.CONFLICT,
      );
    }

    const duplicatedPendingInvite = await this.prisma.invite.findFirst({
      where: {
        householdId,
        email: normalizedEmail,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (duplicatedPendingInvite) {
      throw new BusinessException(
        BusinessErrorCode.CONVITE_DUPLICADO,
        'Já existe um convite pendente para este e-mail.',
        HttpStatus.CONFLICT,
      );
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 48);
    const invite = await this.prisma.invite.create({
      data: {
        householdId,
        email: normalizedEmail,
        role,
        invitedByUserId,
        tokenHash,
        expiresAt,
      },
    });
    return {
      inviteId: invite.id,
      token,
      expiresAt,
    };
  }

  async acceptInvite(token: string, userId: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invite = await this.prisma.invite.findUnique({
      where: { tokenHash },
    });
    if (!invite) {
      throw new BusinessException(
        BusinessErrorCode.CONVITE_INVALIDO,
        'Token de convite inválido.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.USUARIO_NAO_ENCONTRADO,
        'Usuário não encontrado.',
        HttpStatus.NOT_FOUND,
      );
    }
    this.ensureInviteCanBeAccepted(invite, user.email);

    const currentParticipationCount =
      await this.householdsService.countByUser(userId);
    const participationLimit =
      await this.plansService.getParticipationLimit(userId);
    if (currentParticipationCount >= participationLimit) {
      throw new BusinessException(
        BusinessErrorCode.PLANO_LIMITE_PARTICIPACAO,
        `Limite do plano atingido: ${participationLimit} participação(ões) em lares permitida(s).`,
        HttpStatus.FORBIDDEN,
      );
    }

    await this.householdsService.addMember(
      invite.householdId,
      userId,
      invite.role as HouseholdRole,
      invite.invitedByUserId,
    );
    const acceptedAt = new Date();
    await this.prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt },
    });

    return { householdId: invite.householdId, acceptedAt };
  }

  async acceptInviteById(inviteId: string, userId: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { id: inviteId },
    });
    if (!invite) {
      throw new BusinessException(
        BusinessErrorCode.CONVITE_INVALIDO,
        'Convite não encontrado.',
        HttpStatus.NOT_FOUND,
      );
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.USUARIO_NAO_ENCONTRADO,
        'Usuário não encontrado.',
        HttpStatus.NOT_FOUND,
      );
    }

    this.ensureInviteCanBeAccepted(invite, user.email);

    const currentParticipationCount =
      await this.householdsService.countByUser(userId);
    const participationLimit =
      await this.plansService.getParticipationLimit(userId);
    if (currentParticipationCount >= participationLimit) {
      throw new BusinessException(
        BusinessErrorCode.PLANO_LIMITE_PARTICIPACAO,
        `Limite do plano atingido: ${participationLimit} participação(ões) em lares permitida(s).`,
        HttpStatus.FORBIDDEN,
      );
    }

    await this.householdsService.addMember(
      invite.householdId,
      userId,
      invite.role as HouseholdRole,
      invite.invitedByUserId,
    );
    const acceptedAt = new Date();
    await this.prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt },
    });

    return { householdId: invite.householdId, acceptedAt };
  }

  async listByUser(userId: string, householdId?: string, scope: 'sent' | 'received' = 'sent') {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.USUARIO_NAO_ENCONTRADO,
        'Usuário não encontrado.',
        HttpStatus.NOT_FOUND,
      );
    }

    const whereClause =
      scope === 'received'
        ? {
            email: user.email.toLowerCase(),
            ...(householdId ? { householdId } : {}),
          }
        : {
            household: {
              members: {
                some: {
                  userId,
                },
              },
            },
            ...(householdId ? { householdId } : {}),
          };

    const invites = await this.prisma.invite.findMany({
      where: whereClause,
      include: {
        household: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    return invites.map((invite: (typeof invites)[number]) => ({
      id: invite.id,
      householdId: invite.householdId,
      householdName: invite.household.name,
      email: invite.email,
      role: invite.role,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
      status:
        invite.acceptedAt !== null
          ? 'ACCEPTED'
          : invite.expiresAt.getTime() < Date.now()
            ? 'EXPIRED'
            : 'PENDING',
    }));
  }

  private ensureInviteCanBeAccepted(
    invite: { acceptedAt: Date | null; expiresAt: Date; email: string },
    userEmail: string,
  ) {
    if (invite.acceptedAt) {
      throw new BusinessException(
        BusinessErrorCode.CONVITE_JA_UTILIZADO,
        'Este convite já foi utilizado.',
        HttpStatus.CONFLICT,
      );
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new BusinessException(
        BusinessErrorCode.CONVITE_EXPIRADO,
        'Convite expirado.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new BusinessException(
        BusinessErrorCode.CONVITE_INVALIDO,
        'Este convite não pertence ao e-mail da sua conta.',
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
