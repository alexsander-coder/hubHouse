import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { BusinessErrorCode } from '../common/errors/business-error-code';
import { BusinessException } from '../common/errors/business-exception';
import { SuccessCode } from '../common/errors/success-code';

@Injectable()
export class AuthService {
  private readonly loginAttempts = new Map<
    string,
    { count: number; blockedUntil: number | null }
  >();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new BusinessException(
        BusinessErrorCode.EMAIL_JA_EM_USO,
        'Este e-mail já está em uso.',
        HttpStatus.CONFLICT,
      );
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
    });

    const verifyToken = randomBytes(32).toString('hex');
    const verifyTokenHash = createHash('sha256')
      .update(verifyToken)
      .digest('hex');
    const verificationTtlMs = 15 * 60 * 1000;

    await this.usersService.setEmailVerificationToken(
      user.id,
      verifyTokenHash,
      new Date(Date.now() + verificationTtlMs),
    );

    return {
      code: SuccessCode.CONTA_CRIADA,
      message: 'Conta criada com sucesso. Verifique o e-mail para continuar.',
      userId: user.id,
      verificationTokenForDev: verifyToken,
    };
  }

  async verifyEmail(rawToken: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const user =
      await this.usersService.findByEmailVerificationTokenHash(tokenHash);
    if (!user || !user.emailVerificationExpiresAt) {
      throw new BusinessException(
        BusinessErrorCode.TOKEN_VERIFICACAO_INVALIDO,
        'Token de verificação inválido.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (user.emailVerificationExpiresAt.getTime() < Date.now()) {
      throw new BusinessException(
        BusinessErrorCode.TOKEN_VERIFICACAO_EXPIRADO,
        'Token de verificação expirado.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.usersService.verifyEmail(user.id);
    return {
      code: SuccessCode.EMAIL_VERIFICADO,
      message: 'E-mail verificado com sucesso.',
    };
  }

  async forgotPassword(email: string) {
    const normalizedEmail = email.toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      return {
        code: SuccessCode.RECUPERACAO_SENHA_SOLICITADA,
        message: 'Se o e-mail existir, enviaremos instruções de recuperação.',
      };
    }

    const resetToken = randomBytes(32).toString('hex');
    const resetTokenHash = createHash('sha256')
      .update(resetToken)
      .digest('hex');
    const resetTtlMs = 15 * 60 * 1000;

    await this.usersService.setPasswordResetToken(
      user.id,
      resetTokenHash,
      new Date(Date.now() + resetTtlMs),
    );

    return {
      code: SuccessCode.RECUPERACAO_SENHA_SOLICITADA,
      message: 'Se o e-mail existir, enviaremos instruções de recuperação.',
      resetTokenForDev: resetToken,
    };
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const user =
      await this.usersService.findByPasswordResetTokenHash(tokenHash);

    if (!user || !user.passwordResetExpiresAt) {
      throw new BusinessException(
        BusinessErrorCode.TOKEN_REDEFINICAO_INVALIDO,
        'Token de redefinição inválido.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (user.passwordResetExpiresAt.getTime() < Date.now()) {
      await this.usersService.clearPasswordResetToken(user.id);
      throw new BusinessException(
        BusinessErrorCode.TOKEN_REDEFINICAO_EXPIRADO,
        'Token de redefinição expirado.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
    });
    await this.usersService.updatePassword(user.id, passwordHash);

    return {
      code: SuccessCode.SENHA_REDEFINIDA,
      message: 'Senha redefinida com sucesso.',
    };
  }

  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.toLowerCase();
    this.assertNotBlocked(normalizedEmail);

    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      this.registerFailedAttempt(normalizedEmail);
      throw new BusinessException(
        BusinessErrorCode.CREDENCIAIS_INVALIDAS,
        'Credenciais inválidas.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const validPassword = await argon2.verify(user.passwordHash, dto.password);
    if (!validPassword) {
      this.registerFailedAttempt(normalizedEmail);
      throw new BusinessException(
        BusinessErrorCode.CREDENCIAIS_INVALIDAS,
        'Credenciais inválidas.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!user.emailVerified) {
      throw new BusinessException(
        BusinessErrorCode.EMAIL_NAO_VERIFICADO,
        'E-mail ainda não verificado.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    this.resetAttempts(normalizedEmail);

    const tokens = await this.generateTokens(user.id, user.email);
    await this.usersService.updateRefreshTokenHash(
      user.id,
      await this.hashToken(tokens.refreshToken),
    );

    return {
      code: SuccessCode.LOGIN_REALIZADO,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: { id: user.id, name: user.name, email: user.email },
    };
  }

  async refresh(userId: string, refreshToken: string) {
    const user = await this.usersService.findById(userId);
    if (!user || !user.refreshTokenHash) {
      throw new BusinessException(
        BusinessErrorCode.SESSAO_INVALIDA,
        'Sessão inválida.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const refreshMatches = await argon2.verify(
      user.refreshTokenHash,
      refreshToken,
    );
    if (!refreshMatches) {
      throw new BusinessException(
        BusinessErrorCode.SESSAO_INVALIDA,
        'Sessão inválida.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.usersService.updateRefreshTokenHash(
      user.id,
      await this.hashToken(tokens.refreshToken),
    );
    return {
      code: SuccessCode.TOKEN_RENOVADO,
      ...tokens,
    };
  }

  async logout(userId: string) {
    await this.usersService.updateRefreshTokenHash(userId, null);
    return {
      code: SuccessCode.LOGOUT_REALIZADO,
      message: 'Logout realizado com sucesso.',
    };
  }

  private async generateTokens(userId: string, email: string) {
    const accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ??
      'dev_access_secret';
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      'dev_refresh_secret';

    const accessExpiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email },
      { secret: accessSecret, expiresIn: accessExpiresIn as unknown as number },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, email },
      {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn as unknown as number,
      },
    );

    return { accessToken, refreshToken };
  }

  private async hashToken(token: string) {
    return argon2.hash(token, { type: argon2.argon2id });
  }

  private assertNotBlocked(email: string): void {
    const attempt = this.loginAttempts.get(email);
    if (!attempt?.blockedUntil) {
      return;
    }
    if (attempt.blockedUntil > Date.now()) {
      throw new HttpException(
        {
          code: BusinessErrorCode.MUITAS_TENTATIVAS,
          message: 'Muitas tentativas. Tente novamente mais tarde.',
          details: null,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.loginAttempts.set(email, { count: 0, blockedUntil: null });
  }

  private registerFailedAttempt(email: string): void {
    const current = this.loginAttempts.get(email) ?? {
      count: 0,
      blockedUntil: null,
    };
    const nextCount = current.count + 1;
    let blockedUntil: number | null = null;

    if (nextCount >= 10) {
      blockedUntil = Date.now() + 1000 * 60 * 15;
    } else if (nextCount >= 5) {
      blockedUntil = Date.now() + 1000 * 60 * 5;
    }

    this.loginAttempts.set(email, { count: nextCount, blockedUntil });
  }

  private resetAttempts(email: string): void {
    this.loginAttempts.delete(email);
  }
}
