// tree.js - 树形结构渲染

import { state } from './state.js';
import * as api from './api.js';
import { truncateText, generateFaviconUrl } from './utils.js';
import { showToast } from './toast.js';
import { t } from './i18n.js';

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
  
  const session = result.session;
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
  container.className = `tree-node depth-${Math.min(depth, 3)}`;
  container.dataset.nodeId = node.id;
  
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
  content.style.marginLeft = `${depth * 4}px`;
  
  // 展开/折叠按钮
  const toggle = createToggleButton(node, hasChildren, isExpanded);
  content.appendChild(toggle);
  
  // 图标
  const icon = createIcon(node);
  content.appendChild(icon);
  
  // 标题
  const title = createTitle(node);
  content.appendChild(title);
  
  // 访问次数徽章
  if (node.visitCount > 1) {
    const badge = createBadge(node.visitCount);
    content.appendChild(badge);
  }
  
  // 操作按钮
  const actions = createActionButtons(node);
  content.appendChild(actions);
  
  // 点击标题打开链接
  title.onclick = () => {
    console.log('[MindGit tree] 点击节点:', node.title, 'URL:', node.url);
    api.openUrl(node.url);
  };
  
  return content;
}

/**
 * 创建展开/折叠按钮 - 带旋转动画
 * @param {Object} node - 节点数据
 * @param {boolean} hasChildren - 是否有子节点
 * @param {boolean} isExpanded - 是否展开
 * @returns {HTMLElement}
 */
function createToggleButton(node, hasChildren, isExpanded) {
  const toggle = document.createElement('span');
  toggle.className = hasChildren ? 'node-toggle' : 'node-toggle leaf';
  
  // 使用统一的下箭头，通过 transform 旋转来显示状态
  toggle.textContent = hasChildren ? '▼' : '•';
  
  // 如果是折叠状态，初始旋转 -90 度
  if (hasChildren && !isExpanded) {
    toggle.style.transform = 'rotate(-90deg)';
  }
  
  toggle.onclick = (e) => {
    e.stopPropagation();
    if (hasChildren) toggleNode(node.id, toggle.closest('.tree-node'));
  };
  return toggle;
}

/**
 * 创建图标
 * @param {Object} node - 节点数据
 * @returns {HTMLElement}
 */
function createIcon(node) {
  const icon = document.createElement('img');
  icon.className = 'node-icon';
  icon.src = node.favIconUrl || generateFaviconUrl(node.url);
  icon.onerror = () => { icon.src = generateFaviconUrl(node.url); };
  return icon;
}

/**
 * 创建标题
 * @param {Object} node - 节点数据
 * @returns {HTMLElement}
 */
function createTitle(node) {
  const title = document.createElement('div');
  title.className = 'node-title';
  title.textContent = truncateText(node.title || '无标题', 35);
  title.title = `${node.title}\n${node.url}${node.visitCount > 1 ? '\n访问: ' + node.visitCount + '次' : ''}`;
  return title;
}

/**
 * 创建访问次数徽章
 * @param {number} count - 访问次数
 * @returns {HTMLElement}
 */
function createBadge(count) {
  const badge = document.createElement('span');
  badge.className = 'node-badge';
  badge.textContent = count;
  return badge;
}

/**
 * 创建操作按钮
 * @param {Object} node - 节点数据
 * @returns {HTMLElement}
 */
function createActionButtons(node) {
  const actions = document.createElement('div');
  actions.className = 'node-actions';
  actions.innerHTML = `
    <button class="node-btn" title="打开">↗️</button>
    <button class="node-btn" title="删除">🗑️</button>
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
    await loadTree(state.currentSessionId);
  } else {
    showToast(t('deleteFailed', { error: result.error || 'Unknown error' }));
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
