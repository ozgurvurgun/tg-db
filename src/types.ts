export interface TelegramDBConfig {
  botToken: string;
  chatId: string | number;
  messagePrefix?: string;
  batchDelay?: number;
  maxRetries?: number;
  /** Path to persist index across restarts. Default: .tg-db-index-{chatId}.json in cwd */
  indexFilePath?: string;
}

export interface Document {
  _id: string;
  _table: string;
  [key: string]: any;
}

export interface QueryFilter {
  [key: string]: any;
}

export interface UpdateOptions {
  upsert?: boolean;
  replace?: boolean;
}

export interface OperationResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: Error;
}

export interface BatchOptions {
  delay?: number;
  stopOnError?: boolean;
}

export interface DatabaseStats {
  totalDocuments: number;
  totalMessages: number;
  oldestDocument?: Document;
  newestDocument?: Document;
}
