# mindGit - AI Agent Guide

## Project Overview

mindGit（浏览脉络追踪器）是一个 Chrome 浏览器扩展，以树形结构（思维导图形式）记录和可视化用户的网页跳转路径。当用户从网页 A 点击链接跳转到网页 B 时，扩展会自动记录这种父子关系，形成一棵浏览脉络树。

**核心功能：**
- 自动追踪网页跳转关系，无需手动操作
- 以树形结构可视化浏览历史
- 支持多会话管理（区分工作、学习等不同场景）
- 智能识别刷新操作，避免产生重复节点
- 支持亮色/暗色主题切换

## Technology Stack

- **Platform**: Chrome Extension Manifest V3
- **Language**: JavaScript (ES6+)
- **Styling**: CSS3 (CSS Variables, Flexbox)
- **Storage**: Chrome Storage API (`chrome.storage.local`)
- **APIs Used**:
  - `chrome.webNavigation` - 监听页面导航事件
  - `chrome.tabs` - 标签页管理
  - `chrome.runtime` - 消息传递

## Project Structure

```
mindGit/
├── manifest.json              # 扩展清单配置（V3）
├── package.json               # npm 配置（仅用于打包）
├── .editorconfig              # 编辑器配置（2空格缩进）
├── .gitignore                 # Git 忽略配置
├── assets/
│   └── icons/                 # 扩展图标（16/48/128px）
├── src/
│   ├── background/
│   │   └── index.js          # Service Worker - 核心追踪逻辑
│   ├── popup/
│   │   ├── index.html        # 弹出窗口 HTML
│   │   ├── index.css         # 样式（含暗色主题）
│   │   └── index.js          # UI 交互逻辑
│   └── shared/               # 共享模块（预留，当前为空）
└── docs/
    └── README_EN.md          # 英文文档
```

## Architecture

### 1. Background Script (Service Worker)

`src/background/index.js` 是扩展的核心，负责：

- **导航追踪**: 使用 `chrome.webNavigation.onCommitted` 监听页面跳转
- **类型识别**: 区分链接点击、刷新、地址栏输入等不同跳转类型
- **树构建**: 维护会话和节点数据，建立父子关系
- **消息处理**: 响应 popup 的各种操作请求

**关键数据结构：**
```javascript
// 存储在 chrome.storage.local 中的结构
{
  sessions: {
    [sessionId]: {
      id, name, startTime,
      rootNodes: [],      // 根节点ID数组
      allNodes: {}        // 所有节点的映射表
    }
  },
  currentSession: string,  // 当前会话ID
  tabToNode: {},           // 标签页ID到节点ID的映射
  tabParentMap: {},        // 标签页父子关系映射
  settings: {}             // 用户设置
}

// 节点结构
{
  id, url, title, favIconUrl,
  parentId, children: [],
  timestamp, visitCount
}
```

**导航处理逻辑：**
- `transitionType === 'reload'` - 刷新，不创建新节点
- `transitionType === 'link'` - 链接点击，创建子节点
- `transitionType === 'typed'` - 地址栏输入，创建根节点
- `chrome.tabs.onCreated` - 追踪新标签页的打开来源

### 2. Popup UI

`src/popup/` 包含扩展的用户界面：

- **index.html**: 定义了头部、会话选择器、树形容器、底部操作栏和两个模态框（设置、新建会话）
- **index.js**: 处理用户交互、消息通信、树渲染
- **index.css**: 使用 CSS Variables 实现主题切换，定义了树形结构和连接线样式

**消息通信示例：**
```javascript
// Popup 向 Background 请求数据
chrome.runtime.sendMessage({ action: 'getSessions' })
chrome.runtime.sendMessage({ action: 'getSessionTree', sessionId })
chrome.runtime.sendMessage({ action: 'createNewSession', name })
chrome.runtime.sendMessage({ action: 'deleteSession', sessionId })
chrome.runtime.sendMessage({ action: 'clearAllSessions' })
chrome.runtime.sendMessage({ action: 'openUrl', url })
```

## Development Workflow

### 本地开发

1. **加载扩展：**
   - 打开 Chrome，访问 `chrome://extensions/`
   - 开启「开发者模式」
   - 点击「加载已解压的扩展程序」
   - 选择项目根目录（包含 manifest.json 的文件夹）

2. **代码修改：**
   - 修改代码后，在扩展管理页面点击刷新按钮重新加载
   - 无需构建步骤，直接编辑原生 JS/CSS/HTML

3. **调试：**
   - Background Script: 点击「Service Worker」链接打开 DevTools
   - Popup: 右键点击扩展图标 → 「检查弹出内容」

### 打包发布

```bash
# 使用 npm 脚本打包（包含版本号）
npm run package

# 输出: mindgit-v1.0.0.zip
```

## Code Style Guidelines

### EditorConfig
- 字符集: UTF-8
- 换行符: LF
- 缩进: 2 个空格
- 文件末尾插入空行
- 去除行尾空格

### JavaScript 规范
- 使用 ES6+ 语法（async/await、箭头函数、解构等）
- 使用单引号 for strings
- 函数注释使用中文（项目主要语言）
- 控制台日志使用 `[mindGit]` 前缀便于识别

### CSS 规范
- 使用 CSS Variables 定义主题颜色
- 亮色主题: `:root` 定义
- 暗色主题: `[data-theme="dark"]` 覆盖
- 使用 Flexbox 进行布局

## Key Implementation Details

### 1. 刷新检测
通过检查 `transitionType === 'reload'` 来识别页面刷新，避免创建重复节点：
```javascript
if (transitionType === 'reload') {
  // 只更新时间戳，不创建新节点
  node.timestamp = Date.now();
}
```

### 2. 新标签页追踪
通过 `transitionQualifiers` 中的 `from_${tabId}` 识别从哪个标签页打开：
```javascript
const fromQualifier = transitionQualifiers?.find(q => q.startsWith('from_'));
if (fromQualifier) {
  const fromTabId = parseInt(fromQualifier.replace('from_', ''));
  // 建立父子关系
}
```

### 3. 单页应用支持
监听 `onHistoryStateUpdated` 处理 SPA 的路由变化：
```javascript
chrome.webNavigation.onHistoryStateUpdated.addListener(...)
```

### 4. 主题切换
通过设置 `data-theme` 属性切换 CSS Variables：
```javascript
document.documentElement.setAttribute('data-theme', 'dark');
```

## Testing Strategy

**当前状态：** 项目尚无自动化测试。

`package.json` 中的 test 脚本为占位符：
```json
"test": "echo 'Test script placeholder - 未来可以添加测试'"
```

**手动测试清单：**
1. 安装扩展后正常浏览网页，检查是否正确记录
2. 点击链接、新标签页打开、地址栏输入等不同方式跳转
3. 刷新页面不应产生新节点
4. 切换会话功能
5. 主题切换和持久化
6. 设置保存和生效

## Permissions

扩展请求的权限（`manifest.json`）：
- `tabs` - 访问标签页信息
- `storage` - 本地数据存储
- `webNavigation` - 监听导航事件
- `activeTab` - 访问当前标签页
- `host_permissions: <all_urls>` - 追踪所有网址

**URL 过滤：** 代码中排除了以下前缀的 URL：
- `chrome://`
- `chrome-extension://`
- `devtools://`
- `file://`
- `about:`, `javascript:`, `data:`

## Known Limitations

1. 数据仅存储在本地，不支持跨设备同步
2. 单会话最大节点数限制为 500（可在设置中调整）
3. 最大会话数限制为 50（自动清理旧会话）
4. 不支持导出/导入数据（计划中功能）

## Future Enhancements

根据 README 中的开发计划：
- [ ] 数据导出/导入（JSON/HTML）
- [ ] 搜索功能
- [ ] 图表视图（除树形外的其他布局）
- [ ] 时间线视图
- [ ] 笔记标注功能
- [ ] 快捷键支持
