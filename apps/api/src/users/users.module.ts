import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PlansModule } from '../plans/plans.module';
import { HouseholdsModule } from '../households/households.module';

@Module({
  imports: [PlansModule, HouseholdsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
