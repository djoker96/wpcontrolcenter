import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';
    let error = 'Internal Server Error';
    let code: string | undefined;
    let extra: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, unknown>;
        message = (res.message as string) || exception.message;
        error = (res.error as string) || exception.name;
        code = typeof res.code === 'string' ? res.code : undefined;
        if (typeof res.retryAfterSeconds === 'number') {
          extra = { retryAfterSeconds: res.retryAfterSeconds };
        }
        if (Array.isArray(res.message)) {
          message = (res.message as string[]).join('; ');
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Don't leak internal error details in production
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      const isDev = process.env.NODE_ENV !== 'production';
      if (!isDev) {
        message = 'Internal Server Error';
      }
      this.logger.error(
        `[${request.method}] ${request.url} — ${status} — ${exception instanceof Error ? exception.stack : 'Unknown error'}`,
      );
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} — ${status} — ${message}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      ...(code ? { code } : {}),
      ...extra,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
