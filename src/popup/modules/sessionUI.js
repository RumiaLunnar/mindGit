// sessionUI.js - 会话列表 UI 渲染

import { state } from './state.js';
import { formatDate } from './utils.js';
import { t } from './i18n.js';
import { showEmojiPicker, updateSessionEmoji } from './emojiPicker.js';

/**
 * 渲染会话列表
 * @param {Array} sessions - 会话数组
 */
export function renderSessionList(sessions) {
  const { sessionList, sessionCount } = state.elements;
  
  sessionCount.textContent = t('sessionsCount', { count: sessions.length });
  
  if (sessions.length === 0) {
    const emptyState = document.createDocumentFragment();
    renderEmptyState(emptyState);
    sessionList.replaceChildren(emptyState);
    return;
  }

  const fragment = document.createDocumentFragment();
  
  for (const session of sessions) {
    const sessionItem = createSessionItem(session, session.id === state.currentSessionId);
    fragment.appendChild(sessionItem);
  }
  sessionList.replaceChildren(fragment);
}

/**
 * 渲染空状态
 * @param {HTMLElement} container - 容器
 */
function renderEmptyState(container) {
  const empty = document.createElement('div');
  empty.className = 'session-list-empty';

  const icon = document.createElement('div');
  icon.className = 'session-list-empty-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '+';

  const text = document.createElement('div');
  text.className = 'session-list-empty-text';
  text.textContent = t('noRecords');

  const hint = document.createElement('div');
  hint.className = 'session-list-empty-hint';
  hint.textContent = t('startBrowsing');

  empty.append(icon, text, hint);
  container.appendChild(empty);
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
  item.tabIndex = 0;
  item.setAttribute('role', 'button');
  item.setAttribute('aria-current', isActive ? 'true' : 'false');
  
  const nodeCount = Object.keys(session.allNodes || {}).length;
  const rootCount = (session.rootNodes || []).length;
  const dateStr = formatDate(session.startTime);
  const emoji = session.emoji;
  
  const emojiEl = document.createElement('button');
  emojiEl.type = 'button';
  emojiEl.className = `session-item-emoji ${emoji ? 'has-emoji' : ''}`;
  emojiEl.title = '点击设置标签';
  emojiEl.setAttribute('aria-label', '设置会话标签');
  emojiEl.textContent = emoji || (isActive ? '●' : '○');

  const info = document.createElement('div');
  info.className = 'session-item-info';

  const nameEl = document.createElement('div');
  nameEl.className = 'session-item-name';
  nameEl.textContent = session.name || t('noActiveSession');
  nameEl.title = session.name || t('noActiveSession');

  const metaEl = document.createElement('div');
  metaEl.className = 'session-item-meta';
  metaEl.textContent = `${t('rootNodesCount', { count: rootCount })} | ${t('nodesCount', { count: nodeCount })} | ${dateStr}`;

  info.append(nameEl, metaEl);

  const actions = document.createElement('div');
  actions.className = 'session-item-actions';

  const renameButton = document.createElement('button');
  renameButton.type = 'button';
  renameButton.className = 'session-item-btn rename';
  renameButton.title = t('rename');
  renameButton.setAttribute('aria-label', t('rename'));
  renameButton.textContent = '✎';

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'session-item-btn delete';
  deleteButton.title = t('delete');
  deleteButton.setAttribute('aria-label', t('delete'));
  deleteButton.textContent = '×';

  actions.append(renameButton, deleteButton);
  item.append(emojiEl, info, actions);
  
  // Emoji 点击事件
  emojiEl.addEventListener('click', (e) => {
    e.stopPropagation();
    showEmojiPicker(emojiEl, session.id, async (selectedEmoji) => {
      await updateSessionEmoji(session.id, selectedEmoji);
      // 刷新显示
      emojiEl.textContent = selectedEmoji || (isActive ? '●' : '○');
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
