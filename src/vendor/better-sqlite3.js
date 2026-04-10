/**
 * Better-SQLite3 Adapter with JSON Fallback
 * Tries native better-sqlite3 first, falls back to pure JS
 */

let Database;
let isJsonFallback = false;

try {
  Database = require('better-sqlite3');
} catch (e) {
  isJsonFallback = true;
  Database = createJsonDatabase();
}

function createJsonDatabase() {
  const fs = require('fs');
  
  class JsonDatabase {
    constructor(filename) {
      this.filename = filename;
      this.closed = false;
      this._tables = {};
      this._load();
    }
    
    _load() {
      try {
        if (fs.existsSync(this.filename)) {
          const data = JSON.parse(fs.readFileSync(this.filename, 'utf-8'));
          this._tables = data;
        }
      } catch (e) { this._tables = {}; }
    }
    
    _save() {
      try {
        fs.writeFileSync(this.filename, JSON.stringify(this._tables, null, 2));
      } catch (e) {}
    }
    
    pragma() { return []; }
    
    exec(sql) {
      const upper = sql.trim().toUpperCase();
      if (upper.startsWith('CREATE TABLE')) {
        const match = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
        if (match) {
          const name = match[1].toLowerCase();
          if (!this._tables[name]) this._tables[name] = [];
          this._save(); // Persist immediately so CREATE TABLE survives restart
        }
      }
      return [];
    }
    
    prepare(sql) {
      return new JsonStatement(this, sql);
    }
    
    transaction(fn) {
      return () => { try { fn(); this._save(); return true; } catch (e) { return false; } };
    }
    
    run(sql, ...params) {
      const stmt = this.prepare(sql);
      stmt.run(...params);
      this._save();
      return { changes: 0, lastInsertRowid: 0 };
    }
    
    get(sql, ...params) { return this.prepare(sql).get(...params); }
    all(sql, ...params) { return this.prepare(sql).all(...params); }
    each(sql, callback) { this.all(sql).forEach(r => callback(r)); return 0; }
    close() { this._save(); this.closed = true; }
    open() { return !this.closed; }
    export() { return Buffer.alloc(0); }
  }
  
  class JsonStatement {
    constructor(db, sql) {
      this.db = db;
      this.sql = sql;
      this.params = [];
    }
    
    bind(...params) { this.params = params; return this; }
    
    run(...params) {
      const p = params.length > 0 ? params : this.params;
      const tableName = this._getTableName();
      if (!tableName || !this.db._tables[tableName]) return { changes: 0 };
      
      const table = this.db._tables[tableName];
      const cols = this._getColumns(this.sql);
      const row = {};
      cols.forEach((col, i) => { row[col] = p[i] !== undefined ? p[i] : null; });
      table.push(row);
      this.db._save(); // Persist after insert/update/delete
      return { changes: 1, lastInsertRowid: table.length };
    }
    
    get(...params) {
      const p = params.length > 0 ? params : this.params;
      const rows = this.all(...p);
      return rows.length > 0 ? rows[0] : {};
    }
    
    all(...params) {
      const p = params.length > 0 ? params : this.params;
      const tableName = this._getTableName();
      if (!tableName || !this.db._tables[tableName]) {
        return this._isAggregateQuery() ? [{}] : [];
      }
      
      let rows = [...this.db._tables[tableName]];
      
      // WHERE clause
      if (this.sql && this.sql.toLowerCase().includes('where')) {
        const match = this.sql.match(/where\s+(\w+)\s*=\s*\?/i);
        if (match && p[0] !== undefined) {
          rows = rows.filter(r => r[match[1].toLowerCase()] === p[0]);
        }
      }
      
      // ORDER BY
      if (this.sql && this.sql.toLowerCase().includes('order by')) {
        const match = this.sql.match(/order by\s+(\w+)(?:\s+(desc|asc))?/i);
        if (match) {
          const col = match[1].toLowerCase();
          const desc = match[2] && match[2].toUpperCase() === 'DESC';
          rows.sort((a, b) => {
            const va = a[col] || 0, vb = b[col] || 0;
            return desc ? vb - va : va - vb;
          });
        }
      }
      
      if (this._isAggregateQuery()) {
        return [this._computeAggregates(rows)];
      }

      // LIMIT
      if (this.sql && this.sql.toLowerCase().includes('limit')) {
        const match = this.sql.match(/limit\s+(\d+)/i);
        if (match) rows = rows.slice(0, parseInt(match[1]));
      }
      
      return rows;
    }

    _isAggregateQuery() {
      if (!this.sql) return false;
      const lower = this.sql.toLowerCase();
      return lower.includes('count(*)') || lower.includes('sum(') || lower.includes('avg(') || lower.includes('max(');
    }

    _computeAggregates(rows) {
      const result = {};
      const lower = this.sql.toLowerCase();

      const countMatch = lower.match(/count\(\*\)\s+as\s+(\w+)/i);
      if (countMatch) result[countMatch[1]] = rows.length;

      const sumMatch = lower.match(/sum\((\w+)\)\s+as\s+(\w+)/i);
      if (sumMatch) {
        const field = sumMatch[1].toLowerCase();
        result[sumMatch[2]] = rows.reduce((acc, row) => acc + (Number(row[field]) || 0), 0);
      }

      const avgMatch = lower.match(/avg\((\w+)\)\s+as\s+(\w+)/i);
      if (avgMatch) {
        const field = avgMatch[1].toLowerCase();
        result[avgMatch[2]] = rows.length ? rows.reduce((acc, row) => acc + (Number(row[field]) || 0), 0) / rows.length : 0;
      }

      const maxMatch = lower.match(/max\((\w+)\)\s+as\s+(\w+)/i);
      if (maxMatch) {
        const field = maxMatch[1].toLowerCase();
        result[maxMatch[2]] = rows.length ? Math.max(...rows.map(row => Number(row[field]) || 0)) : 0;
      }

      return result;
    }
    
    _getTableName() {
      if (!this.sql) return null;
      const fromMatch = this.sql.match(/from\s+(\w+)/i);
      const intoMatch = this.sql.match(/into\s+(\w+)/i);
      const updateMatch = this.sql.match(/update\s+(\w+)/i);
      let name = null;
      if (fromMatch) name = fromMatch[1];
      else if (intoMatch) name = intoMatch[1];
      else if (updateMatch) name = updateMatch[1];
      return name ? name.toLowerCase() : null;
    }
    
    _getColumns(sql) {
      if (!sql) return [];
      // Try to extract column names from INSERT or table definition
      const intoMatch = sql.match(/insert into \w+ \(([^)]+)\)/i);
      if (intoMatch) {
        return intoMatch[1].split(',').map(c => c.trim().toLowerCase());
      }
      // For SELECT, return empty - we don't validate column names
      return [];
    }
    
    step() { return false; }
    getAsObject() { return {}; }
    reset() { this.params = []; return this; }
    free() { return true; }
  }
  
  return JsonDatabase;
}

module.exports = Database;
module.exports.Database = Database;
module.exports.isJsonFallback = isJsonFallback;
