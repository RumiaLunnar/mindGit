// sessionManager.js - 会话管理逻辑

import { state } from './state.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { showToast } from './toast.js';
import { renderSessionList } from './sessionUI.js';
import { loadTree, showEmptyState } from './tree.js';
import { t } from './i18n.js';
import { getText } from './i18nUI.js';

/**
 * 加载所有会话
 */
export async function loadSessions() {
  try {
    console.log('[MindGit] loadSessions 开始');
    const result = await api.getSessions();
    console.log('[MindGit] getSessions 返回:', result);
    
    if (!result || typeof result.sessions === 'undefined') {
      console.warn('[MindGit] 加载会话失败，保留现有数据');
      return false;
    }
    
    // 保护性检查：防止数据异常丢失
    const existingCount = Object.keys(state.currentSessions).length;
    const newCount = Object.keys(result.sessions || {}).length;
    console.log(`[MindGit] 现有会话: ${existingCount}, 新会话: ${newCount}`);
    
    if (existingCount > 0 && newCount === 0) {
      console.warn('[MindGit] 检测到会话数据异常，保留现有数据');
      return false;
    }
    
    state.currentSessions = result.sessions || {};
    if (!state.currentSessionId) {
      state.currentSessionId = result.currentSession;
    }
    
    state.lastDataHash = utils.hashSessions(state.currentSessions);
    
    // 如果当前会话不在列表中，清空选择
    if (state.currentSessionId && !state.currentSessions[state.currentSessionId]) {
      state.currentSessionId = null;
    }
    
    const sortedSessions = Object.values(state.currentSessions)
      .sort((a, b) => b.startTime - a.startTime);
    
    renderSessionList(sortedSessions);
    
    if (state.currentSessionId && state.currentSessions[state.currentSessionId]) {
      await loadTree(state.currentSessionId);
    } else {
      showEmptyState();
    }
    
    await updateStats();
    return true;
  } catch (e) {
    console.error('[MindGit] 加载会话出错:', e);
    return false;
  }
}

/**
 * 切换会话
 * @param {string} sessionId - 会话 ID
 */
export async function switchToSession(sessionId) {
  if (sessionId === state.currentSessionId) return;
  
  state.currentSessionId = sessionId;
  state.expandedNodes.clear();
  
  await api.switchSession(sessionId);
  
  const result = await api.getSessions();
  state.currentSessions = result.sessions || {};
  
  const sortedSessions = Object.values(state.currentSessions)
    .sort((a, b) => b.startTime - a.startTime);
  renderSessionList(sortedSessions);
  
  await loadTree(sessionId);
  await updateStats();
}

/**
 * 创建新会话
 * @param {string} name - 会话名称
 */
export async function createSession(name) {
  const result = await api.createNewSession(name || undefined);
  
  if (result.success) {
    state.expandedNodes.clear();
    state.currentSessionId = result.sessionId;
    await loadSessions();
    showToast(t('sessionCreated'));
    return result.sessionId;
  }
  
  showToast(t('create'));
  return null;
}

import * as sessionUI from './sessionUI.js';

/**
 * 执行重命名会话
 * @param {string} sessionId - 会话 ID
 * @param {string} newName - 新名称
 */
export async function executeRenameSession(sessionId, newName) {
  if (!newName || !newName.trim()) return;
  
  const result = await api.renameSession(sessionId, newName.trim());
  
  if (result.success) {
    showToast(t('sessionRenamed'));
    await loadSessions();
  } else {
    showToast(t('renameFailed'));
  }
}

/**
 * 打开重命名会话弹窗
 * @param {string} sessionId - 会话 ID
 * @param {string} currentName - 当前名称
 */
export function renameSession(sessionId, currentName) {
  sessionUI.openRenameSessionModal(sessionId, currentName);
}

/**
 * 删除会话
 * @param {string} sessionId - 会话 ID
 */
export async function deleteSession(sessionId) {
  if (!confirm(t('confirmDeleteSession'))) {
    return;
  }
  
  await api.deleteSession(sessionId);
  
  if (state.currentSessionId === sessionId) {
    state.currentSessionId = null;
    state.expandedNodes.clear();
  }
  
  await loadSessions();
  showToast(t('sessionDeleted'));
}

/**
 * 清空所有会话
 */
export async function clearAllSessions() {
  if (!confirm(t('confirmClearAll'))) {
    return;
  }
  
  await api.clearAllSessions();
  state.expandedNodes.clear();
  state.currentSessionId = null;
  await loadSessions();
  showToast(t('allDataCleared'));
}

/**
 * 更新统计信息
 */
async function updateStats() {
  const { statsInfo } = state.elements;
  
  if (!state.currentSessionId) {
    statsInfo.innerHTML = '💤 无活动会话';
    return;
  }
  
  const result = await api.getSessionTree(state.currentSessionId);
  
  if (!result.session) {
    statsInfo.innerHTML = `💤 ${getText('noActiveSession')}`;
    return;
  }
  
  const session = result.session;
  const nodeCount = Object.keys(session.allNodes || {}).length;
  const rootCount = (session.rootNodes || []).length;
  
  statsInfo.innerHTML = getText('sessionStats', {
    name: utils.escapeHtml(session.name),
    rootCount,
    nodeCount
  });
}

/**
 * 尝试自动创建会话
 */
export async function tryAutoCreateSession() {
  if (state.currentSettings.autoCreateSession === false) return;
  
  const sessionCount = Object.keys(state.currentSessions).length;
  if (sessionCount > 0) return;
  
  try {
    const tabs = await api.getActiveTab();
    if (tabs.length === 0) return;
    
    const activeTab = tabs[0];
    const url = activeTab.url;
    
    if (!utils.shouldTrackUrl(url)) return;
    
    const sessionId = await createSession(activeTab.title?.substring(0, 30));
    
    if (sessionId) {
      await api.addNode({
        sessionId,
        url: activeTab.url,
        title: activeTab.title,
        favIconUrl: activeTab.favIconUrl,
        tabId: activeTab.id
      });
      
      const result = await api.getSessions();
      if (result && result.sessions) {
        state.lastDataHash = utils.hashSessions(result.sessions);
      }
      
      await loadSessions();
      showToast(t('autoSessionCreated'));
    }
  } catch (e) {
    console.error('[MindGit] 自动创建会话失败:', e);
  }
}

/**
 * 检查并刷新数据
 */
export async function checkAndRefresh() {
  if (state.refreshTimeout) {
    clearTimeout(state.refreshTimeout);
  }
  
  state.refreshTimeout = setTimeout(async () => {
    try {
      const result = await api.getSessions();
      if (!result) return;
      
      const newHash = utils.hashSessions(result.sessions);
      
      if (newHash !== state.lastDataHash) {
        state.lastDataHash = newHash;
        await loadSessions();
      }
    } catch (e) {
      console.error('[MindGit] 刷新数据出错:', e);
    }
    state.refreshTimeout = null;
  }, 300);
}
