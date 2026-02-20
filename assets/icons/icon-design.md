# MindGit 图标设计说明

## 设计理念
融合了 **浏览器窗口** 和 **Git 分支结构** 的概念

## 元素组成
1. **浏览器窗口** - 圆角矩形外框，顶部有三个控制按钮
2. **Git 分支** - 窗口内部的节点和连接线，表示浏览脉络
3. **节点** - 白色圆点代表页面节点
4. **小叶子** - 右上角的绿色叶子装饰

## 颜色
- 主色：#5a9fd4 （Chrome 蓝）
- 深色：#4a8fc4 （标题栏）
- 节点：白色
- 装饰：#a8d5ba （淡绿）

## 文件列表
- `icon.svg` - 向量源文件
- `icon16.png` - 16x16 扩展图标
- `icon48.png` - 48x48 扩展图标  
- `icon128.png` - 128x128 扩展图标/应用商店

## 生成 PNG 图标
使用以下工具将 SVG 转换为 PNG：

### 方法一：在线工具
1. 访问 https://convertio.co/svg-png/ 或 https://cloudconvert.com/svg-to-png
2. 上传 `icon.svg`
3. 下载 16x16, 48x48, 128x128 三种尺寸

### 方法二：命令行 (ImageMagick)
```bash
# 安装 ImageMagick
# macOS: brew install imagemagick
# Ubuntu: sudo apt install imagemagick

# 生成各尺寸
convert -background none icon.svg -resize 16x16 icon16.png
convert -background none icon.svg -resize 48x48 icon48.png
convert -background none icon.svg -resize 128x128 icon128.png
```

### 方法三：Node.js (sharp)
```bash
npm install sharp
```

```javascript
const sharp = require('sharp');
const fs = require('fs');

const svg = fs.readFileSync('icon.svg');

[16, 48, 128].forEach(size => {
  sharp(svg)
    .resize(size, size)
    .png()
    .toFile(`icon${size}.png`)
    .then(() => console.log(`生成 icon${size}.png`));
});
```

## 预览效果
```
├──────────────┐
│ ● ● ●        │  ← 标题栏按钮
├──────────────┤
│                  │
│     ●──●     🜱 │  ← Git 分支结构
│      \          │
│       ●         │
└──────────────┘
      ↑
   浏览器窗口
```
