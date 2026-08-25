export const CSRF_REJECTED_MESSAGE = "Request rejected";

export const OPERATION_ID_REQUIRED_MESSAGE = "operationId is required";

export const SESSION_WRITE_UNAUTHORIZED_MESSAGE = "Unauthorized";

export class AccountAccessError extends Error {
	readonly status: number;

	constructor(status: number, message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "AccountAccessError";
		this.status = status;
	}
}
