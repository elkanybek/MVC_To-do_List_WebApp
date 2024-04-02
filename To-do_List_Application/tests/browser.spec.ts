import { test, expect } from "@playwright/test";
import { getPath } from "../src/url";
import postgres from "postgres";
import Todo, { TodoProps } from "../src/models/Todo";
import { createUTCDate } from "../src/utils";
//import SubTodo, { SubTodoProps } from "../src/models/Subtodo";
const sql = postgres({
	database: "TodoDB",
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

/**
 * Clean up the database after each test. This function deletes all the rows
 * from the todos and subtodos tables and resets the sequence for each table.
 * @see https://www.postgresql.org/docs/13/sql-altersequence.html
 */
test.afterEach(async () => {
	const tables = ["todos", "subtodos"];

	try {
		for (const table of tables) {
			await sql.unsafe(`DELETE FROM ${table}`);
			await sql.unsafe(`ALTER SEQUENCE ${table}_id_seq RESTART WITH 1;`);
		}
	} catch (error) {
		console.error(error);
	}
});

// Close the connection to the DB after all tests are done.
test.afterAll(async () => {
	await sql.end();
});

test("Homepage was retrieved successfully.", async ({ page }) => {
	await page.goto("/");

	expect(await page?.title()).toBe("Todo App");
});

test("Todo retrieved successfully.", async ({ page }) => {
	const todo = await createTodo();

	await page.goto(`todos/${todo.props.id}`);

	const titleElement = await page.$("#title");
	const descriptionElement = await page.$("#description");

	/**
	 * This CSS selector is using the attribute selector to find an element
	 * with the status attribute set to the value of the todo's status.
	 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors
	 */
	const statusElement = await page.$(`[status="${todo.props.status}"]`);

	expect(await titleElement?.innerText()).toBe(todo.props.title);
	expect(await descriptionElement?.innerText()).toBe(todo.props.description);
	expect(await statusElement?.innerText()).not.toBeNull();
});

test("All Todos were retrieved.", async ({ page }) => {
	const todos = [await createTodo(), await createTodo(), await createTodo()];

	await page.goto("/todos");

	const h1 = await page.$("h1");
	const todoElements = await page.$$("[todo-id]");

	expect(await h1?.innerText()).toMatch("Todos");
	expect(todoElements.length).toBe(todos.length);

	for (let i = 0; i < todoElements.length; i++) {
		const status = await todoElements[i].getAttribute("status");
		expect(await todoElements[i].innerText()).toMatch(todos[i].props.title);
		expect(status).toMatch(todos[i].props.status);
	}
});

test("Todo created successfully.", async ({ page }) => {
	const todo = {
		title: "Test Todo",
		description: "This is a test todo",
		status: "incomplete",
	};

	await page.goto("/todos/new");

	const h1 = await page.$("h1");
	expect(await h1?.innerText()).toMatch("Create Todo");

	await page.fill('form#new-todo-form input[name="title"]', todo.title);
	await page.fill(
		'form#new-todo-form textarea[name="description"]',
		todo.description,
	);
	await page.click("form#new-todo-form #new-todo-form-submit-button");

	expect(await page?.url()).toBe(getPath(`todos/1`));

	const titleElement = await page.$("#title");
	const descriptionElement = await page.$("#description");
	const statusElement = await page.$(`[status="${todo.status}"]`);

	expect(await titleElement?.innerText()).toBe(todo.title);
	expect(await descriptionElement?.innerText()).toBe(todo.description);
	expect(statusElement).not.toBeNull();
});

test("Todo updated successfully.", async ({ page }) => {
	const todo = await createTodo();

	await page.goto(`todos/${todo.props.id}/edit`);

	const h1 = await page.$("h1");

	expect(await h1?.innerText()).toMatch("Edit Todo");

	const newTitle = "Updated Test Todo";
	const newDescription = "This is an updated test todo";

	await page.fill('form#edit-todo-form input[name="title"]', newTitle);
	await page.fill(
		'form#edit-todo-form textarea[name="description"]',
		newDescription,
	);
	await page.click("form#edit-todo-form #edit-todo-form-submit-button");

	expect(await page?.url()).toBe(getPath(`todos/${todo.props.id}`));

	const titleElement = await page.$("#title");
	const descriptionElement = await page.$("#description");

	expect(await titleElement?.innerText()).toBe(newTitle);
	expect(await descriptionElement?.innerText()).toBe(newDescription);
});

test("Todo deleted successfully.", async ({ page }) => {
	const todo = await createTodo();

	await page.goto(`todos/${todo.props.id}`);

	await page.click("form#delete-todo-form button");

	expect(await page?.url()).toBe(getPath(`todos`));

	const p = await page.$("p");

	expect(await p?.innerText()).toMatch("No todos found");
});

test("Todo completed successfully.", async ({ page }) => {
	const todo = await createTodo();

	await page.goto(`todos/${todo.props.id}`);

	await page.click("form#complete-todo-form button");

	expect(await page?.url()).toBe(getPath(`todos/${todo.props.id}`));

	const statusElement = await page.$(`[status="complete"]`);

	expect(statusElement).not.toBeNull();
});

// Uncomment the following tests if you've implemented the subtodo functionality.

test("SubTodo created successfully.", async ({ page }) => {
	const todo = await createTodo();

	await page.goto(`todos/${todo.props.id}`);

	await page.fill(
		'form#new-subtodo-form input[name="title"]',
		"Test SubTodo",
	);
	await page.click("form#new-subtodo-form button");
	expect(await page?.url()).toBe(getPath(`todos/${todo.props.id}`));

	const subTodos = await todo.listSubTodos();
	console.log(subTodos);
	const subTodoElement = await page.$(
		`[subtodo-id="${subTodos[0].props.id}"]`,
	);

	expect(await subTodoElement?.innerText()).toMatch("Test SubTodo");
});

test("SubTodos retrieved successfully.", async ({ page }) => {
	const todo = await createTodo();
	const subTodos = [
		await todo.addSubTodo({
			title: "Test SubTodo",
			status: "incomplete",
			createdAt: createUTCDate(),
			todoId: todo.props.id!,
		}),
		await todo.addSubTodo({
			title: "Test SubTodo 2",
			status: "incomplete",
			createdAt: createUTCDate(),
			todoId: todo.props.id!,
		}),
		await todo.addSubTodo({
			title: "Test SubTodo 3",
			status: "incomplete",
			createdAt: createUTCDate(),
			todoId: todo.props.id!,
		}),
	];

	await page.goto(`todos/${todo.props.id}`);

	const subTodoElements = await page.$$(`[subTodo-id]`);

	for (let i = 0; i < subTodos.length; i++) {
		expect(await subTodoElements[i]?.innerText()).toMatch(
			subTodos[i].props.title,
		);
	}
});

test("SubTodo completed successfully.", async ({ page }) => {
	const todo = await createTodo();

	const subTodo = await todo.addSubTodo({
		title: "Test SubTodo",
		status: "incomplete",
		createdAt: new Date(),
		todoId: todo.props.id!,
	});

	await page.goto(`todos/${todo.props.id}`);

	await page.click("form#complete-subtodo-form button");

	expect(await page?.url()).toBe(getPath(`todos/${todo.props.id}`));

	const statusElement = await page.$(
		`[subTodo-id="${subTodo.props.id}"][status="complete"]`,
	);

	expect(statusElement).not.toBeNull();
});

// Uncomment the following tests if you've implemented the due date functionality.

// test("Todo is created with the correct due date using form.", async ({
// 	page,
// }) => {
// 	const title = "Test Todo";
// 	const description = "This is a test todo";
// 	const dueAt = createUTCDate(
// 		new Date(new Date().setDate(new Date().getDate() + 7)),
// 	);
// 	const year = dueAt.getFullYear();
// 	const month = (dueAt.getMonth() + 1).toString().padStart(2, "0");
// 	const day = dueAt.getDate().toString().padStart(2, "0");

// 	await page.goto("/todos/new");

// 	await page.fill('form#new-todo-form input[name="title"]', title);
// 	await page.fill(
// 		'form#new-todo-form textarea[name="description"]',
// 		description,
// 	);
// 	await page.fill(
// 		'form#new-todo-form input[name="date"]',
// 		`${year}-${month}-${day}`,
// 	);
// 	await page.click("form#new-todo-form button");

// 	const todo = await Todo.read(sql, 1);

// 	expect(todo?.props.dueAt!.getUTCDate()).toBe(dueAt.getUTCDate());
// });

// test("Due date is edited successfully.", async ({ page }) => {
// 	const todo = await createTodo();

// 	const dueAt = createUTCDate(
// 		new Date(new Date().setDate(new Date().getDate() + 7)),
// 	);
// 	const year = dueAt.getFullYear();
// 	const month = (dueAt.getMonth() + 1).toString().padStart(2, "0");
// 	const day = dueAt.getDate().toString().padStart(2, "0");

// 	await page.goto(`todos/${todo.props.id}/edit`);

// 	await page.fill(
// 		'form#edit-todo-form input[name="date"]',
// 		`${year}-${month}-${day}`,
// 	);
// 	await page.click("form#edit-todo-form button");

// 	const updatedTodo = await Todo.read(sql, todo.props.id!);

// 	expect(updatedTodo?.props.dueAt!.getUTCDate()).toBe(dueAt.getUTCDate());
// });

// test("Due day is displayed correctly in the future.", async ({ page }) => {
// 	const todo = await createTodo({
// 		dueAt: createUTCDate(
// 			new Date(new Date().setDate(new Date().getDate() + 3)),
// 		),
// 	});

// 	await page.goto(`todos/${todo.props.id}`);

// 	const dueAtElement = await page.$("#due-at");

// 	expect(await dueAtElement?.innerText()).toMatch("Due 3 days from now");
// });

// test("Due day is displayed correctly in the past.", async ({ page }) => {
// 	const todo = await createTodo({
// 		dueAt: createUTCDate(
// 			new Date(new Date().setDate(new Date().getDate() - 3)),
// 		),
// 	});

// 	await page.goto(`todos/${todo.props.id}`);

// 	const dueAtElement = await page.$("#due-at");

// 	expect(await dueAtElement?.innerText()).toMatch("Due 3 days ago");
// });

// test("Due day is displayed correctly yesterday.", async ({ page }) => {
// 	const todo = await createTodo({
// 		dueAt: createUTCDate(
// 			new Date(new Date().setDate(new Date().getDate() - 1)),
// 		),
// 	});

// 	await page.goto(`todos/${todo.props.id}`);

// 	const dueAtElement = await page.$("#due-at");

// 	expect(await dueAtElement?.innerText()).toMatch("Due yesterday");
// });

// test("Due day is displayed correctly tomorrow.", async ({ page }) => {
// 	const todo = await createTodo({
// 		dueAt: createUTCDate(
// 			new Date(new Date().setDate(new Date().getDate() + 1)),
// 		),
// 	});

// 	await page.goto(`todos/${todo.props.id}`);

// 	const dueAtElement = await page.$("#due-at");

// 	expect(await dueAtElement?.innerText()).toMatch("Due tomorrow");
// });

// test("Due day is displayed correctly today.", async ({ page }) => {
// 	const todo = await createTodo({
// 		dueAt: createUTCDate(),
// 	});

// 	await page.goto(`todos/${todo.props.id}`);

// 	const dueAtElement = await page.$("#due-at");

// 	expect(await dueAtElement?.innerText()).toMatch("Due today");
// });

// Uncomment the following tests if you've implemented the sorting and filtering functionality.

// test("Todos are sorted by title descending.", async ({ page }) => {
// 	const todo1 = await createTodo({
// 		title: "C Test Todo",
// 	});
// 	const todo2 = await createTodo({
// 		title: "A Test Todo",
// 	});
// 	const todo3 = await createTodo({
// 		title: "B Test Todo",
// 	});

// 	await page.goto("/todos");
// 	await page.selectOption('select[name="sortBy"]', "title");
// 	await page.selectOption('select[name="orderBy"]', "desc");
// 	await page.click("form#sort-filter-todos-form button");

// 	expect(await page?.url()).toMatch("sortBy=title&orderBy=desc");

// 	const todoElements = await page.$$("[todo-id]");

// 	expect(await todoElements[0].innerText()).toMatch(todo1.props.title);
// 	expect(await todoElements[1].innerText()).toMatch(todo3.props.title);
// 	expect(await todoElements[2].innerText()).toMatch(todo2.props.title);
// });

// test("Todos are filtered by completed status.", async ({ page }) => {
// 	const todo1 = await createTodo();
// 	const todo2 = await createTodo({
// 		status: "complete",
// 	});

// 	await page.goto("/todos");
// 	await page.selectOption('select[name="status"]', "complete");
// 	await page.click("form#sort-filter-todos-form button");

// 	expect(await page?.url()).toMatch("status=complete");

// 	const todoElements = await page.$$("[todo-id]");

// 	expect(todoElements.length).toBe(1);
// 	expect(await todoElements[0].innerText()).toMatch(todo2.props.title);
// });
