// viewManager.js - 视图管理

import { state } from './state.js';
import * as api from './api.js';
import { loadTree } from './tree.js';
import { showToast } from './toast.js';
import { t } from './i18n.js';

/**
 * 加载会话视图（根据当前设置的视图模式）
 * @param {string} sessionId - 会话 ID
 */
export async function loadSessionView(sessionId) {
  const viewMode = state.currentSettings.viewMode || 'tree';
  
  if (viewMode === 'timeline') {
    await loadTimelineView(sessionId);
  } else {
    await loadTree(sessionId);
  }
}

/**
 * 加载时间线视图
 * @param {string} sessionId - 会话 ID
 */
async function loadTimelineView(sessionId) {
  const result = await api.getSessionTree(sessionId);
  
  if (!result.session || result.session.rootNodes.length === 0) {
    showEmptyState();
    return;
  }
  
  const session = result.session;
  
  // 构建节点路径映射
  const nodePaths = buildNodePaths(session);
  
  // 获取所有节点并按时间排序
  const allNodes = Object.values(session.allNodes)
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
  
  function buildPath(nodeId, path) {
    const node = session.allNodes[nodeId];
    if (!node) return;
    
    const currentPath = [...path, node];
    paths.set(nodeId, currentPath);
    
    if (node.children) {
      node.children.forEach(childId => buildPath(childId, currentPath));
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
  
  nodes.forEach(node => {
    const date = new Date(node.timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
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
  const totalNodes = Object.keys(session.allNodes).length;
  const statsEl = document.createElement('div');
  statsEl.className = 'timeline-stats';
  statsEl.innerHTML = `
    <span class="timeline-stats-item">共 ${totalNodes} 个页面</span>
    <span class="timeline-stats-item">${groupedNodes.length} 天的记录</span>
  `;
  timelineHtml.appendChild(statsEl);
  
  groupedNodes.forEach(group => {
    const dateGroup = createDateGroup(group, nodePaths, session);
    timelineHtml.appendChild(dateGroup);
  });
  
  container.innerHTML = '';
  container.appendChild(timelineHtml);
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
  dateHeader.innerHTML = `
    <span class="timeline-date-text">${group.date}</span>
    <span class="timeline-date-count">${group.nodes.length} 页面 · ${uniqueHosts} 个网站</span>
  `;
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
  
  const faviconUrl = node.favIconUrl || `https://www.google.com/s2/favicons?domain=${new URL(node.url).hostname}`;
  
  // 获取浏览路径
  const path = nodePaths.get(node.id) || [];
  const pathHtml = path.length > 1 ? `
    <div class="timeline-node-path">
      ${path.slice(0, -1).map(n => `<span class="path-item">${escapeHtml(truncateText(n.title || '无标题', 15))}</span>`).join('<span class="path-arrow">→</span>')}
    </div>
  ` : '';
  
  // 判断是根节点还是子节点
  const isRoot = path.length === 1;
  const nodeTypeIcon = isRoot ? '🔍' : '→';
  
  nodeEl.innerHTML = `
    <div class="timeline-node-indicator">
      <span class="timeline-node-type">${nodeTypeIcon}</span>
      <span class="timeline-node-time">${time}</span>
    </div>
    <div class="timeline-node-content">
      ${pathHtml}
      <div class="timeline-node-main">
        <img class="timeline-node-favicon" src="${faviconUrl}" alt="" onerror="this.style.display='none'">
        <div class="timeline-node-info">
          <div class="timeline-node-title" title="${escapeHtml(node.title || '')}">${escapeHtml(node.title || '无标题')}</div>
          <div class="timeline-node-url">${escapeHtml(truncateUrl(node.url))}</div>
        </div>
        ${node.visitCount > 1 ? `<span class="timeline-node-badge" title="访问 ${node.visitCount} 次">${node.visitCount}</span>` : ''}
      </div>
    </div>
  `;
  
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
  state.elements.treeContainer.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📅</div>
      <p>还没有浏览记录</p>
      <p class="empty-hint">开始浏览网页，我会帮你记录时间线~</p>
    </div>
  `;
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 截断文本
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

/**
 * 截断 URL
 */
function truncateUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url.length > 40 ? url.substring(0, 40) + '...' : url;
  }
}
