// utils.js - 工具函数

/**
 * 截断文本
 * @param {string} text - 文本
 * @param {number} maxLength - 最大长度
 * @returns {string}
 */
export function truncateText(text, maxLength = 40) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * 截断 URL 显示
 * @param {string} url - URL
 * @param {number} maxLength - 最大长度
 * @returns {string}
 */
export function truncateUrl(url, maxLength = 35) {
  if (!url) return '';
  if (url.length <= maxLength) return url;
  
  try {
    const urlObj = new URL(url);
    let display = urlObj.hostname;
    if (urlObj.pathname !== '/' && urlObj.pathname.length > 1) {
      const path = urlObj.pathname;
      display += path.length > 20 ? path.substring(0, 20) + '...' : path;
    }
    return display;
  } catch (e) {
    return url.substring(0, maxLength) + '...';
  }
}

/**
 * HTML 转义
 * @param {string} text - 文本
 * @returns {string}
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 生成网站图标 URL
 * @param {string} url - 网站 URL
 * @returns {string}
 */
export function generateFaviconUrl(url) {
  try {
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
  } catch (e) {
    return '';
  }
}

/**
 * 计算会话数据的哈希值
 * @param {Object} sessions - 会话数据
 * @returns {string}
 */
export function hashSessions(sessions) {
  if (!sessions) return '';
  const keys = Object.keys(sessions).sort();
  let hash = '';
  for (const key of keys) {
    const session = sessions[key];
    const rootCount = session.rootNodes?.length || 0;
    const nodeCount = Object.keys(session.allNodes || {}).length;
    hash += `${key}:${rootCount},${nodeCount};`;
  }
  return hash;
}

/**
 * 防抖函数
 * @param {Function} func - 函数
 * @param {number} wait - 等待时间(ms)
 * @returns {Function}
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 格式化日期
 * @param {number} timestamp - 时间戳
 * @returns {string}
 */
export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 检查 URL 是否应该被记录
 * @param {string} url - URL
 * @returns {boolean}
 */
export function shouldTrackUrl(url) {
  if (!url) return false;
  const excludedPrefixes = [
    'chrome://',
    'chrome-extension://',
    'devtools://',
    'about:',
    'javascript:',
    'data:'
  ];
  return !excludedPrefixes.some(prefix => url.startsWith(prefix));
}
