// search.js - 搜索功能

import { state } from './state.js';
import { t } from './i18n.js';
import { highlightNode } from './tree.js';

let searchQuery = '';
let searchResults = [];
let currentResultIndex = 0;

/**
 * 初始化搜索功能
 */
export function initSearch() {
  const searchInput = state.elements.searchInput;
  if (!searchInput) return;
  
  // 设置占位符
  searchInput.placeholder = t('searchPlaceholder') || '搜索会话和节点...';
  
  // 输入事件 - 实时搜索
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    if (searchQuery) {
      performSearch(searchQuery);
    } else {
      clearSearch();
    }
  });
  
  // 回车搜索
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && searchQuery) {
      navigateToNextResult();
    }
  });
  
  // 清空按钮 (ESC 清空)
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      searchQuery = '';
      clearSearch();
      searchInput.blur();
    }
  });
}

/**
 * 执行搜索
 * @param {string} query 搜索关键词
 */
function performSearch(query) {
  searchResults = [];
  
  // 搜索会话名称
  for (const [sessionId, session] of Object.entries(state.currentSessions)) {
    if (session.name.toLowerCase().includes(query)) {
      searchResults.push({
        type: 'session',
        sessionId: sessionId,
        name: session.name,
        match: session.name
      });
    }
    
    // 搜索会话中的节点
    if (session.allNodes) {
      for (const [nodeId, node] of Object.entries(session.allNodes)) {
        const title = (node.title || '').toLowerCase();
        const url = (node.url || '').toLowerCase();
        
        if (title.includes(query) || url.includes(query)) {
          searchResults.push({
            type: 'node',
            sessionId: sessionId,
            nodeId: nodeId,
            name: node.title || '无标题',
            url: node.url,
            match: title.includes(query) ? node.title : node.url
          });
        }
      }
    }
  }
  
  currentResultIndex = 0;
  
  // 更新搜索结果显示
  updateSearchResults();
}

/**
 * 清除搜索
 */
function clearSearch() {
  searchResults = [];
  currentResultIndex = 0;
  searchQuery = '';
  
  // 移除高亮
  document.querySelectorAll('.search-highlight').forEach(el => {
    el.classList.remove('search-highlight');
  });
  
  // 移除搜索结果显示
  const searchResultsEl = document.getElementById('searchResults');
  if (searchResultsEl) {
    searchResultsEl.remove();
  }
}

/**
 * 更新搜索结果显示
 */
function updateSearchResults() {
  // 移除旧的搜索结果显示
  const existingResults = document.getElementById('searchResults');
  if (existingResults) {
    existingResults.remove();
  }
  
  if (searchResults.length === 0) {
    return;
  }
  
  // 创建搜索结果显示
  const resultsEl = document.createElement('div');
  resultsEl.id = 'searchResults';
  resultsEl.className = 'search-results';
  resultsEl.innerHTML = `
    <span class="search-count">${t('searchResults').replace('{count}', searchResults.length)}</span>
    <span class="search-nav">${currentResultIndex + 1} / ${searchResults.length}</span>
    <button class="search-nav-btn" id="prevResult">↑</button>
    <button class="search-nav-btn" id="nextResult">↓</button>
  `;
  
  const searchBox = document.querySelector('.search-box');
  if (searchBox) {
    searchBox.appendChild(resultsEl);
  }
  
  // 绑定导航按钮
  const prevBtn = document.getElementById('prevResult');
  const nextBtn = document.getElementById('nextResult');
  
  if (prevBtn) {
    prevBtn.addEventListener('click', navigateToPrevResult);
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', navigateToNextResult);
  }
  
  // 自动导航到第一个结果
  navigateToResult(0);
}

/**
 * 导航到上一个结果
 */
function navigateToPrevResult() {
  if (searchResults.length === 0) return;
  currentResultIndex = (currentResultIndex - 1 + searchResults.length) % searchResults.length;
  navigateToResult(currentResultIndex);
  updateSearchResults();
}

/**
 * 导航到下一个结果
 */
function navigateToNextResult() {
  if (searchResults.length === 0) return;
  currentResultIndex = (currentResultIndex + 1) % searchResults.length;
  navigateToResult(currentResultIndex);
  updateSearchResults();
}

/**
 * 导航到指定结果
 * @param {number} index 结果索引
 */
function navigateToResult(index) {
  const result = searchResults[index];
  if (!result) return;
  
  // 如果是会话级别的搜索
  if (result.type === 'session') {
    // 切换到该会话
    import('./sessionManager.js').then(m => m.switchToSession(result.sessionId));
  } else if (result.type === 'node') {
    // 切换到该会话
    import('./sessionManager.js').then(m => m.switchToSession(result.sessionId));
    
    // 高亮节点
    setTimeout(() => {
      highlightNode(result.nodeId);
    }, 100);
  }
}

/**
 * 获取当前搜索结果
 * @returns {Array} 搜索结果数组
 */
export function getSearchResults() {
  return searchResults;
}

/**
 * 高亮显示节点
 * @param {string} nodeId 节点ID
 */
export function highlightSearchResult(nodeId) {
  // 移除旧的高亮
  document.querySelectorAll('.search-highlight').forEach(el => {
    el.classList.remove('search-highlight');
  });
  
  // 查找节点元素
  const nodeEl = document.querySelector(`[data-node-id="${nodeId}"]`);
  if (nodeEl) {
    nodeEl.classList.add('search-highlight');
    nodeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
