import { useState, useCallback } from "react";
import { ethers } from "ethers";
import {
  CHAIN_ID,
  CHAIN_PARAMS,
  HABIT_STAKING_ABI,
  CONTRACT_ADDRESS,
} from "../constants/contract";

export function useWallet() {
  const [state, setState] = useState({
    address: null,
    balance: null,
    provider: null,
    signer: null,
    chainId: null,
    status: "disconnected", // disconnected | connecting | connected | wrong_network
    error: null,
  });

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setState((s) => ({
        ...s,
        error: "MetaMask not found. Please install it from metamask.io",
        status: "disconnected",
      }));
      return;
    }

    setState((s) => ({ ...s, status: "connecting", error: null }));

    try {
      let provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      let network = await provider.getNetwork();
      let chainId = Number(network.chainId);

      if (chainId !== CHAIN_ID) {
        // Try to switch to Sepolia
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xaa36a7" }],
          });
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            // Chain not added — ask MetaMask to add it
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [CHAIN_PARAMS],
            });
          } else {
            throw switchErr;
          }
        }
        // Re-create provider after network switch (old one is stale)
        provider = new ethers.BrowserProvider(window.ethereum);
        network = await provider.getNetwork();
        chainId = Number(network.chainId);
      }

      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const rawBalance = await provider.getBalance(address);
      const balance = parseFloat(ethers.formatEther(rawBalance)).toFixed(4);

      console.log("✅ Wallet connected:", address, "on chain", chainId);

      setState({
        address,
        balance,
        provider,
        signer,
        chainId: CHAIN_ID,
        status: "connected",
        error: null,
      });

      // Listen for account/network changes
      window.ethereum.on("accountsChanged", () => window.location.reload());
      window.ethereum.on("chainChanged", () => window.location.reload());
    } catch (err) {
      console.error("Wallet connection failed:", err);
      const msg = err?.code === 4001
        ? "Connection rejected by user"
        : err.message || "Connection failed";
      setState((s) => ({
        ...s,
        status: "disconnected",
        error: msg,
      }));
    }
  }, []);

  const getContract = useCallback(
    (readOnly = false) => {
      if (!CONTRACT_ADDRESS) throw new Error("CONTRACT_ADDRESS not set in .env");
      if (readOnly) {
        const provider = new ethers.JsonRpcProvider(
          import.meta.env.VITE_ALCHEMY_SEPOLIA_URL || "https://rpc.sepolia.org"
        );
        return new ethers.Contract(CONTRACT_ADDRESS, HABIT_STAKING_ABI, provider);
      }
      if (!state.signer) throw new Error("Wallet not connected");
      return new ethers.Contract(CONTRACT_ADDRESS, HABIT_STAKING_ABI, state.signer);
    },
    [state.signer]
  );

  const refreshBalance = useCallback(async () => {
    if (!state.provider || !state.address) return;
    const raw = await state.provider.getBalance(state.address);
    setState((s) => ({
      ...s,
      balance: parseFloat(ethers.formatEther(raw)).toFixed(4),
    }));
  }, [state.provider, state.address]);

  return { ...state, connect, getContract, refreshBalance };
}
