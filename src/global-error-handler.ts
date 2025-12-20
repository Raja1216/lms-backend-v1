import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { ErrorHandler } from './utils/error-handler';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    // Custom ErrorHandler
    if (exception instanceof ErrorHandler) {
      statusCode = exception.statusCode;
      message = exception.message;
    }

    // Nest HttpException
    else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse();
      message =
        typeof response === 'string'
          ? response
          : (response as any)?.message ?? message;
    }

    // Prisma errors
    else if (exception instanceof PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          statusCode = 400;
          message = 'Unique constraint failed';
          break;
        case 'P2003':
          statusCode = 400;
          message = 'Foreign key constraint failed';
          break;
        case 'P2025':
          statusCode = 404;
          message = 'Record not found';
          break;
      }
    }

    // JWT errors
    else if ((exception as any)?.name === 'JsonWebTokenError') {
      statusCode = 401;
      message = 'Invalid token';
    } else if ((exception as any)?.name === 'TokenExpiredError') {
      statusCode = 401;
      message = 'Token expired';
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error(exception);
    }

    res.status(statusCode).json({
      status: false,
      statusCode,
      message,
      ...(process.env.NODE_ENV === 'development' && {
        error: exception,
      }),
    });
  }
}
