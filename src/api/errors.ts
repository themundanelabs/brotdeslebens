// Split out of client.ts so both it and staticClient.ts can share the
// same class (and `instanceof api.ApiError` checks work regardless of
// which implementation is active) without a circular value-import
// between the two.
export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}
