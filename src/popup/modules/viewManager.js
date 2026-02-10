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
  const allNodes = Object.values(session.allNodes);
  
  // 按时间排序
  const sortedNodes = allNodes.sort((a, b) => b.timestamp - a.timestamp);
  
  // 按日期分组
  const groupedNodes = groupNodesByDate(sortedNodes);
  
  // 渲染时间线
  renderTimeline(groupedNodes);
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
    const dateKey = date.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'short'
    });
    
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
 * 渲染时间线
 * @param {Array} groupedNodes - 分组后的节点
 */
function renderTimeline(groupedNodes) {
  const container = state.elements.treeContainer;
  
  const timelineHtml = document.createElement('div');
  timelineHtml.className = 'timeline-wrapper';
  
  groupedNodes.forEach(group => {
    const dateGroup = createDateGroup(group);
    timelineHtml.appendChild(dateGroup);
  });
  
  container.innerHTML = '';
  container.appendChild(timelineHtml);
}

/**
 * 创建日期分组
 * @param {Object} group - 日期分组
 * @returns {HTMLElement}
 */
function createDateGroup(group) {
  const groupEl = document.createElement('div');
  groupEl.className = 'timeline-date-group';
  
  // 日期标题
  const dateHeader = document.createElement('div');
  dateHeader.className = 'timeline-date-header';
  dateHeader.textContent = group.date;
  groupEl.appendChild(dateHeader);
  
  // 节点列表
  const nodesList = document.createElement('div');
  nodesList.className = 'timeline-nodes-list';
  
  group.nodes.forEach(node => {
    const nodeEl = createTimelineNode(node);
    nodesList.appendChild(nodeEl);
  });
  
  groupEl.appendChild(nodesList);
  return groupEl;
}

/**
 * 创建时间线节点
 * @param {Object} node - 节点数据
 * @returns {HTMLElement}
 */
function createTimelineNode(node) {
  const nodeEl = document.createElement('div');
  nodeEl.className = 'timeline-node';
  
  const time = new Date(node.timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const faviconUrl = node.favIconUrl || `https://www.google.com/s2/favicons?domain=${new URL(node.url).hostname}`;
  
  nodeEl.innerHTML = `
    <div class="timeline-node-time">${time}</div>
    <div class="timeline-node-content">
      <img class="timeline-node-favicon" src="${faviconUrl}" alt="" onerror="this.style.display='none'">
      <div class="timeline-node-info">
        <div class="timeline-node-title" title="${escapeHtml(node.title || '')}">${escapeHtml(node.title || '无标题')}</div>
        <div class="timeline-node-url">${escapeHtml(truncateUrl(node.url))}</div>
      </div>
      ${node.visitCount > 1 ? `<span class="timeline-node-badge">${node.visitCount}</span>` : ''}
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
 * 截断 URL
 */
function truncateUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname + urlObj.pathname;
  } catch {
    return url.length > 50 ? url.substring(0, 50) + '...' : url;
  }
}
