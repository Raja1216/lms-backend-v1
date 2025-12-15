import { Catch, ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { Response } from 'express';

@Catch(PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PrismaClientExceptionFilter.name);

  catch(exception: PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    switch (exception.code) {
      case 'P2002': // Unique constraint
        return response.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          message: 'A record with the provided value already exists.',
          meta: exception.meta,
        });

      case 'P2003': // Foreign key constraint
        return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Foreign key constraint failed.',
          meta: exception.meta,
        });

      case 'P2004': // Constraint failed
        return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'A database constraint failed.',
        });

      case 'P2025': // Record not found
        return response.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'The requested record was not found.',
        });

      case 'P2011': // Null constraint violation
        return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'A required field is missing.',
          meta: exception.meta,
        });

      case 'P2012': // Missing required value
        return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Missing a required value.',
        });

      case 'P2013': // Missing argument
        return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Missing an argument in the request.',
        });

      case 'P2014': // Relation violation
        return response.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          message: 'The change would violate a required relation.',
        });

      case 'P2021': // Table does not exist
        return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database table not found.',
        });

      case 'P2022': // Column does not exist
        return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database column not found.',
        });

      default:
        this.logger.error(
          `Unhandled Prisma error: ${exception.code}`,
          exception.stack,
        );
        return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'An unexpected database error occurred.',
        });
    }
  }
}
