import Todo, { TodoProps } from "../models/Todo";
import postgres from "postgres";
import Request from "../router/Request";
import Response, { ContentType, StatusCode } from "../router/Response";
import Router from "../router/Router";
import { createUTCDate } from "../utils";
import render from "../views/View";
import View from "../views/View";
import { SubTodo } from "../models/Subtodo";
import { SubTodoProps } from "../models/Subtodo";

/**
 * Controller for handling Todo CRUD operations.
 * Routes are registered in the `registerRoutes` method.
 * Each method should be called when a request is made to the corresponding route.
 */
export default class SubTodoController {
	private sql: postgres.Sql<any>;

	constructor(sql: postgres.Sql<any>) {
		this.sql = sql;
	}

	/**
	 * To register a route, call the corresponding method on
	 * the router instance based on the HTTP method of the route.
	 *
	 * @param router Router instance to register routes on.
	 *
	 * @example router.get("/todos", this.getTodoList);
	 */
	registerRoutes(router: Router) { 
		//Subtodos routes:
		router.post("/todos/:id/subtodos", this.createSubtodo);
		router.get("/todos/:id/subtodos", this.getSubTodoList);
		router.put("/todos/:id/subtodos/:subid/complete", this.completeSubTodo);
	}

	//Subtodos:

	/**
	 * TODO: This method should be called when a POST request is made to /subtodos.
	 * It should create a new subtodo in the database and send it as a response.
	 *
	 * @param req The request object.
	 * @param res The response object.
	 *
	 * @example POST /subtodos
	 */
	createSubtodo = async (req: Request, res: Response) => {
		try {
			const todoId = req.getId(); // Access the todoId from the URL

			const subtodoData: SubTodoProps = {
				title: req.body.title,
				status: "incomplete",
				createdAt: createUTCDate(),
				todoId: todoId
			}
			if (!this.isValidSubTodoProps(subtodoData)) {
				//Verifying if it is a valid Subtodo Props passed
				await res.send({
					statusCode: StatusCode.BadRequest,
					message: "Request body must include title and description.",
				});
				return;
			}

			const newSubtodo = await SubTodo.create(this.sql, subtodoData);
			await res.send({
				statusCode: StatusCode.Redirect,
				message: "SubTodo created successfully!",
				redirect: `/todos/${todoId}`,
			});
		} catch (error) {
			console.log("Error creating the subtodo object: ", error);
			await res.send({
				statusCode: StatusCode.InternalServerError, 
				message: "Internal Server Error",
				template: "ErrorView",
			});
		}
	};

	/**
	 * TODO: Part 1: This method should be called when a GET request is made to /subtodos.
	 * It should retrieve all subtodos from the database and send them as a response.
	 * TODO: Part 2: This method should also support filtering and sorting. The status
	 * of the subtodos should be filterable using a query parameter `status` and
	 * the todos should be sortable using the query parameter `sortBy`.
	 *
	 * @param req The request object.
	 * @param res The response object.
	 *
	 * @example GET /subtodos
	 * @example GET /subtodos?status=complete
	 * @example GET /subtodos?sortBy=createdAt
	 */
	getSubTodoList = async (req: Request, res: Response) => {
		try {
			const todoId = req.getId(); //Id from the URL
			//Getting the parameters
			const statusFilter = req.getSearchParams().get("status") as | "incomplete" | "complete";
			const sortBy = req.getSearchParams().get("sortBy");

			if (
				statusFilter &&
				!["incomplete", "complete"].includes(statusFilter)
			) {
				await res.send({
					statusCode: StatusCode.BadRequest,
					message: "Invalid status",
				});
				return;
			}

			if (sortBy && !["createdAt", "dueAt"].includes(sortBy)) {
				await res.send({
					statusCode: StatusCode.BadRequest,
					message: "Invalid sortBy parameter",
				});
				return;
			}

			//filters based on status
			const filters: Partial<SubTodoProps> = statusFilter ? { status: statusFilter } : {};		//If statement

			const allSortedSubTodos: SubTodo[] = await SubTodo.readAll(
				this.sql,
				filters,
				sortBy as string,
			);

			const subtodosArray = allSortedSubTodos.map((subtodo) => subtodo.props);

			await res.send({
				statusCode: StatusCode.Redirect,
				message: "SubTodo list retrieved",
                redirect:`/todos/${todoId}`,
				payload: {subtodosArray}
			});
		} catch (error) {
			console.log("Error getting the subtodo list: ", error);
			await res.send({
				statusCode: StatusCode.InternalServerError,
				message: "Internal Server Error",
				template: "ErrorView",
			});
		}
	};

	/**
	 * TODO: This method should be called when a GET request is made to /subtodos/:id.
	 * It should retrieve a single subtodo from the database and send it as a response.
	 *
	 * @param req The request object.
	 * @param res The response object.
	 *
	 * @example GET /subtodos/1
	 */
	getSubTodo = async (req: Request, res: Response) => {
		try {
			const todoId = req.getId(); //Id from the URL
			if (isNaN(todoId) || todoId <= 0) {
				await res.send({
					statusCode: StatusCode.BadRequest, 
					message: "Invalid ID",
				});
				return;
			}

			const subtodo = await SubTodo.read(this.sql, todoId);

			if (!subtodo) {
				await res.send({
					statusCode: StatusCode.NotFound,
					message:  "SubTodo not found",
				});
				return;
			}

			await res.send({
				statusCode: StatusCode.OK,
				message:"SubTodo retrieved",
				payload: subtodo.props
			});
		} catch (error) {
			console.log("Error getting the subtodo object: ", error);
			await res.send({
				statusCode: StatusCode.InternalServerError,
				message: "Internal Server Error",
				template: "ErrorView",
			});
		}
	};

	/**
	 * TODO: This method should be called when a DELETE request is made to /subtodos/:id.
	 * It should delete an existing subtodo from the database.
	 *
	 * @param req The request object.
	 * @param res The response object.
	 *
	 * @example DELETE /subtodos/1
	 */
	deleteSubTodo = async (req: Request, res: Response) => {
		try {
			const todoId = req.getId(); //Gets the id from the URL

			if (isNaN(todoId) || todoId <= 0) {
				await res.send({
					statusCode: StatusCode.BadRequest,
					message: "Invalid ID",
				});
				return;
			}

			const existingSubTodo = await SubTodo.read(this.sql, todoId);

			if (!existingSubTodo) {
				await res.send({
					statusCode: StatusCode.NotFound,
					message: "SubTodo not found",
				});
				return;
			}

			await existingSubTodo.delete();

			await res.send({
				statusCode: StatusCode.OK,
				message: "SubTodo deleted successfully!",
			});
		} catch (error) {
			console.log("Error deleting the subtodo object: ", error);
			await res.send({
				statusCode: StatusCode.InternalServerError,
				message: "Internal Server Error",
				template: "ErrorView",
			});
		}
	};


	/**
	 * TODO: This method should be called when a PUT request is made to /subtodos/:id/complete.
	 * It should mark an existing subtodo as complete in the database and send it as a response.
	 *
	 * @param req The request object.
	 * @param res The response object.
	 *
	 * @example PUT /subtodos/1/complete
	 */
	completeSubTodo = async (req: Request, res: Response) => {
		try {
			const todoId = req.getId(); //Gest the id from the URL
			const subtodoId = req.getSubTodoId();

			if (isNaN(todoId) || todoId <= 0) {
				await res.send({
					statusCode: StatusCode.BadRequest,
					message:"Invalid ID",
				});
				return;
			}
			if (isNaN(subtodoId) || subtodoId <= 0) {
				await res.send({
					statusCode: StatusCode.BadRequest,
					message:"Invalid ID",
				});
				return;
			}

			const existingSubTodo = await SubTodo.read(this.sql, subtodoId);

			if (!existingSubTodo) {
				await res.send({
					statusCode: StatusCode.NotFound,
					message: "SubTodo not found",
				});
				return;
			}

			await existingSubTodo.markComplete();

			const { title, status, createdAt, completedAt } =
				existingSubTodo.props; //Variables from the subtodo props, works for sending

			await res.send({
				statusCode: StatusCode.Redirect,
				message: "SubTodo marked as complete!",
				redirect: `/todos/${todoId}`,
				//payload: existingSubTodo.props,
			});
		} catch (error) {
			console.log("Error completing the subtodo object: ", error);
			await res.send({
				statusCode: StatusCode.InternalServerError,
				message: "Internal Server Error",
				template: "ErrorView",
			});
		}
	};
	/**
	 * This is something called a type guard. It's a function that checks if a
	 * given object is of a certain type. If the object is of that type, the
	 * function returns true, otherwise it returns false. This is useful for
	 * checking if the request body is a valid SubTodoProps object.
	 * @param props Must be `any` type because we don't know what the request body will be.
	 * @returns Whether or not the given object is a valid TodoProps object.
	 * @see https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates
	 */
	isValidSubTodoProps = (props: any): props is SubTodoProps => {
		return (
			props.hasOwnProperty("title") &&
			props.hasOwnProperty("status") &&
			props.hasOwnProperty("createdAt") &&
			typeof props.title === "string" &&
			typeof props.status === "string"
		);
	};


}
