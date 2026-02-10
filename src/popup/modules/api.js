// api.js - 与后台脚本通信的 API

/**
 * 发送消息到后台脚本
 * @param {Object} message - 消息对象
 * @returns {Promise<any>} 响应结果
 */
export async function sendMessage(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (e) {
    console.error('[MindGit] API 调用失败:', e);
    return null;
  }
}

/**
 * 唤醒 Service Worker
 * @returns {Promise<boolean>}
 */
export async function ping() {
  try {
    const result = await chrome.runtime.sendMessage({ action: 'ping' });
    return result && result.pong;
  } catch (e) {
    console.warn('[MindGit] Ping 失败:', e);
    return false;
  }
}

/**
 * 获取所有会话
 * @returns {Promise<{sessions: Object, currentSession: string}>}
 */
export async function getSessions() {
  return await sendMessage({ action: 'getSessions' });
}

/**
 * 获取指定会话的树形结构
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<{session: Object}>}
 */
export async function getSessionTree(sessionId) {
  return await sendMessage({ action: 'getSessionTree', sessionId });
}

/**
 * 创建新会话
 * @param {string} name - 会话名称
 * @returns {Promise<{success: boolean, sessionId: string}>}
 */
export async function createNewSession(name) {
  return await sendMessage({ action: 'createNewSession', name });
}

/**
 * 切换当前会话
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<{success: boolean}>}
 */
export async function switchSession(sessionId) {
  return await sendMessage({ action: 'switchSession', sessionId });
}

/**
 * 重命名会话
 * @param {string} sessionId - 会话 ID
 * @param {string} name - 新名称
 * @returns {Promise<{success: boolean}>}
 */
export async function renameSession(sessionId, name) {
  return await sendMessage({ action: 'renameSession', sessionId, name });
}

/**
 * 删除会话
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteSession(sessionId) {
  return await sendMessage({ action: 'deleteSession', sessionId });
}

/**
 * 删除节点
 * @param {string} sessionId - 会话 ID
 * @param {string} nodeId - 节点 ID
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteNode(sessionId, nodeId) {
  return await sendMessage({ action: 'deleteNode', sessionId, nodeId });
}

/**
 * 清空所有会话
 * @returns {Promise<{success: boolean}>}
 */
export async function clearAllSessions() {
  return await sendMessage({ action: 'clearAllSessions' });
}

/**
 * 添加节点到会话
 * @param {Object} params - 参数
 * @returns {Promise<{success: boolean, nodeId: string}>}
 */
export async function addNode(params) {
  return await sendMessage({ action: 'addNode', ...params });
}

/**
 * 打开 URL - 直接在 popup 中处理，不依赖后台脚本
 * @param {string} url - URL
 * @returns {Promise<{success: boolean}>}
 */
export async function openUrl(url) {
  console.log('[MindGit popup] 打开 URL:', url);
  try {
    // 先查找是否已有相同 URL 的标签页
    const allTabs = await chrome.tabs.query({});
    console.log('[MindGit popup] 所有标签页:', allTabs.map(t => t.url));
    
    // 尝试精确匹配
    let matchedTab = allTabs.find(tab => tab.url === url);
    
    // 忽略 hash 匹配
    if (!matchedTab) {
      try {
        const targetUrl = new URL(url);
        matchedTab = allTabs.find(tab => {
          if (!tab.url) return false;
          try {
            const tabUrl = new URL(tab.url);
            return tabUrl.hostname === targetUrl.hostname && 
                   tabUrl.pathname === targetUrl.pathname &&
                   tabUrl.search === targetUrl.search;
          } catch (e) {
            return false;
          }
        });
      } catch (e) {
        console.error('[MindGit popup] URL 解析失败:', e);
      }
    }
    
    if (matchedTab) {
      // 切换到已存在的标签页
      await chrome.tabs.update(matchedTab.id, { active: true });
      await chrome.windows.update(matchedTab.windowId, { focused: true });
      console.log('[MindGit popup] ✓ 切换到已存在标签页:', matchedTab.url);
    } else {
      // 创建新标签页
      await chrome.tabs.create({ url });
      console.log('[MindGit popup] ✓ 创建新标签页:', url);
    }
    
    return { success: true };
  } catch (e) {
    console.error('[MindGit popup] 打开 URL 失败:', e);
    // 如果失败，尝试简单创建新标签页
    try {
      await chrome.tabs.create({ url });
      return { success: true };
    } catch (e2) {
      console.error('[MindGit popup] 创建标签页也失败:', e2);
      return { success: false, error: e.message };
    }
  }
}

/**
 * 获取当前活动标签页
 * @returns {Promise<chrome.tabs.Tab[]>}
 */
export async function getActiveTab() {
  return await chrome.tabs.query({ active: true, currentWindow: true });
}

/**
 * 获取本地存储
 * @param {string|Array<string>} keys - 键
 * @returns {Promise<Object>}
 */
export async function getStorage(keys) {
  return await chrome.storage.local.get(keys);
}

/**
 * 设置本地存储
 * @param {Object} data - 数据
 * @returns {Promise<void>}
 */
export async function setStorage(data) {
  return await chrome.storage.local.set(data);
}

/**
 * 监听存储变化
 * @param {Function} callback - 回调函数
 */
export function onStorageChanged(callback) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.sessions) {
      callback(changes.sessions);
    }
  });
}

/**
 * 创建快照
 * @param {string} sessionId - 会话 ID
 * @param {string} name - 快照名称
 * @returns {Promise<{success: boolean, snapshotId: string}>}
 */
export async function createSnapshot(sessionId, name) {
  return await sendMessage({ action: 'createSnapshot', sessionId, name });
}

/**
 * 获取所有快照
 * @returns {Promise<{snapshots: Object}>}
 */
export async function getSnapshots() {
  return await sendMessage({ action: 'getSnapshots' });
}

/**
 * 删除快照
 * @param {string} snapshotId - 快照 ID
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteSnapshot(snapshotId) {
  return await sendMessage({ action: 'deleteSnapshot', snapshotId });
}

/**
 * 恢复快照
 * @param {string} snapshotId - 快照 ID
 * @returns {Promise<{success: boolean, sessionId: string}>}
 */
export async function restoreSnapshot(snapshotId) {
  return await sendMessage({ action: 'restoreSnapshot', snapshotId });
}

/**
 * 移动节点
 * @param {string} sessionId - 会话 ID
 * @param {string} nodeId - 节点 ID
 * @param {string|null} newParentId - 新父节点 ID（null表示移为根节点）
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function moveNode(sessionId, nodeId, newParentId) {
  return await sendMessage({ action: 'moveNode', sessionId, nodeId, newParentId });
}
