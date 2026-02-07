// toast.js - Toast 提示

let toastTimeout = null;

/**
 * 显示 Toast 提示
 * @param {string} message - 消息内容
 * @param {number} duration - 显示时长(ms)
 */
export function showToast(message, duration = 2000) {
  // 移除已有的 toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  toastTimeout = setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
}
