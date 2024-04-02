import http, { IncomingMessage } from "http";

export interface HttpResponse {
	statusCode: number | undefined;
	body: any;
}

export const makeHttpRequest = async (
	method: string,
	path: string,
	data = {},
): Promise<HttpResponse> => {
	const options = {
		host: "localhost",
		port: 3000,
		path,
		method,
		headers: {
			"Content-Type": "application/json",
			"Content-Length": Buffer.byteLength(JSON.stringify(data)),
		},
	};

	return new Promise((resolve, reject) => {
		let body = "";
		const request = http.request(options, (response: IncomingMessage) => {
			response.on("data", (chunk) => {
				body += chunk;
			});
			response.on("end", () =>
				resolve({
					statusCode: response.statusCode,
					body: JSON.parse(body),
				}),
			);
		});

		request.on("error", (err) => reject(err));
		request.write(JSON.stringify(data));
		request.end();
	});
};
