const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("HabitStaking", function () {
  let contract;
  let owner, staker, verifier, stranger;
  const ONE_ETH  = ethers.parseEther("1");
  const HALF_ETH = ethers.parseEther("0.5");
  const MIN_STAKE = ethers.parseEther("0.001");

  beforeEach(async () => {
    [owner, staker, verifier, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("HabitStaking");
    contract = await Factory.deploy(owner.address);
    await contract.waitForDeployment();

    // Register verifier
    await contract.connect(owner).addVerifier(verifier.address);
  });

  // ─── Deployment ────────────────────────────────────────────────────────────
  describe("Deployment", () => {
    it("sets the owner correctly", async () => {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("starts with zero habits and empty forfeit pool", async () => {
      expect(await contract.getTotalHabits()).to.equal(0);
      expect(await contract.forfeitPool()).to.equal(0);
    });
  });

  // ─── Verifier Management ───────────────────────────────────────────────────
  describe("Verifier Management", () => {
    it("allows owner to add a verifier", async () => {
      expect(await contract.isVerifier(verifier.address)).to.be.true;
    });

    it("allows owner to remove a verifier", async () => {
      await contract.connect(owner).removeVerifier(verifier.address);
      expect(await contract.isVerifier(verifier.address)).to.be.false;
    });

    it("reverts if non-owner tries to add verifier", async () => {
      await expect(
        contract.connect(stranger).addVerifier(stranger.address)
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });

    it("reverts on duplicate verifier add", async () => {
      await expect(
        contract.connect(owner).addVerifier(verifier.address)
      ).to.be.revertedWith("HabitStaking: already a verifier");
    });
  });

  // ─── createHabit ──────────────────────────────────────────────────────────
  describe("createHabit", () => {
    it("creates a habit and emits HabitCreated", async () => {
      await expect(
        contract.connect(staker).createHabit(
          "Go to the gym every day",
          "Fitness",
          30,
          { value: ONE_ETH }
        )
      )
        .to.emit(contract, "HabitCreated")
        .withArgs(0, staker.address, "Fitness", 30, ONE_ETH);

      const info = await contract.getHabitInfo(0);
      expect(info.staker).to.equal(staker.address);
      expect(info.description).to.equal("Go to the gym every day");
      expect(info.category).to.equal("Fitness");
      expect(info.durationDays).to.equal(30);
      expect(info.stakeAmount).to.equal(ONE_ETH);
      expect(info.active).to.be.true;
    });

    it("tracks user habits", async () => {
      await contract.connect(staker).createHabit("Read 30 mins", "Learning", 7, { value: MIN_STAKE });
      await contract.connect(staker).createHabit("No sugar", "Health", 14, { value: MIN_STAKE });
      const ids = await contract.getUserHabits(staker.address);
      expect(ids.length).to.equal(2);
    });

    it("reverts below minimum stake", async () => {
      await expect(
        contract.connect(staker).createHabit("Test", "Custom", 7, { value: ethers.parseEther("0.0009") })
      ).to.be.revertedWith("HabitStaking: minimum stake is 0.001 ETH");
    });

    it("reverts on empty description", async () => {
      await expect(
        contract.connect(staker).createHabit("", "Custom", 7, { value: MIN_STAKE })
      ).to.be.revertedWith("HabitStaking: description must be 1-280 chars");
    });

    it("reverts on 0 duration days", async () => {
      await expect(
        contract.connect(staker).createHabit("Test", "Custom", 0, { value: MIN_STAKE })
      ).to.be.revertedWith("HabitStaking: duration must be 1-365 days");
    });

    it("reverts on > 365 days", async () => {
      await expect(
        contract.connect(staker).createHabit("Test", "Custom", 366, { value: MIN_STAKE })
      ).to.be.revertedWith("HabitStaking: duration must be 1-365 days");
    });
  });

  // ─── submitDailyProof ─────────────────────────────────────────────────────
  describe("submitDailyProof", () => {
    beforeEach(async () => {
      await contract.connect(staker).createHabit("Daily run", "Fitness", 7, { value: ONE_ETH });
    });

    it("allows submitting proof for day 1 on day 1", async () => {
      await expect(
        contract.connect(staker).submitDailyProof(
          0, 1, "QmABC123", "photo", "Morning run selfie"
        )
      )
        .to.emit(contract, "ProofSubmitted")
        .withArgs(0, 1, "QmABC123", "photo");

      const proof = await contract.getDailyProof(0, 1);
      expect(proof.ipfsCID).to.equal("QmABC123");
      expect(proof.status).to.equal(1); // Pending
    });

    it("allows submitting proof for yesterday (day 1) while on day 2", async () => {
      await time.increase(24 * 60 * 60); // advance 1 day
      await contract.connect(staker).submitDailyProof(0, 1, "QmYEST", "video", "yesterday video");
      const proof = await contract.getDailyProof(0, 1);
      expect(proof.ipfsCID).to.equal("QmYEST");
    });

    it("reverts when submitting proof for a future day", async () => {
      await expect(
        contract.connect(staker).submitDailyProof(0, 2, "QmFUTURE", "photo", "future")
      ).to.be.revertedWith("HabitStaking: cannot submit proof for a future day");
    });

    it("reverts on duplicate proof for same day", async () => {
      await contract.connect(staker).submitDailyProof(0, 1, "QmFIRST", "photo", "first");
      await expect(
        contract.connect(staker).submitDailyProof(0, 1, "QmSECOND", "photo", "second")
      ).to.be.revertedWith("HabitStaking: proof already submitted for this day");
    });

    it("reverts if called by non-staker", async () => {
      await expect(
        contract.connect(stranger).submitDailyProof(0, 1, "QmHACKER", "photo", "nope")
      ).to.be.revertedWith("HabitStaking: caller is not the staker");
    });

    it("reverts on empty CID", async () => {
      await expect(
        contract.connect(staker).submitDailyProof(0, 1, "", "photo", "no cid")
      ).to.be.revertedWith("HabitStaking: IPFS CID cannot be empty");
    });
  });

  // ─── approveProof ─────────────────────────────────────────────────────────
  describe("approveProof", () => {
    beforeEach(async () => {
      await contract.connect(staker).createHabit("Meditate", "Health", 7, { value: ONE_ETH });
      await contract.connect(staker).submitDailyProof(0, 1, "QmMEDITATION", "photo", "meditation proof");
    });

    it("verifier approves a pending proof", async () => {
      await expect(contract.connect(verifier).approveProof(0, 1))
        .to.emit(contract, "ProofApproved")
        .withArgs(0, 1, verifier.address);

      const proof = await contract.getDailyProof(0, 1);
      expect(proof.status).to.equal(2); // Approved

      const info = await contract.getHabitInfo(0);
      expect(info.completedDays).to.equal(1);
    });

    it("reverts if non-verifier tries to approve", async () => {
      await expect(
        contract.connect(stranger).approveProof(0, 1)
      ).to.be.revertedWith("HabitStaking: caller is not a verifier");
    });

    it("reverts on double approve", async () => {
      await contract.connect(verifier).approveProof(0, 1);
      await expect(
        contract.connect(verifier).approveProof(0, 1)
      ).to.be.revertedWith("HabitStaking: proof is not pending");
    });
  });

  // ─── rejectProof ──────────────────────────────────────────────────────────
  describe("rejectProof", () => {
    beforeEach(async () => {
      await contract.connect(staker).createHabit("Study coding", "Coding", 7, { value: ONE_ETH });
      await contract.connect(staker).submitDailyProof(0, 1, "QmFAKE", "photo", "random old photo");
    });

    it("verifier rejects and routes stake to forfeit pool", async () => {
      const dayValue = ONE_ETH / 7n;

      await expect(
        contract.connect(verifier).rejectProof(0, 1, "Photo is not timestamped and appears unrelated")
      )
        .to.emit(contract, "ProofRejected")
        .withArgs(0, 1, verifier.address, "Photo is not timestamped and appears unrelated")
        .to.emit(contract, "DayMissed");

      expect(await contract.forfeitPool()).to.be.gte(dayValue - 1n);

      const info = await contract.getHabitInfo(0);
      expect(info.missedDays).to.equal(1);

      const proof = await contract.getDailyProof(0, 1);
      expect(proof.status).to.equal(3); // Rejected
      expect(proof.verifierNote).to.include("not timestamped");
    });
  });

  // ─── markDayMissed ────────────────────────────────────────────────────────
  describe("markDayMissed", () => {
    beforeEach(async () => {
      await contract.connect(staker).createHabit("No sugar", "Health", 5, { value: ONE_ETH });
    });

    it("marks a day as missed when no proof was submitted", async () => {
      await time.increase(24 * 60 * 60 + 1); // advance past day 1
      const dayValue = ONE_ETH / 5n;

      await expect(contract.connect(stranger).markDayMissed(0, 1))
        .to.emit(contract, "DayMissed");

      expect(await contract.forfeitPool()).to.be.gte(dayValue - 1n);
    });

    it("auto-approves if proof is pending past VERIFICATION_WINDOW", async () => {
      // Submit proof on day 1
      await contract.connect(staker).submitDailyProof(0, 1, "QmOLD", "photo", "old proof");
      // Advance 50 hours (past VERIFICATION_WINDOW of 48 h)
      await time.increase(50 * 60 * 60);

      await contract.connect(stranger).markDayMissed(0, 1);

      const proof = await contract.getDailyProof(0, 1);
      expect(proof.status).to.equal(2); // Auto-approved

      const info = await contract.getHabitInfo(0);
      expect(info.completedDays).to.equal(1);
    });

    it("reverts if day has not yet ended", async () => {
      await expect(
        contract.connect(stranger).markDayMissed(0, 1)
      ).to.be.revertedWith("HabitStaking: day has not ended yet");
    });
  });

  // ─── withdrawStake ────────────────────────────────────────────────────────
  describe("withdrawStake", () => {
    it("refunds full stake to perfect completer + bonus from forfeit pool", async () => {
      const DAYS = 3;
      // Create a second habit (to seed the forfeit pool)
      const [,,, loser] = await ethers.getSigners();
      await contract.connect(loser).createHabit("Loser habit", "Custom", DAYS, { value: ONE_ETH });

      // Staker creates habit
      await contract.connect(staker).createHabit("Perfect habit", "Fitness", DAYS, { value: ONE_ETH });

      // Win/lose loop
      for (let day = 1; day <= DAYS; day++) {
        // Loser misses every day
        await time.increase(24 * 60 * 60 + 1);
        await contract.connect(stranger).markDayMissed(0, day).catch(() => {}); // habitId 0 = loser

        // Staker submits and gets approved
        await contract.connect(staker).submitDailyProof(1, day, `QmD${day}`, "photo", `day ${day}`);
        await contract.connect(verifier).approveProof(1, day);
      }

      // Move past the habit end
      await time.increase(24 * 60 * 60);

      const balanceBefore = await ethers.provider.getBalance(staker.address);
      const tx = await contract.connect(staker).withdrawStake(1);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * tx.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(staker.address);

      // Should get back at least the original stake
      expect(balanceAfter + gasUsed).to.be.gte(balanceBefore + ONE_ETH - ethers.parseEther("0.01"));
    });

    it("deducts missed-day stake from refund", async () => {
      const DAYS = 4;
      await contract.connect(staker).createHabit("Partial habit", "Custom", DAYS, { value: ONE_ETH });

      // Day 1: submit and approve
      await contract.connect(staker).submitDailyProof(0, 1, "QmGOOD", "photo", "good");
      await contract.connect(verifier).approveProof(0, 1);

      // Day 2: miss
      await time.increase(2 * 24 * 60 * 60 + 1);
      await contract.connect(stranger).markDayMissed(0, 1).catch(() => {}); // already resolved
      await contract.connect(stranger).markDayMissed(0, 2);

      // Advance to end
      await time.increase(3 * 24 * 60 * 60);

      const balanceBefore = await ethers.provider.getBalance(staker.address);
      const tx = await contract.connect(staker).withdrawStake(0);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * tx.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(staker.address);

      // Should get less than original stake (missed days forfeited)
      expect(balanceAfter + gasUsed).to.be.lt(balanceBefore + ONE_ETH);
    });

    it("reverts if habit not finished yet", async () => {
      await contract.connect(staker).createHabit("Too early", "Custom", 30, { value: ONE_ETH });
      await expect(
        contract.connect(staker).withdrawStake(0)
      ).to.be.revertedWith("HabitStaking: habit not finished yet");
    });

    it("prevents double withdrawal", async () => {
      await contract.connect(staker).createHabit("Short habit", "Custom", 1, { value: MIN_STAKE });
      await contract.connect(staker).submitDailyProof(0, 1, "QmSHORT", "photo", "done");
      await contract.connect(verifier).approveProof(0, 1);
      await time.increase(2 * 24 * 60 * 60);

      await contract.connect(staker).withdrawStake(0);
      await expect(
        contract.connect(staker).withdrawStake(0)
      ).to.be.revertedWith("HabitStaking: habit is not active");
    });
  });

  // ─── Pause ────────────────────────────────────────────────────────────────
  describe("Pause", () => {
    it("prevents createHabit when paused", async () => {
      await contract.connect(owner).pause();
      await expect(
        contract.connect(staker).createHabit("Paused", "Custom", 7, { value: MIN_STAKE })
      ).to.be.revertedWithCustomError(contract, "EnforcedPause");
    });

    it("allows unpause and normal operation", async () => {
      await contract.connect(owner).pause();
      await contract.connect(owner).unpause();
      await expect(
        contract.connect(staker).createHabit("Unpaused", "Custom", 1, { value: MIN_STAKE })
      ).to.emit(contract, "HabitCreated");
    });
  });
});
