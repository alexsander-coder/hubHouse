import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuccessCode } from '../common/errors/success-code';
import { EventCategory } from '../common/types/roles';
import { CreateEventDto } from './dto/create-event.dto';
import { AgendaService } from './agenda.service';

@Controller('agenda')
@UseGuards(JwtAuthGuard)
export class AgendaController {
  constructor(private readonly agendaService: AgendaService) {}

  @Get('households/:householdId/members')
  async listMembers(
    @Param('householdId') householdId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return {
      code: SuccessCode.MEMBROS_LAR_LISTADOS,
      message: 'Membros do lar carregados com sucesso.',
      items: await this.agendaService.listMembers(householdId, user.userId),
    };
  }

  @Get('households/:householdId')
  async listByHousehold(
    @Param('householdId') householdId: string,
    @CurrentUser() user: { userId: string },
    @Query('category') category?: EventCategory,
    @Query('ownerMemberId') ownerMemberId?: string,
    @Query('startsAt') startsAt?: string,
    @Query('endsAt') endsAt?: string,
  ) {
    const result = await this.agendaService.listByHousehold(householdId, user.userId, {
      category,
      ownerMemberId,
      startsAt,
      endsAt,
    });

    return {
      code: SuccessCode.EVENTOS_LISTADOS,
      message: 'Eventos carregados com sucesso.',
      totalCount: result.totalCount,
      limit: result.limit,
      items: result.items,
    };
  }

  @Post('households/:householdId')
  async create(
    @Param('householdId') householdId: string,
    @CurrentUser() user: { userId: string },
    @Body() body: CreateEventDto,
  ) {
    return {
      code: SuccessCode.EVENTO_CRIADO,
      message: 'Evento criado com sucesso.',
      event: await this.agendaService.create(householdId, user.userId, body),
    };
  }
}
