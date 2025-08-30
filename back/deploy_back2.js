const { ethers } = require("ethers");
const fs = require("fs-extra");

async function deployContract() {
  const windowsIp = "192.168.31.12";
  const ganachePort = "7545";
  const provider = new ethers.JsonRpcProvider(
    `http://${windowsIp}:${ganachePort}`
  );

  // 检查连接
  try {
    const network = await provider.getNetwork();
    console.log("已连接到网络：", network.name);
  } catch (networkErr) {
    console.error("网络连接失败：", networkErr);
    return;
  }

  // 使用你的私钥（确保账户有余额）
  const wallet = new ethers.Wallet(
    "0x73c3580fcc99b83ad9094eb0c30758399bfda7a9c6cbabf6d6460b6e6417ecd2",
    provider
  );

  // 读取 ABI 和 Bytecode
  let abi, binary;
  try {
    abi = JSON.parse(
      fs.readFileSync("./SimpleStorage_sol_SimpleStorage.abi", "utf8")
    );
    binary = fs.readFileSync("./SimpleStorage_sol_SimpleStorage.bin", "utf8");
    if (!binary.startsWith("0x")) {
      binary = "0x" + binary;
    }
    console.log("✅ ABI 和 Bytecode 加载成功");
  } catch (readError) {
    console.error("❌ 读取文件失败：", readError);
    process.exit(1);
  }

  // █████████ 主动清理状态：关键新增部分 █████████
  try {
    console.log("🧹 开始清理 Ganache 状态...");

    // 1. 获取当前账户地址
    const address = await wallet.getAddress();

    // 2. 查询当前 nonce（latest：已确认的）
    const confirmedNonce = await provider.getTransactionCount(
      address,
      "latest"
    );
    console.log("📝 已确认 nonce：", confirmedNonce);

    // 3. 查询 pending nonce（包括未确认交易）
    const pendingNonce = await provider.getTransactionCount(address, "pending");
    console.log("🔄 pending nonce：", pendingNonce);

    // 4. 如果 pending > confirmed，说明有未确认交易
    if (pendingNonce > confirmedNonce) {
      console.log("⛏️  发现 pending 交易，强制挖一个区块来确认...");
      await provider.send("evm_mine", []); // 强制生成一个区块，确认所有 pending 交易
      console.log("✅ 区块已生成，pending 交易应已被确认");
    }

    // 5. 再次获取最新 nonce
    const finalNonce = await provider.getTransactionCount(address, "latest");
    console.log("🆕 最终 nonce：", finalNonce);
  } catch (cleanError) {
    console.warn("⚠️ 状态清理阶段出现警告（可忽略）：", cleanError.message);
  }
  // █████████ 状态清理结束 █████████

  // 部署合约（或调用 store）
  let contract;
  try {
    const factory = new ethers.ContractFactory(abi, binary, wallet);
    console.log("🚀 开始部署...");

    contract = await factory.deploy();

    console.log(
      "📝 交易已发送，哈希：",
      contract.deployTransaction?.hash ?? "未知"
    );

    await contract.waitForDeployment();
    const address = await contract.getAddress();
    console.log("✅ 合约部署成功，地址：", address);

    const num1 = await contract.retrieve();
    console.log("🔢 当前数字：", num1.toString());

    // ✅ 现在状态已清理，可以安全调用 store
    const tx = await contract.store(7);
    console.log("📤 写入交易哈希：", tx.hash);

    await tx.wait(); // 等待确认

    const num2 = await contract.retrieve();
    console.log("✅ 更新后数字：", num2.toString());
  } catch (error) {
    console.error("💥 执行失败：", error.message);
    console.error("错误代码：", error.code);
    console.error("详细信息：", error);
    process.exit(1);
  }
}

deployContract();
