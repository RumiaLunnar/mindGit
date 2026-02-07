// main.js - 主入口

import { state, initElements } from './state.js';
import * as api from './api.js';
import * as theme from './theme.js';
import * as settings from './settings.js';
import * as sessionManager from './sessionManager.js';
import { setupEventListeners } from './events.js';

/**
 * 初始化应用
 */
async function init() {
  console.log('[MindGit] 初始化开始');
  
  // 初始化 DOM 元素引用
  initElements();
  
  // 加载主题
  await theme.loadTheme();
  
  // 加载设置
  await settings.loadSettings();
  
  // 监听存储变化（在加载数据前注册）
  api.onStorageChanged(() => {
    sessionManager.checkAndRefresh();
  });
  
  // 加载会话列表
  await sessionManager.loadSessions();
  
  // 设置事件监听
  setupEventListeners();
  
  // 尝试自动创建会话
  await sessionManager.tryAutoCreateSession();
  
  console.log('[MindGit] 初始化完成');
}

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
