// ethers v5语法：
// const ethers  = require("ethers");
// ethers v6语法：
const { ethers } = require("ethers");
// nodejs提供的
// 没有的话，进行安装：yarn add fs-extra
// 用来调用ABI
const fs = require("fs-extra");

async function deployContract() {
  // http://127.0.0.1:8585
  // 1. 创建 provider（连接到 Ganache 等节点）
  // 注意：需填入你的 RPC 地址（如 Ganache 的 http://127.0.0.1:7545）
  // WSL：Ubuntu子系统，无法直接连接到window桌面的Ganache
  // 不能直接使用 http://127.0.0.1:7545）
  // 需要回到windows 通过cmd下 ipconfig 获取window主机IP地址：192.168.31.12
  // 关键：使用 Windows 的 IP 地址（如 192.168.31.12），端口与 Ganache 一致
  const windowsIp = "192.168.31.12"; // 替换为你的 Windows IPv4 地址
  const ganachePort = "7545"; // 替换为 Ganache 的端口（7545 或自定义）
  const provider = new ethers.JsonRpcProvider(
    `http://${windowsIp}:${ganachePort}`
  );

  // 检查连接是否正常
  try {
    const network = await provider.getNetwork();
    console.log("已连接到网络：", network.name); // 应显示 "unknown"（Ganache 本地网络）
  } catch (networkErr) {
    console.error(
      "网络连接失败，请检查 Ganache 是否启动及地址是否正确：",
      networkErr
    );
    return;
  }

  // 2. 创建钱包（私钥 + provider）
  // v6 中 Wallet 构造函数：new ethers.Wallet(私钥, provider)
  const wallet = new ethers.Wallet(
    "0xbd331283d39dffbebd9bb8f151c6b81515cf2c5a06470ba839512ba5dbb911b3",
    provider
  );

  // 3. 加载合约 abi 和 bytecode（根据你的实际文件路径修改）
  const abi = fs.readFileSync("./SimpleStorage_sol_SimpleStorage.abi", "utf8");
  const binary = fs.readFileSync(
    "./SimpleStorage_sol_SimpleStorage.bin",
    "utf8"
  );
  // 获取随机数
  const nonce = await provider.getTransactionCount(wallet.address, "pending");
  console.log("Current nonce:", nonce);
  // 4. 创建合约工厂并部署
  const contractFactory = new ethers.ContractFactory(abi, binary, wallet);
  console.log("Deploying,please wait ...");

  // 告诉代码到这里，等待合约部署完成
  // await关键字，意味着这里将处理promise。
  // 5. 部署合约
  const contract = await contractFactory.deploy({ nonce });
  const deploymentReceipt = await contract.waitForDeployment();
  // console.log("部署合约:", deploymentReceipt);

  // // 获取合约地址
  // console.log("🔗 合约地址：", await contract.getAddress());

  // 获取交易回执
  // const tx = contract.deploymentTransaction();
  // if (tx) {
  //   const receipt = await tx.wait();
  //   console.log("部署交易回执：", receipt);
  // }

  // 在 ethers.js v6 中，获取 nonce（即交易计数）的标准方式是：
  // const nonce = await wallet.getNonce();
  // const tx = {
  //   nonce: nonce,
  //   gasPrice: 20000000000,
  //   gaslimit: 6721975,
  //   to: null,
  //   value: 0,
  //   data: "0x608060405234801561001057600080fd5b50610771806100206000396000f3fe608060405234801561001057600080fd5b50600436106100575760003560e01c80632e64cec11461005c5780636057361d1461007a5780636f760f41146100965780638bab8dd5146100b25780639e7a13ad146100e2575b600080fd5b610064610113565b604051610071919061052a565b60405180910390f35b610094600480360381019061008f919061046d565b61011c565b005b6100b060048036038101906100ab9190610411565b610126565b005b6100cc60048036038101906100c791906103c8565b6101b6565b6040516100d9919061052a565b60405180910390f35b6100fc60048036038101906100f7919061046d565b6101e4565b60405161010a929190610545565b60405180910390f35b60008054905090565b8060008190555050565b6001604051806040016040528083815260200184815250908060018154018082558091505060019003906000526020600020906002020160009091909190915060008201518160000155602082015181600101908051906020019061018c9291906102a0565b505050806002836040516101a09190610513565b9081526020016040518091039020819055505050565b6002818051602081018201805184825260208301602085012081835280955050505050506000915090505481565b600181815481106101f457600080fd5b906000526020600020906002020160009150905080600001549080600101805461021d9061063e565b80601f01602080910402602001604051908101604052809291908181526020018280546102499061063e565b80156102965780601f1061026b57610100808354040283529160200191610296565b820191906000526020600020905b81548152906001019060200180831161027957829003601f168201915b5050505050905082565b8280546102ac9061063e565b90600052602060002090601f0160209004810192826102ce5760008555610315565b82601f106102e757805160ff1916838001178555610315565b82800160010185558215610315579182015b828111156103145782518255916020019190600101906102f9565b5b5090506103229190610326565b5090565b5b8082111561033f576000816000905550600101610327565b5090565b60006103566103518461059a565b610575565b90508281526020810184848401111561037257610371610704565b5b61037d8482856105fc565b509392505050565b600082601f83011261039a576103996106ff565b5b81356103aa848260208601610343565b91505092915050565b6000813590506103c281610724565b92915050565b6000602082840312156103de576103dd61070e565b5b600082013567ffffffffffffffff8111156103fc576103fb610709565b5b61040884828501610385565b91505092915050565b600080604083850312156104285761042761070e565b5b600083013567ffffffffffffffff81111561044657610445610709565b5b61045285828601610385565b9250506020610463858286016103b3565b9150509250929050565b6000602082840312156104835761048261070e565b5b6000610491848285016103b3565b91505092915050565b60006104a5826105cb565b6104af81856105d6565b93506104bf81856020860161060b565b6104c881610713565b840191505092915050565b60006104de826105cb565b6104e881856105e7565b93506104f881856020860161060b565b80840191505092915050565b61050d816105f2565b82525050565b600061051f82846104d3565b915081905092915050565b600060208201905061053f6000830184610504565b92915050565b600060408201905061055a6000830185610504565b818103602083015261056c818461049a565b90509392505050565b600061057f610590565b905061058b8282610670565b919050565b6000604051905090565b600067ffffffffffffffff8211156105b5576105b46106d0565b5b6105be82610713565b9050602081019050919050565b600081519050919050565b600082825260208201905092915050565b600081905092915050565b6000819050919050565b82818337600083830152505050565b60005b8381101561062957808201518184015260208101905061060e565b83811115610638576000848401525b50505050565b6000600282049050600182168061065657607f821691505b6020821081141561066a576106696106a1565b5b50919050565b61067982610713565b810181811067ffffffffffffffff82111715610698576106976106d0565b5b80604052505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b61072d816105f2565b811461073857600080fd5b5056fea2646970667358221220d75678003404851d005afe692de1ec1add4d43987a4d2fe2afbeb30b5b0433df64736f6c63430008070033",
  //   chainId: 1337,
  // };

  // 通过钱包的私钥，对交易进行签名。并没有进行发送，所以链上不会生成新的区块。
  // const signedTxResponse = await wallet.signTransaction(tx);
  // 发送交易。
  // const signedTxResponse = await wallet.sendTransaction(tx);
  // // 等待一个区块确认，确保这笔交易真正通过
  // await signedTxResponse.wait();
  // console.log(signedTxResponse);

  // 读取数据
  const currentFavoriteNumber = await contract.retrieve();
  console.log(`Current Favorite Number:${currentFavoriteNumber.toString()}`);

  // 将变量作为字符串传递给函数
  // 调用时，ethers知道这个字符串7，实际是数字7
  // 更新合约：这是一个交易，需要花费gas
  const transactionResponse = await contract.store("7");
  console.log(`transactionResponse:${transactionResponse}`);
  // 等待交易确认（默认 1 个区块）
  const transactionReceipt = await transactionResponse.wait({
    blocks: 1,
  });
  const updatedFavoriteNumber = await contract.retrieve();
  console.log(`更新 currentFavoriteNumber ：${updatedFavoriteNumber.toString}`);

  // const receipt = await provider.waitForTransaction(tx.hash, 1);
  // console.log("部署成功，地址:", receipt.contractAddress);

  // 方法1：默认等待部署完成（推荐，相当于 1 个确认）
  // const deploymentTx = await contract.getDeploymentTransaction(); // 获取部署交易
  // const deploymentReceipt = await provider.waitForTransaction(
  //   deploymentTx.hash,
  //   1
  // ); // 等待1个确认

  // console.log("部署交易收据：", deploymentReceipt);

  // 方法2：若需指定确认数（如 3 个区块）
  // const deploymentTxHash = await contract.getDeploymentTransaction(); // 获取部署交易哈希
  // if (deploymentTxHash) {
  //   // 等待 3 个确认（第2个参数为确认数）
  //   await provider.waitForTransaction(deploymentTxHash, 3);
  //   console.log("已确认 3 个区块");
  // }

  // 6. 获取合约地址
  // const contractAddress = await contract.getAddress();
  // console.log(`合约部署成功，地址：${contract}`);
}

deployContract()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("部署失败：", error);
    process.exit(1);
  });
