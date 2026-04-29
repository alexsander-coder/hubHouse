import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuccessCode } from '../common/errors/success-code';
import { EventCategory } from '../common/types/roles';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
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
    @Query('eventId') eventId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.agendaService.listByHousehold(householdId, user.userId, {
      category,
      ownerMemberId,
      startsAt,
      endsAt,
      eventId,
      page,
      limit,
    });

    return {
      code: SuccessCode.EVENTOS_LISTADOS,
      message: 'Eventos carregados com sucesso.',
      totalCount: result.totalCount,
      limit: result.limit,
      page: result.page,
      totalPages: result.totalPages,
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

  @Patch('households/:householdId/events/:eventId')
  async update(
    @Param('householdId') householdId: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: { userId: string },
    @Body() body: UpdateEventDto,
  ) {
    return {
      code: SuccessCode.EVENTO_ATUALIZADO,
      message: 'Evento atualizado com sucesso.',
      event: await this.agendaService.update(householdId, eventId, user.userId, body),
    };
  }

  @Delete('households/:householdId/events/:eventId')
  async remove(
    @Param('householdId') householdId: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: { userId: string },
  ) {
    await this.agendaService.remove(householdId, eventId, user.userId);

    return {
      code: SuccessCode.EVENTO_REMOVIDO,
      message: 'Evento removido com sucesso.',
    };
  }
}
