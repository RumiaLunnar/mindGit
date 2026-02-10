// dragDrop.js - 拖拽功能

import { state } from './state.js';
import * as api from './api.js';
import { showToast } from './toast.js';

// 当前拖拽的节点ID
let draggedNodeId = null;
let draggedSessionId = null;

/**
 * 初始化拖拽功能
 */
export function initDragDrop() {
  // 事件委托到 treeContainer
  const { treeContainer } = state.elements;
  if (!treeContainer) return;
  
  treeContainer.addEventListener('dragstart', handleDragStart);
  treeContainer.addEventListener('dragend', handleDragEnd);
  treeContainer.addEventListener('dragover', handleDragOver);
  treeContainer.addEventListener('dragleave', handleDragLeave);
  treeContainer.addEventListener('drop', handleDrop);
}

/**
 * 处理拖拽开始
 */
function handleDragStart(e) {
  const nodeEl = e.target.closest('.tree-node');
  if (!nodeEl) {
    e.preventDefault();
    return;
  }
  
  draggedNodeId = nodeEl.dataset.nodeId;
  draggedSessionId = state.currentSessionId;
  
  if (!draggedNodeId || !draggedSessionId) {
    e.preventDefault();
    return;
  }
  
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedNodeId);
  
  // 添加拖拽样式
  nodeEl.classList.add('dragging');
  
  // 添加拖拽中的标记到 body，用于控制样式
  document.body.classList.add('is-dragging');
}

/**
 * 处理拖拽结束
 */
function handleDragEnd(e) {
  const nodeEl = e.target.closest('.tree-node');
  if (nodeEl) {
    nodeEl.classList.remove('dragging');
  }
  
  // 移除所有拖拽相关样式
  document.querySelectorAll('.drag-over').forEach(el => {
    el.classList.remove('drag-over');
    el.classList.remove('drag-over-top');
    el.classList.remove('drag-over-bottom');
  });
  document.body.classList.remove('is-dragging');
  
  draggedNodeId = null;
  draggedSessionId = null;
}

/**
 * 处理拖拽经过
 */
function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  const targetEl = e.target.closest('.tree-node');
  if (!targetEl || !draggedNodeId) return;
  
  const targetNodeId = targetEl.dataset.nodeId;
  
  // 不能拖拽到自己
  if (targetNodeId === draggedNodeId) return;
  
  // 检查是否是父子关系
  if (isDescendant(draggedNodeId, targetNodeId)) return;
  
  // 添加悬停样式
  const rect = targetEl.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  
  targetEl.classList.remove('drag-over-top', 'drag-over-bottom');
  
  if (e.clientY < midY) {
    targetEl.classList.add('drag-over-top');
  } else {
    targetEl.classList.add('drag-over-bottom');
  }
}

/**
 * 处理拖拽离开
 */
function handleDragLeave(e) {
  const targetEl = e.target.closest('.tree-node');
  if (targetEl) {
    targetEl.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
  }
}

/**
 * 处理放置
 */
async function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  
  if (!draggedNodeId || !draggedSessionId) return;
  
  const targetEl = e.target.closest('.tree-node');
  
  // 如果放置到空白区域，移为根节点
  if (!targetEl) {
    await moveNodeToRoot(draggedSessionId, draggedNodeId);
    return;
  }
  
  const targetNodeId = targetEl.dataset.nodeId;
  
  // 不能拖拽到自己
  if (targetNodeId === draggedNodeId) return;
  
  // 检查是否是父子关系
  if (isDescendant(draggedNodeId, targetNodeId)) {
    showToast('不能拖拽到自己或子节点');
    return;
  }
  
  const rect = targetEl.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  
  if (e.clientY < midY) {
    // 放置到目标节点之上（成为兄弟节点）
    await moveNodeAsSibling(draggedSessionId, draggedNodeId, targetNodeId, 'before');
  } else {
    // 放置到目标节点之下（成为子节点）
    await moveNodeAsChild(draggedSessionId, draggedNodeId, targetNodeId);
  }
}

/**
 * 检查是否是后代节点
 */
function isDescendant(ancestorId, descendantId) {
  // 简单检查：如果 descendantId 是 ancestorId 的父节点或祖先
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

/**
 * 移动节点为根节点
 */
async function moveNodeToRoot(sessionId, nodeId) {
  try {
    const result = await api.moveNode(sessionId, nodeId, null);
    if (result && result.success) {
      // 刷新视图
      const { loadSessionView } = await import('./viewManager.js');
      await loadSessionView(sessionId);
      showToast('已移动到根节点');
    } else {
      showToast(result?.error || '移动失败');
    }
  } catch (e) {
    console.error('[MindGit] 移动节点失败:', e);
    showToast('移动失败');
  }
}

/**
 * 移动节点为子节点
 */
async function moveNodeAsChild(sessionId, nodeId, parentId) {
  try {
    const result = await api.moveNode(sessionId, nodeId, parentId);
    if (result && result.success) {
      // 刷新视图
      const { loadSessionView } = await import('./viewManager.js');
      await loadSessionView(sessionId);
      showToast('已移动到子节点');
    } else {
      showToast(result?.error || '移动失败');
    }
  } catch (e) {
    console.error('[MindGit] 移动节点失败:', e);
    showToast('移动失败');
  }
}

/**
 * 移动节点为兄弟节点（放置到目标之上）
 */
async function moveNodeAsSibling(sessionId, nodeId, targetId, position) {
  // 获取目标节点的父节点
  const session = state.currentSessions[sessionId];
  if (!session) return;
  
  const targetNode = session.allNodes[targetId];
  if (!targetNode) return;
  
  // 移动到目标节点的父节点下
  const parentId = targetNode.parentId;
  
  try {
    const result = await api.moveNode(sessionId, nodeId, parentId);
    if (result && result.success) {
      // 调整子节点顺序
      if (parentId && session.allNodes[parentId]) {
        const parent = session.allNodes[parentId];
        const children = parent.children || [];
        
        // 移除当前位置
        const currentIndex = children.indexOf(nodeId);
        if (currentIndex > -1) {
          children.splice(currentIndex, 1);
        }
        
        // 插入到目标位置
        const targetIndex = children.indexOf(targetId);
        if (targetIndex > -1) {
          const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
          children.splice(insertIndex, 0, nodeId);
        }
        
        // 保存顺序变更
        await api.setStorage({ sessions: session });
      }
      
      // 刷新视图
      const { loadSessionView } = await import('./viewManager.js');
      await loadSessionView(sessionId);
      showToast('已移动节点');
    } else {
      showToast(result?.error || '移动失败');
    }
  } catch (e) {
    console.error('[MindGit] 移动节点失败:', e);
    showToast('移动失败');
  }
}
