import { useState, useCallback } from "react";
import { ethers } from "ethers";

const PINATA_API_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const GATEWAY = import.meta.env.VITE_PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs";

export function useIPFS() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const uploadFile = useCallback(async (file, metadata = {}) => {
    const apiKey = import.meta.env.VITE_PINATA_API_KEY;
    const secretKey = import.meta.env.VITE_PINATA_SECRET_KEY;

    if (!apiKey || !secretKey) {
      throw new Error("Pinata API keys not set in .env (VITE_PINATA_API_KEY / VITE_PINATA_SECRET_KEY)");
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const pinataMetadata = JSON.stringify({
        name: metadata.name || file.name,
        keyvalues: {
          habitId: metadata.habitId?.toString() || "",
          day: metadata.day?.toString() || "",
          uploader: metadata.uploader || "",
          proofType: metadata.proofType || "",
          timestamp: Date.now().toString(),
        },
      });
      formData.append("pinataMetadata", pinataMetadata);

      const pinataOptions = JSON.stringify({ cidVersion: 1 });
      formData.append("pinataOptions", pinataOptions);

      // Use XMLHttpRequest so we can track upload progress
      const cid = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", PINATA_API_URL);
        xhr.setRequestHeader("pinata_api_key", apiKey);
        xhr.setRequestHeader("pinata_secret_api_key", secretKey);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };

        xhr.onload = () => {
          try {
            const res = JSON.parse(xhr.responseText);
            if (xhr.status === 200) resolve(res.IpfsHash);
            else reject(new Error(res.error?.details || "Upload failed"));
          } catch {
            reject(new Error("Invalid Pinata response"));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(formData);
      });

      setProgress(100);
      return { cid, url: `${GATEWAY}/${cid}` };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  const cidToUrl = useCallback((cid) => `${GATEWAY}/${cid}`, []);

  return { uploadFile, uploading, progress, error, cidToUrl };
}
