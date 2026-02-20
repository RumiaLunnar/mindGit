// dragDrop.js - 拖拽功能

import { state } from './state.js';
import * as api from './api.js';
import { showToast } from './toast.js';

let draggedNodeId = null;
let draggedSessionId = null;
let dropIndicator = null;
let isDraggingOverSession = false;

/**
 * 初始化拖拽功能
 */
export function initTreeDragDrop() {
  const treeContainer = document.getElementById('treeContainer');
  if (!treeContainer) return;

  // 创建全局放置指示器
  createDropIndicator();
  
  // 为所有拖拽手柄绑定事件
  bindDragHandles(treeContainer);
  
  // 监听 treeContainer 的变化，为新节点绑定事件
  const observer = new MutationObserver(() => {
    bindDragHandles(treeContainer);
  });
  observer.observe(treeContainer, { childList: true, subtree: true });

  // 容器上的放置事件
  treeContainer.addEventListener('dragover', handleDragOver, { passive: false });
  treeContainer.addEventListener('dragleave', handleDragLeave);
  treeContainer.addEventListener('drop', handleDrop, { passive: false });
  
  // 初始化会话列表拖放
  initSessionListDragDrop();
  
  // 监听会话列表变化
  const sessionList = document.getElementById('sessionList');
  if (sessionList) {
    const sessionObserver = new MutationObserver(() => {
      initSessionListDragDrop();
    });
    sessionObserver.observe(sessionList, { childList: true });
  }
  
  // 全局拖拽结束事件
  document.addEventListener('dragend', handleDragEnd);
}

/**
 * 初始化会话列表拖放
 */
function initSessionListDragDrop() {
  const sessionItems = document.querySelectorAll('.session-item');
  
  sessionItems.forEach(item => {
    if (item.dataset.dragSessionBound) return;
    item.dataset.dragSessionBound = 'true';
    
    item.addEventListener('dragover', handleSessionDragOver);
    item.addEventListener('dragleave', handleSessionDragLeave);
    item.addEventListener('drop', handleSessionDrop);
  });
}

/**
 * 创建放置指示器
 */
function createDropIndicator() {
  if (dropIndicator) return;
  dropIndicator = document.createElement('div');
  dropIndicator.className = 'drop-indicator';
  dropIndicator.style.cssText = `
    position: fixed;
    height: 3px;
    background: var(--primary-color, #4a90d9);
    border-radius: 2px;
    pointer-events: none;
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.15s;
    box-shadow: 0 0 4px var(--primary-color, #4a90d9);
  `;
  document.body.appendChild(dropIndicator);
}

/**
 * 为拖拽手柄绑定事件
 */
function bindDragHandles(container) {
  container.querySelectorAll('.drag-handle').forEach(handle => {
    if (handle.dataset.dragBound) return;
    handle.dataset.dragBound = 'true';
    
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    
    handle.addEventListener('dragstart', handleDragStart);
    handle.addEventListener('dragend', handleDragEnd);
    
    handle.draggable = true;
  });
}

function handleDragStart(e) {
  const handle = e.target;
  const nodeEl = handle.closest('.tree-node');
  
  if (!nodeEl) {
    e.preventDefault();
    return;
  }
  
  draggedNodeId = nodeEl.dataset.nodeId;
  draggedSessionId = state.currentSessionId;
  
  // 设置拖拽效果
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedNodeId);
  
  // 隐藏默认拖拽图像，使用自定义样式
  nodeEl.classList.add('dragging');
  document.body.classList.add('is-dragging');
  
  // 在节点内显示拖拽中状态
  const content = nodeEl.querySelector('.node-content');
  if (content) {
    content.style.opacity = '0.5';
  }
  
  // 高亮会话列表表示可以放置
  document.body.classList.add('can-drop-to-session');
}

function handleDragEnd(e) {
  // 清理所有拖拽样式
  document.querySelectorAll('.dragging').forEach(el => {
    el.classList.remove('dragging');
    const content = el.querySelector('.node-content');
    if (content) content.style.opacity = '';
  });
  
  document.querySelectorAll('.drag-over').forEach(el => {
    el.classList.remove('drag-over');
  });
  
  document.querySelectorAll('.session-item.drag-over-session').forEach(el => {
    el.classList.remove('drag-over-session');
  });
  
  document.body.classList.remove('is-dragging');
  document.body.classList.remove('can-drop-to-session');
  
  // 隐藏放置指示器
  if (dropIndicator) {
    dropIndicator.style.opacity = '0';
  }
  
  draggedNodeId = null;
  draggedSessionId = null;
  isDraggingOverSession = false;
}

function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  
  if (!draggedNodeId || isDraggingOverSession) return;
  
  e.dataTransfer.dropEffect = 'move';
  
  const targetEl = e.target.closest('.tree-node');
  
  // 清理旧的高亮
  document.querySelectorAll('.drag-over').forEach(el => {
    el.classList.remove('drag-over');
  });
  
  // 如果在空白区域，隐藏指示器
  if (!targetEl) {
    if (dropIndicator) dropIndicator.style.opacity = '0';
    return;
  }
  
  const targetNodeId = targetEl.dataset.nodeId;
  
  // 不能拖拽到自己
  if (targetNodeId === draggedNodeId) {
    if (dropIndicator) dropIndicator.style.opacity = '0';
    return;
  }
  
  // 检查是否是子节点
  if (isDescendant(draggedNodeId, targetNodeId)) {
    if (dropIndicator) dropIndicator.style.opacity = '0';
    return;
  }
  
  // 计算放置位置
  const rect = targetEl.getBoundingClientRect();
  const relativeY = e.clientY - rect.top;
  const height = rect.height;
  
  let dropPosition = 'center';
  if (relativeY < height * 0.25) {
    dropPosition = 'top';
  } else if (relativeY > height * 0.75) {
    dropPosition = 'bottom';
  }
  
  // 设置目标节点高亮
  targetEl.classList.add('drag-over');
  targetEl.dataset.dropPosition = dropPosition;
  
  // 更新放置指示器位置
  updateDropIndicator(rect, dropPosition);
}

function updateDropIndicator(rect, position) {
  if (!dropIndicator) return;
  
  const treeContainer = document.getElementById('treeContainer');
  const containerRect = treeContainer?.getBoundingClientRect();
  if (!containerRect) return;
  
  const left = containerRect.left + 20;
  const width = containerRect.width - 40;
  
  dropIndicator.style.left = left + 'px';
  dropIndicator.style.width = width + 'px';
  
  if (position === 'top') {
    dropIndicator.style.top = rect.top + 'px';
  } else if (position === 'bottom') {
    dropIndicator.style.top = (rect.bottom - 3) + 'px';
  } else {
    dropIndicator.style.opacity = '0';
    return;
  }
  
  dropIndicator.style.opacity = '1';
}

function handleDragLeave(e) {
  const targetEl = e.target.closest('.tree-node');
  if (targetEl) {
    targetEl.classList.remove('drag-over');
    delete targetEl.dataset.dropPosition;
  }
}

/**
 * 处理会话列表拖放经过
 */
function handleSessionDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  
  if (!draggedNodeId) return;
  
  const sessionEl = e.target.closest('.session-item');
  if (!sessionEl) return;
  
  const targetSessionId = sessionEl.dataset.sessionId;
  
  // 不能放到当前会话
  if (targetSessionId === draggedSessionId) return;
  
  isDraggingOverSession = true;
  e.dataTransfer.dropEffect = 'move';
  
  // 高亮会话项
  document.querySelectorAll('.session-item.drag-over-session').forEach(el => {
    el.classList.remove('drag-over-session');
  });
  sessionEl.classList.add('drag-over-session');
  
  // 隐藏节点指示器
  if (dropIndicator) dropIndicator.style.opacity = '0';
}

function handleSessionDragLeave(e) {
  const sessionEl = e.target.closest('.session-item');
  if (sessionEl) {
    sessionEl.classList.remove('drag-over-session');
  }
  isDraggingOverSession = false;
}

/**
 * 处理放置到会话
 */
async function handleSessionDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  
  if (!draggedNodeId || !draggedSessionId) {
    cleanupDragState();
    return;
  }
  
  const sessionEl = e.target.closest('.session-item');
  if (!sessionEl) {
    cleanupDragState();
    return;
  }
  
  const targetSessionId = sessionEl.dataset.sessionId;
  
  // 不能放到当前会话
  if (targetSessionId === draggedSessionId) {
    showToast('不能移动到当前会话');
    cleanupDragState();
    return;
  }
  
  // 执行跨会话移动
  await moveNodeToSession(draggedSessionId, targetSessionId, draggedNodeId);
  
  cleanupDragState();
}

async function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  
  // 隐藏指示器
  if (dropIndicator) {
    dropIndicator.style.opacity = '0';
  }
  
  // 清理高亮
  document.querySelectorAll('.drag-over').forEach(el => {
    el.classList.remove('drag-over');
    delete el.dataset.dropPosition;
  });
  
  if (!draggedNodeId || !draggedSessionId) {
    cleanupDragState();
    return;
  }
  
  const targetEl = e.target.closest('.tree-node');
  
  // 检查是否在空白区域放置（移到根节点）
  if (!targetEl) {
    await moveNode(draggedSessionId, draggedNodeId, null);
    cleanupDragState();
    return;
  }
  
  const targetNodeId = targetEl.dataset.nodeId;
  
  // 不能放到自己
  if (targetNodeId === draggedNodeId) {
    cleanupDragState();
    return;
  }
  
  // 检查循环
  if (isDescendant(draggedNodeId, targetNodeId)) {
    showToast('不能拖拽到子节点');
    cleanupDragState();
    return;
  }
  
  // 获取放置位置
  const rect = targetEl.getBoundingClientRect();
  const relativeY = e.clientY - rect.top;
  const height = rect.height;
  
  if (relativeY < height * 0.25) {
    // 放在上方 - 成为兄弟节点（在目标前面）
    await moveAsSibling(draggedSessionId, draggedNodeId, targetNodeId, 'before');
  } else if (relativeY > height * 0.75) {
    // 放在下方 - 成为兄弟节点（在目标后面）
    await moveAsSibling(draggedSessionId, draggedNodeId, targetNodeId, 'after');
  } else {
    // 放在中间 - 成为子节点
    await moveNode(draggedSessionId, draggedNodeId, targetNodeId);
  }
  
  cleanupDragState();
}

function cleanupDragState() {
  document.querySelectorAll('.dragging').forEach(el => {
    el.classList.remove('dragging');
    const content = el.querySelector('.node-content');
    if (content) content.style.opacity = '';
  });
  
  document.querySelectorAll('.drag-over').forEach(el => {
    el.classList.remove('drag-over');
  });
  
  document.querySelectorAll('.session-item.drag-over-session').forEach(el => {
    el.classList.remove('drag-over-session');
  });
  
  document.body.classList.remove('is-dragging');
  document.body.classList.remove('can-drop-to-session');
  
  draggedNodeId = null;
  draggedSessionId = null;
  isDraggingOverSession = false;
}

function isDescendant(ancestorId, descendantId) {
  if (ancestorId === descendantId) return false;
  
  const session = state.currentSessions[state.currentSessionId];
  if (!session) return false;
  
  let node = session.allNodes[descendantId];
  while (node && node.parentId) {
    if (node.parentId === ancestorId) {
      return true;
    }
    node = session.allNodes[node.parentId];
  }
  return false;
}

async function moveNode(sessionId, nodeId, newParentId) {
  try {
    const result = await api.moveNode(sessionId, nodeId, newParentId);
    
    if (!result) {
      showToast('移动失败: 无响应');
      return;
    }
    
    if (result.success) {
      // 更新前端状态
      const treeResult = await api.getSessionTree(sessionId);
      if (treeResult.session) {
        state.currentSessions[sessionId] = treeResult.session;
      }
      
      const { loadSessionView } = await import('./viewManager.js');
      await loadSessionView(sessionId);
      showToast(newParentId ? '已移动为子节点' : '已移动到根节点');
    } else {
      showToast(result.error || '移动失败');
    }
  } catch (e) {
    console.error('[MindGit] moveNode 异常:', e);
    showToast('移动失败');
  }
}

async function moveAsSibling(sessionId, nodeId, targetId, position) {
  try {
    // 获取最新会话数据
    const treeResult = await api.getSessionTree(sessionId);
    if (!treeResult.session) {
      showToast('加载会话失败');
      return;
    }
    
    const session = treeResult.session;
    const targetNode = session.allNodes[targetId];
    if (!targetNode) {
      showToast('目标节点不存在');
      return;
    }
    
    const parentId = targetNode.parentId;
    
    // 先移到父节点下
    let result = await api.moveNode(sessionId, nodeId, parentId);
    
    if (!result || !result.success) {
      showToast(result?.error || '移动失败');
      return;
    }
    
    // 重新获取数据调整顺序
    const afterMoveResult = await api.getSessionTree(sessionId);
    if (!afterMoveResult.session) {
      showToast('获取数据失败');
      return;
    }
    
    const freshSession = afterMoveResult.session;
    state.currentSessions[sessionId] = freshSession;
    
    // 调整顺序
    if (parentId) {
      const parent = freshSession.allNodes[parentId];
      if (parent) {
        const children = [...(parent.children || [])];
        const currentIndex = children.indexOf(nodeId);
        if (currentIndex > -1) {
          children.splice(currentIndex, 1);
          let targetIndex = children.indexOf(targetId);
          if (targetIndex > -1) {
            if (position === 'after') targetIndex++;
            children.splice(targetIndex, 0, nodeId);
            parent.children = children;
            await api.setStorage({ 
              sessions: { ...state.currentSessions, [sessionId]: freshSession } 
            });
          }
        }
      }
    } else {
      // 根节点级别
      const rootNodes = [...freshSession.rootNodes];
      const currentIndex = rootNodes.indexOf(nodeId);
      if (currentIndex > -1) {
        rootNodes.splice(currentIndex, 1);
        let targetIndex = rootNodes.indexOf(targetId);
        if (targetIndex > -1) {
          if (position === 'after') targetIndex++;
          rootNodes.splice(targetIndex, 0, nodeId);
          freshSession.rootNodes = rootNodes;
          await api.setStorage({ 
            sessions: { ...state.currentSessions, [sessionId]: freshSession } 
          });
        }
      }
    }
    
    const { loadSessionView } = await import('./viewManager.js');
    await loadSessionView(sessionId);
    showToast('已移动节点');
  } catch (e) {
    console.error('[MindGit] moveAsSibling 异常:', e);
    showToast('移动失败');
  }
}

/**
 * 跨会话移动节点
 */
async function moveNodeToSession(fromSessionId, toSessionId, nodeId) {
  try {
    showToast('正在移动到其他会话...');
    
    const result = await api.moveNodeToSession(fromSessionId, toSessionId, nodeId);
    
    if (!result) {
      showToast('移动失败: 无响应');
      return;
    }
    
    if (result.success) {
      // 重新加载会话列表
      const { loadSessions } = await import('./sessionManager.js');
      await loadSessions();
      
      // 如果当前会话是源会话，刷新视图
      if (state.currentSessionId === fromSessionId) {
        const { loadSessionView } = await import('./viewManager.js');
        await loadSessionView(fromSessionId);
      }
      
      showToast(`已移动 ${result.movedCount} 个节点到其他会话`);
    } else {
      showToast(result.error || '移动失败');
    }
  } catch (e) {
    console.error('[MindGit] 跨会话移动失败:', e);
    showToast('移动失败: ' + e.message);
  }
}

// 兼容旧代码
export function setupNodeDragDrop() {}
export function initDragDrop() {
  initTreeDragDrop();
}
