export class DomainError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export function unauthorized(message = 'Authentication required') {
  return new DomainError(401, message);
}

export function forbidden(message = 'You do not have permission to perform this action.') {
  return new DomainError(403, message);
}

export function notFound(message = 'Activity not found') {
  return new DomainError(404, message);
}

export function badRequest(message: string) {
  return new DomainError(400, message);
}

export function conflict(message: string) {
  return new DomainError(409, message);
}

export function notImplemented(message: string) {
  return new DomainError(501, message);
}
