// dragDrop.js - 拖拽功能

import { state } from './state.js';
import * as api from './api.js';
import { showToast } from './toast.js';

// 当前拖拽的节点ID
let draggedNodeId = null;
let draggedSessionId = null;

/**
 * 初始化树形容器的拖拽功能
 */
export function initTreeDragDrop() {
  const { treeContainer } = state.elements;
  if (!treeContainer) {
    console.log('[MindGit] treeContainer 不存在');
    return;
  }
  
  console.log('[MindGit] 初始化拖拽功能');
  
  // 使用 mousedown 来检测拖拽手柄
  treeContainer.addEventListener('mousedown', handleMouseDown);
  
  // drop 事件
  treeContainer.addEventListener('dragover', handleDragOver);
  treeContainer.addEventListener('dragleave', handleDragLeave);
  treeContainer.addEventListener('drop', handleDrop);
  
  // 阻止默认拖拽行为
  treeContainer.addEventListener('dragstart', (e) => {
    if (!e.target.closest('.drag-handle')) {
      e.preventDefault();
    }
  });
}

/**
 * 处理鼠标按下
 */
function handleMouseDown(e) {
  const dragHandle = e.target.closest('.drag-handle');
  if (!dragHandle) return;
  
  const nodeEl = dragHandle.closest('.tree-node');
  if (!nodeEl) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  // 设置拖拽
  nodeEl.draggable = true;
  
  // 绑定一次性事件
  nodeEl.addEventListener('dragstart', handleDragStart, { once: true });
  nodeEl.addEventListener('dragend', handleDragEnd, { once: true });
  
  // 触发拖拽
  const dragEvent = new DragEvent('dragstart', {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer()
  });
  nodeEl.dispatchEvent(dragEvent);
}

/**
 * 处理拖拽开始
 */
function handleDragStart(e) {
  console.log('[MindGit] dragstart 触发');
  
  const nodeEl = e.currentTarget;
  if (!nodeEl) {
    e.preventDefault();
    return;
  }
  
  draggedNodeId = nodeEl.dataset.nodeId;
  draggedSessionId = state.currentSessionId;
  
  console.log('[MindGit] 开始拖拽:', draggedNodeId);
  
  if (!draggedNodeId || !draggedSessionId) {
    e.preventDefault();
    return;
  }
  
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedNodeId);
  
  // 添加拖拽样式
  nodeEl.classList.add('dragging');
  document.body.classList.add('is-dragging');
  
  // 显示拖拽提示
  showDragHint();
}

/**
 * 显示拖拽提示
 */
function showDragHint() {
  let hint = document.getElementById('drag-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'drag-hint';
    hint.className = 'drag-hint';
    hint.innerHTML = `
      <span class="drag-hint-item">👆 拖到节点上方：成为兄弟节点</span>
      <span class="drag-hint-item">👇 拖到节点下方：成为子节点</span>
      <span class="drag-hint-item">📥 拖到空白处：成为根节点</span>
    `;
    document.body.appendChild(hint);
  }
  hint.style.display = 'flex';
}

/**
 * 隐藏拖拽提示
 */
function hideDragHint() {
  const hint = document.getElementById('drag-hint');
  if (hint) {
    hint.style.display = 'none';
  }
}

/**
 * 处理拖拽结束
 */
function handleDragEnd(e) {
  console.log('[MindGit] dragend 触发');
  
  const nodeEl = e.currentTarget;
  if (nodeEl) {
    nodeEl.classList.remove('dragging');
    nodeEl.draggable = false;
  }
  
  document.querySelectorAll('.drag-over, .drag-over-top, .drag-over-bottom, .drag-over-center').forEach(el => {
    el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom', 'drag-over-center');
  });
  document.body.classList.remove('is-dragging');
  hideDragHint();
  
  draggedNodeId = null;
  draggedSessionId = null;
}

/**
 * 处理拖拽经过
 */
function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  if (!draggedNodeId) return;
  
  const targetEl = e.target.closest('.tree-node');
  
  // 清除所有旧样式
  document.querySelectorAll('.drag-over, .drag-over-top, .drag-over-bottom, .drag-over-center').forEach(el => {
    el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom', 'drag-over-center');
  });
  
  if (!targetEl) {
    // 在空白区域，可以放置为根节点
    const treeWrapper = e.target.closest('.tree-wrapper');
    if (treeWrapper) {
      treeWrapper.classList.add('drag-over-root');
    }
    return;
  }
  
  const targetNodeId = targetEl.dataset.nodeId;
  
  // 不能拖拽到自己
  if (targetNodeId === draggedNodeId) return;
  
  // 检查是否是父子关系
  if (isDescendant(draggedNodeId, targetNodeId)) return;
  
  // 添加悬停样式
  const rect = targetEl.getBoundingClientRect();
  const height = rect.height;
  const relativeY = e.clientY - rect.top;
  
  // 分为三个区域：上30%、中间40%、下30%
  if (relativeY < height * 0.3) {
    targetEl.classList.add('drag-over-top');
  } else if (relativeY > height * 0.7) {
    targetEl.classList.add('drag-over-bottom');
  } else {
    targetEl.classList.add('drag-over-center');
  }
}

/**
 * 处理拖拽离开
 */
function handleDragLeave(e) {
  const targetEl = e.target.closest('.tree-node, .tree-wrapper');
  if (targetEl) {
    targetEl.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom', 'drag-over-center', 'drag-over-root');
  }
}

/**
 * 处理放置
 */
async function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  
  console.log('[MindGit] drop 触发');
  
  if (!draggedNodeId || !draggedSessionId) {
    console.log('[MindGit] 缺少拖拽数据');
    return;
  }
  
  // 清除样式
  document.querySelectorAll('.drag-over, .drag-over-top, .drag-over-bottom, .drag-over-center, .drag-over-root').forEach(el => {
    el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom', 'drag-over-center', 'drag-over-root');
  });
  hideDragHint();
  
  const targetEl = e.target.closest('.tree-node');
  
  // 如果放置到空白区域，移为根节点
  if (!targetEl) {
    console.log('[MindGit] 放置到空白区域');
    await moveNodeToRoot(draggedSessionId, draggedNodeId);
    return;
  }
  
  const targetNodeId = targetEl.dataset.nodeId;
  
  // 不能拖拽到自己
  if (targetNodeId === draggedNodeId) {
    console.log('[MindGit] 不能拖拽到自己');
    return;
  }
  
  // 检查是否是父子关系
  if (isDescendant(draggedNodeId, targetNodeId)) {
    showToast('不能拖拽到自己或子节点');
    return;
  }
  
  const rect = targetEl.getBoundingClientRect();
  const height = rect.height;
  const relativeY = e.clientY - rect.top;
  
  // 判断放置位置
  if (relativeY < height * 0.3) {
    // 放置到上方 - 成为兄弟节点
    console.log('[MindGit] 放置到上方');
    await moveNodeBefore(draggedSessionId, draggedNodeId, targetNodeId);
  } else if (relativeY > height * 0.7) {
    // 放置到下方 - 成为子节点
    console.log('[MindGit] 放置到下方');
    await moveNodeAsChild(draggedSessionId, draggedNodeId, targetNodeId);
  } else {
    // 放置到中间 - 成为子节点
    console.log('[MindGit] 放置到中间');
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
      const { loadSessionView } = await import('./viewManager.js');
      await loadSessionView(sessionId);
      showToast('已移动到根节点');
    } else {
      showToast(result?.error || '移动失败');
    }
  } catch (e) {
    console.error('[MindGit] 移动失败:', e);
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
      const { loadSessionView } = await import('./viewManager.js');
      await loadSessionView(sessionId);
      showToast('已移动为子节点');
    } else {
      showToast(result?.error || '移动失败');
    }
  } catch (e) {
    console.error('[MindGit] 移动失败:', e);
    showToast('移动失败');
  }
}

/**
 * 移动节点到目标之前
 */
async function moveNodeBefore(sessionId, nodeId, targetId) {
  try {
    const session = state.currentSessions[sessionId];
    if (!session) return;
    
    const targetNode = session.allNodes[targetId];
    if (!targetNode) return;
    
    const parentId = targetNode.parentId;
    
    // 先移动到父节点
    const result = await api.moveNode(sessionId, nodeId, parentId);
    if (!result || !result.success) {
      showToast(result?.error || '移动失败');
      return;
    }
    
    // 调整顺序
    if (parentId && session.allNodes[parentId]) {
      const parent = session.allNodes[parentId];
      const children = [...(parent.children || [])];
      
      const currentIndex = children.indexOf(nodeId);
      if (currentIndex > -1) {
        children.splice(currentIndex, 1);
      }
      
      const targetIndex = children.indexOf(targetId);
      if (targetIndex > -1) {
        children.splice(targetIndex, 0, nodeId);
        parent.children = children;
        await api.setStorage({ sessions: { ...state.currentSessions, [sessionId]: session } });
      }
    }
    
    const { loadSessionView } = await import('./viewManager.js');
    await loadSessionView(sessionId);
    showToast('已移动节点');
  } catch (e) {
    console.error('[MindGit] 移动失败:', e);
    showToast('移动失败');
  }
}

/**
 * 为节点设置拖拽功能（保留以兼容）
 */
export function setupNodeDragDrop(nodeEl) {
  // 现在通过 mousedown 检测拖拽手柄，这个函数不需要做什么
  // 保留用于兼容性
}
