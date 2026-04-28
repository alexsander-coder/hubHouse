import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { SuccessResponseInterceptor } from './common/interceptors/success-response.interceptor';
import { PrismaService } from './prisma/prisma.service';
import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  if (!existsSync('uploads/documents')) {
    mkdirSync('uploads/documents', { recursive: true });
  }
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new SuccessResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
