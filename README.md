# AI 视频概要分析工具 (AI Video Summary & Analysis)

一个基于 Cloudflare Pages 的现代 Web 应用，利用多模态（比如： Gemini 2.5 Flash Lite）大模型对视频内容进行智能分析、提取摘要并推荐标题。

该项目采用"即用即焚"的设计理念，注重用户隐私，仅在 Cloudflare KV 中记录匿名使用统计。


## ✨ 特性

- **⚡️ 极速体验**: 基于 Cloudflare Edge 网络，全球极速访问。
- **🔒 隐私安全**: 视频音频在浏览器端提取（FFmpeg.wasm），仅音频数据被发送至后端分析，分析完成后立即销毁。
- **📂 多格式支持**: 支持 MP4, MOV, AVI 等常见视频格式。
- **🧠 智能分析**: 集成 Gemini 2.5 Flash Lite 多模态大模型，精准提取核心内容。
- **🎨 现代 UI**: 极致细腻的**新拟物化 (Neumorphism)** 设计，支持点击复制推荐标题。
- **🎵 页面背景音乐**: 可选配置首页 BGM（将 MP3 放入 `public/bgm.mp3`），支持进入页面时尝试自动播放与播放/暂停控制；若浏览器拦截自动播放，用户点击一次即可开启。
- **📊 实时统计**: 简单的全站累计使用量统计。

## 🛠 技术栈

- **前端**: Vite + Vanilla TypeScript + CSS3
- **核心处理**: FFmpeg.wasm (浏览器端音频提取)
- **后端/托管**: Cloudflare Pages + Functions (Serverless)
- **AI 引擎**: Google Gemini 2.5 Flash Lite (Via API)
- **数据库**: Cloudflare KV (用于简单的计数统计)
- **Markdown 渲染**: marked

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/your-username/video-summary-analysis.git
cd video-summary-analysis
npm install
```

### 2. 配置环境

本项目依赖 Cloudflare Wrangler 进行开发和部署。

**A. 创建 KV 命名空间 (必选):**
```bash
npx wrangler kv namespace create STATS_KV
```
执行后终端会输出一串 ID，请将该 `id` 填入 `wrangler.toml` 中的 `[[kv_namespaces]]` 部分。

**B. 配置 API 连接 (必选):**
为了保护 API 安全，本项目**不包含默认配置**，您必须配置以下 3 个环境变量/Secret：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `GEMINI_API_KEY` | 您的 Gemini API 密钥 | `sk-xxxxxx` |
| `GEMINI_BASE_URL` | Gemini 兼容 API 地址 | `https://generativelanguage.googleapis.com/v1beta` |
| `GEMINI_MODEL_NAME` | 模型名称 | `gemini-2.5-flash-lite` |

**本地开发配置方式:**
在项目根目录创建 `.dev.vars` 文件 (该文件已被 `.gitignore` 忽略)：
```bash
GEMINI_API_KEY=your_key
GEMINI_BASE_URL=https://your-api-endpoint/v1beta
GEMINI_MODEL_NAME=gemini-2.5-flash-lite
```

### 3. 本地运行

```bash
npm run dev      # 启动前端开发服务器 (仅前端)
# 或者
npx wrangler pages dev dist # 启动完整的 Pages + Functions 模拟环境 (推荐)
```

### 4. 部署到 Cloudflare Pages (开源用户指南)

您可以选择使用 CLI 部署，或者连接 GitHub 自动部署。

#### 方式一：使用 CLI 命令部署
1. 构建项目：
   ```bash
   npm run build
   ```
2. 部署并创建项目：
   ```bash
   npx wrangler pages deploy dist
   ```
   *跟随提示输入项目名称 (如 `video-summary-analysis`) 并选择生产分支 (通常为 `main`)。*

3. **关键步骤**：设置线上环境变量
   使用命令设置 Secret（推荐用于 API Key）：
   ```bash
   npx wrangler pages secret put GEMINI_API_KEY
   npx wrangler pages secret put GEMINI_BASE_URL
   npx wrangler pages secret put GEMINI_MODEL_NAME
   ```
   *或者在 Cloudflare Dashboard -> Pages -> Settings -> Environment variables 中手动添加。*

4. **关键步骤**：绑定 KV
   *  登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
   *  进入 **Workers & Pages** -> 选择您的项目 -> **Settings** -> **Functions**
   *  找到 **KV namespace bindings** -> 点击 **Add binding**
   *  **Variable name** 填 `STATS_KV`，**KV namespace** 选择您在第2步创建的那个空间。
   *  保存配置并**重新部署** (Retry deployment) 以生效。

#### 方式二：连接 GitHub 自动部署（推荐方案）
这是最推荐的方式，配置一次后，您只需 `git push` 即可自动同步更新线上版本。

1. **Fork & Sync**: Fork 本项目到您的 GitHub 账号。
2. **创建项目**:
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
   - 点击 **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**。
   - 选择您 Fork 的 `classic-video-summary-analysis-tools-base-on-CF-pages` 仓库。
3. **构建配置 (Build Settings)**:
   - **Framework preset**: `Vite` (如果没有自动识别，请选择 `None`)。
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/`
4. **环境变量与配置 (必须配置)**:
   - 进入项目页面 -> **Settings** -> **Environment variables**。
   - 添加以下变量（详见前文“配置环境”部分）：`GEMINI_API_KEY`, `GEMINI_BASE_URL`, `GEMINI_MODEL_NAME`。
5. **绑定 KV 命名空间 (必须配置)**:
   - 进入 **Settings** -> **Functions** -> **KV namespace bindings**。
   - 点击 **Add binding**：
     - **Variable name**: `STATS_KV`
     - **KV namespace**: 选择您预先创建好的 KV。
6. **兼容性配置**:
   - 进入 **Settings** -> **Functions** -> **Compatibility flags**。
   - 建议确保 **Compatibility date** 为最新，或至少在 `2024-01-01` 之后。
7. **重新部署**:
   - 修改完以上设置后，返回 **Deployments** 页面，点击最新的部署右侧的 `...` -> **Retry deployment**。

> **💡 技术提示**: 本项目已包含 `vite.config.ts`，它自动处理了浏览器端的 `SharedArrayBuffer` 安全隔离头 (COOP/COEP) 以及 FFmpeg Worker 的依赖排除，确保在 Pages 环境下能够直接运行。

## 📂 目录结构

```
├── functions/       # Cloudflare Pages Functions (后端 API)
│   └── api/
│       ├── summary.ts  # AI 分析核心逻辑
│       └── stats.ts    # 统计接口
├── src/             # 前端源代码
│   ├── main.ts      # 核心交互逻辑 (FFmpeg, UI Update)
│   └── style.css    # 样式文件
├── public/          # 静态资源
│   ├── _headers     # 跨域隔离配置 (SharedArrayBuffer 支持)
│   └── bgm.mp3      # 可选：页面背景音乐，放置后标题旁显示歌名/作词人信息与播放按钮
└── wrangler.toml    # Cloudflare 配置文件
```

**页面背景音乐（可选）**：将 MP3 命名为 `bgm.mp3` 放入 `public/` 即可。页面加载时会尝试自动播放；若被浏览器拦截，用户点击播放按钮或页面任意处后可播放。歌名、作词人等展示可在 `index.html` 的 `.bgm-info` 区域修改。

## 🤝 贡献

欢迎提交 Issue 或 Pull Request 来改进这个项目！

## 📄 许可证

MIT License

