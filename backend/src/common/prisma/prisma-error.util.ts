// src/common/prisma/prisma-error.util.ts
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function mapPrismaError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint
    if (e.code === 'P2002')
      throw new ConflictException('Dữ liệu bị trùng (unique).');
    // Foreign key
    if (e.code === 'P2003')
      throw new BadRequestException('Khóa ngoại không hợp lệ.');
    // Record not found
    if (e.code === 'P2025')
      throw new NotFoundException('Không tìm thấy dữ liệu.');
  }
  throw e as any;
}
