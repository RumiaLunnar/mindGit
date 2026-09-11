// tree.js - 树形结构渲染

import { state } from './state.js';
import * as api from './api.js';
import { truncateText, getSafeFaviconUrl } from './utils.js';
import { showToast } from './toast.js';
import { t } from './i18n.js';
import { sortTree, SORT_MODES } from './sort.js';

const MAX_EAGER_TREE_NODES = 120;

/**
 * 加载树形结构
 * @param {string} sessionId - 会话 ID
 */
export async function loadTree(sessionId, providedSession = null) {
  const session = providedSession || (await api.getSessionTree(sessionId))?.session;
  if (!session || !Array.isArray(session.rootNodes) || session.rootNodes.length === 0) {
    state.expandedNodes.clear();
    state.expandedSessionId = null;
    showEmptyState();
    return;
  }

  // 只在同一会话重新渲染时保存当前展开状态，避免切换会话时串用旧 DOM。
  if (state.expandedSessionId === sessionId) {
    saveExpandedState();
  } else {
    const shouldExpandByDefault = state.currentSettings?.defaultExpand !== false &&
      Object.keys(session.allNodes || {}).length <= MAX_EAGER_TREE_NODES;
    state.expandedNodes = shouldExpandByDefault
      ? collectExpandableNodeIds(session)
      : new Set();
    state.expandedSessionId = sessionId;
  }
  
  // 应用排序
  const sortMode = state.currentSettings?.sortMode || SORT_MODES.SMART;
  const sortedSession = sortTree(session, sortMode);
  
  const sortedTree = sortedSession;
  const treeHtml = document.createElement('div');
  treeHtml.className = 'tree-wrapper';
  
  for (const rootId of sortedTree.rootNodes) {
    const node = sortedTree.allNodes[rootId];
    if (node) {
      treeHtml.appendChild(createTreeNode(node, sortedTree, 0));
    }
  }
  
  state.elements.treeContainer.replaceChildren(treeHtml);
  
  // 刷新拖拽手柄绑定
  const { refreshDragHandles } = await import('./dragDrop.js');
  refreshDragHandles();
}

/**
 * 保存展开状态
 */
function saveExpandedState() {
  const currentExpanded = new Set();
  state.elements.treeContainer?.querySelectorAll('.children-container:not(.collapsed)').forEach(el => {
    const nodeId = el.closest('.tree-node')?.dataset.nodeId;
    if (nodeId) currentExpanded.add(nodeId);
  });
  state.expandedNodes = currentExpanded;
}

/**
 * 收集默认需要展开的分支
 * @param {Object} session - 会话数据
 * @returns {Set<string>}
 */
function collectExpandableNodeIds(session) {
  const expanded = new Set();
  const visited = new Set();

  function visit(nodeId) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = session.allNodes?.[nodeId];
    if (!node) return;
    if (node.children?.length) {
      expanded.add(node.id);
      node.children.forEach(visit);
    }
  }

  (session.rootNodes || []).forEach(visit);
  return expanded;
}

/**
 * 创建树节点
 * @param {Object} node - 节点数据
 * @param {Object} session - 会话数据
 * @param {number} depth - 深度
 * @returns {HTMLElement}
 */
function createTreeNode(node, session, depth, ancestorIds = new Set()) {
  const container = document.createElement('div');
  // 超过深度3后使用特殊类名限制缩进
  const depthClass = depth > 3 ? 'depth-deep' : `depth-${depth}`;
  container.className = `tree-node ${depthClass}`;
  container.dataset.nodeId = node.id;
  container.dataset.depth = depth;
  container.tabIndex = 0; // 使节点可焦点，支持键盘导航

  const nextAncestorIds = new Set(ancestorIds);
  nextAncestorIds.add(node.id);
  
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = state.expandedNodes.has(node.id);
  
  const content = createNodeContent(node, hasChildren, isExpanded, depth);
  container.appendChild(content);
  
  if (hasChildren) {
    const childrenContainer = createChildrenContainer(
      node,
      session,
      depth,
      isExpanded,
      nextAncestorIds
    );
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
  
  const faviconUrl = state.currentSettings.showFavicons === false
    ? ''
    : getSafeFaviconUrl(node.url, node.favIconUrl);
  const title = node.title || t('noTitle');
  const truncatedTitle = truncateText(title, 40);
  const visitCount = node.visitCount || 1;
  
  const depthColors = ['var(--primary-color)', 'var(--text-secondary)', '#888', '#aaa'];
  const borderColor = depthColors[Math.min(depth, 3)];
  
  const dragHandle = document.createElement('span');
  dragHandle.className = 'drag-handle';
  dragHandle.draggable = true;
  dragHandle.title = '拖拽排序';
  dragHandle.setAttribute('aria-hidden', 'true');
  dragHandle.textContent = '::';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = `node-toggle ${hasChildren ? '' : 'leaf'}`;
  toggle.style.transform = isExpanded || !hasChildren ? 'rotate(0deg)' : 'rotate(-90deg)';
  toggle.style.opacity = hasChildren ? '1' : '0.3';
  toggle.setAttribute('aria-expanded', String(isExpanded));
  toggle.setAttribute('aria-label', hasChildren
    ? (isExpanded ? t('collapse') : t('expand'))
    : t('noTitle'));
  toggle.title = hasChildren ? (isExpanded ? t('collapse') : t('expand')) : t('noTitle');
  toggle.textContent = hasChildren ? '▼' : '●';
  toggle.disabled = !hasChildren;

  const icon = document.createElement('img');
  icon.className = 'node-icon';
  icon.alt = '';
  icon.setAttribute('aria-hidden', 'true');
  icon.loading = 'lazy';
  icon.decoding = 'async';
  if (faviconUrl) {
    icon.src = faviconUrl;
    icon.addEventListener('error', () => {
      icon.classList.add('is-hidden');
    }, { once: true });
  } else {
    icon.classList.add('is-hidden');
  }

  const titleElement = document.createElement('span');
  titleElement.className = 'node-title';
  titleElement.title = `${title}\n${node.url || ''}`;
  titleElement.textContent = truncatedTitle;

  content.append(dragHandle, toggle, icon, titleElement);

  if (visitCount > 1) {
    const badge = document.createElement('span');
    badge.className = 'node-badge';
    badge.title = t('visitCount', { count: visitCount });
    badge.style.borderColor = borderColor;
    badge.textContent = String(visitCount);
    content.appendChild(badge);
  }
  
  // 点击展开/折叠
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

  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'node-btn';
  openButton.title = t('open');
  openButton.setAttribute('aria-label', t('open'));
  openButton.textContent = '↗';

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'node-btn';
  deleteButton.title = t('delete');
  deleteButton.setAttribute('aria-label', t('delete'));
  deleteButton.textContent = '×';

  actions.append(openButton, deleteButton);

  openButton.onclick = (e) => {
    e.stopPropagation();
    api.openUrl(node.url);
  };
  
  deleteButton.onclick = (e) => {
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
function createChildrenContainer(node, session, depth, isExpanded, ancestorIds) {
  const container = document.createElement('div');
  container.className = 'children-container';
  container.dataset.rendered = 'false';
  container._mindGitTreeNode = node;
  container._mindGitSession = session;
  container._mindGitDepth = depth;
  container._mindGitAncestorIds = ancestorIds;
  if (!isExpanded) {
    container.classList.add('collapsed');
  }

  if (isExpanded) {
    renderChildren(container);
  }

  return container;
}

/**
 * 按需创建一个分支的直接子节点，避免初次打开大树时递归创建全部 DOM。
 * @param {HTMLElement} container - 子节点容器
 */
function renderChildren(container) {
  if (!container || container.dataset.rendered === 'true') return;

  const node = container._mindGitTreeNode;
  const session = container._mindGitSession;
  if (!node || !session) {
    container.dataset.rendered = 'true';
    return;
  }

  const depth = container._mindGitDepth;
  const ancestorIds = container._mindGitAncestorIds || new Set([node.id]);

  const fragment = document.createDocumentFragment();
  for (const childId of node.children || []) {
    if (ancestorIds.has(childId)) continue;
    const childNode = session.allNodes[childId];
    if (childNode) {
      fragment.appendChild(createTreeNode(childNode, session, depth + 1, ancestorIds));
    }
  }
  container.appendChild(fragment);
  container.dataset.rendered = 'true';
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
    renderChildren(childrenContainer);
    childrenContainer.classList.remove('collapsed');
    toggle.classList.remove('collapsed');
    toggle.style.transform = 'rotate(0deg)';
    toggle.setAttribute('aria-expanded', 'true');
    toggle.title = t('collapse');
    toggle.setAttribute('aria-label', t('collapse'));
    state.expandedNodes.add(nodeId);
  } else {
    // 折叠
    childrenContainer.classList.add('collapsed');
    toggle.classList.add('collapsed');
    toggle.style.transform = 'rotate(-90deg)';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.title = t('expand');
    toggle.setAttribute('aria-label', t('expand'));
    state.expandedNodes.delete(nodeId);
  }
}

/**
 * 删除节点
 * @param {string} nodeId - 节点 ID
 */
async function deleteNode(nodeId) {
  const result = await api.deleteNode(state.currentSessionId, nodeId);
  
  if (result?.success) {
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

      if (Object.keys(session.allNodes).length === 0) {
        state.expandedNodes.clear();
        state.expandedSessionId = null;
        showEmptyState();
      }
    }
  } else {
    showToast(t('deleteFailed', { error: result?.error || 'Unknown error' }));
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

  ensureNodeRendered(nodeId);
  
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
          toggle.setAttribute('aria-expanded', 'true');
          toggle.title = t('collapse');
          toggle.setAttribute('aria-label', t('collapse'));
        }
        if (parentNode?.dataset.nodeId) {
          state.expandedNodes.add(parentNode.dataset.nodeId);
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
 * 为搜索结果按需展开并渲染目标节点的父级路径。
 * @param {string} nodeId - 节点 ID
 */
function ensureNodeRendered(nodeId) {
  const session = state.currentSessions[state.currentSessionId];
  const targetNode = session?.allNodes?.[nodeId];
  if (!targetNode) return;

  const ancestorIds = [];
  const visited = new Set();
  let currentNode = targetNode;
  while (currentNode && !visited.has(currentNode.id)) {
    visited.add(currentNode.id);
    if (currentNode.parentId && session.allNodes[currentNode.parentId]) {
      ancestorIds.unshift(currentNode.parentId);
      currentNode = session.allNodes[currentNode.parentId];
    } else {
      break;
    }
  }

  const treeContainer = state.elements.treeContainer;
  for (const ancestorId of ancestorIds) {
    const parentElement = treeContainer?.querySelector(`.tree-node[data-node-id="${ancestorId}"]`);
    const childrenContainer = parentElement?.querySelector('.children-container');
    if (!childrenContainer) continue;

    renderChildren(childrenContainer);
    childrenContainer.classList.remove('collapsed');
    state.expandedNodes.add(ancestorId);

    const toggle = parentElement.querySelector('.node-toggle');
    if (toggle) {
      toggle.classList.remove('collapsed');
      toggle.style.transform = 'rotate(0deg)';
      toggle.setAttribute('aria-expanded', 'true');
      toggle.title = t('collapse');
      toggle.setAttribute('aria-label', t('collapse'));
    }
  }
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
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';

  const icon = document.createElement('div');
  icon.className = 'empty-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '🌱';

  const message = document.createElement('p');
  message.textContent = t('noRecords');

  const hint = document.createElement('p');
  hint.className = 'empty-hint';
  hint.textContent = t('startBrowsing');

  emptyState.append(icon, message, hint);
  state.elements.treeContainer.replaceChildren(emptyState);
}

/**
 * 展开全部节点 - 带动画效果
 */
export function expandAll() {
  const treeContainer = state.elements.treeContainer;
  treeContainer?.classList.add('is-bulk-updating');

  // 批量展开，避免为每个分支创建定时器。
  let unrenderedContainer = treeContainer?.querySelector('.children-container[data-rendered="false"]');
  while (unrenderedContainer) {
    renderChildren(unrenderedContainer);
    unrenderedContainer = treeContainer.querySelector('.children-container[data-rendered="false"]');
  }

  // 生成全部子树后再统一更新按钮状态，保证新生成的节点也同步展开状态。
  treeContainer?.querySelectorAll('.node-toggle:not(.leaf)').forEach(el => {
    el.style.transform = 'rotate(0deg)';
    el.classList.remove('collapsed');
    el.setAttribute('aria-expanded', 'true');
    el.title = t('collapse');
    el.setAttribute('aria-label', t('collapse'));
  });

  treeContainer?.querySelectorAll('.children-container.collapsed').forEach(el => {
    el.classList.remove('collapsed');
  });
  
  treeContainer?.querySelectorAll('.tree-node').forEach(node => {
    const nodeId = node.dataset.nodeId;
    if (node.querySelector('.children-container')) {
      state.expandedNodes.add(nodeId);
    }
  });
  state.expandedSessionId = state.currentSessionId;
  if (treeContainer) {
    requestAnimationFrame(() => treeContainer.classList.remove('is-bulk-updating'));
  }
  showToast(t('allExpanded'));
}

/**
 * 折叠全部节点 - 带动画效果
 */
export function collapseAll() {
  const treeContainer = state.elements.treeContainer;
  treeContainer?.classList.add('is-bulk-updating');

  // 先折叠容器
  treeContainer?.querySelectorAll('.children-container').forEach(el => {
    el.classList.add('collapsed');
  });
  
  // 更新按钮状态
  treeContainer?.querySelectorAll('.node-toggle:not(.leaf)').forEach(el => {
    el.style.transform = 'rotate(-90deg)';
    el.classList.add('collapsed');
    el.setAttribute('aria-expanded', 'false');
    el.title = t('expand');
    el.setAttribute('aria-label', t('expand'));
  });
  
  state.expandedNodes.clear();
  state.expandedSessionId = state.currentSessionId;
  if (treeContainer) {
    requestAnimationFrame(() => treeContainer.classList.remove('is-bulk-updating'));
  }
  showToast(t('allCollapsed'));
}
