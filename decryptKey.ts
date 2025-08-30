import { ethers } from "ethers"
import fs from "fs-extra"
import { config } from "dotenv"
config()

// 私钥解密
async function decryptKey() {
  // 1. 检查加密文件是否存在
  const encryptedFilePath = "./encryptedKey.json"
  if (!fs.existsSync(encryptedFilePath)) {
    throw new Error(`未找到加密文件: ${encryptedFilePath}`)
  }

  // 2. 读取加密的 Keystore JSON
  const encryptedJson = await fs.readJson(encryptedFilePath)
  console.log("读取到加密的 Keystore 文件")

  // 3. 获取解密密码（来自 .env）
  const password = process.env.ENCRYPTION_PASSWORD
  if (!password) {
    throw new Error("未找到 ENCRYPTION_PASSWORD 环境变量，请检查 .env 文件")
  }

  // 4. 解密钱包
  let wallet
  try {
    wallet = await ethers.Wallet.fromEncryptedJson(
      JSON.stringify(encryptedJson),
      password,
    )
  } catch (error) {
    throw new Error("解密失败：可能是密码错误，或 Keystore 格式不正确")
  }

  // 5. 输出结果
  console.log("✅ 解密成功！")
  console.log("钱包地址:", wallet.address)
  console.log("私钥（请妥善保管！）:", wallet.privateKey)

  // （可选）验证私钥格式是否合法
  const isHex = /^0x[0-9a-fA-F]{64}$/.test(wallet.privateKey)
  console.log("私钥格式是否正确:", isHex ? "是" : "否")

  // （可选）将私钥保存到文件（注意安全！）
  // fs.writeFileSync("./decryptedPrivateKey.txt", wallet.privateKey);
}

// 执行解密
decryptKey()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 解密失败：", error.message)
    process.exit(1)
  })
