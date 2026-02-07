# 🌳 mindGit

<p align="center">
  <img src="assets/icons/icon128.png" alt="mindGit Logo" width="64" height="64">
</p>

<p align="center">
  <b>像思维导图一样记录和可视化你的网页浏览路径</b>
</p>

<p align="center">
  <a href="README.md">中文</a> | <a href="docs/README_EN.md">English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Extension-blue?style=flat-square&logo=google-chrome&logoColor=white">
  <img src="https://img.shields.io/badge/Manifest-V3-green?style=flat-square">
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square">
</p>

---

## 📖 简介

mindGit 是一个 Chrome 浏览器扩展，帮助你追踪和可视化网页之间的跳转关系。当你从网页 A 点击链接到网页 B，再到网页 C 时，mindGit 会以树形结构记录这个路径，让你轻松回溯浏览的脉络。

## ✨ 功能特点

### 🌲 树形结构可视化
- 清晰的树状图展示浏览路径
- 父子节点用连接线相连
- 支持展开/折叠子节点
- 不同层级有不同的视觉样式

### 📊 多会话管理
- 支持创建多个独立的浏览会话
- 区分不同的浏览任务（如工作、学习、娱乐）
- 自动命名会话，也可自定义名称

### 🌙 暗色模式
- 一键切换亮色/暗色主题
- 主题偏好自动保存
- 暗色模式配色护眼舒适

### ⚡ 智能记录
- 自动追踪页面跳转，无需手动操作
- 智能识别重复访问，自动合并节点
- 前进/后退操作正确处理

### 🎨 优雅的界面
- 现代化的卡片式设计
- 平滑的过渡动画
- 清晰的视觉层次

## 📦 安装指南

### 方法一：Chrome 应用商店（推荐）

> ⚠️ 当前版本尚未发布到 Chrome 应用商店，请先使用开发者模式安装。

### 方法二：开发者模式安装（本地安装）

#### 步骤 1：下载源码

```bash
# 使用 git 克隆
git clone https://github.com/RumiaLunnar/mindGit.git

# 或者下载 ZIP 文件
# 访问 https://github.com/RumiaLunnar/mindGit/archive/refs/heads/master.zip
```

#### 步骤 2：打开 Chrome 扩展管理页面

1. 打开 Chrome 浏览器
2. 在地址栏输入 `chrome://extensions/` 并回车
3. 或者在菜单中选择：更多工具 → 扩展程序

#### 步骤 3：开启开发者模式

在扩展管理页面右上角，找到并开启「**开发者模式**」开关：

```
┌─────────────────────────────────────────┐
│ 开发者模式 [开关按钮]                    │
└─────────────────────────────────────────┘
```

#### 步骤 4：加载扩展

1. 点击左上角的「**加载已解压的扩展程序**」按钮
2. 在弹出的文件选择器中，选择你下载的 `mindGit` 文件夹
3. 确保选择的是**包含 `manifest.json` 的文件夹**，而不是子文件夹

#### 步骤 5：验证安装

安装成功后：
- 页面会显示 `mindGit` 扩展卡片
- 浏览器工具栏会出现 🌳 图标
- 点击图标即可开始使用

### 方法三：拖拽安装（CRX 文件）

如果你已经下载了 `.crx` 文件：

1. 打开 `chrome://extensions/`
2. 开启开发者模式
3. 将 `.crx` 文件拖拽到扩展管理页面
4. 点击「添加扩展程序」确认

## 🚀 使用方法

### 开始记录

1. 点击工具栏的 🌳 图标打开 mindGit
2. 点击 ➕ 创建新会话（或自动使用当前会话）
3. 正常浏览网页，mindGit 会自动记录你的跳转路径
4. 随时点击图标查看当前的浏览树

### 界面说明

```
┌─────────────────────────────────────┐
│  🌳 mindGit    🌙 🔄 ➕ ⚙️          │  ← 头部：主题、刷新、新建、设置
├─────────────────────────────────────┤
│  [选择会话...]        🗑️            │  ← 会话选择器
├─────────────────────────────────────┤
│  📊 浏览会话 · 2个起点 · 5个页面    │  ← 统计信息
├─────────────────────────────────────┤
│  │                                  │
│  ├── 🌐 知乎首页                    │  ← 根节点（起点）
│  │   │                              │
│  │   ├── 📄 文章 A                  │  ← 子节点
│  │   │   └── 📄 相关推荐            │  ← 更深层级
│  │   │                              │
│  │   └── 📄 文章 B                  │
│  │                                  │
│  └── 🌐 GitHub                      │  ← 另一个起点
│      └── 📄 项目主页                │
├─────────────────────────────────────┤
│  [清空所有]  [全部展开] [全部折叠]  │  ← 底部操作栏
└─────────────────────────────────────┘
```

### 快捷键

| 操作 | 说明 |
|------|------|
| 点击节点 | 在新标签页打开链接 |
| 点击 ▼/▶ | 展开/折叠子节点 |
| 点击 🌙/☀️ | 切换暗色/亮色主题 |
| 点击 ↗️ | 在新标签页打开链接 |
| 点击 📋 | 复制链接地址 |

## 💡 使用场景

### 深度阅读
从知乎首页 → 文章 A → 相关推荐 → 深度内容 → ... 轻松回溯阅读路径

### 技术研究
查阅技术文档时的跳转路径：
```
Google 搜索
└── Stack Overflow 问题
    └── GitHub Issue
        └── 相关 PR
            └── 官方文档
```

### 购物比价
多个电商平台间的跳转记录，方便回溯比较

### 学习探索
维基百科的深入探索：
```
计算机科学
└── 算法
    ├── 排序算法
    │   └── 快速排序
    └── 数据结构
        └── 二叉树
```

## 🔒 隐私说明

- **本地存储**：所有数据存储在浏览器本地，不会上传到任何服务器
- **权限最小化**：仅请求必要的权限（标签页、存储、导航）
- **数据安全**：不会收集个人隐私信息

## 🛠️ 技术栈

- Chrome Extension Manifest V3
- JavaScript (ES6+)
- CSS3 (Flexbox、CSS Variables)
- Chrome Storage API
- Chrome Tabs API
- Chrome WebNavigation API

## 📁 项目结构

```
mindGit/
├── manifest.json              # 扩展清单配置
├── package.json               # 项目配置
├── .gitignore                 # Git 忽略配置
├── .editorconfig              # 编辑器配置
├── assets/                    # 静态资源
│   └── icons/                # 图标文件
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── src/                       # 源代码
│   ├── background/           # 后台脚本
│   │   └── index.js         # Service Worker
│   ├── popup/                # 弹出窗口
│   │   ├── index.html       # HTML 结构
│   │   ├── index.css        # 样式（支持暗色主题）
│   │   └── index.js         # 交互逻辑
│   └── shared/               # 共享模块（预留）
├── docs/                      # 文档
│   └── README_EN.md         # 英文文档
└── scripts/                   # 工具脚本（预留）
```

## 🔧 开发指南

### 本地开发

1. 克隆仓库
   ```bash
   git clone https://github.com/RumiaLunnar/mindGit.git
   cd mindGit
   ```

2. 在 Chrome 中加载扩展（开发者模式）

3. 修改代码后，在扩展管理页面点击刷新按钮重新加载

### 打包发布

```bash
# 使用 npm 脚本打包
npm run package

# 或者手动打包
zip -r mindgit-v1.0.0.zip assets/ src/ manifest.json README.md
```

## 🗓️ 开发计划

- [ ] 数据导出/导入（JSON/HTML）
- [ ] 搜索功能
- [ ] 图表视图（除树形外的其他布局）
- [ ] 时间线视图
- [ ] 笔记标注功能
- [ ] 快捷键支持

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 提交规范

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新
- `style:` 代码格式调整
- `refactor:` 重构

### 分支策略

- `master`：稳定版本分支
- `dev`：开发分支

## 📄 许可证

[MIT License](LICENSE)

## 🙏 致谢

灵感来源于思维导图和 Git 的版本控制概念，将浏览历史可视化为树形结构。

---

<p align="center">
  如果这个项目对你有帮助，欢迎给个 ⭐️ Star！
</p>

<p align="center">
  Made with ❤️ for better browsing experience.
</p>
