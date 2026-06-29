import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@wpcc/database';

type ErrorReply = {
  status(status: number): {
    send(payload: unknown): unknown;
  };
};

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<ErrorReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = exception.message || 'Database error';

    switch (exception.code) {
      case 'P2002': // Unique constraint failed
        status = HttpStatus.CONFLICT;
        const target = (exception.meta?.target as string[])?.join(', ') || 'field';
        message = `Duplicate value error: A record with this ${target} already exists.`;
        break;
      case 'P2025': // Record not found
        status = HttpStatus.NOT_FOUND;
        message = (exception.meta?.cause as string) || 'The requested record was not found.';
        break;
      default:
        break;
    }

    response.status(status).send({
      statusCode: status,
      message,
      error: status === HttpStatus.CONFLICT ? 'Conflict' : status === HttpStatus.NOT_FOUND ? 'Not Found' : 'Internal Server Error',
      timestamp: new Date().toISOString(),
    });
  }
}
