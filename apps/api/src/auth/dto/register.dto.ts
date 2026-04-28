import {
  IsEmail,
  IsString,
  MinLength,
  Matches,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/[A-Z]/, { message: 'password must contain uppercase letters' })
  @Matches(/[a-z]/, { message: 'password must contain lowercase letters' })
  @Matches(/[0-9]/, { message: 'password must contain numbers' })
  @Matches(/[^A-Za-z0-9]/, { message: 'password must contain symbols' })
  password: string;
}
