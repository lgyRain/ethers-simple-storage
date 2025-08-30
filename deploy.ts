// deploy.ts
// 功能：TypeScript + ethers.js v6 合约部署 + Gas 分析（修复类型错误）

import {
  ethers,
  type TransactionReceipt, // 修正：使用通用交易回执类型
  type Provider,
  type Signer,
  type BaseContract,
} from "ethers"
// import * as fs from "fs-extra" ES模块模式下不兼容
import fs from "fs-extra"
import { config } from "dotenv"

// 加载环境变量
config()

// 环境变量类型检查
interface Env {
  ENCRYPTION_PASSWORD: string
  REMOTE_TEST_RPC_URL: string
}

const env: Env = {
  ENCRYPTION_PASSWORD: process.env.ENCRYPTION_PASSWORD ?? "",
  REMOTE_TEST_RPC_URL: process.env.REMOTE_TEST_RPC_URL ?? "",
}

// 环境变量校验
if (!env.ENCRYPTION_PASSWORD) {
  console.error("❌ 错误：请在 .env 中设置 ENCRYPTION_PASSWORD")
  process.exit(1)
}

if (!env.REMOTE_TEST_RPC_URL) {
  console.error("❌ 错误：请在 .env 中设置 REMOTE_TEST_RPC_URL")
  process.exit(1)
}

// 定义合约接口（适配 Ethers.js v6 类型）
interface SimpleStorageContract extends BaseContract {
  // 修正：用 bigint 替代 BigNumber（Ethers.js v6 返回原生 bigint）
  retrieve: () => Promise<bigint>
}

async function deploy() {
  console.log("🚀 开始部署合约...")

  // 1. 检查 .env 文件
  if (!fs.existsSync(".env")) {
    console.error("❌ 错误：.env 文件不存在")
    process.exit(1)
  }

  // 2. 加载加密钱包
  const encryptedPath = "./encryptedKey.json"
  if (!fs.existsSync(encryptedPath)) {
    console.error(`❌ 错误：未找到加密钱包文件 ${encryptedPath}`)
    process.exit(1)
  }

  const encryptedJson = fs.readFileSync(encryptedPath, "utf8")
  let wallet: Signer

  try {
    wallet = await ethers.Wallet.fromEncryptedJson(
      encryptedJson,
      env.ENCRYPTION_PASSWORD,
    )
  } catch (error) {
    console.error("❌ 解密失败：密码错误或文件损坏")
    process.exit(1)
  }

  // 3. 连接 Provider
  const provider: Provider = new ethers.JsonRpcProvider(env.REMOTE_TEST_RPC_URL)
  console.log("🔗 连接到 RPC:", env.REMOTE_TEST_RPC_URL)

  let network
  try {
    network = await provider.getNetwork()
    console.log("🌐 网络名称:", network.name)
    console.log("🔢 Chain ID:", Number(network.chainId))
  } catch (error) {
    console.error("❌ 无法连接到 RPC 节点")
    process.exit(1)
  }

  // 强制检查 Sepolia 网络
  if (network.name !== "sepolia" && Number(network.chainId) !== 11155111) {
    console.error("❌ 错误：当前网络不是 Sepolia！")
    process.exit(1)
  }

  // 连接钱包到 provider
  const signer = wallet.connect(provider)

  // 4. 检查余额
  const balance = await provider.getBalance(await signer.getAddress())
  console.log("💼 钱包地址:", await signer.getAddress())
  console.log("💰 钱包余额:", ethers.formatEther(balance), "SepoliaETH")

  if (balance === 0n) {
    console.error("❌ 钱包余额为 0，请获取测试币")
    process.exit(1)
  }

  // 5. 读取 ABI 和 Bytecode
  const abiPath = "./SimpleStorage_sol_SimpleStorage.abi"
  const binPath = "./SimpleStorage_sol_SimpleStorage.bin"

  if (!fs.existsSync(abiPath) || !fs.existsSync(binPath)) {
    console.error("❌ 未找到 ABI 或 Bytecode 文件")
    process.exit(1)
  }

  const abi = JSON.parse(fs.readFileSync(abiPath, "utf8"))
  let bytecode = fs.readFileSync(binPath, "utf8").trim()
  if (!bytecode.startsWith("0x")) bytecode = "0x" + bytecode

  // 6. 部署合约
  console.log("🏭 创建合约工厂...")
  const factory = new ethers.ContractFactory(abi, bytecode, signer)
  console.log("⏳ 正在部署合约...")

  let contract: SimpleStorageContract
  try {
    const deployedContract = await factory.deploy()
    await deployedContract.waitForDeployment()
    contract = deployedContract as SimpleStorageContract
  } catch (error) {
    console.error("❌ 合约部署失败")
    process.exit(1)
  }

  // 部署交易信息
  const deployTx = contract.deploymentTransaction()
  if (deployTx) console.log("📝 交易哈希:", deployTx.hash)

  // 合约地址
  const contractAddress = await contract.getAddress()
  console.log("✅ 部署成功！合约地址:", contractAddress)
  fs.writeFileSync("contractAddress.txt", contractAddress)

  // 调用初始值（修正：返回类型为 bigint）
  const currentValue = await contract.retrieve()
  console.log("🔢 初始值:", currentValue.toString()) // 直接对 bigint 调用 toString()

  // 7. Gas 费用分析（修正回执类型）
  console.log("\n📊 === Gas 详细信息 ===")
  if (!deployTx) {
    console.warn("⚠️ 部署交易为空")
    return
  }

  // 修正：使用 TransactionReceipt 类型
  let receipt: TransactionReceipt | null
  try {
    receipt = await provider.getTransactionReceipt(deployTx.hash)
  } catch (error) {
    console.warn("⚠️ 无法获取交易回执")
    return
  }

  if (!receipt) {
    console.warn("⚠️ 交易回执为空")
    return
  }

  // 修正：Ethers.js v6 中 gasPrice 可能为 null，需处理
  const gasUsed = receipt.gasUsed
  const gasPrice = deployTx.gasPrice ?? (receipt as any).effectiveGasPrice ?? 0n
  const totalCost = gasUsed * gasPrice

  console.log(`📦 区块号: ${receipt.blockNumber}`)
  console.log(`⛽ 使用 Gas: ${gasUsed.toString()} units`)
  console.log(`💸 Gas 价格: ${ethers.formatUnits(gasPrice, "gwei")} Gwei`)
  console.log(`💰 交易总费用: ${ethers.formatEther(totalCost)} ETH`)

  console.log("\n✨ 部署完成！")
}

deploy().catch((error) => {
  console.error("❌ 部署脚本异常:", error)
  process.exit(1)
})
