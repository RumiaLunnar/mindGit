// 浏览脉络追踪器 - 后台脚本
// 负责记录网页跳转关系

// 存储结构：
// sessions: { sessionId: { rootNodes: [], allNodes: {}, name, startTime } }
// currentSession: 当前会话ID
// tabToNode: { tabId: nodeId } - 记录每个标签页当前对应的节点

let sessionCounter = 0;
let nodeCounter = 0;

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
    settings: {
      maxSessions: 50,
      maxNodesPerSession: 500,
      autoCleanOldSessions: true,
      showFavicons: true,
      defaultExpand: true
    }
  });
  console.log('[浏览脉络追踪器] 已初始化');
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
    tabToNode: {}
  });
  
  console.log('[浏览脉络追踪器] 创建新会话:', newSessionId);
  return { sessions, sessionId: newSessionId };
}

// 添加节点到树 - 这是核心函数
async function addNodeToTree(url, title, favIconUrl, tabId, parentNodeId = null) {
  if (!shouldTrackUrl(url)) return null;
  
  // 获取当前会话
  const { sessions, sessionId } = await getOrCreateSession();
  const session = sessions[sessionId];
  const { tabToNode } = await chrome.storage.local.get('tabToNode');
  
  // 检查是否是重复访问已存在的节点
  // 如果有父节点，检查父节点的子节点中是否有相同URL
  if (parentNodeId && session.allNodes[parentNodeId]) {
    const parent = session.allNodes[parentNodeId];
    const existingChildId = parent.children.find(childId => {
      const child = session.allNodes[childId];
      return child && child.url === url;
    });
    
    if (existingChildId) {
      // 已存在相同URL的子节点，增加访问计数
      session.allNodes[existingChildId].visitCount++;
      session.allNodes[existingChildId].timestamp = Date.now();
      session.allNodes[existingChildId].title = title || session.allNodes[existingChildId].title;
      tabToNode[tabId] = existingChildId;
      await chrome.storage.local.set({ sessions, tabToNode });
      console.log('[浏览脉络追踪器] 更新已有子节点:', title);
      return existingChildId;
    }
  }
  
  // 检查是否是根节点重复
  if (!parentNodeId) {
    const existingRootId = session.rootNodes.find(rootId => {
      const root = session.allNodes[rootId];
      return root && root.url === url;
    });
    
    if (existingRootId) {
      session.allNodes[existingRootId].visitCount++;
      session.allNodes[existingRootId].timestamp = Date.now();
      session.allNodes[existingRootId].title = title || session.allNodes[existingRootId].title;
      tabToNode[tabId] = existingRootId;
      await chrome.storage.local.set({ sessions, tabToNode });
      console.log('[浏览脉络追踪器] 更新已有根节点:', title);
      return existingRootId;
    }
  }
  
  // 创建新节点
  const node = createNode(url, title, favIconUrl, parentNodeId);
  
  // 如果有父节点，添加到父节点的children中
  if (parentNodeId && session.allNodes[parentNodeId]) {
    session.allNodes[parentNodeId].children.push(node.id);
    console.log('[浏览脉络追踪器] 添加子节点:', title, '父节点:', parentNodeId);
  } else {
    // 没有父节点，作为根节点
    session.rootNodes.push(node.id);
    console.log('[浏览脉络追踪器] 添加根节点:', title);
  }
  
  session.allNodes[node.id] = node;
  tabToNode[tabId] = node.id;
  
  await chrome.storage.local.set({ sessions, tabToNode });
  return node.id;
}

// 检查是否是新页面（不是刷新、不是前进后退）
function isNewPageVisit(details) {
  // frameId !== 0 表示是iframe，我们不追踪
  if (details.frameId !== 0) return false;
  
  // 只处理主框架的导航
  const transitionType = details.transitionType;
  
  // 有效的跳转类型
  const validTypes = ['link', 'typed', 'auto_bookmark', 'form_submit', 'start_page'];
  
  // 忽略以下类型：
  // - auto_subframe/manual_subframe: iframe
  // - reload: 刷新页面
  // - generated: 前进/后退按钮
  if (transitionType === 'reload') return false;
  if (transitionType === 'auto_subframe' || transitionType === 'manual_subframe') return false;
  
  return validTypes.includes(transitionType);
}

// 核心：监听webNavigation以获取精确的跳转信息
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (!shouldTrackUrl(details.url)) return;
  
  const { tabToNode } = await chrome.storage.local.get('tabToNode');
  const currentNodeId = tabToNode[details.tabId];
  
  try {
    const tab = await chrome.tabs.get(details.tabId);
    
    if (currentNodeId) {
      const { sessions, sessionId } = await getOrCreateSession();
      const session = sessions[sessionId];
      const currentNode = session.allNodes[currentNodeId];
      
      // 只有当URL真正改变时才创建新节点
      if (currentNode && currentNode.url !== details.url) {
        await addNodeToTree(details.url, tab.title, tab.favIconUrl, details.tabId, currentNodeId);
      }
    } else {
      // 新标签页，没有历史记录，作为根节点
      await addNodeToTree(details.url, tab.title, tab.favIconUrl, details.tabId, null);
    }
  } catch (e) {
    // 标签页可能已关闭
  }
});

// 监听页面跳转前的状态，用于判断是否是链接点击
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // 只处理主框架
  if (details.frameId !== 0) return;
  
  // 记录当前URL，用于后续判断跳转类型
  const { tabToNode } = await chrome.storage.local.get('tabToNode');
  const currentNodeId = tabToNode[details.tabId];
  
  if (currentNodeId) {
    // 保存跳转前的节点ID
    await chrome.storage.local.set({
      [`pending_${details.tabId}`]: currentNodeId
    });
  }
});

// 监听标签页更新（备用方案）
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // 只在页面加载完成时处理
  if (changeInfo.status !== 'complete' || !tab.url) return;
  if (!shouldTrackUrl(tab.url)) return;
  
  const { tabToNode } = await chrome.storage.local.get('tabToNode');
  const currentNodeId = tabToNode[tabId];
  
  // 如果这个标签页已经有节点记录
  if (currentNodeId) {
    const { sessions, sessionId } = await getOrCreateSession();
    const session = sessions[sessionId];
    const currentNode = session.allNodes[currentNodeId];
    
    // URL变了，创建新节点
    if (currentNode && currentNode.url !== tab.url) {
      await addNodeToTree(tab.url, tab.title, tab.favIconUrl, tabId, currentNodeId);
    }
  } else {
    // 新标签页，作为根节点
    await addNodeToTree(tab.url, tab.title, tab.favIconUrl, tabId, null);
  }
});

// 监听历史记录状态更新（单页应用的前进/后退）
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
      
      // 遍历所有节点查找匹配的URL
      for (const [nodeId, node] of Object.entries(session.allNodes)) {
        if (node.url === details.url && nodeId !== currentNodeId) {
          // 发现已存在的节点，切换到该节点
          tabToNode[details.tabId] = nodeId;
          await chrome.storage.local.set({ tabToNode });
          foundExisting = true;
          console.log('[浏览脉络追踪器] 切换到历史节点:', node.title);
          break;
        }
      }
      
      // 如果没有找到已有节点，且URL真的改变了，创建新节点
      if (!foundExisting && currentNode && currentNode.url !== details.url) {
        await addNodeToTree(details.url, tab.title, tab.favIconUrl, details.tabId, currentNodeId);
      }
    }
  } catch (e) {
    // 忽略错误
  }
});

// 监听标签页关闭，清理映射
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { tabToNode } = await chrome.storage.local.get('tabToNode');
  if (tabToNode[tabId]) {
    delete tabToNode[tabId];
    await chrome.storage.local.set({ tabToNode });
  }
  // 清理pending状态
  await chrome.storage.local.remove(`pending_${tabId}`);
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
      tabToNode: {}
    }).then(() => {
      sendResponse({ success: true });
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
    // 按时间排序，删除最旧的
    const sortedSessions = sessionIds
      .map(id => ({ id, startTime: sessions[id].startTime }))
      .sort((a, b) => b.startTime - a.startTime);
    
    const toDelete = sortedSessions.slice(settings.maxSessions);
    for (const s of toDelete) {
      delete sessions[s.id];
    }
    
    await chrome.storage.local.set({ sessions });
    console.log('[浏览脉络追踪器] 清理了', toDelete.length, '个旧会话');
  }
}, 60000); // 每分钟检查一次

console.log('[浏览脉络追踪器] 后台脚本已加载');
