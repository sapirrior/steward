export class ThreadStorageError extends Error {
  public readonly code:
    | 'DIR_CREATE_FAILED'
    | 'SAVE_FAILED'
    | 'LOAD_FAILED'
    | 'DELETE_FAILED'
    | 'NOT_FOUND'
    | 'INVALID_DATA';

  constructor(
    message: string,
    code:
      | 'DIR_CREATE_FAILED'
      | 'SAVE_FAILED'
      | 'LOAD_FAILED'
      | 'DELETE_FAILED'
      | 'NOT_FOUND'
      | 'INVALID_DATA',
    cause?: unknown,
  ) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ThreadStorageError';
    this.code = code;
  }
}
