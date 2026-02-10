// dragDrop.js - 拖拽功能

import { state } from './state.js';
import * as api from './api.js';
import { showToast } from './toast.js';

let draggedNodeId = null;
let draggedSessionId = null;

/**
 * 初始化拖拽功能
 */
export function initTreeDragDrop() {
  const treeContainer = document.getElementById('treeContainer');
  if (!treeContainer) return;

  // 为所有拖拽手柄绑定事件
  bindDragHandles(treeContainer);
  
  // 监听 treeContainer 的变化，为新节点绑定事件
  const observer = new MutationObserver(() => {
    bindDragHandles(treeContainer);
  });
  observer.observe(treeContainer, { childList: true, subtree: true });

  // 容器上的放置事件
  treeContainer.addEventListener('dragover', handleDragOver);
  treeContainer.addEventListener('drop', handleDrop);
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
    
    // 确保手柄可拖拽
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
  
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedNodeId);
  
  nodeEl.classList.add('dragging');
  document.body.classList.add('is-dragging');
}

function handleDragEnd(e) {
  const handle = e.target;
  const nodeEl = handle.closest('.tree-node');
  
  if (nodeEl) {
    nodeEl.classList.remove('dragging');
  }
  
  document.querySelectorAll('.drag-over-top, .drag-over-bottom, .drag-over-center').forEach(el => {
    el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-center');
  });
  
  document.body.classList.remove('is-dragging');
  draggedNodeId = null;
  draggedSessionId = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  if (!draggedNodeId) return;
  
  const targetEl = e.target.closest('.tree-node');
  
  // 清除旧样式
  document.querySelectorAll('.drag-over-top, .drag-over-bottom, .drag-over-center').forEach(el => {
    el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-center');
  });
  
  if (!targetEl) return;
  
  const targetNodeId = targetEl.dataset.nodeId;
  if (targetNodeId === draggedNodeId) return;
  if (isDescendant(draggedNodeId, targetNodeId)) return;
  
  const rect = targetEl.getBoundingClientRect();
  const relativeY = e.clientY - rect.top;
  const height = rect.height;
  
  if (relativeY < height * 0.3) {
    targetEl.classList.add('drag-over-top');
  } else if (relativeY > height * 0.7) {
    targetEl.classList.add('drag-over-bottom');
  } else {
    targetEl.classList.add('drag-over-center');
  }
}

async function handleDrop(e) {
  e.preventDefault();
  
  if (!draggedNodeId || !draggedSessionId) return;
  
  const targetEl = e.target.closest('.tree-node');
  
  document.querySelectorAll('.drag-over-top, .drag-over-bottom, .drag-over-center').forEach(el => {
    el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-center');
  });
  
  if (!targetEl) {
    // 移到根节点
    await moveNode(draggedSessionId, draggedNodeId, null);
    return;
  }
  
  const targetNodeId = targetEl.dataset.nodeId;
  if (targetNodeId === draggedNodeId) return;
  
  const rect = targetEl.getBoundingClientRect();
  const relativeY = e.clientY - rect.top;
  const height = rect.height;
  
  if (relativeY < height * 0.3) {
    // 移到上方 - 成为兄弟节点
    await moveAsSibling(draggedSessionId, draggedNodeId, targetNodeId, 'before');
  } else {
    // 移到下方或中间 - 成为子节点
    await moveNode(draggedSessionId, draggedNodeId, targetNodeId);
  }
}

function isDescendant(ancestorId, descendantId) {
  const session = state.currentSessions[state.currentSessionId];
  if (!session) return false;
  
  let node = session.allNodes[descendantId];
  while (node && node.parentId) {
    if (node.parentId === ancestorId) return true;
    node = session.allNodes[node.parentId];
  }
  return false;
}

async function moveNode(sessionId, nodeId, newParentId) {
  try {
    const result = await api.moveNode(sessionId, nodeId, newParentId);
    if (result.success) {
      const { loadSessionView } = await import('./viewManager.js');
      await loadSessionView(sessionId);
      showToast(newParentId ? '已移动为子节点' : '已移动到根节点');
    } else {
      showToast(result.error || '移动失败');
    }
  } catch (e) {
    showToast('移动失败');
  }
}

async function moveAsSibling(sessionId, nodeId, targetId, position) {
  try {
    const session = state.currentSessions[sessionId];
    const targetNode = session.allNodes[targetId];
    const parentId = targetNode.parentId;
    
    // 先移到父节点下
    let result = await api.moveNode(sessionId, nodeId, parentId);
    if (!result.success) {
      showToast(result.error || '移动失败');
      return;
    }
    
    // 调整顺序
    if (parentId) {
      const parent = session.allNodes[parentId];
      const children = [...(parent.children || [])];
      
      const currentIndex = children.indexOf(nodeId);
      if (currentIndex > -1) children.splice(currentIndex, 1);
      
      const targetIndex = children.indexOf(targetId);
      if (targetIndex > -1) {
        const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
        children.splice(insertIndex, 0, nodeId);
        parent.children = children;
        await api.setStorage({ sessions: { ...state.currentSessions, [sessionId]: session } });
      }
    }
    
    const { loadSessionView } = await import('./viewManager.js');
    await loadSessionView(sessionId);
    showToast('已移动节点');
  } catch (e) {
    showToast('移动失败');
  }
}

// 兼容旧代码
export function setupNodeDragDrop() {}
export function initDragDrop() {
  initTreeDragDrop();
}
