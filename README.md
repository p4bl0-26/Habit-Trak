# Stake-Your-Habit

Stake-Your-Habit is a decentralized app built for people who need real stakes to stay consistent. Whether you are trying to run every morning, push code daily, or learn a new language, this protocol uses financial accountability to make sure you actually do it.

## How it Works
The idea is simple: put your money where your mouth is.

1. **The Deposit:** You lock a specific amount of crypto (like ETH or USDC) into our vault smart contract.
2. **The Commitment:** You choose a habit and a timeframe (e.g., "I will complete a Duolingo lesson every day for 30 days").
3. **The Verification:** The smart contract doesn't just take your word for it. It uses Chainlink Functions to securely query official Web2 APIs to check your real-world activity.
4. **The Outcome:** If the oracle verifies you hit your goal, you can withdraw your initial deposit. If you fail, your stake is slashed and sent to a public charity wallet.

## Supported Integrations (Oracle Adapters)
Because the core contract is agnostic, we can plug into almost any public API to verify different habits:
* Fitness: Strava API (running, cycling, workouts)
* Learning: Duolingo API (language streaks)
* Development: GitHub API (daily commits or PRs)
* Wellness: Oura or Apple HealthKit (sleep scores, daily steps)

## Tech Stack
* Frontend: React.js and Tailwind CSS
* Web3: Ethers.js / Wagmi 
* Smart Contracts: Solidity 
* Off-chain Verification: Chainlink Functions

## Current Status
Right now, this repository contains the frontend prototype. We are currently mocking the wallet connections and the staking flow using React state. The goal here is to completely nail the user interface and user experience before we deploy the actual smart contracts to a testnet.

## Getting Started for Local Dev

To run the frontend locally:

1. Clone the repository:
   ```bash
   git clone [https://github.com/YOUR_USERNAME/stake-your-habit.git](https://github.com/YOUR_USERNAME/stake-your-habit.git)
