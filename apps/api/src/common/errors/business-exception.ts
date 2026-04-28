import { HttpException, HttpStatus } from '@nestjs/common';
import { BusinessErrorCode } from './business-error-code';

export class BusinessException extends HttpException {
  constructor(
    code: BusinessErrorCode,
    message: string,
    status: HttpStatus,
    details?: Record<string, unknown>,
  ) {
    super(
      {
        code,
        message,
        details: details ?? null,
      },
      status,
    );
  }
}
