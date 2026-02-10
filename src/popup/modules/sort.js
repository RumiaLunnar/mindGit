// sort.js - 节点排序功能

import { state } from './state.js';

// 排序方式
export const SORT_MODES = {
  TIME: 'time',           // 最近访问时间
  CHILDREN: 'children',   // 子节点数量
  VISITS: 'visits',       // 访问次数
  SMART: 'smart'          // 智能加权综合
};

// 默认排序权重配置
const DEFAULT_SORT_WEIGHTS = {
  timeWeight: 0.4,        // 时间权重 (40%)
  childrenWeight: 0.35,   // 子节点权重 (35%)
  visitsWeight: 0.25      // 访问次数权重 (25%)
};

/**
 * 计算节点的智能排序分数
 * @param {Object} node - 节点数据
 * @param {Object} session - 会话数据
 * @param {Object} weights - 权重配置
 * @returns {number}
 */
function calculateSmartScore(node, session, weights = DEFAULT_SORT_WEIGHTS) {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  
  // 1. 时间分数 (最近访问的分数高)
  // 使用指数衰减：1天内=100%，7天内=50%，30天内=20%
  const timeDiff = now - node.timestamp;
  let timeScore = 100;
  if (timeDiff < oneDay) {
    timeScore = 100;
  } else if (timeDiff < oneWeek) {
    timeScore = 100 - ((timeDiff - oneDay) / (oneWeek - oneDay)) * 50;
  } else {
    timeScore = 50 - Math.min((timeDiff - oneWeek) / (30 * oneDay), 1) * 30;
  }
  
  // 2. 子节点分数 (子节点越多分数越高)
  // 使用对数函数，避免子节点过多导致分数过高
  const childCount = node.children?.length || 0;
  const childrenScore = Math.log2(childCount + 1) * 25; // 0-100 之间
  
  // 3. 访问次数分数
  // 同样使用对数函数，访问10次=50分，100次=100分
  const visitCount = node.visitCount || 1;
  const visitsScore = Math.min(Math.log10(visitCount) * 50, 100);
  
  // 计算加权总分
  const totalScore = 
    timeScore * weights.timeWeight +
    childrenScore * weights.childrenWeight +
    visitsScore * weights.visitsWeight;
  
  return totalScore;
}

/**
 * 获取节点的子节点数量（递归计算后代总数）
 * @param {Object} node - 节点数据
 * @param {Object} allNodes - 所有节点
 * @returns {number}
 */
function getDescendantCount(node, allNodes) {
  if (!node.children || node.children.length === 0) {
    return 0;
  }
  
  let count = node.children.length;
  for (const childId of node.children) {
    const child = allNodes[childId];
    if (child) {
      count += getDescendantCount(child, allNodes);
    }
  }
  return count;
}

/**
 * 对节点数组进行排序
 * @param {Array} nodeIds - 节点 ID 数组
 * @param {Object} session - 会话数据
 * @param {string} sortMode - 排序模式
 * @returns {Array}
 */
export function sortNodes(nodeIds, session, sortMode = SORT_MODES.SMART) {
  if (!nodeIds || nodeIds.length <= 1) {
    return nodeIds;
  }
  
  const allNodes = session.allNodes;
  
  return [...nodeIds].sort((a, b) => {
    const nodeA = allNodes[a];
    const nodeB = allNodes[b];
    
    if (!nodeA || !nodeB) return 0;
    
    switch (sortMode) {
      case SORT_MODES.TIME:
        // 按时间降序（最新的在前）
        return nodeB.timestamp - nodeA.timestamp;
        
      case SORT_MODES.CHILDREN:
        // 按子节点数量降序
        const countA = getDescendantCount(nodeA, allNodes);
        const countB = getDescendantCount(nodeB, allNodes);
        if (countB !== countA) {
          return countB - countA;
        }
        // 如果子节点数相同，按时间排序
        return nodeB.timestamp - nodeA.timestamp;
        
      case SORT_MODES.VISITS:
        // 按访问次数降序
        const visitsA = nodeA.visitCount || 1;
        const visitsB = nodeB.visitCount || 1;
        if (visitsB !== visitsA) {
          return visitsB - visitsA;
        }
        // 如果访问次数相同，按时间排序
        return nodeB.timestamp - nodeA.timestamp;
        
      case SORT_MODES.SMART:
      default:
        // 智能加权排序
        const scoreA = calculateSmartScore(nodeA, session);
        const scoreB = calculateSmartScore(nodeB, session);
        return scoreB - scoreA;
    }
  });
}

/**
 * 递归排序整个树
 * @param {Object} session - 会话数据
 * @param {string} sortMode - 排序模式
 * @returns {Object} 返回新的排序后的会话数据
 */
export function sortTree(session, sortMode = SORT_MODES.SMART) {
  if (!session) return session;
  
  const allNodes = session.allNodes;
  const sortedSession = {
    ...session,
    rootNodes: sortNodes(session.rootNodes, session, sortMode),
    allNodes: {}
  };
  
  // 递归排序每个节点的子节点
  function sortChildrenRecursive(nodeId) {
    const node = allNodes[nodeId];
    if (!node) return;
    
    // 复制节点
    sortedSession.allNodes[nodeId] = {
      ...node,
      children: node.children ? sortNodes(node.children, session, sortMode) : []
    };
    
    // 递归处理子节点
    if (node.children) {
      for (const childId of node.children) {
        sortChildrenRecursive(childId);
      }
    }
  }
  
  // 处理所有根节点
  for (const rootId of sortedSession.rootNodes) {
    sortChildrenRecursive(rootId);
  }
  
  return sortedSession;
}

/**
 * 获取排序模式名称
 * @param {string} mode - 排序模式
 * @param {string} lang - 语言
 * @returns {string}
 */
export function getSortModeName(mode, lang = 'zh') {
  const names = {
    zh: {
      [SORT_MODES.TIME]: '最近访问优先',
      [SORT_MODES.CHILDREN]: '子节点数量优先',
      [SORT_MODES.VISITS]: '访问次数优先',
      [SORT_MODES.SMART]: '智能综合排序'
    },
    en: {
      [SORT_MODES.TIME]: 'Recent First',
      [SORT_MODES.CHILDREN]: 'Most Children First',
      [SORT_MODES.VISITS]: 'Most Visits First',
      [SORT_MODES.SMART]: 'Smart Sort'
    }
  };
  
  return names[lang]?.[mode] || names.zh[mode];
}

/**
 * 获取所有排序模式选项
 * @returns {Array}
 */
export function getSortModes() {
  return [
    { value: SORT_MODES.SMART, key: 'smartSort' },
    { value: SORT_MODES.TIME, key: 'sortByTime' },
    { value: SORT_MODES.CHILDREN, key: 'sortByChildren' },
    { value: SORT_MODES.VISITS, key: 'sortByVisits' }
  ];
}
