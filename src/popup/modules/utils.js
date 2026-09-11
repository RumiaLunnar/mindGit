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
    if (!['http:', 'https:'].includes(urlObj.protocol)) return '';
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
  } catch (e) {
    return '';
  }
}

/**
 * 检查 URL 是否允许被浏览器打开
 * @param {string} url - URL
 * @returns {boolean}
 */
export function isSafeUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;

  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'ftp:'].includes(parsed.protocol);
  } catch (e) {
    return false;
  }
}

/**
 * 获取可信的网站图标地址
 * @param {string} url - 页面 URL
 * @param {string} preferredUrl - 页面记录下来的图标 URL
 * @returns {string}
 */
export function getSafeFaviconUrl(url, preferredUrl = '') {
  if (isSafeUrl(preferredUrl)) return preferredUrl;
  return generateFaviconUrl(url);
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
  if (!isSafeUrl(url)) return false;
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
