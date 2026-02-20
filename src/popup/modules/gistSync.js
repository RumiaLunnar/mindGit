// gistSync.js - GitHub Gist 同步

import { state } from './state.js';
import { showToast } from './toast.js';

const GIST_FILENAME = 'mindgit-sync.json';
const SYNC_DELAY = 5000; // 变更后 5 秒同步

let syncTimer = null;
let lastSyncTime = 0;

/**
 * 获取 GitHub Token
 */
export function getGitHubToken() {
  return state.currentSettings?.githubToken || '';
}

/**
 * 保存 GitHub Token
 */
export async function saveGitHubToken(token) {
  state.currentSettings.githubToken = token;
  const { setStorage } = await import('./api.js');
  await setStorage({ 
    settings: { ...state.currentSettings }
  });
}

/**
 * 测试 Token 是否有效
 */
export async function validateToken(token) {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (response.ok) {
      const user = await response.json();
      return { valid: true, user: user.login };
    }
    return { valid: false, error: 'Token 无效' };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

/**
 * 查找已有的 MindGit Gist
 */
export async function findMindGitGist(token) {
  try {
    const response = await fetch('https://api.github.com/gists', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) throw new Error('获取 Gist 列表失败');
    
    const gists = await response.json();
    return gists.find(gist => gist.files[GIST_FILENAME]) || null;
  } catch (e) {
    console.error('[MindGit] 查找 Gist 失败:', e);
    return null;
  }
}

/**
 * 创建新的 Gist
 */
export async function createGist(token, data) {
  const content = JSON.stringify({
    version: '1.2',
    lastSync: Date.now(),
    device: navigator.userAgent.slice(0, 50),
    data
  }, null, 2);
  
  try {
    const response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description: 'MindGit 同步数据',
        public: false,
        files: {
          [GIST_FILENAME]: {
            content
          }
        }
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '创建 Gist 失败');
    }
    
    const gist = await response.json();
    return { success: true, gistId: gist.id, url: gist.html_url };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * 更新 Gist
 */
export async function updateGist(token, gistId, data) {
  const content = JSON.stringify({
    version: '1.2',
    lastSync: Date.now(),
    device: navigator.userAgent.slice(0, 50),
    data
  }, null, 2);
  
  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: {
          [GIST_FILENAME]: {
            content
          }
        }
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '更新 Gist 失败');
    }
    
    lastSyncTime = Date.now();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * 从 Gist 读取数据
 */
export async function fetchGist(token, gistId) {
  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) throw new Error('获取 Gist 失败');
    
    const gist = await response.json();
    const file = gist.files[GIST_FILENAME];
    
    if (!file) throw new Error('Gist 中没有 MindGit 数据');
    
    const content = JSON.parse(file.content);
    return { 
      success: true, 
      data: content.data,
      lastSync: content.lastSync,
      version: content.version
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * 上传到云端
 */
export async function uploadToCloud(force = false) {
  const token = getGitHubToken();
  if (!token) {
    showToast('请先配置 GitHub Token');
    return { success: false };
  }
  
  showToast('正在上传...');
  
  // 准备同步数据
  const syncData = {
    sessions: state.currentSessions,
    currentSessionId: state.currentSessionId,
    settings: state.currentSettings,
    exportTime: Date.now()
  };
  
  // 查找或创建 Gist
  let gist = await findMindGitGist(token);
  let result;
  
  if (gist) {
    result = await updateGist(token, gist.id, syncData);
  } else {
    result = await createGist(token, syncData);
    if (result.success) {
      // 保存 Gist ID 到设置
      state.currentSettings.gistId = result.gistId;
      const { setStorage } = await import('./api.js');
      await setStorage({ settings: state.currentSettings });
    }
  }
  
  if (result.success) {
    lastSyncTime = Date.now();
    showToast('已同步到云端 ✓');
  } else {
    showToast('同步失败: ' + result.error);
  }
  
  return result;
}

/**
 * 从云端下载
 */
export async function downloadFromCloud(force = false) {
  const token = getGitHubToken();
  if (!token) {
    showToast('请先配置 GitHub Token');
    return { success: false };
  }
  
  showToast('正在检查云端数据...');
  
  // 先查找 Gist
  let gistId = state.currentSettings?.gistId;
  let gist = null;
  
  if (gistId) {
    // 尝试获取指定的 Gist
    try {
      const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (response.ok) gist = await response.json();
    } catch (e) {}
  }
  
  // 如果没找到，搜索所有 Gist
  if (!gist) {
    gist = await findMindGitGist(token);
    if (gist) {
      // 保存找到的 Gist ID
      state.currentSettings.gistId = gist.id;
      const { setStorage } = await import('./api.js');
      await setStorage({ settings: state.currentSettings });
    }
  }
  
  if (!gist) {
    showToast('云端暂无数据');
    return { success: false, noData: true };
  }
  
  // 获取数据
  const result = await fetchGist(token, gist.id);
  
  if (!result.success) {
    showToast('获取数据失败: ' + result.error);
    return result;
  }
  
  // 检查冲突
  const localLastSync = state.currentSettings?.lastSyncTime || 0;
  
  if (!force && localLastSync > result.lastSync) {
    // 本地数据更新，询问用户
    return { 
      success: false, 
      conflict: true, 
      remoteData: result.data,
      remoteTime: result.lastSync
    };
  }
  
  // 应用云端数据
  await applyCloudData(result.data);
  lastSyncTime = result.lastSync;
  
  showToast('已从云端恢复数据 ✓');
  return { success: true };
}

/**
 * 应用云端数据到本地
 */
async function applyCloudData(data) {
  if (!data) return;
  
  const { setStorage } = await import('./api.js');
  
  // 合并数据
  if (data.sessions) {
    state.currentSessions = data.sessions;
  }
  if (data.currentSessionId) {
    state.currentSessionId = data.currentSessionId;
  }
  
  // 保存到 storage
  await setStorage({
    sessions: state.currentSessions,
    currentSession: state.currentSessionId
  });
  
  // 刷新视图
  if (state.currentSessionId) {
    const { loadSessionView } = await import('./viewManager.js');
    await loadSessionView(state.currentSessionId);
  }
  
  // 更新同步时间
  state.currentSettings.lastSyncTime = Date.now();
  await setStorage({ settings: state.currentSettings });
}

/**
 * 自动同步（防抖）
 */
export function scheduleAutoSync() {
  if (syncTimer) clearTimeout(syncTimer);
  
  const token = getGitHubToken();
  if (!token) return;
  
  syncTimer = setTimeout(() => {
    uploadToCloud();
  }, SYNC_DELAY);
}

/**
 * 初始化自动同步
 */
export function initAutoSync() {
  // 启动时尝试拉取
  const token = getGitHubToken();
  if (token) {
    setTimeout(() => {
      downloadFromCloud();
    }, 2000); // 延迟 2 秒，让界面先加载完
  }
  
  // 监听数据变化
  // 通过劫持关键操作来触发同步
}

/**
 * 获取同步状态
 */
export function getSyncStatus() {
  return {
    hasToken: !!getGitHubToken(),
    lastSync: lastSyncTime,
    gistId: state.currentSettings?.gistId
  };
}
