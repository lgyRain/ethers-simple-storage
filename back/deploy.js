// deploy.js
// 功能：部署合约 + 详细 Gas 分析（修复 BigInt 混合类型错误）

import { ethers } from "ethers"
import fs from "fs-extra"
import { config } from "dotenv"

config()

async function deploy() {
  console.log("🚀 开始部署合约...")

  // 1. 检查 .env 文件是否存在
  if (!fs.existsSync(".env")) {
    console.error(
      "❌ 错误：.env 文件不存在，请复制 .env.example 并重命名为 .env",
    )
    process.exit(1)
  }

  // 2. 加载加密钱包
  const encryptedPath = "./encryptedKey.json"
  if (!fs.existsSync(encryptedPath)) {
    console.error(`❌ 错误：未找到加密钱包文件 ${encryptedPath}`)
    process.exit(1)
  }

  const encryptJson = fs.readFileSync(encryptedPath, "utf8")

  const password = process.env.ENCRYPTION_PASSWORD
  if (!password) {
    console.error("❌ 错误：请在 .env 中设置 ENCRYPTION_PASSWORD")
    process.exit(1)
  }

  let wallet
  try {
    wallet = await ethers.Wallet.fromEncryptedJson(encryptJson, password)
  } catch (error) {
    console.error("❌ 解密失败：可能是密码错误，或加密文件损坏")
    console.error("详细错误:", error.message)
    process.exit(1)
  }

  // 3. 连接 RPC 并验证网络
  const rpcUrl = process.env.REMOTE_TEST_RPC_URL
  if (!rpcUrl) {
    console.error("❌ 错误：请在 .env 中设置 REMOTE_TEST_RPC_URL")
    process.exit(1)
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl)
  console.log("🔗 正在连接到 RPC:", rpcUrl)

  // 🔁 新增：获取网络信息
  let network
  try {
    network = await provider.getNetwork()
    console.log("🌐 网络名称:", network.name)
    console.log("🔢 Chain ID:", Number(network.chainId))
  } catch (error) {
    console.error("❌ 无法连接到 RPC 节点，请检查 URL 是否正确")
    console.error("错误详情:", error.message)
    process.exit(1)
  }

  // 🔴 强制检查是否为 Sepolia
  if (network.name !== "sepolia" && Number(network.chainId) !== 11155111) {
    console.error("❌ 错误：当前网络不是 Sepolia！")
    console.error(
      `💡 当前连接的是: ${network.name} (Chain ID: ${Number(network.chainId)})`,
    )
    console.error("🔧 请确保 REMOTE_TEST_RPC_URL 指向 Sepolia：")
    console.error("   https://sepolia.infura.io/v3/<your-project-id>")
    process.exit(1)
  }

  // 连接钱包
  wallet = wallet.connect(provider)

  // 4. 检查余额
  const balance = await provider.getBalance(wallet.address)
  console.log("💼 钱包地址:", wallet.address)
  console.log("💰 钱包余额:", ethers.formatEther(balance), "SepoliaETH") // 改为 SepoliaETH

  if (balance === 0n) {
    console.error("❌ 钱包余额为 0，请在 Sepolia 水龙头获取测试币")
    console.error("🔗 水龙头: https://sepoliafaucet.com")
    process.exit(1)
  }

  // 5. 读取 ABI 和 Bytecode
  const abiPath = "./SimpleStorage_sol_SimpleStorage.abi"
  const binPath = "./SimpleStorage_sol_SimpleStorage.bin"

  if (!fs.existsSync(abiPath)) {
    console.error(`❌ 未找到 ABI 文件: ${abiPath}`)
    process.exit(1)
  }
  if (!fs.existsSync(binPath)) {
    console.error(`❌ 未找到 Bytecode 文件: ${binPath}`)
    process.exit(1)
  }

  const abi = fs.readFileSync(abiPath, "utf8")
  let binary = fs.readFileSync(binPath, "utf8").trim()
  if (!binary.startsWith("0x")) {
    binary = "0x" + binary
  }

  // ❌ 修复：这里不是代币地址，而是区块号！原代码逻辑错误
  // const tokenContractAddres = await provider.getBlockNumber()
  // console.log("代币地址：", tokenContractAddres)  // 错误！

  // 6. 部署合约
  console.log("🏭 创建合约工厂...")
  const factory = new ethers.ContractFactory(abi, binary, wallet)
  console.log("⏳ 正在部署合约...")

  const contract = await factory.deploy()
  const deployTx = contract.deploymentTransaction()

  if (!deployTx) {
    console.warn("⚠️ 部署交易为空")
    return
  }

  console.log("📝 交易哈希:", deployTx.hash)

  // ✅ 等待部署完成（ethers v6 返回的是 Contract 实例）
  await contract.waitForDeployment()
  console.log("✅ 部署成功！")

  const address = await contract.getAddress()
  console.log("🎯 合约地址:", address)

  // 保存地址
  fs.writeFileSync("contractAddress.txt", address)
  console.log("💾 合约地址已保存到 contractAddress.txt")

  // 调用初始值
  const currentValue = await contract.retrieve()
  console.log("🔢 初始值:", currentValue.toString())

  // ======================
  // 📊 Gas 费用详细分析
  // ======================
  console.log("\n📊 === 部署交易 Gas 详细信息 ===")

  const txReceipt = await provider.getTransactionReceipt(deployTx.hash)
  if (!txReceipt) {
    console.warn("⚠️ 无法获取交易回执")
    return
  }

  const gasUsed = txReceipt.gasUsed || 0n
  const effectiveGasPrice = txReceipt.effectiveGasPrice || 0n
  const totalCost = gasUsed * effectiveGasPrice // BigInt × BigInt = 安全

  console.log(`📦 区块号: ${txReceipt.blockNumber}`)
  console.log(`⛽ 交易使用的 Gas: ${gasUsed.toString()} units`)
  console.log(
    `💸 有效 Gas 价格: ${ethers.formatUnits(effectiveGasPrice, "gwei")} Gwei`,
  )
  console.log(`💸 有效 Gas 价格: ${ethers.formatEther(effectiveGasPrice)} ETH`)
  console.log(`💰 交易总费用: ${ethers.formatEther(totalCost)} ETH`)

  // USD 估算（ETH=$3000）
  const ethPrice = 3000
  const totalCostETH = parseFloat(ethers.formatEther(totalCost))
  const totalCostUSD = (totalCostETH * ethPrice).toFixed(6)
  console.log(`🔗 交易费用（USD）: ${totalCostUSD} USD (估算)`)

  // 判断交易类型（EIP-1559 vs Legacy）
  if (
    deployTx.maxFeePerGas !== undefined ||
    deployTx.maxPriorityFeePerGas !== undefined
  ) {
    console.log("\n🔧 EIP-1559 交易详情:")
    console.log(
      `  Max Fee Per Gas: ${ethers.formatUnits(deployTx.maxFeePerGas || 0n, "gwei")} Gwei`,
    )
    console.log(
      `  Priority Fee Per Gas: ${ethers.formatUnits(deployTx.maxPriorityFeePerGas || 0n, "gwei")} Gwei`,
    )
    const block = await provider.getBlock(txReceipt.blockNumber)
    console.log(
      `  Block Base Fee: ${ethers.formatUnits(block?.baseFeePerGas || 0n, "gwei")} Gwei`,
    )
  } else {
    console.log("\n🔧 Legacy 交易 (非 EIP-1559)")
    console.log(
      `  Gas Price: ${ethers.formatUnits(deployTx.gasPrice || 0n, "gwei")} Gwei`,
    )
  }

  console.log("\n✨ 部署完成！")
  console.log("👉 下一步：运行 node write.js")
}

// 启动部署
deploy().catch((error) => {
  console.error("❌ 部署脚本异常:", error)
  process.exit(1)
})
