// 快捷链接配置：消息提到关键词时自动显示打开按钮
// 新增系统只需在这个数组里加一行
export interface QuickLink {
  keywords: string[];   // 触发关键词（消息内容包含即匹配）
  label: string;        // 按钮文字
  url: string;          // 打开的地址
  color: string;        // 按钮配色
}

export const QUICK_LINKS: QuickLink[] = [
  {
    keywords: ['盘古', 'pangu', 'Pangu', 'PANGU'],
    label: '盘古系统',
    url: 'https://pangu.yeswood.com/login',
    color: 'text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100',
  },
  {
    keywords: ['中台', '导出中心'],
    label: '中台',
    url: 'https://middle.yeswood.com',
    color: 'text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100',
  },
  {
    keywords: ['语忆', '评论数据'],
    label: '语忆',
    url: 'https://www.yuyi.com',
    color: 'text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100',
  },
];

// 匹配消息内容，返回命中的快捷链接
export function matchQuickLinks(content: string): QuickLink[] {
  return QUICK_LINKS.filter(link =>
    link.keywords.some(kw => content.includes(kw))
  );
}
