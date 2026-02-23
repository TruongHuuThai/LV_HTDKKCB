import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
// đổi path này theo generated client của bạn
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.BAD_REQUEST;
    let message = 'Prisma error';

    if (exception.code === 'P2002') {
      status = HttpStatus.CONFLICT;
      message = 'Dữ liệu bị trùng (unique).';
    } else if (exception.code === 'P2003') {
      status = HttpStatus.BAD_REQUEST;
      message = 'Khóa ngoại không hợp lệ.';
    } else if (exception.code === 'P2025') {
      status = HttpStatus.NOT_FOUND;
      message = 'Không tìm thấy dữ liệu.';
    }

    return res.status(status).json({
      statusCode: status,
      message,
      code: exception.code,
    });
  }
}
