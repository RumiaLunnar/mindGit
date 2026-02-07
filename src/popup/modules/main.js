// main.js - 主入口

import { state, initElements } from './state.js';
import * as api from './api.js';
import * as theme from './theme.js';
import * as settings from './settings.js';
import * as sessionManager from './sessionManager.js';
import { setupEventListeners } from './events.js';

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
  
  // 唤醒 Service Worker
  await api.ping();
  
  // 初始化 DOM 元素引用
  initElements();
  
  // 诊断：查看 storage 中的原始数据
  const rawData = await api.getStorage(['sessions', 'currentSession', 'settings']);
  console.log('[MindGit] Storage 原始数据:', rawData);
  
  // 加载主题
  await theme.loadTheme();
  
  // 加载设置
  await settings.loadSettings();
  
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
  
  // 尝试自动创建会话
  await sessionManager.tryAutoCreateSession();
  
  // 将诊断函数暴露到全局，方便在控制台调用
  window.mindGitDiagnose = diagnose;
  
  console.log('[MindGit] ========== 初始化完成 ==========');
}

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
