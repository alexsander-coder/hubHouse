import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { IsEnum } from 'class-validator';
import { SuccessCode } from '../common/errors/success-code';
import { PlanTier } from '../common/types/roles';
import { PlansService } from './plans.service';

class UpdatePlanDto {
  @IsEnum(PlanTier)
  tier: PlanTier;
}

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get(':userId')
  async getPlan(@Param('userId') userId: string) {
    return {
      code: SuccessCode.PLANO_CARREGADO,
      message: 'Plano carregado com sucesso.',
      tier: await this.plansService.getPlanForUser(userId),
    };
  }

  @Patch(':userId')
  async updatePlan(
    @Param('userId') userId: string,
    @Body() body: UpdatePlanDto,
  ) {
    await this.plansService.setPlanForUser(userId, body.tier);
    return {
      code: SuccessCode.PLANO_ATUALIZADO,
      message: 'Plano atualizado com sucesso.',
      userId,
      tier: body.tier,
    };
  }
}
