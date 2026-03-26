import { useState } from "react";

import { ethers } from "ethers";
import {
  Shield, CheckCircle2, X, ExternalLink, Loader2, Clock, AlertTriangle,
} from "lucide-react";
import { IPFS_GATEWAY, ETHERSCAN_BASE_URL } from "../constants/contract";

const STATUS_COLORS = {
  1: "text-amber-400 bg-amber-400/10 border-amber-400/20",   // Pending
  2: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", // Approved
  3: "text-red-400 bg-red-400/10 border-red-400/20",          // Rejected
};

const STATUS_LABELS = { 1: "Pending Review", 2: "Approved ✅", 3: "Rejected ❌" };

// ──────────────────────────────────────────────────────────────────────────────
// ProofCard — individual pending proof with approve/reject actions
// ──────────────────────────────────────────────────────────────────────────────
function ProofCard({ habit, habitId, day, proof, isVerifier, onApprove, onReject }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(null);

  const handleApprove = async () => {
    setLoading("approve");
    try {
      await onApprove(habitId, day);
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    if (!reason.trim()) return;
    setLoading("reject");
    try {
      await onReject(habitId, day, reason);
      setRejecting(false);
    } finally {
      setLoading(null);
    }
  };

  const ipfsUrl = proof.ipfsCID ? `${IPFS_GATEWAY}/${proof.ipfsCID}` : null;
  const submittedDate = proof.submittedAt
    ? new Date(Number(proof.submittedAt) * 1000).toLocaleString()
    : "—";
  const staker = habit?.staker
    ? `${habit.staker.slice(0, 6)}...${habit.staker.slice(-4)}`
    : "Unknown";

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 hover:border-white/20 transition-all">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white text-sm">{habit?.description || `Habit #${habitId}`}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Habit #{habitId} · Day {day} · {habit?.category} · Staker: {staker}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${STATUS_COLORS[proof.status] || "text-slate-400 bg-white/5 border-white/10"}`}>
          {STATUS_LABELS[proof.status] || "Unknown"}
        </span>
      </div>

      {/* Description */}
      {proof.description && (
        <p className="text-sm text-slate-300 italic">"{proof.description}"</p>
      )}

      {/* IPFS Image Preview */}
      {ipfsUrl && proof.proofType === "photo" && (
        <a href={ipfsUrl} target="_blank" rel="noreferrer" className="block">
          <img
            src={ipfsUrl}
            alt="Proof"
            className="rounded-xl max-h-48 w-full object-cover border border-white/10 hover:opacity-90 transition-opacity"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        </a>
      )}

      {/* IPFS Link */}
      {ipfsUrl && (
        <a
          href={ipfsUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          <ExternalLink size={12} />
          View Proof on IPFS
          <span className="font-mono text-slate-600 truncate max-w-xs">{proof.ipfsCID?.slice(0, 20)}…</span>
        </a>
      )}

      {/* Timestamp */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Clock size={12} />
        Submitted: {submittedDate}
      </div>

      {/* Verifier rejection note */}
      {proof.verifierNote && (
        <div className="bg-red-400/5 border border-red-400/20 rounded-xl px-4 py-3 text-xs text-red-300">
          Rejection reason: {proof.verifierNote}
        </div>
      )}

      {/* Verifier Actions */}
      {isVerifier && proof.status === 1 && !rejecting && (
        <div className="flex gap-3 pt-1">
          <button
            disabled={loading !== null}
            onClick={handleApprove}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-900 font-bold py-2.5 rounded-xl text-sm transition-all cursor-pointer"
          >
            {loading === "approve" ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
            Approve
          </button>
          <button
            disabled={loading !== null}
            onClick={() => setRejecting(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-300 font-bold py-2.5 rounded-xl text-sm transition-all cursor-pointer"
          >
            <X size={14} />
            Reject
          </button>
        </div>
      )}

      {/* Reject reason input */}
      {isVerifier && rejecting && (
        <div className="space-y-3">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection (required)"
            className="w-full bg-slate-900 border border-red-400/30 focus:border-red-400/60 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 outline-none text-sm"
          />
          <div className="flex gap-2">
            <button
              disabled={!reason.trim() || loading !== null}
              onClick={handleReject}
              className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-bold py-2 rounded-xl text-sm transition-all cursor-pointer"
            >
              {loading === "reject" ? <Loader2 size={14} className="spin" /> : null}
              Confirm Rejection
            </button>
            <button
              onClick={() => { setRejecting(false); setReason(""); }}
              className="px-4 py-2 text-slate-400 hover:text-white border border-white/10 rounded-xl text-sm transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MissedDayCard — show unsubmitted past days that anyone can mark as missed
// ──────────────────────────────────────────────────────────────────────────────
function MissedDayCard({ habitId, day, info, onMarkMissed }) {
  const [loading, setLoading] = useState(false);
  const staker = info?.staker
    ? `${info.staker.slice(0, 6)}...${info.staker.slice(-4)}`
    : "Unknown";

  const handleMark = async () => {
    setLoading(true);
    try {
      await onMarkMissed(habitId, day);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/5 border border-red-400/15 rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white truncate">{info?.description || `Habit #${habitId}`}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Habit #{habitId} · Day {day} · {info?.category} · Staker: {staker}
        </p>
      </div>
      <button
        disabled={loading}
        onClick={handleMark}
        className="shrink-0 flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 disabled:opacity-50 text-red-300 font-semibold text-xs px-3 py-2 rounded-xl transition-all cursor-pointer"
      >
        {loading ? <Loader2 size={12} className="spin" /> : <AlertTriangle size={12} />}
        Mark Missed
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// VerifyProofsPanel — scans ALL habits on the contract, not just user's
// ──────────────────────────────────────────────────────────────────────────────
export default function VerifyProofsPanel({ contract, isVerifier, addToast, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [pendingProofs, setPendingProofs] = useState([]);
  const [missedDays, setMissedDays] = useState([]);
  const [fetched, setFetched] = useState(false);
  const [scanProgress, setScanProgress] = useState("");

  const fetchPending = async () => {
    if (!contract) return;
    setLoading(true);
    setScanProgress("Fetching total habits...");
    try {
      const total = Number(await contract.getTotalHabits());
      const pendingItems = [];
      const missableItems = [];

      for (let habitId = 0; habitId < total; habitId++) {
        setScanProgress(`Scanning habit ${habitId + 1} of ${total}...`);

        let info;
        try {
          info = await contract.getHabitInfo(habitId);
        } catch { continue; }

        // Skip fully withdrawn habits
        if (!info.active && info.withdrawn) continue;

        const durationDays = Number(info.durationDays);
        let currentDay;
        try {
          currentDay = Number(await contract.getCurrentDay(habitId));
        } catch {
          continue; // inactive habit
        }

        if (currentDay === 0) continue;

        // Scan days 1 through min(durationDays, currentDay)
        const maxDay = Math.min(durationDays, currentDay);

        for (let d = 1; d <= maxDay; d++) {
          const proof = await contract.getDailyProof(habitId, d);
          const status = Number(proof.status);

          if (status === 1) { // Pending
            pendingItems.push({ habitId, day: d, proof, info });
          } else if (status === 0 && d < currentDay) { // NotSubmitted & day has passed
            missableItems.push({ habitId, day: d, info });
          }
        }
      }

      setPendingProofs(pendingItems);
      setMissedDays(missableItems);
      setFetched(true);
      setScanProgress("");
    } catch (err) {
      addToast("Failed to scan proofs: " + err.message, "error");
      setScanProgress("");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (habitId, day) => {
    try {
      const tx = await contract.approveProof(habitId, day);
      addToast("Transaction sent! Waiting for confirmation…", "info", tx.hash);
      await tx.wait();
      addToast(`Habit #${habitId} Day ${day} proof approved! ✅`, "success", tx.hash);
      await fetchPending();
      onRefresh?.();
    } catch (err) {
      addToast("Approval failed: " + (err.reason || err.message), "error");
      throw err;
    }
  };

  const handleReject = async (habitId, day, reason) => {
    try {
      const tx = await contract.rejectProof(habitId, day, reason);
      addToast("Transaction sent! Waiting for confirmation…", "info", tx.hash);
      await tx.wait();
      addToast(`Habit #${habitId} Day ${day} proof rejected.`, "success", tx.hash);
      await fetchPending();
      onRefresh?.();
    } catch (err) {
      addToast("Rejection failed: " + (err.reason || err.message), "error");
      throw err;
    }
  };

  const handleMarkMissed = async (habitId, day) => {
    try {
      const tx = await contract.markDayMissed(habitId, day);
      addToast("Marking day as missed…", "info", tx.hash);
      await tx.wait();
      addToast(`Habit #${habitId} Day ${day} marked as missed.`, "success", tx.hash);
      await fetchPending();
      onRefresh?.();
    } catch (err) {
      addToast("Mark missed failed: " + (err.reason || err.message), "error");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white text-xl">Verifier Dashboard</h2>
            <p className="text-slate-500 text-xs">Review all submitted proofs across every habit</p>
          </div>
        </div>
        <button
          onClick={fetchPending}
          disabled={loading}
          className="flex items-center gap-2 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/30 text-violet-300 font-semibold text-sm px-4 py-2 rounded-xl transition-all cursor-pointer disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="spin" /> : <Shield size={14} />}
          {fetched ? "Refresh" : "Scan All Habits"}
        </button>
      </div>

      {/* Scan progress */}
      {loading && scanProgress && (
        <div className="flex items-center gap-3 bg-violet-500/10 border border-violet-400/20 rounded-xl px-4 py-3 text-sm text-violet-300">
          <Loader2 size={14} className="spin shrink-0" />
          {scanProgress}
        </div>
      )}

      {/* Initial state */}
      {!fetched && !loading && (
        <div className="text-center py-16 text-slate-500">
          <Shield size={32} className="mx-auto mb-4 opacity-30" />
          <p>Click "Scan All Habits" to find proofs across all users.</p>
        </div>
      )}

      {/* Pending Proofs Section */}
      {fetched && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            Pending Proofs
            <span className="text-sm text-slate-500 font-normal">({pendingProofs.length})</span>
          </h3>

          {pendingProofs.length === 0 ? (
            <div className="text-center py-10 text-slate-500 border-2 border-dashed border-white/10 rounded-xl">
              <CheckCircle2 size={28} className="mx-auto mb-3 text-emerald-400/50" />
              <p className="text-emerald-400">All caught up! No pending proofs.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {pendingProofs.map(({ habitId, day, proof, info }) => (
                <ProofCard
                  key={`${habitId}-${day}`}
                  habit={info}
                  habitId={habitId}
                  day={day}
                  proof={proof}
                  isVerifier={isVerifier}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Missed Days Section */}
      {fetched && missedDays.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
            Unresolved Days (No Proof Submitted)
            <span className="text-sm text-slate-500 font-normal">({missedDays.length})</span>
          </h3>
          <p className="text-slate-500 text-sm">
            These days have passed without a proof submission. Anyone can mark them as missed — the staker loses that day's share to the forfeit pool.
          </p>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {missedDays.map(({ habitId, day, info }) => (
              <MissedDayCard
                key={`miss-${habitId}-${day}`}
                habitId={habitId}
                day={day}
                info={info}
                onMarkMissed={handleMarkMissed}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
