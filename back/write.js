// write.js
// 功能：调用合约 store 函数 + 详细 Gas 分析（修复 BigInt 混合类型错误）

import { ethers } from "ethers"
import fs from "fs-extra"
import { config } from "dotenv"

// 加载 .env 文件
config()

async function writeValue() {
  console.log("📝 开始执行 write.js...")

  // const privateKey = process.env.PRIVATE_KEY;
  // if (!privateKey) {
  //   console.error("❌ 错误：请在 .env 文件中设置 PRIVATE_KEY");
  //   process.exit(1);
  // }s

  //  从私钥初始化钱包（或从加密JSON加载）
  let encryptKey = fs.readFileSync("./encryptKey.json", "utf8")

  const rpcUrl = process.env.REMOTE_TEST_RPC_URL
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  console.log("🔗 连接到 RPC:", rpcUrl)
  //   创建钱包
  const wallet = new ethers.fromEncryptedJson(
    encryptKey,
    process.env.ENCRYPTION_PASSWORD,
  )
  console.log("💼 钱包地址:", wallet.address)
  // const wallet = new ethers.Wallet(privateKey, provider);

  try {
    // 1. 读取合约地址
    const contractAddressFile = "contractAddress.txt"
    if (!fs.existsSync(contractAddressFile)) {
      console.error(
        `❌ 错误：未找到 ${contractAddressFile}，请先运行 deploy.js`,
      )
      process.exit(1)
    }

    const contractAddress = fs.readFileSync(contractAddressFile, "utf8").trim()
    if (!ethers.isAddress(contractAddress)) {
      console.error("❌ 无效的合约地址格式")
      process.exit(1)
    }
    console.log("🔗 合约地址:", contractAddress)

    // 2. 读取 ABI
    const abiFile = "./SimpleStorage_sol_SimpleStorage.abi"
    if (!fs.existsSync(abiFile)) {
      console.error(`❌ ABI 文件 ${abiFile}`)
      process.exit(1)
    }

    const abi = fs.readFileSync(abiFile, "utf8")
    console.log("📄 ABI 文件加载成功")

    // 3. 连接合约
    const contract = new ethers.Contract(contractAddress, abi, wallet)

    // 4. 调用前读取当前值
    const currentValue = await contract.retrieve()
    console.log("🔢 调用前的值:", currentValue.toString())

    // 5. 准备调用 store(7)
    const newValue = 7
    console.log(`📤 正在调用 store(${newValue})...`)

    // 发送交易
    const txResponse = await contract.store(newValue)
    console.log("📝 交易哈希:", txResponse.hash)

    // 等待交易确认
    console.log("⏳ 等待交易确认...")
    const receipt = await txResponse.wait()
    console.log("✅ 交易已确认！")

    // 6. 读取更新后的值
    const updatedValue = await contract.retrieve()
    console.log("🔢 更新后的值:", updatedValue.toString())

    // 7. 验证更新
    if (updatedValue.toString() === newValue.toString()) {
      console.log("🎉 值已成功更新！")
    } else {
      console.warn("⚠️ 值未按预期更新")
    }

    // ✅ === 修复重点：Gas 信息 + BigInt 安全处理 ===
    console.log("\n📊 === 交易 Gas 详细信息 ===")

    if (!receipt) {
      console.warn("⚠️ 无法获取交易回执")
      return
    }

    const blockNumber = receipt.blockNumber || "N/A"
    console.log(`📦 区块号: ${blockNumber}`)

    // ✅ 安全处理 BigInt
    const gasUsed = receipt.gasUsed || 0n // 默认 0n
    const effectiveGasPrice = receipt.effectiveGasPrice || 0n

    const totalCost = gasUsed * effectiveGasPrice // BigInt × BigInt = 安全

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

    // 8. 获取交易详情以判断类型
    const tx = await provider.getTransaction(txResponse.hash)
    if (!tx) {
      console.warn("⚠️ 无法获取交易详情")
      return
    }

    // 判断是否为 EIP-1559 交易
    if (
      tx.maxFeePerGas !== undefined ||
      tx.maxPriorityFeePerGas !== undefined
    ) {
      console.log("\n🔧 EIP-1559 交易详情:")
      console.log(
        `  Max Fee Per Gas: ${ethers.formatUnits(
          tx.maxFeePerGas || 0n,
          "gwei",
        )} Gwei`,
      )
      console.log(
        `  Priority Fee Per Gas: ${ethers.formatUnits(
          tx.maxPriorityFeePerGas || 0n,
          "gwei",
        )} Gwei`,
      )

      const block = await provider.getBlock(receipt.blockNumber)
      const baseFee = block?.baseFeePerGas || 0n
      console.log(
        `  Block Base Fee: ${ethers.formatUnits(baseFee, "gwei")} Gwei`,
      )
    } else {
      console.log("\n🔧 Legacy 交易 (非 EIP-1559)")
      console.log(
        `  Gas Price: ${ethers.formatUnits(tx.gasPrice || 0n, "gwei")} Gwei`,
      )
    }

    console.log("\n✨ write.js 执行完成！")
  } catch (error) {
    console.error("❌ 执行失败：", error.message || error)

    if (error.code) console.error("错误代码:", error.code)
    if (error.data) console.error("错误数据:", error.data)

    process.exit(1)
  }
}

// 执行
writeValue()
