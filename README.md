# Telegram Chat Database (tg-db)

A comprehensive npm package that lets you use Telegram chat as a database. Stores and queries data in chat messages using the Telegram Bot API.

## Features

- **CRUD Operations**: Create, Read, Update, Delete
- **Table/Collection System**: Database-like table structure (similar to SQL tables or MongoDB collections)
- **Fluent API**: Chainable usage like `db.table('users').find()`
- **Advanced Queries**: Filter, find, findOne and similar query methods
- **Batch Operations**: Bulk document insert and update
- **Query Operators**: $gt, $gte, $lt, $lte, $ne, $in, $nin, $regex support
- **Automatic Index**: Tracks message IDs automatically
- **Cache System**: In-memory cache for performance
- **TypeScript Support**: Full type safety
- **Error Handling**: Retry mechanism and error handling

## Installation

```bash
npm install @ozgurv/tg-db
```

## Requirements

1. **Telegram Bot Token**: Create a bot via [@BotFather](https://t.me/botfather) and get a token
2. **Chat ID**: The chat where data will be stored (add your bot to that chat)

### How to Find Chat ID

- **Private Chat**: Start a private chat with your bot; chat ID is usually a positive number
- **Group/Channel**: Add the bot to the group/channel; chat ID is usually negative (e.g. `-1001234567890`)

## Quick Start

```typescript
import { TelegramDB } from '@ozgurv/tg-db';

// Initialize database
const db = new TelegramDB({
  botToken: 'YOUR_BOT_TOKEN',
  chatId: 'YOUR_CHAT_ID', // or number: 123456789
});

// Connect
await db.initialize();

// Insert document (table is required)
const result = await db.insert({
  name: 'John',
  age: 30,
  city: 'New York'
}, 'users'); // add to 'users' table

console.log(result.data); // inserted document

// Find documents (table is required)
const users = await db.find({ city: 'New York' }, 'users');
console.log(users);

// Or use Fluent API (recommended)
const usersTable = db.table('users');
const users2 = await usersTable.find({ city: 'New York' });

// Update document
await db.update(
  { name: 'John' },
  { age: 31 },
  'users'
);

// Delete document
await db.delete({ name: 'John' }, 'users');
```

## API Documentation

### `TelegramDB(config)`

Creates the database instance.

**Parameters:**

- `botToken` (string, required): Telegram bot token
- `chatId` (string | number, required): Chat ID where data will be stored
- `messagePrefix` (string, optional): Message prefix (default: "TDB:")
- `batchDelay` (number, optional): Delay between batch operations in ms (default: 100)
- `maxRetries` (number, optional): Maximum retry count (default: 3)

### Methods

#### `initialize(): Promise<void>`

Establishes the database connection. Must be called before use.

```typescript
await db.initialize();
```

#### `insert(doc: Partial<Document>, table: string): Promise<OperationResult>`

Inserts a new document. **Every document must belong to a table.**

```typescript
const result = await db.insert({
  name: 'John',
  email: 'john@example.com'
}, 'users'); // add to 'users' table

if (result.success) {
  console.log('Document inserted:', result.data);
}

// Or with Fluent API:
const users = db.table('users');
await users.insert({ name: 'John', email: 'john@example.com' });
```

#### `insertMany(docs: Partial<Document>[], table: string, options?): Promise<OperationResult[]>`

Inserts multiple documents.

```typescript
const results = await db.insertMany([
  { name: 'Alice', age: 25 },
  { name: 'Bob', age: 28 },
  { name: 'Carol', age: 30 }
], 'users', {
  delay: 200, // wait 200ms between each insert
  stopOnError: false // continue even on error
});

// Or with Fluent API:
const users = db.table('users');
await users.insertMany([...], { delay: 200 });
```

#### `find(filter?: QueryFilter, table: string): Promise<Document[]>`

Finds all documents matching the filter. **Table is required.**

```typescript
// All documents (from a specific table)
const allDocs = await db.find({}, 'users');

// Simple filter
const users = await db.find({ city: 'London' }, 'users');

// Advanced filters
const adults = await db.find({
  age: { $gte: 18 }
}, 'users');

// Or with Fluent API (recommended):
const users = db.table('users');
const allUsers = await users.find();
const londonUsers = await users.find({ city: 'London' });
```

#### `findOne(filter?: QueryFilter, table: string): Promise<Document | null>`

Finds the first document matching the filter. **Table is required.**

```typescript
const user = await db.findOne({ name: 'John' }, 'users');

// Or with Fluent API:
const users = db.table('users');
const user = await users.findOne({ name: 'John' });
```

#### `findById(id: string, table: string): Promise<Document | null>`

Finds a document by ID. **Table is required.**

```typescript
const doc = await db.findById('1234567890-abc123', 'users');

// Or with Fluent API:
const users = db.table('users');
const doc = await users.findById('1234567890-abc123');
```

#### `update(filter: QueryFilter, update: Partial<Document>, table: string, options?): Promise<OperationResult>`

Updates documents. **Table is required.**

```typescript
// Simple update
await db.update(
  { name: 'John' },
  { age: 32 },
  'users'
);

// Upsert (create if not exists)
await db.update(
  { name: 'New User' },
  { age: 25, city: 'Paris' },
  'users',
  { upsert: true }
);

// Replace entire document
await db.update(
  { _id: '123' },
  { name: 'New Name', age: 30 },
  'users',
  { replace: true }
);

// Or with Fluent API:
const users = db.table('users');
await users.update({ name: 'John' }, { age: 32 });
```

#### `updateById(id: string, update: Partial<Document>, table: string, options?): Promise<OperationResult>`

Updates a document by ID. **Table is required.**

```typescript
await db.updateById('1234567890-abc123', { age: 33 }, 'users');

// Or with Fluent API:
const users = db.table('users');
await users.updateById('1234567890-abc123', { age: 33 });
```

#### `delete(filter: QueryFilter, table: string): Promise<OperationResult>`

Deletes documents. **Table is required.**

```typescript
// Delete by filter
await db.delete({ city: 'London' }, 'users');

// Delete all documents (from a specific table)
await db.deleteAll('users');

// Or with Fluent API:
const users = db.table('users');
await users.delete({ city: 'London' });
await users.deleteAll();
```

#### `deleteById(id: string, table: string): Promise<OperationResult>`

Deletes a document by ID. **Table is required.**

```typescript
await db.deleteById('1234567890-abc123', 'users');

// Or with Fluent API:
const users = db.table('users');
await users.deleteById('1234567890-abc123');
```

#### `count(filter?: QueryFilter, table: string): Promise<number>`

Returns document count. **Table is required.**

```typescript
const total = await db.count({}, 'users');
const londonUsers = await db.count({ city: 'London' }, 'users');

// Or with Fluent API:
const users = db.table('users');
const total = await users.count();
const londonUsers = await users.count({ city: 'London' });
```

#### `getTables(): Promise<string[]>`

Returns all table names.

```typescript
const tables = await db.getTables();
console.log('Tables:', tables); // ['users', 'products', 'orders']
```

#### `dropTable(table: string): Promise<OperationResult>`

Drops a table completely.

```typescript
await db.dropTable('old_table');
```

#### `table(tableName: string): TableHandler`

Returns a table handler for Fluent API. **Recommended usage.**

```typescript
const users = db.table('users');
await users.insert({ name: 'John' });
const user = await users.findOne({ name: 'John' });
await users.update({ name: 'John' }, { age: 30 });
await users.delete({ name: 'John' });
```

#### `getStats(table?: string): Promise<DatabaseStats>`

Returns database statistics. If table is specified, returns stats for that table only.

```typescript
// All database statistics
const stats = await db.getStats();
console.log(`Total documents: ${stats.totalDocuments}`);

// Specific table statistics
const userStats = await db.getStats('users');
console.log(`Users table: ${userStats.totalDocuments} documents`);
```

#### `clear(): Promise<OperationResult>`

Clears all data.

```typescript
await db.clear();
```

#### `close(): Promise<void>`

Closes the database connection.

```typescript
await db.close();
```

## Query Operators

Use these operators for advanced queries:

```typescript
const users = db.table('users');

// Greater than
await users.find({ age: { $gt: 18 } });

// Greater than or equal
await users.find({ age: { $gte: 18 } });

// Less than
await users.find({ age: { $lt: 65 } });

// Less than or equal
await users.find({ age: { $lte: 65 } });

// Not equal
await users.find({ status: { $ne: 'deleted' } });

// In
await users.find({ city: { $in: ['London', 'Paris', 'Berlin'] } });

// Not in
await users.find({ city: { $nin: ['Paris'] } });

// Regex
await users.find({ email: { $regex: '@gmail\\.com$' } });

// Exists
await users.find({ phone: { $exists: true } });
```

## Nested Fields

Query nested fields using dot notation:

```typescript
const result = await db.insert({
  name: 'John',
  address: {
    city: 'London',
    district: 'Westminster'
  }
}, 'users');

const docs = await db.find({ 'address.city': 'London' }, 'users');
```

## Table/Collection System

Every document must belong to a table. This lets you organize data and use it like a real database.

### Two Usage Styles

**1. Direct methods (table specified in each call):**

```typescript
await db.insert({ name: 'John' }, 'users');
await db.find({}, 'users');
await db.update({ name: 'John' }, { age: 30 }, 'users');
await db.delete({ name: 'John' }, 'users');
```

**2. Fluent API (recommended - cleaner code):**

```typescript
const users = db.table('users');
await users.insert({ name: 'John' });
await users.find({});
await users.update({ name: 'John' }, { age: 30 });
await users.delete({ name: 'John' });
```

### Table Operations

```typescript
// List all tables
const tables = await db.getTables();
console.log(tables); // ['users', 'products', 'orders']

// Drop a table
await db.dropTable('old_table');

// Table statistics
const stats = await db.getStats('users');
```

## Examples

### Todo List Application

```typescript
import { TelegramDB } from '@ozgurv/tg-db';

const db = new TelegramDB({
  botToken: process.env.BOT_TOKEN!,
  chatId: process.env.CHAT_ID!
});

await db.initialize();

// Fluent API (recommended)
const todos = db.table('todos');

// Add todo
await todos.insert({
  task: 'Buy groceries',
  completed: false,
  createdAt: new Date().toISOString()
});

// Get incomplete todos
const incompleteTodos = await todos.find({ completed: false });

// Mark todo as completed
await todos.update(
  { task: 'Buy groceries' },
  { completed: true }
);
```

### User Management

```typescript
// Fluent API (recommended)
const users = db.table('users');

// Create user
await users.insert({
  username: 'johndoe',
  email: 'john@example.com',
  role: 'user',
  createdAt: Date.now()
});

// Find admin users
const admins = await users.find({ role: 'admin' });

// Find user by email
const user = await users.findOne({ email: 'john@example.com' });

// Update user
await users.update(
  { username: 'johndoe' },
  { role: 'admin' }
);
```

### Multiple Tables

```typescript
const users = db.table('users');
const products = db.table('products');
const orders = db.table('orders');

// Add to users table
await users.insert({ name: 'John', email: 'john@example.com' });

// Add to products table
await products.insert({ name: 'Laptop', price: 1000, stock: 5 });

// Add to orders table
await orders.insert({
  userId: '123',
  productId: '456',
  quantity: 2,
  total: 2000
});

// Each table works independently
const allUsers = await users.find();
const allProducts = await products.find();
const allOrders = await orders.find();
```

## Limitations

1. **Telegram API Limits**: The Telegram API has rate limits. Use batch delay for heavy operations.
2. **Message Size**: Telegram messages are limited to 4096 characters. Large documents may need to be split.
3. **Message History**: The Telegram Bot API cannot fetch old messages directly. A message index is used instead.
4. **Bot Permissions**: The bot needs permission to delete messages for delete operations.

## Security

- Never share your bot token
- Keep your chat ID private
- Do not store sensitive data without encryption
- Use environment variables:

```typescript
const db = new TelegramDB({
  botToken: process.env.BOT_TOKEN!,
  chatId: process.env.CHAT_ID!
});
```

## License

MIT License
