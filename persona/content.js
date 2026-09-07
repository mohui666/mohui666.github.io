// Public projects and the existing homepage's links. Edit this file to update the site.
export const profile = {
  name: 'mohui666',
  github: 'https://github.com/mohui666',
  motto: ['关注嘉然，顿顿解馋。', 'Follow Diana. Stay well fed.'],
  intro: ['写点项目，收点链接，也喜欢 ASOUL。', 'Making things, collecting links, and enjoying ASOUL.'],
  tabs: [
    { label: ['关于我', 'ABOUT ME'], lines: [['MO HUI / mohui666', 'MO HUI / mohui666'], ['中国矿业大学（北京） · 在读', 'Studying at CUMTB'], ['正在学习深度学习', 'Currently learning deep learning']], note: ['关注嘉然，顿顿解馋。', 'Follow Diana. Stay well fed.'] },
    { label: ['正在折腾', 'MAKING THINGS'], lines: [['AI 对话 · 编程智能体 · 本地工具', 'AI companions · Coding agents · Local tools'], ['Android · Web · Unity', 'Android · Web · Unity'], ['游戏 Mod · 交互实验 · 图形学', 'Game mods · Interactive experiments · Graphics']], note: ['Local-first is the way. 把想法做成能用的东西。', 'Local-first is the way. Turning ideas into things I can use.'] },
    { label: ['随便逛逛', 'OFF THE CLOCK'], lines: [['ASOUL · 活侠传 · 动漫', 'ASOUL · Legend of Mortal · Anime'], ['博客、小说和旧收藏都在这里', 'A home for my blog, stories and collections'], ['从项目大厅开始，挑一个玩玩', 'Pick something in the project hall and try it']], note: ['欢迎来到我的互联网据点。', 'Welcome to my little corner of the internet.'] },
  ],
};

const repo = (name) => `https://github.com/mohui666/${name}`;
// title and description use [简体中文, English]. Paths without https are relative to the site root.
export const projects = [
  { id: 'bluem', title: ['蓝音 · BLUEM', 'BLUEM'], category: 'apps', tech: 'Android / JavaScript', featured: true, url: repo('bluem-player'), description: ['P3R 风格的 Android 音乐播放器。本地音乐、歌词、歌单和后台播放，把喜欢的音乐装进口袋。', 'A P3R-inspired Android music player with local music, lyrics, playlists and background playback.'] },
  { id: 'amadeus', title: ['Amadeus', 'Amadeus'], category: 'ai', tech: 'React / Android / Voice', featured: true, url: repo('Amadeus'), description: ['Amadeus 的非官方复刻。React 手机界面和 Android 客户端，连接 AI 对话、本地记忆与语音服务。', 'An unofficial Amadeus recreation with a React mobile interface, Android client, AI conversations, local memory and voice services.'] },
  { id: 'remote', title: ['General Agent Remote', 'General Agent Remote'], category: 'apps', tech: 'Rust / Android / Web', featured: true, url: repo('GeneralAgentRemote'), description: ['在 Android 或网页上继续本机的 Codex 和 Grok 会话，把电脑上的工作接着做下去。', 'Continue local Codex and Grok sessions from Android or the web. Take your ongoing work with you.'] },
  { id: 'forgeloop', title: ['ForgeLoop', 'ForgeLoop'], category: 'ai', tech: 'Python / Coding Agents', featured: true, url: repo('ForgeLoop'), description: ['构建、运行和评估编程智能体的平台。包含交互式终端、任务执行、轨迹回放与可验证的软件工程评估。', 'A compact platform for building, running and evaluating coding agents, with an interactive terminal, task execution, replay and verifier-backed evaluations.'] },
  { id: 'pivora', title: ['Pivora', 'Pivora'], category: 'apps', tech: 'TypeScript / DuckDB', featured: true, url: repo('pivora'), description: ['本地优先的数据分析工作室：数据准备、语义建模、DuckDB SQL 与交互仪表板，在一个工作区完成。', 'A local-first analytics studio for data preparation, semantic modeling, DuckDB SQL and interactive dashboards.'] },
  { id: 'lom-modkit', title: ['活侠传 Mod 工具箱', 'Legend of Mortal Modkit'], category: 'mods', tech: 'Python / BepInEx', featured: true, url: repo('lom_modkit'), description: ['活侠传图形化剧情 Mod 编辑器与加载器。编辑剧情，制作并加载 .lommod 内容包。', 'A visual story mod editor and loader for Legend of Mortal. Create, edit and load .lommod story packs.'] },
  { id: 'palace', title: ['宫阙 · 故宫三维漫游', 'Palace Atlas'], category: 'web', tech: '3D / Architecture', featured: true, url: 'palace/', source: repo('mohui666.github.io') + '/tree/main/palace', description: ['沿着故宫中轴，探索 33 座建筑。点击入殿，走近梁架、藻井与宫室陈设。', 'Explore 33 buildings along the Forbidden City’s central axis. Enter halls and discover their timber structures, ceilings and interiors.'] },
  { id: 'cosmos', title: ['宇宙引力实验室', 'COSMOS LAB'], category: 'web', tech: 'Physics / Solar System', featured: true, url: 'cosmos/', source: repo('mohui666.github.io') + '/tree/main/cosmos', description: ['在浏览器里探索太阳、八大行星与月球。查看和编辑天体，观察轨道与守恒量如何变化。', 'Explore the Sun, eight planets and the Moon in your browser. Inspect and edit bodies, then observe their orbits and conserved quantities.'] },
  { id: 'bridge', title: ['Three.js → Unity', 'Three.js → Unity'], category: 'apps', tech: 'C# / Three.js / Unity', featured: true, url: repo('three-unity-bridge'), description: ['可复用的 Three.js 到 Unity 桥接工具。支持原网页 WebView 打包，也提供 Unity 主导的运行时。', 'A reusable Three.js-to-Unity bridge with original-web WebView packaging and an optional Unity-authoritative runtime.'] },
  { id: 'trace-seal', title: ['TraceSeal', 'TraceSeal'], category: 'ai', tech: 'Python / Agent Tools', url: repo('trace-seal'), description: ['AI Agent 操作记录、回放与策略防火墙的 MVP，围绕智能体实际执行过的动作展开。', 'An MVP for AI agent operation recording, replay and a policy firewall, centered on the actions an agent actually took.'] },
  { id: 'profitfoundry', title: ['ProfitFoundry', 'ProfitFoundry'], category: 'ai', tech: 'TypeScript / Local AI', url: 'https://profitfoundry-2026.vercel.app', source: repo('profitfoundry-2026'), description: ['包含 13 个工具的本地私有 AI 商务工具集，覆盖增长、商务、信任和证据管理。', 'A local, private AI business suite with 13 tools for growth, commerce, trust and evidence.'] },
  { id: 'token-foundry', title: ['Token Foundry', 'Token Foundry'], category: 'web', tech: 'TypeScript / Incremental Game', url: 'https://mohui666.github.io/token-foundry/', source: repo('token-foundry'), description: ['从 Tokenizer 到 Transformer、RLHF 和自我改进，一步步搭起 AI 生产链的中文增量游戏。', 'A Chinese incremental game about building an AI production chain, from tokenizers and Transformers to RLHF and self-improvement.'] },
  { id: 'paperclips', title: ['宇宙回形针 · 中文版', 'Universal Paperclips CN'], category: 'web', tech: 'JavaScript / Unofficial Translation', url: 'https://mohui666.github.io/universal-paperclips-cn/', source: repo('universal-paperclips-cn'), description: ['Universal Paperclips 的非官方纯中文版本。从制造第一枚回形针开始。', 'An unofficial Chinese version of Universal Paperclips. Start with your very first paperclip.'] },
  { id: 'babel', title: ['巴别图书馆', 'Library of Babel'], category: 'web', tech: 'TypeScript / Text Experiment', url: 'https://babel-library-mu.vercel.app', source: repo('babel-library'), description: ['一个容纳所有可能文本的图书馆前端实验。在有限字符的排列里寻找一句话。', 'A frontend experiment for a library of every possible text. Search for a sentence among arrangements of a finite alphabet.'] },
  { id: 'bigwalk', title: ['Big Walk · 一起听', 'Big Walk Music Share'], category: 'mods', tech: 'C# / Game Mod', url: repo('bigwalk-music-share'), description: ['Big Walk 网易云音乐分享模组。读取本地登录态，使用原版播放器 UI，在房间里一起听歌。', 'A NetEase Cloud Music sharing mod for Big Walk, using local login state and the original player UI for shared listening in a room.'] },
  { id: 'lom-save', title: ['活侠传存档分析器', 'Legend of Mortal Save Analyzer'], category: 'mods', tech: 'JavaScript / Save Tools', url: 'https://mohui666.github.io/lom_save_analyzer/', source: repo('lom_save_analyzer'), description: ['活侠传存档分析器的网页版。打开页面，查看存档中的信息。', 'A browser-based save analyzer for Legend of Mortal. Open the page to inspect your save data.'] },
  { id: 'lom-style', title: ['活侠传文笔 Skill', 'Legend of Mortal Writing Skill'], category: 'ai', tech: 'Agent Skill / Writing', url: repo('lom_style_skill'), description: ['让 AI Agent 使用活侠传式文笔：第二人称、文白相间，以及一本正经的武侠幽默。', 'A writing skill for AI agents inspired by Legend of Mortal: second-person narration, classical phrasing and deadpan wuxia humor.'] },
  { id: 'schedule', title: ['Schedule I 简体汉化', 'Schedule I Chinese'], category: 'mods', tech: 'C# / BepInEx', url: repo('ScheduleIChinese'), description: ['《Schedule I》简体中文离线汉化显示层插件。基于 BepInEx，不包含游戏文件。', 'An offline Simplified Chinese display-layer translation plugin for Schedule I, built with BepInEx and distributed without game files.'] },
  { id: 'graphics', title: ['井下综采工作面仿真', 'Underground Mining Simulation'], category: 'research', tech: 'C++17 / OpenGL 3.3', url: repo('2026-Computer-Graphics-Course-Project'), description: ['计算机图形学课程项目。用 C++17 与 OpenGL 3.3 构建煤矿井下综采工作面的虚拟仿真。', 'A computer graphics course project simulating an underground coal-mining face with C++17 and OpenGL 3.3.'] },
  { id: 'benchmark', title: ['Three.js / Unity 对照实验', 'Three.js / Unity Benchmark'], category: 'research', tech: 'TypeScript / Unity', url: repo('threejs-unity-benchmark'), description: ['为原始 Three.js 场景与对应的 Unity 转换场景提供成对、可复现的对照实验。', 'Paired, reproducible benchmarks for original Three.js scenes and their Unity conversions.'] },
  { id: 'kaggriculture', title: ['Kaggriculture Agent', 'Kaggriculture Agent'], category: 'research', tech: 'Python / Kaggle', url: repo('kaggriculture-v66-agent'), description: ['面向 Kaggle Kaggriculture 的轻量规则智能体，基于公开观测信息做决策。', 'A lightweight rule-based agent for Kaggle Kaggriculture, using public observations to make decisions.'] },
  { id: 'yolov1', title: ['YOLOv1 · PyTorch', 'YOLOv1 · PyTorch'], category: 'research', tech: 'Python / PyTorch', url: repo('yolov1'), description: ['YOLOv1 的 PyTorch 实现，用代码学习目标检测。', 'A PyTorch implementation of YOLOv1, learning object detection through code.'] },
  { id: 'motion', title: ['Motion Field', 'Motion Field'], category: 'web', tech: 'SVG / Canvas / WebGL', url: 'motion/index.html', description: ['44 个独立网页：指针、滚动、物理拖拽，以及 SVG、Canvas 和 WebGL 动效实验。', '44 independent pages exploring pointers, scrolling, physics-based dragging, SVG, Canvas and WebGL motion.'] },
  { id: 'games', title: ['默绘街机厅', 'Mo Hui Arcade'], category: 'web', tech: 'Browser Games', url: 'games/', description: ['不用下载，点开就能玩的小游戏合集。', 'A collection of small browser games. No download needed; just pick one and play.'] },
  { id: 'dongyun', title: ['东云漫研社', 'Dongyun Anime Club'], category: 'web', tech: 'CUMTB / Club Website', url: 'dongyun/', description: ['中国矿业大学（北京）动漫同好社团的网页。自由交流，不强制分工，一起发电。', 'A website for the anime community at CUMTB: casual conversation, shared interests and making things together.'] },
  { id: 'mogai', title: ['毛概刷题', 'Course Quiz'], category: 'web', tech: 'Study / 307 Questions', url: 'projects/mogai-quiz/index.html', description: ['307 道选择题的交互练习页面，复习时随手刷几题。', 'An interactive practice page with 307 multiple-choice questions for course revision.'] },
];

export const filters = [
  ['featured', '精选', 'FEATURED'], ['all', '全部', 'ALL'], ['ai', 'AI', 'AI'],
  ['apps', '应用 / 工具', 'APPS'], ['mods', '游戏 Mod', 'MODS'], ['web', '网页 / 试玩', 'WEB'], ['research', '学习 / 实验', 'LAB'],
];

export const archives = [
  { title: ['博客与笔记', 'BLOG & NOTES'], subtitle: ['写下来，慢慢积累', 'Things written down along the way'], note: ['项目以外，也留一点文字。博客与公开笔记都从这里进入。', 'A place for words alongside the projects. Read the blog or browse my public notes.'], links: [
    { title: ['博客', 'Blog'], meta: 'BLOG', url: 'blog/index.html' },
    { title: ['公开笔记', 'Public notes'], meta: 'NOTES', url: repo('Note') },
    { title: ['山海经 · 资料与 PDF', 'Shan Hai Jing · Documents'], meta: 'READ', url: 'projects/ShanHaiJing/index.html' },
  ] },
  { title: ['ASOUL 收藏', 'ASOUL'], subtitle: ['关注嘉然，顿顿解馋', 'A little place for ASOUL'], note: ['旧主页里的五位成员、同人小说、视频和音乐入口，都继续留在这里。', 'The original homepage’s five members, fan fiction, videos and music links are all still here.'], links: [
    ...[['向晚', 'Ava', '672346917'], ['贝拉', 'Bella', '672353429'], ['珈乐', 'Carol', '351609538'], ['嘉然', 'Diana', '672328094'], ['乃琳', 'Eileen', '672342685']].map(([zh, en, id]) => ({ title: [zh, en], meta: 'BILIBILI', url: `https://space.bilibili.com/${id}` })),
    { title: ['魂归故里 · 小说目录', 'Homecoming · Fan fiction'], meta: 'NOVEL', url: 'projects/Novel/-1.html' },
    { title: ['大家想看的东西 · 视频', 'Video collection'], meta: 'VIDEO', url: 'projects/VideoPlayer/html/main.html' },
    { title: ['ASOUL-MUSIC · 施工中', 'ASOUL-MUSIC · In progress'], meta: 'MUSIC', url: 'projects/ASOULMUSIC/ASOUL-MUSIC.html' },
  ] },
  { title: ['友情链接', 'FRIENDS'], subtitle: ['互联网邻居们', 'Around the neighborhood'], note: ['欢迎顺路去朋友们的网站逛逛。', 'Say hello to some neighboring corners of the internet.'], links: [
    { title: ['MCBBS Wiki', 'MCBBS Wiki'], meta: 'WIKI', url: 'https://mcbbs.wiki/wiki/' },
    { title: ['JimaLink', 'JimaLink'], meta: 'FRIEND', url: 'https://jimmma.top' },
    { title: ['Steve7811D', 'Steve7811D'], meta: 'FRIEND', url: 'https://steve7811d.github.io' },
  ] },
  { title: ['旧站存档', 'ARCHIVE'], subtitle: ['一直留着的入口', 'Links kept from the original site'], note: ['一些旧项目与页面也值得留个位置。活侠传补丁是旧站保留的历史链接。', 'Older projects and pages still have a place here. The MortalInstantWin patch is a historical link kept from the original site.'], links: [
    { title: ['默绘网络言论自由排名', 'Network speech freedom ranking'], meta: 'ARCHIVE', url: 'projects/Rank/index.html' },
    { title: ['MortalInstantWin · 历史项目', 'MortalInstantWin · Legacy project'], meta: 'LEGACY', url: repo('MortalInstantWin') },
    { title: ['鸣谢', 'Thanks'], meta: 'THANKS', url: 'html/thanks.html' },
    { title: ['主页视觉与素材来源', 'Homepage visual & asset credits'], meta: 'CREDITS', url: 'persona/credits.html' },
  ] },
];

export const socials = [
  { label: 'GITHUB', url: profile.github, details: [['USER', 'mohui666'], ['NAME', 'Mo Hui'], ['FOCUS', 'Local-first']] },
  { label: 'BILIBILI', url: 'https://b23.tv/NfPPuQr', details: [['USER', 'mohui666'], ['FAVORITE', 'ASOUL'], ['HELLO', ['关注嘉然，顿顿解馋', 'Follow Diana']]] },
  { label: 'MCBBS WIKI', url: 'https://mcbbs.wiki/wiki/mohui666', details: [['USER', 'mohui666'], ['COMMUNITY', 'MCBBS'], ['PAGE', ['个人条目', 'Personal page']]] },
];
