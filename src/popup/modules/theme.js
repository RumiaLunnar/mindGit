// theme.js - 主题管理

import { state } from './state.js';
import { getStorage, setStorage } from './api.js';

/**
 * 加载主题设置
 */
export async function loadTheme() {
  const result = await getStorage('theme');
  state.isDarkMode = result.theme === 'dark';
  applyTheme();
}

/**
 * 应用主题
 */
export function applyTheme() {
  const { themeBtn } = state.elements;
  
  if (state.isDarkMode) {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeBtn.textContent = '☀️';
    themeBtn.title = '切换到亮色模式';
  } else {
    document.documentElement.removeAttribute('data-theme');
    themeBtn.textContent = '🌙';
    themeBtn.title = '切换到暗色模式';
  }
}

/**
 * 切换主题
 */
export async function toggleTheme() {
  state.isDarkMode = !state.isDarkMode;
  await setStorage({ theme: state.isDarkMode ? 'dark' : 'light' });
  applyTheme();
}

/**
 * 应用颜色主题
 * @param {string} theme - 主题名称
 */
export function applyColorTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    state.isDarkMode = true;
    applyTheme();
  } else if (theme !== 'default') {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}
