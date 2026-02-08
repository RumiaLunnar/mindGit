// settings.js - 设置管理

import { state, DEFAULT_SETTINGS } from './state.js';
import * as api from './api.js';
import { showToast } from './toast.js';
import { applyColorTheme } from './theme.js';

/**
 * 加载设置
 */
export async function loadSettings() {
  const result = await api.getStorage('settings');
  state.currentSettings = {
    ...DEFAULT_SETTINGS,
    ...result.settings
  };
  
  updateSettingsUI();
  // 主题在 theme.js 的 loadTheme 中统一应用
}

/**
 * 更新设置界面
 */
function updateSettingsUI() {
  const {
    maxSessions,
    autoClean,
    showFavicons,
    defaultExpand,
    autoCreateSession,
    colorTheme
  } = state.elements;
  
  if (maxSessions) maxSessions.value = state.currentSettings.maxSessions;
  if (autoClean) autoClean.checked = state.currentSettings.autoCleanOldSessions;
  if (showFavicons) showFavicons.checked = state.currentSettings.showFavicons !== false;
  if (defaultExpand) defaultExpand.checked = state.currentSettings.defaultExpand !== false;
  if (autoCreateSession) autoCreateSession.checked = state.currentSettings.autoCreateSession !== false;
  if (colorTheme) colorTheme.value = state.currentSettings.colorTheme || 'default';
}

/**
 * 保存设置
 */
export async function saveSettings() {
  const { colorTheme } = state.elements;
  const newTheme = colorTheme?.value || 'default';
  
  state.currentSettings = {
    ...state.currentSettings,
    maxSessions: parseInt(state.elements.maxSessions?.value) || 50,
    autoCleanOldSessions: state.elements.autoClean?.checked ?? true,
    showFavicons: state.elements.showFavicons?.checked ?? true,
    defaultExpand: state.elements.defaultExpand?.checked ?? true,
    autoCreateSession: state.elements.autoCreateSession?.checked ?? true,
    colorTheme: newTheme
  };
  
  await api.setStorage({ settings: state.currentSettings });
  
  // 应用新主题
  applyColorTheme(newTheme);
  
  showToast('设置已保存');
  return true;
}

/**
 * 打开设置面板
 */
export function openSettings() {
  state.elements.settingsModal?.classList.add('active');
}

/**
 * 关闭设置面板
 */
export function closeSettings() {
  state.elements.settingsModal?.classList.remove('active');
}
