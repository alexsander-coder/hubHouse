import { IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(20)
  token: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/[A-Z]/, { message: 'password must contain uppercase letters' })
  @Matches(/[a-z]/, { message: 'password must contain lowercase letters' })
  @Matches(/[0-9]/, { message: 'password must contain numbers' })
  @Matches(/[^A-Za-z0-9]/, { message: 'password must contain symbols' })
  password: string;
}
