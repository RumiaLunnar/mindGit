// emojiPicker.js - Emoji 选择器

import { state } from './state.js';
import { showToast } from './toast.js';

// 常用 Emoji 列表
const COMMON_EMOJIS = [
  '📄', '💼', '📚', '🔍', '💡', '⚡', '🎯', '🎨',
  '🐛', '🔧', '📊', '📝', '💻', '🌐', '🔒', '⚙️',
  '📱', '🎮', '🛒', '💰', '📰', '🎵', '🎬', '📷',
  '🔬', '📖', '✈️', '🏠', '💊', '🍔', '👔', '🎓'
];

let pickerElement = null;
let currentSessionId = null;

/**
 * 显示 Emoji 选择器
 * @param {HTMLElement} targetEl - 目标元素（用于定位）
 * @param {string} sessionId - 会话 ID
 * @param {Function} onSelect - 选择回调
 */
export function showEmojiPicker(targetEl, sessionId, onSelect) {
  currentSessionId = sessionId;
  
  // 关闭已有的选择器
  hideEmojiPicker();
  
  // 创建选择器
  pickerElement = document.createElement('div');
  pickerElement.className = 'emoji-picker';
  
  // 创建 Emoji 网格
  const grid = document.createElement('div');
  grid.className = 'emoji-picker-grid';
  
  // 添加清除按钮
  const clearBtn = document.createElement('button');
  clearBtn.className = 'emoji-picker-clear';
  clearBtn.textContent = '清除';
  clearBtn.onclick = () => {
    onSelect(null);
    hideEmojiPicker();
  };
  
  // 添加 Emoji 按钮
  COMMON_EMOJIS.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'emoji-picker-item';
    btn.textContent = emoji;
    btn.onclick = () => {
      onSelect(emoji);
      hideEmojiPicker();
    };
    grid.appendChild(btn);
  });
  
  pickerElement.appendChild(grid);
  pickerElement.appendChild(clearBtn);
  
  document.body.appendChild(pickerElement);
  
  // 定位
  const rect = targetEl.getBoundingClientRect();
  pickerElement.style.left = `${rect.left}px`;
  pickerElement.style.top = `${rect.bottom + 4}px`;
  
  // 显示动画
  requestAnimationFrame(() => {
    pickerElement.classList.add('show');
  });
  
  // 点击外部关闭
  setTimeout(() => {
    document.addEventListener('click', handleOutsideClick);
  }, 10);
}

/**
 * 隐藏 Emoji 选择器
 */
export function hideEmojiPicker() {
  if (pickerElement) {
    pickerElement.remove();
    pickerElement = null;
  }
  document.removeEventListener('click', handleOutsideClick);
}

/**
 * 处理点击外部
 */
function handleOutsideClick(e) {
  if (pickerElement && !pickerElement.contains(e.target)) {
    hideEmojiPicker();
  }
}

/**
 * 更新会话 Emoji
 * @param {string} sessionId - 会话 ID
 * @param {string|null} emoji - Emoji 或 null 清除
 */
export async function updateSessionEmoji(sessionId, emoji) {
  try {
    const session = state.currentSessions[sessionId];
    if (!session) return;
    
    if (emoji) {
      session.emoji = emoji;
    } else {
      delete session.emoji;
    }
    
    // 保存到存储
    const { setStorage } = await import('./api.js');
    await setStorage({ sessions: state.currentSessions });
    
    showToast(emoji ? `已设置 ${emoji}` : '已清除标签');
  } catch (e) {
    console.error('更新 Emoji 失败:', e);
  }
}
