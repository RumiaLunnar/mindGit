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
      state.elements.tokenConfigModal?.classList.remove('active');
    }
  });
}

/**
 * 设置 GitHub Gist 同步事件
 */
function setupSyncEvents() {
  const configureTokenBtn = document.getElementById('configureTokenBtn');
  const tokenConfigModal = document.getElementById('tokenConfigModal');
  const closeTokenConfig = document.getElementById('closeTokenConfig');
  const tokenInput = document.getElementById('tokenInput');
  const saveTokenBtn = document.getElementById('saveTokenBtn');
  const clearTokenBtn = document.getElementById('clearTokenBtn');
  const validationResult = document.getElementById('tokenValidationResult');
  
  // 打开配置弹窗
  if (configureTokenBtn) {
    configureTokenBtn.addEventListener('click', async () => {
      const { getGitHubToken } = await import('./gistSync.js');
      const currentToken = getGitHubToken();
      if (tokenInput) tokenInput.value = currentToken || '';
      if (validationResult) validationResult.textContent = '';
      if (tokenConfigModal) tokenConfigModal.classList.add('active');
      if (tokenInput) tokenInput.focus();
    });
  }
  
  // 关闭弹窗
  if (closeTokenConfig) {
    closeTokenConfig.addEventListener('click', () => {
      tokenConfigModal.classList.remove('active');
    });
  }
  
  // 点击遮罩关闭
  if (tokenConfigModal) {
    tokenConfigModal.addEventListener('click', (e) => {
      if (e.target === tokenConfigModal) {
        tokenConfigModal.classList.remove('active');
      }
    });
  }
  
  // 保存 Token
  if (saveTokenBtn) {
    saveTokenBtn.addEventListener('click', async () => {
      const token = tokenInput.value.trim();
      
      if (!token) {
        validationResult.textContent = '请输入 Token';
        validationResult.style.color = 'var(--danger-color)';
        return;
      }
      
      validationResult.textContent = '验证中...';
      validationResult.style.color = 'var(--text-secondary)';
      
      const { validateToken, saveGitHubToken } = await import('./gistSync.js');
      const result = await validateToken(token);
      
      if (result.valid) {
        await saveGitHubToken(token);
        validationResult.textContent = `✓ 验证通过: ${result.user}`;
        validationResult.style.color = 'var(--success-color)';
        setTimeout(async () => {
          tokenConfigModal.classList.remove('active');
          // 刷新设置界面
          const { updateCloudSyncUI } = await import('./settings.js');
          updateCloudSyncUI();
        }, 800);
      } else {
        validationResult.textContent = `✗ 验证失败: ${result.error}`;
        validationResult.style.color = 'var(--danger-color)';
      }
    });
  }
  
  // 清除 Token
  if (clearTokenBtn) {
    clearTokenBtn.addEventListener('click', async () => {
      const { saveGitHubToken } = await import('./gistSync.js');
      await saveGitHubToken('');
      tokenInput.value = '';
      validationResult.textContent = '已清除';
      validationResult.style.color = 'var(--text-muted)';
      setTimeout(async () => {
        tokenConfigModal.classList.remove('active');
        const { updateCloudSyncUI } = await import('./settings.js');
        updateCloudSyncUI();
      }, 500);
    });
  }
  
  // 上传到云端
  const uploadToCloudBtn = document.getElementById('uploadToCloudBtn');
  if (uploadToCloudBtn) {
    uploadToCloudBtn.addEventListener('click', async () => {
      const { getGitHubToken, uploadToCloud } = await import('./gistSync.js');
      const token = getGitHubToken();
      
      if (!token) {
        showToast('请先配置 GitHub Token');
        return;
      }
      
      uploadToCloudBtn.disabled = true;
      const originalText = uploadToCloudBtn.textContent;
      uploadToCloudBtn.textContent = '⬆️ 上传中...';
      
      try {
        await uploadToCloud();
      } catch (e) {
        showToast('上传失败: ' + e.message);
      } finally {
        uploadToCloudBtn.disabled = false;
        uploadToCloudBtn.textContent = originalText;
      }
    });
  }
  
  // 从云端下载
  const downloadFromCloudBtn = document.getElementById('downloadFromCloudBtn');
  if (downloadFromCloudBtn) {
    downloadFromCloudBtn.addEventListener('click', async () => {
      const { getGitHubToken, downloadFromCloud } = await import('./gistSync.js');
      const token = getGitHubToken();
      
      if (!token) {
        showToast('请先配置 GitHub Token');
        return;
      }
      
      downloadFromCloudBtn.disabled = true;
      const originalText = downloadFromCloudBtn.textContent;
      downloadFromCloudBtn.textContent = '⬇️ 下载中...';
      
      try {
        const result = await downloadFromCloud();
        if (result.conflict) {
          if (confirm('本地和云端数据不一致，要用云端数据覆盖本地吗？')) {
            await downloadFromCloud(true);
          }
        }
      } catch (e) {
        showToast('下载失败: ' + e.message);
      } finally {
        downloadFromCloudBtn.disabled = false;
        downloadFromCloudBtn.textContent = originalText;
      }
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
