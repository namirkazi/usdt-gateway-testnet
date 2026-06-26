// src/pages/WalletsPage.jsx
import { useState, useEffect } from 'react';
import {
  Plus, RefreshCw, QrCode, Copy, Send,
  CheckCircle2, Archive, Wallet, ExternalLink
} from 'lucide-react';
import { wallets as walletsApi } from '../api/client';
import toast from 'react-hot-toast';

function WalletCard({ wallet, onSweep, onRefresh }) {
  const [copied, setCopied] = useState(false);
  const [qrModal, setQrModal] = useState(null);
  const [sweeping, setSweeping] = useState(false);

  const copyAddr = () => {
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    toast.success('Copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const showQr = async () => {
    try {
      const res = await walletsApi.qr(wallet.id);
      setQrModal(res.data.data.qrCode);
    } catch {
      toast.error('Failed to load QR');
    }
  };

  const handleSweep = async () => {
    if (!window.confirm(`Sweep ${parseFloat(wallet.usdt_balance).toFixed(2)} USDT to treasury?`)) return;
    setSweeping(true);
    try {
      const res = await walletsApi.sweep(wallet.id);
      toast.success(`Swept ${res.data.data.amountSwept.toFixed(2)} USDT`);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sweep failed');
    } finally {
      setSweeping(false);
    }
  };

  return (
    <>
      <div className={`card ${wallet.status === 'active' ? 'border-brand-600/40' : ''}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className={`badge-${wallet.status}`}>
              {wallet.status === 'active' ? '● Active' : 'Archived'}
            </span>
            {wallet.label && (
              <p className="text-xs text-gray-500 mt-1">{wallet.label}</p>
            )}
          </div>
          <p className="text-xs text-gray-600">
            {new Date(wallet.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Address */}
        <div className="bg-surface-700 rounded-lg p-3 mb-4">
          <p className="font-mono text-xs text-brand-400 break-all">{wallet.address}</p>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-surface-700/50 rounded-lg p-2.5 text-center">
            <p className="text-xs text-gray-500 mb-0.5">USDT</p>
            <p className="font-mono text-sm font-semibold text-white">
              {parseFloat(wallet.usdt_balance || 0).toFixed(4)}
            </p>
          </div>
          <div className="bg-surface-700/50 rounded-lg p-2.5 text-center">
            <p className="text-xs text-gray-500 mb-0.5">TRX</p>
            <p className="font-mono text-sm font-semibold text-white">
              {parseFloat(wallet.trx_balance || 0).toFixed(4)}
            </p>
          </div>
          <div className="bg-surface-700/50 rounded-lg p-2.5 text-center">
            <p className="text-xs text-gray-500 mb-0.5">Total Rcvd</p>
            <p className="font-mono text-sm font-semibold text-white">
              {parseFloat(wallet.total_received || 0).toFixed(2)}
            </p>
          </div>
        </div>

        {wallet.last_deposit_at && (
          <p className="text-xs text-gray-600 mb-4">
            Last deposit: {new Date(wallet.last_deposit_at).toLocaleString()}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={copyAddr} className="btn-ghost text-xs py-1.5 px-3">
            {copied ? <CheckCircle2 className="w-3 h-3 text-brand-400" /> : <Copy className="w-3 h-3" />}
            Copy
          </button>
          <button onClick={showQr} className="btn-ghost text-xs py-1.5 px-3">
            <QrCode className="w-3 h-3" />
            QR
          </button>
          <a
            href={`https://tronscan.org/#/address/${wallet.address}`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost text-xs py-1.5 px-3"
          >
            <ExternalLink className="w-3 h-3" />
            TronScan
          </a>
          {parseFloat(wallet.usdt_balance || 0) > 0 && (
            <button
              onClick={handleSweep}
              disabled={sweeping}
              className="btn-primary text-xs py-1.5 px-3 ml-auto"
            >
              {sweeping
                ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                : <Send className="w-3 h-3" />
              }
              Sweep
            </button>
          )}
        </div>
      </div>

      {/* QR Modal */}
      {qrModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setQrModal(null)}
        >
          <div className="card max-w-xs w-full text-center" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-medium text-white mb-4">Deposit USDT TRC20</p>
            <div className="bg-white p-3 rounded-xl inline-block mb-4">
              <img src={qrModal} alt="QR" className="w-48 h-48" />
            </div>
            <p className="font-mono text-xs text-brand-400 break-all mb-4">{wallet.address}</p>
            <button onClick={() => setQrModal(null)} className="btn-ghost w-full justify-center text-sm">
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function WalletsPage() {
  const [walletList, setWalletList] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [generating, setGenerating] = useState(false);
  const [label,      setLabel]      = useState('');

  const load = async () => {
    try {
      const res = await walletsApi.list();
      setWalletList(res.data.data.wallets || []);
    } catch {
      toast.error('Failed to load wallets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleGenerate = async () => {
    if (!window.confirm(
      'Generate a new deposit wallet?\n\nThe current active wallet will be archived (still monitored).'
    )) return;

    setGenerating(true);
    try {
      const res = await walletsApi.generate(label || undefined);
      toast.success(`Wallet generated: ${res.data.data.address.slice(0, 12)}…`);
      setLabel('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const active   = walletList.filter(w => w.status === 'active');
  const archived = walletList.filter(w => w.status === 'archived');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Wallets</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage deposit wallets. Only ONE active wallet at a time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Optional label…"
            className="input w-44 text-sm"
          />
          <button onClick={handleGenerate} disabled={generating} className="btn-primary">
            {generating
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Plus className="w-4 h-4" />
            }
            New Wallet
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Active */}
          {active.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                Active Wallet
              </h2>
              <div className="grid gap-4">
                {active.map(w => (
                  <WalletCard key={w.id} wallet={w} onRefresh={load} />
                ))}
              </div>
            </section>
          )}

          {/* Archived */}
          {archived.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Archive className="w-4 h-4" />
                Archived Wallets
                <span className="text-gray-600 font-normal normal-case">(still monitored)</span>
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {archived.map(w => (
                  <WalletCard key={w.id} wallet={w} onRefresh={load} />
                ))}
              </div>
            </section>
          )}

          {walletList.length === 0 && (
            <div className="card text-center py-16">
              <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 font-medium">No wallets yet</p>
              <p className="text-gray-600 text-sm mt-1">Click "New Wallet" to generate your first deposit address.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
