const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying HabitStaking with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const Factory = await ethers.getContractFactory("HabitStaking");
  console.log("\nDeploying HabitStaking...");
  const contract = await Factory.deploy(deployer.address);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\n✅ HabitStaking deployed to:", address);

  // Register deployer as the first verifier
  console.log("\nRegistering deployer as first verifier...");
  const tx = await contract.addVerifier(deployer.address);
  await tx.wait();
  console.log("✅ Deployer added as verifier:", deployer.address);

  console.log("\n─────────────────────────────────────────────────────────────");
  console.log("  NEXT STEPS:");
  console.log("─────────────────────────────────────────────────────────────");
  console.log("1. Copy this address into your .env file:");
  console.log(`     VITE_CONTRACT_ADDRESS=${address}`);
  console.log("\n2. Verify on Etherscan:");
  console.log(`     npx hardhat verify --network sepolia ${address} "${deployer.address}"`);
  console.log("─────────────────────────────────────────────────────────────\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
