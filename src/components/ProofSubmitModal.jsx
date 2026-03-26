import { useState, useCallback, useRef } from "react";
import { useIPFS } from "../hooks/useIPFS";
import { PROOF_TYPES } from "../constants/contract";
import {
  Upload, X, CheckCircle2, Loader2, ExternalLink, Image as ImageIcon,
} from "lucide-react";

const ACCEPTED_TYPES = ["image/*", "video/*", "application/pdf"];
const MAX_MB = 50;

export default function ProofSubmitModal({ habit, habitId, day, onClose, onSubmit }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [proofType, setProofType] = useState("photo");
  const [description, setDescription] = useState("");
  const [cid, setCid] = useState("");
  const [txStatus, setTxStatus] = useState("idle"); // idle | uploading | confirming | done | error
  const [txError, setTxError] = useState("");
  const [droppingOver, setDroppingOver] = useState(false);
  const fileRef = useRef(null);
  const { uploadFile, uploading, progress } = useIPFS();

  const selectFile = (f) => {
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) {
      alert(`File too large. Max ${MAX_MB} MB.`);
      return;
    }
    setFile(f);
    setCid("");
    const isImg = f.type.startsWith("image/");
    setPreview(isImg ? URL.createObjectURL(f) : null);
    // Auto-detect proof type
    if (f.type.startsWith("image/")) setProofType("photo");
    else if (f.type.startsWith("video/")) setProofType("video");
    else if (f.type === "application/pdf") setProofType("receipt");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDroppingOver(false);
    selectFile(e.dataTransfer.files[0]);
  };

  const handleUploadToIPFS = async () => {
    if (!file) return;
    setTxStatus("uploading");
    setTxError("");
    try {
      const result = await uploadFile(file, {
        habitId,
        day,
        proofType,
        uploader: habit?.staker || "",
      });
      setCid(result.cid);
      setTxStatus("idle");
    } catch (err) {
      setTxStatus("error");
      setTxError(err.message);
    }
  };

  const handleSubmitOnChain = async () => {
    if (!cid) return;
    setTxStatus("confirming");
    setTxError("");
    try {
      await onSubmit({ habitId, day, cid, proofType, description });
      setTxStatus("done");
    } catch (err) {
      setTxStatus("error");
      setTxError(err.reason || err.message || "Transaction failed");
    }
  };

  const ipfsUrl = cid
    ? `${import.meta.env.VITE_PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs"}/${cid}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h3 className="font-bold text-white text-lg">Submit Day {day} Proof</h3>
            <p className="text-slate-500 text-xs mt-0.5 truncate max-w-xs">{habit?.description}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

          {txStatus === "done" ? (
            <div className="flex flex-col items-center py-8 gap-4">
              <CheckCircle2 size={48} className="text-emerald-400" />
              <p className="text-white font-bold text-lg">Proof Submitted!</p>
              <p className="text-slate-400 text-sm text-center">
                Your IPFS proof has been recorded on-chain. A verifier will review it within 48 hours.
              </p>
              <a href={ipfsUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm transition-colors"
              >
                View on IPFS <ExternalLink size={14} />
              </a>
              <button onClick={onClose}
                className="mt-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-6 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDroppingOver(true); }}
                onDragLeave={() => setDroppingOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center py-8 gap-3 ${
                  droppingOver
                    ? "border-emerald-400 bg-emerald-400/10"
                    : "border-white/15 hover:border-white/30 bg-white/3"
                }`}
              >
                {preview ? (
                  <img src={preview} alt="preview" className="max-h-32 rounded-lg object-contain" />
                ) : (
                  <Upload size={28} className="text-slate-500" />
                )}
                <p className="text-sm text-slate-400">
                  {file ? file.name : "Drop file here or click to browse"}
                </p>
                <p className="text-xs text-slate-600">Photo · Video · PDF · Max {MAX_MB} MB</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  className="hidden"
                  onChange={(e) => selectFile(e.target.files[0])}
                />
              </div>

              {/* Proof type */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Proof Type</label>
                <div className="flex flex-wrap gap-2">
                  {PROOF_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setProofType(t.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                        proofType === t.value
                          ? "bg-emerald-500 text-slate-900"
                          : "bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Proof Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder='e.g. "Gym selfie — 1 hour chest workout at FitLife"'
                  maxLength={140}
                  className="w-full bg-slate-800/60 border border-white/10 focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none text-sm"
                />
              </div>

              {/* IPFS CID display */}
              {cid && (
                <div className="flex items-center gap-3 bg-emerald-400/5 border border-emerald-400/20 rounded-xl px-4 py-3">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-500">IPFS CID</p>
                    <p className="text-xs font-mono text-emerald-300 truncate">{cid}</p>
                  </div>
                  <a href={ipfsUrl} target="_blank" rel="noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 shrink-0"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              )}

              {/* Error */}
              {txStatus === "error" && (
                <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                  ⚠️ {txError}
                </p>
              )}

              {/* Upload progress */}
              {uploading && (
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Uploading to IPFS…</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                {!cid ? (
                  <button
                    disabled={!file || uploading}
                    onClick={handleUploadToIPFS}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-all cursor-pointer"
                  >
                    {uploading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                    {uploading ? `Uploading… ${progress}%` : "Upload to IPFS"}
                  </button>
                ) : (
                  <button
                    disabled={txStatus === "confirming"}
                    onClick={handleSubmitOnChain}
                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold py-3 rounded-xl text-sm transition-all cursor-pointer"
                  >
                    {txStatus === "confirming"
                      ? <><Loader2 size={16} className="spin" /> Confirming on Sepolia…</>
                      : <><CheckCircle2 size={16} /> Submit Proof On-Chain</>
                    }
                  </button>
                )}
              </div>

              <p className="text-xs text-slate-600 text-center">
                Step 1: Upload proof to IPFS → Step 2: Submit the CID on-chain
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
