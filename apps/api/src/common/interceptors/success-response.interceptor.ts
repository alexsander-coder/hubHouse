import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { Request } from 'express';
import { SuccessCode } from '../errors/success-code';

@Injectable()
export class SuccessResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<{ statusCode: number }>();

    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile) {
          return data;
        }

        const inferredMessage =
          data &&
          typeof data === 'object' &&
          'message' in (data as Record<string, unknown>)
            ? String((data as Record<string, unknown>).message)
            : 'Operação realizada com sucesso.';
        const inferredCode =
          data &&
          typeof data === 'object' &&
          'code' in (data as Record<string, unknown>)
            ? String((data as Record<string, unknown>).code)
            : SuccessCode.OPERACAO_SUCESSO;

        const payload =
          data &&
          typeof data === 'object' &&
          ('message' in (data as Record<string, unknown>) ||
            'code' in (data as Record<string, unknown>))
            ? Object.fromEntries(
                Object.entries(data as Record<string, unknown>).filter(
                  ([key]) => key !== 'message' && key !== 'code',
                ),
              )
            : data;

        return {
          sucesso: true,
          statusCode: response.statusCode,
          codigo: inferredCode,
          mensagem: inferredMessage,
          caminho: request.url,
          timestamp: new Date().toISOString(),
          dados: payload ?? null,
        };
      }),
    );
  }
}
