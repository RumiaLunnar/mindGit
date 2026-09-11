// mindGit - 浏览脉络追踪器后台脚本
// 负责记录网页跳转关系

// 存储结构：
// sessions: { sessionId: { rootNodes: [], allNodes: {}, name, startTime } }
// currentSession: 当前会话ID
// tabToNode: { tabId: { sessionId, nodeId } } - 记录标签页在对应会话中的当前节点

let sessionCounter = 0;
let nodeCounter = 0;

// 最近导航记录（用于去重和重定向检测）
// 结构: { [tabId]: { url: string, timestamp: number, nodeId: string } }
const recentNavigations = {};
const DEBOUNCE_TIME = 2000; // 2秒内同一URL不重复记录

// 防止重复捕获的标志
let isCapturing = false;

// 记录开关缓存。首次收到导航事件时从 storage 读取，设置变化后同步更新。
let trackingEnabled = null;

function normalizeTrackingEnabled(settings) {
  return settings?.trackingEnabled !== false;
}

async function isTrackingEnabled() {
  if (trackingEnabled !== null) return trackingEnabled;

  const { settings } = await chrome.storage.local.get('settings');
  trackingEnabled = normalizeTrackingEnabled(settings);
  return trackingEnabled;
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.settings) return;
  trackingEnabled = normalizeTrackingEnabled(changes.settings.newValue || {});
});

// 监听 popup 打开事件
// 注意：只能有一个 onMessage 监听器，所有消息处理都在这里

// 生成唯一ID
function generateSessionId() {
  return `session_${Date.now()}_${sessionCounter++}`;
}

function generateNodeId() {
  return `node_${Date.now()}_${nodeCounter++}`;
}

/**
 * 读取兼容旧版本的标签页节点映射
 * @param {Object} tabToNode - 映射表
 * @param {number} tabId - 标签页 ID
 * @param {string} sessionId - 会话 ID
 * @returns {string|null}
 */
function getTabNodeId(tabToNode, tabId, sessionId) {
  const mapping = tabToNode?.[tabId];
  if (!mapping) return null;

  // 兼容 v1.3 及以前的 { tabId: nodeId } 结构。
  if (typeof mapping === 'string') return mapping;
  return mapping.sessionId === sessionId ? mapping.nodeId : null;
}

/**
 * 写入带会话作用域的标签页节点映射
 */
function setTabNodeId(tabToNode, tabId, sessionId, nodeId) {
  if (tabId === undefined || tabId === null) return;
  tabToNode[tabId] = { sessionId, nodeId };
}

// 创建节点
function createNode(url, title, favIconUrl, parentId = null) {
  return {
    id: generateNodeId(),
    url,
    title: title || url,
    favIconUrl,
    parentId,
    children: [],
    timestamp: Date.now(),
    visitCount: 1
  };
}

// 初始化存储 - 只在安装时执行，更新时保留数据
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // 首次安装时初始化
    chrome.storage.local.set({
      sessions: {},
      currentSession: null,
      tabToNode: {},
      pendingSourceTab: {},
      snapshots: {},
      settings: {
        maxSessions: 50,
        maxNodesPerSession: 500,
        autoCleanOldSessions: true,
        showFavicons: true,
        defaultExpand: true,
        autoCreateSession: true,
        trackingEnabled: true
      }
    });
    console.log('[mindGit] 首次安装，已初始化');
    captureCurrentTabs();
  } else if (details.reason === 'update') {
    // 更新时保留数据，只添加新的设置项
    chrome.storage.local.get('settings').then(result => {
      const settings = result.settings || {};
      if (typeof settings.autoCreateSession === 'undefined') {
        settings.autoCreateSession = true;
      }
      if (typeof settings.trackingEnabled === 'undefined') {
        settings.trackingEnabled = true;
      }
      chrome.storage.local.set({ settings });
    });
    // 确保 snapshots 存在
    chrome.storage.local.get('snapshots').then(result => {
      if (!result.snapshots) {
        chrome.storage.local.set({ snapshots: {} });
      }
    });
    console.log('[mindGit] 扩展已更新，保留现有数据');
  }
});

// Chrome 启动时也尝试记录当前页面
chrome.runtime.onStartup.addListener(() => {
  console.log('[mindGit] Chrome 启动，尝试记录当前页面');
  captureCurrentTabs();
});

// Service Worker 激活时尝试记录当前页面
self.addEventListener('activate', () => {
  console.log('[mindGit] Service Worker 激活');
  captureCurrentTabs();
});

// 捕获当前所有可记录的标签页
async function captureCurrentTabs() {
  if (!(await isTrackingEnabled())) {
    console.log('[mindGit] 网页记录已停用，跳过启动捕获');
    return;
  }

  // 防止重复调用
  if (isCapturing) {
    console.log('[mindGit] 捕获进行中，跳过');
    return;
  }
  
  isCapturing = true;
  
  try {
    // 检查设置是否启用了自动创建会话
    const { settings, sessions, currentSession } = await chrome.storage.local.get(['settings', 'sessions', 'currentSession']);
    
    if (settings?.autoCreateSession === false) {
      console.log('[mindGit] 自动创建会话已禁用，跳过捕获当前页面');
      isCapturing = false;
      return;
    }

    // 如果已有会话且有内容，不自动创建新会话
    if (currentSession && sessions?.[currentSession]) {
      const session = sessions[currentSession];
      const hasNodes = Object.keys(session.allNodes || {}).length > 0;
      if (hasNodes) {
        console.log('[mindGit] 已有存在的会话，跳过自动创建');
        isCapturing = false;
        return;
      }
    }

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      console.log('[mindGit] 没有找到活动标签页');
      isCapturing = false;
      return;
    }

    const activeTab = tabs[0];
    console.log('[mindGit] 尝试捕获当前页面:', activeTab.url);

    // 创建新会话并记录当前页面
    if (shouldTrackUrl(activeTab.url)) {
      const nodeId = await addNodeToTree(activeTab.url, activeTab.title, activeTab.favIconUrl, activeTab.id, null);
      if (nodeId) {
        console.log('[mindGit] 已自动记录当前页面:', activeTab.title);
      }
    } else {
      console.log('[mindGit] 当前页面不需要记录:', activeTab.url);
    }
  } catch (e) {
    console.error('[mindGit] 捕获当前页面失败:', e);
  } finally {
    isCapturing = false;
  }
}

// 检查URL是否应该被记录
function shouldTrackUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;

  try {
    const protocol = new URL(url).protocol;
    return ['http:', 'https:', 'ftp:'].includes(protocol);
  } catch (e) {
    return false;
  }
}

// 获取或创建会话
function cleanupOldSessions(sessions, settings, protectedSessionId = null) {
  if (settings?.autoCleanOldSessions === false) return [];

  const maxSessions = Math.max(5, parseInt(settings?.maxSessions, 10) || 50);
  const sessionIds = Object.keys(sessions || {});
  if (sessionIds.length <= maxSessions) return [];

  const sortedSessions = sessionIds
    .map(id => ({ id, startTime: sessions[id]?.startTime || 0 }))
    .sort((a, b) => b.startTime - a.startTime);
  const deletedIds = [];

  for (const session of sortedSessions) {
    if (session.id === protectedSessionId) continue;
    if (sessionIds.length - deletedIds.length <= maxSessions) break;
    deletedIds.push(session.id);
    delete sessions[session.id];
  }

  return deletedIds;
}

async function getOrCreateSession() {
  const { sessions, currentSession, settings } = await chrome.storage.local.get([
    'sessions', 'currentSession', 'settings'
  ]);
  const sessionMap = sessions && typeof sessions === 'object' ? sessions : {};
  
  if (currentSession && sessionMap[currentSession]) {
    return { sessions: sessionMap, sessionId: currentSession };
  }
  
  // 创建新会话
  const newSessionId = generateSessionId();
  const newSession = {
    id: newSessionId,
    startTime: Date.now(),
    rootNodes: [],
    allNodes: {},
    name: `浏览会话 ${new Date().toLocaleString('zh-CN', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`
  };
  
  sessionMap[newSessionId] = newSession;
  cleanupOldSessions(sessionMap, settings, newSessionId);
  await chrome.storage.local.set({ 
    sessions: sessionMap,
    currentSession: newSessionId,
    tabToNode: {},
    pendingSourceTab: {}
  });
  
  console.log('[mindGit] 创建新会话:', newSessionId);
  return { sessions: sessionMap, sessionId: newSessionId };
}

// 检查是否是重复导航（防抖）
function isDuplicateNavigation(tabId, url) {
  const now = Date.now();
  const recent = recentNavigations[tabId];
  
  if (recent && recent.url === url && (now - recent.timestamp) < DEBOUNCE_TIME) {
    console.log('[mindGit] 忽略重复导航:', url);
    return true;
  }
  
  // 记录这次导航
  recentNavigations[tabId] = { url, timestamp: now };
  return false;
}

// 添加节点到树 - 核心函数（带全局去重和防抖）
async function addNodeToTree(url, title, favIconUrl, tabId, parentNodeId = null) {
  if (!(await isTrackingEnabled())) return null;
  if (!shouldTrackUrl(url)) return null;
  
  // 防抖检查：短时间内同一URL不重复记录
  if (isDuplicateNavigation(tabId, url)) {
    return null;
  }
  
  const { sessions, sessionId } = await getOrCreateSession();
  const session = sessions[sessionId];
  session.rootNodes = Array.isArray(session.rootNodes) ? session.rootNodes : [];
  session.allNodes = session.allNodes && typeof session.allNodes === 'object'
    ? session.allNodes
    : {};
  const { tabToNode: storedTabToNode, settings } = await chrome.storage.local.get(['tabToNode', 'settings']);
  const tabToNode = storedTabToNode && typeof storedTabToNode === 'object'
    ? storedTabToNode
    : {};
  
  // ========== 全局去重检查 ==========
  // 在整个会话中查找是否已存在相同 URL 的节点
  let existingNodeId = null;
  for (const [nodeId, node] of Object.entries(session.allNodes)) {
    if (node.url === url) {
      existingNodeId = nodeId;
      break;
    }
  }
  
  // 如果已存在，更新现有节点
  if (existingNodeId) {
    const existingNode = session.allNodes[existingNodeId];
    existingNode.visitCount++;
    existingNode.timestamp = Date.now();
    existingNode.title = title || existingNode.title;
    setTabNodeId(tabToNode, tabId, sessionId, existingNodeId);
    
    // 更新 recentNavigations 中的 nodeId
    recentNavigations[tabId].nodeId = existingNodeId;
    
    await chrome.storage.local.set({ sessions, tabToNode });
    console.log('[mindGit] 更新已有节点:', title, '访问次数:', existingNode.visitCount);
    return existingNodeId;
  }
  
  // ========== 创建新节点 ==========
  const maxNodes = Number(settings?.maxNodesPerSession) || 500;
  if (Object.keys(session.allNodes || {}).length >= maxNodes) {
    console.warn('[mindGit] 已达到单会话节点上限:', maxNodes);
    return null;
  }

  const node = createNode(url, title, favIconUrl, parentNodeId);
  
  if (parentNodeId && session.allNodes[parentNodeId]) {
    const parent = session.allNodes[parentNodeId];
    parent.children = parent.children || [];
    parent.children.push(node.id);
    console.log('[mindGit] 添加子节点:', title, '父节点:', parentNodeId);
  } else {
    session.rootNodes.push(node.id);
    console.log('[mindGit] 添加根节点:', title);
    
    // 自动命名：如果是新会话的第一个根节点，用页面标题命名
    if (session.rootNodes.length === 1 && title) {
      // 检查是否是默认名称（浏览会话 日期时间格式）
      if ((session.name || '').startsWith('浏览会话')) {
        session.name = title.substring(0, 30) || session.name;
        console.log('[mindGit] 自动命名会话:', session.name);
      }
    }
  }
  
  session.allNodes[node.id] = node;
  setTabNodeId(tabToNode, tabId, sessionId, node.id);
  
  // 更新 recentNavigations 中的 nodeId
  recentNavigations[tabId].nodeId = node.id;
  
  await chrome.storage.local.set({ sessions, tabToNode });
  return node.id;
}

// 获取或创建来源标签页的节点
async function getOrCreateSourceNode(sourceTabId) {
  const { tabToNode, sessions, currentSession } = await chrome.storage.local.get([
    'tabToNode', 'sessions', 'currentSession'
  ]);
  
  // 如果已经有节点，直接返回
  const existingNodeId = getTabNodeId(tabToNode, sourceTabId, currentSession);
  if (existingNodeId && sessions?.[currentSession]?.allNodes?.[existingNodeId]) {
    return existingNodeId;
  }
  
  // 否则创建节点
  try {
    const tab = await chrome.tabs.get(sourceTabId);
    if (tab && shouldTrackUrl(tab.url)) {
      return await addNodeToTree(tab.url, tab.title, tab.favIconUrl, sourceTabId, null);
    }
  } catch (e) {
    console.log('[mindGit] 无法获取来源标签页:', sourceTabId);
  }
  return null;
}

// 核心：使用 onCommitted 获取跳转类型信息
chrome.webNavigation.onCommitted.addListener(async (details) => {
  // 只处理主框架
  if (details.frameId !== 0) return;
  if (!(await isTrackingEnabled())) return;
  if (!shouldTrackUrl(details.url)) return;
  
  const { transitionType, transitionQualifiers } = details;
  
  console.log('[mindGit] 导航提交:', details.url, '类型:', transitionType, '修饰:', transitionQualifiers);
  
  // 忽略刷新操作
  if (transitionType === 'reload') {
    console.log('[mindGit] 检测到刷新，不创建新节点');
    
    const { tabToNode, sessions, currentSession } = await chrome.storage.local.get([
      'tabToNode', 'sessions', 'currentSession'
    ]);

    const currentNodeId = getTabNodeId(tabToNode, details.tabId, currentSession);
    if (currentNodeId && sessions?.[currentSession]) {
      const session = sessions[currentSession];
      const node = session.allNodes?.[currentNodeId];
      if (node && node.url === details.url) {
        node.timestamp = Date.now();
        try {
          const tab = await chrome.tabs.get(details.tabId);
          node.title = tab.title || node.title;
        } catch (e) {}
        await chrome.storage.local.set({ sessions });
      }
    }
    return;
  }
  
  try {
    const tab = await chrome.tabs.get(details.tabId);
    const storedState = await chrome.storage.local.get([
      'tabToNode', 'pendingSourceTab', 'currentSession'
    ]);
    const tabToNode = storedState.tabToNode || {};
    const pendingSourceTab = storedState.pendingSourceTab || {};
    const currentNodeId = getTabNodeId(
      tabToNode,
      details.tabId,
      storedState.currentSession
    );
    
    let parentNodeId = null;
    
    // 检查是否有 from 修饰符（表示从哪个标签页打开）
    const fromQualifier = transitionQualifiers?.find(q => q.startsWith('from_'));
    
    if (fromQualifier) {
      // 新标签页打开（链接点击等）
      const sourceTabId = parseInt(fromQualifier.replace('from_', ''));
      console.log('[mindGit] 新标签页打开，来源标签页:', sourceTabId);
      parentNodeId = await getOrCreateSourceNode(sourceTabId);
    } else if (transitionType === 'typed' || transitionType === 'generated') {
      // 地址栏输入或搜索
      const isSearch = transitionQualifiers?.includes('from_address_bar');
      
      // 优先检查是否是从其他页面打开的新标签页
      const sourceTabId = pendingSourceTab[details.tabId];
      if (sourceTabId) {
        parentNodeId = await getOrCreateSourceNode(sourceTabId);
        console.log('[mindGit] 新标签页搜索/输入，来源标签页节点:', parentNodeId);
        delete pendingSourceTab[details.tabId];
        await chrome.storage.local.set({ pendingSourceTab });
      } else if (isSearch) {
        // 当前页搜索
        if (currentNodeId) {
          parentNodeId = currentNodeId;
          console.log('[mindGit] 当前页搜索，父节点:', parentNodeId);
        }
      }
      // 直接地址栏输入（非搜索）作为根节点
    } else if (transitionType === 'form_submit') {
      // 表单提交（如搜索框提交）
      // 优先检查是否是从其他页面打开的新标签页
      const sourceTabId = pendingSourceTab[details.tabId];
      if (sourceTabId) {
        parentNodeId = await getOrCreateSourceNode(sourceTabId);
        console.log('[mindGit] 新标签页表单提交，来源标签页节点:', parentNodeId);
        delete pendingSourceTab[details.tabId];
        await chrome.storage.local.set({ pendingSourceTab });
      } else {
        // 当前页提交
        if (currentNodeId) {
          parentNodeId = currentNodeId;
          console.log('[mindGit] 表单提交，父节点:', parentNodeId);
        }
      }
    } else {
      // 其他类型
      if (currentNodeId) {
        // 当前页跳转
        const { sessions, sessionId } = await getOrCreateSession();
        const session = sessions[sessionId];
        const currentNode = session.allNodes?.[currentNodeId];
        
        if (currentNode && currentNode.url !== details.url) {
          parentNodeId = currentNodeId;
          console.log('[mindGit] 当前页跳转，父节点:', parentNodeId);
        }
      } else {
        // 新标签页其他类型 - 从 pendingSourceTab 获取来源
        const sourceTabId = pendingSourceTab[details.tabId];
        if (sourceTabId) {
          parentNodeId = await getOrCreateSourceNode(sourceTabId);
          console.log('[mindGit] 新标签页其他类型，来源标签页节点:', parentNodeId);
          delete pendingSourceTab[details.tabId];
          await chrome.storage.local.set({ pendingSourceTab });
        }
      }
    }
    
    // 创建节点
    await addNodeToTree(details.url, tab.title, tab.favIconUrl, details.tabId, parentNodeId);
    
  } catch (e) {
    console.error('[mindGit] 处理导航错误:', e);
  }
});

// 监听历史记录状态更新（单页应用）
chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (!(await isTrackingEnabled())) return;
  if (!shouldTrackUrl(details.url)) return;
  
  const { tabToNode = {}, currentSession } = await chrome.storage.local.get([
    'tabToNode', 'currentSession'
  ]);
  const currentNodeId = getTabNodeId(tabToNode, details.tabId, currentSession);
  
  try {
    const tab = await chrome.tabs.get(details.tabId);
    
    if (currentNodeId) {
      const { sessions, sessionId } = await getOrCreateSession();
      const session = sessions[sessionId];
      const currentNode = session.allNodes?.[currentNodeId];
      
      // 检查是否是跳转到已存在的节点
      let foundExisting = false;
      
      for (const [nodeId, node] of Object.entries(session.allNodes)) {
        if (node.url === details.url && nodeId !== currentNodeId) {
          setTabNodeId(tabToNode, details.tabId, sessionId, nodeId);
          await chrome.storage.local.set({ tabToNode });
          foundExisting = true;
          console.log('[mindGit] 切换到历史节点:', node.title);
          break;
        }
      }
      
      if (!foundExisting && currentNode && currentNode.url !== details.url) {
        await addNodeToTree(details.url, tab.title, tab.favIconUrl, details.tabId, currentNodeId);
      }
    }
  } catch (e) {
    // 忽略错误
  }
});

// 监听标签页创建，记录来源（用于追踪右键菜单搜索等）
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!(await isTrackingEnabled())) return;
  if (tab.openerTabId) {
    const { pendingSourceTab: storedPendingSourceTab } = await chrome.storage.local.get(['pendingSourceTab']);
    const pendingSourceTab = storedPendingSourceTab || {};
    pendingSourceTab[tab.id] = tab.openerTabId;
    await chrome.storage.local.set({ pendingSourceTab });
    console.log('[mindGit] 记录标签页来源:', tab.id, '来自:', tab.openerTabId);
  }
});

// 监听导航目标创建（更可靠的新标签页来源追踪）
chrome.webNavigation.onCreatedNavigationTarget.addListener(async (details) => {
  if (!(await isTrackingEnabled())) return;
  const { pendingSourceTab: storedPendingSourceTab } = await chrome.storage.local.get(['pendingSourceTab']);
  const pendingSourceTab = storedPendingSourceTab || {};
  pendingSourceTab[details.tabId] = details.sourceTabId;
  await chrome.storage.local.set({ pendingSourceTab });
  console.log('[mindGit] 记录导航来源:', details.tabId, '来自:', details.sourceTabId);
});

// 监听标签页关闭，清理映射
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const {
    tabToNode: storedTabToNode,
    pendingSourceTab: storedPendingSourceTab
  } = await chrome.storage.local.get(['tabToNode', 'pendingSourceTab']);
  const tabToNode = storedTabToNode || {};
  const pendingSourceTab = storedPendingSourceTab || {};
  
  if (tabToNode[tabId]) {
    delete tabToNode[tabId];
  }
  if (pendingSourceTab[tabId]) {
    delete pendingSourceTab[tabId];
  }
  
  await chrome.storage.local.set({ tabToNode, pendingSourceTab });
});

// 监听来自popup的消息 - 只能有一个这样的监听器
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[mindGit] 收到消息:', request.action, request);
  
  // 测试是否匹配 moveNodeToSession
  if (request.action === 'moveNodeToSession') {
    console.log('[mindGit] 匹配成功: moveNodeToSession');
  } else if (request.action && request.action.includes('moveNode')) {
    console.log('[mindGit] 部分匹配 moveNode:', request.action);
  }
  
  if (request.action === 'ping') {
    sendResponse({ pong: true, timestamp: Date.now() });
    return true;
  }
  
  if (request.action === 'getSessions') {
    chrome.storage.local.get(['sessions', 'currentSession']).then(result => {
      // 保证返回有效的数据结构
      sendResponse({
        sessions: result.sessions || {},
        currentSession: result.currentSession || null
      });
    }).catch(err => {
      console.error('[mindGit] getSessions 错误:', err);
      sendResponse({
        sessions: {},
        currentSession: null,
        error: err.message
      });
    });
    return true;
  }
  
  if (request.action === 'getSessionTree') {
    chrome.storage.local.get('sessions').then(result => {
      const session = result.sessions?.[request.sessionId];
      sendResponse({ session });
    }).catch(err => {
      sendResponse({ session: null, error: err.message });
    });
    return true;
  }
  
  if (request.action === 'clearAllSessions') {
    chrome.storage.local.set({
      sessions: {},
      currentSession: null,
      tabToNode: {},
      pendingSourceTab: {}
    }).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
  
  if (request.action === 'renameSession') {
    chrome.storage.local.get('sessions').then(result => {
      const sessions = result.sessions || {};
      if (sessions[request.sessionId]) {
        sessions[request.sessionId].name = request.name;
        chrome.storage.local.set({ sessions }).then(() => {
          sendResponse({ success: true });
        }).catch(err => {
          sendResponse({ success: false, error: err.message });
        });
      } else {
        sendResponse({ success: false, error: '会话不存在' });
      }
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
  
  if (request.action === 'deleteSession') {
    chrome.storage.local.get(['sessions', 'currentSession']).then(result => {
      const sessions = result.sessions || {};
      delete sessions[request.sessionId];
      
      let newCurrentSession = result.currentSession;
      if (result.currentSession === request.sessionId) {
        newCurrentSession = null;
      }
      
      chrome.storage.local.set({
        sessions,
        currentSession: newCurrentSession
      }).then(() => {
        sendResponse({ success: true });
      }).catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
  
  if (request.action === 'switchSession') {
    chrome.storage.local.get('sessions').then(result => {
      if (!result.sessions?.[request.sessionId]) {
        sendResponse({ success: false, error: '会话不存在' });
        return;
      }

      chrome.storage.local.set({
        currentSession: request.sessionId
      }).then(() => {
        sendResponse({ success: true });
      }).catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
  
  if (request.action === 'createNewSession') {
    const newSessionId = generateSessionId();
    const newSession = {
      id: newSessionId,
      startTime: Date.now(),
      rootNodes: [],
      allNodes: {},
      name: request.name || `浏览会话 ${new Date().toLocaleString('zh-CN', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`
    };
    
    chrome.storage.local.get(['sessions', 'settings']).then(result => {
      const sessions = result.sessions && typeof result.sessions === 'object'
        ? result.sessions
        : {};
      sessions[newSessionId] = newSession;
      cleanupOldSessions(sessions, result.settings, newSessionId);
      
      chrome.storage.local.set({
        sessions,
        currentSession: newSessionId
      }).then(() => {
        sendResponse({ success: true, sessionId: newSessionId });
      }).catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
  
  if (request.action === 'addNode') {
    // 为特定会话添加节点
    chrome.storage.local.get(['sessions', 'tabToNode', 'settings']).then(result => {
      if (result.settings?.trackingEnabled === false) {
        sendResponse({ success: false, error: '网页记录已停用' });
        return;
      }

      const sessions = result.sessions || {};
      const session = sessions[request.sessionId];
      
      if (!session) {
        sendResponse({ success: false, error: '会话不存在' });
        return;
      }

      session.rootNodes = Array.isArray(session.rootNodes) ? session.rootNodes : [];
      session.allNodes = session.allNodes && typeof session.allNodes === 'object'
        ? session.allNodes
        : {};
      
      const { url, title, favIconUrl, tabId, parentNodeId } = request;

      const maxNodes = Number(result.settings?.maxNodesPerSession) || 500;
      if (Object.keys(session.allNodes || {}).length >= maxNodes) {
        sendResponse({ success: false, error: `已达到单会话节点上限（${maxNodes}）` });
        return;
      }
      
      // 创建新节点
      const node = createNode(url, title, favIconUrl, parentNodeId);
      
      if (parentNodeId && session.allNodes[parentNodeId]) {
        const parent = session.allNodes[parentNodeId];
        parent.children = parent.children || [];
        parent.children.push(node.id);
      } else {
        session.rootNodes.push(node.id);
      }
      
      session.allNodes[node.id] = node;
      
      const tabToNode = result.tabToNode || {};
      setTabNodeId(tabToNode, tabId, request.sessionId, node.id);
      
      // 更新会话名称（如果是第一个根节点）
      if (session.rootNodes.length === 1 && title && (session.name || '').startsWith('浏览会话')) {
        session.name = title.substring(0, 30) || session.name;
      }
      
      chrome.storage.local.set({ sessions, tabToNode }).then(() => {
        sendResponse({ success: true, nodeId: node.id });
      }).catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
  
  if (request.action === 'deleteNode') {
    chrome.storage.local.get(['sessions', 'tabToNode']).then(result => {
      const sessions = result.sessions || {};
      const session = sessions[request.sessionId];
      
      if (!session?.allNodes?.[request.nodeId]) {
        sendResponse({ success: false, error: '节点不存在' });
        return;
      }
      
      const nodeId = request.nodeId;
      const node = session.allNodes[nodeId];
      
      // 从父节点的 children 中移除
      if (node.parentId && session.allNodes[node.parentId]) {
        const parent = session.allNodes[node.parentId];
        parent.children = parent.children.filter(id => id !== nodeId);
      } else {
        // 是根节点
        session.rootNodes = session.rootNodes.filter(id => id !== nodeId);
      }
      
      // 递归删除所有子节点
      const deletedNodeIds = new Set();
      const deleteRecursive = (id) => {
        if (deletedNodeIds.has(id)) return;
        deletedNodeIds.add(id);
        const n = session.allNodes[id];
        if (n && n.children) {
          n.children.forEach(childId => deleteRecursive(childId));
        }
        delete session.allNodes[id];
      };
      deleteRecursive(nodeId);
      
      // 清理 tabToNode 中的引用
      const tabToNode = result.tabToNode || {};
      for (const [tabId, mapping] of Object.entries(tabToNode)) {
        const mappedNodeId = typeof mapping === 'string' ? mapping : mapping?.nodeId;
        const mappedSessionId = typeof mapping === 'string'
          ? request.sessionId
          : mapping?.sessionId;

        if (mappedSessionId === request.sessionId && deletedNodeIds.has(mappedNodeId)) {
          delete tabToNode[tabId];
        }
      }
      
      chrome.storage.local.set({ sessions, tabToNode }).then(() => {
        sendResponse({ success: true });
      }).catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
  
  if (request.action === 'moveNode') {
    (async () => {
      try {
        const result = await chrome.storage.local.get('sessions');
        const sessions = result.sessions || {};
        const session = sessions[request.sessionId];
        
        if (!session?.allNodes?.[request.nodeId]) {
          sendResponse({ success: false, error: '节点不存在' });
          return;
        }
        
        const nodeId = request.nodeId;
        const node = session.allNodes[nodeId];
        const newParentId = request.newParentId;

        if (newParentId && !session.allNodes[newParentId]) {
          sendResponse({ success: false, error: '目标节点不存在' });
          return;
        }
        
        // 检查是否拖拽到自己或子节点
        if (newParentId) {
          let checkNode = session.allNodes[newParentId];
          const visited = new Set();
          while (checkNode && !visited.has(checkNode.id)) {
            visited.add(checkNode.id);
            if (checkNode.id === nodeId) {
              sendResponse({ success: false, error: '不能拖拽到自己或子节点' });
              return;
            }
            checkNode = checkNode.parentId ? session.allNodes[checkNode.parentId] : null;
          }
        }
        
        // 从原父节点中移除
        if (node.parentId && session.allNodes[node.parentId]) {
          const oldParent = session.allNodes[node.parentId];
          oldParent.children = (oldParent.children || []).filter(id => id !== nodeId);
        } else {
          // 是根节点，从 rootNodes 移除
          session.rootNodes = (session.rootNodes || []).filter(id => id !== nodeId);
        }
        
        // 更新父节点
        node.parentId = newParentId || null;
        
        // 添加到新父节点
        if (newParentId && session.allNodes[newParentId]) {
          const newParent = session.allNodes[newParentId];
          if (!newParent.children) {
            newParent.children = [];
          }
          newParent.children.push(nodeId);
        } else {
          // 成为根节点
          session.rootNodes = session.rootNodes || [];
          session.rootNodes.push(nodeId);
        }
        
        await chrome.storage.local.set({ sessions });
        sendResponse({ success: true });
      } catch (e) {
        console.error('[mindGit] moveNode 错误:', e);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }
  
  // 跨会话移动节点
  if (request.action === 'moveNodeToSession') {
    console.log('[mindGit] 开始跨会话移动:', request);
    (async () => {
      try {
        const result = await chrome.storage.local.get(['sessions', 'tabToNode', 'settings']);
        console.log('[mindGit] 读取 sessions 成功');
        const sessions = result.sessions || {};
        const fromSession = sessions[request.fromSessionId];
        const toSession = sessions[request.toSessionId];
        
        if (!fromSession || !toSession) {
          console.log('[mindGit] 会话不存在:', { from: !!fromSession, to: !!toSession });
          sendResponse({ success: false, error: '会话不存在' });
          return;
        }
        
        const nodeId = request.nodeId;
        const node = fromSession.allNodes?.[nodeId];
        
        if (!node) {
          console.log('[mindGit] 节点不存在:', nodeId);
          sendResponse({ success: false, error: '节点不存在' });
          return;
        }
        
        console.log('[mindGit] 开始移动节点:', nodeId);
        
        // 递归收集所有子节点
        const visitedNodeIds = new Set();
        function collectNodes(nodeId, nodes) {
          if (visitedNodeIds.has(nodeId)) return;
          visitedNodeIds.add(nodeId);
          const node = fromSession.allNodes[nodeId];
          if (!node) return;
          nodes.push(nodeId);
          if (node.children) {
            for (const childId of node.children) {
              collectNodes(childId, nodes);
            }
          }
        }
        
        const nodesToMove = [];
        collectNodes(nodeId, nodesToMove);
        
        console.log('[mindGit] 收集到节点:', nodesToMove);

        const maxNodes = Number(result.settings?.maxNodesPerSession) || 500;
        if (Object.keys(toSession.allNodes || {}).length + nodesToMove.length > maxNodes) {
          sendResponse({ success: false, error: `目标会话最多保存 ${maxNodes} 个节点` });
          return;
        }

        fromSession.rootNodes = fromSession.rootNodes || [];
        fromSession.allNodes = fromSession.allNodes || {};
        toSession.rootNodes = toSession.rootNodes || [];
        toSession.allNodes = toSession.allNodes || {};

        const idMap = new Map(nodesToMove.map(id => [id, generateNodeId()]));
        
        // 第一步：先复制所有节点到新会话（保留完整的子节点关系）
        for (const id of nodesToMove) {
          const originalNode = fromSession.allNodes[id];
          // 使用 JSON 深拷贝确保完全独立
          const newNode = JSON.parse(JSON.stringify(originalNode));
          newNode.id = idMap.get(id);
          // 保留移动记录
          newNode.movedFrom = request.fromSessionId;
          newNode.movedAt = Date.now();
          
          // 只有被拖拽的根节点清空 parentId
          newNode.parentId = id === nodeId
            ? null
            : (idMap.get(originalNode.parentId) || null);
          newNode.children = (originalNode.children || [])
            .map(childId => idMap.get(childId))
            .filter(Boolean);
          
          toSession.allNodes[newNode.id] = newNode;
        }
        
        console.log('[mindGit] 已复制节点到新会话');
        
        // 第二步：添加根节点到新会话的 rootNodes
        toSession.rootNodes.push(idMap.get(nodeId));
        
        // 第三步：从原会话移除根节点引用
        if (node.parentId && fromSession.allNodes[node.parentId]) {
          const parent = fromSession.allNodes[node.parentId];
          parent.children = (parent.children || []).filter(childId => childId !== nodeId);
        } else {
          fromSession.rootNodes = fromSession.rootNodes.filter(rootId => rootId !== nodeId);
        }
        
        console.log('[mindGit] 已从原会话移除节点引用');
        
        // 第四步：删除原会话中的节点数据
        for (const id of nodesToMove) {
          delete fromSession.allNodes[id];
        }

        // 同步修正标签页映射，避免映射到已经不存在的源会话节点。
        const tabToNode = result.tabToNode || {};
        const movedIdSet = new Set(nodesToMove);
        for (const [tabId, mapping] of Object.entries(tabToNode)) {
          const mappedNodeId = typeof mapping === 'string' ? mapping : mapping?.nodeId;
          const mappedSessionId = typeof mapping === 'string'
            ? request.fromSessionId
            : mapping?.sessionId;

          if (mappedSessionId === request.fromSessionId && movedIdSet.has(mappedNodeId)) {
            setTabNodeId(tabToNode, tabId, request.toSessionId, idMap.get(mappedNodeId));
          }
        }
        
        await chrome.storage.local.set({ sessions, tabToNode });
        console.log('[mindGit] 移动成功:', nodesToMove.length, '个节点');
        sendResponse({ success: true, movedCount: nodesToMove.length });
      } catch (e) {
        console.error('[mindGit] 跨会话移动节点错误:', e);
        sendResponse({ success: false, error: e.message });
      }
    })();
    console.log('[mindGit] 异步任务已启动');
    return true;
  }
  
  // 快照相关 API
  if (request.action === 'createSnapshot') {
    chrome.storage.local.get(['sessions', 'snapshots']).then(result => {
      const sessions = result.sessions || {};
      const snapshots = result.snapshots || {};
      
      const snapshotId = `snapshot_${Date.now()}`;
      const snapshot = {
        id: snapshotId,
        name: request.name || `Snapshot ${new Date().toLocaleString()}`,
        createdAt: Date.now(),
        sessionId: request.sessionId,
        sessionData: JSON.parse(JSON.stringify(sessions[request.sessionId] || {}))
      };
      
      snapshots[snapshotId] = snapshot;
      
      chrome.storage.local.set({ snapshots }).then(() => {
        sendResponse({ success: true, snapshotId });
      });
    });
    return true;
  }
  
  if (request.action === 'getSnapshots') {
    chrome.storage.local.get('snapshots').then(result => {
      sendResponse({ snapshots: result.snapshots || {} });
    });
    return true;
  }
  
  if (request.action === 'deleteSnapshot') {
    chrome.storage.local.get('snapshots').then(result => {
      const snapshots = result.snapshots || {};
      delete snapshots[request.snapshotId];
      
      chrome.storage.local.set({ snapshots }).then(() => {
        sendResponse({ success: true });
      });
    });
    return true;
  }
  
  if (request.action === 'restoreSnapshot') {
    chrome.storage.local.get(['sessions', 'snapshots']).then(result => {
      const sessions = result.sessions || {};
      const snapshots = result.snapshots || {};
      const snapshot = snapshots[request.snapshotId];
      
      if (!snapshot) {
        sendResponse({ success: false, error: '快照不存在' });
        return;
      }
      
      // 恢复会话数据
      const newSessionId = generateSessionId();
      const restoredSession = {
        ...JSON.parse(JSON.stringify(snapshot.sessionData)),
        id: newSessionId,
        name: `${snapshot.sessionData.name || '恢复的会话'} (来自快照)`,
        restoredFrom: snapshot.id,
        restoredAt: Date.now()
      };
      
      sessions[newSessionId] = restoredSession;
      
      chrome.storage.local.set({ 
        sessions,
        currentSession: newSessionId
      }).then(() => {
        sendResponse({ success: true, sessionId: newSessionId });
      });
    });
    return true;
  }
  
  if (request.action === 'openUrl') {
    console.log('[mindGit] openUrl 请求:', request.url);
    
    // 优先查找是否已有相同 URL 的标签页
    chrome.tabs.query({}).then(allTabs => {
      console.log('[mindGit] 所有标签页:', allTabs.map(t => t.url));
      
      // 尝试精确匹配
      let matchedTab = allTabs.find(tab => tab.url === request.url);
      console.log('[mindGit] 精确匹配结果:', matchedTab ? matchedTab.url : '未找到');
      
      // 如果没有精确匹配，尝试忽略 hash 匹配
      if (!matchedTab) {
        try {
          const targetUrl = new URL(request.url);
          console.log('[mindGit] 目標 URL 解析:', targetUrl.hostname, targetUrl.pathname);
          
          matchedTab = allTabs.find(tab => {
            if (!tab.url) return false;
            try {
              const tabUrl = new URL(tab.url);
              const match = tabUrl.hostname === targetUrl.hostname && 
                     tabUrl.pathname === targetUrl.pathname &&
                     tabUrl.search === targetUrl.search;
              if (match) {
                console.log('[mindGit] 忽略 hash 匹配成功:', tab.url);
              }
              return match;
            } catch (e) {
              return false;
            }
          });
        } catch (e) {
          console.error('[mindGit] URL 解析失败:', e);
        }
      }
      
      if (matchedTab) {
        // 如果找到，切换到该标签页
        chrome.tabs.update(matchedTab.id, { active: true });
        chrome.windows.update(matchedTab.windowId, { focused: true });
        console.log('[mindGit] ✓ 切换到已存在标签页:', matchedTab.url);
      } else {
        // 如果没找到，创建新标签页
        chrome.tabs.create({ url: request.url });
        console.log('[mindGit] ✓ 创建新标签页:', request.url);
      }
      sendResponse({ success: true });
    });
    return true;
  }
});

console.log('[mindGit] 后台脚本已加载');
