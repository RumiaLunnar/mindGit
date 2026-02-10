// events.js - 事件处理

import { state } from './state.js';
import * as sessionManager from './sessionManager.js';
import * as sessionUI from './sessionUI.js';
import * as settings from './settings.js';
import * as tree from './tree.js';
import * as theme from './theme.js';
import * as search from './search.js';
import * as exportModule from './export.js';
import { showToast } from './toast.js';

/**
 * 切换会话列表展开/收起状态
 */
function toggleSessionList() {
  const { sessionListContainer } = state.elements;
  state.isSessionListExpanded = !state.isSessionListExpanded;
  
  if (state.isSessionListExpanded) {
    sessionListContainer.classList.add('expanded');
  } else {
    sessionListContainer.classList.remove('expanded');
  }
}

/**
 * 设置所有事件监听器
 */
export function setupEventListeners() {
  setupHeaderEvents();
  setupSessionEvents();
  setupTreeEvents();
  setupModalEvents();
}

/**
 * 设置头部按钮事件
 */
function setupHeaderEvents() {
  const { themeBtn, refreshBtn, newSessionBtn, searchBtn, exportBtn, settingsBtn, sessionListHeader } = state.elements;
  
  // 主题切换
  themeBtn.addEventListener('click', theme.toggleTheme);
  
  // 刷新按钮
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.innerHTML = '<span class="loading-spinner"></span>';
    await sessionManager.loadSessions();
    refreshBtn.innerHTML = '🔄';
    showToast('已刷新');
  });
  
  // 新建会话
  newSessionBtn.addEventListener('click', sessionUI.openNewSessionModal);
  
  // 搜索按钮
  searchBtn.addEventListener('click', search.openSearchModal);
  
  // 导出按钮
  exportBtn.addEventListener('click', exportModule.exportCurrentSession);
  
  // 设置
  settingsBtn.addEventListener('click', settings.openSettings);
  
  // 会话列表展开/收起
  sessionListHeader.addEventListener('click', toggleSessionList);
}

/**
 * 设置会话列表事件
 */
function setupSessionEvents() {
  const { sessionList } = state.elements;
  
  sessionList.addEventListener('click', (e) => {
    const item = e.target.closest('.session-item');
    if (!item) return;
    
    const sessionId = item.dataset.sessionId;
    if (!sessionId) return;
    
    // 如果点击的是按钮
    const btn = e.target.closest('.session-item-btn');
    if (btn) {
      if (btn.classList.contains('rename')) {
        const session = state.currentSessions[sessionId];
        sessionManager.renameSession(sessionId, session?.name);
      } else if (btn.classList.contains('delete')) {
        sessionManager.deleteSession(sessionId);
      }
      return;
    }
    
    // 点击整个项切换会话
    sessionManager.switchToSession(sessionId);
  });
}

/**
 * 设置树形操作事件
 */
function setupTreeEvents() {
  const { clearAllBtn, expandAllBtn, collapseAllBtn } = state.elements;
  
  // 清空所有
  clearAllBtn.addEventListener('click', sessionManager.clearAllSessions);
  
  // 展开全部
  expandAllBtn.addEventListener('click', tree.expandAll);
  
  // 折叠全部
  collapseAllBtn.addEventListener('click', tree.collapseAll);
}

/**
 * 设置模态框事件
 */
function setupModalEvents() {
  const {
    closeSettings,
    saveSettings,
    settingsModal,
    exportSettingBtn,
    closeNewSession,
    confirmNewSession,
    newSessionModal,
    newSessionName,
    closeRenameSession,
    confirmRenameSession,
    renameSessionModal,
    renameSessionInput
  } = state.elements;
  
  // 设置面板
  closeSettings.addEventListener('click', settings.closeSettings);
  
  saveSettings.addEventListener('click', async () => {
    await settings.saveSettings();
    settings.closeSettings();
    if (state.currentSessionId) {
      await tree.loadTree(state.currentSessionId);
    }
  });
  
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settings.closeSettings();
  });
  
  // 设置面板中的导出按钮
  if (exportSettingBtn) {
    exportSettingBtn.addEventListener('click', exportModule.exportCurrentSession);
  }
  
  // 新建会话
  closeNewSession.addEventListener('click', sessionUI.closeNewSessionModal);
  
  confirmNewSession.addEventListener('click', async () => {
    const name = sessionUI.getNewSessionName();
    const sessionId = await sessionManager.createSession(name);
    if (sessionId) {
      sessionUI.closeNewSessionModal();
    }
  });
  
  newSessionModal.addEventListener('click', (e) => {
    if (e.target === newSessionModal) sessionUI.closeNewSessionModal();
  });
  
  // 回车创建
  newSessionName.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      confirmNewSession.click();
    }
  });
  
  // 重命名会话
  closeRenameSession.addEventListener('click', sessionUI.closeRenameSessionModal);
  
  confirmRenameSession.addEventListener('click', async () => {
    const sessionId = sessionUI.getCurrentRenameSessionId();
    const newName = sessionUI.getRenameSessionName();
    if (sessionId && newName) {
      await sessionManager.executeRenameSession(sessionId, newName);
      sessionUI.closeRenameSessionModal();
    }
  });
  
  renameSessionModal.addEventListener('click', (e) => {
    if (e.target === renameSessionModal) sessionUI.closeRenameSessionModal();
  });
  
  // 回车保存重命名
  renameSessionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      confirmRenameSession.click();
    }
  });
  
  // ESC 关闭模态框
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      sessionUI.closeNewSessionModal();
      sessionUI.closeRenameSessionModal();
      settings.closeSettings();
    }
  });
}
