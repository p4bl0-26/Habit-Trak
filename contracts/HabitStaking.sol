// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title  HabitStaking
 * @notice Stake ETH on any real-world habit (gym, reading, no-sugar, running…).
 *         Each day the staker must submit an IPFS-pinned proof (photo / video /
 *         receipt / screenshot). A verifier approves or rejects on-chain.
 *         Missed days → that day's share of the stake goes to the forfeit pool.
 *         Full completers get their stake back + a bonus from the forfeit pool.
 */
contract HabitStaking is ReentrancyGuard, Ownable, Pausable {

    // ─── Constants ────────────────────────────────────────────────────────────

    uint256 public constant MIN_STAKE          = 0.001 ether;
    uint256 public constant MAX_DAYS           = 365;
    /// @dev After 48 h without verifier action, an auto-approve runs on markDayMissed
    uint256 public constant VERIFICATION_WINDOW = 48 hours;
    /// @dev Basis-point share of the forfeit pool reserved for the verifier reward claimable by owner
    uint256 public constant VERIFIER_FEE_BPS   = 500; // 5 %

    // ─── Enums ────────────────────────────────────────────────────────────────

    enum ProofStatus { NotSubmitted, Pending, Approved, Rejected }

    // ─── Structs ──────────────────────────────────────────────────────────────

    struct DailyProof {
        string      ipfsCID;       // IPFS content-id of the proof file
        string      proofType;     // "photo" | "video" | "screenshot" | "receipt" | "other"
        string      description;   // free-text note, e.g. "Gym selfie – leg day"
        uint256     submittedAt;   // block.timestamp of submission
        ProofStatus status;
        string      verifierNote;  // rejection reason, if any
    }

    struct HabitInfo {
        address staker;
        string  description;    // e.g. "Go to gym for 1 hour"
        string  category;       // "Fitness" | "Learning" | "Health" | "Coding" | "Finance" | "Custom"
        uint256 durationDays;
        uint256 stakeAmount;    // total ETH locked (wei)
        uint256 startTimestamp;
        uint256 completedDays;
        uint256 missedDays;
        bool    active;
        bool    withdrawn;
    }

    // ─── State ────────────────────────────────────────────────────────────────

    uint256 private _habitCounter;

    mapping(uint256 => HabitInfo)                          private _habitInfo;
    mapping(uint256 => mapping(uint256 => DailyProof))     private _proofs;   // habitId → day → proof
    mapping(address => uint256[])                          private _userHabits;

    mapping(address => bool) public isVerifier;
    address[] public verifierList;

    /// @dev Gross forfeit pool (in wei). Grows when proofs are rejected / days missed.
    uint256 public forfeitPool;

    // ─── Events ───────────────────────────────────────────────────────────────

    event HabitCreated(
        uint256 indexed habitId,
        address indexed staker,
        string  category,
        uint256 durationDays,
        uint256 stakeAmount
    );
    event ProofSubmitted(uint256 indexed habitId, uint256 indexed day, string ipfsCID, string proofType);
    event ProofApproved(uint256 indexed habitId, uint256 indexed day, address indexed verifier);
    event ProofRejected(uint256 indexed habitId, uint256 indexed day, address indexed verifier, string reason);
    event DayMissed(uint256 indexed habitId, uint256 indexed day, uint256 forfeitedWei);
    event StakeWithdrawn(uint256 indexed habitId, address indexed staker, uint256 refund, uint256 bonus);
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyVerifier() {
        require(isVerifier[msg.sender], "HabitStaking: caller is not a verifier");
        _;
    }

    modifier habitExists(uint256 habitId) {
        require(habitId < _habitCounter, "HabitStaking: habit does not exist");
        _;
    }

    modifier onlyHabitStaker(uint256 habitId) {
        require(_habitInfo[habitId].staker == msg.sender, "HabitStaking: caller is not the staker");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ─── Core: Create Habit ───────────────────────────────────────────────────

    /**
     * @notice Lock ETH and commit to a daily habit.
     * @param description  What you will do every day (max 280 chars)
     * @param category     Broad category: "Fitness" / "Learning" / "Health" / "Coding" / "Finance" / "Custom"
     * @param durationDays How many consecutive days (1–365)
     */
    function createHabit(
        string calldata description,
        string calldata category,
        uint256 durationDays
    ) external payable whenNotPaused {
        require(bytes(description).length > 0 && bytes(description).length <= 280,
            "HabitStaking: description must be 1-280 chars");
        require(durationDays >= 1 && durationDays <= MAX_DAYS,
            "HabitStaking: duration must be 1-365 days");
        require(msg.value >= MIN_STAKE,
            "HabitStaking: minimum stake is 0.001 ETH");

        uint256 habitId = _habitCounter++;

        _habitInfo[habitId] = HabitInfo({
            staker        : msg.sender,
            description   : description,
            category      : category,
            durationDays  : durationDays,
            stakeAmount   : msg.value,
            startTimestamp: block.timestamp,
            completedDays : 0,
            missedDays    : 0,
            active        : true,
            withdrawn     : false
        });

        _userHabits[msg.sender].push(habitId);

        emit HabitCreated(habitId, msg.sender, category, durationDays, msg.value);
    }

    // ─── Core: Submit Proof ───────────────────────────────────────────────────

    /**
     * @notice Submit IPFS proof of habit completion for a given day.
     * @param habitId     Your habit identifier
     * @param day         Which day (1-indexed, must be today or yesterday)
     * @param ipfsCID     IPFS Content ID of the uploaded evidence file
     * @param proofType   "photo" | "video" | "screenshot" | "receipt" | "other"
     * @param description Brief human-readable explanation of the proof
     */
    function submitDailyProof(
        uint256 habitId,
        uint256 day,
        string calldata ipfsCID,
        string calldata proofType,
        string calldata description
    ) external habitExists(habitId) onlyHabitStaker(habitId) whenNotPaused {
        HabitInfo storage h = _habitInfo[habitId];
        require(h.active && !h.withdrawn, "HabitStaking: habit is not active");
        require(day >= 1 && day <= h.durationDays, "HabitStaking: day out of range");
        require(bytes(ipfsCID).length > 0, "HabitStaking: IPFS CID cannot be empty");

        // Which day are we on right now?
        uint256 currentDay = _currentDay(h.startTimestamp);

        // Allow submitting for today or the previous day (24 h grace)
        require(day <= currentDay, "HabitStaking: cannot submit proof for a future day");
        require(
            currentDay == 1 || day >= currentDay - 1,
            "HabitStaking: too late to submit proof for this day"
        );
        require(
            _proofs[habitId][day].status == ProofStatus.NotSubmitted,
            "HabitStaking: proof already submitted for this day"
        );

        _proofs[habitId][day] = DailyProof({
            ipfsCID     : ipfsCID,
            proofType   : proofType,
            description : description,
            submittedAt : block.timestamp,
            status      : ProofStatus.Pending,
            verifierNote: ""
        });

        emit ProofSubmitted(habitId, day, ipfsCID, proofType);
    }

    // ─── Core: Verifier Actions ───────────────────────────────────────────────

    /**
     * @notice Approve a pending proof — marks that day as completed.
     */
    function approveProof(uint256 habitId, uint256 day)
        external
        habitExists(habitId)
        onlyVerifier
    {
        DailyProof storage proof = _proofs[habitId][day];
        require(proof.status == ProofStatus.Pending, "HabitStaking: proof is not pending");

        proof.status = ProofStatus.Approved;
        _habitInfo[habitId].completedDays++;

        emit ProofApproved(habitId, day, msg.sender);
    }

    /**
     * @notice Reject a pending proof — marks that day as missed and routes
     *         the day's stake share to the forfeit pool.
     * @param reason  Human-readable rejection reason stored on-chain
     */
    function rejectProof(
        uint256 habitId,
        uint256 day,
        string calldata reason
    ) external habitExists(habitId) onlyVerifier {
        HabitInfo  storage h     = _habitInfo[habitId];
        DailyProof storage proof = _proofs[habitId][day];
        require(proof.status == ProofStatus.Pending, "HabitStaking: proof is not pending");

        proof.status      = ProofStatus.Rejected;
        proof.verifierNote = reason;
        h.missedDays++;

        uint256 dayValue = h.stakeAmount / h.durationDays;
        forfeitPool += dayValue;

        emit ProofRejected(habitId, day, msg.sender, reason);
        emit DayMissed(habitId, day, dayValue);
    }

    // ─── Core: Community Accountability ──────────────────────────────────────

    /**
     * @notice Mark a day as missed when no proof was submitted.
     *         Anyone can call this once the day has fully elapsed.
     *         If a proof was submitted but the verifier didn't act within
     *         VERIFICATION_WINDOW the proof is auto-approved (benefit of doubt).
     */
    function markDayMissed(uint256 habitId, uint256 day)
        external
        habitExists(habitId)
    {
        HabitInfo storage h = _habitInfo[habitId];
        require(h.active && !h.withdrawn, "HabitStaking: habit is not active");
        require(day >= 1 && day <= h.durationDays, "HabitStaking: day out of range");

        uint256 currentDay = _currentDay(h.startTimestamp);
        require(day < currentDay, "HabitStaking: day has not ended yet");

        DailyProof storage proof = _proofs[habitId][day];

        if (proof.status == ProofStatus.Pending) {
            // Proof submitted but verifier hasn't acted
            require(
                block.timestamp >= proof.submittedAt + VERIFICATION_WINDOW,
                "HabitStaking: verification window still open"
            );
            // Auto-approve — benefit of doubt
            proof.status = ProofStatus.Approved;
            h.completedDays++;
            return;
        }

        require(proof.status == ProofStatus.NotSubmitted, "HabitStaking: day already resolved");

        // No proof at all → missed
        proof.status = ProofStatus.Rejected;
        h.missedDays++;

        uint256 dayValue = h.stakeAmount / h.durationDays;
        forfeitPool += dayValue;

        emit DayMissed(habitId, day, dayValue);
    }

    // ─── Core: Withdraw ───────────────────────────────────────────────────────

    /**
     * @notice Claim your stake back after the habit duration ends.
     *         Forfeited days are deducted; perfect completers earn a bonus
     *         from the global forfeit pool.
     */
    function withdrawStake(uint256 habitId)
        external
        nonReentrant
        habitExists(habitId)
        onlyHabitStaker(habitId)
    {
        HabitInfo storage h = _habitInfo[habitId];
        require(h.active,    "HabitStaking: habit is not active");
        require(!h.withdrawn, "HabitStaking: already withdrawn");

        uint256 currentDay = _currentDay(h.startTimestamp);
        require(currentDay > h.durationDays, "HabitStaking: habit not finished yet");

        h.active    = false;
        h.withdrawn = true;

        // Count any days that were never submitted (also missed)
        uint256 unresolved = 0;
        for (uint256 d = 1; d <= h.durationDays; d++) {
            if (_proofs[habitId][d].status == ProofStatus.NotSubmitted) {
                unresolved++;
            }
        }
        uint256 totalMissed = h.missedDays + unresolved;
        if (totalMissed > h.durationDays) totalMissed = h.durationDays;

        uint256 dayValue = h.stakeAmount / h.durationDays;
        uint256 forfeited = totalMissed * dayValue;
        forfeitPool += forfeited;

        uint256 baseRefund = h.stakeAmount - forfeited;

        // Bonus: perfect completer earns up to 20 % of the forfeit pool
        uint256 bonus = 0;
        if (totalMissed == 0 && forfeitPool > forfeited) {
            uint256 poolAfter = forfeitPool - forfeited;
            bonus = (poolAfter * 2000) / 10000; // 20 %
            if (bonus > poolAfter / 2) bonus = poolAfter / 2; // cap 50 %
            forfeitPool -= bonus;
        }

        uint256 totalRefund = baseRefund + bonus;
        require(address(this).balance >= totalRefund, "HabitStaking: insufficient contract balance");

        emit StakeWithdrawn(habitId, msg.sender, baseRefund, bonus);

        (bool ok,) = payable(msg.sender).call{value: totalRefund}("");
        require(ok, "HabitStaking: ETH transfer failed");
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function addVerifier(address v) external onlyOwner {
        require(v != address(0), "HabitStaking: zero address");
        require(!isVerifier[v],  "HabitStaking: already a verifier");
        isVerifier[v] = true;
        verifierList.push(v);
        emit VerifierAdded(v);
    }

    function removeVerifier(address v) external onlyOwner {
        require(isVerifier[v], "HabitStaking: not a verifier");
        isVerifier[v] = false;
        // Remove from list (swap-and-pop)
        for (uint256 i = 0; i < verifierList.length; i++) {
            if (verifierList[i] == v) {
                verifierList[i] = verifierList[verifierList.length - 1];
                verifierList.pop();
                break;
            }
        }
        emit VerifierRemoved(v);
    }

    /// @notice Owner can drain the verifier fee portion
    function claimVerifierFees() external onlyOwner nonReentrant {
        uint256 fee = (forfeitPool * VERIFIER_FEE_BPS) / 10000;
        require(fee > 0, "HabitStaking: nothing to claim");
        require(address(this).balance >= fee, "HabitStaking: insufficient balance");
        forfeitPool -= fee;
        (bool ok,) = payable(owner()).call{value: fee}("");
        require(ok, "HabitStaking: transfer failed");
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── View Functions ───────────────────────────────────────────────────────

    function getHabitInfo(uint256 habitId)
        external view habitExists(habitId)
        returns (HabitInfo memory)
    {
        return _habitInfo[habitId];
    }

    function getDailyProof(uint256 habitId, uint256 day)
        external view habitExists(habitId)
        returns (DailyProof memory)
    {
        return _proofs[habitId][day];
    }

    function getUserHabits(address user) external view returns (uint256[] memory) {
        return _userHabits[user];
    }

    function getTotalHabits() external view returns (uint256) {
        return _habitCounter;
    }

    function getCurrentDay(uint256 habitId) external view habitExists(habitId) returns (uint256) {
        HabitInfo storage h = _habitInfo[habitId];
        if (!h.active) return 0;
        return _currentDay(h.startTimestamp);
    }

    function getPendingProofsForVerifier(uint256[] calldata habitIds, uint256[] calldata dayIndices)
        external view
        returns (bool[] memory isPending)
    {
        isPending = new bool[](habitIds.length);
        for (uint256 i = 0; i < habitIds.length; i++) {
            isPending[i] = (_proofs[habitIds[i]][dayIndices[i]].status == ProofStatus.Pending);
        }
    }

    // ─── Internal Helpers ─────────────────────────────────────────────────────

    function _currentDay(uint256 startTimestamp) internal view returns (uint256) {
        if (block.timestamp < startTimestamp) return 1;
        return ((block.timestamp - startTimestamp) / 1 days) + 1;
    }

    receive() external payable {}
}
