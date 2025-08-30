// write.ts
// 功能：调用合约 store 函数 + 详细 Gas 分析（完全类型安全版本）

import {
  ethers,
  type TransactionReceipt,
  type Provider,
  type Signer,
  type BaseContract,
  type ContractTransactionResponse,
} from "ethers"
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

// 环境变量验证
if (!env.ENCRYPTION_PASSWORD) {
  console.error("❌ 错误：请在 .env 中设置 ENCRYPTION_PASSWORD")
  process.exit(1)
}

if (!env.REMOTE_TEST_RPC_URL) {
  console.error("❌ 错误：请在 .env 中设置 REMOTE_TEST_RPC_URL")
  process.exit(1)
}

// 合约接口定义（精确匹配Ethers.js v6类型）
interface SimpleStorageContract extends BaseContract {
  retrieve: () => Promise<bigint>
  store: (value: bigint) => Promise<ContractTransactionResponse>
}

async function writeValue() {
  console.log("📝 开始执行 write.ts...")

  // 1. 读取加密钱包
  const encryptedPath = "./encryptedKey.json"
  if (!fs.existsSync(encryptedPath)) {
    console.error(`❌ 未找到加密钱包文件: ${encryptedPath}`)
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
    console.error(
      "详细错误:",
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }

  // 2. 连接Provider并获取签名器
  const provider: Provider = new ethers.JsonRpcProvider(env.REMOTE_TEST_RPC_URL)
  const signer = wallet.connect(provider)
  console.log("🔗 连接到 RPC:", env.REMOTE_TEST_RPC_URL)

  // 获取钱包地址
  const walletAddress = await signer.getAddress()
  console.log("💼 钱包地址:", walletAddress)

  try {
    // 3. 读取合约地址
    const contractAddressFile = "contractAddress.txt"
    if (!fs.existsSync(contractAddressFile)) {
      console.error(`❌ 未找到 ${contractAddressFile}，请先运行 deploy.ts`)
      process.exit(1)
    }

    const contractAddress = fs.readFileSync(contractAddressFile, "utf8").trim()
    if (!ethers.isAddress(contractAddress)) {
      console.error("❌ 无效的合约地址格式:", contractAddress)
      process.exit(1)
    }
    console.log("🔗 合约地址:", contractAddress)

    // 4. 读取并解析ABI
    const abiPath = "./SimpleStorage_sol_SimpleStorage.abi"
    if (!fs.existsSync(abiPath)) {
      console.error(`❌ 未找到 ABI 文件: ${abiPath}`)
      process.exit(1)
    }

    // ABI解析与验证
    const abiContent = fs.readFileSync(abiPath, "utf8").trim()
    let abi: any[]
    try {
      abi = JSON.parse(abiContent)
      if (!Array.isArray(abi)) {
        throw new Error("ABI解析结果不是数组")
      }
    } catch (error) {
      console.error("❌ ABI文件解析失败（格式错误）")
      console.error(
        "详细错误:",
        error instanceof Error ? error.message : String(error),
      )
      process.exit(1)
    }
    console.log("📄 ABI 文件加载成功")

    // 5. 创建合约实例（带类型断言）
    const contract = new ethers.Contract(
      contractAddress,
      abi,
      signer,
    ) as unknown as SimpleStorageContract
    console.log("🔗 合约实例已创建")

    // 6. 调用前读取当前值
    const currentValue = await contract.retrieve()
    console.log("🔢 调用前的值:", currentValue.toString())

    // 7. 调用store方法
    const newValue = 7n
    console.log(`📤 正在调用 store(${newValue})...`)

    // 发送交易
    const txResponse: ContractTransactionResponse =
      await contract.store(newValue)
    console.log("📝 交易哈希:", txResponse.hash)

    // 等待交易确认（处理null情况）
    console.log("⏳ 等待交易确认...")
    const receipt: TransactionReceipt | null = await txResponse.wait()
    if (!receipt) {
      console.error("❌ 未获取到交易回执，交易可能失败")
      process.exit(1)
    }
    console.log("✅ 交易已确认！区块号:", receipt.blockNumber)

    // 8. 验证更新后的值
    const updatedValue = await contract.retrieve()
    console.log("🔢 更新后的值:", updatedValue.toString())

    if (updatedValue === newValue) {
      console.log("🎉 值已成功更新！")
    } else {
      console.warn("⚠️ 值未按预期更新")
    }

    // 9. Gas费用分析（兼容EIP-1559和Legacy交易）
    console.log("\n📊 === 交易Gas详细信息 ===")
    const gasUsed = receipt.gasUsed

    // 安全获取Gas价格（兼容不同交易类型）
    let gasPrice: bigint
    if (txResponse.maxFeePerGas) {
      // EIP-1559交易：使用交易对象中的maxFeePerGas
      gasPrice = txResponse.maxFeePerGas
    } else if (txResponse.gasPrice) {
      // Legacy交易：使用交易对象中的gasPrice
      gasPrice = txResponse.gasPrice
    } else {
      //  fallback：从区块估算
      const block = await provider.getBlock(receipt.blockNumber)
      gasPrice = block?.baseFeePerGas || 0n
    }

    const totalCost = gasUsed * gasPrice

    console.log(`⛽ 使用Gas: ${gasUsed.toString()} units`)
    console.log(`💸 Gas价格: ${ethers.formatUnits(gasPrice, "gwei")} Gwei`)
    console.log(`💰 交易总费用: ${ethers.formatEther(totalCost)} ETH`)

    // USD估算
    const ethPrice = 3000 // USD
    const totalCostETH = parseFloat(ethers.formatEther(totalCost))
    const totalCostUSD = (totalCostETH * ethPrice).toFixed(6)
    console.log(`🔗 交易费用（USD）: ${totalCostUSD} USD (估算)`)

    // 10. 交易类型详细信息
    if (txResponse.maxFeePerGas) {
      console.log("\n🔧 EIP-1559交易详情:")
      console.log(
        `  Max Fee: ${ethers.formatUnits(txResponse.maxFeePerGas, "gwei")} Gwei`,
      )
      console.log(
        `  Priority Fee: ${ethers.formatUnits(txResponse.maxPriorityFeePerGas || 0n, "gwei")} Gwei`,
      )

      const block = await provider.getBlock(receipt.blockNumber)
      const baseFee = block?.baseFeePerGas || 0n
      console.log(`  Base Fee: ${ethers.formatUnits(baseFee, "gwei")} Gwei`)
    } else {
      console.log("\n🔧 Legacy交易:")
      console.log(
        `  Gas Price: ${ethers.formatUnits(txResponse.gasPrice || 0n, "gwei")} Gwei`,
      )
    }

    console.log("\n✨ write.ts 执行完成！")
  } catch (error) {
    console.error(
      "❌ 执行失败:",
      error instanceof Error ? error.message : String(error),
    )

    if (error && typeof error === "object") {
      const code = (error as any).code
      const data = (error as any).data
      if (code) console.error("错误代码:", code)
      if (data) console.error("错误数据:", data)
    }

    process.exit(1)
  }
}

// 执行脚本
writeValue().catch((error) => {
  console.error("❌ 脚本异常:", error)
  process.exit(1)
})
