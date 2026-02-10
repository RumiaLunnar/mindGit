// dragDrop.js - 拖拽功能

import { state } from './state.js';
import * as api from './api.js';
import { showToast } from './toast.js';

// 当前拖拽的节点ID
let draggedNodeId = null;
let draggedSessionId = null;

/**
 * 为节点设置拖拽功能
 * @param {HTMLElement} nodeEl - 节点元素
 */
export function setupNodeDragDrop(nodeEl) {
  if (!nodeEl) return;
  
  nodeEl.draggable = true;
  
  nodeEl.addEventListener('dragstart', handleDragStart);
  nodeEl.addEventListener('dragend', handleDragEnd);
  
  // 为节点内容区域添加拖拽手柄样式
  const content = nodeEl.querySelector('.node-content');
  if (content) {
    content.style.cursor = 'grab';
  }
  
  console.log('[MindGit] 已设置节点可拖拽:', nodeEl.dataset.nodeId);
}

/**
 * 处理拖拽开始
 */
function handleDragStart(e) {
  console.log('[MindGit] dragstart 触发');
  
  const nodeEl = e.currentTarget;
  if (!nodeEl) {
    console.log('[MindGit] 节点元素不存在');
    e.preventDefault();
    return;
  }
  
  draggedNodeId = nodeEl.dataset.nodeId;
  draggedSessionId = state.currentSessionId;
  
  console.log('[MindGit] 开始拖拽:', draggedNodeId, '会话:', draggedSessionId);
  
  if (!draggedNodeId || !draggedSessionId) {
    console.log('[MindGit] 缺少必要数据');
    e.preventDefault();
    return;
  }
  
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedNodeId);
  
  // 添加拖拽样式
  nodeEl.classList.add('dragging');
  
  // 添加拖拽中的标记到 body
  document.body.classList.add('is-dragging');
}

/**
 * 处理拖拽结束
 */
function handleDragEnd(e) {
  const nodeEl = e.currentTarget;
  if (nodeEl) {
    nodeEl.classList.remove('dragging');
  }
  
  // 移除所有拖拽相关样式
  document.querySelectorAll('.drag-over, .drag-over-top, .drag-over-bottom').forEach(el => {
    el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
  });
  document.body.classList.remove('is-dragging');
  
  draggedNodeId = null;
  draggedSessionId = null;
}

/**
 * 初始化树形容器的拖拽事件（drop 相关）
 */
export function initTreeDragDrop() {
  const { treeContainer } = state.elements;
  if (!treeContainer) {
    console.log('[MindGit] treeContainer 不存在');
    return;
  }
  
  console.log('[MindGit] 初始化树形拖拽事件');
  
  // 只需要在容器上监听 drop 相关事件
  treeContainer.addEventListener('dragover', handleDragOver);
  treeContainer.addEventListener('dragleave', handleDragLeave);
  treeContainer.addEventListener('drop', handleDrop);
}

/**
 * 处理拖拽经过
 */
function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  if (!draggedNodeId) return;
  
  const targetEl = e.target.closest('.tree-node');
  if (!targetEl) return;
  
  const targetNodeId = targetEl.dataset.nodeId;
  
  // 不能拖拽到自己
  if (targetNodeId === draggedNodeId) return;
  
  // 检查是否是父子关系
  if (isDescendant(draggedNodeId, targetNodeId)) return;
  
  // 添加悬停样式
  const rect = targetEl.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  
  // 清除旧样式
  document.querySelectorAll('.drag-over, .drag-over-top, .drag-over-bottom').forEach(el => {
    el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
  });
  
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
  if (targetEl && !targetEl.contains(e.relatedTarget)) {
    targetEl.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
  }
}

/**
 * 处理放置
 */
async function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  
  console.log('[MindGit] drop 触发, draggedNodeId:', draggedNodeId, 'draggedSessionId:', draggedSessionId);
  
  if (!draggedNodeId || !draggedSessionId) {
    console.log('[MindGit] 缺少拖拽数据');
    return;
  }
  
  const targetEl = e.target.closest('.tree-node');
  
  // 清除所有悬停样式
  document.querySelectorAll('.drag-over, .drag-over-top, .drag-over-bottom').forEach(el => {
    el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
  });
  document.body.classList.remove('is-dragging');
  
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
    // 放置到目标节点之上（成为兄弟节点，在目标之前）
    await moveNodeBefore(draggedSessionId, draggedNodeId, targetNodeId);
  } else {
    // 放置到目标节点之下（成为子节点）
    await moveNodeAsChild(draggedSessionId, draggedNodeId, targetNodeId);
  }
}

/**
 * 检查是否是后代节点
 */
function isDescendant(ancestorId, descendantId) {
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
      showToast('已移动为子节点');
    } else {
      showToast(result?.error || '移动失败');
    }
  } catch (e) {
    console.error('[MindGit] 移动节点失败:', e);
    showToast('移动失败');
  }
}

/**
 * 移动节点到目标节点之前（成为兄弟节点）
 */
async function moveNodeBefore(sessionId, nodeId, targetId) {
  try {
    const session = state.currentSessions[sessionId];
    if (!session) return;
    
    const targetNode = session.allNodes[targetId];
    if (!targetNode) return;
    
    // 获取目标节点的父节点
    const parentId = targetNode.parentId;
    
    // 先移动到父节点下
    const result = await api.moveNode(sessionId, nodeId, parentId);
    if (!result || !result.success) {
      showToast(result?.error || '移动失败');
      return;
    }
    
    // 调整顺序：将 nodeId 插入到 targetId 之前
    if (parentId && session.allNodes[parentId]) {
      const parent = session.allNodes[parentId];
      const children = [...(parent.children || [])];
      
      // 移除 nodeId（如果已在其中）
      const currentIndex = children.indexOf(nodeId);
      if (currentIndex > -1) {
        children.splice(currentIndex, 1);
      }
      
      // 插入到 targetId 之前
      const targetIndex = children.indexOf(targetId);
      if (targetIndex > -1) {
        children.splice(targetIndex, 0, nodeId);
        parent.children = children;
        
        // 保存更新后的会话
        await api.setStorage({ 
          sessions: { ...state.currentSessions, [sessionId]: session }
        });
      }
    }
    
    // 刷新视图
    const { loadSessionView } = await import('./viewManager.js');
    await loadSessionView(sessionId);
    showToast('已移动节点');
  } catch (e) {
    console.error('[MindGit] 移动节点失败:', e);
    showToast('移动失败');
  }
}
