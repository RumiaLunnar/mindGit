// search.js - 搜索功能

import { state } from './state.js';
import { t } from './i18n.js';
import { highlightNode } from './tree.js';

let searchQuery = '';
let searchResults = [];
let currentResultIndex = -1;
let isSearchModalOpen = false;

/**
 * 打开搜索弹窗
 */
export function openSearchModal() {
  const { searchModal, searchInput, searchNav, searchResultsList } = state.elements;
  
  isSearchModalOpen = true;
  searchModal.classList.add('active');
  searchInput.value = '';
  searchInput.focus();
  searchNav.style.display = 'none';
  searchResultsList.innerHTML = '';
  searchQuery = '';
  searchResults = [];
  currentResultIndex = -1;
  
  // 绑定搜索输入事件
  searchInput.oninput = handleSearchInput;
  searchInput.onkeydown = handleSearchKeydown;
}

/**
 * 关闭搜索弹窗
 */
export function closeSearchModal() {
  const { searchModal, searchInput } = state.elements;
  
  isSearchModalOpen = false;
  searchModal.classList.remove('active');
  searchInput.value = '';
  searchQuery = '';
  searchResults = [];
  currentResultIndex = -1;
  
  // 清除高亮
  document.querySelectorAll('.search-highlight').forEach(el => {
    el.classList.remove('search-highlight');
  });
}

/**
 * 处理搜索输入
 */
function handleSearchInput(e) {
  searchQuery = e.target.value.trim().toLowerCase();
  
  if (searchQuery) {
    performSearch(searchQuery);
  } else {
    clearSearchResults();
  }
}

/**
 * 处理搜索键盘事件
 */
function handleSearchKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (searchResults.length > 0) {
      navigateToNextResult();
    }
  } else if (e.key === 'Escape') {
    closeSearchModal();
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    navigateToNextResult();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    navigateToPrevResult();
  }
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
        match: session.name,
        icon: '📁'
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
            name: node.title || t('noTitle'),
            url: node.url,
            match: title.includes(query) ? node.title : node.url,
            icon: '📄'
          });
        }
      }
    }
  }
  
  currentResultIndex = searchResults.length > 0 ? 0 : -1;
  
  // 更新搜索结果显示
  renderSearchResults();
  updateSearchNav();
  
  // 自动导航到第一个结果
  if (currentResultIndex >= 0) {
    navigateToResult(currentResultIndex);
  }
}

/**
 * 清除搜索结果
 */
function clearSearchResults() {
  searchResults = [];
  currentResultIndex = -1;
  
  const { searchNav, searchResultsList } = state.elements;
  searchNav.style.display = 'none';
  searchResultsList.innerHTML = '';
  
  // 移除高亮
  document.querySelectorAll('.search-highlight').forEach(el => {
    el.classList.remove('search-highlight');
  });
}

/**
 * 渲染搜索结果列表
 */
function renderSearchResults() {
  const { searchResultsList } = state.elements;
  
  if (searchResults.length === 0) {
    if (searchQuery) {
      searchResultsList.innerHTML = `
        <div class="search-no-results">
          <span class="search-no-results-icon">🔍</span>
          <span>${t('noSearchResults')}</span>
        </div>
      `;
    } else {
      searchResultsList.innerHTML = '';
    }
    return;
  }
  
  searchResultsList.innerHTML = searchResults.map((result, index) => `
    <div class="search-result-item ${index === currentResultIndex ? 'active' : ''}" data-index="${index}">
      <span class="search-result-icon">${result.icon}</span>
      <div class="search-result-info">
        <div class="search-result-name">${escapeHtml(result.name)}</div>
        ${result.url ? `<div class="search-result-url">${escapeHtml(truncateUrl(result.url))}</div>` : ''}
      </div>
    </div>
  `).join('');
  
  // 绑定点击事件
  searchResultsList.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const index = parseInt(item.dataset.index);
      currentResultIndex = index;
      navigateToResult(index);
      renderSearchResults();
      updateSearchNav();
    });
  });
}

/**
 * 更新搜索导航状态
 */
function updateSearchNav() {
  const { searchNav, searchCount } = state.elements;
  
  if (searchResults.length === 0) {
    searchNav.style.display = 'none';
    return;
  }
  
  searchNav.style.display = 'flex';
  searchCount.textContent = `${currentResultIndex + 1}/${searchResults.length}`;
}

/**
 * 导航到上一个结果
 */
function navigateToPrevResult() {
  if (searchResults.length === 0) return;
  currentResultIndex = (currentResultIndex - 1 + searchResults.length) % searchResults.length;
  navigateToResult(currentResultIndex);
  renderSearchResults();
  updateSearchNav();
}

/**
 * 导航到下一个结果
 */
function navigateToNextResult() {
  if (searchResults.length === 0) return;
  currentResultIndex = (currentResultIndex + 1) % searchResults.length;
  navigateToResult(currentResultIndex);
  renderSearchResults();
  updateSearchNav();
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
    import('./sessionManager.js').then(m => {
      m.switchToSession(result.sessionId);
      // 高亮会话
      setTimeout(() => highlightSession(result.sessionId), 100);
    });
  } else if (result.type === 'node') {
    // 切换到该会话
    import('./sessionManager.js').then(m => {
      m.switchToSession(result.sessionId);
      // 高亮节点
      setTimeout(() => highlightNode(result.nodeId), 100);
    });
  }
}

/**
 * 高亮显示会话
 * @param {string} sessionId - 会话ID
 */
function highlightSession(sessionId) {
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
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    return urlObj.hostname + urlObj.pathname;
  } catch {
    return url.length > 50 ? url.substring(0, 50) + '...' : url;
  }
}

/**
 * 初始化搜索功能
 */
export function initSearch() {
  const { searchModal, closeSearch, prevResult, nextResult } = state.elements;
  
  // 关闭按钮
  closeSearch.addEventListener('click', closeSearchModal);
  
  // 点击背景关闭
  searchModal.addEventListener('click', (e) => {
    if (e.target === searchModal) {
      closeSearchModal();
    }
  });
  
  // 导航按钮
  prevResult.addEventListener('click', navigateToPrevResult);
  nextResult.addEventListener('click', navigateToNextResult);
}

/**
 * 获取当前搜索结果
 * @returns {Array} 搜索结果数组
 */
export function getSearchResults() {
  return searchResults;
}
