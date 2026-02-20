// sessionUI.js - 会话列表 UI 渲染

import { state } from './state.js';
import { escapeHtml, formatDate } from './utils.js';
import { t } from './i18n.js';
import { showEmojiPicker, updateSessionEmoji } from './emojiPicker.js';

/**
 * 渲染会话列表
 * @param {Array} sessions - 会话数组
 */
export function renderSessionList(sessions) {
  const { sessionList, sessionCount } = state.elements;
  
  sessionCount.textContent = t('sessionsCount', { count: sessions.length });
  sessionList.innerHTML = '';
  
  if (sessions.length === 0) {
    renderEmptyState(sessionList);
    return;
  }
  
  for (const session of sessions) {
    const sessionItem = createSessionItem(session, session.id === state.currentSessionId);
    sessionList.appendChild(sessionItem);
  }
}

/**
 * 渲染空状态
 * @param {HTMLElement} container - 容器
 */
function renderEmptyState(container) {
  container.innerHTML = `
    <div class="session-list-empty">
      <div class="session-list-empty-icon">🌱</div>
      <div class="session-list-empty-text">还没有浏览记录</div>
      <div class="session-list-empty-hint">开始浏览网页，我会帮你记录跳转脉络~</div>
    </div>
  `;
}

/**
 * 创建会话项元素
 * @param {Object} session - 会话数据
 * @param {boolean} isActive - 是否当前激活
 * @returns {HTMLElement}
 */
function createSessionItem(session, isActive) {
  const item = document.createElement('div');
  item.className = `session-item ${isActive ? 'active' : ''}`;
  item.dataset.sessionId = session.id;
  
  const nodeCount = Object.keys(session.allNodes || {}).length;
  const rootCount = (session.rootNodes || []).length;
  const dateStr = formatDate(session.startTime);
  const emoji = session.emoji;
  
  item.innerHTML = `
    <div class="session-item-emoji ${emoji ? 'has-emoji' : ''}" title="点击设置标签">
      ${emoji || (isActive ? '👆' : '📄')}
    </div>
    <div class="session-item-info">
      <div class="session-item-name">${escapeHtml(session.name)}</div>
      <div class="session-item-meta">${t('rootNodesCount', { count: rootCount })} · ${t('nodesCount', { count: nodeCount })} · ${dateStr}</div>
    </div>
    <div class="session-item-actions">
      <button class="session-item-btn rename" title="${t('rename')}">✏️</button>
      <button class="session-item-btn delete" title="${t('delete')}">🗑️</button>
    </div>
  `;
  
  // Emoji 点击事件
  const emojiEl = item.querySelector('.session-item-emoji');
  emojiEl.addEventListener('click', (e) => {
    e.stopPropagation();
    showEmojiPicker(emojiEl, session.id, async (selectedEmoji) => {
      await updateSessionEmoji(session.id, selectedEmoji);
      // 刷新显示
      emojiEl.textContent = selectedEmoji || (isActive ? '👆' : '📄');
      emojiEl.classList.toggle('has-emoji', !!selectedEmoji);
    });
  });
  
  return item;
}

/**
 * 显示新建会话对话框
 */
export function openNewSessionModal() {
  state.elements.newSessionModal.classList.add('active');
  state.elements.newSessionName.focus();
}

/**
 * 关闭新建会话对话框
 */
export function closeNewSessionModal() {
  state.elements.newSessionModal.classList.remove('active');
  state.elements.newSessionName.value = '';
}

/**
 * 获取新建会话名称
 * @returns {string}
 */
export function getNewSessionName() {
  return state.elements.newSessionName.value.trim();
}

// 当前正在重命名的会话ID
let currentRenameSessionId = null;

/**
 * 显示重命名会话对话框
 * @param {string} sessionId - 会话ID
 * @param {string} currentName - 当前名称
 */
export function openRenameSessionModal(sessionId, currentName) {
  currentRenameSessionId = sessionId;
  const { renameSessionModal, renameSessionInput } = state.elements;
  
  renameSessionModal.classList.add('active');
  renameSessionInput.value = currentName || '';
  renameSessionInput.focus();
  renameSessionInput.select();
}

/**
 * 关闭重命名会话对话框
 */
export function closeRenameSessionModal() {
  const { renameSessionModal, renameSessionInput } = state.elements;
  
  renameSessionModal.classList.remove('active');
  renameSessionInput.value = '';
  currentRenameSessionId = null;
}

/**
 * 获取当前重命名的会话ID
 * @returns {string|null}
 */
export function getCurrentRenameSessionId() {
  return currentRenameSessionId;
}

/**
 * 获取重命名会话的新名称
 * @returns {string}
 */
export function getRenameSessionName() {
  return state.elements.renameSessionInput.value.trim();
}
