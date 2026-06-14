# 英语训练器 (English Trainer)

基于 AI 的英语输入→输出训练系统。自动从你的 Obsidian 英语笔记中提取词汇、表达和句型，由 DeepSeek AI 生成个性化练习，通过间隔重复帮你从「认识」到「会用」。

## 核心理念

你负责收集英语素材（词汇、短语、句型），AI 负责生成练习、评估回答、追踪进度。训练从识别 → 回忆 → 造句 → 自由表达，逐步提升。

## 功能

- **📚 语料库管理** — 自动解析 Obsidian markdown 笔记，提取英语学习项（词 / 表达 / 句型）
- **🏋️ 智能训练** — 基于精通度的五级训练模式（识别 → 回忆 → 控制产出 → 引导产出 → 自由产出）
- **🤖 AI 驱动** — DeepSeek API 生成练习题目、评估回答质量、提供改进建议
- **📊 进度追踪** — 连续天数、准确率、已掌握项目数、能力变化可视化
- **🔄 自动同步** — 监听 Obsidian 文件夹，笔记更新自动导入

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + Vite 5 + Tailwind CSS + React Router |
| 后端 | Express.js (端口 3456) |
| 数据库 | SQLite (sql.js) |
| AI | DeepSeek API (deepseek-chat) |
| 文件监听 | chokidar |

## 快速开始

### 1. 安装依赖

```bash
npm run setup
```

### 2. 配置 API Key

启动后打开 http://localhost:3456 ，进入「设置」页面，填入你的 DeepSeek API Key。

> 获取 API Key：https://platform.deepseek.com

### 3. 启动

**开发模式（前后端热更新）：**
```bash
npm run dev
```

**仅启动服务器：**
```bash
npm run server
# 或双击 start.bat
```

### 4. 配置 Obsidian 路径

在设置页面中，将「Obsidian 文件夹路径」指向你存放英语笔记的文件夹。系统会自动扫描并导入内容。

## 训练模式说明

| 等级 | 模式 | 说明 |
|------|------|------|
| 0-1 | 识别 | 选择题，理解含义 |
| 2-3 | 回忆 | 看中文写英文 |
| 4 | 控制产出 | 翻译句子 |
| 5 | 引导产出 | 基于个人经历表达 |
| 6+ | 自由产出 | 开放式表达 |

## 项目结构

```
english-trainer/
├── client/                # React 前端
│   ├── src/
│   │   ├── pages/         # Home, Training, Settings, Corpus
│   │   └── components/    # TaskCard, FeedbackPanel, MasteryBadge 等
│   └── package.json
├── server/                # Express 后端
│   ├── routes/            # corpus, training, progress, settings API
│   ├── db.js              # SQLite 数据库
│   ├── ai-service.js      # DeepSeek API 集成
│   ├── training-engine.js # 训练课程生成算法
│   ├── parser.js          # Markdown 解析器
│   └── watcher.js         # 文件监听器
├── data/                  # 数据库文件
├── test-data/             # 示例 Obsidian 笔记
└── package.json
```

## 注意事项

- 首次使用需要在设置页面配置 DeepSeek API Key
- Obsidian 笔记建议使用中文标题分类（如「核心词汇」「高频短语」「实用句式」）
- `test-data/` 中有示例笔记文件可参考格式
