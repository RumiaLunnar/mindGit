// i18n.js - 国际化/多语言支持

import { getStorage, setStorage } from './api.js';

// 语言文本定义
const TRANSLATIONS = {
  zh: {
    // 头部
    appName: 'MindGit',
    switchToLight: '切换到亮色模式',
    switchToDark: '切换到暗色模式',
    refresh: '刷新',
    newSession: '新建会话',
    export: '导出会话',
    settings: '设置',
    
    // 会话列表
    sessionList: '会话列表',
    sessionsCount: '{count} 个',
    noRecords: '还没有浏览记录',
    startBrowsing: '开始浏览网页，我会帮你记录跳转脉络~',
    rename: '重命名',
    delete: '删除',
    
    // 统计栏
    noActiveSession: '无活动会话',
    sessionStats: '{name} · {rootCount} 个起点 · {nodeCount} 个页面',
    
    // 树形区域
    expand: '展开',
    collapse: '折叠',
    open: '打开',
    visitCount: '访问: {count} 次',
    noTitle: '无标题',
    deleteNodeConfirm: '确定要删除这个节点吗？',
    
    // 底部
    clearAll: '清空所有',
    expandAll: '全部展开',
    collapseAll: '全部折叠',
    
    // 搜索
    searchPlaceholder: '搜索会话和节点...',
    searchResults: '找到 {count} 个结果',
    noSearchResults: '未找到匹配的会话或节点',
    
    // 设置面板
    settingsTitle: '设置',
    maxSessions: '最大保存会话数',
    autoClean: '自动清理旧会话',
    showFavicons: '显示网站图标',
    defaultExpand: '树形结构默认展开',
    autoCreateSession: '自动创建会话并记录当前页面',
    colorTheme: '配色主题',
    language: '语言',
    save: '保存设置',
    
    // 主题选项
    themeDefault: '默认蓝',
    themeMorandi: '莫兰迪',
    themeForest: '森林绿',
    themeOcean: '海洋蓝',
    themeWarm: '暖阳橙',
    themeDark: '暗色模式',
    
    // 排序选项
    sortMode: '节点排序',
    export: '导出会话',
    smartSort: '智能综合排序',
    sortByTime: '最近访问优先',
    sortByChildren: '子节点数量优先',
    sortByVisits: '访问次数优允',
    
    // 新建会话
    newSessionTitle: '新建会话',
    sessionNamePlaceholder: '例如：知乎深度阅读、技术调研...',
    sessionNameLabel: '会话名称（可选）',
    create: '创建会话',
    
    // 提示信息
    refreshed: '已刷新',
    sessionCreated: '新会话已创建',
    sessionRenamed: '会话已重命名',
    sessionDeleted: '会话已删除',
    nodeDeleted: '节点已删除',
    allDataCleared: '已清空所有数据',
    allExpanded: '已展开全部',
    allCollapsed: '已折叠全部',
    settingsSaved: '设置已保存',
    autoSessionCreated: '已自动创建会话并记录当前页面',
    renameFailed: '重命名失败',
    deleteFailed: '删除失败: {error}',
    pleaseSelectSession: '请先选择会话',
    
    // 确认对话框
    confirmDeleteSession: '确定要删除这个会话吗？此操作不可撤销。',
    confirmClearAll: '确定要清空所有会话吗？此操作不可撤销。',
    confirmDeleteNode: '确定要删除这个节点吗？',
  },
  
  en: {
    // Header
    appName: 'MindGit',
    switchToLight: 'Switch to Light Mode',
    switchToDark: 'Switch to Dark Mode',
    refresh: 'Refresh',
    newSession: 'New Session',
    export: 'Export Session',
    settings: 'Settings',
    
    // Session List
    sessionList: 'Session List',
    sessionsCount: '{count} sessions',
    noRecords: 'No browsing records yet',
    startBrowsing: 'Start browsing and I\'ll track your journey~',
    rename: 'Rename',
    delete: 'Delete',
    
    // Stats Bar
    noActiveSession: 'No active session',
    sessionStats: '{name} · {rootCount} roots · {nodeCount} pages',
    
    // Tree Area
    expand: 'Expand',
    collapse: 'Collapse',
    open: 'Open',
    visitCount: 'Visits: {count}',
    noTitle: 'No Title',
    deleteNodeConfirm: 'Are you sure you want to delete this node?',
    
    // Footer
    clearAll: 'Clear All',
    expandAll: 'Expand All',
    collapseAll: 'Collapse All',
    
    // Search
    searchPlaceholder: 'Search sessions and nodes...',
    searchResults: 'Found {count} results',
    noSearchResults: 'No matching sessions or nodes found',
    
    // Settings Panel
    settingsTitle: 'Settings',
    maxSessions: 'Max Sessions to Keep',
    autoClean: 'Auto Clean Old Sessions',
    showFavicons: 'Show Website Icons',
    defaultExpand: 'Expand Tree by Default',
    autoCreateSession: 'Auto-create Session and Record Current Page',
    colorTheme: 'Color Theme',
    language: 'Language',
    save: 'Save Settings',
    
    // Theme Options
    themeDefault: 'Default Blue',
    themeMorandi: 'Morandi',
    themeForest: 'Forest Green',
    themeOcean: 'Ocean Blue',
    themeWarm: 'Warm Orange',
    themeDark: 'Dark Mode',
    
    // Sort Options
    sortMode: 'Node Sorting',
    export: 'Export Session',
    smartSort: 'Smart Sort',
    sortByTime: 'Recent First',
    sortByChildren: 'Most Children First',
    sortByVisits: 'Most Visits First',
    
    // New Session
    newSessionTitle: 'New Session',
    sessionNamePlaceholder: 'e.g., Deep Reading, Tech Research...',
    sessionNameLabel: 'Session Name (Optional)',
    create: 'Create Session',
    
    // Toast Messages
    refreshed: 'Refreshed',
    sessionCreated: 'New session created',
    sessionRenamed: 'Session renamed',
    sessionDeleted: 'Session deleted',
    nodeDeleted: 'Node deleted',
    allDataCleared: 'All data cleared',
    allExpanded: 'All expanded',
    allCollapsed: 'All collapsed',
    settingsSaved: 'Settings saved',
    autoSessionCreated: 'Auto-created session and recorded current page',
    renameFailed: 'Rename failed',
    deleteFailed: 'Delete failed: {error}',
    pleaseSelectSession: 'Please select a session first',
    
    // Confirm Dialogs
    confirmDeleteSession: 'Are you sure you want to delete this session? This action cannot be undone.',
    confirmClearAll: 'Are you sure you want to clear all sessions? This action cannot be undone.',
    confirmDeleteNode: 'Are you sure you want to delete this node?',
  }
};

// 当前语言
let currentLang = 'zh';

/**
 * 初始化语言设置
 */
export async function initI18n() {
  const result = await getStorage('settings');
  currentLang = result.settings?.language || 'zh';
  document.documentElement.setAttribute('lang', currentLang);
}

/**
 * 获取当前语言
 */
export function getCurrentLang() {
  return currentLang;
}

/**
 * 设置语言
 */
export async function setLang(lang) {
  if (TRANSLATIONS[lang]) {
    currentLang = lang;
    document.documentElement.setAttribute('lang', lang);
    await setStorage({ 
      settings: { 
        ...(await getStorage('settings')).settings,
        language: lang 
      } 
    });
    return true;
  }
  return false;
}

/**
 * 获取翻译文本
 * @param {string} key - 翻译键
 * @param {Object} params - 替换参数
 * @returns {string}
 */
export function t(key, params = {}) {
  const text = TRANSLATIONS[currentLang]?.[key] || TRANSLATIONS.zh[key] || key;
  
  // 替换参数
  return text.replace(/\{(\w+)\}/g, (match, param) => {
    return params[param] !== undefined ? params[param] : match;
  });
}

/**
 * 获取支持的语言列表
 */
export function getSupportedLangs() {
  return [
    { code: 'zh', name: '简体中文' },
    { code: 'en', name: 'English' }
  ];
}
