// Contract address — fill this in after deployment
// Run: npx hardhat run scripts/deploy.js --network sepolia
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";

// Etherscan base URL for transaction links
export const ETHERSCAN_BASE_URL = "https://sepolia.etherscan.io";

// Deployed on Sepolia testnet
export const CHAIN_ID = 11155111;
export const CHAIN_PARAMS = {
  chainId: "0xaa36a7",
  chainName: "Ethereum Sepolia",
  nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
  rpcUrls: [import.meta.env.VITE_ALCHEMY_SEPOLIA_URL || "https://rpc.sepolia.org"],
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
};

export const IPFS_GATEWAY =
  import.meta.env.VITE_PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs";

// Human-readable ABI using ethers fragment notation
export const HABIT_STAKING_ABI = [
  // ── Write functions ────────────────────────────────────────────────────────
  "function createHabit(string description, string category, uint256 durationDays) payable",
  "function submitDailyProof(uint256 habitId, uint256 day, string ipfsCID, string proofType, string description)",
  "function approveProof(uint256 habitId, uint256 day)",
  "function rejectProof(uint256 habitId, uint256 day, string reason)",
  "function markDayMissed(uint256 habitId, uint256 day)",
  "function withdrawStake(uint256 habitId)",
  "function addVerifier(address v)",
  "function removeVerifier(address v)",
  "function claimVerifierFees()",
  "function pause()",
  "function unpause()",

  // ── View functions ─────────────────────────────────────────────────────────
  `function getHabitInfo(uint256 habitId) view returns (
    tuple(
      address staker,
      string description,
      string category,
      uint256 durationDays,
      uint256 stakeAmount,
      uint256 startTimestamp,
      uint256 completedDays,
      uint256 missedDays,
      bool active,
      bool withdrawn
    )
  )`,
  `function getDailyProof(uint256 habitId, uint256 day) view returns (
    tuple(
      string ipfsCID,
      string proofType,
      string description,
      uint256 submittedAt,
      uint8 status,
      string verifierNote
    )
  )`,
  "function getUserHabits(address user) view returns (uint256[])",
  "function getTotalHabits() view returns (uint256)",
  "function getCurrentDay(uint256 habitId) view returns (uint256)",
  "function isVerifier(address) view returns (bool)",
  "function forfeitPool() view returns (uint256)",
  "function owner() view returns (address)",
  "function paused() view returns (bool)",

  // ── Events ─────────────────────────────────────────────────────────────────
  "event HabitCreated(uint256 indexed habitId, address indexed staker, string category, uint256 durationDays, uint256 stakeAmount)",
  "event ProofSubmitted(uint256 indexed habitId, uint256 indexed day, string ipfsCID, string proofType)",
  "event ProofApproved(uint256 indexed habitId, uint256 indexed day, address indexed verifier)",
  "event ProofRejected(uint256 indexed habitId, uint256 indexed day, address indexed verifier, string reason)",
  "event DayMissed(uint256 indexed habitId, uint256 indexed day, uint256 forfeitedWei)",
  "event StakeWithdrawn(uint256 indexed habitId, address indexed staker, uint256 refund, uint256 bonus)",
];

// Proof status enum mirroring the contract
export const ProofStatus = {
  0: "NotSubmitted",
  1: "Pending",
  2: "Approved",
  3: "Rejected",
  NotSubmitted: 0,
  Pending: 1,
  Approved: 2,
  Rejected: 3,
};

export const HABIT_CATEGORIES = [
  "Fitness",
  "Learning",
  "Health",
  "Coding",
  "Finance",
  "Custom",
];

export const PROOF_TYPES = [
  { value: "photo",      label: "📷 Photo" },
  { value: "video",      label: "🎥 Video" },
  { value: "screenshot", label: "🖥️ Screenshot" },
  { value: "receipt",    label: "🧾 Receipt" },
  { value: "other",      label: "📎 Other" },
];
