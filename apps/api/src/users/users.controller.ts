import { Controller, Get, HttpStatus, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessErrorCode } from '../common/errors/business-error-code';
import { BusinessException } from '../common/errors/business-exception';
import { SuccessCode } from '../common/errors/success-code';
import { HouseholdsService } from '../households/households.service';
import { PlansService } from '../plans/plans.service';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly plansService: PlansService,
    private readonly householdsService: HouseholdsService,
  ) {}

  @Get('me')
  async getMe(@CurrentUser() user: { userId: string }) {
    const userEntity = await this.usersService.findById(user.userId);
    if (!userEntity) {
      throw new BusinessException(
        BusinessErrorCode.USUARIO_NAO_ENCONTRADO,
        'Usuário não encontrado.',
        HttpStatus.NOT_FOUND,
      );
    }

    const plan = await this.plansService.getPlanForUser(user.userId);
    const households = await this.householdsService.findByUser(user.userId);

    const larOndeEhAnfitriao = households.find(
      (h: { ownerUserId: string }) => h.ownerUserId === user.userId,
    );
    const householdDestaque = larOndeEhAnfitriao ?? households[0] ?? null;
    const meuMembroNoLarDestaque = householdDestaque?.members.find(
      (member: { userId: string; role: string }) => member.userId === user.userId,
    );
    const larEmDestaque = householdDestaque
      ? {
          id: householdDestaque.id,
          name: householdDestaque.name,
          myRole: meuMembroNoLarDestaque?.role ?? null,
          membersCount: householdDestaque.members.length,
        }
      : null;

    return {
      code: SuccessCode.USUARIO_CARREGADO,
      message: 'Dados do usuário carregados com sucesso.',
      user: {
        id: userEntity.id,
        name: userEntity.name,
        email: userEntity.email,
        emailVerified: userEntity.emailVerified,
      },
      plan: {
        tier: plan,
        limits: {
          households: await this.plansService.getHouseholdLimit(user.userId),
          membersPerHousehold:
            await this.plansService.getMemberLimitPerHousehold(user.userId),
          participationHouseholds:
            await this.plansService.getParticipationLimit(user.userId),
        },
      },
      onboarding: {
        householdCount: households.length,
        participationCount: households.length,
        needsFirstHousehold: households.length === 0,
      },
      larEmDestaque,
    };
  }
}
