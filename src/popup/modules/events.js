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
  const { themeBtn, refreshBtn, newSessionBtn, searchBtn, exportBtn, settingsBtn, sessionListHeader, syncBtn } = state.elements;
  
  // 主题切换
  themeBtn.addEventListener('click', theme.toggleTheme);
  
  // 刷新按钮
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.innerHTML = '<span class="loading-spinner"></span>';
    await sessionManager.loadSessions();
    refreshBtn.innerHTML = '🔄';
    showToast('已刷新');
  });
  
  // 云端同步按钮
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      const { getGitHubToken, uploadToCloud, downloadFromCloud } = await import('./gistSync.js');
      const token = getGitHubToken();
      
      if (!token) {
        showToast('请先在设置中配置 GitHub Token');
        settings.openSettings();
        return;
      }
      
      syncBtn.innerHTML = '<span class="loading-spinner"></span>';
      syncBtn.disabled = true;
      
      try {
        // 首先尝试下载（检查是否有远程更新）
        const downloadResult = await downloadFromCloud();
        
        if (downloadResult.noData) {
          // 云端没数据，上传本地
          await uploadToCloud();
        } else if (downloadResult.conflict) {
          // 有冲突，让用户选择
          if (confirm('本地和云端数据不一致，要用云端数据覆盖本地吗？\n\n点确定: 用云端覆盖本地\n点取消: 保持本地数据')) {
            await downloadFromCloud(true);
          }
        } else if (downloadResult.success) {
          showToast('同步成功');
        }
      } catch (e) {
        showToast('同步失败: ' + e.message);
      } finally {
        syncBtn.innerHTML = '☁️';
        syncBtn.disabled = false;
      }
    });
  }
  
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
    renameSessionInput,
    aboutLink,
    aboutModal,
    closeAbout
  } = state.elements;
  
  // 设置面板
  closeSettings.addEventListener('click', settings.closeSettings);
  
  // 关于链接
  if (aboutLink) {
    aboutLink.addEventListener('click', (e) => {
      e.preventDefault();
      aboutModal?.classList.add('active');
    });
  }
  
  // 关于面板
  if (closeAbout) {
    closeAbout.addEventListener('click', () => {
      aboutModal?.classList.remove('active');
    });
  }
  
  if (aboutModal) {
    aboutModal.addEventListener('click', (e) => {
      if (e.target === aboutModal) aboutModal.classList.remove('active');
    });
  }
  
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
  
  // GitHub Gist 同步功能
  setupSyncEvents();
  
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
      snapshot.closeSnapshotModal();
      settings.closeSettings();
      state.elements.aboutModal?.classList.remove('active');
    }
  });
}

/**
 * 设置 GitHub Gist 同步事件
 */
function setupSyncEvents() {
  const {
    githubToken,
    validateTokenBtn,
    uploadToCloud,
    downloadFromCloud,
    syncActions,
    syncStatus
  } = state.elements;
  
  if (!githubToken) return;
  
  // Token 验证
  if (validateTokenBtn) {
    validateTokenBtn.addEventListener('click', async () => {
      const token = githubToken.value.trim();
      if (!token) {
        syncStatus.textContent = '请输入 Token';
        syncStatus.className = 'sync-status error';
        return;
      }
      
      validateTokenBtn.textContent = '⏳';
      const result = await (await import('./gistSync.js')).validateToken(token);
      
      if (result.valid) {
        validateTokenBtn.textContent = '✓';
        validateTokenBtn.classList.remove('invalid');
        syncStatus.textContent = `验证通过: ${result.user}`;
        syncStatus.className = 'sync-status success';
        if (syncActions) syncActions.style.display = 'flex';
        // 保存 Token
        await (await import('./gistSync.js')).saveGitHubToken(token);
      } else {
        validateTokenBtn.textContent = '✗';
        validateTokenBtn.classList.add('invalid');
        syncStatus.textContent = `验证失败: ${result.error}`;
        syncStatus.className = 'sync-status error';
        if (syncActions) syncActions.style.display = 'none';
      }
      
      setTimeout(() => {
        validateTokenBtn.textContent = '✓';
      }, 2000);
    });
  }
  
  // 上传到云端
  if (uploadToCloud) {
    uploadToCloud.addEventListener('click', async () => {
      uploadToCloud.disabled = true;
      uploadToCloud.textContent = '⬆️ 上传中...';
      const { uploadToCloud: upload } = await import('./gistSync.js');
      await upload();
      uploadToCloud.disabled = false;
      uploadToCloud.textContent = '⬆️ 上传到云端';
    });
  }
  
  // 从云端下载
  if (downloadFromCloud) {
    downloadFromCloud.addEventListener('click', async () => {
      downloadFromCloud.disabled = true;
      downloadFromCloud.textContent = '⬇️ 恢复中...';
      const { downloadFromCloud: download } = await import('./gistSync.js');
      const result = await download();
      
      if (result.conflict) {
        if (confirm('本地数据比云端更新，是否覆盖本地？')) {
          await download(true);
        }
      }
      
      downloadFromCloud.disabled = false;
      downloadFromCloud.textContent = '⬇️ 从云端恢复';
    });
  }
  
  // Token 输入时实时显示/隐藏同步按钮
  githubToken.addEventListener('input', () => {
    const hasToken = githubToken.value.trim().length > 0;
    if (syncActions) {
      syncActions.style.display = hasToken ? 'flex' : 'none';
    }
  });
}
