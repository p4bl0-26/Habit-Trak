import { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  Shield, UserPlus, UserMinus, Coins, PauseCircle, PlayCircle,
  Loader2, Settings, RefreshCw,
} from "lucide-react";
import { ETHERSCAN_BASE_URL } from "../constants/contract";

export default function AdminPanel({ contract, wallet, addToast, onRefresh }) {
  const [verifierAddr, setVerifierAddr] = useState("");
  const [loading, setLoading] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [forfeitPool, setForfeitPool] = useState("0");
  const [contractBalance, setContractBalance] = useState("0");
  const [totalHabits, setTotalHabits] = useState(0);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, [contract]);

  const loadStats = async () => {
    if (!contract) return;
    setStatsLoading(true);
    try {
      const [pool, paused, habits] = await Promise.all([
        contract.forfeitPool(),
        contract.paused(),
        contract.getTotalHabits(),
      ]);
      setForfeitPool(ethers.formatEther(pool));
      setIsPaused(paused);
      setTotalHabits(Number(habits));

      // Get contract balance
      const provider = contract.runner?.provider;
      if (provider) {
        const addr = await contract.getAddress();
        const bal = await provider.getBalance(addr);
        setContractBalance(ethers.formatEther(bal));
      }
    } catch (e) {
      console.warn("Admin stats load error:", e);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleAction = async (actionName, fn) => {
    setLoading(actionName);
    try {
      const tx = await fn();
      addToast(`${actionName}: Transaction sent...`, "info", tx.hash);
      await tx.wait();
      addToast(`${actionName}: Success! ✅`, "success", tx.hash);
      loadStats();
      onRefresh?.();
      if (actionName === "Add Verifier" || actionName === "Remove Verifier") {
        setVerifierAddr("");
      }
    } catch (err) {
      addToast(`${actionName} failed: ${err.reason || err.message}`, "error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Settings size={18} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white text-xl">Admin Panel</h2>
            <p className="text-slate-500 text-xs">Contract owner controls</p>
          </div>
        </div>
        <button
          onClick={loadStats}
          disabled={statsLoading}
          className="flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 text-amber-300 font-semibold text-sm px-4 py-2 rounded-xl transition-all cursor-pointer disabled:opacity-50"
        >
          {statsLoading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
          Refresh Stats
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{parseFloat(contractBalance).toFixed(4)}</p>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Contract Balance (ETH)</p>
        </div>
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">{parseFloat(forfeitPool).toFixed(4)}</p>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Forfeit Pool (ETH)</p>
        </div>
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 text-center">
          <p className={`text-2xl font-bold ${isPaused ? "text-red-400" : "text-emerald-400"}`}>
            {isPaused ? "⏸ Paused" : "▶ Active"}
          </p>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Contract Status</p>
        </div>
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-violet-400">{totalHabits}</p>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Total Habits</p>
        </div>
      </div>

      {/* Verifier Management */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-4">
        <h3 className="font-semibold text-white flex items-center gap-2 text-lg">
          <Shield size={16} className="text-violet-400" /> Verifier Management
        </h3>
        <p className="text-slate-500 text-sm">Add or remove wallet addresses that can approve/reject daily proofs.</p>
        <input
          type="text"
          value={verifierAddr}
          onChange={(e) => setVerifierAddr(e.target.value)}
          placeholder="0x... verifier wallet address"
          className="w-full bg-slate-900/60 border border-white/10 focus:border-violet-400/50 rounded-xl px-4 py-3.5 text-white placeholder-slate-600 outline-none text-sm font-mono"
        />
        <div className="flex gap-3">
          <button
            disabled={!verifierAddr || loading !== null}
            onClick={() => handleAction("Add Verifier", () => contract.addVerifier(verifierAddr))}
            className="flex-1 flex items-center justify-center gap-2 bg-violet-500 hover:bg-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition-all cursor-pointer"
          >
            {loading === "Add Verifier" ? <Loader2 size={14} className="spin" /> : <UserPlus size={14} />}
            Add Verifier
          </button>
          <button
            disabled={!verifierAddr || loading !== null}
            onClick={() => handleAction("Remove Verifier", () => contract.removeVerifier(verifierAddr))}
            className="flex-1 flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 disabled:opacity-40 disabled:cursor-not-allowed text-red-300 font-bold py-3 rounded-xl text-sm transition-all cursor-pointer"
          >
            {loading === "Remove Verifier" ? <Loader2 size={14} className="spin" /> : <UserMinus size={14} />}
            Remove Verifier
          </button>
        </div>
      </div>

      {/* Contract Controls */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-4">
        <h3 className="font-semibold text-white flex items-center gap-2 text-lg">
          <Coins size={16} className="text-amber-400" /> Contract Controls
        </h3>
        <p className="text-slate-500 text-sm">
          Claim verifier fees (5% of the forfeit pool), or pause/unpause new habit creation & proof submissions.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            disabled={loading !== null}
            onClick={() => handleAction("Claim Fees", () => contract.claimVerifierFees())}
            className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 font-bold py-3.5 rounded-xl text-sm transition-all cursor-pointer"
          >
            {loading === "Claim Fees" ? <Loader2 size={14} className="spin" /> : <Coins size={14} />}
            Claim Verifier Fees
          </button>
          <button
            disabled={loading !== null || isPaused}
            onClick={() => handleAction("Pause", () => contract.pause())}
            className="flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 disabled:opacity-40 disabled:cursor-not-allowed text-red-300 font-bold py-3.5 rounded-xl text-sm transition-all cursor-pointer"
          >
            {loading === "Pause" ? <Loader2 size={14} className="spin" /> : <PauseCircle size={14} />}
            Pause Contract
          </button>
          <button
            disabled={loading !== null || !isPaused}
            onClick={() => handleAction("Unpause", () => contract.unpause())}
            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 font-bold py-3.5 rounded-xl text-sm transition-all cursor-pointer"
          >
            {loading === "Unpause" ? <Loader2 size={14} className="spin" /> : <PlayCircle size={14} />}
            Unpause Contract
          </button>
        </div>
      </div>
    </div>
  );
}
