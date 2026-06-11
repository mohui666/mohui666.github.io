document.addEventListener('DOMContentLoaded', () => {
  const grid = document.querySelector('#menu .grid');
  if (!grid || grid.querySelector('[data-emberfall]')) return;

  const card = document.createElement('button');
  card.className = 'card link';
  card.dataset.emberfall = 'true';
  card.style.borderColor = '#9f76c8';
  card.innerHTML = '<span class="num">06 / 小队 CRPG</span><h2>余烬之门</h2><p>三人小队、回合制行动点、对话检定、技能状态、战利品与三章战役。</p><span class="tag">复杂游戏 · 独立页面</span><span class="icon">⬢</span>';
  card.addEventListener('click', () => {
    location.href = './emberfall/';
  });
  grid.prepend(card);
});
