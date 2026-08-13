export type ImportErrorCategory = "ImportError" | "ParseError" | "DatabaseError";

export type QueryErrorCategory = "QueryError" | "TimeoutError";

export type AuthErrorCategory = "AuthError" | "DriveError" | "SheetsError";

export type ExportErrorCategory = "ExportError";

export class AppError extends Error {
  readonly category: string;

  constructor(message: string, category: string) {
    super(message);
    this.name = "AppError";
    this.category = category;
  }
}

export class ImportError extends AppError {
  constructor(message: string) {
    super(message, "ImportError");
    this.name = "ImportError";
  }
}

export class ParseError extends AppError {
  constructor(message: string) {
    super(message, "ParseError");
    this.name = "ParseError";
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(message, "DatabaseError");
    this.name = "DatabaseError";
  }
}

export class QueryError extends AppError {
  constructor(message: string) {
    super(message, "QueryError");
    this.name = "QueryError";
  }
}

export class ExportError extends AppError {
  constructor(message: string) {
    super(message, "ExportError");
    this.name = "ExportError";
  }
}

export class DriveError extends AppError {
  constructor(message: string) {
    super(message, "DriveError");
    this.name = "DriveError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toUserMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.message;
  }
  return "Something unexpected went wrong. Please try again.";
}