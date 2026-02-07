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
 * 打开 URL
 * @param {string} url - URL
 * @returns {Promise<{success: boolean}>}
 */
export async function openUrl(url) {
  return await sendMessage({ action: 'openUrl', url });
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
