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
    // 记录标签页的父节点关系（用于追踪链接点击来源）
    tabParentMap: {},
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
    tabParentMap: {}
  });
  
  console.log('[mindGit] 创建新会话:', newSessionId);
  return { sessions, sessionId: newSessionId };
}

// 判断是否是刷新操作
function isReload(transitionType) {
  return transitionType === 'reload';
}

// 判断是否是链接点击（在当前页打开或新标签页打开）
function isLinkClick(transitionType, transitionQualifiers) {
  // 链接点击
  if (transitionType === 'link') return true;
  
  // 表单提交
  if (transitionType === 'form_submit') return true;
  
  return false;
}

// 判断是否是地址栏输入
function isAddressBarInput(transitionType) {
  return transitionType === 'typed' || transitionType === 'generated';
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

// 核心：使用 onCommitted 获取跳转类型信息
chrome.webNavigation.onCommitted.addListener(async (details) => {
  // 只处理主框架
  if (details.frameId !== 0) return;
  if (!shouldTrackUrl(details.url)) return;
  
  const { transitionType, transitionQualifiers } = details;
  
  console.log('[mindGit] 导航提交:', details.url, '类型:', transitionType, '修饰:', transitionQualifiers);
  
  // 忽略刷新操作 - 这是修复刷新产生新节点的关键
  if (isReload(transitionType)) {
    console.log('[mindGit] 检测到刷新，不创建新节点');
    
    // 只更新当前节点的访问时间和标题
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
    const { tabToNode, tabParentMap } = await chrome.storage.local.get(['tabToNode', 'tabParentMap']);
    
    // 判断跳转类型并处理
    if (isLinkClick(transitionType, transitionQualifiers)) {
      // 链接点击 - 需要判断是新标签页还是当前页
      
      // 检查是否有 from 修饰符（表示从哪个标签页打开）
      const fromQualifier = transitionQualifiers?.find(q => q.startsWith('from_'));
      
      if (fromQualifier) {
        // 新标签页打开链接
        const fromTabId = parseInt(fromQualifier.replace('from_', ''));
        const parentNodeId = tabToNode[fromTabId];
        
        console.log('[mindGit] 新标签页打开链接，父标签页:', fromTabId, '父节点:', parentNodeId);
        
        if (parentNodeId) {
          // 记录这个标签页的父节点关系
          tabParentMap[details.tabId] = parentNodeId;
          await chrome.storage.local.set({ tabParentMap });
          
          // 添加为子节点
          await addNodeToTree(details.url, tab.title, tab.favIconUrl, details.tabId, parentNodeId);
        } else {
          // 父标签页尚未被追踪，作为根节点但保留关系供后续使用
          console.log('[mindGit] 父标签页尚未追踪，将作为根节点:', details.url);
          
          // 尝试从 tabParentMap 获取（可能由 tabs.onCreated 记录）
          const fallbackParentId = tabParentMap[details.tabId];
          await addNodeToTree(details.url, tab.title, tab.favIconUrl, details.tabId, fallbackParentId || null);
        }
      } else {
        // 当前页点击链接跳转
        const currentNodeId = tabToNode[details.tabId];
        
        if (currentNodeId) {
          const { sessions, sessionId } = await getOrCreateSession();
          const session = sessions[sessionId];
          const currentNode = session.allNodes[currentNodeId];
          
          // 确保不是同一个URL（防止重复）
          if (currentNode && currentNode.url !== details.url) {
            console.log('[mindGit] 当前页链接跳转，父节点:', currentNodeId);
            await addNodeToTree(details.url, tab.title, tab.favIconUrl, details.tabId, currentNodeId);
          }
        } else {
          // 没有历史记录，作为根节点
          await addNodeToTree(details.url, tab.title, tab.favIconUrl, details.tabId, null);
        }
      }
    } else if (isAddressBarInput(transitionType)) {
      // 地址栏输入 - 作为新的根节点（或者可以检测是否是搜索）
      console.log('[mindGit] 地址栏输入，作为根节点');
      
      // 检查是否是搜索导致的跳转
      const isSearch = transitionQualifiers?.includes('from_address_bar');
      
      if (isSearch) {
        // 如果是从当前页搜索，保持当前节点作为父节点
        // 先尝试获取当前标签页的节点（当前页搜索）
        let parentNodeId = tabToNode[details.tabId];
        
        // 如果当前标签页没有节点记录，尝试从 tabParentMap 获取（新标签页搜索）
        if (!parentNodeId && tabParentMap[details.tabId]) {
          parentNodeId = tabParentMap[details.tabId];
          console.log('[mindGit] 搜索新标签页，使用记录的父节点:', parentNodeId);
          // 清理已使用的映射
          delete tabParentMap[details.tabId];
          await chrome.storage.local.set({ tabParentMap });
        }
        
        if (parentNodeId) {
          await addNodeToTree(details.url, tab.title, tab.favIconUrl, details.tabId, parentNodeId);
        } else {
          await addNodeToTree(details.url, tab.title, tab.favIconUrl, details.tabId, null);
        }
      } else {
        // 直接地址栏输入，作为根节点
        await addNodeToTree(details.url, tab.title, tab.favIconUrl, details.tabId, null);
      }
    } else {
      // 其他类型（如 start_page, auto_bookmark, form_submit 等）
      let parentNodeId = tabToNode[details.tabId];
      
      // 如果当前标签页没有节点记录，尝试从 tabParentMap 获取（新标签页打开）
      if (!parentNodeId && tabParentMap[details.tabId]) {
        parentNodeId = tabParentMap[details.tabId];
        console.log('[mindGit] 其他类型新标签页，使用记录的父节点:', parentNodeId);
        // 清理已使用的映射
        delete tabParentMap[details.tabId];
        await chrome.storage.local.set({ tabParentMap });
      }
      
      if (parentNodeId) {
        const { sessions, sessionId } = await getOrCreateSession();
        const session = sessions[sessionId];
        const currentNode = session.allNodes[parentNodeId];
        
        if (currentNode && currentNode.url !== details.url) {
          await addNodeToTree(details.url, tab.title, tab.favIconUrl, details.tabId, parentNodeId);
        }
      } else {
        await addNodeToTree(details.url, tab.title, tab.favIconUrl, details.tabId, null);
      }
    }
  } catch (e) {
    console.error('[mindGit] 处理导航错误:', e);
  }
});

// 监听标签页创建（用于追踪新标签页的来源）
chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.openerTabId) {
    // 这个标签页是从另一个标签页打开的
    const { tabParentMap, tabToNode } = await chrome.storage.local.get(['tabParentMap', 'tabToNode']);
    const parentNodeId = tabToNode[tab.openerTabId];
    
    if (parentNodeId) {
      tabParentMap[tab.id] = parentNodeId;
      await chrome.storage.local.set({ tabParentMap });
      console.log('[mindGit] 记录标签页父子关系:', tab.id, '父节点:', parentNodeId);
    }
  }
});

// 监听导航目标创建（捕获右键菜单搜索、链接在新标签页打开等）
chrome.webNavigation.onCreatedNavigationTarget.addListener(async (details) => {
  const { sourceTabId, tabId } = details;
  
  console.log('[mindGit] 导航目标创建，来源标签页:', sourceTabId, '新标签页:', tabId);
  
  const { tabParentMap, tabToNode } = await chrome.storage.local.get(['tabParentMap', 'tabToNode']);
  const parentNodeId = tabToNode[sourceTabId];
  
  if (parentNodeId) {
    tabParentMap[tabId] = parentNodeId;
    await chrome.storage.local.set({ tabParentMap });
    console.log('[mindGit] 记录导航目标父子关系:', tabId, '父节点:', parentNodeId);
  }
});

// 监听标签页更新（备用方案，处理一些特殊情况）
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // 只在页面加载完成时处理
  if (changeInfo.status !== 'complete' || !tab.url) return;
  if (!shouldTrackUrl(tab.url)) return;
  
  const { tabToNode, tabParentMap } = await chrome.storage.local.get(['tabToNode', 'tabParentMap']);
  const currentNodeId = tabToNode[tabId];
  
  // 如果还没有记录这个标签页
  if (!currentNodeId) {
    // 检查是否有父节点记录
    const parentNodeId = tabParentMap[tabId];
    
    if (parentNodeId) {
      console.log('[mindGit] 使用记录的父节点:', parentNodeId);
      await addNodeToTree(tab.url, tab.title, tab.favIconUrl, tabId, parentNodeId);
      // 清理已使用的映射
      delete tabParentMap[tabId];
      await chrome.storage.local.set({ tabParentMap });
    } else {
      // 作为根节点
      await addNodeToTree(tab.url, tab.title, tab.favIconUrl, tabId, null);
    }
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
  const { tabToNode, tabParentMap } = await chrome.storage.local.get(['tabToNode', 'tabParentMap']);
  
  if (tabToNode[tabId]) {
    delete tabToNode[tabId];
  }
  if (tabParentMap[tabId]) {
    delete tabParentMap[tabId];
  }
  
  await chrome.storage.local.set({ tabToNode, tabParentMap });
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
      tabParentMap: {}
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
