import { TelegramDB } from './TelegramDB';
import {
  Document,
  QueryFilter,
  UpdateOptions,
  OperationResult,
  BatchOptions,
} from './types';

/** Table/collection handler for fluent API usage */
export class TableHandler {
  constructor(
    private db: TelegramDB,
    private tableName: string
  ) {}

  async insert(doc: Partial<Document>): Promise<OperationResult> {
    return this.db.insert(doc, this.tableName);
  }

  async insertMany(
    docs: Partial<Document>[],
    options?: BatchOptions
  ): Promise<OperationResult[]> {
    return this.db.insertMany(docs, this.tableName, options);
  }

  async find(filter: QueryFilter = {}): Promise<Document[]> {
    return this.db.find(filter, this.tableName);
  }

  async findOne(filter: QueryFilter = {}): Promise<Document | null> {
    return this.db.findOne(filter, this.tableName);
  }

  async findById(id: string): Promise<Document | null> {
    return this.db.findById(id, this.tableName);
  }

  async update(
    filter: QueryFilter,
    update: Partial<Document>,
    options?: UpdateOptions
  ): Promise<OperationResult> {
    return this.db.update(filter, update, this.tableName, options);
  }

  async updateById(
    id: string,
    update: Partial<Document>,
    options?: UpdateOptions
  ): Promise<OperationResult> {
    return this.db.updateById(id, update, this.tableName, options);
  }

  async delete(filter: QueryFilter): Promise<OperationResult> {
    return this.db.delete(filter, this.tableName);
  }

  async deleteById(id: string): Promise<OperationResult> {
    return this.db.deleteById(id, this.tableName);
  }

  async deleteAll(): Promise<OperationResult> {
    return this.db.deleteAll(this.tableName);
  }

  async count(filter: QueryFilter = {}): Promise<number> {
    return this.db.count(filter, this.tableName);
  }

  getTableName(): string {
    return this.tableName;
  }
}
