// mindGit - 浏览脉络追踪器后台脚本
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
    tabToNode: {}
  });
  
  console.log('[mindGit] 创建新会话:', newSessionId);
  return { sessions, sessionId: newSessionId };
}

// 添加节点到树 - 核心函数
async function addNodeToTree(url, title, favIconUrl, tabId, parentNodeId = null) {
  if (!shouldTrackUrl(url)) return null;
  
  const { sessions, sessionId } = await getOrCreateSession();
  const session = sessions[sessionId];
  const { tabToNode } = await chrome.storage.local.get('tabToNode');
  
  // 检查是否是重复访问已存在的节点
  if (parentNodeId && session.allNodes[parentNodeId]) {
    const parent = session.allNodes[parentNodeId];
    const existingChildId = parent.children.find(childId => {
      const child = session.allNodes[childId];
      return child && child.url === url;
    });
    
    if (existingChildId) {
      session.allNodes[existingChildId].visitCount++;
      session.allNodes[existingChildId].timestamp = Date.now();
      session.allNodes[existingChildId].title = title || session.allNodes[existingChildId].title;
      tabToNode[tabId] = existingChildId;
      await chrome.storage.local.set({ sessions, tabToNode });
      console.log('[mindGit] 更新已有子节点:', title);
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
      console.log('[mindGit] 更新已有根节点:', title);
      return existingRootId;
    }
  }
  
  // 创建新节点
  const node = createNode(url, title, favIconUrl, parentNodeId);
  
  if (parentNodeId && session.allNodes[parentNodeId]) {
    session.allNodes[parentNodeId].children.push(node.id);
    console.log('[mindGit] 添加子节点:', title, '父节点:', parentNodeId);
  } else {
    session.rootNodes.push(node.id);
    console.log('[mindGit] 添加根节点:', title);
  }
  
  session.allNodes[node.id] = node;
  tabToNode[tabId] = node.id;
  
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
    const { tabToNode } = await chrome.storage.local.get(['tabToNode']);
    
    let parentNodeId = null;
    
    // 检查是否有 from 修饰符（表示从哪个标签页打开）
    const fromQualifier = transitionQualifiers?.find(q => q.startsWith('from_'));
    
    if (fromQualifier) {
      // 新标签页打开
      const sourceTabId = parseInt(fromQualifier.replace('from_', ''));
      console.log('[mindGit] 新标签页打开，来源标签页:', sourceTabId);
      
      // 获取或创建来源标签页的节点
      parentNodeId = await getOrCreateSourceNode(sourceTabId);
      if (parentNodeId) {
        console.log('[mindGit] 来源标签页节点:', parentNodeId);
      }
    } else if (transitionType === 'typed' || transitionType === 'generated') {
      // 地址栏输入
      const currentNodeId = tabToNode[details.tabId];
      const isSearch = transitionQualifiers?.includes('from_address_bar');
      
      if (isSearch && currentNodeId) {
        // 当前页搜索
        parentNodeId = currentNodeId;
        console.log('[mindGit] 当前页搜索，父节点:', parentNodeId);
      } else {
        // 新标签页搜索或地址栏输入
        // 检查是否有 openerTabId（通过右键菜单搜索）
        const openerTabId = tab.openerTabId;
        if (openerTabId) {
          parentNodeId = await getOrCreateSourceNode(openerTabId);
          if (parentNodeId) {
            console.log('[mindGit] 新标签页搜索，来源标签页节点:', parentNodeId);
          }
        }
      }
    } else {
      // 其他类型：链接点击等
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
      }
      // 如果是新标签页但没有 from 修饰符，检查 openerTabId
      else if (tab.openerTabId) {
        parentNodeId = await getOrCreateSourceNode(tab.openerTabId);
        if (parentNodeId) {
          console.log('[mindGit] 新标签页其他类型，来源标签页节点:', parentNodeId);
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

// 监听标签页关闭，清理映射
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { tabToNode } = await chrome.storage.local.get(['tabToNode']);
  
  if (tabToNode[tabId]) {
    delete tabToNode[tabId];
    await chrome.storage.local.set({ tabToNode });
  }
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
    chrome.runtime.sendMessage({
      action: 'switchSession',
      sessionId: request.sessionId
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
