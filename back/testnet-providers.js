import { ethers } from "ethers"
import dotenv from "dotenv"
dotenv.config()

// 1. 配置主流测试网 Provider（选一种即可）
const providers = {
  // Sepolia 测试网（推荐，ETH 官方测试网）
  sepolia: new ethers.JsonRpcProvider(
    // 方式1：使用 Infura（需在 .env 配置 INFURA_API_KEY）
    REMOTE_TEST_RPC_URL,
    // 方式2：使用公开 RPC（无需 API 密钥）
    // "https://rpc.sepolia.org"
  ),

  // Goerli 测试网（逐步淘汰，建议改用 Sepolia）
  goerli: new ethers.JsonRpcProvider(
    `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
  ),

  // Arbitrum Sepolia 测试网（Layer2）
  arbitrumSepolia: new ethers.JsonRpcProvider(
    `https://arbitrum-sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
    // 公开 RPC: "https://sepolia-rollup.arbitrum.io/rpc"
  ),

  // Polygon Mumbai 测试网
  polygonMumbai: new ethers.JsonRpcProvider(
    `https://polygon-mumbai.infura.io/v3/${process.env.INFURA_API_KEY}`,
    // 公开 RPC: "https://rpc-mumbai.maticvigil.com"
  ),
}

// 2. 选择要使用的测试网（例如 Sepolia）
const testnet = "sepolia"
// const provider = providers[testnet]
const provider = new ethers.JsonRpcProvider(
  REMOTE_TEST_RPC_URL,
  REMOTE_TEST_PRIVATE_KEY,
)

// 3. 验证 Provider 连接是否成功
async function verifyProvider() {
  try {
    // 获取测试网最新区块号（验证连接）
    const blockNumber = await provider.getBlockNumber()
    console.log(`✅ ${testnet} 测试网连接成功，最新区块: ${blockNumber}`)
    return provider
  } catch (error) {
    console.error(`❌ ${testnet} 测试网连接失败:`, error.message)
  }
}

// 执行验证
verifyProvider()

// 导出供其他模块使用
export { provider, providers }
