// settings.js - 设置管理

import { state, DEFAULT_SETTINGS } from './state.js';
import * as api from './api.js';
import { showToast } from './toast.js';
import { applyColorTheme } from './theme.js';
import { t, setLang, getCurrentLang } from './i18n.js';
import { updateAllTexts } from './i18nUI.js';
import { 
  getGitHubToken, 
  saveGitHubToken, 
  validateToken, 
  uploadToCloud, 
  downloadFromCloud,
  initAutoSync 
} from './gistSync.js';

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
  // 语言和主题的应用在初始化时处理
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
    colorTheme,
    language,
    sortMode,
    viewMode,
    githubToken,
    syncActions,
    syncStatus
  } = state.elements;
  
  if (maxSessions) maxSessions.value = state.currentSettings.maxSessions;
  if (autoClean) autoClean.checked = state.currentSettings.autoCleanOldSessions;
  if (showFavicons) showFavicons.checked = state.currentSettings.showFavicons !== false;
  if (defaultExpand) defaultExpand.checked = state.currentSettings.defaultExpand !== false;
  if (autoCreateSession) autoCreateSession.checked = state.currentSettings.autoCreateSession !== false;
  if (colorTheme) colorTheme.value = state.currentSettings.colorTheme || 'default';
  if (language) language.value = state.currentSettings.language || 'zh';
  if (sortMode) sortMode.value = state.currentSettings.sortMode || 'smart';
  if (viewMode) viewMode.value = state.currentSettings.viewMode || 'tree';
  
  // GitHub Token
  if (githubToken) {
    const token = getGitHubToken();
    githubToken.value = token || '';
    // 如果有 Token，显示同步按钮
    if (syncActions) {
      syncActions.style.display = token ? 'flex' : 'none';
    }
    // 更新状态
    updateSyncStatus(token, syncStatus);
  }
}

/**
 * 更新同步状态显示
 */
async function updateSyncStatus(token, statusEl) {
  if (!statusEl) return;
  
  if (!token) {
    statusEl.textContent = '';
    return;
  }
  
  const { gistId, lastSyncTime } = state.currentSettings || {};
  if (lastSyncTime) {
    const date = new Date(lastSyncTime);
    statusEl.textContent = `上次同步: ${date.toLocaleString()}`;
    statusEl.className = 'sync-status success';
  } else if (gistId) {
    statusEl.textContent = '已配置，未同步';
    statusEl.className = 'sync-status';
  } else {
    statusEl.textContent = '待初始同步';
    statusEl.className = 'sync-status';
  }
}

/**
 * 保存设置
 */
export async function saveSettings() {
  const { colorTheme, language, sortMode, viewMode, githubToken } = state.elements;
  const newTheme = colorTheme?.value || 'default';
  const newLang = language?.value || 'zh';
  const newSortMode = sortMode?.value || 'smart';
  const newViewMode = viewMode?.value || 'tree';
  const oldLang = state.currentSettings.language;
  const oldSortMode = state.currentSettings.sortMode;
  const oldViewMode = state.currentSettings.viewMode || 'tree';
  
  // 保存 GitHub Token（只有输入框有值时才保存，避免覆盖已验证的 Token）
  if (githubToken && githubToken.value.trim()) {
    await saveGitHubToken(githubToken.value.trim());
  }
  
  state.currentSettings = {
    ...state.currentSettings,
    maxSessions: parseInt(state.elements.maxSessions?.value) || 50,
    autoCleanOldSessions: state.elements.autoClean?.checked ?? true,
    showFavicons: state.elements.showFavicons?.checked ?? true,
    defaultExpand: state.elements.defaultExpand?.checked ?? true,
    autoCreateSession: state.elements.autoCreateSession?.checked ?? true,
    colorTheme: newTheme,
    language: newLang,
    sortMode: newSortMode,
    viewMode: newViewMode
  };
  
  await api.setStorage({ settings: state.currentSettings });
  
  // 应用新主题
  applyColorTheme(newTheme);
  
  // 如果语言改变了，更新界面文本
  if (newLang !== oldLang) {
    await setLang(newLang);
    updateAllTexts();
  }
  
  // 如果排序方式改变了，重新加载树形结构
  if (newSortMode !== oldSortMode && state.currentSessionId) {
    const { loadSessionView } = await import('./viewManager.js');
    await loadSessionView(state.currentSessionId);
  }
  
  // 如果视图模式改变了，切换视图
  if (newViewMode !== oldViewMode && state.currentSessionId) {
    const { loadSessionView } = await import('./viewManager.js');
    await loadSessionView(state.currentSessionId);
  }
  
  showToast(t('settingsSaved'));
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
