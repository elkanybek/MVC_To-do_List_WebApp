import postgres from "postgres";
import {
	camelToSnake,
	convertToCase,
	createUTCDate,
	snakeToCamel,
} from "../utils";



// MY Code for Subtodos from Assignment 1 / Models

export interface SubTodoProps {
	//Subtodos properties
	id?: number;
	title: string;
	status: "incomplete" | "complete";
	createdAt: Date;
	completedAt?: Date;
	todoId?: number; // ID of the associated Todo
}

export interface SubTodoEntity {
	//For the conversion of the properties in the interface and the database for later use
	id?: number;
	title: string;
	status: "incomplete" | "complete";
	created_at: Date;
	completed_at?: Date;
	todo_id?: number; // ID of the associated Todo
}

export class SubTodo {
	/**
	 * Converts the current SubTodo instance properties into a SubTodoEntity.
	 * @returns SubTodoEntity representing the current instance.
	 */
	toEntity(): SubTodoEntity {
		return {
			id: this.props.id,
			title: this.props.title,
			status: this.props.status,
			created_at: this.props.createdAt,
			completed_at: this.props.completedAt,
			todo_id: this.props.todoId,
		};
	}

	/**
	 * Converts the provided properties into SubTodoProps.
	 * @param props - The properties to be converted.
	 * @returns SubTodoProps representing the provided properties.
	 */
	toProps(props: SubTodoProps): SubTodoProps {
		return {
			id: props.id,
			title: props.title,
			status: props.status,
			createdAt: props.createdAt,
			completedAt: props.completedAt,
			todoId: props.todoId,
		};
	}

	/**
	 * Converts the provided SubTodoProps into a SubTodoEntity.
	 * @param props - The SubTodoProps to be converted.
	 * @returns SubTodoEntity representing the provided SubTodoProps.
	 */
	static toEntity(props: SubTodoProps): SubTodoEntity {
		return {
			id: props.id,
			title: props.title,
			status: props.status,
			created_at: props.createdAt,
			completed_at: props.completedAt,
			todo_id: props.todoId,
		};
	}

	/**
	 * Converts the provided SubTodoEntity into SubTodoProps.
	 * @param entity - The SubTodoEntity to be converted.
	 * @returns SubTodoProps representing the provided SubTodoEntity.
	 */
	static toProps(entity: SubTodoEntity): SubTodoProps {
		return {
			id: entity.id,
			title: entity.title,
			status: entity.status,
			createdAt: entity.created_at,
			completedAt: entity.completed_at,
			todoId: entity.todo_id,
		};
	}

	/**
	 * Initializes a new instance of the SubTodo class.
	 *
	 * @see https://www.typescriptlang.org/docs/handbook/2/classes.html#parameter-properties
	 *
	 * @param sql The sql parameter is an instance of a Postgres client.
	 * It's used for database operations (queries, updates, deletions, etc.)
	 * related to this SubTodo instance. By passing sql, each SubTodo instance can
	 * interact with the database.
	 *
	 * @param props This parameter holds the properties of the SubTodo.
	 */
	constructor(
		//Same as the Todo class
		private sql: postgres.Sql<any>,
		public props: SubTodoProps,
	) {}

	/**
	 * Initializes a new instance of the SubTodo class. This method creates a new SubTodo
	 * instance from scratch (as opposed to modifying an existing instance), so it's static.
	 *
	 * @param sql The Postgres query template tag. The sql parameter is an
	 * instance of a Postgres client. It's used for database operations
	 * (queries, updates, deletions, etc.) related to this Todo instance.
	 * By passing sql, each Todo instance can interact with the database.
	 *
	 * @param props Holds the properties of the SubTodo (like id, title, status, createdAt, completedAt, todoId.).
	 *
	 * @returns The new SubTodo instance. Since this is an async function,
	 * it returns a Promise that resolves to the new SubTodo instance.
	 * The reason for this being an async function is that it interacts
	 * with the database through the sql parameter, whose operations are asynchronous.
	 */
	static async create(
		sql: postgres.Sql<any>,
		props: Partial<SubTodoProps>,
	): Promise<SubTodo> {
		let columns = [
			"title",
			"status",
			"completed_at",
			"created_at",
			"todo_id",
		];
		let result = await sql`
			INSERT INTO subtodos (title, status, completed_at, created_at, todo_id) 
			VALUES (
				${props.title || null}, 
				${props.status || null}, 
				${props.completedAt || null}, 
				${props.createdAt || null},
				${props.todoId || null}
			) 
			RETURNING *;
		`; //Insert values in the subtodo table

		if (result.length > 0) {
			//Verifies if there is at least one result returned
			const createdProps: SubTodoProps = {
				id: result[0].id,
				title: result[0].title,
				status: result[0].status,
				createdAt: result[0].created_at,
				completedAt: result[0].completed_at,
				todoId: result[0].todo_id,
			};

			return new SubTodo(sql, createdProps); //Return new Subtodo instance
		}

		return Promise.reject(new Error("SubTodo not created")); //Error handling
	}

	/**
	 * Retrieves a SubTodo from the database based on its id. It fetches an
	 * existing SubTodo from the database and then creates an instance of
	 * SubTodo with the fetched data. It's static because it's used to retrieve
	 * and instantiate SubTodo objects without needing an existing instance.
	 * @
	 * @param sql The Postgres query template tag.
	 * @param id The ID of the Todo to read from the database.
	 * @returns The SubTodo instance with the specified ID, or null if it doesn't exist.
	 */
	static async read(
		sql: postgres.Sql<any>,
		id: number,
	): Promise<SubTodo | null> {
		let result = await sql`
			SELECT * 
			FROM subtodos 
			WHERE id = ${id}
		`; //Get the information of the SubTodo by using the id

		if (result.length === 0) {
			// Verifies if there is no results (SubTodo with the specified id)
			return null;
		}
		return new SubTodo(sql, {
			//New subtodo with the fetched data from the db
			id: result[0].id,
			title: result[0].title,
			status: result[0].status,
			createdAt: result[0].created_at,
			completedAt: result[0].completed_at,
			todoId: result[0].todo_id,
		});
	}

	static async readByTodoId(
		sql: postgres.Sql<any>,
		todoId: number,
	): Promise<SubTodo[]> {
		let result = await sql`
			SELECT * 
			FROM subtodos 
			WHERE todo_id = ${todoId}
		`; // Get the information of the SubTodos by using the todo ID
	
		return result.map(result => new SubTodo(sql, {
			id: result.id,
			title: result.title,
			status: result.status,
			createdAt: result.created_at,
			completedAt: result.completed_at,
			todoId: result.todo_id,
		}));
	}
	
	

	
	/**
	 * Updates the properties of an existing SubTodo instance and the corresponding
	 * database record. It's an instance method because it operates on and modifies
	 * the state of an individual SubTodo instance. This also updates the editedAt property.
	 *
	 * @param updateProps The properties to update. Partial is a TypeScript
	 * utility type that makes all properties of TodoProps optional.
	 * This means updateProps can have any subset of SubTodoProps properties,
	 * making the update operation more flexible.
	 *
	 * @see https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype
	 */
	async update(updateProps: Partial<SubTodoProps>): Promise<void> {
		if (this.props.id === undefined) {
			// Verifies if the SubTodo instance has a existing Id
			return;
		}

		//Updates the subtodo record
		let result = await this.sql`		
			UPDATE subtodos 
			SET ${this.sql(this.toPartialEntity(updateProps))}
			WHERE id = ${this.props.id}
			RETURNING *
		`;

		if (result.length == 0) {
			// Verifies if the update was successful
			return Promise.reject(new Error("SubTodo not updated")); //Error handling
		}
		this.props = Object.assign(this.props, updateProps); // Update the local SubTodo
		// @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
	}

	toPartialEntity(updateProps: Partial<SubTodoProps>): any {
		let partialEntity: Partial<SubTodoEntity> = {};

		// Verifies each property in updateProps and add it to the partialEntity if exists
		if (updateProps.id) {
			partialEntity.id = updateProps.id;
		}
		if (updateProps.title) {
			partialEntity.title = updateProps.title;
		}
		if (updateProps.status) {
			partialEntity.status = updateProps.status;
		}
		if (updateProps.completedAt) {
			partialEntity.completed_at = updateProps.completedAt;
		}
		if (updateProps.createdAt) {
			partialEntity.created_at = updateProps.createdAt;
		}
		if (updateProps.todoId) {
			partialEntity.todo_id = updateProps.todoId;
		}
		return partialEntity;
	}

	/**
	 * Deletes a SubTodo from the database. It's an instance method because
	 * it's used to delete the specific SubTodo instance on which it's called.
	 */
	async delete(): Promise<void> {
		if (this.props.id === undefined) {
			// Verifies if the SubTodo instance has a valid ID,
			return;
		}

		//Delete query
		let result = await this.sql`		
			DELETE FROM subtodos 
			WHERE id = ${this.props.id}
			RETURNING *
		`;

		if (result.length == 0) {
			return Promise.reject(new Error("SubTodo not deleted")); //Error handling
		}
	}

	/**
	 * Marks a SubTodo as complete in the database by updating the completedAt property.
	 * This is a specific kind of update operation. It modifies the state of the specific
	 * SubTodo instance, hence it's an instance method.
	 */
	async markComplete(): Promise<void> {
		let update: Partial<SubTodoProps> = {
			status: "complete",
			completedAt: new Date(),
		};

		await this.update(update); //Changes the subtodo instance
	}

	/**
	 * Reads all subtodos from the database.
	 * TODO: This method should support filtering and sorting. The status
	 * of the subtodos should be filterable using a query parameter `status` and
	 * the todos should be sortable using the query parameters `sortBy` and `sortOrder`.
	 * @param sql The postgres connection object.
	 * @param @optional filters The filters to apply to the query.
	 * @param @optional sortBy The column to sort by.
	 * @returns The list of subtodos.
	 */
	static async readAll(
		sql: postgres.Sql<any>,
		filters?: Partial<SubTodoProps>,
		sortBy?: string,
	): Promise<SubTodo[]> {
		const connection = await sql.reserve();

		//Query without filtering and sorting
		let query = sql<SubTodoProps[]>`
		  SELECT *
		  FROM subtodos
		`;

		//if filters exist and contain keys
		if (filters && Object.keys(filters).length > 0) {
			query = sql<SubTodoProps[]>`
			${query} 
			WHERE ${Object.entries(filters)
				.map(([key, value]) => {
					if (key === "status") {
						// Adding condition for "status" field
						return sql<SubTodoProps[]>`status = ${value}`;
					}
					return sql<SubTodoProps[]>`${key} = ${value}`;
				})
				.reduce(
					(acc, condition) =>
						sql<SubTodoProps[]>`${acc} AND ${condition}`,
				)}`;
		}

		// if sortBy is provided
		if (sortBy) {
			if (sortBy === "createdAt") {
				query = sql<SubTodoProps[]>`${query} ORDER BY created_at ASC`;		//Ascending order
			} else {
				query = sql<SubTodoProps[]>`${query} ORDER BY ${sortBy}`;
			}
		}

		const rows: SubTodoProps[] = await connection<SubTodoProps[]>`${query}`;		//Executing the query

		await connection.release();

		return rows.map(
			(row) =>
				new SubTodo(sql, convertToCase(snakeToCamel, row) as SubTodoProps),
		);
	}
}

