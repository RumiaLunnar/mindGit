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
  // 清理 token（去除前后空白和换行）
  const cleanToken = token.trim();
  
  if (!cleanToken) {
    return { valid: false, error: 'Token 不能为空' };
  }
  
  // 检查 token 格式 (ghp_ 开头的 40 位字符)
  if (!cleanToken.match(/^ghp_[a-zA-Z0-9]{36}$/)) {
    console.warn('[MindGit] Token 格式不标准，但仍尝试验证:', cleanToken.slice(0, 10) + '...');
  }
  
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'MindGit-Extension'
      }
    });
    
    if (response.ok) {
      const user = await response.json();
      console.log('[MindGit] Token 验证成功:', user.login);
      return { valid: true, user: user.login };
    }
    
    // 详细错误信息
    const errorData = await response.json().catch(() => ({}));
    console.error('[MindGit] Token 验证失败:', response.status, errorData);
    
    if (response.status === 401) {
      return { valid: false, error: 'Token 无效或已过期，请检查 Token 是否正确' };
    } else if (response.status === 403) {
      return { valid: false, error: 'API 访问受限，请稍后重试' };
    }
    
    return { valid: false, error: `验证失败 (${response.status})` };
  } catch (e) {
    console.error('[MindGit] Token 验证异常:', e);
    return { valid: false, error: '网络错误: ' + e.message };
  }
}

/**
 * 查找已有的 MindGit Gist
 */
export async function findMindGitGist(token) {
  try {
    const response = await fetch('https://api.github.com/gists', {
      headers: {
        'Authorization': `Bearer ${token.trim()}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'MindGit-Extension'
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
        'Authorization': `Bearer ${token.trim()}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'MindGit-Extension'
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
        'Authorization': `Bearer ${token.trim()}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'MindGit-Extension'
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
        'Authorization': `Bearer ${token.trim()}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'MindGit-Extension'
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
  
  // 准备设置数据（移除敏感字段）
  const { githubToken, gistId, ...safeSettings } = state.currentSettings;
  
  // 准备同步数据
  const syncData = {
    sessions: state.currentSessions,
    currentSessionId: state.currentSessionId,
    settings: safeSettings,
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
          'Authorization': `Bearer ${token.trim()}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'MindGit-Extension'
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
  const { applyColorTheme } = await import('./theme.js');
  const { setLang } = await import('./i18n.js');
  const { updateAllTexts } = await import('./i18nUI.js');
  
  // 保存本地 Token 配置（不要被云端覆盖）
  const localToken = state.currentSettings.githubToken;
  const localGistId = state.currentSettings.gistId;
  
  // 合并设置
  if (data.settings) {
    state.currentSettings = {
      ...data.settings,
      githubToken: localToken,      // 保留本地 Token
      gistId: localGistId,          // 保留本地 Gist ID
      lastSyncTime: Date.now()      // 更新同步时间
    };
    
    // 应用主题
    applyColorTheme(state.currentSettings.colorTheme || 'default');
    
    // 应用语言
    if (data.settings.language) {
      await setLang(data.settings.language);
      updateAllTexts();
    }
  }
  
  // 合并会话数据
  if (data.sessions) {
    state.currentSessions = data.sessions;
  }
  if (data.currentSessionId) {
    state.currentSessionId = data.currentSessionId;
  }
  
  // 保存到 storage
  await setStorage({
    sessions: state.currentSessions,
    currentSession: state.currentSessionId,
    settings: state.currentSettings
  });
  
  // 刷新视图
  if (state.currentSessionId) {
    const { loadSessionView } = await import('./viewManager.js');
    await loadSessionView(state.currentSessionId);
  }
  
  showToast('已同步设置和会话数据');
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
 * 初始化自动同步（启动时检查）
 * 方案 A+B: 手动同步 + 启动时检查
 */
export function initAutoSync() {
  const token = getGitHubToken();
  if (!token) {
    console.log('[MindGit] 未配置 Token，跳过启动检查');
    return;
  }
  
  // 延迟 3 秒执行，等待界面完全加载
  setTimeout(async () => {
    await checkCloudOnStartup();
  }, 3000);
}

/**
 * 启动时检查云端数据
 */
async function checkCloudOnStartup() {
  const token = getGitHubToken();
  if (!token) return;
  
  console.log('[MindGit] 启动检查云端数据...');
  
  try {
    // 获取本地同步时间
    const localLastSync = state.currentSettings?.lastSyncTime || 0;
    
    // 查找 Gist
    let gistId = state.currentSettings?.gistId;
    let gist = null;
    
    if (gistId) {
      try {
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
          headers: {
            'Authorization': `Bearer ${token.trim()}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'MindGit-Extension'
          }
        });
        if (response.ok) gist = await response.json();
      } catch (e) {}
    }
    
    if (!gist) {
      gist = await findMindGitGist(token);
      if (gist && gist.id !== gistId) {
        // 找到新的 Gist，更新 ID
        state.currentSettings.gistId = gist.id;
        const { setStorage } = await import('./api.js');
        await setStorage({ settings: state.currentSettings });
      }
    }
    
    if (!gist) {
      console.log('[MindGit] 云端无数据，跳过');
      return;
    }
    
    // 获取云端数据时间
    const result = await fetchGist(token, gist.id);
    if (!result.success) {
      console.log('[MindGit] 获取云端数据失败:', result.error);
      return;
    }
    
    const remoteLastSync = result.lastSync || 0;
    
    // 判断是否需要同步
    if (remoteLastSync > localLastSync + 5000) { // 云端比本地新5秒以上
      console.log('[MindGit] 发现云端有更新数据');
      
      // 显示同步提示
      showSyncNotification(result.data, result.lastSync);
    } else {
      console.log('[MindGit] 本地数据已是最新');
    }
  } catch (e) {
    console.error('[MindGit] 启动检查失败:', e);
  }
}

/**
 * 显示同步提示（静默模式 - 不弹窗）
 */
function showSyncNotification(remoteData, remoteTime) {
  // 仅在控制台输出提示，不弹出通知
  const date = new Date(remoteTime).toLocaleString();
  console.log(`[MindGit] 云端有更新 (${date})，使用顶部☁️ 按钮手动同步`);
  
  // 可选：在状态栏显示微弱提示
  const syncBtn = document.getElementById('syncBtn');
  if (syncBtn) {
    syncBtn.style.opacity = '0.8';
    syncBtn.title = '云端有更新，点击同步';
    // 3秒后恢复
    setTimeout(() => {
      syncBtn.style.opacity = '';
      syncBtn.title = '云端同步';
    }, 3000);
  }
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
