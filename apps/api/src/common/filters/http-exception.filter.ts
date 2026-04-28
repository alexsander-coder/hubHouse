import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const rawMessage =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as { message?: string | string[] } | null)
            ?.message;
    const code =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as { code?: string }).code
        : undefined;
    const details =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? ((exceptionResponse as { details?: Record<string, unknown> })
            .details ?? null)
        : null;

    const message = Array.isArray(rawMessage)
      ? rawMessage.join('; ')
      : (rawMessage ?? 'Erro interno do servidor.');

    response.status(status).json({
      sucesso: false,
      statusCode: status,
      codigo: code ?? 'ERRO_NAO_TRATADO',
      mensagem: message,
      caminho: request.url,
      timestamp: new Date().toISOString(),
      detalhes: details,
    });
  }
}
