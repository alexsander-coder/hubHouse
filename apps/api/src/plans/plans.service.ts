import { Injectable } from '@nestjs/common';
import { PlanTier } from '../common/types/roles';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlanForUser(userId: string): Promise<PlanTier> {
    const isProduction = process.env.NODE_ENV === 'production';
    const localBypassEnabled = process.env.ENABLE_LOCAL_PRO_BYPASS !== 'false';
    if (!isProduction && localBypassEnabled) {
      return PlanTier.PRO;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { planTier: true },
    });
    return (user?.planTier as PlanTier) ?? PlanTier.FREE;
  }

  async setPlanForUser(userId: string, tier: PlanTier): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { planTier: tier },
    });
  }

  async getHouseholdLimit(userId: string): Promise<number> {
    return (await this.getPlanForUser(userId)) === PlanTier.PRO ? 4 : 1;
  }

  async getMemberLimitPerHousehold(userId: string): Promise<number> {
    return (await this.getPlanForUser(userId)) === PlanTier.PRO ? 20 : 4;
  }

  async getParticipationLimit(userId: string): Promise<number> {
    return (await this.getPlanForUser(userId)) === PlanTier.PRO ? 20 : 4;
  }
}
