import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Response } from "express";

// Centralized exception handling: guarantees every error response has a
// consistent, safe shape — never a stack trace, raw ORM/database error
// message, token content, or other internal implementation detail.
// HttpExceptions thrown deliberately throughout the app (e.g.
// UnauthorizedException("Invalid credentials")) pass their intended message
// through unchanged; anything else — a genuinely unexpected bug — collapses
// to a generic 500. Full detail is still logged server-side for debugging,
// just never exposed to the caller.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json(typeof body === "string" ? { statusCode: status, message: body } : body);
      return;
    }

    this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
    });
  }
}
