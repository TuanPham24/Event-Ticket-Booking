import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

// Safety-net mapping for Prisma errors that bubble up without being handled
// explicitly in a service (e.g. an admin CRUD path hitting a unique constraint).
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const httpException = this.map(exception);
    const response = host.switchToHttp().getResponse<Response>();
    response
      .status(httpException.getStatus())
      .json(httpException.getResponse());
  }

  private map(exception: Prisma.PrismaClientKnownRequestError) {
    switch (exception.code) {
      case 'P2002':
        return new ConflictException(
          `Duplicate value for: ${(exception.meta?.target as string[])?.join(', ')}`,
        );
      case 'P2025':
        return new NotFoundException('Record not found');
      default:
        return new ConflictException(exception.message);
    }
  }
}
