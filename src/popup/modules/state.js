// state.js - 全局状态管理

export const state = {
  currentSessions: {},
  currentSessionId: null,
  currentSettings: {},
  expandedNodes: new Set(),
  lastDataHash: null,
  isDarkMode: false,
  refreshTimeout: null,
  elements: {},
  isSessionListExpanded: false
};

// 默认设置
export const DEFAULT_SETTINGS = {
  maxSessions: 50,
  maxNodesPerSession: 500,
  autoCleanOldSessions: true,
  showFavicons: true,
  defaultExpand: true,
  autoCreateSession: true,
  colorTheme: 'default',
  language: 'zh',
  sortMode: 'smart'  // 默认智能排序
};

// 初始化 DOM 元素引用
export function initElements() {
  state.elements = {
    themeBtn: document.getElementById('themeBtn'),
    sessionListContainer: document.getElementById('sessionListContainer'),
    sessionListHeader: document.getElementById('sessionListHeader'),
    sessionList: document.getElementById('sessionList'),
    sessionCount: document.getElementById('sessionCount'),
    treeContainer: document.getElementById('treeContainer'),
    statsInfo: document.getElementById('statsInfo'),
    refreshBtn: document.getElementById('refreshBtn'),
    newSessionBtn: document.getElementById('newSessionBtn'),
    exportBtn: document.getElementById('exportBtn'),
    exportSettingBtn: document.getElementById('exportSettingBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    // 搜索
    searchBtn: document.getElementById('searchBtn'),
    searchModal: document.getElementById('searchModal'),
    closeSearch: document.getElementById('closeSearch'),
    searchInput: document.getElementById('searchInput'),
    searchNav: document.getElementById('searchNav'),
    searchCount: document.getElementById('searchCount'),
    prevResult: document.getElementById('prevResult'),
    nextResult: document.getElementById('nextResult'),
    searchResultsList: document.getElementById('searchResultsList'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    expandAllBtn: document.getElementById('expandAllBtn'),
    collapseAllBtn: document.getElementById('collapseAllBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettings: document.getElementById('closeSettings'),
    saveSettings: document.getElementById('saveSettings'),
    newSessionModal: document.getElementById('newSessionModal'),
    closeNewSession: document.getElementById('closeNewSession'),
    confirmNewSession: document.getElementById('confirmNewSession'),
    newSessionName: document.getElementById('newSessionName'),
    // 设置项
    maxSessions: document.getElementById('maxSessions'),
    autoClean: document.getElementById('autoClean'),
    showFavicons: document.getElementById('showFavicons'),
    defaultExpand: document.getElementById('defaultExpand'),
    autoCreateSession: document.getElementById('autoCreateSession'),
    colorTheme: document.getElementById('colorTheme'),
    language: document.getElementById('language'),
    sortMode: document.getElementById('sortMode')
  };
}
