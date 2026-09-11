// settings.js - 设置管理

import { state, DEFAULT_SETTINGS } from './state.js';
import * as api from './api.js';
import { showToast } from './toast.js';
import { applyColorTheme } from './theme.js';
import { t, setLang, getCurrentLang } from './i18n.js';
import { updateAllTexts, updateTrackingUI } from './i18nUI.js';
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
    viewMode
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

  updateTrackingUI();
  
  // 云端同步状态
  updateCloudSyncUI();
}

/**
 * 更新云端同步 UI
 */
export function updateCloudSyncUI() {
  const token = getGitHubToken();
  const hasToken = !!token;
  
  const statusText = document.getElementById('syncStatusText');
  const configureBtn = document.getElementById('configureTokenBtn');
  const uploadBtn = document.getElementById('uploadToCloudBtn');
  const downloadBtn = document.getElementById('downloadFromCloudBtn');
  
  if (statusText) {
    statusText.textContent = hasToken ? `(${t('syncConfigured')})` : `(${t('syncNotConfigured')})`;
  }
  
  if (configureBtn) {
    configureBtn.textContent = hasToken ? t('modifyToken') : t('configureToken');
  }
  
  if (uploadBtn) {
    uploadBtn.textContent = t('upload');
    uploadBtn.style.display = hasToken ? 'inline-block' : 'none';
  }
  
  if (downloadBtn) {
    downloadBtn.textContent = t('download');
    downloadBtn.style.display = hasToken ? 'inline-block' : 'none';
  }
}

/**
 * 保存设置
 */
export async function saveSettings() {
  const { colorTheme, language, sortMode, viewMode } = state.elements;
  const newTheme = colorTheme?.value || 'default';
  const newLang = language?.value || 'zh';
  const newSortMode = sortMode?.value || 'smart';
  const newViewMode = viewMode?.value || 'tree';
  const oldLang = state.currentSettings.language;
  
  state.currentSettings = {
    ...state.currentSettings,
    maxSessions: parseInt(state.elements.maxSessions?.value) || 50,
    autoCleanOldSessions: state.elements.autoClean?.checked ?? true,
    showFavicons: state.elements.showFavicons?.checked ?? true,
    defaultExpand: state.elements.defaultExpand?.checked ?? true,
    autoCreateSession: state.elements.autoCreateSession?.checked ?? true,
    trackingEnabled: state.currentSettings.trackingEnabled !== false,
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

  updateCloudSyncUI();
  
  showToast(t('settingsSaved'));
  return true;
}

/**
 * 立即切换网页记录状态，不影响已有会话数据。
 */
export async function toggleTracking() {
  const previous = state.currentSettings?.trackingEnabled !== false;
  const next = !previous;

  state.currentSettings = {
    ...state.currentSettings,
    trackingEnabled: next
  };
  updateTrackingUI();

  try {
    await api.setStorage({ settings: state.currentSettings });
    showToast(t(next ? 'trackingEnabledToast' : 'trackingDisabledToast'));
  } catch (error) {
    state.currentSettings = {
      ...state.currentSettings,
      trackingEnabled: previous
    };
    updateTrackingUI();
    showToast(t('trackingSaveFailed'));
    console.error('[MindGit] 保存记录状态失败:', error);
  }
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
