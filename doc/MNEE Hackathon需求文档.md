# PRD（最终版，前端全站）— MeneeMart: Pay-to-Decrypt Web3 Marketplace (Mainnet-ready)
背景
我们参加 MNEE Hackathon，需要在产品中使用 Ethereum Mainnet 上的 MNEE 合约完成支付/交互展示。合约侧由 Hema 用 Foundry实现。
**版本**：vFinal (Hackathon Grand-Prize Focus)
**范围声明**：仅包含 **前端/全站与最小 serverless 上传能力**；**合约已完成**，不得新增/修改合约接口。
**目标**：最大化拿奖概率（可展示、可验证、亮点强、证据链完整）。([Pinata][1])

---

## 1. 核心目标与评审对齐

### 1.1 目标一句话（Pitch）

**“用 MNEE 稳定币购买数字内容，购买后才能通过 Lit Protocol 解密下载（Pay-to-Decrypt），并在以太坊主网完成合规证明。”**

### 1.2 评审维度对齐（必须写进提交材料 & Demo）

* **Technological Implementation**：MNEE 支付 + 合约购买状态 + Lit 条件解密 + IPFS RootCID 目录结构。([Pinata][1])
* **Design / UX**：钱包交互极简（Approve→Buy→Decrypt→Download），暗黑模式、loading/toast、失败可恢复。
* **Impact / Usefulness**：解决“IPFS 链接公开导致盗版”这一 Web3 常见痛点。
* **Originality**：不是普通 marketplace，而是“支付即解密”的内容保护工作流。
* **Solves Real Coordination Problems**：支持 creator team 用 Safe/Splits 做共同收款与分账（无需改合约）。([Pinata][1])

---

## 2. 拳头亮点（评委一眼记住）

1. **主网合规证据链**：在 Ethereum Mainnet 上完成一次真实流程（至少 1 个商品上架 + 1 次购买），且使用官方 MNEE 合约地址（规则给出）。([Pinata][1])
2. **Pay-to-Decrypt（Lit）**：文件先加密再上 IPFS，只有链上购买者能从 Lit 网络拿到解密能力（需要 Capacity Credits / delegation）。([Lit Protocol][2])
3. **RootCID 目录打包**：`/metadata.json + /cover.png + /asset.enc` 同一根目录 CID，审计/迁移/展示都优雅。
4. **无数据库、最小 serverless**：不做传统后端与 DB；但为了安全上传，Pinata JWT 必须在 serverless 环境处理（官方也强调 JWT 是 secret，客户端上传应考虑 signed JWT）。([Pinata Docs][3])
5. **Gas 成本策略**：主网只做“纪念商品”与“纪念购买”，其余高频演示都在 Sepolia mock 环境录屏。
6. **Creator Team 协作分账**：卖家可用 Safe / Split 合约地址作为“收款主体”，提现后自动分配（展示“协调问题解决”，但不改 MneeMart）。

---

## 3. 范围（Scope）

### 3.1 必做（P0）

* Web 前端全站（4 页面 + 状态与错误处理）
* IPFS 上传（Pinata）+ RootCID 目录打包
* Lit 加密/解密下载（Pay-to-Decrypt）
* 合约交互（Sepolia + Mainnet 环境切换）
* Demo 模式（一键加载示例商品、演示路径）

### 3.2 应做（P1：强烈建议）

* 事件/日志驱动的“交易成功”确认（监听 `ProductPurchased`）
* Multi-call / 批量读取优化（减少 RPC 次数）
* Creator Team 收款引导（Safe / Splits 地址说明页 + UI 提示）

### 3.3 不做（明确排除）

* 改合约、加合约接口、加新合约（除非你们另起 repo，但本 PRD 不包含）
* 中心化用户系统/数据库
* 复杂搜索/推荐/评论系统

---

## 4. 已冻结的合约接口（ABI 约束，前端必须遵守）

> **注意：前端不得假设存在 `getAllProducts()` / `createProduct()` / `buyProduct()`。**

### 4.1 Marketplace 合约（MneeMart）

前端只使用以下已存在函数：

* `listProduct(string _cid, uint256 _price, string _name) -> uint256`
* `purchaseProduct(uint256 _productId)`
* `productCounter() -> uint256`
* `products(uint256) -> (id, seller, cid, price, name, active, salesCount)`
* `hasUserPurchased(address _user, uint256 _productId) -> bool`
* `getSellerProducts(address _seller) -> uint256[]`
* `getProductCID(uint256 _productId) -> string`（**仅做“已购用户读取”的体验增强，不依赖它保密**）
* 事件：`ProductListed / ProductPurchased / ProductPriceUpdated / ProductActivated / ProductDeactivated`

### 4.2 支付代币（MNEE / MockMNEE）

前端使用标准 ERC20：`approve / allowance / balanceOf / decimals / symbol` 等。

---

## 5. 数据与存储规范（RootCID 目录结构）

### 5.1 RootCID 目录内容（强制）

一个商品对应一个 IPFS 目录（RootCID）：

```
/metadata.json
/cover.png          (或 .jpg/.webp)
/asset.enc          (加密后的数字内容)
/asset.json         (可选：文件类型、大小、sha256 等)
```

* `listProduct(_cid, ...)` 里的 `_cid` = **RootCID**（不是 metadataCID）
* 前端拉取 metadata：`<gateway>/ipfs/<RootCID>/metadata.json`

### 5.2 metadata.json（建议规范）

```json
{
  "schema": "meneemart.v1",
  "title": "Web3 Ebook Vol.1",
  "shortName": "Ebook V1",
  "description": "…",
  "cover": "ipfs://<RootCID>/cover.png",
  "encryptedAsset": "ipfs://<RootCID>/asset.enc",
  "mimeType": "application/pdf",
  "sizeBytes": 123456,
  "lit": {
    "encryptedSymmetricKey": "…",
    "accessControlConditions": [ /* EVM 条件：hasUserPurchased == true */ ],
    "chain": "ethereum"
  }
}
```

> 合约里也有 `name` 字段，因此建议：
>
> * 合约 `name`：短标题（用于列表与链上展示）
> * metadata `title/description`：富文本内容（用于详情页）

---

## 6. Lit Protocol：支付即解密（Pay-to-Decrypt）

### 6.1 关键点

* 文件在浏览器端加密后再上传 IPFS（明文永不上链/不上网关）
* Lit 网络执行“解密权限判断”，需要 **Capacity Credits**（并可用 delegation 授权给应用）。([Lit Protocol][2])

### 6.2 Access Control Conditions（EVM 条件）

使用 Lit 的 EVM 合约条件：

* 合约：MneeMart 合约地址
* 方法：`hasUserPurchased(address,uint256)`
* 参数：`userAddress` + `productId`
* 期望返回：`true`

（这与 ABI 完全兼容）

### 6.3 成本与风险控制

* Lit 的解密/执行请求属于付费能力（Capacity Credits），要在 Demo 前准备好可用 credits，并通过 delegation 给 dApp 使用。([Lit Protocol][2])
* **降级策略（只在极端情况启用）**：如果 Lit 网络不可用，Sepolia 演示仍可走“已购显示下载按钮但提示暂不可解密（网络问题）”，主网演示以“证据链为主”。

---

## 7. Pinata / IPFS 上传：安全与实现方式

### 7.1 为什么必须有“最小 serverless”

Pinata 文档明确：`pinataJwt` 属于 **secret**，需要在安全环境初始化；如果要从客户端上传，应考虑 **signed JWT**。([Pinata Docs][3])

因此采用：

* Next.js Route Handler：`POST /api/pinata/signed-jwt`（只负责签发短期 signed JWT）
* 客户端拿到短期 JWT 后直接上传文件到 Pinata（避免把长期 JWT 暴露在浏览器）

> 这不算传统“后端服务 + DB”，属于“安全边界最小化”的 serverless。

### 7.2 上传步骤（卖家发布）

1. 选择文件与封面
2. Lit 加密生成 `asset.enc` + `encryptedSymmetricKey`
3. 上传目录（或依次上传并组装目录）得到 RootCID
4. 生成 `metadata.json` 并写入目录
5. 最终拿到 RootCID → 调用 `listProduct(RootCID, price, name)`

---

## 8. 前端页面与交互（必须丝滑）

### P0：Marketplace（首页）

* 数据来源：

  * `counter = productCounter()`
  * for i in 1..counter：读取 `products(i)`（包含 `cid/price/name/active`）
* 对每个 active 商品：拉取 `metadata.json` 展示封面、描述摘要
* UI：Grid 卡片 + Skeleton + 错误重试

### P0：Product Detail（详情页）

* 展示：封面、长描述、价格（MNEE）、seller、salesCount
* 购买按钮状态机：

  1. 未连接钱包 → Connect
  2. 已连接但 allowance 不足 → Approve（ERC20 approve）
  3. allowance 足够 → Buy（purchaseProduct）
  4. 已购买 → Decrypt & Download（Lit）

### P0：Create Product（发布页）

* 表单：Name（对应合约 name）、Price（MNEE）、Description、Cover、File
* 提交：上传→RootCID→链上 `listProduct`
* 发布成功后自动跳转到详情页

### P1：Profile（我的）

* My Listings：`getSellerProducts(myAddress)` → products(id)
* My Purchases：遍历商品，用 `hasUserPurchased(myAddress, id)` 过滤

---

## 9. 多环境与“省钱上主网”策略（冲大奖关键）

### 9.1 环境切换

* `.env` 分离：

  * `NEXT_PUBLIC_CHAIN=sepolia|mainnet`
  * `NEXT_PUBLIC_MART_ADDRESS`
  * `NEXT_PUBLIC_MNEE_ADDRESS`
  * `PINATA_*`
  * `LIT_CAPACITY_CREDIT_TOKEN_ID` 等

### 9.2 主网最小交互（合规证明）

* 主网只做：

  1. 上架 1 个“纪念商品”（小文件、低价格）
  2. 用另一钱包购买 1 次
* 其余演示（多商品、完整流程、丝滑录屏）全部在 Sepolia mock 环境完成
* 提交材料里同时给：Sepolia demo + Mainnet 交易 hash（证据链）

### 9.3 MNEE 地址（提交材料必须写）

规则页提供 MNEE 合约地址（主网）。([Pinata][1])

---

## 10. Creator Team 协作分账（不改合约的“协调问题”亮点）

**做法**：让卖家使用 **Safe / Split 合约地址**作为“收款主体”（即用该地址去上架商品、提现）。

* 这样 `withdrawSellerBalance()` 把收入转给 Safe/Split，后续分配由 Safe/Split 自己完成。
* 前端做的事：

  * 发布页提示“如果你是团队，建议用 Safe/Split 地址发布与收款”
  * Profile 页展示 seller 地址类型说明（EOA vs Safe）

> 这点在答辩里非常好讲：**用已有原语解决“多人共创/分账”的协调问题**。([Pinata][1])

---

## 11. 验收标准（研发自测清单）

1. Sepolia：从 0 到 1 跑通：发布 → Approve → 购买 → hasUserPurchased=true → Lit 解密下载成功
2. RootCID 目录结构正确：网关可直接访问 `metadata.json` 与 `cover`
3. 主网：至少完成 1 次上架 + 1 次购买，并在 UI 中能展示交易链接/状态
4. 不泄露 Pinata 长期 JWT（只存在 serverless 环境变量）([Pinata Docs][3])
5. UI：断网/失败/拒签名都有明确提示与重试路径

---

## 12. Demo 叙事脚本（冲大奖用）

* 15s：痛点（IPFS 公开链接=盗版）
* 30s：Sepolia 丝滑流程（Pay with MNEE → Pay-to-Decrypt）
* 15s：展示 Lit 条件（hasUserPurchased）
* 15s：展示主网交易 hash（合规证明）
* 15s：Creator team 分账（Safe/Splits）强调“协调问题”

==============


变量名 (代码中的 Key),🟢 现在 (开发/测试阶段),🔴 上线前 (1月10日左右),谁负责提供？
1. 商城合约地址NEXT_PUBLIC_MNEEMART_ADDRESS,0x... (测试版)(等 Hema 重新给你正确的),0x... (正式版)(Hema 到时候会重新部署),👩‍💻 Hema(因为是她写的代码)
2. MNEE 代币地址NEXT_PUBLIC_MNEE_ADDRESS,0x... (假币 Mock)(等 Hema 重新给你正确的),0x8cc...fd6cf(官方真币，不需要她给),现在: 👩‍💻 Hema未来: 🌐 官方公开
3. 区块链节点NEXT_PUBLIC_RPC_URL,https://...sepolia...(Alchemy Sepolia 链接),https://...mainnet...(Alchemy Mainnet 链接),🫵 你自己(去 Alchemy 后台新建)
4. 钱包连接 IDNEXT_PUBLIC_WALLETCONNECT_ID,你的 Reown ID,你的 Reown ID (不变),🫵 你自己
5. IPFS 密钥PINATA_JWT,你的 Pinata Key,你的 Pinata Key (不变),🫵 你自己