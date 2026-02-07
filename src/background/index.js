// mindGit - 浏览脉络追踪器后台脚本
// 负责记录网页跳转关系

// 存储结构：
// sessions: { sessionId: { rootNodes: [], allNodes: {}, name, startTime } }
// currentSession: 当前会话ID
// tabToNode: { tabId: nodeId } - 记录每个标签页当前对应的节点

let sessionCounter = 0;
let nodeCounter = 0;

// 最近导航记录（用于去重和重定向检测）
// 结构: { [tabId]: { url: string, timestamp: number, nodeId: string } }
const recentNavigations = {};
const DEBOUNCE_TIME = 2000; // 2秒内同一URL不重复记录

// 生成唯一ID
function generateSessionId() {
  return `session_${Date.now()}_${sessionCounter++}`;
}

function generateNodeId() {
  return `node_${Date.now()}_${nodeCounter++}`;
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

// 初始化存储
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    sessions: {},
    currentSession: null,
    tabToNode: {},
    // 临时存储新标签页的来源信息（标签页ID -> 来源标签页ID）
    pendingSourceTab: {},
    settings: {
      maxSessions: 50,
      maxNodesPerSession: 500,
      autoCleanOldSessions: true,
      showFavicons: true,
      defaultExpand: true
    }
  });
  console.log('[mindGit] 已初始化');
});

// 检查URL是否应该被记录
function shouldTrackUrl(url) {
  if (!url) return false;
  const excludedPrefixes = [
    'chrome://',
    'chrome-extension://',
    'devtools://',
    'file://',
    'about:',
    'javascript:',
    'data:'
  ];
  return !excludedPrefixes.some(prefix => url.startsWith(prefix));
}

// 获取或创建会话
async function getOrCreateSession() {
  const { sessions, currentSession } = await chrome.storage.local.get(['sessions', 'currentSession']);
  
  if (currentSession && sessions[currentSession]) {
    return { sessions, sessionId: currentSession };
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
  
  sessions[newSessionId] = newSession;
  await chrome.storage.local.set({ 
    sessions, 
    currentSession: newSessionId,
    tabToNode: {},
    pendingSourceTab: {}
  });
  
  console.log('[mindGit] 创建新会话:', newSessionId);
  return { sessions, sessionId: newSessionId };
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
  if (!shouldTrackUrl(url)) return null;
  
  // 防抖检查：短时间内同一URL不重复记录
  if (isDuplicateNavigation(tabId, url)) {
    return null;
  }
  
  const { sessions, sessionId } = await getOrCreateSession();
  const session = sessions[sessionId];
  const { tabToNode } = await chrome.storage.local.get('tabToNode');
  
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
    tabToNode[tabId] = existingNodeId;
    
    // 更新 recentNavigations 中的 nodeId
    recentNavigations[tabId].nodeId = existingNodeId;
    
    await chrome.storage.local.set({ sessions, tabToNode });
    console.log('[mindGit] 更新已有节点:', title, '访问次数:', existingNode.visitCount);
    return existingNodeId;
  }
  
  // ========== 创建新节点 ==========
  const node = createNode(url, title, favIconUrl, parentNodeId);
  
  if (parentNodeId && session.allNodes[parentNodeId]) {
    session.allNodes[parentNodeId].children.push(node.id);
    console.log('[mindGit] 添加子节点:', title, '父节点:', parentNodeId);
  } else {
    session.rootNodes.push(node.id);
    console.log('[mindGit] 添加根节点:', title);
    
    // 自动命名：如果是新会话的第一个根节点，用页面标题命名
    if (session.rootNodes.length === 1 && title) {
      // 检查是否是默认名称（浏览会话 日期时间格式）
      if (session.name.startsWith('浏览会话')) {
        session.name = title.substring(0, 30) || session.name;
        console.log('[mindGit] 自动命名会话:', session.name);
      }
    }
  }
  
  session.allNodes[node.id] = node;
  tabToNode[tabId] = node.id;
  
  // 更新 recentNavigations 中的 nodeId
  recentNavigations[tabId].nodeId = node.id;
  
  await chrome.storage.local.set({ sessions, tabToNode });
  return node.id;
}

// 获取或创建来源标签页的节点
async function getOrCreateSourceNode(sourceTabId) {
  const { tabToNode } = await chrome.storage.local.get(['tabToNode']);
  
  // 如果已经有节点，直接返回
  if (tabToNode[sourceTabId]) {
    return tabToNode[sourceTabId];
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
  if (!shouldTrackUrl(details.url)) return;
  
  const { transitionType, transitionQualifiers } = details;
  
  console.log('[mindGit] 导航提交:', details.url, '类型:', transitionType, '修饰:', transitionQualifiers);
  
  // 忽略刷新操作
  if (transitionType === 'reload') {
    console.log('[mindGit] 检测到刷新，不创建新节点');
    
    const { tabToNode, sessions, currentSession } = await chrome.storage.local.get([
      'tabToNode', 'sessions', 'currentSession'
    ]);
    
    const currentNodeId = tabToNode[details.tabId];
    if (currentNodeId && sessions[currentSession]) {
      const session = sessions[currentSession];
      const node = session.allNodes[currentNodeId];
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
    const { tabToNode, pendingSourceTab } = await chrome.storage.local.get(['tabToNode', 'pendingSourceTab']);
    
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
        const currentNodeId = tabToNode[details.tabId];
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
        const currentNodeId = tabToNode[details.tabId];
        if (currentNodeId) {
          parentNodeId = currentNodeId;
          console.log('[mindGit] 表单提交，父节点:', parentNodeId);
        }
      }
    } else {
      // 其他类型
      const currentNodeId = tabToNode[details.tabId];
      if (currentNodeId) {
        // 当前页跳转
        const { sessions, sessionId } = await getOrCreateSession();
        const session = sessions[sessionId];
        const currentNode = session.allNodes[currentNodeId];
        
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
  if (!shouldTrackUrl(details.url)) return;
  
  const { tabToNode } = await chrome.storage.local.get('tabToNode');
  const currentNodeId = tabToNode[details.tabId];
  
  try {
    const tab = await chrome.tabs.get(details.tabId);
    
    if (currentNodeId) {
      const { sessions, sessionId } = await getOrCreateSession();
      const session = sessions[sessionId];
      const currentNode = session.allNodes[currentNodeId];
      
      // 检查是否是跳转到已存在的节点
      let foundExisting = false;
      
      for (const [nodeId, node] of Object.entries(session.allNodes)) {
        if (node.url === details.url && nodeId !== currentNodeId) {
          tabToNode[details.tabId] = nodeId;
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
  if (tab.openerTabId) {
    const { pendingSourceTab } = await chrome.storage.local.get(['pendingSourceTab']);
    pendingSourceTab[tab.id] = tab.openerTabId;
    await chrome.storage.local.set({ pendingSourceTab });
    console.log('[mindGit] 记录标签页来源:', tab.id, '来自:', tab.openerTabId);
  }
});

// 监听导航目标创建（更可靠的新标签页来源追踪）
chrome.webNavigation.onCreatedNavigationTarget.addListener(async (details) => {
  const { pendingSourceTab } = await chrome.storage.local.get(['pendingSourceTab']);
  pendingSourceTab[details.tabId] = details.sourceTabId;
  await chrome.storage.local.set({ pendingSourceTab });
  console.log('[mindGit] 记录导航来源:', details.tabId, '来自:', details.sourceTabId);
});

// 监听标签页关闭，清理映射
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { tabToNode, pendingSourceTab } = await chrome.storage.local.get(['tabToNode', 'pendingSourceTab']);
  
  if (tabToNode[tabId]) {
    delete tabToNode[tabId];
  }
  if (pendingSourceTab[tabId]) {
    delete pendingSourceTab[tabId];
  }
  
  await chrome.storage.local.set({ tabToNode, pendingSourceTab });
});

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSessions') {
    chrome.storage.local.get(['sessions', 'currentSession']).then(result => {
      sendResponse({
        sessions: result.sessions,
        currentSession: result.currentSession
      });
    });
    return true;
  }
  
  if (request.action === 'getSessionTree') {
    chrome.storage.local.get('sessions').then(result => {
      const session = result.sessions[request.sessionId];
      sendResponse({ session });
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
    });
    return true;
  }
  
  if (request.action === 'renameSession') {
    chrome.storage.local.get('sessions').then(result => {
      const sessions = result.sessions;
      if (sessions[request.sessionId]) {
        sessions[request.sessionId].name = request.name;
        chrome.storage.local.set({ sessions }).then(() => {
          sendResponse({ success: true });
        });
      } else {
        sendResponse({ success: false, error: '会话不存在' });
      }
    });
    return true;
  }
  
  if (request.action === 'deleteSession') {
    chrome.storage.local.get(['sessions', 'currentSession']).then(result => {
      const sessions = result.sessions;
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
      });
    });
    return true;
  }
  
  if (request.action === 'switchSession') {
    chrome.storage.local.set({
      currentSession: request.sessionId
    }).then(() => {
      sendResponse({ success: true });
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
    
    chrome.storage.local.get('sessions').then(result => {
      const sessions = result.sessions;
      sessions[newSessionId] = newSession;
      
      chrome.storage.local.set({
        sessions,
        currentSession: newSessionId
      }).then(() => {
        sendResponse({ success: true, sessionId: newSessionId });
      });
    });
    return true;
  }
  
  if (request.action === 'deleteNode') {
    chrome.storage.local.get(['sessions', 'tabToNode']).then(result => {
      const sessions = result.sessions;
      const session = sessions[request.sessionId];
      
      if (!session || !session.allNodes[request.nodeId]) {
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
      const deleteRecursive = (id) => {
        const n = session.allNodes[id];
        if (n && n.children) {
          n.children.forEach(childId => deleteRecursive(childId));
        }
        delete session.allNodes[id];
      };
      deleteRecursive(nodeId);
      
      // 清理 tabToNode 中的引用
      const tabToNode = result.tabToNode || {};
      for (const [tabId, nId] of Object.entries(tabToNode)) {
        if (nId === nodeId || !session.allNodes[nId]) {
          delete tabToNode[tabId];
        }
      }
      
      chrome.storage.local.set({ sessions, tabToNode }).then(() => {
        sendResponse({ success: true });
      });
    });
    return true;
  }
  
  if (request.action === 'openUrl') {
    chrome.tabs.create({ url: request.url });
    sendResponse({ success: true });
    return true;
  }
});

// 定期检查并清理旧会话
setInterval(async () => {
  const { sessions, settings } = await chrome.storage.local.get(['sessions', 'settings']);
  
  if (!settings.autoCleanOldSessions) return;
  
  const sessionIds = Object.keys(sessions);
  if (sessionIds.length > settings.maxSessions) {
    const sortedSessions = sessionIds
      .map(id => ({ id, startTime: sessions[id].startTime }))
      .sort((a, b) => b.startTime - a.startTime);
    
    const toDelete = sortedSessions.slice(settings.maxSessions);
    for (const s of toDelete) {
      delete sessions[s.id];
    }
    
    await chrome.storage.local.set({ sessions });
    console.log('[mindGit] 清理了', toDelete.length, '个旧会话');
  }
}, 60000);

console.log('[mindGit] 后台脚本已加载');
