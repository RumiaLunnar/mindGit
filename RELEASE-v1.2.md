# MindGit v1.2.0 Release Notes

## 🎉 新功能

### 🔍 搜索功能
- 弹窗式搜索界面，支持搜索会话名称和节点标题/URL
- 搜索结果高亮定位，点击直接跳转
- 支持键盘导航（↑↓/回车/ESC）

### 📤 会话导出
- 支持导出为 Markdown 格式（纯文本，适合笔记软件）
- 支持导出为 HTML 格式（可用浏览器打开）
- 弹窗格式选择，界面友好

### 📁 会话列表优化
- 默认折叠会话列表，节省空间
- 点击标题可展开/折叠

### ✏️ 重命名会话改进
- 改为统一的弹窗形式
- 与新建会话保持一致的体验
- 支持回车确认和 ESC 关闭

## 🌐 多语言支持
- 完善英语翻译，所有功能都支持中英文
- 更新日志移到 README 顶部

## 🔧 技术改进
- 智能综合排序算法优化
- 代码架构重构，提高可维护性

## 📁 下载

### 源码下载
```bash
git clone https://github.com/RumiaLunnar/mindGit.git
git checkout v1.2
```

### 打包文件
```bash
npm run package
# 或者手动打包
zip -r mindgit-v1.2.0.zip assets/ src/ manifest.json README.md
```

## 🔄 安装方法

1. 下载 `mindgit-v1.2.0.zip` 或克隆源码
2. 打开 Chrome，访问 `chrome://extensions/`
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择 mindGit 文件夹

## 📝 版本信息

- **版本号**: v1.2.0
- **发布日期**: 2025-02-10
- **Chrome Manifest**: V3
- **支持语言**: 中文、英文

---

**完整文档**: [README.md](README.md)

**问题反馈**: [GitHub Issues](https://github.com/RumiaLunnar/mindGit/issues)
