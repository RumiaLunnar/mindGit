// viewManager.js - 视图管理

import { state } from './state.js';
import * as api from './api.js';
import { loadTree } from './tree.js';
import { t } from './i18n.js';
import { getSafeFaviconUrl, truncateText, truncateUrl } from './utils.js';

/**
 * 加载会话视图（根据当前设置的视图模式）
 * @param {string} sessionId - 会话 ID
 */
export async function loadSessionView(sessionId, providedSession = null) {
  const viewMode = state.currentSettings?.viewMode || 'tree';

  if (state.elements.viewModeBadge) {
    state.elements.viewModeBadge.textContent = viewMode === 'timeline'
      ? t('timelineShort')
      : t('treeShort');
  }
  
  if (viewMode === 'timeline') {
    await loadTimelineView(sessionId, providedSession);
  } else {
    await loadTree(sessionId, providedSession);
  }
}

/**
 * 加载时间线视图
 * @param {string} sessionId - 会话 ID
 */
async function loadTimelineView(sessionId, providedSession = null) {
  const session = providedSession || (await api.getSessionTree(sessionId))?.session;

  if (!session || !Array.isArray(session.rootNodes) || session.rootNodes.length === 0) {
    showEmptyState();
    return;
  }
  
  // 构建节点路径映射
  const nodePaths = buildNodePaths(session);
  
  // 获取所有节点并按时间排序
  const allNodes = Object.values(session.allNodes || {})
    .filter(node => node.timestamp) // 过滤掉没有时间戳的
    .sort((a, b) => b.timestamp - a.timestamp);
  
  // 按日期分组
  const groupedNodes = groupNodesByDate(allNodes);
  
  // 渲染时间线
  renderTimeline(groupedNodes, nodePaths, session);
}

/**
 * 构建节点路径映射
 * @param {Object} session - 会话数据
 * @returns {Map} 节点ID到路径的映射
 */
function buildNodePaths(session) {
  const paths = new Map();
  const allNodes = session.allNodes || {};
  
  function buildPath(nodeId, path, visited = new Set()) {
    if (visited.has(nodeId)) return;

    const node = allNodes[nodeId];
    if (!node) return;
    
    const currentPath = [...path, node];
    paths.set(nodeId, currentPath);
    const nextVisited = new Set(visited);
    nextVisited.add(nodeId);
    
    if (node.children) {
      node.children.forEach(childId => buildPath(childId, currentPath, nextVisited));
    }
  }
  
  session.rootNodes.forEach(rootId => buildPath(rootId, []));
  return paths;
}

/**
 * 按日期分组节点
 * @param {Array} nodes - 节点数组
 * @returns {Array} 分组后的数组
 */
function groupNodesByDate(nodes) {
  const groups = {};
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  nodes.forEach(node => {
    const date = new Date(node.timestamp);
    
    let dateKey;
    if (isSameDay(date, today)) {
      dateKey = '今天';
    } else if (isSameDay(date, yesterday)) {
      dateKey = '昨天';
    } else {
      dateKey = date.toLocaleDateString('zh-CN', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'short'
      });
    }
    
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(node);
  });
  
  // 转换为数组
  return Object.entries(groups).map(([date, nodes]) => ({
    date,
    nodes
  }));
}

/**
 * 判断是否是同一天
 */
function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

/**
 * 渲染时间线
 * @param {Array} groupedNodes - 分组后的节点
 * @param {Map} nodePaths - 节点路径映射
 * @param {Object} session - 会话数据
 */
function renderTimeline(groupedNodes, nodePaths, session) {
  const container = state.elements.treeContainer;
  
  const timelineHtml = document.createElement('div');
  timelineHtml.className = 'timeline-wrapper';
  
  // 添加统计信息
  const totalNodes = Object.keys(session.allNodes || {}).length;
  const statsEl = document.createElement('div');
  statsEl.className = 'timeline-stats';
  const nodeStats = document.createElement('span');
  nodeStats.className = 'timeline-stats-item';
  nodeStats.textContent = t('timelineStatsNodes', { count: totalNodes });
  const dayStats = document.createElement('span');
  dayStats.className = 'timeline-stats-item';
  dayStats.textContent = t('timelineStatsDays', { count: groupedNodes.length });
  statsEl.append(nodeStats, dayStats);
  timelineHtml.appendChild(statsEl);
  
  groupedNodes.forEach(group => {
    const dateGroup = createDateGroup(group, nodePaths, session);
    timelineHtml.appendChild(dateGroup);
  });
  
  container.replaceChildren(timelineHtml);
}

/**
 * 创建日期分组
 * @param {Object} group - 日期分组
 * @param {Map} nodePaths - 节点路径映射
 * @param {Object} session - 会话数据
 * @returns {HTMLElement}
 */
function createDateGroup(group, nodePaths, session) {
  const groupEl = document.createElement('div');
  groupEl.className = 'timeline-date-group';
  
  // 计算这天的统计
  const uniqueHosts = new Set(group.nodes.map(n => {
    try {
      return new URL(n.url).hostname;
    } catch {
      return '';
    }
  })).size;
  
  // 日期标题
  const dateHeader = document.createElement('div');
  dateHeader.className = 'timeline-date-header';
  const dateText = document.createElement('span');
  dateText.className = 'timeline-date-text';
  dateText.textContent = group.date;
  const dateCount = document.createElement('span');
  dateCount.className = 'timeline-date-count';
  dateCount.textContent = t('timelineDateSummary', {
    pages: group.nodes.length,
    sites: uniqueHosts
  });
  dateHeader.append(dateText, dateCount);
  groupEl.appendChild(dateHeader);
  
  // 节点列表
  const nodesList = document.createElement('div');
  nodesList.className = 'timeline-nodes-list';
  
  group.nodes.forEach(node => {
    const nodeEl = createTimelineNode(node, nodePaths);
    nodesList.appendChild(nodeEl);
  });
  
  groupEl.appendChild(nodesList);
  return groupEl;
}

/**
 * 创建时间线节点
 * @param {Object} node - 节点数据
 * @param {Map} nodePaths - 节点路径映射
 * @returns {HTMLElement}
 */
function createTimelineNode(node, nodePaths) {
  const nodeEl = document.createElement('div');
  nodeEl.className = 'timeline-node';
  
  const time = new Date(node.timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const faviconUrl = state.currentSettings.showFavicons === false
    ? ''
    : getSafeFaviconUrl(node.url, node.favIconUrl);
  
  // 获取浏览路径
  const path = nodePaths.get(node.id) || [];

  // 判断是根节点还是子节点
  const isRoot = path.length === 1;
  const nodeTypeIcon = isRoot ? '🔍' : '→';

  const indicator = document.createElement('div');
  indicator.className = 'timeline-node-indicator';
  const type = document.createElement('span');
  type.className = 'timeline-node-type';
  type.textContent = nodeTypeIcon;
  const timeElement = document.createElement('span');
  timeElement.className = 'timeline-node-time';
  timeElement.textContent = time;
  indicator.append(type, timeElement);

  const nodeContent = document.createElement('div');
  nodeContent.className = 'timeline-node-content';

  if (path.length > 1) {
    const pathElement = document.createElement('div');
    pathElement.className = 'timeline-node-path';
    path.slice(0, -1).forEach((pathNode, index, pathNodes) => {
      const pathItem = document.createElement('span');
      pathItem.className = 'path-item';
      pathItem.textContent = truncateText(pathNode.title || t('noTitle'), 15);
      pathElement.appendChild(pathItem);

      if (index < pathNodes.length - 1) {
        const arrow = document.createElement('span');
        arrow.className = 'path-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '→';
        pathElement.appendChild(arrow);
      }
    });
    nodeContent.appendChild(pathElement);
  }

  const main = document.createElement('div');
  main.className = 'timeline-node-main';

  const favicon = document.createElement('img');
  favicon.className = 'timeline-node-favicon';
  favicon.alt = '';
  favicon.setAttribute('aria-hidden', 'true');
  favicon.loading = 'lazy';
  favicon.decoding = 'async';
  if (faviconUrl) {
    favicon.src = faviconUrl;
    favicon.addEventListener('error', () => {
      favicon.classList.add('is-hidden');
    }, { once: true });
  } else {
    favicon.classList.add('is-hidden');
  }

  const info = document.createElement('div');
  info.className = 'timeline-node-info';
  const titleElement = document.createElement('div');
  titleElement.className = 'timeline-node-title';
  titleElement.title = node.title || t('noTitle');
  titleElement.textContent = node.title || t('noTitle');
  const urlElement = document.createElement('div');
  urlElement.className = 'timeline-node-url';
  urlElement.textContent = truncateUrl(node.url);
  info.append(titleElement, urlElement);
  main.append(favicon, info);

  if (node.visitCount > 1) {
    const badge = document.createElement('span');
    badge.className = 'timeline-node-badge';
    badge.title = t('visitCount', { count: node.visitCount });
    badge.textContent = String(node.visitCount);
    main.appendChild(badge);
  }

  nodeContent.appendChild(main);
  nodeEl.append(indicator, nodeContent);
  
  // 点击打开链接
  nodeEl.addEventListener('click', () => {
    api.openUrl(node.url);
  });
  
  return nodeEl;
}

/**
 * 显示空状态
 */
function showEmptyState() {
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';

  const icon = document.createElement('div');
  icon.className = 'empty-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '📅';

  const message = document.createElement('p');
  message.textContent = t('noRecords');

  const hint = document.createElement('p');
  hint.className = 'empty-hint';
  hint.textContent = t('timelineStartBrowsing');

  emptyState.append(icon, message, hint);
  state.elements.treeContainer.replaceChildren(emptyState);
}
