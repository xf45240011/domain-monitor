[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/xf45240011/my-domain-monitor)


# Cloudflare Worker 域名监控面板

这是一个运行在 Cloudflare Workers 上的轻量级域名监控工具。无需服务器，免费版套餐即可使用。
支持 D1 数据库存储、Gist/WebDAV 备份、定时自动检测。

## 预览
![截图](https://via.placeholder.com/800x400?text=域监控截图)

## 部署步骤

### 1. 准备工作
*   拥有一个 Cloudflare 账号。
*   拉取本仓库到你的 GitHub。

### 2. 创建数据库
1.  登录 Cloudflare 控制台，进入 **Workers & Pages** -> **D1 SQL 数据库**。
2.  点击 **创建**，创建一个新数据库，命名为 `domain-db`（或者其他你喜欢的名字）。
3.  创建成功后，复制 **数据库ID**（一串类似 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` 的字符）。
4.  点击数据库名称进入详情，选择 **控制台** 标签页。
5.  将项目中的 `schema.sql` 文件内容全选复制，粘贴到 Console 中并点击 **执行**，完成数据表初始化。

### 3. 配置项目
1.  在你的 GitHub Fork 项目中，打开 `wrangler.toml` 文件。
2.  找到 `database_id` 字段，将其修改为你刚才复制的 Database ID。
3.  提交更改 (Commit)。

### 4. 部署 Worker
1.  回到 Cloudflare 控制台，**Workers & Pages** -> **创建应用** -> **连接到 Git**。
2.  选择你刚才 Fork 的仓库。
3.  **构建设置**：
    *   不做修改，保持默认即可。
4.  点击 **保存并部署**。

### 5. 绑定与环境变量
部署完成后，进入该 Worker 的设置页面：

1.  **绑定数据库**：
    *   进入 **设置 (设置)** -> **绑定 (绑定)**。
    *   检查 `D1 数据库绑定`。如果自动识别了 `DB` 变量且连接正确，则无需操作。
    *   如果没有，请点击 Add -> 变量名填 `DB` -> 选择你的数据库。

2.  **设置登录密码**：
    *   进入 **设置 (设置)** -> **变量和机密 (变量和机密)**。
    *   点击 **添加**。
    *   变量名称: `PASSWORD`
    *   Value: `你的后台登录密码`
    *   点击 **加密并添加**。

### 6. 完成
点击 Worker 提供的 `*.workers.dev` 域名，输入密码即可开始使用！

## 功能
*   ➕ 批量添加域名
*   🔄 每天自动检测在线状态 (Cron Trigger)
*   📅 自动计算域名到期天数
*   💾 支持导出配置到 Github Gist 或 WebDAV

