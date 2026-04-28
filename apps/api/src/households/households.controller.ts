import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuccessCode } from '../common/errors/success-code';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { HouseholdsService } from './households.service';

@Controller('households')
@UseGuards(JwtAuthGuard)
export class HouseholdsController {
  constructor(private readonly householdsService: HouseholdsService) {}

  @Get('me')
  async listMine(@CurrentUser() user: { userId: string }) {
    return {
      code: SuccessCode.LARES_LISTADOS,
      message: 'Lares carregados com sucesso.',
      items: await this.householdsService.findByUser(user.userId),
    };
  }

  @Post()
  async create(
    @CurrentUser() user: { userId: string },
    @Body() body: CreateHouseholdDto,
  ) {
    return {
      code: SuccessCode.LAR_CRIADO,
      message: 'Lar criado com sucesso.',
      household: await this.householdsService.create(user.userId, body.name),
    };
  }
}
