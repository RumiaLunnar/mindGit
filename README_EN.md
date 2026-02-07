# 🌳 mindGit

Record and visualize your web browsing paths like a mind map.

## Introduction

mindGit is a Chrome extension that helps you track and visualize the navigation relationships between web pages. When you click from page A to page B, then to page C, mindGit records this path as a tree structure, making it easy to trace back your browsing journey.

## Features

### 🌲 Tree Structure Visualization
- Clear tree diagram showing browsing paths
- Parent-child nodes connected with visual lines
- Support expand/collapse for child nodes
- Different visual styles for different hierarchy levels

### 📊 Multi-Session Management
- Create multiple independent browsing sessions
- Separate different browsing tasks (work, study, entertainment)
- Auto-named sessions with custom naming option

### 🌙 Dark Mode
- One-click toggle between light/dark themes
- Theme preference auto-saved
- Eye-friendly dark color scheme

### ⚡ Smart Recording
- Automatic page navigation tracking
- Smart duplicate detection and node merging
- Proper handling of back/forward navigation

### 🎨 Elegant Interface
- Modern card-based design
- Smooth transition animations
- Clear visual hierarchy

## Installation

### Developer Mode Installation

1. Download or clone this repository
   ```bash
   git clone https://github.com/yourusername/mindGit.git
   ```

2. Open Chrome browser and visit `chrome://extensions/`

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked"

5. Select the `mindGit` folder

6. Once installed, the 🌳 icon will appear in your toolbar

## Usage

### Start Recording

1. Click the 🌳 icon in your toolbar to open mindGit
2. Click ➕ to create a new session (or use the current session automatically)
3. Browse normally, mindGit will automatically track your navigation path
4. Click the icon anytime to view your browsing tree

### Interface Guide

```
┌─────────────────────────────────────┐
│  🌳 mindGit    🌙 🔄 ➕ ⚙️          │  ← Header: Theme, Refresh, New, Settings
├─────────────────────────────────────┤
│  [Select Session...]  🗑️            │  ← Session Selector
├─────────────────────────────────────┤
│  📊 Browsing Session · 2 roots · 5  │  ← Statistics
├─────────────────────────────────────┤
│  │                                  │
│  ├── 🌐 Homepage                    │  ← Root Node (Starting point)
│  │   │                              │
│  │   ├── 📄 Article A               │  ← Child Node
│  │   │   └── 📄 Related Reading     │  ← Deeper level
│  │   │                              │
│  │   └── 📄 Article B               │
│  │                                  │
│  └── 🌐 GitHub                      │  ← Another starting point
│      └── 📄 Project Page            │
├─────────────────────────────────────┤
│  [Clear All] [Expand All] [Collapse]│  ← Bottom Actions
└─────────────────────────────────────┘
```

### Shortcuts

- **Click node**: Open link in new tab
- **Click ▼/▶**: Expand/Collapse child nodes
- **Click 🌙/☀️**: Toggle dark/light theme

## Use Cases

### Deep Reading
Homepage → Article A → Related recommendations → Deep content → ... Easily trace back your reading path

### Technical Research
Documentation browsing path:
```
Google Search
└── Stack Overflow Question
    └── GitHub Issue
        └── Related PR
            └── Official Docs
```

### Shopping Comparison
Track jumps between multiple e-commerce platforms for easy comparison

### Learning & Exploration
Wikipedia deep dive:
```
Computer Science
└── Algorithms
    ├── Sorting Algorithms
    │   └── Quick Sort
    └── Data Structures
        └── Binary Trees
```

## Privacy

- **Local Storage**: All data is stored locally in your browser, never uploaded to any server
- **Minimal Permissions**: Only requests necessary permissions (tabs, storage, navigation)
- **Data Security**: Does not collect any personal privacy information

## Tech Stack

- Chrome Extension Manifest V3
- JavaScript (ES6+)
- CSS3 (Flexbox, CSS Variables)
- Chrome Storage API
- Chrome Tabs API
- Chrome WebNavigation API

## Project Structure

```
mindGit/
├── manifest.json      # Extension configuration
├── background.js      # Background service worker
├── popup.html         # Popup window HTML
├── popup.css          # Styles (supports dark theme)
├── popup.js           # Popup window logic
├── icons/             # Icon resources
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── README.md          # Chinese documentation
└── README_EN.md       # English documentation
```

## Roadmap

- [ ] Data export/import (JSON/HTML)
- [ ] Search functionality
- [ ] Graph view (alternative layouts)
- [ ] Timeline view
- [ ] Note annotation feature
- [ ] Keyboard shortcuts

## Contributing

Issues and Pull Requests are welcome!

### Commit Convention

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation update
- `style:` Code formatting
- `refactor:` Refactoring

## License

MIT License

## Acknowledgments

Inspired by mind maps and Git's version control concept, visualizing browsing history as a tree structure.

---

If this project helps you, please give it a ⭐️ Star!

Made with ❤️ for better browsing experience.
