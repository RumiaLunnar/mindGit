# MindGit

类似思维导图的浏览记录 Chrome 扩展

## 功能

- **树形可视化** - 记录网页跳转路径，清晰展示浏览脉络
- **多会话管理** - 创建独立会话区分不同任务
- **云端同步** - 通过 GitHub Gist 多设备同步
- **快捷键支持** - 方向键/筜建盘导航节点
- **搜索定位** - 快速搜索会话和节点
- **数据导出** - 支持 Markdown 和 HTML 格式
- **暗色模式** - 护眼配色主题

## 安装

1. 下载 `mindgit-v1.3.zip` 并解压
2. Chrome 访问 `chrome://extensions/`
3. 开启右上角"开发者模式"
4. 点击"加载已解压的扩展"，选择解压文件夹

## 快捷键

| 快捷键 | 功能 |
|---------|------|
| `/` / `Ctrl+K` | 搜索 |
| `?` | 帮助 |
| `N` | 新建会话 |
| `S` | 设置 |
| `↑↓` / `JK` | 节点导航 |
| `←→` / `HL` | 折叠/展开 |
| `Enter` | 打开链接 |
| `E` / `C` | 展开/折叠全部 |

## 云端同步

1. GitHub Settings → Developer settings → Personal access tokens → Generate new token
2. 勾选 `gist` 权限，生成 token
3. MindGit 设置面板输入 token 验证
4. 点击顶部☁️ 按钮手动同步，或等待启动时自动检查

## 开发

```bash
git clone https://github.com/RumiaLunnar/mindGit.git
cd mindGit
```

## 更新日志

### v1.3
- 云端同步（GitHub Gist）
- 快捷键支持
- 节点拖拽排序

### v1.2
- 搜索功能
- 会话导出
- 时间线视图

### v1.1
- 多会话管理
- 深色模式

### v1.0
- 初始版本

## License

MIT
