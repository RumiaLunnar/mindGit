// main.js - 主入口

import { state, initElements } from './state.js';
import * as api from './api.js';
import * as theme from './theme.js';
import * as settings from './settings.js';
import * as sessionManager from './sessionManager.js';
import { setupEventListeners } from './events.js';
import { initI18n, setLang, getCurrentLang } from './i18n.js';
import { updateAllTexts } from './i18nUI.js';
import { initSearch } from './search.js';
import { initSnapshot } from './snapshot.js';

/**
 * 诊断工具：输出当前状态
 */
function diagnose() {
  console.log('[MindGit 诊断] 当前状态:', {
    currentSessionId: state.currentSessionId,
    sessionCount: Object.keys(state.currentSessions).length,
    sessions: state.currentSessions,
    lastDataHash: state.lastDataHash,
    settings: state.currentSettings
  });
}

/**
 * 初始化应用
 */
async function init() {
  console.log('[MindGit] ========== 初始化开始 ==========');
  
  // 初始化 DOM 元素引用
  initElements();
  
  // 诊断：查看 storage 中的原始数据
  const rawData = await api.getStorage(['sessions', 'currentSession', 'settings']);
  console.log('[MindGit] Storage 原始数据:', rawData);
  
  // 加载设置（包含语言设置）
  await settings.loadSettings();
  
  // 初始化国际化
  const savedLang = rawData.settings?.language || 'zh';
  await setLang(savedLang);
  
  // 更新界面文本
  updateAllTexts();
  
  // 加载主题
  await theme.loadTheme();
  
  // 监听存储变化（在加载数据前注册）
  api.onStorageChanged((changes) => {
    console.log('[MindGit] 检测到存储变化:', changes);
    sessionManager.checkAndRefresh();
  });
  
  // 加载会话列表
  await sessionManager.loadSessions();
  
  // 诊断
  diagnose();
  
  // 设置事件监听
  setupEventListeners();
  
  // 初始化搜索功能
  initSearch();
  
  // 初始化快照功能
  initSnapshot();
  
  // 应用会话列表初始折叠状态
  if (state.isSessionListExpanded) {
    state.elements.sessionListContainer.classList.add('expanded');
  } else {
    state.elements.sessionListContainer.classList.remove('expanded');
  }
  
  // 尝试自动创建会话
  await sessionManager.tryAutoCreateSession();
  
  // 将诊断函数暴露到全局，方便在控制台调用
  window.mindGitDiagnose = diagnose;
  
  console.log('[MindGit] ========== 初始化完成 ==========');
}

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
