export const CSRF_REJECTED_MESSAGE = "Request rejected";

export const SESSION_WRITE_UNAUTHORIZED_MESSAGE = "Unauthorized";

export class AccountAccessError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = "AccountAccessError";
		this.status = status;
	}
}
