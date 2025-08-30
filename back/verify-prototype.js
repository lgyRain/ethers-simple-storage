// test-ethers.js
const { ethers } = require("ethers");

console.log("Node.js 版本:", process.version);
console.log("ethers 版本:", ethers.version);

// 简单测试
const provider = new ethers.JsonRpcProvider(
  "https://eth-mainnet.g.alchemy.com/v2/..."
);
console.log("Provider 创建成功 ✅");
