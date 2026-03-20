import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
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
      message = 'Du lieu bi trung (unique).';
    } else if (exception.code === 'P2003') {
      status = HttpStatus.BAD_REQUEST;
      message = 'Khoa ngoai khong hop le.';
    } else if (exception.code === 'P2022') {
      status = HttpStatus.BAD_REQUEST;
      message = 'Cau truc co so du lieu chua duoc cap nhat dung voi ma nguon hien tai.';
    } else if (exception.code === 'P2025') {
      status = HttpStatus.NOT_FOUND;
      message = 'Khong tim thay du lieu.';
    }

    return res.status(status).json({
      statusCode: status,
      message,
      code: exception.code,
    });
  }
}
