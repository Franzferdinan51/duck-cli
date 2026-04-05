/**
 * Better-SQLite3 JSON Backend
 * Pure JavaScript implementation using JSON file storage
 * Works on Android/Termux where native modules can't compile
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class JsonStatement {
  constructor(table, db) {
    this.table = table;
    this.db = db;
    this.params = [];
  }
  
  bind(...params) { this.params = params; return this; }
  
  run(...params) {
    const p = params.length > 0 ? params : this.params;
    return this.db._insert(this.table, this.table._columns, p);
  }
  
  get(...params) {
    const p = params.length > 0 ? params : this.params;
    const rows = this.db._select(this.table, this.table._columns, p, 1);
    return rows.length > 0 ? rows[0] : undefined;
  }
  
  all(...params) {
    const p = params.length > 0 ? params : this.params;
    return this.db._select(this.table, this.table._columns, p, -1);
  }
  
  step() { return false; }
  getAsObject() { return {}; }
  reset() { this.params = []; return this; }
  free() { return true; }
}

class JsonTable {
  constructor(name) {
    this.name = name;
    this._columns = [];
    this._rows = [];
  }
  
  _setColumns(cols) {
    this._columns = cols.map(c => c.toLowerCase().split(' ')[0].replace(/[`"]/g, ''));
  }
  
  _insert(values) {
    const row = {};
    this._columns.forEach((col, i) => {
      row[col] = values[i] !== undefined ? values[i] : null;
    });
    this._rows.push(row);
    return { changes: 1, lastInsertRowid: this._rows.length };
  }
  
  _select(columns, values, limit) {
    let results = [...this._rows];
    
    // WHERE clause - simple equality
    if (columns && columns.includes('=')) {
      const colName = columns.split('=')[0].trim().toLowerCase().replace(/[?`"]/g, '');
      const val = values[0];
      results = results.filter(r => r[colName] === val);
    }
    
    // ORDER BY
    if (columns && columns.toLowerCase().includes('order by')) {
      const match = columns.match(/order by\s+(\w+)(?:\s+(desc|asc))?/i);
      if (match) {
        const col = match[1].toLowerCase();
        const desc = match[2]?.toUpperCase() === 'DESC';
        results.sort((a, b) => {
          const va = a[col] || 0, vb = b[col] || 0;
          return desc ? vb - va : va - vb;
        });
      }
    }
    
    // LIMIT
    if (columns && columns.toLowerCase().includes('limit')) {
      const match = columns.match(/limit\s+(\d+)/i);
      if (match) {
        results = results.slice(0, parseInt(match[1]));
      }
    }
    
    return results;
  }
}

class JsonDatabase {
  constructor(filename) {
    this.filename = filename;
    this.closed = false;
    this._tables = new Map();
    this._load();
  }
  
  _load() {
    try {
      if (fs.existsSync(this.filename)) {
        const data = fs.readFileSync(this.filename, 'utf-8');
        const parsed = JSON.parse(data);
        for (const [name, rows] of Object.entries(parsed)) {
          const table = new JsonTable(name);
          if (rows.length > 0) {
            table._setColumns(Object.keys(rows[0]));
          }
          table._rows = rows;
          this._tables.set(name.toLowerCase(), table);
        }
      }
    } catch (e) {
      // Start fresh
    }
  }
  
  _save() {
    try {
      const data = {};
      for (const [name, table] of this._tables) {
        data[name] = table._rows;
      }
      fs.writeFileSync(this.filename, JSON.stringify(data, null, 2));
    } catch (e) {
      // Ignore save errors
    }
  }
  
  pragma(stmt) { return []; }
  
  exec(sql) {
    const upper = sql.trim().toUpperCase();
    
    // CREATE TABLE
    if (upper.startsWith('CREATE TABLE')) {
      const match = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
      if (match) {
        const name = match[1].toLowerCase();
        const table = new JsonTable(name);
        
        // Extract column names
        const colMatch = sql.match(/\(([^)]+)\)/);
        if (colMatch) {
          table._setColumns(colMatch[1].split(',').map(c => c.trim().split(/\s+/)[0]));
        }
        
        this._tables.set(name, table);
      }
    }
    
    // CREATE INDEX
    if (upper.startsWith('CREATE INDEX')) {
      // Silently ignore - we don't need indexes for JSON storage
    }
    
    return [];
  }
  
  prepare(sql) {
    // Extract table name from SQL
    let tableName = null;
    
    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    if (fromMatch) {
      tableName = fromMatch[1].toLowerCase();
    }
    
    const intoMatch = sql.match(/INTO\s+(\w+)/i);
    if (intoMatch) {
      tableName = intoMatch[1].toLowerCase();
    }
    
    const updateMatch = sql.match(/UPDATE\s+(\w+)/i);
    if (updateMatch) {
      tableName = updateMatch[1].toLowerCase();
    }
    
    if (!tableName || !this._tables.has(tableName)) {
      // Return a dummy statement
      return new JsonStatement({ _columns: [], _rows: [] }, this);
    }
    
    const table = this._tables.get(tableName);
    const stmt = new JsonStatement(table, this);
    
    // Parse WHERE clause for column names
    if (sql.toLowerCase().includes('where')) {
      const whereMatch = sql.match(/WHERE\s+(\w+)\s*=/i);
      if (whereMatch) {
        // Table already has columns, just use it
      }
    }
    
    return stmt;
  }
  
  transaction(fn) {
    return () => {
      try {
        fn();
        this._save();
        return true;
      } catch (e) {
        return false;
      }
    };
  }
  
  run(sql, ...params) {
    this.prepare(sql).run(...params);
    this._save();
    return { changes: 0, lastInsertRowid: 0 };
  }
  
  get(sql, ...params) {
    return this.prepare(sql).get(...params);
  }
  
  all(sql, ...params) {
    return this.prepare(sql).all(...params);
  }
  
  each(sql, callback) {
    const results = this.all(sql);
    results.forEach(r => callback(r));
    return results.length;
  }
  
  close() {
    this._save();
    this.closed = true;
  }
  
  open() { return !this.closed; }
  export() { return Buffer.alloc(0); }
}

// Install as better-sqlite3 replacement
module.exports = JsonDatabase; module.exports.json = true;
module.exports.Database = JsonDatabase;
