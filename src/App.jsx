import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import {
  Wallet, CheckCircle2, Loader2, Zap, Shield,
  Clock, Star, X, ChevronRight, LockKeyhole, Activity, BarChart3, Layers, Upload,
  ExternalLink, Settings,
} from 'lucide-react';
import { useWallet } from './hooks/useWallet';
import ProofSubmitModal from './components/ProofSubmitModal';
import VerifyProofsPanel from './components/VerifyProofsPanel';
import AdminPanel from './components/AdminPanel';
import { HABIT_CATEGORIES, ETHERSCAN_BASE_URL } from './constants/contract';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
const truncate = (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = (msg, type = 'success', txHash = null) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type, txHash }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  };
  const remove = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));
  return { toasts, add, remove };
}

// ──────────────────────────────────────────────────────────────────────────────
// ToastContainer — now with Etherscan TX links
// ──────────────────────────────────────────────────────────────────────────────
function ToastContainer({ toasts, remove }) {
  return (
    <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="toast-enter pointer-events-auto flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-slate-800/90 backdrop-blur-xl px-5 py-4 shadow-2xl">
          <div className="mt-0.5 shrink-0">
            {t.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-400" /> :
             t.type === 'error' ? <X size={18} className="text-red-400" /> :
             <Zap size={18} className="text-amber-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200">{t.msg}</p>
            {t.txHash && (
              <a
                href={`${ETHERSCAN_BASE_URL}/tx/${t.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 mt-1 transition-colors"
              >
                <ExternalLink size={10} />
                View on Etherscan
              </a>
            )}
          </div>
          <button onClick={() => remove(t.id)} className="text-slate-500 hover:text-slate-300 transition-colors shrink-0 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Navbar — with Admin link for owner
// ──────────────────────────────────────────────────────────────────────────────
function Navbar({ wallet, onConnect, isVerifier, isOwner, setView, currentView }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const navBtn = (label, view, icon, color = 'text-slate-400 hover:text-emerald-400') => (
    <button
      onClick={() => setView(view)}
      className={`${currentView === view ? 'text-emerald-400' : color} transition-colors duration-200 cursor-pointer flex items-center gap-1.5`}
    >
      {icon} {label}
    </button>
  );

  return (
    <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${scrolled ? 'bg-slate-900/90 backdrop-blur-xl border-b border-white/5 shadow-xl' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 select-none cursor-pointer" onClick={() => setView('home')}>
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <LockKeyhole size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white hidden sm:block">
            HABIT <span className="text-emerald-400">TRACKER</span>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          {navBtn('Dashboard', 'home', null)}
          {isVerifier && navBtn('Verifier Panel', 'verifier', <Shield size={14} />, 'text-violet-400 hover:text-violet-300')}
          {isOwner && navBtn('Admin', 'admin', <Settings size={14} />, 'text-amber-400 hover:text-amber-300')}
        </nav>

        <div>
          {wallet.status === 'disconnected' && (
            <button onClick={onConnect} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold text-sm px-5 py-2.5 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/30 cursor-pointer">
              <Wallet size={16} /> Connect Wallet
            </button>
          )}
          {wallet.status === 'connecting' && (
            <button disabled className="flex items-center gap-2 bg-slate-700 text-slate-300 font-semibold text-sm px-5 py-2.5 rounded-xl cursor-not-allowed">
              <Loader2 size={16} className="spin" /> Connecting...
            </button>
          )}
          {wallet.status === 'connected' && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-slate-800/80 border border-white/10 px-4 py-2 rounded-xl text-sm">
                <span className="text-emerald-400 font-semibold">{wallet.balance} ETH</span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-300 font-mono text-xs">{truncate(wallet.address)}</span>
              </div>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-md shadow-emerald-400/50 animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Hero & How It Works
// ──────────────────────────────────────────────────────────────────────────────
function Hero({ onCTA }) {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-24 pb-16 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-teal-400/8 rounded-full blur-3xl" />
        <div className="absolute top-2/3 left-1/3 w-64 h-64 bg-cyan-500/6 rounded-full blur-3xl" />
        {[...Array(10)].map((_, i) => (
          <div key={i} className="particle absolute w-1 h-1 bg-emerald-400/40 rounded-full"
            style={{ left: `${10 + i * 9}%`, top: `${20 + (i % 5) * 15}%`, animationDuration: `${3 + i * 0.7}s`, animationDelay: `${i * 0.3}s` }} />
        ))}
      </div>
      <div className="inline-flex items-center gap-2 bg-emerald-400/10 border border-emerald-400/20 text-emerald-300 text-xs font-semibold px-4 py-2 rounded-full mb-8 relative z-10">
        <Activity size={12} /> Web3 Accountability Protocol — Sepolia Testnet
      </div>
      <h1 className="relative z-10 text-4xl sm:text-5xl lg:text-7xl font-extrabold leading-tight tracking-tight max-w-4xl mx-auto mb-6">
        Track Your Habits. <span className="animate-gradient bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #34d399, #06b6d4, #34d399)' }}>Stake on Your Success.</span>
      </h1>
      <p className="relative z-10 text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed mb-10">
        Lock real ETH as collateral on any daily habit. Prove it daily with immutable IPFS uploads. Miss a day — lose a share. Hit your streak — reclaim everything <span className="text-emerald-400 font-medium">plus rewards</span>.
      </p>
      <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 mb-20">
        <button onClick={onCTA} className="group flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-8 py-4 rounded-2xl text-base transition-all duration-200 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-105 cursor-pointer">
          Start Staking Now <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: <CheckCircle2 size={24} />, title: 'Set Your Habit', desc: 'Choose any habit (gym, reading, code). Lock your ETH safely in our smart contract.', color: 'from-violet-500/20 to-purple-500/10', border: 'border-violet-400/20', text: 'text-violet-400' },
    { icon: <Upload size={24} />, title: 'Upload Daily Proof', desc: 'Take a photo/video and securely store it on the decentralized IPFS network.', color: 'from-emerald-500/20 to-teal-500/10', border: 'border-emerald-400/20', text: 'text-emerald-400' },
    { icon: <Shield size={24} />, title: 'Verified On-Chain', desc: 'Your proof is cryptographically timestamped and verifiers review it for authenticity.', color: 'from-cyan-500/20 to-sky-500/10', border: 'border-cyan-400/20', text: 'text-cyan-400' },
    { icon: <Star size={24} />, title: 'Claim Your Rewards', desc: 'Complete your streak, reclaim your full stake, and earn a share of forfeited ETH.', color: 'from-amber-500/20 to-orange-500/10', border: 'border-amber-400/20', text: 'text-amber-400' },
  ];
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      <div className="text-center mb-16">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">How It Works</h2>
        <p className="text-slate-400 max-w-xl mx-auto">Four simple steps to turn your goals into a high-stakes accountability system.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {steps.map((s, i) => (
          <div key={i} className={`card-hover relative bg-gradient-to-br ${s.color} border ${s.border} rounded-2xl p-6 backdrop-blur-md`}>
            <div className={`w-12 h-12 rounded-xl bg-white/5 border ${s.border} flex items-center justify-center ${s.text} mb-5`}>{s.icon}</div>
            <span className="absolute top-4 right-5 text-5xl font-black text-white/5 select-none">{i + 1}</span>
            <h3 className="font-bold text-white text-lg mb-2">{s.title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Staking Form — with Etherscan TX link in toast
// ──────────────────────────────────────────────────────────────────────────────
function StakingForm({ wallet, contract, addToast, onRefresh }) {
  const [form, setForm] = useState({ desc: '', category: HABIT_CATEGORIES[0], days: '', eth: '' });
  const [status, setStatus] = useState('idle');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (wallet.status !== 'connected' || !contract) {
      addToast('Please connect your wallet first.', 'info');
      return;
    }
    if (!form.desc || !form.days || !form.eth) {
      addToast('Please fill in all fields.', 'error');
      return;
    }

    try {
      setStatus('confirming');
      const value = ethers.parseEther(form.eth);
      const tx = await contract.createHabit(form.desc, form.category, parseInt(form.days), { value });
      addToast('Transaction sent! Waiting for confirmation...', 'info', tx.hash);

      await tx.wait();
      setStatus('success');
      addToast(`✅ Stake locked! ${form.eth} ETH committed.`, 'success', tx.hash);
      setForm({ desc: '', category: HABIT_CATEGORIES[0], days: '', eth: '' });
      setTimeout(() => setStatus('idle'), 3000);
      onRefresh();
      wallet.refreshBalance();
    } catch (err) {
      console.error(err);
      setStatus('idle');
      addToast('Transaction failed: ' + (err.reason || err.message), 'error');
    }
  };

  return (
    <div id="staking-form-section" className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
          <LockKeyhole size={18} className="text-white" />
        </div>
        <div>
          <h2 className="font-bold text-white text-xl">Lock a New Stake</h2>
          <p className="text-slate-500 text-xs">Commit your ETH to your habit</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Habit Description</label>
          <input type="text" value={form.desc} onChange={(e) => setForm(f => ({ ...f, desc: e.target.value }))}
            placeholder="e.g., 50 pushups daily" maxLength={280}
            className="w-full bg-slate-900/60 border border-white/10 focus:border-emerald-400/50 rounded-xl px-4 py-3.5 text-white outline-none text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Category</label>
            <select value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full bg-slate-900/60 border border-white/10 focus:border-emerald-400/50 rounded-xl px-4 py-3.5 text-white outline-none text-sm appearance-none">
              {HABIT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Duration (Days)</label>
            <input type="number" min="1" max="365" value={form.days} onChange={(e) => setForm(f => ({ ...f, days: e.target.value }))} placeholder="30"
              className="w-full bg-slate-900/60 border border-white/10 focus:border-emerald-400/50 rounded-xl px-4 py-3.5 text-white outline-none text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Stake Amount (ETH)</label>
          <input type="number" min="0.001" step="0.001" value={form.eth} onChange={(e) => setForm(f => ({ ...f, eth: e.target.value }))} placeholder="0.1"
            className="w-full bg-slate-900/60 border border-white/10 focus:border-emerald-400/50 rounded-xl px-4 py-3.5 text-white outline-none text-sm" />
        </div>

        <button type="submit" disabled={status !== 'idle'}
          className={`w-full flex items-center justify-center gap-3 font-bold py-4 rounded-xl transition-all cursor-pointer ${status !== 'idle' ? 'bg-slate-700 text-slate-400' : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-900 hover:shadow-emerald-500/30 hover:scale-[1.02]'}`}>
          {status === 'confirming' ? <><Loader2 size={18} className="spin" /> Confirming...</> :
           status === 'success' ? <><CheckCircle2 size={18} /> Success!</> : <><LockKeyhole size={18} /> Lock Stake (Min: 0.001 ETH)</>}
        </button>
      </form>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// StakeCard — FIXED withdraw button condition
// ──────────────────────────────────────────────────────────────────────────────
function StakeCard({ data, onSubmitProof, onWithdraw }) {
  const { habitId, info, currentDay, todayStatus, canSubmitToday } = data;
  const daysTotal = Number(info.durationDays);
  const daysDone = Number(info.completedDays);
  const ethStaked = ethers.formatEther(info.stakeAmount);

  const progress = Math.round((daysDone / daysTotal) * 100);

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="font-semibold text-white text-sm">{info.description}</p>
          <p className="text-xs text-slate-400 mt-1">{info.category} • Day {currentDay} / {daysTotal}</p>
        </div>
        {!info.active ? (
          <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-1 rounded-full border border-slate-600">Ended</span>
        ) : todayStatus === 2 ? (
          <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full border border-emerald-400/20">✅ Today Done</span>
        ) : todayStatus === 1 ? (
          <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-1 rounded-full border border-amber-400/20">⏳ Pending Review</span>
        ) : todayStatus === 3 ? (
          <span className="text-xs bg-red-500/10 text-red-400 px-2 py-1 rounded-full border border-red-400/20">❌ Rejected Today</span>
        ) : (
          <span className="text-xs bg-slate-500/10 text-slate-400 px-2 py-1 rounded-full border border-slate-400/20">Proof Needed</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-900/60 rounded-xl px-2 py-2 text-center">
          <p className="text-sm font-bold text-white">{ethStaked} ETH</p>
          <p className="text-[10px] text-slate-500 uppercase">Staked</p>
        </div>
        <div className="bg-slate-900/60 rounded-xl px-2 py-2 text-center">
          <p className="text-sm font-bold text-emerald-400">{daysDone}</p>
          <p className="text-[10px] text-slate-500 uppercase">Success</p>
        </div>
        <div className="bg-slate-900/60 rounded-xl px-2 py-2 text-center">
          <p className="text-sm font-bold text-red-400">{Number(info.missedDays)}</p>
          <p className="text-[10px] text-slate-500 uppercase">Missed</p>
        </div>
      </div>

      <div className="w-full h-1.5 bg-slate-800 rounded-full mb-4">
        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full" style={{ width: `${progress}%` }} />
      </div>

      {info.active && canSubmitToday && todayStatus === 0 && (
        <button onClick={() => onSubmitProof(data)} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2 rounded-xl text-sm transition-colors border border-white/10 flex justify-center items-center gap-2 cursor-pointer">
          <Upload size={14} /> Submit Today's Proof
        </button>
      )}

      {/* FIX: was !info.active — should be info.active since withdrawal sets active=false */}
      {info.active && !info.withdrawn && currentDay > daysTotal && (
        <button onClick={() => onWithdraw(habitId)} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-2 rounded-xl text-sm transition-colors cursor-pointer">
          Withdraw Stake + Rewards
        </button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Dashboard — with loading skeleton
// ──────────────────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 animate-pulse">
      <div className="flex justify-between mb-4">
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-slate-700 rounded w-3/4" />
          <div className="h-3 bg-slate-800 rounded w-1/2" />
        </div>
        <div className="h-6 w-20 bg-slate-700 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[1, 2, 3].map(j => (
          <div key={j} className="bg-slate-900/60 rounded-xl h-14" />
        ))}
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full" />
    </div>
  );
}

function Dashboard({ stakes, openProofModal, onWithdraw, loading }) {
  const totalEth = stakes.reduce((a, s) => a + parseFloat(ethers.formatEther(s.info.stakeAmount)), 0);

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <BarChart3 size={18} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white text-xl">My Habits</h2>
            <p className="text-slate-500 text-xs">Your on-chain commitments</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2 text-sm">
            <span className="text-emerald-400 font-semibold">{totalEth.toFixed(3)} ETH</span>
            <span className="text-slate-600 text-xs">locked</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : stakes.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-xl text-slate-500">
          <Layers size={32} className="mx-auto mb-3 opacity-30" />
          <p>No active habits yet. Lock your stake to begin!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {stakes.map(stake => (
            <StakeCard key={stake.habitId} data={stake} onSubmitProof={openProofModal} onWithdraw={onWithdraw} />
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// App Root
// ──────────────────────────────────────────────────────────────────────────────
export default function App() {
  const walletCtx = useWallet();
  const { toasts, add: addToast, remove } = useToast();

  const [view, setView] = useState('home'); // home | verifier | admin
  const [contract, setContract] = useState(null);
  const [isVerifier, setIsVerifier] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [stakes, setStakes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeProofModal, setActiveProofModal] = useState(null);

  // Show wallet errors as toasts
  useEffect(() => {
    if (walletCtx.error) {
      addToast(walletCtx.error, 'error');
    }
  }, [walletCtx.error]);

  // Initialize read-only contract on load, upgrade to signer when connected
  useEffect(() => {
    try {
      const c = walletCtx.getContract(walletCtx.status !== 'connected');
      setContract(c);
    } catch(e) { console.warn("Contract init wait:", e.message) }
  }, [walletCtx.status, walletCtx.address]);

  // Load data for connected wallet
  const loadUserData = async () => {
    if (!contract || walletCtx.status !== 'connected') return;
    setLoading(true);
    try {
      // Check verifier role
      const isV = await contract.isVerifier(walletCtx.address);
      setIsVerifier(isV);

      // Check owner role
      const ownerAddr = await contract.owner();
      setIsOwner(ownerAddr.toLowerCase() === walletCtx.address.toLowerCase());

      // Load user habits
      const ids = await contract.getUserHabits(walletCtx.address);
      const items = [];
      for(let id of ids) {
        const info = await contract.getHabitInfo(id);
        const currentDay = await contract.getCurrentDay(id);
        const cDayNum = Number(currentDay);

        let todayStatus = 0; // NotSubmitted
        let canSubmitToday = cDayNum > 0 && cDayNum <= Number(info.durationDays) && info.active;

        if (canSubmitToday && cDayNum > 0) {
          const proof = await contract.getDailyProof(id, cDayNum);
          todayStatus = Number(proof.status);
        }

        items.push({
          habitId: Number(id),
          info,
          currentDay: cDayNum,
          todayStatus,
          canSubmitToday
        });
      }
      // Sort newest first
      setStakes(items.sort((a,b) => b.habitId - a.habitId));
    } catch(err) {
      console.error("Data load err:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUserData(); }, [contract, walletCtx.address]);

  const handleProofSubmit = async ({ habitId, day, cid, proofType, description }) => {
    if(!contract) return;
    const tx = await contract.submitDailyProof(habitId, day, cid, proofType, description);
    addToast("Transaction sent! Confirming on Sepolia...", "info", tx.hash);
    await tx.wait();
    addToast("Proof successfully recorded on-chain! 🎉", "success", tx.hash);
    setActiveProofModal(null);
    loadUserData();
  };

  const handleWithdraw = async (habitId) => {
    if(!contract) return;
    try {
      const tx = await contract.withdrawStake(habitId);
      addToast("Withdraw transaction sent...", "info", tx.hash);
      await tx.wait();
      addToast("Stake & rewards withdrawn! 💰", "success", tx.hash);
      loadUserData();
      walletCtx.refreshBalance();
    } catch(err) {
      addToast("Withdraw failed: " + (err.reason || err.message), "error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      <ToastContainer toasts={toasts} remove={remove} />
      <Navbar
        wallet={walletCtx}
        onConnect={walletCtx.connect}
        isVerifier={isVerifier}
        isOwner={isOwner}
        setView={setView}
        currentView={view}
      />

      {view === 'home' ? (
        <main>
          <Hero onCTA={() => document.getElementById('staking-form-section')?.scrollIntoView({ behavior: 'smooth' })} />
          <HowItWorks />

          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-2">
                <StakingForm wallet={walletCtx} contract={contract} addToast={addToast} onRefresh={loadUserData} />
              </div>
              <div className="lg:col-span-3">
                <Dashboard stakes={stakes} openProofModal={setActiveProofModal} onWithdraw={handleWithdraw} loading={loading} />
              </div>
            </div>
          </section>
        </main>
      ) : view === 'verifier' ? (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
          <VerifyProofsPanel contract={contract} isVerifier={isVerifier} addToast={addToast} onRefresh={loadUserData} />
        </main>
      ) : view === 'admin' ? (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
          <AdminPanel contract={contract} wallet={walletCtx} addToast={addToast} onRefresh={loadUserData} />
        </main>
      ) : null}

      <footer className="border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <LockKeyhole size={14} /> HABIT TRACKER
          </div>
          <div>© 2026 Sepolia Testnet Demo</div>
        </div>
      </footer>

      {activeProofModal && (
        <ProofSubmitModal
          habit={activeProofModal.info}
          habitId={activeProofModal.habitId}
          day={activeProofModal.currentDay}
          onClose={() => setActiveProofModal(null)}
          onSubmit={handleProofSubmit}
        />
      )}
    </div>
  );
}
