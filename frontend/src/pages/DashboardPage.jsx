// src/pages/DashboardPage.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Copy, Download, CheckCircle2,
  TrendingUp, Wallet, ArrowDownToLine, Clock,
  Send, AlertTriangle, ExternalLink
} from 'lucide-react';
import { wallets as walletsApi, transactions as txApi } from '../api/client';
import toast from 'react-hot-toast';

// ── Small components ──────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, accent = false }) {
  return (
    <div className={`card flex items-start justify-between ${accent ? 'border-brand-600/40 bg-brand-900/10' : ''}`}>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-bold text-white font-mono">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent ? 'bg-brand-600/20' : 'bg-surface-700'}`}>
        <Icon className={`w-5 h-5 ${accent ? 'text-brand-400' : 'text-gray-400'}`} />
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  return <span className={`badge-${status}`}>{status}</span>;
}

function TxRow({ tx }) {
  return (
    <tr className="border-t border-surface-600 hover:bg-surface-700/30 transition-colors">
      <td className="py-3 px-4">
        <a
          href={`https://tronscan.org/#/transaction/${tx.tx_hash}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
        >
          {tx.tx_hash.slice(0, 12)}…{tx.tx_hash.slice(-6)}
          <ExternalLink className="w-3 h-3" />
        </a>
      </td>
      <td className="py-3 px-4 font-mono text-sm text-white">
        {parseFloat(tx.amount_usdt).toFixed(2)} <span className="text-gray-500 text-xs">USDT</span>
      </td>
      <td className="py-3 px-4 font-mono text-xs text-gray-400">
        {tx.sender.slice(0, 8)}…{tx.sender.slice(-6)}
      </td>
      <td className="py-3 px-4 text-xs text-gray-500">
        {tx.confirmations} conf.
      </td>
      <td className="py-3 px-4">
        <StatusBadge status={tx.status} />
      </td>
      <td className="py-3 px-4 text-xs text-gray-500">
        {new Date(tx.detected_at).toLocaleString()}
      </td>
    </tr>
  );
}

// ── Main Dashboard ────────────────────────────────────────

export default function DashboardPage() {
  const [wallet,  setWallet]  = useState(null);
  const [stats,   setStats]   = useState(null);
  const [txs,     setTxs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);
  const [copied,  setCopied]  = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [walletRes, statsRes, txRes] = await Promise.allSettled([
        walletsApi.active(),
        walletsApi.stats(),
        txApi.list({ limit: 10 }),
      ]);

      if (walletRes.status === 'fulfilled') setWallet(walletRes.value.data.data);
      if (statsRes.status === 'fulfilled')  setStats(statsRes.value.data.data);
      if (txRes.status === 'fulfilled')     setTxs(txRes.value.data.data || []);
    } catch (err) {
      // Errors handled per-call above
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    // Auto-refresh every 30 seconds
    const id = setInterval(loadAll, 30_000);
    return () => clearInterval(id);
  }, [loadAll]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  const copyAddress = () => {
    if (!wallet?.address) return;
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    toast.success('Address copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQR = () => {
    if (!wallet?.qrCode) return;
    const a = document.createElement('a');
    a.href = wallet.qrCode;
    a.download = `usdt-deposit-${wallet.address.slice(0, 8)}.png`;
    a.click();
  };

  const handleSweep = async () => {
    if (!wallet?.id) return;
    const confirmed = window.confirm(
      `Sweep ${parseFloat(wallet.usdt_balance).toFixed(2)} USDT to treasury wallet?\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    setSweeping(true);
    try {
      const res = await walletsApi.sweep(wallet.id);
      toast.success(`✅ Swept ${res.data.data.amountSwept.toFixed(2)} USDT to treasury`);
      loadAll();
    } catch (err) {
      const msg = err.response?.data?.error || 'Sweep failed';
      toast.error(msg);
    } finally {
      setSweeping(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const txStats = stats?.txStats;
  const wStats  = stats?.walletStats;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Live overview of your payment gateway</p>
        </div>
        <button onClick={handleRefresh} className="btn-ghost" disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="USDT Held"
          value={`$${parseFloat(wallet?.usdt_balance || 0).toFixed(2)}`}
          sub="in active wallet"
          icon={Wallet}
          accent
        />
        <StatCard
          label="Total Received"
          value={`$${parseFloat(wStats?.total_received_ever || 0).toFixed(2)}`}
          sub="all time"
          icon={TrendingUp}
        />
        <StatCard
          label="Transactions"
          value={txStats?.total_transactions || 0}
          sub={`${txStats?.pending_count || 0} pending`}
          icon={ArrowDownToLine}
        />
        <StatCard
          label="TRX Balance"
          value={parseFloat(wallet?.trx_balance || 0).toFixed(4)}
          sub="for gas fees"
          icon={Clock}
        />
      </div>

      {/* Active Wallet + QR */}
      {wallet ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Wallet info */}
          <div className="lg:col-span-2 card space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Active Deposit Wallet</p>
                <span className="badge-active">● Active</span>
              </div>
              {wallet.last_deposit_at && (
                <p className="text-xs text-gray-500">
                  Last deposit: {new Date(wallet.last_deposit_at).toLocaleString()}
                </p>
              )}
            </div>

            {/* Address */}
            <div className="bg-surface-700 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Address</p>
              <p className="font-mono text-sm text-brand-400 break-all">{wallet.address}</p>
            </div>

            {/* Balances */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-700 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">USDT Balance</p>
                <p className="text-xl font-bold font-mono text-white">
                  {parseFloat(wallet.usdt_balance || 0).toFixed(6)}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">USDT TRC20</p>
              </div>
              <div className="bg-surface-700 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">TRX Balance</p>
                <p className="text-xl font-bold font-mono text-white">
                  {parseFloat(wallet.trx_balance || 0).toFixed(4)}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">for gas fees</p>
              </div>
            </div>

            {/* Total received */}
            <div className="border-t border-surface-600 pt-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Total Received (this wallet)</p>
                <p className="font-mono text-lg font-semibold text-white mt-1">
                  {parseFloat(wallet.total_received || 0).toFixed(6)} USDT
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 flex-wrap">
              <button onClick={copyAddress} className="btn-ghost">
                {copied ? <CheckCircle2 className="w-4 h-4 text-brand-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Address'}
              </button>
              <button onClick={downloadQR} className="btn-ghost">
                <Download className="w-4 h-4" />
                Download QR
              </button>
              <button
                onClick={handleSweep}
                disabled={sweeping || parseFloat(wallet.usdt_balance || 0) <= 0}
                className="btn-primary ml-auto"
              >
                {sweeping ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {sweeping ? 'Sweeping…' : 'Sweep to Treasury'}
              </button>
            </div>

            {parseFloat(wallet.usdt_balance || 0) <= 0 && (
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-surface-700/50 rounded-lg p-3">
                <AlertTriangle className="w-3 h-3" />
                No USDT balance to sweep. Waiting for deposits.
              </div>
            )}
          </div>

          {/* QR Code */}
          <div className="card flex flex-col items-center justify-center text-center space-y-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Scan to deposit USDT TRC20</p>
            {wallet.qrCode ? (
              <div className="bg-white p-3 rounded-xl">
                <img src={wallet.qrCode} alt="QR Code" className="w-48 h-48" />
              </div>
            ) : (
              <div className="w-48 h-48 bg-surface-700 rounded-xl flex items-center justify-center">
                <p className="text-gray-500 text-sm">No QR</p>
              </div>
            )}
            <p className="text-xs text-yellow-500/80 bg-yellow-900/20 border border-yellow-700/30 rounded-lg px-3 py-2">
              ⚠️ TRC20 only — do not send ERC20 USDT
            </p>
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">No active deposit wallet</p>
          <p className="text-gray-600 text-sm mt-1">
            Go to <strong className="text-gray-400">Wallets</strong> and generate one to get started.
          </p>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-white">Recent Transactions</h2>
          <a href="/transactions" className="text-xs text-brand-400 hover:text-brand-300">
            View all →
          </a>
        </div>

        {txs.length === 0 ? (
          <div className="text-center py-10 text-gray-600">
            <ArrowDownToLine className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No transactions yet. Waiting for incoming deposits.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="pb-3 px-4">TX Hash</th>
                  <th className="pb-3 px-4">Amount</th>
                  <th className="pb-3 px-4">From</th>
                  <th className="pb-3 px-4">Conf.</th>
                  <th className="pb-3 px-4">Status</th>
                  <th className="pb-3 px-4">Detected</th>
                </tr>
              </thead>
              <tbody>
                {txs.map(tx => <TxRow key={tx.id} tx={tx} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
