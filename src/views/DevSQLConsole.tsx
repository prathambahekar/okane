import React, { useState, useCallback, useMemo } from 'react';
import {
  Play,
  RefreshCw,
  Download,
  Upload,
  Terminal,
  Table as TableIcon,
  AlertCircle,
  Layers,
  Database,
  ArrowLeft,
  Copy,
  Check,
  Code,
  Zap,
  LayoutGrid,
  List,
  User,
} from 'lucide-react';
import { executeRawSQL, generateSQLDumpString, importSQLDumpString } from '../db';
import { useStore } from '../store';
import type { ViewName } from '../types';

interface DevSQLConsoleProps {
  onNavigate?: (v: ViewName) => void;
}

const TABLES = ['expenses', 'friends', 'wallets', 'settlements', 'recurring_rules', 'categories', 'settings'];

function getTableLabel(tbl: string): string {
  return tbl === 'friends' ? 'contacts' : tbl;
}

function getTableCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  TABLES.forEach(tbl => {
    try {
      const res = executeRawSQL(`SELECT COUNT(*) AS c FROM ${tbl}`) as { c: number }[];
      counts[tbl] = res?.[0]?.c ?? 0;
    } catch {
      counts[tbl] = 0;
    }
  });
  return counts;
}

function runInitialQuery(q: string) {
  try {
    const start = performance.now();
    const res = executeRawSQL(q);
    const elapsed = Math.round((performance.now() - start) * 100) / 100;
    if (Array.isArray(res)) {
      return { results: res as Record<string, unknown>[], execTimeMs: elapsed, error: null };
    } else if (typeof res === 'object' && res !== null) {
      return { results: [res as Record<string, unknown>], execTimeMs: elapsed, error: null };
    } else {
      return { results: [{ result: res === undefined ? 'Query executed successfully (no output)' : String(res) }], execTimeMs: elapsed, error: null };
    }
  } catch (err: unknown) {
    const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'SQL Execution error';
    return { results: null, execTimeMs: null, error: msg };
  }
}

export default function DevSQLConsole({ onNavigate }: DevSQLConsoleProps) {
  const { db, showToast, restoreDB } = useStore();

  const DEFAULT_Q = 'SELECT category, COUNT(*) AS items, SUM(amount) AS total_amount FROM expenses GROUP BY category ORDER BY total_amount DESC';
  const [query, setQuery] = useState(DEFAULT_Q);
  const [activeTable, setActiveTable] = useState('expenses');
  const [copied, setCopied] = useState(false);
  const [displayMode, setDisplayMode] = useState<'table' | 'cards'>('table');

  // Contact / Friend lookup map for easy display of names alongside IDs
  const friendMap = useMemo(() => {
    const map: Record<string, string> = {};
    (db.friends || []).forEach(f => {
      if (f.id && f.name) map[f.id] = f.name;
    });
    return map;
  }, [db.friends]);

  const [initialData] = useState(() => runInitialQuery(DEFAULT_Q));
  const [results, setResults] = useState<Record<string, unknown>[] | null>(initialData.results);
  const [error, setError] = useState<string | null>(initialData.error);
  const [execTimeMs, setExecTimeMs] = useState<number | null>(initialData.execTimeMs);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>(() => getTableCounts());

  const refreshTableCounts = useCallback(() => {
    setTableCounts(getTableCounts());
  }, []);

  const runQuery = useCallback((queryToRun?: string) => {
    const q = (queryToRun || query).trim();
    if (!q) return;

    setError(null);
    const start = performance.now();
    try {
      const res = executeRawSQL(q);
      const elapsed = Math.round((performance.now() - start) * 100) / 100;
      setExecTimeMs(elapsed);

      if (Array.isArray(res)) {
        setResults(res as Record<string, unknown>[]);
      } else if (typeof res === 'object' && res !== null) {
        setResults([res as Record<string, unknown>]);
      } else {
        setResults([{ result: res === undefined ? 'Query executed successfully (no output)' : String(res) }]);
      }
      refreshTableCounts();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'SQL Execution error';
      setError(msg);
      setResults(null);
      setExecTimeMs(null);
    }
  }, [query, refreshTableCounts]);

  const inspectTable = (tbl: string) => {
    setActiveTable(tbl);
    const q = `SELECT * FROM ${tbl} LIMIT 50`;
    setQuery(q);
    runQuery(q);
  };

  const handleExportSQL = () => {
    try {
      const dump = generateSQLDumpString();
      const blob = new Blob([dump], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `okane-dev-database-${new Date().toISOString().slice(0, 10)}.db`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Database dump downloaded (.db)');
    } catch (err) {
      console.error(err);
      showToast('Failed to generate database dump');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const restored = importSQLDumpString(text);
        restoreDB(restored);
        refreshTableCounts();
        runQuery(`SELECT * FROM ${activeTable} LIMIT 20`);
        showToast('SQL Database restored from file successfully!');
      } catch (err) {
        console.error(err);
        showToast('Invalid SQL/DB file format');
      }
    };
    reader.readAsText(file);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runQuery();
    }
  };

  const copyResultsCSV = () => {
    if (!results || results.length === 0) return;
    const headers = Object.keys(results[0]);
    const csvRows = [
      headers.join(','),
      ...results.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
    ];
    navigator.clipboard.writeText(csvRows.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('Results copied as CSV');
  };

  const presets = [
    { label: 'Expenses (with Contacts)', query: 'SELECT e.id, e.description, e.amount, f.name AS contact, e.category, e.date FROM expenses e LEFT JOIN friends f ON e.friendId = f.id ORDER BY e.date DESC LIMIT 30' },
    { label: 'Category Totals', query: 'SELECT category, COUNT(*) AS items, SUM(amount) AS total_amount FROM expenses GROUP BY category ORDER BY total_amount DESC' },
    { label: 'Contacts List', query: 'SELECT id, name, type, color, notes FROM friends' },
    { label: 'Wallets & Balances', query: 'SELECT id, name, openingBalance, currentBalance, color FROM wallets' },
    { label: 'Autopay & Rules', query: 'SELECT r.id, r.title, r.kind, r.amount, f.name AS contact, r.frequency, r.status FROM recurring_rules r LEFT JOIN friends f ON r.friendId = f.id' },
    { label: 'Settlements', query: 'SELECT s.id, f.name AS contact, s.amount, s.date, s.note FROM settlements s LEFT JOIN friends f ON s.friendId = f.id ORDER BY s.date DESC' },
  ];

  const totalRecords = Object.values(tableCounts).reduce((a, b) => a + b, 0);

  const renderCellValue = (val: unknown, colName: string) => {
    if (val === null || val === undefined) {
      return <span style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: 11 }}>null</span>;
    }

    if (typeof val === 'boolean') {
      return (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
          background: val ? 'rgba(34, 197, 94, 0.15)' : 'var(--surface3)',
          color: val ? '#22c55e' : 'var(--text-3)'
        }}>
          {String(val)}
        </span>
      );
    }

    if (typeof val === 'number') {
      return <span style={{ fontWeight: 600, color: 'var(--text)' }}>{val}</span>;
    }

    if (typeof val === 'object') {
      return <span style={{ color: 'var(--accent)', fontSize: 11 }}>{JSON.stringify(val)}</span>;
    }

    const strVal = String(val);
    const friendName = friendMap[strVal];

    if (friendName) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            fontWeight: 600, color: 'var(--text)',
            background: 'var(--accent-soft)', padding: '1px 6px', borderRadius: 4,
            fontSize: 11, border: '1px solid var(--border)',
            display: 'inline-flex', alignItems: 'center', gap: 3
          }}>
            <User size={10} style={{ color: 'var(--accent)' }} /> {friendName}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'monospace' }}>({strVal})</span>
        </span>
      );
    }

    if ((colName.toLowerCase().includes('friend') || colName.toLowerCase().includes('contact')) && !friendName) {
      return (
        <span style={{ color: 'var(--text-3)', fontFamily: 'monospace', fontSize: 11 }}>
          {strVal || <span style={{ fontStyle: 'italic' }}>none</span>}
        </span>
      );
    }

    return <span style={{ color: 'var(--text-2)' }}>{strVal}</span>;
  };

  return (
    <div className="view-container" style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 60, paddingLeft: 12, paddingRight: 12 }}>
      {/* Top Header Card - Accent Gradient Theme */}
      <div style={{
        background: 'var(--accent-gradient-soft)',
        border: '1px solid var(--accent-soft)',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 16px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap'
      }}>
        {/* Left: Back + Icon + Title + Minimal info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 auto' }}>
          {onNavigate && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onNavigate('settings')}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                flexShrink: 0
              }}
            >
              <ArrowLeft size={16} />
            </button>
          )}

          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'var(--accent-gradient)',
            color: 'var(--accent-contrast)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(30, 136, 229, 0.25)'
          }}>
            <Database size={18} />
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h1 style={{
                fontSize: 16,
                fontWeight: 700,
                margin: 0,
                background: 'var(--accent-gradient)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                whiteSpace: 'nowrap'
              }}>
                SQL Console
              </h1>
              <span style={{
                fontSize: 9.5,
                fontWeight: 800,
                padding: '2px 6px',
                borderRadius: 10,
                background: 'var(--accent-gradient)',
                color: 'var(--accent-contrast)',
                letterSpacing: '0.5px',
                flexShrink: 0
              }}>
                DEV
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              AlaSQL · {totalRecords} records
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleExportSQL}
            style={{
              fontSize: 12,
              fontWeight: 600,
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              boxShadow: 'var(--shadow)',
              cursor: 'pointer'
            }}
            title="Download database dump"
          >
            <Download size={14} style={{ color: 'var(--accent)' }} /> Export
          </button>
          <label
            className="btn btn-sm"
            style={{
              fontSize: 12,
              fontWeight: 600,
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              boxShadow: 'var(--shadow)',
              cursor: 'pointer',
              margin: 0
            }}
          >
            <Upload size={14} style={{ color: 'var(--accent)' }} /> Import
            <input type="file" accept=".db,.sql,.json,text/plain" onChange={handleImportFile} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Database Tables Section */}
      <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            <TableIcon size={15} style={{ color: 'var(--accent)' }} /> Database Tables
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={refreshTableCounts} style={{ fontSize: 11, gap: 4, padding: '3px 8px' }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {/* Scrollable horizontal pills for mobile responsiveness */}
        <div style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 4,
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}>
          {TABLES.map(tbl => {
            const isActive = activeTable === tbl;
            const label = getTableLabel(tbl);
            return (
              <button
                key={tbl}
                type="button"
                onClick={() => inspectTable(tbl)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                  border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: isActive ? 'var(--accent-soft)' : 'var(--surface-hover)',
                  color: isActive ? 'var(--accent)' : 'var(--text-2)',
                  boxShadow: isActive ? '0 2px 6px -2px var(--accent-soft)' : 'none',
                }}
              >
                <span>{label}</span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: isActive ? 'var(--accent)' : 'var(--border2)',
                  color: isActive ? 'var(--accent-contrast)' : 'var(--text-2)',
                }}>
                  {tableCounts[tbl] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SQL Query Editor Card */}
      <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
            <Terminal size={15} style={{ color: 'var(--accent)' }} /> SQL Query Console
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'none', minWidth: 0 }} className="desktop-shortcut">
            Shortcut: <kbd style={{ background: 'var(--surface2)', border: '1px solid var(--border)', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace' }}>Ctrl + Enter</kbd>
          </div>
        </div>

        {/* Query Presets Pills (Horizontal scrollable) */}
        <div style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 6,
          marginBottom: 10,
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none'
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', alignSelf: 'center', whiteSpace: 'nowrap', marginRight: 2, flexShrink: 0 }}>
            Presets:
          </span>
          {presets.map((p, i) => (
            <button
              key={i}
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11, whiteSpace: 'nowrap', padding: '4px 10px', borderRadius: 16, background: 'var(--surface-hover)', border: '1px solid var(--border)', flexShrink: 0 }}
              onClick={() => {
                setQuery(p.query);
                runQuery(p.query);
              }}
            >
              <Code size={11} style={{ marginRight: 4, opacity: 0.7 }} />
              {p.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', marginBottom: 12 }}>
          <textarea
            className="form-input"
            style={{
              width: '100%',
              height: 90,
              fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
              fontSize: 13,
              lineHeight: 1.45,
              padding: '10px 12px',
              borderRadius: 8,
              resize: 'vertical',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.05)',
            }}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter custom SQL query (e.g. SELECT * FROM expenses WHERE amount > 100)"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setQuery('')}
            style={{ fontSize: 12, color: 'var(--text-3)' }}
          >
            Clear Editor
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => runQuery()}
            style={{ padding: '8px 18px', gap: 6, fontSize: 13, fontWeight: 600, width: '100%', maxWidth: '200px', justifyContent: 'center' }}
          >
            <Play size={14} /> Execute Query
          </button>
        </div>
      </div>

      {/* Query Errors Alert */}
      {error && (
        <div className="card" style={{ padding: '12px 14px', marginBottom: 16, borderLeft: '4px solid var(--debit)', background: 'var(--debit-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--debit)', fontWeight: 600, fontSize: 13 }}>
            <AlertCircle size={16} /> SQL Execution Error
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, marginTop: 4, color: 'var(--debit)', wordBreak: 'break-word' }}>
            {error}
          </div>
        </div>
      )}

      {/* Results Section */}
      {results && (
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 14 }}>
                <Layers size={15} style={{ color: 'var(--accent)' }} /> Query Results
              </div>
              {execTimeMs !== null && (
                <span style={{
                  fontSize: 10, fontWeight: 600, color: 'var(--text-2)',
                  background: 'var(--surface2)', padding: '2px 7px', borderRadius: 10,
                  display: 'inline-flex', alignItems: 'center', gap: 3
                }}>
                  <Zap size={10} style={{ color: 'var(--accent)' }} /> {execTimeMs} ms
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)' }}>
                {results.length} {results.length === 1 ? 'row' : 'rows'}
              </span>

              {/* View Toggle Mode */}
              <div style={{ display: 'inline-flex', background: 'var(--surface2)', padding: 2, borderRadius: 6, border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setDisplayMode('table')}
                  style={{
                    padding: '3px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                    background: displayMode === 'table' ? 'var(--surface)' : 'transparent',
                    color: displayMode === 'table' ? 'var(--accent)' : 'var(--text-3)',
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600
                  }}
                  title="Table View"
                >
                  <List size={13} /> Table
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode('cards')}
                  style={{
                    padding: '3px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                    background: displayMode === 'cards' ? 'var(--surface)' : 'transparent',
                    color: displayMode === 'cards' ? 'var(--accent)' : 'var(--text-3)',
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600
                  }}
                  title="Mobile Card View"
                >
                  <LayoutGrid size={13} /> Cards
                </button>
              </div>

              {results.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={copyResultsCSV}
                  style={{ fontSize: 11, gap: 4, padding: '4px 8px' }}
                >
                  {copied ? <Check size={12} style={{ color: 'var(--credit)' }} /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'CSV'}
                </button>
              )}
            </div>
          </div>

          {results.length === 0 ? (
            <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              Query executed successfully. 0 rows returned.
            </div>
          ) : displayMode === 'cards' ? (
            /* Responsive Mobile Card Grid View */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {results.map((row, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Row #{idx + 1}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {Object.entries(row).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-2)', fontFamily: 'monospace', fontSize: 11 }}>
                          {k}:
                        </span>
                        <span style={{ textAlign: 'right', wordBreak: 'break-all' }}>
                          {renderCellValue(v, k)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Classic Responsive Horizontal Scroll Table View */
            <div style={{
              overflowX: 'auto',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--surface)',
              maxHeight: 450,
              WebkitOverflowScrolling: 'touch'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 1 }}>
                    {Object.keys(results[0] || {}).map(col => (
                      <th key={col} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', borderRight: '1px solid var(--border)' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: idx % 2 === 0 ? 'transparent' : 'var(--surface-hover)',
                      }}
                    >
                      {Object.entries(row).map(([colName, val], cidx) => (
                        <td key={cidx} style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--text-2)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', borderRight: '1px solid var(--border)' }}>
                          {renderCellValue(val, colName)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
