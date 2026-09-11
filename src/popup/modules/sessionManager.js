// sessionManager.js - 会话管理逻辑

import { state } from './state.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { showToast } from './toast.js';
import { renderSessionList } from './sessionUI.js';
import { showEmptyState } from './tree.js';
import { loadSessionView } from './viewManager.js';
import { t } from './i18n.js';

const REFRESH_DEBOUNCE_MS = 220;
let refreshInFlight = false;
let refreshQueued = false;

function updateWorkspaceMeta() {
  const activeName = state.elements.activeSessionName;
  if (!activeName) return;

  const session = state.currentSessionId
    ? state.currentSessions[state.currentSessionId]
    : null;

  activeName.textContent = session?.name || t('noActiveSession');
  activeName.title = session?.name || t('noActiveSession');

  if (state.elements.viewModeBadge) {
    state.elements.viewModeBadge.textContent = state.currentSettings?.viewMode === 'timeline'
      ? t('timelineShort')
      : t('treeShort');
  }
}

/**
 * 加载所有会话
 */
export async function loadSessions() {
  try {
    const result = await api.getSessions();
    
    if (!result || typeof result.sessions === 'undefined') {
      console.warn('[MindGit] 加载会话失败，保留现有数据');
      return false;
    }

    const previousSessionId = state.currentSessionId;
    const sessions = result.sessions && typeof result.sessions === 'object'
      ? result.sessions
      : {};

    state.currentSessions = sessions;

    // currentSession 是后台脚本的单一事实来源。兼容旧版本没有该字段的存储。
    if (Object.prototype.hasOwnProperty.call(result, 'currentSession')) {
      state.currentSessionId = result.currentSession && sessions[result.currentSession]
        ? result.currentSession
        : null;
    } else if (!state.currentSessionId || !sessions[state.currentSessionId]) {
      state.currentSessionId = Object.values(sessions)
        .sort((a, b) => (b.startTime || 0) - (a.startTime || 0))[0]?.id || null;
    }

    if (previousSessionId !== state.currentSessionId) {
      state.expandedNodes.clear();
      state.expandedSessionId = null;
    }
    
    updateWorkspaceMeta();
    
    const sortedSessions = Object.values(state.currentSessions)
      .sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
    
    renderSessionList(sortedSessions);
    
    const activeSession = state.currentSessionId
      ? state.currentSessions[state.currentSessionId]
      : null;

    if (activeSession) {
      await loadSessionView(state.currentSessionId, activeSession);
    } else {
      showEmptyState();
    }
    
    await updateStats(activeSession);
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

  const previousSessionId = state.currentSessionId;
  state.expandedNodes.clear();
  state.expandedSessionId = null;

  const result = await api.switchSession(sessionId);
  if (!result?.success) {
    state.currentSessionId = previousSessionId;
    showToast(t('sessionNotFound'));
    return;
  }

  await loadSessions();
}

/**
 * 创建新会话
 * @param {string} name - 会话名称
 */
export async function createSession(name) {
  const result = await api.createNewSession(name || undefined);
  
  if (result?.success) {
    state.expandedNodes.clear();
    state.expandedSessionId = null;
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
  
  const result = await api.deleteSession(sessionId);
  if (!result?.success) {
    showToast(t('deleteFailed', { error: result?.error || 'Unknown error' }));
    return;
  }
  
  if (state.currentSessionId === sessionId) {
    state.currentSessionId = null;
    state.expandedNodes.clear();
    state.expandedSessionId = null;
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
  
  const result = await api.clearAllSessions();
  if (!result?.success) {
    showToast(t('deleteFailed', { error: result?.error || 'Unknown error' }));
    return;
  }

  state.currentSessions = {};
  state.expandedNodes.clear();
  state.expandedSessionId = null;
  state.currentSessionId = null;
  await loadSessions();
  showToast(t('allDataCleared'));
}

/**
 * 更新统计信息
 */
async function updateStats(sessionOverride = undefined) {
  const { statsInfo } = state.elements;
  updateWorkspaceMeta();
  
  if (!state.currentSessionId) {
    statsInfo.textContent = t('noActiveSession');
    return;
  }
  
  let session = sessionOverride;
  if (session === undefined) {
    const result = await api.getSessionTree(state.currentSessionId);
    session = result?.session;
  }

  if (!session) {
    statsInfo.textContent = t('noActiveSession');
    return;
  }

  const nodeCount = Object.keys(session.allNodes || {}).length;
  const rootCount = (session.rootNodes || []).length;
  const emoji = session.emoji ? `${session.emoji} ` : '';

  statsInfo.textContent = t('sessionStats', {
    name: emoji + (session.name || t('noActiveSession')),
    rootCount,
    nodeCount
  });
}

/**
 * 尝试自动创建会话
 */
export async function tryAutoCreateSession() {
  if (state.currentSettings.trackingEnabled === false) return;
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
export function checkAndRefresh() {
  if (refreshInFlight) {
    refreshQueued = true;
    return;
  }

  if (state.refreshTimeout) {
    clearTimeout(state.refreshTimeout);
  }
  
  state.refreshTimeout = setTimeout(async () => {
    state.refreshTimeout = null;

    if (refreshInFlight) {
      refreshQueued = true;
      return;
    }

    refreshInFlight = true;
    try {
      // storage.onChanged 已经说明数据发生变化，这里只需要一次全量读取和渲染。
      await loadSessions();
    } catch (e) {
      console.error('[MindGit] 刷新数据出错:', e);
    } finally {
      refreshInFlight = false;
      if (refreshQueued) {
        refreshQueued = false;
        checkAndRefresh();
      }
    }
  }, REFRESH_DEBOUNCE_MS);
}
