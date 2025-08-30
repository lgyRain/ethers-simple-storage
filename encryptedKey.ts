// encryptKey.ts
// 功能：将 .env 中的私钥加密为 JSON 格式并保存到 encryptedKey.json
// 要求：使用 ethers.js v6，类型安全，无编译错误

import { ethers, type Wallet } from "ethers"
import fs from "fs-extra"
import { config } from "dotenv"

// 加载环境变量
config()

// 环境变量类型检查
interface Env {
  REMOTE_TEST_PRIVATE_KEY: string
  ENCRYPTION_PASSWORD: string
}

const env: Env = {
  REMOTE_TEST_PRIVATE_KEY: process.env.REMOTE_TEST_PRIVATE_KEY ?? "",
  ENCRYPTION_PASSWORD: process.env.ENCRYPTION_PASSWORD ?? "",
}

// 验证必要环境变量
if (!env.REMOTE_TEST_PRIVATE_KEY) {
  console.error("❌ 错误：请在 .env 中设置 REMOTE_TEST_PRIVATE_KEY")
  process.exit(1)
}

if (!env.ENCRYPTION_PASSWORD) {
  console.error("❌ 错误：请在 .env 中设置 ENCRYPTION_PASSWORD")
  process.exit(1)
}

// 以太坊私钥最大值（secp256k1 曲线范围）
const MAX_PRIVATE_KEY = ethers.toBigInt(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364140",
)

async function encryptPrivateKey(): Promise<void> {
  const privateKey = env.REMOTE_TEST_PRIVATE_KEY.trim()

  console.log("🔐 正在处理私钥...")
  console.log("📏 私钥长度:", privateKey.length)

  // 1. 检查是否以 0x 开头
  if (!privateKey.startsWith("0x")) {
    console.error("❌ 私钥必须以 '0x' 开头")
    process.exit(1)
  }

  // 2. 验证是否为 64 位十六进制（+ 0x = 66 字符）
  if (privateKey.length !== 66) {
    console.error(
      `❌ 私钥长度错误：期望 66 字符（含 0x），实际 ${privateKey.length}`,
    )
    process.exit(1)
  }

  const hexPattern = /^0x[0-9a-fA-F]{64}$/
  if (!hexPattern.test(privateKey)) {
    console.error("❌ 私钥格式错误：必须是 0x 后跟 64 个十六进制字符")
    process.exit(1)
  }

  // 3. 转换为 BigInt 并验证范围
  let privateKeyNum: bigint
  try {
    privateKeyNum = ethers.toBigInt(privateKey)
  } catch (error) {
    console.error("❌ 无法解析私钥为 BigInt")
    console.error(
      "详细错误:",
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }

  if (privateKeyNum <= 0n) {
    console.error("❌ 私钥不能为零或负数")
    process.exit(1)
  }

  if (privateKeyNum > MAX_PRIVATE_KEY) {
    console.error("❌ 私钥超出 secp256k1 曲线最大值，不合法")
    console.error(`💡 最大允许值: ${MAX_PRIVATE_KEY.toString(16)}`)
    process.exit(1)
  }

  // 4. 创建钱包
  let wallet: Wallet
  try {
    wallet = new ethers.Wallet(privateKey)
  } catch (error) {
    console.error("❌ 无法用私钥创建钱包，请确认私钥合法")
    console.error(
      "错误:",
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }

  console.log("✅ 私钥格式验证通过")
  console.log("💼 钱包地址:", wallet.address)

  // 5. 加密钱包
  let encryptedJson: string
  try {
    encryptedJson = await wallet.encrypt(env.ENCRYPTION_PASSWORD)
  } catch (error) {
    console.error("❌ 加密失败")
    console.error(
      "错误:",
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }

  // 6. 保存到文件
  const outputPath = "./encryptedKey.json"
  try {
    fs.writeFileSync(outputPath, encryptedJson)
    console.log(`✅ 加密成功！已保存到 ${outputPath}`)
    console.log("\n💡 下一步：运行 deploy.ts 部署合约")
  } catch (error) {
    console.error(`❌ 无法写入文件 ${outputPath}`)
    console.error(
      "错误:",
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }
}

// 执行
encryptPrivateKey()
  .then(() => {
    console.log("✨ 私钥加密流程完成")
    process.exit(0)
  })
  .catch((error) => {
    console.error(
      "❌ 脚本异常:",
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  })
