import { ServerResponse } from "http";
import View from "../views/View";
import Request from "./Request";

export enum StatusCode {
	OK = 200,
	Created = 201,
	NoContent = 204,
	Redirect = 302,
	BadRequest = 400,
	Unauthorized = 401,
	Forbidden = 403,
	NotFound = 404,
	InternalServerError = 500,
}

export enum ContentType {
	JSON = "application/json",
	HTML = "text/html",
}

export interface ResponseProps {
	statusCode: StatusCode;
	message: string;
	payload?: any;
	template?: string;
	redirect?: string;
}

/**
 * A class that wraps the `ServerResponse` object and provides
 * a method for sending JSON responses. This class is used by
 * the Router to send responses to the client. It is also used
 * by the controllers to send responses to the client.
 */
export default class Response {
	constructor(
		public request: Request,
		public res: ServerResponse,
	) {}

	/**
	 * Sends a JSON response to the client. The response is
	 * formatted as an object with a `message` property and a
	 * `payload` property. The `message` property is a string
	 * that describes the response. The `payload` property is
	 * an object that contains the data to be sent to the client.
	 */
	send = async (props: ResponseProps) => {
		const { statusCode, message, payload, redirect, template } = props;

		console.log(
			`<<< ${statusCode} ${message} ${payload ? JSON.stringify(payload, null, 2) : ""}`,
		);

		if (this.request.accepts(ContentType.HTML)) {
			// If a redirect URL is provided, send a 302 status code and the redirect URL.
			if (redirect) {
				this.res.writeHead(StatusCode.Redirect, { Location: redirect });
				this.res.end();
				return;
			}

			// If a template is provided and the client accepts HTML, render the template.
			if (template) {
				this.res.writeHead(statusCode, {
					"Content-Type": ContentType.HTML,
				});
				this.res.end(await View.render(template, payload));
				return;
			}
		}

		// Otherwise, send a JSON response.
		this.res.writeHead(statusCode, { "Content-Type": ContentType.JSON });
		this.res.end(JSON.stringify({ message, payload }, null, 2));
	};
}
