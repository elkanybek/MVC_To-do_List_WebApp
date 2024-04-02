import { IncomingMessage } from "http";

/**
 * A class to represent an HTTP request and provide utility methods for parsing
 * the request body and extracting information from the request URL. This class
 * is used by the Router to handle incoming requests. It is also used by the
 * controllers to parse the request body and extract information from the URL.
 */
export default class Request {
	req: IncomingMessage;
	body: Record<string, any> = {};

	constructor(req: IncomingMessage) {
		this.req = req;
	}

	/**
	 * Parses the request body as JSON and sets the `props`
	 * property to the parsed object. Rejects the promise if
	 * the request body is not valid JSON.
	 * @returns A promise that resolves to the parsed request body.
	 */
	parseBody = async () => {
		return new Promise((resolve, reject) => {
			let bodyRaw = "";

			this.req.on("data", (chunk) => {
				bodyRaw += chunk;
			});

			this.req.on("end", () => {
				let body: Record<string, any>;
				try {
					if (
						this.req.headers["content-type"]?.includes(
							"x-www-form-urlencoded",
						)
					) {
						// application/x-www-form-urlencoded => name=Pikachu&type=Electric
						body = Object.fromEntries(
							new URLSearchParams(bodyRaw).entries(),
						);
					} else {
						// application/json => {"name":"Pikachu","type":"Electric"}
						body = JSON.parse(bodyRaw);
					}
				} catch (error) {
					console.log("Error parsing JSON:", error);
					reject("Request body must be valid JSON");
					return;
				}

				this.body = body;
				resolve(body);
			});
		});
	};

	/**
	 * @returns The URL of the request as a URL object.
	 * @see https://nodejs.org/api/url.html#url_class_url
	 */
	getURL = () => {
		return new URL(this.req.url ?? "", `http://${this.req.headers.host}`);
	};

	/**
	 * Since HTML forms don't support PUT and DELETE methods, we need to
	 * use a hidden input field and send the method as a POST request.
	 * This method extracts the method from the request body if it exists.
	 * @returns The method of the request.
	 * @example <input type="hidden" name="method" value="PUT" />
	 */
	getMethod = () => {
		if (this.body) {
			return this.body.method ?? this.req.method;
		}

		return this.req.method;
	};

	/**
	 * @returns The search params of the request URL.
	 * @example http://localhost:3000/todos?completed=true => { completed: "true" }
	 */
	getSearchParams = () => {
		return this.getURL().searchParams;
	};

	/**
	 * @returns The ID from the request URL.
	 * @example http://localhost:3000/todos/1 => 1
	 */
	getId = () => {
		return Number(this.req.url?.split("/")[2]);
	};

	/**
	 * @returns The ID of the sub-todo from the request URL.
	 * @example http://localhost:3000/todos/1/sub-todos/2 => 2
	 */
	getSubTodoId = () => {
		return Number(this.req.url?.split("/")[4]);
	};

	accepts = (type: string) => {
		return this.req.headers.accept
			? this.req.headers.accept.includes(type)
			: false;
	};
}
