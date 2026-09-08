import { projects, profile } from '../persona/content.js';

export { profile };
export const icons = {
  about: '<path d="m9 8-2 13h10L15 8M8 8h8M10 3h4v5h-4zM7 21h10M11 14h2M5 5 2 3M19 5l3-2"/>',
  products: '<path d="M3 10h18v11H3zM2 10l3-7h14l3 7M8 21v-7h8v7M7 3v7M17 3v7"/>',
  games: '<path d="M8 6h8l4 13H4L8 6ZM9 3h6M8 10h8M8 14h3M9.5 12.5v3M15 14h.1M17 16h.1"/>',
  delivery: '<path d="M3 15h18l-4 6H7l-4-6ZM12 2v13M12 3l7 9h-7M10 5 5 12h5M1 22q3-2 6 0t6 0 6 0"/>',
  lab: '<path d="M3 15a9 9 0 0 1 18 0H3ZM4 15v6h16v-6M12 3v3M11 9l5-4 2 2-5 4M10 21v-5h4v5"/>',
  contact: '<path d="M2 21 12 4l10 17H2ZM12 4v17M12 15l4 6M5 3h4M7 1v4M19 5h4M21 3v4"/>',
};
export const places = [
  { id: 'about', short: '个人灯塔', title: '你好，我是 mohui666。', en: 'THE LIGHTHOUSE', subtitle: '从这里认识我，也从这里开始绕岛一周。' },
  { id: 'products', short: '产品工坊', title: '想用的东西，自己做。', en: 'THE WORKSHOP', subtitle: 'AI 对话、随身工具和本地应用。把日常里的一个念头，慢慢做成能用的产品。', ids: ['amadeus', 'bluem', 'remote', 'pivora', 'forgeloop', 'trace-seal'] },
  { id: 'games', short: '游戏街区', title: '认真做点好玩的。', en: 'THE ARCADE', subtitle: '做 Mod，改剧情，搭一条 AI 生产线。游戏里也有许多值得动手的地方。', ids: ['lom-modkit', 'lom-save', 'bigwalk', 'schedule', 'token-foundry', 'paperclips', 'games'] },
  { id: 'delivery', short: '交付码头', title: '已经靠岸的作品。', en: 'THE HARBOR', subtitle: '从想法到页面、工具与可交互的场景。这里陈列已经做出来、可以打开的作品。', ids: ['palace', 'cosmos', 'dongyun', 'bridge', 'motion'] },
  { id: 'lab', short: '实验高地', title: '边学，边把它做出来。', en: 'THE OBSERVATORY', subtitle: '图形学、深度学习与智能体。用代码理解问题，用实验留下过程。', ids: ['graphics', 'benchmark', 'yolov1', 'kaggriculture'] },
  { id: 'contact', short: '海风营地', title: '路过的话，打个招呼。', en: 'THE CAMPSITE', subtitle: '项目之外，也写些东西、收些链接，喜欢 ASOUL 和活侠传。欢迎来我的互联网据点逛逛。' },
];
export const projectsFor = (id) => {
  const place = places.find((p) => p.id === id);
  return (place?.ids || []).map((key) => projects.find((p) => p.id === key)).filter(Boolean);
};
export const islandProjects = places.flatMap((p) => projectsFor(p.id));
