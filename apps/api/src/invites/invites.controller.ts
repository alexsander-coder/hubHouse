import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdRole } from '../common/types/roles';
import { SuccessCode } from '../common/errors/success-code';
import { IsString, MinLength } from 'class-validator';
import { CreateInviteDto } from './dto/create-invite.dto';
import { InvitesService } from './invites.service';

class AcceptInviteDto {
  @IsString()
  @MinLength(20)
  token: string;
}

@Controller('invites')
@UseGuards(JwtAuthGuard)
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post('households/:householdId')
  async create(
    @Param('householdId') householdId: string,
    @Body() body: CreateInviteDto,
    @CurrentUser() user: { userId: string },
  ) {
    const role = body.role ?? HouseholdRole.VIEWER;
    return {
      code: SuccessCode.CONVITE_CRIADO,
      message: 'Convite criado com sucesso.',
      invite: await this.invitesService.createInvite(
        householdId,
        body.email,
        role,
        user.userId,
      ),
    };
  }

  @Post('accept')
  async accept(
    @Body() body: AcceptInviteDto,
    @CurrentUser() user: { userId: string },
  ) {
    return {
      code: SuccessCode.CONVITE_ACEITO,
      message: 'Convite aceito com sucesso.',
      acceptance: await this.invitesService.acceptInvite(
        body.token,
        user.userId,
      ),
    };
  }

  @Get('me')
  async listMine(
    @CurrentUser() user: { userId: string },
    @Query('householdId') householdId?: string,
  ) {
    return {
      code: SuccessCode.OPERACAO_SUCESSO,
      message: 'Convites carregados com sucesso.',
      items: await this.invitesService.listByUser(user.userId, householdId),
    };
  }
}
