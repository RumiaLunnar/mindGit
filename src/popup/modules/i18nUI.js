// i18nUI.js - 更新界面文本

import { t, getCurrentLang, getSupportedLangs } from './i18n.js';
import { state } from './state.js';

/**
 * 更新所有界面文本
 */
export function updateAllTexts() {
  // 头部
  updateElement('appName', t('appName'));
  updateTitle('themeBtn', state.isDarkMode ? t('switchToLight') : t('switchToDark'));
  updateTitle('refreshBtn', t('refresh'));
  updateTitle('newSessionBtn', t('newSession'));
  updateTitle('searchBtn', t('search'));
  updateTitle('exportBtn', t('export'));
  updateTitle('settingsBtn', t('settings'));
  
  // 会话列表
  updateElement('sessionListTitle', `📁 ${t('sessionList')}`);
  
  // 统计栏
  // 这个会动态更新，这里不需要处理
  
  // 树形区域（空状态）
  updateElement('noRecords', t('noRecords'));
  updateElement('startBrowsing', t('startBrowsing'));
  
  // 底部按钮
  updateElementText('clearAllBtn', t('clearAll'));
  updateElementText('expandAllBtn', t('expandAll'));
  updateElementText('collapseAllBtn', t('collapseAll'));
  
  // 设置面板
  updateElement('settingsTitle', `⚙️ ${t('settingsTitle')}`);
  updateElement('labelMaxSessions', t('maxSessions'));
  updateElement('labelAutoClean', t('autoClean'));
  updateElement('labelShowFavicons', t('showFavicons'));
  updateElement('labelDefaultExpand', t('defaultExpand'));
  updateElement('labelAutoCreateSession', t('autoCreateSession'));
  updateElement('labelLanguage', t('language'));
  updateElement('labelColorTheme', t('colorTheme'));
  updateElement('labelSortMode', t('sortMode'));
  updateElement('labelExport', t('export'));
  
  // 搜索对话框
  updateElement('searchTitle', `🔍 ${t('search')}`);
  
  // 主题选项
  updateElement('themeDefault', t('themeDefault'));
  updateElement('themeMorandi', t('themeMorandi'));
  updateElement('themeForest', t('themeForest'));
  updateElement('themeOcean', t('themeOcean'));
  updateElement('themeWarm', t('themeWarm'));
  updateElement('themeDark', t('themeDark'));
  
  // 排序选项
  updateElement('sortSmart', t('smartSort'));
  updateElement('sortByTime', t('sortByTime'));
  updateElement('sortByChildren', t('sortByChildren'));
  updateElement('sortByVisits', t('sortByVisits'));
  
  // 设置按钮
  updateElementText('saveSettings', t('save'));
  
  // 新建会话对话框
  updateElement('newSessionTitle', `📝 ${t('newSessionTitle')}`);
  updateElement('newSessionLabel', t('sessionNameLabel'));
  const nameInput = document.getElementById('newSessionName');
  if (nameInput) {
    nameInput.placeholder = t('sessionNamePlaceholder');
  }
  updateElementText('confirmNewSession', t('create'));
}

/**
 * 更新元素文本内容
 */
function updateElement(id, text) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
  }
}

/**
 * 更新元素 title 属性
 */
function updateTitle(id, text) {
  const el = document.getElementById(id);
  if (el) {
    el.title = text;
  }
}

/**
 * 更新按钮文本（保留 emoji）
 */
function updateElementText(id, text) {
  const el = document.getElementById(id);
  if (el && el.dataset.i18n) {
    // 使用 data-i18n 属性来标识需要翻译的按钮
    const key = el.dataset.i18n;
    el.textContent = t(key);
  }
}

/**
 * 获取带参数的语言文本
 */
export function getText(key, params = {}) {
  return t(key, params);
}
