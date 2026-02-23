// tree.js - 树形结构渲染

import { state } from './state.js';
import * as api from './api.js';
import { truncateText, generateFaviconUrl } from './utils.js';
import { showToast } from './toast.js';
import { t } from './i18n.js';
import { sortTree, SORT_MODES } from './sort.js';

/**
 * 加载树形结构
 * @param {string} sessionId - 会话 ID
 */
export async function loadTree(sessionId) {
  const result = await api.getSessionTree(sessionId);
  
  if (!result.session || result.session.rootNodes.length === 0) {
    showEmptyState();
    return;
  }
  
  // 保存当前的展开状态
  saveExpandedState();
  
  // 应用排序
  const sortMode = state.currentSettings?.sortMode || SORT_MODES.SMART;
  const sortedSession = sortTree(result.session, sortMode);
  
  const session = sortedSession;
  const treeHtml = document.createElement('div');
  treeHtml.className = 'tree-wrapper';
  
  for (const rootId of session.rootNodes) {
    const node = session.allNodes[rootId];
    if (node) {
      treeHtml.appendChild(createTreeNode(node, session, 0));
    }
  }
  
  state.elements.treeContainer.innerHTML = '';
  state.elements.treeContainer.appendChild(treeHtml);
  
  // 刷新拖拽手柄绑定
  const { refreshDragHandles } = await import('./dragDrop.js');
  refreshDragHandles();
}

/**
 * 保存展开状态
 */
function saveExpandedState() {
  const currentExpanded = new Set();
  document.querySelectorAll('.children-container:not(.collapsed)').forEach(el => {
    const nodeId = el.closest('.tree-node')?.dataset.nodeId;
    if (nodeId) currentExpanded.add(nodeId);
  });
  state.expandedNodes = currentExpanded;
}

/**
 * 创建树节点
 * @param {Object} node - 节点数据
 * @param {Object} session - 会话数据
 * @param {number} depth - 深度
 * @returns {HTMLElement}
 */
function createTreeNode(node, session, depth) {
  const container = document.createElement('div');
  // 超过深度3后使用特殊类名限制缩进
  const depthClass = depth > 3 ? 'depth-deep' : `depth-${depth}`;
  container.className = `tree-node ${depthClass}`;
  container.dataset.nodeId = node.id;
  container.dataset.depth = depth;
  container.tabIndex = 0; // 使节点可焦点，支持键盘导航
  
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = state.expandedNodes.has(node.id) || state.currentSettings.defaultExpand !== false;
  
  const content = createNodeContent(node, hasChildren, isExpanded, depth);
  container.appendChild(content);
  
  if (hasChildren) {
    const childrenContainer = createChildrenContainer(node, session, depth, isExpanded);
    container.appendChild(childrenContainer);
  }
  
  return container;
}

/**
 * 创建节点内容
 * @param {Object} node - 节点数据
 * @param {boolean} hasChildren - 是否有子节点
 * @param {boolean} isExpanded - 是否展开
 * @param {number} depth - 深度
 * @returns {HTMLElement}
 */
function createNodeContent(node, hasChildren, isExpanded, depth) {
  const content = document.createElement('div');
  content.className = 'node-content';
  
  const faviconUrl = node.favIconUrl || generateFaviconUrl(node.url);
  const title = node.title || t('noTitle');
  const truncatedTitle = truncateText(title, 40);
  const visitCount = node.visitCount || 1;
  
  const depthColors = ['var(--primary-color)', 'var(--text-secondary)', '#888', '#aaa'];
  const borderColor = depthColors[Math.min(depth, 3)];
  
  content.innerHTML = `
    <span class="drag-handle" draggable="true" title="拖拽排序">::</span>
    <span class="node-toggle ${hasChildren ? '' : 'leaf'}" 
          style="transform: ${isExpanded || !hasChildren ? 'rotate(0deg)' : 'rotate(-90deg)'}; opacity: ${hasChildren ? 1 : 0.3};">
      ${hasChildren ? '▼' : '●'}
    </span>
    <img class="node-icon" src="${faviconUrl}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><text y=%2214%22 font-size=%2214%22>🔍</text></svg>'">
    <span class="node-title" title="${title}\n${node.url}">${truncatedTitle}</span>
    ${visitCount > 1 ? `<span class="node-badge" title="${t('visitCount', { count: visitCount })}" style="border-color: ${borderColor}">${visitCount}</span>` : ''}
  `;
  
  // 点击展开/折叠
  const toggle = content.querySelector('.node-toggle');
  if (toggle && hasChildren) {
    toggle.onclick = (e) => {
      e.stopPropagation();
      toggleNode(node.id, content.closest('.tree-node'));
    };
  }
  
  const actions = createNodeActions(node);
  content.appendChild(actions);
  
  return content;
}

/**
 * 创建节点操作按钮
 * @param {Object} node - 节点数据
 * @returns {HTMLElement}
 */
function createNodeActions(node) {
  const actions = document.createElement('div');
  actions.className = 'node-actions';
  
  actions.innerHTML = `
    <button class="node-btn" title="${t('open')}">🔗</button>
    <button class="node-btn" title="${t('delete')}">🗑️</button>
  `;
  
  actions.children[0].onclick = (e) => {
    e.stopPropagation();
    api.openUrl(node.url);
  };
  
  actions.children[1].onclick = (e) => {
    e.stopPropagation();
    if (confirm(t('deleteNodeConfirm'))) {
      deleteNode(node.id);
    }
  };
  
  return actions;
}

/**
 * 创建子节点容器
 * @param {Object} node - 节点数据
 * @param {Object} session - 会话数据
 * @param {number} depth - 深度
 * @param {boolean} isExpanded - 是否展开
 * @returns {HTMLElement}
 */
function createChildrenContainer(node, session, depth, isExpanded) {
  const container = document.createElement('div');
  container.className = 'children-container';
  if (!isExpanded) {
    container.classList.add('collapsed');
  }
  
  for (const childId of node.children) {
    const childNode = session.allNodes[childId];
    if (childNode) {
      container.appendChild(createTreeNode(childNode, session, depth + 1));
    }
  }
  
  return container;
}

/**
 * 展开/折叠节点 - 带动画效果
 * @param {string} nodeId - 节点 ID
 * @param {HTMLElement} container - 节点容器
 */
function toggleNode(nodeId, container) {
  const childrenContainer = container.querySelector('.children-container');
  const toggle = container.querySelector('.node-toggle');
  
  if (!childrenContainer) return;
  
  const isCollapsed = childrenContainer.classList.contains('collapsed');
  
  if (isCollapsed) {
    // 展开
    childrenContainer.classList.remove('collapsed');
    toggle.classList.remove('collapsed');
    toggle.style.transform = 'rotate(0deg)';
    state.expandedNodes.add(nodeId);
  } else {
    // 折叠
    childrenContainer.classList.add('collapsed');
    toggle.classList.add('collapsed');
    toggle.style.transform = 'rotate(-90deg)';
    state.expandedNodes.delete(nodeId);
  }
}

/**
 * 删除节点
 * @param {string} nodeId - 节点 ID
 */
async function deleteNode(nodeId) {
  const result = await api.deleteNode(state.currentSessionId, nodeId);
  
  if (result.success) {
    showToast(t('nodeDeleted'));
    
    // 静默删除：从 DOM 移除节点，不刷新整个树
    const nodeEl = document.querySelector(`.tree-node[data-node-id="${nodeId}"]`);
    if (nodeEl) {
      // 如果有子节点容器，一起移除
      nodeEl.remove();
    }
    
    // 更新 state 中的数据
    const session = state.currentSessions[state.currentSessionId];
    if (session && session.allNodes[nodeId]) {
      // 递归收集所有子节点
      const nodesToRemove = [];
      const collectNodes = (id) => {
        const node = session.allNodes[id];
        if (!node) return;
        nodesToRemove.push(id);
        if (node.children) {
          for (const childId of node.children) {
            collectNodes(childId);
          }
        }
      };
      collectNodes(nodeId);
      
      // 从父节点中移除引用
      const node = session.allNodes[nodeId];
      if (node.parentId && session.allNodes[node.parentId]) {
        const parent = session.allNodes[node.parentId];
        parent.children = parent.children.filter(id => id !== nodeId);
      } else {
        // 是根节点
        session.rootNodes = session.rootNodes.filter(id => id !== nodeId);
      }
      
      // 删除所有节点数据
      for (const id of nodesToRemove) {
        delete session.allNodes[id];
      }
    }
  } else {
    showToast(t('deleteFailed', { error: result.error || 'Unknown error' }));
  }
}

/**
 * 高亮显示指定节点
 * @param {string} nodeId - 节点ID
 */
export function highlightNode(nodeId) {
  // 移除旧的高亮
  document.querySelectorAll('.tree-node.search-highlight').forEach(el => {
    el.classList.remove('search-highlight');
  });
  
  // 找到节点元素
  const nodeEl = document.querySelector(`.tree-node[data-node-id="${nodeId}"]`);
  if (!nodeEl) return;
  
  // 展开父节点
  let parent = nodeEl.parentElement;
  while (parent) {
    if (parent.classList.contains('children-container') && parent.classList.contains('collapsed')) {
      parent.classList.remove('collapsed');
      const parentNode = parent.closest('.tree-node');
      if (parentNode) {
        const toggle = parentNode.querySelector('.node-toggle');
        if (toggle) {
          toggle.style.transform = 'rotate(0deg)';
          toggle.classList.remove('collapsed');
        }
      }
    }
    parent = parent.parentElement;
  }
  
  // 添加高亮样式
  nodeEl.classList.add('search-highlight');
  
  // 滚动到可视区域
  nodeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // 3秒后移除高亮
  setTimeout(() => {
    nodeEl.classList.remove('search-highlight');
  }, 3000);
}

/**
 * 高亮显示会话
 * @param {string} sessionId - 会话ID
 */
export function highlightSession(sessionId) {
  document.querySelectorAll('.session-item.search-highlight').forEach(el => {
    el.classList.remove('search-highlight');
  });
  
  const sessionEl = document.querySelector(`.session-item[data-session-id="${sessionId}"]`);
  if (sessionEl) {
    sessionEl.classList.add('search-highlight');
    sessionEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * 显示空状态
 */
export function showEmptyState() {
  state.elements.treeContainer.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">🌱</div>
      <p>还没有浏览记录</p>
      <p class="empty-hint">开始浏览网页，我会帮你记录跳转脉络~</p>
    </div>
  `;
}

/**
 * 展开全部节点 - 带动画效果
 */
export function expandAll() {
  // 先更新所有按钮状态
  document.querySelectorAll('.node-toggle:not(.leaf)').forEach(el => {
    el.style.transform = 'rotate(0deg)';
    el.classList.remove('collapsed');
  });
  
  // 逐层展开，添加延迟动画
  const containers = document.querySelectorAll('.children-container.collapsed');
  containers.forEach((el, index) => {
    setTimeout(() => {
      el.classList.remove('collapsed');
    }, index * 30); // 每个容器延迟 30ms
  });
  
  document.querySelectorAll('.tree-node').forEach(node => {
    const nodeId = node.dataset.nodeId;
    if (node.querySelector('.children-container')) {
      state.expandedNodes.add(nodeId);
    }
  });
  showToast(t('allExpanded'));
}

/**
 * 折叠全部节点 - 带动画效果
 */
export function collapseAll() {
  // 先折叠容器
  document.querySelectorAll('.children-container').forEach(el => {
    el.classList.add('collapsed');
  });
  
  // 更新按钮状态
  document.querySelectorAll('.node-toggle:not(.leaf)').forEach(el => {
    el.style.transform = 'rotate(-90deg)';
    el.classList.add('collapsed');
  });
  
  state.expandedNodes.clear();
  showToast(t('allCollapsed'));
}
