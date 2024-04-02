import postgres from "postgres";
import Todo, { TodoProps } from "../src/models/Todo";
import SubTodo, { SubTodoProps } from "../src/models/Todo";
import Server from "../src/Server";
import { StatusCode } from "../src/router/Response";
import { HttpResponse, makeHttpRequest } from "./client";
import { test, describe, expect, afterEach, afterAll, beforeAll } from "vitest";
import { createUTCDate } from "../src/utils";

describe("Todo HTTP operations", () => {
	const sql = postgres({
		database: "TodoDB",
	});

	const server = new Server({
		host: "localhost",
		port: 3000,
		sql,
	});

	/**
	 * Helper function to create a Todo with default or provided properties.
	 * @see https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype
	 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Logical_OR#short-circuit_evaluation
	 * @param props The properties of the Todo.
	 * @default title: "Test Todo"
	 * @default description: "This is a test todo"
	 * @default status: "incomplete"
	 * @default dueAt: A week from today
	 * @default createdAt: The current date/time
	 * @returns A new Todo object that has been persisted in the DB.
	 */
	const createTodo = async (props: Partial<TodoProps> = {}) => {
		const todoProps: TodoProps = {
			title: props.title || "Test Todo",
			description: props.description || "This is a test todo",
			status: props.status || "incomplete",
			dueAt:
				props.dueAt ||
				createUTCDate(
					new Date(new Date().setDate(new Date().getDate() + 7)),
				),
			createdAt: props.createdAt || createUTCDate(),
		};

		return await Todo.create(sql, todoProps);
	};

	beforeAll(async () => {
		await server.start();
	});

	/**
	 * Clean up the database after each test. This function deletes all the rows
	 * from the todos and subtodos tables and resets the sequence for each table.
	 * @see https://www.postgresql.org/docs/13/sql-altersequence.html
	 */
	afterEach(async () => {
		const tables = ["todos", "subtodos"];

		try {
			for (const table of tables) {
				await sql.unsafe(`DELETE FROM ${table}`);
				await sql.unsafe(
					`ALTER SEQUENCE ${table}_id_seq RESTART WITH 1;`,
				);
			}
		} catch (error) {
			console.error(error);
		}
	});

	// Close the connection to the DB after all tests are done.
	afterAll(async () => {
		await sql.end();
		await server.stop();
	});

	test("Homepage was retrieved successfully.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/",
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe("Homepage!");
	});

	test("Invalid path returned error.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/tods",
		);

		expect(statusCode).toBe(StatusCode.NotFound);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(false);
		expect(body.message).toBe("Invalid route: GET /tods");
	});

	test("Todo was created.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/todos",
			{
				title: "Test Todo",
				description: "This is a test todo",
				dueAt: createUTCDate(
					new Date(new Date().setDate(new Date().getDate() + 7)),
				),
			},
		);

		expect(statusCode).toBe(StatusCode.Created);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe("Todo created successfully!");
		expect(Object.keys(body.payload.todo).includes("id")).toBe(true);
		expect(Object.keys(body.payload.todo).includes("title")).toBe(true);
		expect(Object.keys(body.payload.todo).includes("description")).toBe(
			true,
		);
		expect(body.payload.todo.id).toBe(1);
		expect(body.payload.todo.title).toBe("Test Todo");
		expect(body.payload.todo.description).toBe("This is a test todo");
		expect(body.payload.todo.status).toBe("incomplete");
		expect(body.payload.todo.createdAt).not.toBeNull();
		expect(body.payload.todo.dueAt).not.toBeNull();
		expect(body.payload.todo.editedAt).toBeNull();
		expect(body.payload.todo.completedAt).toBeNull();
	});

	test("Todo was not created due to missing title.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/todos",
			{
				description: "This is a test todo",
				dueAt: createUTCDate(
					new Date(new Date().setDate(new Date().getDate() + 7)),
				),
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(Object.keys(body).includes("message")).toBe(true);
		expect(Object.keys(body).includes("payload")).toBe(true);
		expect(body.message).toBe(
			"Request body must include title and description.",
		);
		expect(body.payload.todo).toBeUndefined();
	});

	test("Todo was retrieved.", async () => {
		const todo = await createTodo();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			`/todos/${todo.props.id}`,
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("Todo retrieved");
		expect(body.payload.todo.title).toBe(todo.props.title);
		expect(body.payload.todo.description).toBe(todo.props.description);
		expect(body.payload.todo.status).toBe(todo.props.status);
		expect(body.payload.todo.createdAt).toBe(
			todo.props.createdAt.toISOString(),
		);
		expect(body.payload.todo.dueAt).toBe(todo.props.dueAt?.toISOString());
		expect(body.payload.todo.editedAt).toBeNull();
		expect(body.payload.todo.completedAt).toBeNull();
	});

	test("Todo was not retrieved due to invalid ID.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/todos/abc",
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Invalid ID");
		expect(body.payload).toBeUndefined();
	});

	test("Todo was not retrieved due to non-existent ID.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/todos/1",
		);

		expect(statusCode).toBe(StatusCode.NotFound);
		expect(body.message).toBe("Not found");
		expect(body.payload).toBeUndefined();
	});

	test("Todo was updated.", async () => {
		const todo = await createTodo();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			`/todos/${todo.props.id}`,
			{
				title: "Updated Test Todo",
			},
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("Todo updated successfully!");
		expect(body.payload.todo.title).toBe("Updated Test Todo");
		expect(body.payload.todo.description).toBe(todo.props.description);
		expect(body.payload.todo.status).toBe(todo.props.status);
		expect(body.payload.todo.createdAt).toBe(
			todo.props.createdAt.toISOString(),
		);
		expect(body.payload.todo.dueAt).toBe(todo.props.dueAt?.toISOString());
		expect(body.payload.todo.editedAt).not.toBeNull();
		expect(body.payload.todo.completedAt).toBeNull();
	});

	test("Todo was not updated due to invalid ID.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			"/todos/abc",
			{
				title: "Updated Test Todo",
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Invalid ID");
		expect(body.payload).toBeUndefined();
	});

	test("Todo was not updated due to non-existent ID.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			"/todos/1",
			{
				title: "Updated Test Todo",
			},
		);

		expect(statusCode).toBe(StatusCode.NotFound);
		expect(body.message).toBe("Not found");
		expect(body.payload).toBeUndefined();
	});

	test("Todo was deleted.", async () => {
		const todo = await createTodo();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"DELETE",
			`/todos/${todo.props.id}`,
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("Todo deleted successfully!");
	});

	test("Todo was not deleted due to invalid ID.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"DELETE",
			"/todos/abc",
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Invalid ID");
		expect(body.payload).toBeUndefined();
	});

	test("Todo was not deleted due to non-existent ID.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"DELETE",
			"/todos/1",
		);

		expect(statusCode).toBe(StatusCode.NotFound);
		expect(body.message).toBe("Not found");
		expect(body.payload).toBeUndefined();
	});

	test("Todo was marked as complete.", async () => {
		const todo = await createTodo();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			`/todos/${todo.props.id}/complete`,
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("Todo marked as complete!");
		expect(body.payload.todo.status).toBe("complete");
		expect(body.payload.todo.completedAt).not.toBeNull();
		expect(body.payload.todo.editedAt).not.toBe(todo.props.editedAt);
	});

	test("Todo was not marked as complete due to invalid ID.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			"/todos/abc/complete",
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Invalid ID");
		expect(body.payload).toBeUndefined();
	});

	test("Todo was not marked as complete due to non-existent ID.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			"/todos/1/complete",
		);

		expect(statusCode).toBe(StatusCode.NotFound);
		expect(body.message).toBe("Not found");
		expect(body.payload).toBeUndefined();
	});

	test("Todos were listed.", async () => {
		const todo1 = await createTodo();
		const todo2 = await createTodo();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/todos",
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("Todo list retrieved");
		expect(body.payload.todos).toBeInstanceOf(Array);
		expect(body.payload.todos[0].title).toBe(todo1.props.title);
		expect(body.payload.todos[0].description).toBe(todo1.props.description);
		expect(body.payload.todos[0].status).toBe(todo1.props.status);
		expect(body.payload.todos[0].createdAt).toBe(
			todo1.props.createdAt.toISOString(),
		);
		expect(body.payload.todos[0].dueAt).toBe(
			todo1.props.dueAt?.toISOString(),
		);
		expect(body.payload.todos[0].editedAt).toBeNull();
		expect(body.payload.todos[0].completedAt).toBeNull();
		expect(body.payload.todos[1].title).toBe(todo2.props.title);
		expect(body.payload.todos[1].description).toBe(todo2.props.description);
		expect(body.payload.todos[1].status).toBe(todo2.props.status);
		expect(body.payload.todos[1].createdAt).toBe(
			todo2.props.createdAt.toISOString(),
		);
		expect(body.payload.todos[1].dueAt).toBe(
			todo2.props.dueAt?.toISOString(),
		);
		expect(body.payload.todos[1].editedAt).toBeNull();
		expect(body.payload.todos[1].completedAt).toBeNull();
	});

	test("Todos were listed by completion status.", async () => {
		const todo1 = await createTodo();
		await createTodo();
		await createTodo();
		await makeHttpRequest("PUT", `/todos/${todo1.props.id}/complete`);
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/todos?status=complete",
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("Todo list retrieved");
		expect(body.payload.todos).toBeInstanceOf(Array);
		expect(body.payload.todos).toHaveLength(1);
		expect(body.payload.todos[0].title).toBe(todo1.props.title);
		expect(body.payload.todos[0].description).toBe(todo1.props.description);
		expect(body.payload.todos[0].status).toBe("complete");
		expect(body.payload.todos[0].createdAt).toBe(
			todo1.props.createdAt.toISOString(),
		);
		expect(body.payload.todos[0].dueAt).toBe(
			todo1.props.dueAt?.toISOString(),
		);
		expect(body.payload.todos[0].editedAt).not.toBeNull();
		expect(body.payload.todos[0].completedAt).not.toBeNull();
	});

	test("Todos were not listed due to invalid status.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/todos?status=abc",
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Invalid filter parameter.");
		expect(body.payload).toBeUndefined();
	});

	test("Todos were listed by due date.", async () => {
		const todo1 = await createTodo({
			title: "Todo 1",
			dueAt: createUTCDate(new Date("2021-12-31")),
		});
		const todo2 = await createTodo({
			title: "Todo 2",
			dueAt: createUTCDate(new Date("2022-02-01")),
		});
		const todo3 = await createTodo({
			title: "Todo 3",
			dueAt: createUTCDate(new Date("2022-01-12")),
		});
		const todo4 = await createTodo({
			title: "Todo 4",
			dueAt: createUTCDate(new Date("2022-01-01")),
		});
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			`/todos?sortBy=dueAt`,
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("Todo list retrieved");
		expect(body.payload.todos).toBeInstanceOf(Array);
		expect(body.payload.todos).toHaveLength(4);
		expect(body.payload.todos[0].title).toBe(todo1.props.title);
		expect(body.payload.todos[1].title).toBe(todo4.props.title);
		expect(body.payload.todos[2].title).toBe(todo3.props.title);
		expect(body.payload.todos[3].title).toBe(todo2.props.title);
	});

	test("SubTodo was added to the Todo.", async () => {
		const todo = await createTodo();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			`/todos/${todo.props.id}/subtodos`,
			{
				title: "Test SubTodo",
				status: "incomplete",
				createdAt: createUTCDate(),
			},
		);

		expect(statusCode).toBe(StatusCode.Created);
		expect(body.message).toBe("SubTodo created successfully!");
		expect(Object.keys(body.payload.subTodo).includes("id")).toBe(true);
		expect(Object.keys(body.payload.subTodo).includes("title")).toBe(true);
		expect(Object.keys(body.payload.subTodo).includes("status")).toBe(true);
		expect(Object.keys(body.payload.subTodo).includes("createdAt")).toBe(
			true,
		);
		expect(Object.keys(body.payload.subTodo).includes("todoId")).toBe(true);
		expect(Object.keys(body.payload.subTodo).includes("description")).toBe(
			false,
		);
		expect(body.payload.subTodo.title).toBe("Test SubTodo");
		expect(body.payload.subTodo.status).toBe("incomplete");
		expect(body.payload.subTodo.todoId).toBe(todo.props.id);
	});

	test("SubTodo was not added to the Todo due to invalid ID.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/todos/abc/subtodos",
			{
				title: "Test SubTodo",
				status: "incomplete",
				createdAt: createUTCDate(),
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Invalid ID");
		expect(body.payload).toBeUndefined();
	});

	test("SubTodo was not added to the Todo due to non-existent ID.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"POST",
			"/todos/1/subtodos",
			{
				title: "Test SubTodo",
				status: "incomplete",
				createdAt: createUTCDate(),
			},
		);

		expect(statusCode).toBe(StatusCode.NotFound);
		expect(body.message).toBe("Todo not found");
		expect(body.payload).toBeUndefined();
	});

	test("SubTodos were listed for the Todo.", async () => {
		const todo = await createTodo();
		const subTodoProps: SubTodoProps = {
			title: "SubTodo 1",
			status: "incomplete",
			createdAt: createUTCDate(),
			todoId: todo.props.id!,
		};

		await todo.addSubTodo(subTodoProps);

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			`/todos/${todo.props.id}/subtodos`,
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("SubTodo list retrieved");
		expect(body.payload.subTodos).toBeInstanceOf(Array);
		expect(body.payload.subTodos[0].title).toBe(subTodoProps.title);
		expect(body.payload.subTodos[0].status).toBe(subTodoProps.status);
		expect(body.payload.subTodos[0].createdAt).not.toBeNull();
		expect(body.payload.subTodos[0].todoId).toBe(subTodoProps.todoId);
	});

	test("SubTodos were not listed due to invalid ID.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/todos/abc/subtodos",
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Invalid ID");
		expect(body.payload).toBeUndefined();
	});

	test("SubTodos were not listed due to non-existent ID.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			`/todos/1/subtodos`,
		);

		expect(statusCode).toBe(StatusCode.NotFound);
		expect(body.message).toBe("Todo not found");
		expect(body.payload).toBeUndefined();
	});

	test("SubTodo was retrieved.", async () => {
		const todo = await createTodo();
		const subTodoProps: SubTodoProps = {
			title: "SubTodo 1",
			status: "incomplete",
			createdAt: createUTCDate(),
			todoId: todo.props.id!,
		};

		await todo.addSubTodo(subTodoProps);

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			`/todos/${todo.props.id}/subtodos/1`,
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("SubTodo retrieved");
		expect(body.payload.subTodo).not.toBeInstanceOf(Array);
		expect(Object.keys(body.payload.subTodo).includes("id")).toBe(true);
		expect(Object.keys(body.payload.subTodo).includes("title")).toBe(true);
		expect(Object.keys(body.payload.subTodo).includes("status")).toBe(true);
		expect(Object.keys(body.payload.subTodo).includes("createdAt")).toBe(
			true,
		);
		expect(Object.keys(body.payload.subTodo).includes("todoId")).toBe(true);
		expect(body.payload.subTodo.title).toBe(subTodoProps.title);
		expect(body.payload.subTodo.status).toBe(subTodoProps.status);
		expect(body.payload.subTodo.createdAt).not.toBeNull();
		expect(body.payload.subTodo.todoId).toBe(subTodoProps.todoId);
	});

	test("SubTodo was not retrieved due to invalid ID.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			"/todos/abc/subtodos/1",
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Invalid ID");
		expect(body.payload).toBeUndefined();
	});

	test("SubTodo was not retrieved due to non-existent ID.", async () => {
		const todo = await createTodo();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"GET",
			`/todos/${todo.props.id}/subtodos/1`,
		);

		expect(statusCode).toBe(StatusCode.NotFound);
		expect(body.message).toBe("SubTodo not found");
		expect(body.payload).toBeUndefined();
	});

	test("SubTodo was updated.", async () => {
		const todo = await createTodo();
		const subTodoProps: SubTodoProps = {
			title: "SubTodo 1",
			status: "incomplete",
			createdAt: createUTCDate(),
			todoId: todo.props.id!,
		};

		await todo.addSubTodo(subTodoProps);

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			`/todos/${todo.props.id}/subtodos/1`,
			{
				title: "Updated Test SubTodo",
			},
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("SubTodo updated successfully!");
		expect(body.payload.subTodo.title).toBe("Updated Test SubTodo");
		expect(body.payload.subTodo.status).toBe("incomplete");
		expect(body.payload.subTodo.createdAt).not.toBeNull();
		expect(body.payload.subTodo.editedAt).not.toBeNull();
		expect(body.payload.subTodo.todoId).toBe(todo.props.id);
		expect(Object.keys(body.payload.subTodo).includes("description")).toBe(
			false,
		);
	});

	test("SubTodo was not updated due to invalid ID.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			"/todos/abc/subtodos/1",
			{
				title: "Updated Test SubTodo",
			},
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Invalid ID");
		expect(body.payload).toBeUndefined();
	});

	test("SubTodo was not updated due to non-existent ID.", async () => {
		const todo = await createTodo();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			`/todos/${todo.props.id}/subtodos/1`,
			{
				title: "Updated Test SubTodo",
			},
		);

		expect(statusCode).toBe(StatusCode.NotFound);
		expect(body.message).toBe("SubTodo not found");
		expect(body.payload).toBeUndefined();
	});

	test("SubTodo was deleted.", async () => {
		const todo = await createTodo();
		const subTodoProps: SubTodoProps = {
			title: "SubTodo 1",
			status: "incomplete",
			createdAt: createUTCDate(),
			todoId: todo.props.id!,
		};

		await todo.addSubTodo(subTodoProps);

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"DELETE",
			`/todos/${todo.props.id}/subtodos/1`,
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("SubTodo deleted successfully!");
	});

	test("SubTodo was not deleted due to invalid ID.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"DELETE",
			"/todos/abc/subtodos/1",
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Invalid ID");
		expect(body.payload).toBeUndefined();
	});

	test("SubTodo was not deleted due to non-existent ID.", async () => {
		const todo = await createTodo();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"DELETE",
			`/todos/${todo.props.id}/subtodos/1`,
		);

		expect(statusCode).toBe(StatusCode.NotFound);
		expect(body.message).toBe("SubTodo not found");
		expect(body.payload).toBeUndefined();
	});

	test("SubTodo was marked as complete.", async () => {
		const todo = await createTodo();
		const subTodoProps: SubTodoProps = {
			title: "SubTodo 1",
			status: "incomplete",
			createdAt: createUTCDate(),
			todoId: todo.props.id!,
		};

		await todo.addSubTodo(subTodoProps);

		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			`/todos/${todo.props.id}/subtodos/1/complete`,
		);

		expect(statusCode).toBe(StatusCode.OK);
		expect(body.message).toBe("SubTodo marked as complete!");
		expect(body.payload.subTodo.status).toBe("complete");
		expect(body.payload.subTodo.completedAt).not.toBeNull();
	});

	test("SubTodo was not marked as complete due to invalid ID.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			"/todos/abc/subtodos/1/complete",
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Invalid ID");
		expect(body.payload).toBeUndefined();
	});

	test("SubTodo was not marked as complete due to non-existent ID.", async () => {
		const todo = await createTodo();
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			`/todos/${todo.props.id}/subtodos/1/complete`,
		);

		expect(statusCode).toBe(StatusCode.NotFound);
		expect(body.message).toBe("SubTodo not found");
		expect(body.payload).toBeUndefined();
	});

	test("SubTodo was not marked as complete due to non-existent Todo ID.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			"/todos/1/subtodos/1/complete",
		);

		expect(statusCode).toBe(StatusCode.NotFound);
		expect(body.message).toBe("Todo not found");
		expect(body.payload).toBeUndefined();
	});

	test("SubTodo was not marked as complete due to invalid Todo ID.", async () => {
		const { statusCode, body }: HttpResponse = await makeHttpRequest(
			"PUT",
			"/todos/abc/subtodos/1/complete",
		);

		expect(statusCode).toBe(StatusCode.BadRequest);
		expect(body.message).toBe("Invalid ID");
		expect(body.payload).toBeUndefined();
	});
});
