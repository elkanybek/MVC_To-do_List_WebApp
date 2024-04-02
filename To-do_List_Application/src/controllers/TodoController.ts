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
export default class TodoController {
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
		router.get("/todos", this.getTodoList);
		router.post("/todos", this.createTodo);
		
		router.get("/todos/new", this.sendFormCreate);
		router.get("/todos/:id/edit", this.sendFormEdit);

		// Any routes that include a `:id` parameter should be registered last.
		router.get("/todos/:id", this.getTodo);
		router.put("/todos/:id", this.updateTodo);
		router.del("/todos/:id", this.deleteTodo);
		router.put("/todos/:id/complete", this.completeTodo);
	}

	/**
	 * Part 1: This method should be called when a GET request is made to /todos.
	 * It should retrieve all todos from the database and send them as a response.
	 * Part 2: This method should also support filtering and sorting. The status
	 * of the todos should be filterable using a query parameter `status` and
	 * the todos should be sortable using the query parameters `sortBy` and `sortOrder`.
	 *
	 * @param req The request object.
	 * @param res The response object.
	 *
	 * @example GET /todos
	 * @example GET /todos?status=complete
	 * @example GET /todos?sortBy=createdAt&sortOrder=ASC
	 */
	getTodoList = async (req: Request, res: Response) => {
		const queryParams = req.getSearchParams();

		const statusFilter = queryParams.get("status") as
			| TodoProps["status"]
			| undefined;
		const sortBy = queryParams.get("sortBy") ?? "id";
		const orderBy = queryParams.get("orderBy") ?? "asc";
		let todos: Todo[] = [];

		if (
			statusFilter &&
			statusFilter !== "incomplete" &&
			statusFilter !== "complete"
		) {
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Invalid filter parameter.",
			});
			return;
		}

		if (sortBy && !this.isSortByValid(sortBy)) {
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Invalid sortBy parameter.",
			});
			return;
		}

		if (orderBy && !this.isOrderByValid(orderBy)) {
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Invalid orderBy parameter.",
			});
			return;
		}

		try {
			todos = await Todo.readAll(
				this.sql,
				{ status: statusFilter },
				sortBy,
				orderBy,
			);
		} catch (error) {
			const message = `Error while getting todo list: ${error}`;
			console.error(message);
			await res.send({
				statusCode: StatusCode.InternalServerError,
				message: "Internal Server Error",
				template: "ErrorView",
			});
		}
		
		await res.send({
			statusCode: StatusCode.OK,
			message: "Todo list retrieved",
			template: "ListView",
			payload: { todos: todos.map((todo) => todo.props) },
		});
	};

	/**
	 * This method should be called when a GET request is made to /todos/:id.
	 * It should retrieve a single todo from the database and send it as a response.
	 *
	 * @param req The request object.
	 * @param res The response object.
	 *
	 * @example GET /todos/1
	 */
	getTodo = async (req: Request, res: Response) => {
		const id = req.getId();

		if (isNaN(id)) {
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Invalid ID",
			});
			return;
		}

		let todo: Todo | null = null;

		try {
			todo = await Todo.read(this.sql, id);
		} catch (error) {
			const message = `Error while getting todo list: ${error}`;
			console.error(message);
			await res.send({
				statusCode: StatusCode.InternalServerError,
				message: "Internal Server Error",
				template: "ErrorView",
			});
		}

		if (todo) {
			console.log(todo);
			await res.send({
				statusCode: StatusCode.OK,
				message: "Todo retrieved",
				template: "ShowView",
				payload: { 
					todo: todo.props,
					subtodos: todo.props.subTodos,
				},
			});
		} else {
			await res.send({
				statusCode: StatusCode.NotFound,
				message: "Not found",
			});
		}
	};

	/**
	 * This method should be called when the user wants a new form to create a new Todo in the database.
	 * @param res The response object.
	 *
	 * @example GET /todos/new
	 */
	sendFormCreate = async (req: Request, res: Response) => {
		await res.send({
			statusCode: StatusCode.OK,
			message: "Form served successfully!",
			template: "NewFormView",
		});
	};

	/**
	 * This method should be called when a POST request is made to /todos.
	 * It should create a new todo in the database and send it as a response.
	 *
	 * @param req The request object.
	 * @param res The response object.
	 *
	 * @example POST /todos { "title": "New Todo", "description": "A new todo" }
	 */
	createTodo = async (req: Request, res: Response) => {
		let todo: Todo | null = null;
		let todoProps: TodoProps = {
			title: req.body.title,
			description: req.body.description,
			status: "incomplete",
			createdAt: createUTCDate(),
		};

		if (req.body.dueAt) {
			todoProps.dueAt = createUTCDate(new Date(req.body.dueAt));
		}

		if (!todoProps.title || !todoProps.description) {
			const errorMessage = "Title and description are required.";
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Request body must include title and description.",
				template: "NewFormView",
				payload: { errorMessage: errorMessage },
			});
			return;
		}

		try {
			todo = await Todo.create(this.sql, todoProps);
		} catch (error) {
			console.error("Error while creating todo:", error);
		}

		if (!todo) {
			await res.send({
				statusCode: StatusCode.InternalServerError,
				message: "Error while creating todo",
				template: "ErrorView",
			});
			return;
		}
		await res.send({
			statusCode: StatusCode.Redirect,
			message: "Todo created successfully!",
			redirect: `/todos/${todo.props.id}`,
		});
	};

	sendFormEdit = async (req: Request, res: Response) => {
		const id = req.getId();

		if (isNaN(id)) {
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Invalid ID",
			});
			return;
		}

		try {
			const todo = await Todo.read(this.sql, id);
			if (todo) {
				await res.send({
					statusCode: StatusCode.OK,
					message: "Edit Todo",
					template: "EditFormView",
					payload: { todo: todo.props },
				});

				if(req.body._method === "DELETE"){
					if (await todo.delete()) {
						await res.send({
							statusCode: StatusCode.Redirect,
							message: "Todo deleted successfully!",
							redirect: `/todos`,
						});
					} else {
						await res.send({
							statusCode: StatusCode.InternalServerError,
							message: "Error while deleting todo",
						});
					}
				}

				if(req.body._method === "PUT"){
					try{
						await todo.markComplete();
						await res.send({
							statusCode: StatusCode.Redirect,
							message: "Todo completed successfully!",
							redirect: `/todos`,
						});
					}
					catch{
						await res.send({
							statusCode: StatusCode.InternalServerError,
							message: "Error while deleting todo",
						});
					}
				}
			} 
			else {
				await res.send({
					statusCode: StatusCode.NotFound,
					message: "Todo not found",
				});
			}
		} catch (error) {
			console.error("Error while fetching todo for edit:", error);
			await res.send({
				statusCode: StatusCode.InternalServerError,
				message: "Error while fetching todo for edit",
				template:"ErrorView",
			});
		}
	};

	updateTodo = async (req: Request, res: Response) => {
		const id = req.getId();

		if (isNaN(id)) {
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Invalid ID",
			});
			return;
		}

		const todoProps: Partial<TodoProps> = {
			title: req.body.title,
			description: req.body.description,
		};

		if (req.body.dueAt) {
			todoProps.dueAt = createUTCDate(new Date(req.body.dueAt));
		}

		// Check if title and description are provided in the request body
		if (!req.body.title || !req.body.description) {
			await res.send({
				statusCode: StatusCode.BadRequest,
				message:
					"Title and description are required for updating the todo.",
			});
			return;
		}

		try {
			const todo = await Todo.read(this.sql, id);
			if (todo) {
				await todo.update(todoProps);
				await res.send({
					statusCode: StatusCode.Redirect,
					message: "Todo updated successfully!",
					redirect: `/todos/${todo.props.id}`,
				});
			} else {
				await res.send({
					statusCode: StatusCode.NotFound,
					message: "Not found",
				});
			}
		} catch (error) {
			console.error("Error while updating todo:", error);
			await res.send({
				statusCode: StatusCode.InternalServerError,
				message: "Error while updating todo",
				template:"ErrorView",
			});
		}
	};

	/**
	 * This method should be called when a DELETE request is made to /todos/:id.
	 * It should delete an existing todo from the database.
	 *
	 * @param req The request object.
	 * @param res The response object.
	 *
	 * @example DELETE /todos/1
	 */
	deleteTodo = async (req: Request, res: Response) => {
		const id = req.getId();

		if (isNaN(id)) {
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Invalid ID",
			});
			return;
		}

		try {
			const todo = await Todo.read(this.sql, id);
			if (!todo) {
				await res.send({
					statusCode: StatusCode.NotFound,
					message: "Not found",
				});
				return;
			}

			if (await todo.delete()) {
				await res.send({
					statusCode: StatusCode.Redirect,
					message: "Todo deleted successfully!",
					redirect: `/todos`,
				});
			} else {
				await res.send({
					statusCode: StatusCode.InternalServerError,
					message: "Error while deleting todo.",
				});
			}
		} catch (error) {
			console.error("Error while deleting todo:", error);
			await res.send({
				statusCode: StatusCode.InternalServerError,
				message: "Error while deleting todo",
				template:"ErrorView",
			});
		}
	};
	
	
	//For the Mark Complete, i tried to add emoji and do a line through but it seems of not working so i just right away
	//display to the user their todo and subtodo status Ex: status: complete.
	
	/**
	 * This method should be called when a PUT request is made to /todos/:id/complete.
	 * It should mark an existing todo as complete in the database and send it as a response.
	 *
	 * @param req The request object.
	 * @param res The response object.
	 *
	 * @example PUT /todos/1/complete
	 */
	completeTodo = async (req: Request, res: Response) => {
		const id = req.getId();
	
		if (isNaN(id)) {
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Invalid ID",
			});
			return;
		}
	
		try {
			const todo = await Todo.read(this.sql, id);
			if (todo) {
				await todo.markComplete();
				const markComplete = todo.props.status === "complete" ? "✅" : ""; // Check status to determine if emoji should be included
				await res.send({
					statusCode: StatusCode.Redirect,
					message: "Todo marked as complete!",
					redirect: `/todos/${todo.props.id}`,
					payload: { markComplete }, // Include markComplete in payload object
				});
			} else {
				await res.send({
					statusCode: StatusCode.NotFound,
					message: "Not found",
				});
			}
		} catch (error) {
			console.error("Error while marking todo as complete:", error);
			await res.send({
				statusCode: StatusCode.InternalServerError,
				message: "Error while marking todo as complete",
				template: "ErrorView"
			});
		}
	};
	

	/**
	 * This is something called a type guard. It's a function that checks if a
	 * given object is of a certain type. If the object is of that type, the
	 * function returns true, otherwise it returns false. This is useful for
	 * checking if the request body is a valid TodoProps object.
	 * @param props Must be `any` type because we don't know what the request body will be.
	 * @returns Whether or not the given object is a valid TodoProps object.
	 * @see https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates
	 */
	isValidTodoProps = (props: any): props is TodoProps => {
		return (
			props.hasOwnProperty("title") &&
			props.hasOwnProperty("description") &&
			typeof props.title === "string" &&
			typeof props.description === "string"
		);
	};

	isSortByValid = (sortBy: string | undefined): boolean => {
		return (
			sortBy === "id" ||
			sortBy === "title" ||
			sortBy === "description" ||
			sortBy === "dueAt" ||
			sortBy === "createdAt" ||
			sortBy === "updatedAt"
		);
	};

	isOrderByValid = (orderBy: string | undefined): boolean => {
		return orderBy === "asc" || orderBy === "desc";
	};
}