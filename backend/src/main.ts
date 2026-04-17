import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

dotenv.config({ path: join(process.cwd(), '.env'), override: true });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors();

  // Chèn dòng này ngay sau khi import hoặc đầu hàm bootstrap
  console.log('--- KIỂM TRA BIẾN MÔI TRƯỜNG ---');
  console.log('Database URL:', process.env.DATABASE_URL);
  console.log('--------------------------------');

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
