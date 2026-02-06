import { Telegraf, Context } from 'telegraf';
import {
  TelegramDBConfig,
  Document,
  QueryFilter,
  UpdateOptions,
  OperationResult,
  BatchOptions,
  DatabaseStats,
} from './types';
import {
  encodeDocument,
  decodeDocument,
  matchesFilter,
  generateId,
  deepMerge,
} from './utils';
import { TableHandler } from './TableHandler';

/** Uses Telegram chat messages to store and retrieve data */
export class TelegramDB {
  private bot: Telegraf;
  private chatId: string | number;
  private prefix: string;
  private batchDelay: number;
  private maxRetries: number;
  private initialized: boolean = false;
  private messageIndex: Map<string, number> = new Map();
  private documentCache: Map<string, Document> = new Map();
  private indexMessageId: number | null = null;

  constructor(config: TelegramDBConfig) {
    this.bot = new Telegraf(config.botToken);
    this.chatId = config.chatId;
    this.prefix = config.messagePrefix || 'TDB:';
    this.batchDelay = config.batchDelay || 100;
    this.maxRetries = config.maxRetries || 3;
  }

  /** Initialize database connection. Must be called before use. */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.bot.telegram.getMe();
      await this.bot.telegram.getChat(this.chatId);
      await this.loadMessageIndex();
      this.setupMessageListener();
      
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize Telegram DB: ${error}`);
    }
  }

  /** Insert a new document into a table */
  async insert(doc: Partial<Document>, table: string): Promise<OperationResult> {
    await this.ensureInitialized();

    try {
      const document: Document = {
        ...doc,
        _id: doc._id || generateId(),
        _table: table,
      };

      const message = encodeDocument(document, this.prefix);
      
      const sentMessage = await this.retryOperation(
        () => this.bot.telegram.sendMessage(this.chatId, message),
        this.maxRetries
      ) as any;

      this.messageIndex.set(document._id, (sentMessage as any).message_id);
      this.documentCache.set(document._id, document);
      await this.saveMessageIndex();

        return {
        success: true,
        data: { ...document, _messageId: (sentMessage as any).message_id },
        message: 'Document inserted successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error,
        message: `Failed to insert document: ${error.message}`,
      };
    }
  }

  /** Insert multiple documents into a table */
  async insertMany(docs: Partial<Document>[], table: string, options?: BatchOptions): Promise<OperationResult[]> {
    await this.ensureInitialized();

    const results: OperationResult[] = [];
    const delay = options?.delay || this.batchDelay;
    const stopOnError = options?.stopOnError || false;

    for (const doc of docs) {
      const result = await this.insert(doc, table);
      results.push(result);

      if (!result.success && stopOnError) {
        break;
      }

      if (delay > 0 && docs.indexOf(doc) < docs.length - 1) {
        await this.sleep(delay);
      }
    }

    return results;
  }

  /** Find documents matching the filter in a table */
  async find(filter: QueryFilter = {}, table: string): Promise<Document[]> {
    await this.ensureInitialized();

    try {
      const documents: Document[] = [];
      const queryWithTable = { ...filter, _table: table };

      for (const [docId, doc] of this.documentCache.entries()) {
        if (matchesFilter(doc, queryWithTable)) {
          documents.push(doc);
        }
      }

      if (this.documentCache.size === 0) {
        await this.reloadCacheFromIndex();
        for (const [docId, doc] of this.documentCache.entries()) {
          if (matchesFilter(doc, queryWithTable)) {
            documents.push(doc);
          }
        }
      }

      return documents;
    } catch (error: any) {
      throw new Error(`Failed to find documents: ${error.message}`);
    }
  }

  /** Find a single document matching the filter in a table */
  async findOne(filter: QueryFilter = {}, table: string): Promise<Document | null> {
    const results = await this.find(filter, table);
    return results.length > 0 ? results[0] : null;
  }

  /** Find document by ID in a table */
  async findById(id: string, table: string): Promise<Document | null> {
    return this.findOne({ _id: id }, table);
  }

  /** Update documents matching the filter in a table */
  async update(
    filter: QueryFilter,
    update: Partial<Document>,
    table: string,
    options: UpdateOptions = {}
  ): Promise<OperationResult> {
    await this.ensureInitialized();

    try {
      const queryWithTable = { ...filter, _table: table };
      const documents = await this.find({}, table).then(docs => 
        docs.filter(doc => matchesFilter(doc, queryWithTable))
      );
      
      if (documents.length === 0 && options.upsert) {
        const newDoc = deepMerge(filter, update);
        return await this.insert(newDoc, table);
      }

      if (documents.length === 0) {
        return {
          success: false,
          message: 'No documents found to update',
        };
      }

      const updatedDocs: Document[] = [];
      for (const doc of documents) {
        const updated = options.replace
          ? { ...update, _id: doc._id }
          : deepMerge(doc, { ...update, _id: doc._id });

        const oldMessageId = this.messageIndex.get(doc._id);
        if (oldMessageId) {
          try {
            await this.bot.telegram.deleteMessage(this.chatId, oldMessageId);
          } catch {
            // Ignore deletion errors
          }
        }

        const message = encodeDocument(updated, this.prefix);
        const sentMessage = await this.retryOperation(
          () => this.bot.telegram.sendMessage(this.chatId, message),
          this.maxRetries
        ) as any;

        this.messageIndex.set(updated._id, (sentMessage as any).message_id);
        this.documentCache.set(updated._id, updated);
        updatedDocs.push(updated);
      }

      await this.saveMessageIndex();

      return {
        success: true,
        data: updatedDocs,
        message: `Updated ${updatedDocs.length} document(s)`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error,
        message: `Failed to update documents: ${error.message}`,
      };
    }
  }

  /** Update a single document by ID in a table */
  async updateById(
    id: string,
    update: Partial<Document>,
    table: string,
    options: UpdateOptions = {}
  ): Promise<OperationResult> {
    return this.update({ _id: id }, update, table, options);
  }

  /** Delete documents matching the filter in a table */
  async delete(filter: QueryFilter, table: string): Promise<OperationResult> {
    await this.ensureInitialized();

    try {
      const queryWithTable = { ...filter, _table: table };
      const documents = await this.find({}, table).then(docs => 
        docs.filter(doc => matchesFilter(doc, queryWithTable))
      );
      
      if (documents.length === 0) {
        return {
          success: false,
          message: 'No documents found to delete',
        };
      }

      let deletedCount = 0;

      for (const doc of documents) {
        const messageId = this.messageIndex.get(doc._id);
        if (messageId) {
          try {
            await this.bot.telegram.deleteMessage(this.chatId, messageId);
            this.messageIndex.delete(doc._id);
            this.documentCache.delete(doc._id);
            deletedCount++;
          } catch {
            this.messageIndex.delete(doc._id);
            this.documentCache.delete(doc._id);
          }
        }
      }
      
      await this.saveMessageIndex();

      return {
        success: true,
        data: { deletedCount },
        message: `Deleted ${deletedCount} document(s)`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error,
        message: `Failed to delete documents: ${error.message}`,
      };
    }
  }

  /** Delete a single document by ID in a table */
  async deleteById(id: string, table: string): Promise<OperationResult> {
    return this.delete({ _id: id }, table);
  }

  /** Delete all documents in a table */
  async deleteAll(table: string): Promise<OperationResult> {
    return this.delete({}, table);
  }

  /** Count documents matching the filter in a table */
  async count(filter: QueryFilter = {}, table: string): Promise<number> {
    const queryWithTable = { ...filter, _table: table };
    const documents = await this.find({}, table);
    return documents.filter(doc => matchesFilter(doc, queryWithTable)).length;
  }

  /** Get all table names in the database */
  async getTables(): Promise<string[]> {
    await this.ensureInitialized();
    
    const tables = new Set<string>();
    for (const [, doc] of this.documentCache.entries()) {
      if (doc._table) {
        tables.add(doc._table);
      }
    }
    
    return Array.from(tables);
  }

  /** Tabloyu tamamen siler */
  async dropTable(table: string): Promise<OperationResult> {
    return this.deleteAll(table);
  }

  /** Belirli tablo veya tüm tablolar için istatistik döner */
  async getStats(table?: string): Promise<DatabaseStats> {
    await this.ensureInitialized();

    const documents = table 
      ? await this.find({}, table)
      : Array.from(this.documentCache.values());
    const messages = await this.getAllMessages();

    let oldestDoc: Document | undefined;
    let newestDoc: Document | undefined;

    if (documents.length > 0) {
      oldestDoc = documents.reduce((oldest, current) => {
        const oldestId = oldest._id.split('-')[0];
        const currentId = current._id.split('-')[0];
        return parseInt(currentId) < parseInt(oldestId) ? current : oldest;
      });

      newestDoc = documents.reduce((newest, current) => {
        const newestId = newest._id.split('-')[0];
        const currentId = current._id.split('-')[0];
        return parseInt(currentId) > parseInt(newestId) ? current : newest;
      });
    }

    return {
      totalDocuments: documents.length,
      totalMessages: messages.length,
      oldestDocument: oldestDoc,
      newestDocument: newestDoc,
    };
  }

  /** Clear all data from the database (all tables) */
  async clear(): Promise<OperationResult> {
    await this.ensureInitialized();
    
    const tables = await this.getTables();
    const results: OperationResult[] = [];
    
    for (const table of tables) {
      const result = await this.deleteAll(table);
      results.push(result);
    }
    
    return {
      success: results.every(r => r.success),
      data: results,
      message: `Cleared ${tables.length} table(s)`,
    };
  }

  /** Get a collection/table handler for fluent API usage */
  table(tableName: string): TableHandler {
    return new TableHandler(this, tableName);
  }

  private async getAllMessages(): Promise<Array<{ message_id: number; text?: string }>> {
    const messages: Array<{ message_id: number; text?: string }> = [];
    
    for (const [docId, messageId] of this.messageIndex.entries()) {
      messages.push({
        message_id: messageId,
        text: '', // Text is stored in cache, not needed here
      });
    }
    
    return messages;
  }

  private async reloadCacheFromIndex(): Promise<void> {
    try {
      if (this.indexMessageId) {
        // Cache populated as operations happen
      }
    } catch {
      // Ignore errors
    }
  }

  private async loadMessageIndex(): Promise<void> {
    try {
      this.messageIndex.clear();
      this.documentCache.clear();
    } catch {
      this.messageIndex.clear();
      this.documentCache.clear();
    }
  }

  private async saveMessageIndex(): Promise<void> {
    try {
      const indexData = {
        _id: '__INDEX__',
        _table: '__SYSTEM__',
        messageIndex: Array.from(this.messageIndex.entries()),
        documents: Array.from(this.documentCache.values()),
        updatedAt: Date.now(),
      };
      
      const indexMessage = encodeDocument(indexData as Document, `${this.prefix}INDEX:`);
      
      if (this.indexMessageId) {
        try {
          await this.bot.telegram.deleteMessage(this.chatId, this.indexMessageId);
        } catch {
          // Ignore errors
        }
      }
      
      if (this.messageIndex.size > 0) {
        try {
          const sentMessage = await this.bot.telegram.sendMessage(this.chatId, indexMessage) as any;
          this.indexMessageId = (sentMessage as any).message_id;
        } catch {
          // Fail silently if message too long
        }
      }
    } catch (error) {
      console.warn('Failed to save message index:', error);
    }
  }

  private setupMessageListener(): void {
    this.bot.on('message', async (ctx: Context) => {
      const message = ctx.message;
      if (!message || !('text' in message) || !message.text) return;

      const text = message.text;
      if (String(ctx.chat?.id) !== String(this.chatId)) return;

      if (text.startsWith(this.prefix) && !text.startsWith(`${this.prefix}INDEX:`)) {
        const doc = decodeDocument(text, this.prefix);
        if (doc && doc._id) {
          this.messageIndex.set(doc._id, message.message_id);
          this.documentCache.set(doc._id, doc);
        }
      } else if (text.startsWith(`${this.prefix}INDEX:`)) {
        const indexData = decodeDocument(text, `${this.prefix}INDEX:`);
        if (indexData && indexData._id === '__INDEX__' && indexData.messageIndex && indexData.documents) {
          this.messageIndex = new Map(indexData.messageIndex);
          indexData.documents.forEach((doc: Document) => {
            this.documentCache.set(doc._id, doc);
          });
          this.indexMessageId = message.message_id;
        }
      }
    });
    
    this.bot.launch().catch(() => {});
  }

  /** Ensure database is initialized */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /** Retry operation with exponential backoff */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number
  ): Promise<T> {
    let lastError: Error;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        if (i < maxRetries - 1) {
          await this.sleep(1000 * (i + 1));
        }
      }
    }

    throw lastError!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Close database connection */
  async close(): Promise<void> {
    this.bot.stop();
    this.initialized = false;
  }
}
