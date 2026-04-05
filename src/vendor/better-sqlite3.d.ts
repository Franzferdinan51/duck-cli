// Type declarations for fake better-sqlite3

declare class DatabaseInstance {
  constructor(filename: string);
  pragma(statement: string): any[];
  prepare(sql: string): any;
  exec(sql: string): any[];
  transaction(fn: Function): Function;
  run(sql: string, ...params: any[]): { changes: number; lastInsertRowid: number };
  get(sql: string, ...params: any[]): any;
  all(sql: string, ...params: any[]): any[];
  each(sql: string, callback: Function): number;
  close(): void;
  open(): boolean;
  export(): Buffer;
}

declare namespace Database {
  export type Database = DatabaseInstance;
}

declare const Database: typeof DatabaseInstance & (new (filename: string) => DatabaseInstance);

export = Database;
export as namespace Database;
