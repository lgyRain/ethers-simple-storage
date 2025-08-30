import { ethers } from "ethers"
import fs from "fs-extra"
import { config } from "dotenv"
config()

// 私钥加密
async function encryptKey() {
  // 1. 检查并获取私钥（修正拼写错误）
  const privateKey = process.env.REMOTE_TEST_PRIVATE_KEY // 正确变量名：REMOTE_TEST_PRIVATE_KEY

  // 基础验证步骤
  if (!privateKey) {
    throw new Error("未找到 REMOTE_TEST_PRIVATE_KEY 环境变量，请检查 .env 文件")
  }

  console.log("私钥长度:", privateKey.length)
  console.log("私钥格式是否正确（0x开头）:", privateKey.startsWith("0x"))

  // 2. 验证私钥是否为有效的十六进制字符串
  const isHex = /^0x[0-9a-fA-F]{64}$/.test(privateKey)
  if (!isHex) {
    throw new Error("私钥格式错误：必须是 0x 开头的 64 位十六进制字符串")
  }

  // 3. 验证私钥数值是否在有效范围内
  const maxPrivateKey = ethers.toBigInt(
    "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364140",
  )
  const privateKeyNum = ethers.toBigInt(privateKey)

  if (privateKeyNum <= 0n || privateKeyNum > maxPrivateKey) {
    throw new Error("私钥数值超出有效范围，不是合法的以太坊私钥")
  }

  // 4. 初始化钱包并加密
  const wallet = new ethers.Wallet(privateKey)
  console.log("钱包初始化成功，地址：", wallet.address)

  const encryptedJsonKey = await wallet.encrypt(process.env.ENCRYPTION_PASSWORD)

  console.log("加密后的私钥 JSON:", encryptedJsonKey)
  fs.writeFileSync("./encryptedKey.json", encryptedJsonKey)
}

encryptKey()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("错误：", error.message)
    process.exit(1)
  })
