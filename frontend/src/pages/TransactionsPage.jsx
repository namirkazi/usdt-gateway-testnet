// src/pages/TransactionsPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, RefreshCw, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { transactions as txApi } from '../api/client';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['', 'pending', 'confirmed', 'swept', 'failed'];

function StatusBadge({ status }) {
  return <span className={`badge-${status}`}>{status}</span>;
}

export default function TransactionsPage() {
  const [txs,       setTxs]       = useState([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [status,    setStatus]    = useState('');
  const [page,      setPage]      = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const LIMIT = 20;

  const load = useCallback(async () => {
    try {
      const params = { limit: LIMIT, offset: page * LIMIT };
      if (status) params.status = status;
      const res = await txApi.list(params);
      setTxs(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
    } catch {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = (e) => {
    setStatus(e.target.value);
    setPage(0);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Transactions</h1>
          <p className="text-gray-500 text-sm mt-1">{total} total records</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Status filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={status}
              onChange={handleStatusChange}
              className="input py-2 w-36 text-sm"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s || 'All statuses'}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => { setRefreshing(true); load(); }}
            disabled={refreshing}
            className="btn-ghost"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : txs.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <p>No transactions found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-700">
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-5">TX Hash</th>
                  <th className="py-3 px-5">Amount</th>
                  <th className="py-3 px-5">From</th>
                  <th className="py-3 px-5">Wallet</th>
                  <th className="py-3 px-5">Conf.</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Sweep TX</th>
                  <th className="py-3 px-5">Detected</th>
                </tr>
              </thead>
              <tbody>
                {txs.map(tx => (
                  <tr
                    key={tx.id}
                    className="border-t border-surface-600 hover:bg-surface-700/30 transition-colors"
                  >
                    <td className="py-3.5 px-5">
                      <a
                        href={`https://tronscan.org/#/transaction/${tx.tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
                      >
                        {tx.tx_hash.slice(0, 10)}…{tx.tx_hash.slice(-6)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="py-3.5 px-5 font-mono font-semibold text-white">
                      {parseFloat(tx.amount_usdt).toFixed(2)}
                      <span className="text-gray-500 text-xs ml-1">USDT</span>
                    </td>
                    <td className="py-3.5 px-5 font-mono text-xs text-gray-400">
                      {tx.sender.slice(0, 8)}…{tx.sender.slice(-6)}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-xs text-gray-500">
                      {tx.wallet_address.slice(0, 8)}…
                    </td>
                    <td className="py-3.5 px-5 text-xs text-gray-400 font-mono">
                      {tx.confirmations}
                    </td>
                    <td className="py-3.5 px-5">
                      <StatusBadge status={tx.status} />
                    </td>
                    <td className="py-3.5 px-5">
                      {tx.sweep_tx_hash ? (
                        <a
                          href={`https://tronscan.org/#/transaction/${tx.sweep_tx_hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
                        >
                          {tx.sweep_tx_hash.slice(0, 8)}…
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-gray-700 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(tx.detected_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-surface-600 px-5 py-3 flex items-center justify-between text-sm">
            <p className="text-gray-500 text-xs">
              Showing {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="btn-ghost py-1.5 px-2 text-xs"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="btn-ghost py-1.5 px-2 text-xs"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
