import { IsEmail, IsEnum } from 'class-validator';
import { HouseholdRole } from '../../common/types/roles';

export class CreateInviteDto {
  @IsEmail()
  email: string;

  @IsEnum(HouseholdRole)
  role: HouseholdRole;
}
