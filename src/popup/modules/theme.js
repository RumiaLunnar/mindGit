// theme.js - 主题管理

import { state } from './state.js';
import { getStorage, setStorage } from './api.js';

// 主题配置
const THEME_CONFIG = {
  default: {
    name: '默认蓝',
    primary: '#4a90d9',
    primaryHover: '#357abd',
    bg: '#f5f7fa',
    card: '#ffffff'
  },
  morandi: {
    name: '莫兰迪',
    primary: '#9ca8b8',
    primaryHover: '#8a96a6',
    bg: '#f2f0ed',
    card: '#faf9f7'
  },
  forest: {
    name: '森林绿',
    primary: '#6b9080',
    primaryHover: '#5a7d6e',
    bg: '#f1f4f1',
    card: '#f7f9f7'
  },
  ocean: {
    name: '海洋蓝',
    primary: '#5d8aa8',
    primaryHover: '#4a7593',
    bg: '#f0f4f7',
    card: '#f7fafc'
  },
  warm: {
    name: '暖阳橙',
    primary: '#c9a87c',
    primaryHover: '#b8986c',
    bg: '#f7f4f0',
    card: '#faf8f5'
  },
  dark: {
    name: '暗色模式',
    primary: '#5c9ce6',
    primaryHover: '#4a8bd4',
    bg: '#1a1d23',
    card: '#252830'
  }
};

/**
 * 加载主题设置（统一入口）
 */
export async function loadTheme() {
  const result = await getStorage('settings');
  const savedTheme = result.settings?.colorTheme || 'default';
  
  applyColorTheme(savedTheme);
}

/**
 * 应用颜色主题
 * @param {string} themeName - 主题名称
 */
export function applyColorTheme(themeName) {
  const theme = THEME_CONFIG[themeName] || THEME_CONFIG.default;
  
  // 设置 data-theme 属性
  if (themeName === 'default') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', themeName);
  }
  
  // 更新状态
  state.isDarkMode = themeName === 'dark';
  
  // 更新主题按钮图标
  const { themeBtn } = state.elements;
  if (themeBtn) {
    if (state.isDarkMode) {
      themeBtn.textContent = '☀️';
      themeBtn.title = '切换到亮色模式';
    } else {
      themeBtn.textContent = '🌙';
      themeBtn.title = '切换到暗色模式';
    }
  }
  
  console.log('[MindGit] 应用主题:', themeName);
}

/**
 * 切换暗色/亮色模式（快速切换）
 */
export async function toggleTheme() {
  const currentTheme = state.currentSettings?.colorTheme || 'default';
  
  // 如果当前是 dark，切换到 default；否则切换到 dark
  const newTheme = currentTheme === 'dark' ? 'default' : 'dark';
  
  // 更新设置
  state.currentSettings = {
    ...state.currentSettings,
    colorTheme: newTheme
  };
  
  // 保存到存储
  await setStorage({ 
    settings: state.currentSettings 
  });
  
  // 应用主题
  applyColorTheme(newTheme);
  
  // 更新设置面板中的选择
  const { colorTheme } = state.elements;
  if (colorTheme) {
    colorTheme.value = newTheme;
  }
}

// 导出主题配置供其他地方使用
export { THEME_CONFIG };
