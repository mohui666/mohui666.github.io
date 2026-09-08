import { profile, projects, filters, archives, socials } from './content.js';

const root = new URL('../', import.meta.url);
const asset = (file) => new URL(`media/${file}`, import.meta.url).href;
const url = (path) => new URL(path, root).href;
const e = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const t = (text) => Array.isArray(text) ? text[state.language === 'zh' ? 0 : 1] : text;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const state = { language: localStorage.getItem('mohui-language') || 'zh', paused: localStorage.getItem('mohui-motion') === 'paused' || reducedMotion.matches,
  view: '', menu: 0, profile: 0, revealed: false, archive: 0, social: 0, info: 0, filter: 'featured', query: '', project: 'bluem' };
const app = document.getElementById('persona-app');
const menu = [
  { view: 'about', label: 'ABOUT ME', zh: '关于我', size: 80, x: 0, y: 0, sx: -6, sy: 10 },
  { view: 'archive', label: 'ARCHIVE', zh: '收藏档案', size: 66, x: 20, y: 8, sx: -11, sy: -10 },
  { view: 'github', label: 'GITHUB LINK', zh: 'GitHub 主页', size: 68, x: 8, y: 6, sx: 0, sy: -4 },
  { view: 'socials', label: 'SOCIALS', zh: '社交链接', size: 74, x: 16, y: 8, sx: -3, sy: 5 },
  { view: 'projects', label: 'SIDE PROJECTS', zh: '项目大厅', size: 56, x: 10, y: 6, sx: -4, sy: 7 },
];
const titles = { home: ['个人主页', 'Homepage'], about: ['关于我', 'About me'], archive: ['收藏档案', 'Archive'], socials: ['社交链接', 'Socials'], projects: ['项目大厅', 'Projects'] };
const href = (path) => `href="${e(url(path))}"${path.startsWith('https:') ? ' target="_blank" rel="noopener noreferrer"' : ''}`;
const route = (view) => href(`#${view}`);
const hints = (home = false) => `<div class="${home ? 'p3-hint' : 'sc-footer'} mounted" aria-hidden="true"><div class="hint-row"><kbd>↑↓</kbd><span>${t(['选择', 'SELECT'])}</span></div><div class="hint-row"><kbd>↵</kbd><span>${t(['确认', 'CONFIRM'])}</span></div>${home ? '' : `<div class="hint-row"><kbd>ESC</kbd><span>${t(['返回', 'BACK'])}</span></div>`}</div>`;

function background() {
  const isMenu = ['home', 'projects'].includes(state.view);
  const file = { about: 'main1.mp4', archive: 'main2.mp4', socials: 'main3.mp4' }[state.view];
  const poster = isMenu ? 'menu' : state.view === 'archive' ? 'resume' : state.view;
  return `<div class="scene-background" aria-hidden="true"><video id="intro-video" src="${asset(isMenu ? 'Mainn.mp4' : file)}" poster="${asset(`${poster}-poster.jpg`)}" muted playsinline ${isMenu ? '' : 'loop'} style="z-index:2"></video>${isMenu ? `<video id="loop-video" src="${asset('Mainn_1.mp4')}" poster="${asset('menu-poster.jpg')}" muted playsinline loop style="z-index:1;opacity:0"></video>` : ''}</div>`;
}

function playBackground() {
  for (const video of app.querySelectorAll('video')) {
    video.muted = true;
    if (state.paused || document.hidden) video.pause();
    else video.play().catch((error) => {
      // Autoplay can be blocked by the browser; the supplied poster remains visible.
      if (!['NotAllowedError', 'AbortError'].includes(error.name)) console.error('Background video:', error);
    });
  }
  const intro = document.getElementById('intro-video');
  const loop = document.getElementById('loop-video');
  if (loop) intro.onended = () => { intro.style.opacity = '0'; loop.style.opacity = '1'; };
}

function home() {
  return `<div class="p3-overlay"><h1 class="p3-name-tag"><span>MOHUI's</span><span>Persona</span></h1><div class="p3-stripe"></div><div class="p3-stripe2"></div>
    <nav class="p3-menu" aria-label="${t(['主菜单', 'Main menu'])}">${menu.map((item, index) => {
      const width = item.label.length * item.size * .6 + 80;
      const height = item.size * .94;
      const triangle = `polygon(0px 0px,${width}px ${height * .5}px,0px ${height}px)`;
      return `<a ${item.view === 'github' ? href(profile.github) : route(item.view)} class="p3-row mounted${state.menu === index ? ' active' : ''}" data-select="menu" data-index="${index}" aria-label="${t([item.zh, item.label])}" style="margin-right:${item.x}px;margin-top:${item.y}px;animation-delay:${400 + index * 80}ms">
        <span class="p3-glow"></span><span class="p3-skew-wrap" style="transform:skewX(${item.sx}deg) skewY(${item.sy}deg)"><span class="p3-shadow-tri${state.menu === index ? ' pop' : ''}" style="width:${width}px;height:${height}px;clip-path:${triangle}"></span><span class="p3-highlight" style="width:${width}px;height:${height}px;clip-path:${triangle};transform:translateY(-50%) scaleX(${state.menu === index ? 1 : 0})"></span>
        <span class="p3-label-wrap" style="opacity:${state.menu === index ? 1 : Math.max(.5, 1 - Math.abs(index - state.menu) * .2)}"><span class="p3-label-base p3-label-dark" style="font-size:${item.size}px">${item.label}</span><span aria-hidden="true" class="p3-label-base p3-label-bright" style="font-size:${item.size}px;clip-path:${triangle}">${item.label}</span></span></span></a>`;
    }).join('')}</nav><aside class="home-signature"><img src="${url('images/Dianafufu.jpg')}" alt="${t(['mohui666 的头像', 'mohui666’s avatar'])}" width="48" height="48"><div><p>mohui666 <span>/ MO HUI</span></p><p>${e(t(profile.motto))}</p><nav aria-label="${t(['快捷入口', 'Quick links'])}"><a ${href('island/')}>ISLAND ↗</a><a ${href('blog/index.html')}>BLOG ↗</a><a ${href('projects/index.html')}>PROJECTS ↗</a></nav></div></aside>${hints(true)}</div>`;
}

function partyRow(kind, label, index, active, role) {
  return `<div class="sc-bar-outer mounted${active ? ' active' : ''}" style="animation-delay:${index * 55}ms"><span class="sc-bar-red"></span><button type="button" class="sc-bar" data-select="${kind}" data-index="${index}" data-action="${kind}" aria-pressed="${active}"${kind === 'project' ? ' aria-controls="project-detail"' : ''}>
    ${role ? '' : `<img class="sc-char" src="${asset(`char${index + 1}.png`)}" alt="">`}<span class="sc-bar-fill"></span><span class="sc-bar-shade"></span><span class="sc-bar-content"><span class="sc-role">${role || (index === 0 ? 'LEADER' : 'PARTY')}</span><span class="sc-main"><span class="sc-main-top"><span class="sc-label">${e(label)}</span></span></span></span></button></div>`;
}

function about() {
  return `<h1 class="sr-only">${t(titles.about)}</h1><nav class="sc-root" aria-label="${t(['个人档案', 'Profile sections'])}">${profile.tabs.map((tab, i) => partyRow('profile', t(tab.label), i, i === state.profile)).join('')}</nav><div id="profile-reveal"></div>${hints()}`;
}

function updateProfile() {
  const tab = profile.tabs[state.profile];
  document.querySelectorAll('.sc-tab-button').forEach((button, i) => { button.classList.toggle('active', i === state.profile); button.setAttribute('aria-selected', i === state.profile); button.tabIndex = i === state.profile ? 0 : -1; });
  document.getElementById('profile-panel').setAttribute('aria-labelledby', `profile-tab-${state.profile}`);
  document.getElementById('profile-panel').innerHTML = `<div class="sc-reveal-upper-bar">${tab.lines.map((line) => `<p class="sc-reveal-upper-line">${e(t(line))}</p>`).join('')}</div><p class="sc-reveal-lower-bar">${e(t(tab.note))}</p>`;
  document.querySelector('.sc-main-portrait').src = asset(['mainm.jpeg', 'mainm2.jpeg', 'mainf.jpeg'][state.profile]);
}

function revealProfile() {
  if (state.revealed) { updateProfile(); return; }
  state.revealed = true;
  document.querySelector('.about-scene .sc-root').inert = true;
  document.getElementById('profile-reveal').innerHTML = `<div class="sc-dim"></div><div class="profile-dialog" role="dialog" aria-modal="true" aria-label="${t(['个人档案详情', 'Profile details'])}"><section class="sc-reveal-panel mounted"><div class="sc-tab-navigation" role="tablist" aria-label="${t(['档案分页', 'Profile tabs'])}">${profile.tabs.map((tab, i) => `<button type="button" id="profile-tab-${i}" role="tab" aria-controls="profile-panel" class="sc-tab-button" data-action="profile-tab" data-index="${i}">${e(t(tab.label))}</button>`).join('')}</div><div role="tabpanel" id="profile-panel"></div></section>
    <div class="sc-right-nav"><span class="sc-nav-arrow left" aria-hidden="true">◄</span><button class="sc-nav-btn" data-action="profile-prev" aria-label="${t(['上一项', 'Previous profile'])}">LB</button><span class="sc-nav-dot"></span><button class="sc-nav-btn" data-action="profile-next" aria-label="${t(['下一项', 'Next profile'])}">RB</button><span class="sc-nav-arrow right" aria-hidden="true">►</span></div>
    <div class="sc-main-portrait-shell mounted"><img class="sc-main-portrait" alt=""></div><button class="close-reveal" data-action="profile-close">${t(['关闭详情 ×', 'CLOSE ×'])}</button></div>`;
  updateProfile();
  document.getElementById(`profile-tab-${state.profile}`).focus({ preventScroll: true });
}

function closeProfile() {
  state.revealed = false;
  document.getElementById('profile-reveal').replaceChildren();
  document.querySelector('.about-scene .sc-root').inert = false;
  document.querySelectorAll('[data-select=profile]')[state.profile].focus({ preventScroll: true });
}

function archive() {
  return `<div class="resume-overlay"><nav class="resume-stack" aria-label="${t(titles.archive)}"><h1 class="resume-list-tag mounted">ARCHIVE</h1>${archives.map((group, i) => `<button type="button" class="resume-card-wrap mounted${i === state.archive ? ' active' : ''}" data-select="archive" data-index="${i}" data-action="archive" aria-pressed="${i === state.archive}" aria-controls="archive-detail"><span class="resume-card"><span class="resume-badge"><span class="resume-badge-text">${['I', 'II', 'III', 'IV'][i]}</span></span><span class="resume-card-inner"><span class="resume-title">${e(t(group.title))}</span><span class="resume-rank"><span class="resume-rank-label">ITEMS</span><span class="resume-rank-number">${group.links.length}</span></span></span><span class="resume-subtitle-bar"><span class="resume-subtitle">${e(t(group.subtitle))}</span></span></span></button>`).join('')}</nav><section id="archive-detail" class="resume-detail-panel" tabindex="0"></section>${hints()}</div>`;
}

function updateArchive() {
  const group = archives[state.archive];
  document.getElementById('archive-detail').innerHTML = `<div class="resume-detail-top"><span class="resume-detail-top-index">0${state.archive + 1}</span><h2 class="resume-detail-top-title">${e(t(group.title))}</h2></div><div class="resume-detail-list">${group.links.map((link, i) => `<a class="resume-detail-row" ${href(link.url)}><span class="resume-detail-row-index">${String(i + 1).padStart(2, '0')}</span><span class="resume-detail-row-title">${e(t(link.title))}</span><span class="resume-detail-status">${link.meta} ↗</span></a>`).join('')}</div><div class="resume-detail-bottom"><h3 class="resume-detail-bottom-title">MEMORY</h3><p class="resume-detail-bullet">${e(t(group.note))}</p></div>`;
  document.getElementById('archive-detail').scrollTop = 0;
}

function social() {
  return `<h1 class="sr-only">${t(titles.socials)}</h1><nav class="sc-root" aria-label="${t(titles.socials)}">${socials.map((item, i) => partyRow('social', item.label, i, i === state.social)).join('')}</nav><div class="sc-right-nav"><span class="sc-nav-arrow left" aria-hidden="true">◄</span><button class="sc-nav-btn" data-action="social-prev" aria-label="${t(['上一项', 'Previous contact'])}">LB</button><span class="sc-nav-label" id="social-label"></span><button class="sc-nav-btn" data-action="social-next" aria-label="${t(['下一项', 'Next contact'])}">RB</button><span class="sc-nav-arrow right" aria-hidden="true">►</span></div><section class="social-details" id="social-detail"></section>${hints()}`;
}

function updateSocial() {
  const item = socials[state.social];
  document.getElementById('social-label').textContent = item.label;
  document.getElementById('social-detail').innerHTML = `${item.details.map(([label, value], i) => `<div class="sc-info-bar-wrap selected" style="top:${43 + i * 10}vh"><div class="sc-info-bar"><span class="sc-info-bar-text">${label}</span><span class="sc-info-bar-count">${e(t(value))}</span></div></div>`).join('')}<a class="social-open project-pr-link" ${href(item.url)}>${t(['打开', 'OPEN'])} ${item.label} ↗</a>`;
}

function visibleProjects() {
  const query = state.query.trim().toLocaleLowerCase();
  return projects.filter((p) => (state.filter === 'all' || (state.filter === 'featured' ? p.featured : p.category === state.filter)) && (!query || [...p.title, ...p.description, p.tech].join(' ').toLocaleLowerCase().includes(query)));
}

function projectScene() {
  return `<div class="sp-container mounted"><header class="project-heading"><p class="project-eyebrow">MOHUI666 / THE WORKSHOP</p><h1 class="sp-title">SIDE PROJECTS</h1><p class="sp-subtitle">${t(['从想法到能用的东西。选一个，进去看看。', 'From an idea to something you can use. Pick one and step inside.'])}</p></header><div class="project-tools"><div class="project-filters" role="group" aria-label="${t(['项目分类', 'Project categories'])}">${filters.map(([id, zh, en]) => `<button type="button" data-action="filter" data-filter="${id}" aria-pressed="${state.filter === id}">${t([zh, en])}</button>`).join('')}</div><label class="project-search"><span>${t(['搜索', 'SEARCH'])}</span><input type="search" id="project-search" placeholder="${t(['项目名称 / 技术', 'Project / technology'])}" value="${e(state.query)}" autocomplete="off" aria-controls="project-list"></label><p id="project-count" class="project-count" role="status"></p></div><nav class="sp-btn-list" id="project-list" aria-label="${t(['项目列表', 'Project list'])}"></nav><section class="project-description" id="project-detail" tabindex="0"></section><a class="project-view-all" ${href(profile.github + '?tab=repositories')}>${t(['更多 GitHub 仓库 →', 'MORE ON GITHUB →'])}</a></div>${hints()}`;
}

function updateProjects() {
  const list = visibleProjects();
  if (!list.some((p) => p.id === state.project)) state.project = list[0]?.id;
  document.getElementById('project-list').innerHTML = list.map((p, i) => partyRow('project', t(p.title), i, state.project === p.id, String(i + 1).padStart(2, '0'))).join('');
  document.getElementById('project-count').textContent = t([`${list.length} 个项目 / 收录 ${projects.length} 个`, `${list.length} projects / ${projects.length} in the collection`]);
  document.querySelectorAll('[data-action=filter]').forEach((button) => button.setAttribute('aria-pressed', button.dataset.filter === state.filter));
  updateProjectDetail();
}

function updateProjectDetail() {
  const p = projects.find((item) => item.id === state.project);
  const detail = document.getElementById('project-detail');
  if (!p) { detail.innerHTML = `<h2>${t(['没有找到项目', 'No projects found'])}</h2><p>${t(['换个关键词，或选择「全部」分类。', 'Try another keyword or select the ALL category.'])}</p>`; return; }
  const group = filters.find(([id]) => id === p.category);
  const isRepo = p.url.startsWith('https://github.com');
  detail.innerHTML = `<p class="project-kicker">${t([group[1], group[2]])} / ${p.featured ? 'FEATURED' : 'PROJECT'}</p><h2>${e(t(p.title))}</h2><p>${e(t(p.description))}</p><div class="project-facts"><span>${e(p.tech)}</span><span>${isRepo ? 'GITHUB' : 'WEB'}</span></div><div class="project-actions"><a class="project-pr-link" ${href(p.url)}>${isRepo ? t(['查看仓库', 'VIEW REPOSITORY']) : t(['打开项目', 'OPEN PROJECT'])} ↗</a>${p.source ? `<a class="project-source" ${href(p.source)}>${t(['源码', 'SOURCE'])} ↗</a>` : ''}</div><p class="project-snapshot">${t(['制作 / mohui666', 'MADE BY / mohui666'])}</p>`;
}

function setSelection(kind, index) {
  if (kind === 'project') {
    const id = visibleProjects()[index]?.id;
    if (!id || state.project === id) return;
    state.project = id;
    updateProjectDetail();
  } else {
    if (state[kind] === index) return;
    state[kind] = index;
    if (kind === 'archive') updateArchive();
    if (kind === 'social') updateSocial();
  }
  document.querySelectorAll(`[data-select=${kind}]`).forEach((element, i) => {
    const active = i === index;
    const row = element.closest('.sc-bar-outer, .resume-card-wrap, .p3-row');
    row.classList.toggle('active', active);
    if (kind === 'menu') {
      row.querySelector('.p3-highlight').style.transform = `translateY(-50%) scaleX(${active ? 1 : 0})`;
      row.querySelector('.p3-shadow-tri').classList.toggle('pop', active);
      row.querySelector('.p3-label-wrap').style.opacity = active ? 1 : Math.max(.5, 1 - Math.abs(i - index) * .2);
    } else element.setAttribute('aria-pressed', active);
  });
}

function render() {
  const aliases = { top: 'home', collection: 'archive', sideproj: 'projects', work: 'projects', contact: 'socials', asoul: 'archive', friends: 'archive', links: 'archive' };
  const hash = location.hash.slice(1);
  state.view = aliases[hash] || (titles[hash] ? hash : document.body.dataset.startView || 'home');
  if (hash === 'asoul') state.archive = 1;
  if (hash === 'friends') state.archive = 2;
  state.revealed = false;
  document.documentElement.lang = state.language === 'zh' ? 'zh-CN' : 'en';
  document.title = `${t(titles[state.view])} · mohui666`;
  app.dataset.language = state.language;
  app.dataset.motion = state.paused ? 'paused' : 'playing';
  app.dataset.view = state.view;
  const scene = state.view === 'archive' ? 'resume' : state.view;
  const variant = ['about', 'socials'].includes(scene) ? scene : 'default';
  app.innerHTML = `<a class="skip-link" href="#content" data-action="skip">${t(['跳转到内容', 'Skip to content'])}</a><div class="site-controls" role="group" aria-label="${t(['显示设置', 'Display settings'])}"><button type="button" data-action="motion" aria-pressed="${state.paused}">${state.paused ? t(['动态已关', 'Motion off']) : t(['动态已开', 'Motion on'])}</button><button type="button" data-action="language" data-language="en" aria-pressed="${state.language === 'en'}">EN</button><span>/</span><button type="button" data-action="language" data-language="zh" aria-pressed="${state.language === 'zh'}">中文</button></div>
    <main id="content" tabindex="-1" class="scene ${scene}-scene">${background()}<div class="transition-overlay transition-${variant}" aria-hidden="true"><i style="--i:0"></i><i style="--i:1"></i><i style="--i:2"></i></div><div class="scene-content">${({ home, about, archive, socials: social, projects: projectScene })[state.view]()}</div>${state.view === 'home' ? '' : `<a ${route('home')} class="back-link">${t(['← 返回', '← BACK'])}</a>`}</main>`;
  if (state.view === 'archive') updateArchive();
  if (state.view === 'socials') updateSocial();
  if (state.view === 'projects') updateProjects();
  playBackground();
}

app.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, index } = button.dataset;
  if (['profile', 'archive', 'social', 'project'].includes(action)) setSelection(action, Number(index));
  if (action === 'profile') revealProfile();
  if (['project', 'archive'].includes(action) && matchMedia('(max-width: 720px)').matches) document.getElementById(`${action}-detail`).scrollIntoView({ behavior: state.paused ? 'instant' : 'smooth', block: 'start' });
  if (action === 'profile-tab') { state.profile = Number(index); updateProfile(); }
  if (action === 'profile-prev' || action === 'profile-next') { state.profile = (state.profile + (action.endsWith('next') ? 1 : 2)) % 3; updateProfile(); }
  if (action === 'profile-close') closeProfile();
  if (action === 'social-prev' || action === 'social-next') setSelection('social', (state.social + (action.endsWith('next') ? 1 : 2)) % 3);
  if (action === 'language') { state.language = button.dataset.language; localStorage.setItem('mohui-language', state.language); render(); document.querySelector(`[data-action=language][data-language=${state.language}]`).focus(); }
  if (action === 'motion') { state.paused = !state.paused; localStorage.setItem('mohui-motion', state.paused ? 'paused' : 'playing'); app.dataset.motion = state.paused ? 'paused' : 'playing'; button.setAttribute('aria-pressed', state.paused); button.textContent = state.paused ? t(['动态已关', 'Motion off']) : t(['动态已开', 'Motion on']); playBackground(); }
  if (action === 'filter') { state.filter = button.dataset.filter; updateProjects(); }
  if (action === 'skip') { event.preventDefault(); document.getElementById('content').focus(); }
});

for (const eventName of ['pointerover', 'focusin']) app.addEventListener(eventName, (event) => {
  if (eventName === 'pointerover' && event.pointerType !== 'mouse') return;
  const item = event.target.closest('[data-select]');
  if (item) setSelection(item.dataset.select, Number(item.dataset.index));
});
app.addEventListener('input', (event) => { if (event.target.id === 'project-search') { state.query = event.target.value; updateProjects(); } });

window.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input, textarea, select, [contenteditable], .site-controls')) return;
  if (state.revealed && event.key === 'Tab') {
    const items = [...document.querySelectorAll('.profile-dialog button:not([tabindex="-1"])')];
    if (event.shiftKey && event.target === items[0]) { event.preventDefault(); items.at(-1).focus(); }
    else if (!event.shiftKey && event.target === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    return;
  }
  if (event.key === 'Enter' && event.target.closest('a, button')) return;
  if (['Escape', 'Backspace'].includes(event.key) && state.view !== 'home') { event.preventDefault(); location.href = url('#home'); return; }
  if (event.key === 'ArrowLeft' && state.revealed) { event.preventDefault(); closeProfile(); return; }
  if (state.revealed && ['ArrowUp', 'ArrowDown', 'ArrowRight'].includes(event.key)) {
    event.preventDefault(); state.profile = (state.profile + (event.key === 'ArrowUp' ? 2 : 1)) % 3; updateProfile(); document.getElementById(`profile-tab-${state.profile}`).focus(); return;
  }
  const kind = { home: 'menu', about: 'profile', archive: 'archive', socials: 'social', projects: 'project' }[state.view];
  const items = [...app.querySelectorAll(`[data-select=${kind}]`)];
  const index = kind === 'project' ? visibleProjects().findIndex((p) => p.id === state.project) : state[kind];
  if (['ArrowUp', 'ArrowDown'].includes(event.key) && !event.target.closest('#archive-detail, #project-detail')) {
    event.preventDefault(); items[Math.max(0, Math.min(items.length - 1, index + (event.key === 'ArrowUp' ? -1 : 1)))]?.focus();
  }
  if (event.key === 'ArrowRight') {
    if (state.view === 'about') { event.preventDefault(); revealProfile(); }
    if (state.view === 'projects') { event.preventDefault(); document.querySelector('#project-detail a')?.focus(); }
    if (state.view === 'archive') { event.preventDefault(); document.querySelector('#archive-detail a')?.focus(); }
    if (state.view === 'socials') { event.preventDefault(); document.querySelector('.social-open').focus(); }
  }
  if (event.key === 'Enter') { event.preventDefault(); items[index]?.click(); }
});

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); document.getElementById('content').focus({ preventScroll: true }); });
document.addEventListener('visibilitychange', playBackground);
reducedMotion.addEventListener('change', (event) => { if (localStorage.getItem('mohui-motion') === null) { state.paused = event.matches; render(); } });
render();
