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
  applyColorTheme(state.currentSettings.colorTheme);
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
  
  maxSessions.value = state.currentSettings.maxSessions;
  autoClean.checked = state.currentSettings.autoCleanOldSessions;
  showFavicons.checked = state.currentSettings.showFavicons !== false;
  defaultExpand.checked = state.currentSettings.defaultExpand !== false;
  autoCreateSession.checked = state.currentSettings.autoCreateSession !== false;
  colorTheme.value = state.currentSettings.colorTheme || 'default';
}

/**
 * 保存设置
 */
export async function saveSettings() {
  const { colorTheme } = state.elements;
  const newTheme = colorTheme.value;
  
  state.currentSettings = {
    ...state.currentSettings,
    maxSessions: parseInt(state.elements.maxSessions.value) || 50,
    autoCleanOldSessions: state.elements.autoClean.checked,
    showFavicons: state.elements.showFavicons.checked,
    defaultExpand: state.elements.defaultExpand.checked,
    autoCreateSession: state.elements.autoCreateSession.checked,
    colorTheme: newTheme
  };
  
  await api.setStorage({ settings: state.currentSettings });
  
  applyColorTheme(newTheme);
  
  showToast('设置已保存');
  return true;
}

/**
 * 打开设置面板
 */
export function openSettings() {
  state.elements.settingsModal.classList.add('active');
}

/**
 * 关闭设置面板
 */
export function closeSettings() {
  state.elements.settingsModal.classList.remove('active');
}
