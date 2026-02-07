// mindGit - 浏览脉络追踪器

// 状态管理
let currentSessions = {};
let currentSessionId = null;
let currentSettings = {};
let expandedNodes = new Set();
let lastDataHash = null;
let isDarkMode = false;

// DOM 元素
const elements = {
  themeBtn: document.getElementById('themeBtn'),
  sessionSelect: document.getElementById('sessionSelect'),
  deleteSessionBtn: document.getElementById('deleteSessionBtn'),
  treeContainer: document.getElementById('treeContainer'),
  statsInfo: document.getElementById('statsInfo'),
  refreshBtn: document.getElementById('refreshBtn'),
  newSessionBtn: document.getElementById('newSessionBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  clearAllBtn: document.getElementById('clearAllBtn'),
  expandAllBtn: document.getElementById('expandAllBtn'),
  collapseAllBtn: document.getElementById('collapseAllBtn'),
  settingsModal: document.getElementById('settingsModal'),
  closeSettings: document.getElementById('closeSettings'),
  saveSettings: document.getElementById('saveSettings'),
  newSessionModal: document.getElementById('newSessionModal'),
  closeNewSession: document.getElementById('closeNewSession'),
  confirmNewSession: document.getElementById('confirmNewSession'),
  newSessionName: document.getElementById('newSessionName'),
  // 设置项
  maxSessions: document.getElementById('maxSessions'),
  autoClean: document.getElementById('autoClean'),
  showFavicons: document.getElementById('showFavicons'),
  defaultExpand: document.getElementById('defaultExpand')
};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadTheme();
  await loadSettings();
  await loadSessions();
  setupEventListeners();
  
  // 监听存储变化
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.sessions) {
      checkAndRefresh();
    }
  });
});

// 加载主题
async function loadTheme() {
  const result = await chrome.storage.local.get('theme');
  isDarkMode = result.theme === 'dark';
  applyTheme();
}

// 应用主题
function applyTheme() {
  if (isDarkMode) {
    document.documentElement.setAttribute('data-theme', 'dark');
    elements.themeBtn.textContent = '☀️';
    elements.themeBtn.title = '切换到亮色模式';
  } else {
    document.documentElement.removeAttribute('data-theme');
    elements.themeBtn.textContent = '🌙';
    elements.themeBtn.title = '切换到暗色模式';
  }
}

// 切换主题
async function toggleTheme() {
  isDarkMode = !isDarkMode;
  await chrome.storage.local.set({ theme: isDarkMode ? 'dark' : 'light' });
  applyTheme();
}

// 检查数据是否有变化
async function checkAndRefresh() {
  const result = await chrome.storage.local.get(['sessions', 'currentSession']);
  const newHash = hashSessions(result.sessions);
  
  if (newHash !== lastDataHash) {
    lastDataHash = newHash;
    await loadSessions();
  }
}

// 简单的哈希函数
function hashSessions(sessions) {
  if (!sessions) return '';
  const keys = Object.keys(sessions).sort();
  let hash = '';
  for (const key of keys) {
    const session = sessions[key];
    hash += `${key}:${session.rootNodes.length},${Object.keys(session.allNodes).length};`;
  }
  return hash;
}

// 加载设置
async function loadSettings() {
  const result = await chrome.storage.local.get('settings');
  currentSettings = result.settings || {
    maxSessions: 50,
    maxNodesPerSession: 500,
    autoCleanOldSessions: true,
    showFavicons: true,
    defaultExpand: true
  };
  
  elements.maxSessions.value = currentSettings.maxSessions;
  elements.autoClean.checked = currentSettings.autoCleanOldSessions;
  elements.showFavicons.checked = currentSettings.showFavicons !== false;
  elements.defaultExpand.checked = currentSettings.defaultExpand !== false;
}

// 加载会话列表
async function loadSessions() {
  const result = await chrome.runtime.sendMessage({ action: 'getSessions' });
  currentSessions = result.sessions || {};
  // 只有在没有当前会话时才使用后台的 currentSession
  if (!currentSessionId) {
    currentSessionId = result.currentSession;
  }
  
  lastDataHash = hashSessions(currentSessions);
  
  const select = elements.sessionSelect;
  select.innerHTML = '<option value="">选择会话...</option>';
  
  const sortedSessions = Object.values(currentSessions)
    .sort((a, b) => b.startTime - a.startTime);
  
  // 如果当前会话不在列表中，清空选择
  if (currentSessionId && !currentSessions[currentSessionId]) {
    currentSessionId = null;
  }
  
  for (const session of sortedSessions) {
    const option = document.createElement('option');
    option.value = session.id;
    option.textContent = session.name;
    if (session.id === currentSessionId) {
      option.selected = true;
    }
    select.appendChild(option);
  }
  
  if (currentSessionId && currentSessions[currentSessionId]) {
    await loadTree(currentSessionId);
  } else {
    showEmptyState();
  }
  
  await updateStats();
}

// 加载树形结构
async function loadTree(sessionId) {
  const result = await chrome.runtime.sendMessage({ 
    action: 'getSessionTree', 
    sessionId 
  });
  
  if (!result.session) {
    showEmptyState();
    return;
  }
  
  const session = result.session;
  
  if (session.rootNodes.length === 0) {
    showEmptyState();
    return;
  }
  
  // 保存当前的展开状态
  const currentExpanded = new Set();
  document.querySelectorAll('.children-container:not(.collapsed)').forEach(el => {
    const nodeId = el.closest('.tree-node')?.dataset.nodeId;
    if (nodeId) currentExpanded.add(nodeId);
  });
  if (currentExpanded.size > 0) {
    expandedNodes = currentExpanded;
  }
  
  const treeHtml = document.createElement('div');
  treeHtml.className = 'tree-wrapper';
  
  for (const rootId of session.rootNodes) {
    const node = session.allNodes[rootId];
    if (node) {
      const nodeElement = createTreeNode(node, session, 0);
      treeHtml.appendChild(nodeElement);
    }
  }
  
  elements.treeContainer.innerHTML = '';
  elements.treeContainer.appendChild(treeHtml);
}

// 创建树节点元素（简化版）
function createTreeNode(node, session, depth) {
  const container = document.createElement('div');
  container.className = `tree-node depth-${Math.min(depth, 3)}`;
  container.dataset.nodeId = node.id;
  
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id) || currentSettings.defaultExpand !== false;
  
  const content = document.createElement('div');
  content.className = 'node-content';
  content.style.marginLeft = `${depth * 4}px`;
  
  // 展开/折叠按钮
  const toggle = document.createElement('span');
  toggle.className = hasChildren ? 'node-toggle' : 'node-toggle leaf';
  toggle.textContent = hasChildren ? (isExpanded ? '▼' : '▶') : '•';
  toggle.onclick = (e) => {
    e.stopPropagation();
    if (hasChildren) toggleNode(node.id, container);
  };
  content.appendChild(toggle);
  
  // 图标
  const icon = document.createElement('img');
  icon.className = 'node-icon';
  icon.src = node.favIconUrl || generateFaviconUrl(node.url);
  icon.onerror = () => { icon.src = generateFaviconUrl(node.url); };
  content.appendChild(icon);
  
  // 标题（单行，带tooltip显示完整信息）
  const title = document.createElement('div');
  title.className = 'node-title';
  title.textContent = truncateText(node.title || '无标题', 35);
  title.title = `${node.title}\n${node.url}${node.visitCount > 1 ? '\n访问: ' + node.visitCount + '次' : ''}`;
  content.appendChild(title);
  
  // 访问次数（小 badge）
  if (node.visitCount > 1) {
    const badge = document.createElement('span');
    badge.className = 'node-badge';
    badge.textContent = node.visitCount;
    content.appendChild(badge);
  }
  
  // 操作按钮组（简化）
  const actions = document.createElement('div');
  actions.className = 'node-actions';
  
  // 打开
  actions.innerHTML = `
    <button class="node-btn" title="打开">↗️</button>
    <button class="node-btn" title="删除">🗑️</button>
  `;
  
  // 打开按钮事件
  actions.children[0].onclick = (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ action: 'openUrl', url: node.url });
  };
  
  // 删除按钮事件
  actions.children[1].onclick = (e) => {
    e.stopPropagation();
    if (confirm('确定要删除这个节点吗？')) {
      deleteNode(node.id, session.id);
    }
  };
  
  content.appendChild(actions);
  
  // 点击标题打开链接
  title.onclick = () => {
    chrome.runtime.sendMessage({ action: 'openUrl', url: node.url });
  };
  
  container.appendChild(content);
  
  // 子节点
  if (hasChildren) {
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'children-container';
    if (!isExpanded) childrenContainer.classList.add('collapsed');
    
    for (const childId of node.children) {
      const childNode = session.allNodes[childId];
      if (childNode) {
        childrenContainer.appendChild(createTreeNode(childNode, session, depth + 1));
      }
    }
    container.appendChild(childrenContainer);
  }
  
  return container;
}

// 删除节点
async function deleteNode(nodeId, sessionId) {
  const result = await chrome.runtime.sendMessage({ 
    action: 'deleteNode', 
    sessionId,
    nodeId 
  });
  
  if (result.success) {
    showToast('节点已删除');
    await loadTree(sessionId);
  } else {
    showToast('删除失败: ' + (result.error || '未知错误'));
  }
}

// 展开/折叠节点
function toggleNode(nodeId, container) {
  const childrenContainer = container.querySelector('.children-container');
  const toggle = container.querySelector('.node-toggle');
  
  if (childrenContainer) {
    if (childrenContainer.classList.contains('collapsed')) {
      childrenContainer.classList.remove('collapsed');
      toggle.textContent = '▼';
      expandedNodes.add(nodeId);
    } else {
      childrenContainer.classList.add('collapsed');
      toggle.textContent = '▶';
      expandedNodes.delete(nodeId);
    }
  }
}

// 生成网站图标URL
function generateFaviconUrl(url) {
  try {
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
  } catch (e) {
    return '';
  }
}

// 截断文本显示
function truncateText(text, maxLength = 40) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// 截断URL显示
function truncateUrl(url, maxLength = 35) {
  if (!url) return '';
  if (url.length <= maxLength) return url;
  
  try {
    const urlObj = new URL(url);
    let display = urlObj.hostname;
    if (urlObj.pathname !== '/' && urlObj.pathname.length > 1) {
      const path = urlObj.pathname;
      display += path.length > 20 ? path.substring(0, 20) + '...' : path;
    }
    return display;
  } catch (e) {
    return url.substring(0, maxLength) + '...';
  }
}

// 显示空状态
function showEmptyState() {
  elements.treeContainer.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">🌱</div>
      <p>还没有浏览记录</p>
      <p class="empty-hint">开始浏览网页，我会帮你记录跳转脉络~</p>
    </div>
  `;
}

// 更新统计信息
async function updateStats() {
  if (!currentSessionId) {
    elements.statsInfo.innerHTML = '💤 无活动会话';
    return;
  }
  
  // 直接从后台获取最新会话数据
  const result = await chrome.runtime.sendMessage({ 
    action: 'getSessionTree', 
    sessionId: currentSessionId 
  });
  
  if (!result.session) {
    elements.statsInfo.innerHTML = '💤 无活动会话';
    return;
  }
  
  const session = result.session;
  const nodeCount = Object.keys(session.allNodes || {}).length;
  const rootCount = (session.rootNodes || []).length;
  
  elements.statsInfo.innerHTML = `
    <strong>${session.name}</strong> · 
    <span style="color: var(--primary-color)">${rootCount}</span> 个起点 · 
    <span style="color: var(--primary-color)">${nodeCount}</span> 个页面
  `;
}

// 设置事件监听
function setupEventListeners() {
  // 主题切换
  elements.themeBtn.addEventListener('click', toggleTheme);
  
  // 刷新按钮
  elements.refreshBtn.addEventListener('click', async () => {
    elements.refreshBtn.innerHTML = '<span class="loading-spinner"></span>';
    await loadSessions();
    elements.refreshBtn.innerHTML = '🔄';
    showToast('已刷新');
  });
  
  // 会话选择
  elements.sessionSelect.addEventListener('change', async (e) => {
    const sessionId = e.target.value;
    if (sessionId) {
      currentSessionId = sessionId;
      expandedNodes.clear();
      await chrome.runtime.sendMessage({ 
        action: 'switchSession', 
        sessionId 
      });
      // 重新加载所有会话数据确保同步
      const result = await chrome.runtime.sendMessage({ action: 'getSessions' });
      currentSessions = result.sessions || {};
      await loadTree(sessionId);
      await updateStats();
    } else {
      currentSessionId = null;
      expandedNodes.clear();
      showEmptyState();
      await updateStats();
    }
  });
  
  // 删除会话
  elements.deleteSessionBtn.addEventListener('click', async () => {
    if (!currentSessionId) {
      showToast('请先选择会话');
      return;
    }
    
    if (confirm('确定要删除这个会话吗？此操作不可撤销。')) {
      await chrome.runtime.sendMessage({ 
        action: 'deleteSession', 
        sessionId: currentSessionId 
      });
      currentSessionId = null;
      await loadSessions();
      showToast('会话已删除');
    }
  });
  
  // 新建会话
  elements.newSessionBtn.addEventListener('click', () => {
    elements.newSessionModal.classList.add('active');
    elements.newSessionName.focus();
  });
  
  elements.closeNewSession.addEventListener('click', () => {
    elements.newSessionModal.classList.remove('active');
  });
  
  elements.confirmNewSession.addEventListener('click', async () => {
    const name = elements.newSessionName.value.trim();
    const result = await chrome.runtime.sendMessage({ 
      action: 'createNewSession', 
      name: name || undefined 
    });
    
    if (result.success) {
      expandedNodes.clear();
      await loadSessions();
      elements.sessionSelect.value = result.sessionId;
      await loadTree(result.sessionId);
      elements.newSessionModal.classList.remove('active');
      elements.newSessionName.value = '';
      showToast('新会话已创建');
    }
  });
  
  // 设置
  elements.settingsBtn.addEventListener('click', () => {
    elements.settingsModal.classList.add('active');
  });
  
  elements.closeSettings.addEventListener('click', () => {
    elements.settingsModal.classList.remove('active');
  });
  
  elements.saveSettings.addEventListener('click', async () => {
    currentSettings = {
      ...currentSettings,
      maxSessions: parseInt(elements.maxSessions.value) || 50,
      autoCleanOldSessions: elements.autoClean.checked,
      showFavicons: elements.showFavicons.checked,
      defaultExpand: elements.defaultExpand.checked
    };
    
    await chrome.storage.local.set({ settings: currentSettings });
    elements.settingsModal.classList.remove('active');
    showToast('设置已保存');
    
    if (currentSessionId) {
      await loadTree(currentSessionId);
    }
  });
  
  // 清空所有
  elements.clearAllBtn.addEventListener('click', async () => {
    if (confirm('确定要清空所有会话吗？此操作不可撤销。')) {
      await chrome.runtime.sendMessage({ action: 'clearAllSessions' });
      expandedNodes.clear();
      await loadSessions();
      showToast('已清空所有数据');
    }
  });
  
  // 展开全部
  elements.expandAllBtn.addEventListener('click', () => {
    document.querySelectorAll('.children-container').forEach(el => {
      el.classList.remove('collapsed');
    });
    document.querySelectorAll('.node-toggle:not(.leaf)').forEach(el => {
      el.textContent = '▼';
    });
    document.querySelectorAll('.tree-node').forEach(node => {
      const nodeId = node.dataset.nodeId;
      if (node.querySelector('.children-container')) {
        expandedNodes.add(nodeId);
      }
    });
    showToast('已展开全部');
  });
  
  // 折叠全部
  elements.collapseAllBtn.addEventListener('click', () => {
    document.querySelectorAll('.children-container').forEach(el => {
      el.classList.add('collapsed');
    });
    document.querySelectorAll('.node-toggle:not(.leaf)').forEach(el => {
      el.textContent = '▶';
    });
    expandedNodes.clear();
    showToast('已折叠全部');
  });
  
  // 点击模态框外部关闭
  elements.newSessionModal.addEventListener('click', (e) => {
    if (e.target === elements.newSessionModal) {
      elements.newSessionModal.classList.remove('active');
    }
  });
  
  elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) {
      elements.settingsModal.classList.remove('active');
    }
  });
  
  // 回车创建新会话
  elements.newSessionName.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      elements.confirmNewSession.click();
    }
  });
  
  // ESC 关闭模态框
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      elements.newSessionModal.classList.remove('active');
      elements.settingsModal.classList.remove('active');
    }
  });
}

// 显示提示
function showToast(message) {
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }
  }, 2000);
}
