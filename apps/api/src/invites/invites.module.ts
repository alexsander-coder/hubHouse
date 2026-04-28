import { Module } from '@nestjs/common';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { HouseholdsModule } from '../households/households.module';
import { PlansModule } from '../plans/plans.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [HouseholdsModule, PlansModule, UsersModule],
  controllers: [InvitesController],
  providers: [InvitesService],
})
export class InvitesModule {}
