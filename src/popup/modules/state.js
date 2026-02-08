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
  isSessionListExpanded: true
};

// 默认设置
export const DEFAULT_SETTINGS = {
  maxSessions: 50,
  maxNodesPerSession: 500,
  autoCleanOldSessions: true,
  showFavicons: true,
  defaultExpand: true,
  autoCreateSession: true,
  colorTheme: 'default'
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
    settingsBtn: document.getElementById('settingsBtn'),
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
    colorTheme: document.getElementById('colorTheme')
  };
}
