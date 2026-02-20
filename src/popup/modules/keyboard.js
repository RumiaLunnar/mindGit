// keyboard.js - 快捷键系统

import { state } from './state.js';
import { showToast } from './toast.js';

let selectedNodeId = null;
let isHelpOpen = false;

/**
 * 初始化快捷键系统
 */
export function initKeyboard() {
  // 使用 keydown 但确保不阻止其他组件正常工作
  document.addEventListener('keydown', handleKeyDown, { passive: false });
  console.log('[MindGit] 快捷键系统已初始化');
}

/**
 * 处理键盘事件
 */
function handleKeyDown(e) {
  // 如果在输入框中，只处理 Escape
  const target = e.target;
  const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
  
  if (isInput) {
    if (e.key === 'Escape') {
      e.target.blur(); // 失焦输入框
    }
    return; // 让输入框正常处理其他按键
  }
  
  // 特殊按键单独处理
  const key = e.key;
  const ctrl = e.ctrlKey || e.metaKey;
  
  // 帮助面板切换 (?) - 最高优先级
  if (key === '?' && !ctrl) {
    e.preventDefault();
    toggleHelp();
    return;
  }
  
  // 如果帮助面板打开，按任意键关闭（除了 ESC 由下面处理）
  if (isHelpOpen && key !== 'Escape') {
    closeHelp();
    return;
  }
  
  // ESC 关闭弹窗
  if (key === 'Escape') {
    const anyModal = document.querySelector('.modal.active');
    if (anyModal) {
      anyModal.classList.remove('active');
      isHelpOpen = false;
    }
    return;
  }
  
  // 检查是否有模态框打开（帮助面板除外）
  const hasModalOpen = document.querySelector('.modal.active:not(#keyboardHelpModal)');
  if (hasModalOpen) return;
  
  // 全局快捷键
  if (key === '/' || (ctrl && key.toLowerCase() === 'k')) {
    e.preventDefault();
    openSearch();
    return;
  }
  
  if (key.toLowerCase() === 'n' && !ctrl) {
    e.preventDefault();
    openNewSession();
    return;
  }
  
  if (key.toLowerCase() === 's' && !ctrl) {
    e.preventDefault();
    openSettings();
    return;
  }
  
  // 批量操作
  if (key.toLowerCase() === 'e' && !ctrl) {
    e.preventDefault();
    expandAllNodes();
    return;
  }
  
  if (key.toLowerCase() === 'c' && !ctrl) {
    e.preventDefault();
    collapseAllNodes();
    return;
  }
  
  // Enter 打开选中节点
  if (key === 'Enter' && selectedNodeId && !document.querySelector('.modal.active')) {
    e.preventDefault();
    openSelectedNode();
    return;
  }
  
  // 节点导航和操作
  handleNodeNavigation(e);
}

/**
 * 处理节点导航
 */
function handleNodeNavigation(e) {
  const key = e.key;
  const lowerKey = key.toLowerCase();
  
  // 检查是否是导航键
  const isNavKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key) ||
                   ['j', 'k', 'h', 'l'].includes(lowerKey);
  
  if (!isNavKey) return;
  
  e.preventDefault();
  
  // 如果没有选中节点，选中第一个可见节点
  if (!selectedNodeId) {
    const firstNode = getAllVisibleNodes()[0];
    if (firstNode) {
      selectNode(firstNode.id);
    }
    return;
  }
  
  // 处理导航
  switch (lowerKey) {
    case 'arrowup':
    case 'k':
      navigateNode(-1);
      break;
    case 'arrowdown':
    case 'j':
      navigateNode(1);
      break;
    case 'arrowleft':
    case 'h':
      toggleSelectedNode(false);
      break;
    case 'arrowright':
    case 'l':
      toggleSelectedNode(true);
      break;
  }
}

// 已合并到 handleNodeNavigation 中

/**
 * 打开搜索
 */
async function openSearch() {
  try {
    const { openSearchModal } = await import('./search.js');
    if (openSearchModal) openSearchModal();
  } catch (e) {
    console.log('[MindGit] 搜索模块未就绪');
  }
}

/**
 * 新建会话
 */
async function openNewSession() {
  try {
    const { openNewSessionModal } = await import('./sessionUI.js');
    if (openNewSessionModal) openNewSessionModal();
  } catch (e) {
    console.log('[MindGit] 会话模块未就绪');
  }
}

/**
 * 打开设置
 */
async function openSettings() {
  try {
    const { openSettings } = await import('./settings.js');
    if (openSettings) openSettings();
  } catch (e) {
    console.log('[MindGit] 设置模块未就绪');
  }
}

/**
 * 展开所有节点
 */
function expandAllNodes() {
  let count = 0;
  document.querySelectorAll('.children-container.collapsed').forEach(container => {
    const toggle = container.closest('.tree-node')?.querySelector('.node-toggle:not(.leaf)');
    if (toggle) {
      toggle.click();
      count++;
    }
  });
  if (count > 0) showToast(`已展开 ${count} 个节点`);
}

/**
 * 折叠所有节点
 */
function collapseAllNodes() {
  let count = 0;
  document.querySelectorAll('.children-container:not(.collapsed)').forEach(container => {
    const toggle = container.closest('.tree-node')?.querySelector('.node-toggle:not(.leaf)');
    if (toggle) {
      toggle.click();
      count++;
    }
  });
  if (count > 0) showToast(`已折叠 ${count} 个节点`);
}

/**
 * 导航到上一个/下一个节点
 */
function navigateNode(direction) {
  const nodes = getAllVisibleNodes();
  if (nodes.length === 0) return;
  
  let currentIndex = selectedNodeId ? nodes.findIndex(n => n.id === selectedNodeId) : -1;
  
  if (currentIndex === -1) {
    currentIndex = direction > 0 ? -1 : nodes.length;
  }
  
  const newIndex = currentIndex + direction;
  
  if (newIndex >= 0 && newIndex < nodes.length) {
    selectNode(nodes[newIndex].id);
  }
}

/**
 * 获取所有可见节点
 */
function getAllVisibleNodes() {
  const nodes = [];
  const container = document.getElementById('treeContainer');
  if (!container) return nodes;
  
  container.querySelectorAll('.tree-node').forEach(el => {
    if (el.offsetParent !== null) {
      nodes.push({ id: el.dataset.nodeId, element: el });
    }
  });
  
  return nodes;
}

/**
 * 选中节点
 */
function selectNode(nodeId) {
  // 清除之前的选择
  document.querySelectorAll('.tree-node.keyboard-selected').forEach(el => {
    el.classList.remove('keyboard-selected');
  });
  
  selectedNodeId = nodeId;
  
  const nodeEl = document.querySelector(`.tree-node[data-node-id="${nodeId}"]`);
  if (nodeEl) {
    nodeEl.classList.add('keyboard-selected');
    nodeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    nodeEl.focus();
  }
}

/**
 * 展开/折叠选中的节点
 */
function toggleSelectedNode(expand) {
  if (!selectedNodeId) return;
  
  const nodeEl = document.querySelector(`.tree-node[data-node-id="${selectedNodeId}"]`);
  if (!nodeEl) return;
  
  const toggle = nodeEl.querySelector('.node-toggle:not(.leaf)');
  if (!toggle) return;
  
  const childrenContainer = nodeEl.querySelector('.children-container');
  if (!childrenContainer) return;
  
  const isExpanded = !childrenContainer.classList.contains('collapsed');
  
  if (expand && !isExpanded) {
    toggle.click();
  } else if (!expand && isExpanded) {
    toggle.click();
  }
}

/**
 * 打开选中的节点
 */
async function openSelectedNode() {
  if (!selectedNodeId) return;
  
  const session = state.currentSessions[state.currentSessionId];
  if (!session) return;
  
  const node = session.allNodes[selectedNodeId];
  if (!node || !node.url) return;
  
  try {
    await chrome.tabs.create({ url: node.url, active: true });
    showToast('已打开链接');
  } catch (e) {
    window.open(node.url, '_blank');
  }
}

/**
 * 切换帮助面板
 */
function toggleHelp() {
  const existing = document.getElementById('keyboardHelpModal');
  if (existing) {
    existing.remove();
    isHelpOpen = false;
  } else {
    showHelp();
  }
}

/**
 * 关闭帮助面板
 */
function closeHelp() {
  const existing = document.getElementById('keyboardHelpModal');
  if (existing) {
    existing.remove();
    isHelpOpen = false;
  }
}

/**
 * 显示快捷键帮助
 */
function showHelp() {
  isHelpOpen = true;
  
  const modal = document.createElement('div');
  modal.id = 'keyboardHelpModal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content help-modal-content">
      <div class="modal-header">
        <h2>⌨️ 快捷键</h2>
        <button class="close-btn" id="closeHelp">&times;</button>
      </div>
      <div class="help-body">
        <div class="help-section">
          <h3>全局操作</h3>
          <div class="help-item"><kbd>/</kbd> / <kbd>Ctrl+K</kbd><span>打开搜索</span></div>
          <div class="help-item"><kbd>?</kbd><span>显示帮助</span></div>
          <div class="help-item"><kbd>N</kbd><span>新建会话</span></div>
          <div class="help-item"><kbd>S</kbd><span>打开设置</span></div>
          <div class="help-item"><kbd>Esc</kbd><span>关闭弹窗</span></div>
        </div>
        <div class="help-section">
          <h3>节点导航</h3>
          <div class="help-item"><kbd>↑</kbd> / <kbd>K</kbd><span>上一个</span></div>
          <div class="help-item"><kbd>↓</kbd> / <kbd>J</kbd><span>下一个</span></div>
          <div class="help-item"><kbd>←</kbd> / <kbd>H</kbd><span>折叠节点</span></div>
          <div class="help-item"><kbd>→</kbd> / <kbd>L</kbd><span>展开节点</span></div>
          <div class="help-item"><kbd>Enter</kbd><span>打开链接</span></div>
        </div>
        <div class="help-section">
          <h3>批量操作</h3>
          <div class="help-item"><kbd>E</kbd><span>展开全部</span></div>
          <div class="help-item"><kbd>C</kbd><span>折叠全部</span></div>
        </div>
      </div>
    </div>
  `;
  
  modal.querySelector('#closeHelp').addEventListener('click', () => {
    modal.remove();
    isHelpOpen = false;
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
      isHelpOpen = false;
    }
  });
  
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('active'));
}
