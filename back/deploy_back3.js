// deploy.js
// 功能：部署合约 + 详细 Gas 分析（修复 BigInt 混合类型错误）

import { ethers } from "ethers"
import fs from "fs-extra"
import { config } from "dotenv"

// import * as dotenvSafe from 'dotenv-safe';
// dotenvSafe.config({
//   example: '.env.example', // 强制检查必须的变量
//   allowEmptyValues: false
// });

config()

async function deploy() {
  console.log("🚀 开始部署合约...")

  //   const privateKey = process.env.PRIVATE_KEY;

  //   if (!privateKey?.startsWith("0x") || privateKey.length !== 66) {
  //     console.error("❌ 私钥格式错误：必须是 0x 开头的 64 位十六进制字符串");
  //     process.exit(1);
  //   }

  //   if (!privateKey) {
  //     console.error("❌ 错误：请在 .env 文件中设置 PRIVATE_KEY");
  //     process.exit(1);
  //   }

  //  从私钥初始化钱包（或从加密JSON加载）
  let encryptKey = fs.readFileSync("./encryptedKey.json", "utf8")

  const rpcUrl = process.env.REMOTE_TEST_RPC_URL
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  console.log("🔗 连接到 RPC:", rpcUrl)
  //   创建钱包
  let wallet
  wallet = await ethers.Wallet.fromEncryptedJson(
    encryptKey,
    process.env.ENCRYPTION_PASSWORD,
  )
  console.log("💼 钱包地址:", wallet.address)
  // 连接provider（v6 中 connect 方法返回新的钱包实例）
  wallet = wallet.connect(provider)

  // 3. 验证钱包是否已关联provider
  if (!wallet.provider) {
    throw new Error("钱包未关联provider，无法发送交易")
  }

  // 验证 connectedWallet 类型
  if (!(wallet instanceof ethers.Wallet)) {
    throw new Error("connectedWallet 不是有效的 Wallet 实例")
  }
  // 验证连接成功（调用链上方法测试，如获取余额）
  const balance = await provider.getBalance(wallet.address) // 需要 provider 才能调用
  console.log("连接后的钱包余额：", ethers.formatEther(balance), "ETH")

  //   const wallet = new ethers.Wallet(privateKey, provider);

  try {
    const balance = await provider.getBalance(wallet.address)
    console.log("💰 钱包余额:", ethers.formatEther(balance), "ETH")

    // if (balance === 0n) {
    //   console.error("❌ 钱包余额为 0，请在 MetaMask 中分配资金")
    //   process.exit(1)
    // }

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

    // 3. 测试网代币合约地址
    const tokenContractAddres = await provider.getBlockNumber()
    console.log("代币地址：", tokenContractAddres)

    const factory = new ethers.ContractFactory(abi, binary, wallet)
    console.log("🏭 创建合约工厂...")

    console.log("⏳ 部署中...")
    const contract = await factory.deploy()
    const deployTx = contract.deploymentTransaction()
    if (!deployTx) {
      console.warn("⚠️ 部署交易为空")
      return
    }
    console.log("📝 交易哈希:", deployTx.hash)

    const receipt = await contract.waitForDeployment()
    console.log("✅ 部署成功！")

    const address = await contract.getAddress()
    console.log("🎯 合约地址:", address)

    fs.writeFileSync("contractAddress.txt", address)
    console.log("💾 地址已保存")

    const currentValue = await contract.retrieve()
    console.log("🔢 初始值:", currentValue.toString())

    // ✅ === 修复重点：Gas 信息安全处理 ===
    console.log("\n📊 === 部署交易 Gas 详细信息 ===")

    const txReceipt = await provider.getTransactionReceipt(deployTx.hash)
    if (!txReceipt) {
      console.warn("⚠️ 无法获取交易回执")
      return
    }

    // ✅ 安全提取 BigInt 值，确保不是 undefined
    const gasUsed = txReceipt.gasUsed || 0n
    const effectiveGasPrice = txReceipt.effectiveGasPrice || 0n

    // ✅ 显式转换为 BigInt 再计算
    const totalCost = gasUsed * effectiveGasPrice // 两者都是 BigInt，安全

    console.log(`📦 区块号: ${txReceipt.blockNumber}`)
    console.log(`⛽ 交易使用的 Gas: ${gasUsed.toString()} units`)
    console.log(
      `💸 有效 Gas 价格: ${ethers.formatUnits(effectiveGasPrice, "gwei")} Gwei`,
    )
    console.log(
      `💸 有效 Gas 价格: ${ethers.formatEther(effectiveGasPrice)} ETH`,
    )
    console.log(`💰 交易总费用: ${ethers.formatEther(totalCost)} ETH`)

    // USD 估算（ETH=$3000）
    const ethPrice = 3000
    const totalCostETH = parseFloat(ethers.formatEther(totalCost))
    const totalCostUSD = (totalCostETH * ethPrice).toFixed(6)
    console.log(`🔗 交易费用（USD）: ${totalCostUSD} USD (估算)`)

    // 判断交易类型
    if (
      deployTx.maxFeePerGas !== undefined ||
      deployTx.maxPriorityFeePerGas !== undefined
    ) {
      console.log("\n🔧 EIP-1559 交易详情:")
      console.log(
        `  Max Fee Per Gas: ${ethers.formatUnits(
          deployTx.maxFeePerGas || 0n,
          "gwei",
        )} Gwei`,
      )
      console.log(
        `  Priority Fee Per Gas: ${ethers.formatUnits(
          deployTx.maxPriorityFeePerGas || 0n,
          "gwei",
        )} Gwei`,
      )
      const block = await provider.getBlock(txReceipt.blockNumber)
      console.log(
        `  Block Base Fee: ${ethers.formatUnits(
          block?.baseFeePerGas || 0n,
          "gwei",
        )} Gwei`,
      )
    } else {
      console.log("\n🔧 Legacy 交易 (非 EIP-1559)")
      console.log(
        `  Gas Price: ${ethers.formatUnits(
          deployTx.gasPrice || 0n,
          "gwei",
        )} Gwei`,
      )
    }

    console.log("\n✨ 部署完成！")
    console.log("👉 下一步：运行 node write.js")
  } catch (error) {
    console.error("❌ 部署失败：", error.message || error)

    if (error.code) console.error("错误代码:", error.code)
    if (error.data) console.error("错误数据:", error.data)

    process.exit(1)
  }
}

// 在 deploy.js / write.js 开头
if (!fs.existsSync(".env")) {
  console.error("❌ 错误：.env 文件不存在，请复制 .env.example 并重命名为 .env")
  process.exit(1)
}

deploy()
