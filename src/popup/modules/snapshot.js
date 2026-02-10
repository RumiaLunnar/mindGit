// snapshot.js - 快照功能

import { state } from './state.js';
import * as api from './api.js';
import { showToast } from './toast.js';
import { t } from './i18n.js';

// 当前正在创建快照的会话ID
let currentSnapshotSessionId = null;

/**
 * 初始化快照功能
 */
export function initSnapshot() {
  const { 
    createSnapshotBtn, 
    closeSnapshot, 
    confirmSnapshot,
    snapshotModal,
    snapshotInput,
    snapshotList
  } = state.elements;
  
  // 创建快照按钮
  if (createSnapshotBtn) {
    createSnapshotBtn.addEventListener('click', openCreateSnapshotModal);
  }
  
  // 关闭按钮
  if (closeSnapshot) {
    closeSnapshot.addEventListener('click', closeSnapshotModal);
  }
  
  // 确认创建
  if (confirmSnapshot) {
    confirmSnapshot.addEventListener('click', executeCreateSnapshot);
  }
  
  // 点击背景关闭
  if (snapshotModal) {
    snapshotModal.addEventListener('click', (e) => {
      if (e.target === snapshotModal) closeSnapshotModal();
    });
  }
  
  // 回车创建
  if (snapshotInput) {
    snapshotInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') executeCreateSnapshot();
    });
  }
}

/**
 * 打开创建快照弹窗
 */
export function openCreateSnapshotModal() {
  if (!state.currentSessionId) {
    showToast(t('pleaseSelectSession'));
    return;
  }
  
  currentSnapshotSessionId = state.currentSessionId;
  const { snapshotModal, snapshotInput } = state.elements;
  
  // 设置默认名称
  const session = state.currentSessions[state.currentSessionId];
  const defaultName = session ? `${session.name} - ${new Date().toLocaleString()}` : '';
  
  snapshotModal.classList.add('active');
  snapshotInput.value = defaultName;
  snapshotInput.focus();
  snapshotInput.select();
}

/**
 * 关闭创建快照弹窗
 */
export function closeSnapshotModal() {
  const { snapshotModal, snapshotInput } = state.elements;
  snapshotModal.classList.remove('active');
  snapshotInput.value = '';
  currentSnapshotSessionId = null;
}

/**
 * 执行创建快照
 */
async function executeCreateSnapshot() {
  if (!currentSnapshotSessionId) {
    console.error('[MindGit] 没有选中的会话');
    return;
  }
  
  const { snapshotInput } = state.elements;
  const name = snapshotInput.value.trim();
  
  if (!name) {
    showToast(t('snapshotNamePlaceholder'));
    return;
  }
  
  try {
    console.log('[MindGit] 创建快照:', currentSnapshotSessionId, name);
    const result = await api.createSnapshot(currentSnapshotSessionId, name);
    console.log('[MindGit] 创建快照结果:', result);
    
    if (result && result.success) {
      showToast(t('snapshotCreated'));
      closeSnapshotModal();
      await loadSnapshots();
    } else {
      showToast(result?.error || '创建快照失败');
    }
  } catch (e) {
    console.error('[MindGit] 创建快照异常:', e);
    showToast('创建快照失败: ' + e.message);
  }
}

/**
 * 加载快照列表
 */
export async function loadSnapshots() {
  const { snapshotList } = state.elements;
  if (!snapshotList) return;
  
  const result = await api.getSnapshots();
  const snapshots = result.snapshots || {};
  
  const snapshotArray = Object.values(snapshots).sort((a, b) => b.createdAt - a.createdAt);
  
  if (snapshotArray.length === 0) {
    snapshotList.innerHTML = `
      <div class="snapshot-empty">
        <span class="snapshot-empty-icon">📸</span>
        <span>${t('noSnapshots')}</span>
      </div>
    `;
    return;
  }
  
  snapshotList.innerHTML = snapshotArray.map(snapshot => `
    <div class="snapshot-item" data-snapshot-id="${snapshot.id}">
      <div class="snapshot-info">
        <div class="snapshot-name">${escapeHtml(snapshot.name)}</div>
        <div class="snapshot-meta">
          ${new Date(snapshot.createdAt).toLocaleString()} · 
          ${snapshot.sessionData?.name || 'Unknown Session'}
        </div>
      </div>
      <div class="snapshot-actions">
        <button class="snapshot-btn restore" title="${t('restoreSnapshot')}">🔄</button>
        <button class="snapshot-btn delete" title="${t('deleteSnapshot')}">🗑️</button>
      </div>
    </div>
  `).join('');
  
  // 绑定按钮事件
  snapshotList.querySelectorAll('.snapshot-item').forEach(item => {
    const snapshotId = item.dataset.snapshotId;
    
    item.querySelector('.restore').addEventListener('click', (e) => {
      e.stopPropagation();
      restoreSnapshot(snapshotId);
    });
    
    item.querySelector('.delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSnapshot(snapshotId);
    });
  });
}

/**
 * 恢复快照
 * @param {string} snapshotId - 快照 ID
 */
async function restoreSnapshot(snapshotId) {
  if (!confirm('确定要恢复这个快照吗？将创建一个新的会话。')) {
    return;
  }
  
  const result = await api.restoreSnapshot(snapshotId);
  
  if (result && result.success) {
    showToast(t('snapshotRestored'));
    // 刷新会话列表
    const { loadSessions } = await import('./sessionManager.js');
    await loadSessions();
  } else {
    showToast('恢复快照失败');
  }
}

/**
 * 删除快照
 * @param {string} snapshotId - 快照 ID
 */
async function deleteSnapshot(snapshotId) {
  if (!confirm('确定要删除这个快照吗？')) {
    return;
  }
  
  const result = await api.deleteSnapshot(snapshotId);
  
  if (result && result.success) {
    showToast(t('snapshotDeleted'));
    await loadSnapshots();
  } else {
    showToast('删除快照失败');
  }
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
