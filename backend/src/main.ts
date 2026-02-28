import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
