import './style.css';
import './mobile.css';
import { PhysicsEngine, G, GM_SUN_SI, LIGHT_SPEED } from './physics.js';
import { PRESETS, createPreset } from './presets.js';
import { UniverseView } from './scene.js';
import { textureUrls } from './surfaces.js';

const icons={orbit:'<ellipse cx="12" cy="12" rx="11" ry="4.8" transform="rotate(-35 12 12)"/><circle cx="12" cy="12" r="3"/>',play:'<path d="m9 5 11 7-11 7Z"/>',pause:'<path d="M8 5v14M16 5v14"/>',reset:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',step:'<path d="m5 5 10 7-10 7ZM19 5v14"/>',plus:'<path d="M12 5v14M5 12h14"/>',focus:'<circle cx="12" cy="12" r="6"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 0 1 6 1c0 2-3 2-3 4m0 3v.5"/>',expand:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/>',sliders:'<path d="M4 7h7m4 0h5M4 17h3m4 0h9"/><circle cx="13" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',camera:'<path d="M4 6h4l2-3h4l2 3h4v14H4Z"/><circle cx="12" cy="12" r="4"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',star:'<path d="m12 2 2.6 6.5 6.9.5-5.3 4.5 1.8 6.8-6-3.8-6 3.8 1.8-6.8L2.5 9l6.9-.5Z"/>'};
const icon=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.orbit}</svg>`;
const $=s=>document.querySelector(s);
const AU_KM=149597870.7, V_KMS=AU_KM/(365.25*86400);
const fmt=(v,d=3)=>Number.isFinite(v)?Math.abs(v)>0&&(Math.abs(v)<.001||Math.abs(v)>=1e5)?v.toExponential(2):v.toLocaleString('en-US',{maximumFractionDigits:d}):'—';
const sci=v=>Number.isFinite(v)?v.toExponential(3):'—';
const norm=v=>Math.hypot(...v);
const number=(id,label,value,min,max,step='any',unit='')=>`<label class="field"><span>${label}<small>${unit}</small></span><input id="${id}" type="number" required value="${value}" ${min!==null?`min="${min}"`:''} ${max!==null?`max="${max}"`:''} step="${step}" /></label>`;
const slider=(id,label,value,min,max,step,unit='')=>`<label class="range-field"><span>${label}<output id="${id}-value">${value}${unit}</output></span><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" /></label>`;
const toggle=(id,label,checked,sub='')=>`<label class="toggle-field"><span>${label}${sub?`<small>${sub}</small>`:''}</span><input id="${id}" type="checkbox" ${checked?'checked':''}/><i></i></label>`;
const select=(id,label,options)=>`<label class="field"><span>${label}</span><select id="${id}">${options}</select></label>`;
const option=(value,name)=>`<option value="${value}">${name}</option>`;

document.querySelector('#app').innerHTML=`
  <header class="topbar">
    <a class="brand" href="/" aria-label="返回个人网站"><span class="brand-mark">${icon('orbit')}</span><span>COSMOS<span class="brand-light"> LAB</span><small>宇宙引力实验室</small></span></a>
    <div class="header-label"><span class="status-dot"></span> THE SOLAR SYSTEM, IN YOUR HANDS <span class="header-version">01 / EXPLORER</span></div>
    <div class="header-actions"><button id="import" class="text-button" title="导入实验">${icon('upload')}<span>导入</span></button><button id="export" class="text-button" title="导出实验 JSON">${icon('download')}<span>保存实验</span></button><button id="help" class="icon-button" title="物理模型与操作说明">${icon('help')}</button><a class="home-link" href="/">主页 ↗</a></div>
  </header>
  <main class="workspace">
    <aside class="left-panel panel" id="left-panel">
      <div class="panel-heading"><span class="eyebrow">YOUR UNIVERSE</span><span class="tiny-tag">实验台</span></div>
      <div class="section-label">我们的太阳系 <span>SOLAR SYSTEM</span></div>
      <div class="solar-card"><button class="preset active" data-preset="solar"><span class="preset-art preset-art-solar"><i></i><b></b><em></em></span><span><strong>太阳系实验室</strong><small>OUR COSMIC NEIGHBORHOOD</small></span><span class="preset-arrow">↗</span></button><p>一颗恒星，八大行星，一轮月亮。<br/>从每一次引力作用，观察宇宙的秩序。</p><div class="solar-card-footer"><span>J2000 INITIAL STATE</span><span>10 BODIES</span></div></div>
      <nav class="observation-views" aria-label="太阳系观察视角"><button data-view="all" class="active">${icon('orbit')}太阳系全景</button><button data-view="inner">${icon('focus')}内太阳系</button><button data-view="outer">${icon('star')}外太阳系</button><button data-view="moon"><span class="moon-view-icon">◐</span>地月系统</button></nav>
      <button class="scene-settings-link" id="scene-settings">${icon('sliders')} 调整太阳系初始条件 <span>↗</span></button>
      <div class="object-heading"><div><span class="eyebrow">CELESTIAL BODIES</span><h3>天体列表 <span id="body-count">09</span></h3></div><button id="add-body" class="icon-button" title="添加天体">${icon('plus')}</button></div>
      <div class="body-list" id="body-list"></div>
      <div class="sidebar-foot"><span class="status-dot"></span> 每颗天体，都有自己的引力。<small>AU · M☉ · Julian year</small></div>
    </aside>
    <section class="universe">
      <div class="viewport" id="viewport"></div>
      <div class="scene-heading"><div class="eyebrow"><span class="status-dot"></span> LIVE SIMULATION <span id="scene-code">SCENE 01</span></div><h1 id="scene-title">太阳系</h1><p id="scene-description"></p><div class="scene-tags"><span id="gravity-model-badge">广义相对论 · EIH 1PN</span><span id="integrator-badge">Velocity Verlet</span><span id="isolate-badge" hidden>单体观察 · 引力保持</span></div></div>
      <div class="view-toolbar"><button class="icon-button mobile-only" id="toggle-left" title="场景和天体">${icon('list')}</button><button id="view-top" class="tool-button" title="沿 Z 轴俯视">2D</button><button id="view-3d" class="tool-button active" title="三维视角">3D</button><span></span><button id="view-fit" class="icon-button" title="显示所有天体">${icon('expand')}</button><button id="capture" class="icon-button" title="保存画面">${icon('camera')}</button><button class="icon-button mobile-only" id="toggle-right" title="参数设置">${icon('sliders')}</button></div>
      <div class="viewport-note"><span class="crosshair">＋</span><span><span id="coordinate-frame">太阳系谐和坐标</span><small>拖动旋转 · 滚轮缩放 · 右键平移</small></span></div>
      <div class="scale-key"><span id="scale-value">1 AU</span><i></i><small>实心球为真实半径 · 圆环为定位标记</small></div>
      <button id="exit-isolate" class="exit-isolate" hidden>${icon('orbit')} 返回整个系统</button>
      <div id="physics-warning" class="physics-warning" hidden></div>
      <div class="transport">
        <div class="time-controls"><button id="reset" class="icon-button" title="重置当前实验">${icon('reset')}</button><button id="play" class="play-button" title="播放 / 暂停（空格）">${icon('pause')}</button><button id="step" class="icon-button" title="暂停并推进一个物理步">${icon('step')}</button></div>
        <div class="simulation-clock"><span>已演化时间</span><strong id="sim-time">0.000 <small>年</small></strong></div>
        <div class="speed-control"><label for="speed">时间流速 <output id="speed-value">0.5 年/秒</output></label><input type="range" id="speed" min="-8" max="2" step="0.02" value="-0.3"/><div class="speed-scale"><span>10⁻⁸</span><span>0.001</span><span>100 年/秒</span></div></div>
        <div class="running-state"><span class="status-dot"></span><strong id="play-state">演化中</strong><small id="actual-speed">—</small></div>
      </div>
    </section>
    <aside class="right-panel panel" id="right-panel">
      <div class="inspector-tabs" role="tablist"><button class="active" data-tab="body" role="tab">天体</button><button data-tab="physics" role="tab">物理</button><button data-tab="display" role="tab">显示</button></div>
      <div class="inspector-scroll">
        <section id="tab-body" class="tab-content">
          <div class="body-hero"><div id="body-orb" class="body-orb"></div><div><span class="eyebrow">SELECTED OBJECT</span><h2 id="selected-name">地球</h2><span id="body-type">行星</span></div><span id="body-index">03</span></div>
          <div class="body-view-buttons"><button id="isolate-body" class="outline-button">${icon('orbit')} 单独查看</button><button id="follow-body" class="outline-button">${icon('focus')} 跟随</button></div>
          <button id="impact-body" class="outline-button impact-button">${icon('arrow')} 向此天体发射撞击体</button><button id="fall-sun" class="outline-button impact-button">${icon('star')} 让此天体向太阳坠落</button>
          <div class="live-stats"><div><span>速度</span><strong id="body-speed">—</strong><small>km/s</small></div><div><span>平均密度</span><strong id="body-density">—</strong><small>kg/m³</small></div></div>
          <form id="body-form">
            <div class="section-label">基本属性 <span>PROPERTIES</span></div>
            <div class="name-color"><label class="field"><span>名称</span><input id="body-name" type="text" maxlength="36" required/></label><label class="field color-field"><span>颜色</span><input id="body-color" type="color"/></label></div>
            ${number('body-mass','质量',1,1e-15,null,'any','M☉')}
            ${number('body-radius','实际半径',1,0,null,'any','km')}
            <p class="field-hint">质量与半径独立设置。只改质量时，体积保持不变，平均密度随之变化。碰撞按实际半径判断。</p>
            <button type="button" id="edit-orbit" class="outline-button orbit-edit-button">${icon('orbit')} 用轨道六根数设置此天体</button>
            <div class="section-label">空间位置 <span>AU</span></div>
            <div class="vector-fields">${['x','y','z'].map(k=>number(`body-p${k}`,k.toUpperCase(),0,null,null)).join('')}</div>
            <div class="section-label">速度向量 <span>AU / 年</span></div>
            <div class="vector-fields">${['x','y','z'].map(k=>number(`body-v${k}`,'V'+k.toUpperCase(),0,null,null)).join('')}</div>
            <p class="field-hint">1 AU/年 ≈ 4.74047 km/s。修改时暂停，应用后继续操作。</p>
            <button type="submit" id="apply-body" class="primary-button">应用天体参数 ${icon('arrow')}</button>
          </form>
          <div class="relativity-readout"><span>外场时钟速率 dτ/dt</span><strong id="body-clock">—</strong><small>相对坐标时间的一阶估计，不含自身引力势</small><span>史瓦西半径（参照值）</span><strong id="body-schwarzschild">—</strong><small>只作相对论尺度参照，不改变天体实际半径</small></div><div class="orbital-readout"><div class="section-label">相对主天体的瞬时轨道 <span>KEPLER</span></div><div><span>半长轴</span><strong id="orbit-a">—</strong></div><div><span>偏心率</span><strong id="orbit-e">—</strong></div><div><span>倾角</span><strong id="orbit-i">—</strong></div><div><span>二体估算周期</span><strong id="orbit-period">—</strong></div><p class="field-hint">瞬时二体近似；其他天体的扰动会改变轨道。</p></div>
          <button id="delete-body" class="danger-button">移除此天体</button>
        </section>
        <section id="tab-physics" class="tab-content" hidden>
          <div class="section-label">引力与积分 <span>DYNAMICS</span></div>
          ${select('gravity-model','引力模型',option('gr1pn','广义相对论 · EIH 1PN 弱场')+option('newtonian','牛顿引力 · 对照实验'))}
          <p class="field-hint" id="gr-description">全体天体的 1PN 速度项与引力势耦合；光速固定为 299,792.458 km/s。近似适用于弱场慢速，不求解完整爱因斯坦场方程或黑洞合并。</p>
          <div class="relativity-readout"><span>当前相对论参数</span><strong id="pn-parameter">—</strong><small>max(v²/c², U/c²)；≥ 0.01 时停止</small></div>
          ${number('gravity','引力常数倍率',1,0,1000,'any','× G')}
          <p class="field-hint">标准 G = ${G?.toFixed(6)} AU³ / (M☉ · 年²)。倍率改变物理系统。</p>
          ${select('integrator','积分算法',option('verlet','Velocity Verlet · 二阶辛积分')+option('rk4','Runge–Kutta 4 · 四阶'))}
          ${number('timestep','请求物理步长',.0005,1e-8,1,'any','年')}
          <p class="field-hint" id="step-hint">减小步长可提高近距离交会精度。</p>
          <div class="precision-presets"><button data-dt="0.00005">精细</button><button data-dt="0.0005">标准</button><button data-dt="0.005">快速</button></div>
          ${number('softening','引力软化长度 ε',0,0,100,'any','AU')}
          <p class="field-hint">ε = 0 为标准点质量引力；ε &gt; 0 使用 Plummer 软化，同时修正势能。它改变近距离物理。</p>
          <div class="section-label">天体接触 <span>COLLISIONS</span></div>
          ${select('collision-mode','碰撞处理',option('fragment','合并 / 碎裂 · 引力聚合体近似')+option('merge','始终合并 · 非弹性碰撞')+option('elastic','硬球接触 · 可调恢复系数')+option('none','关闭碰撞 · 允许穿越'))}
          ${slider('restitution','恢复系数 e',1,0,1,.01)}
          ${number('disruption-threshold','碎裂阈值倍率',1,.1,10,.1,'× 束缚能')}
          ${number('fragment-count','高能碰撞碎片数',6,2,12,1)}
          <p class="field-hint">碰撞默认开启。低能接触合并，高能接触可产生真实引力碎块，恒星可吸收撞击体。碎裂为能量约束下的引力聚合体近似，不包含真实材料与流体。</p>
          <div class="section-label">最近碰撞 <span id="destruction-count">0 次毁坏</span></div><div id="collision-log" class="collision-log">尚未发生碰撞。可在天体面板发射撞击体。</div>
          <div class="model-note"><span class="status-dot"></span><strong>物理模型有清晰边界</strong><p>直接计算每对天体的引力，使用真实单位。默认 EIH 1PN 含广义相对论弱场修正；接触仍为低速聚合体近似，不模拟冲击流体、引力波或黑洞内部。</p><button id="physics-help" class="inline-link">查看公式与数值说明 ↗</button></div>
        </section>
        <section id="tab-display" class="tab-content" hidden>
          <div class="section-label">观察方式 <span>OBSERVATION</span></div>
          ${toggle('show-trails','运动轨迹',true,'记录数值积分得到的位置')}
          ${toggle('show-references','初始参考轨道',true,'太阳系预设的二体椭圆参考')}
          ${toggle('show-labels','天体名称',true)}
          ${toggle('show-grid','坐标网格',true,'参考平面 z = 0')}
          ${toggle('show-vectors','速度方向',false,'箭头长度为辅助显示尺度')}
          ${toggle('show-markers','显示天体定位标记',true,'空心圆环用于定位，不代表球体或碰撞边界')}
          ${toggle('collision-bounds','实际碰撞边界',false,'线框球半径与碰撞计算一致')}
          ${slider('trail-length','轨迹采样点数',900,60,2400,60)}
          ${slider('body-scale','定位标记大小',1,.4,4,.1,'×')}
          <p class="field-hint">实心球面始终采用实际半径。小天体用空心圆环辅助定位；放大镜头可查看表面。单独查看会移动镜头，不改变天体大小。</p>
          <div class="section-label">画面操作 <span>CAMERA</span></div>
          <button id="clear-trails" class="outline-button wide">清除历史轨迹</button><button id="fullscreen" class="outline-button wide">${icon('expand')} 全屏实验室</button>
          <div class="keyboard-guide"><span>空格</span><p>播放 / 暂停</p><span>R</span><p>重置当前实验</p><span>F</span><p>显示全部天体</p><span>Esc</span><p>退出单体观察</p></div>
        </section>
      </div>
      <div class="inspector-footer"><span class="status-dot"></span> 可编辑的宇宙，可测量的结果。</div>
    </aside>
    <section class="telemetry"><div class="telemetry-title"><span class="eyebrow">CONSERVATION</span><strong>守恒量观测</strong><span id="energy-status">数值稳定</span></div><div class="energy-chart"><div><span>碰撞校正后相对能量变化</span><strong id="energy-error">0.0000%</strong></div><canvas id="energy-chart"></canvas><div class="chart-labels"><span>较早</span><span id="energy-range">±0.0001%</span><span>现在</span></div></div><div class="telemetry-numbers"><div><span>机械能 E</span><strong id="total-energy">—</strong><small>M☉ · AU²/年²</small></div><div><span>总动量 |P|（1PN 含场项）</span><strong id="total-momentum">—</strong><small>M☉ · AU/年</small></div><div><span>总角动量 |L|（含 spin）</span><strong id="total-angular">—</strong><small>M☉ · AU²/年</small></div><div><span>碰撞 / 能量交换</span><strong id="collision-count">0</strong><small id="collision-energy">0.000</small></div></div></section>
  </main>
  <dialog id="help-dialog" class="modal help-modal"><button class="modal-close icon-button" data-close>${icon('close')}</button><span class="eyebrow">GENERAL RELATIVITY · 1PN</span><h2>太阳系的广义相对论弱场模拟</h2><p>默认使用谐和坐标下的 Einstein–Infeld–Hoffmann（EIH）一阶后牛顿方程。全部天体参与速度相关项和引力势耦合，太阳也会运动。</p><div class="formula">a = aₙ + a₁ᴾᴺ　　·　　c = 299,792.458 km/s</div><div class="help-columns"><section><h3>模型与积分</h3><p>这是广义相对论的弱场慢速近似，保留到 1/c² 阶；不是完整爱因斯坦场方程求解器。采用对速度相关力适用的 RK4，各中间阶段重新计算位置和速度。牛顿模式可用于同初值对照。</p><p>能量、正则动量和总角动量使用同阶 EIH 表达式。近日点进动可与 6πGM / [a(1−e²)c²] 比较；极小能量误差不保证任意长期星历精度。</p></section><section><h3>质量与体积</h3><p>质量和实际半径是独立参数。只改质量只改变密度与引力，不重设半径，也不会自动把行星画成恒星。表面球体与碰撞球体大小一致；空心圆环是定位标记。</p><p>单独查看通过移动镜头放大天体。史瓦西半径仅作参照值，不会自动替换实际半径。外场时钟速率不含该天体自身引力势。</p></section><section><h3>碰撞与碎裂</h3><p>修改位置或半径造成重叠时，即使暂停也会立即处理接触。运动中查找子步内最早接触，再推进剩余时间。立体投影重叠和定位标记重叠不代表球面相交。</p><p>接触采用低速引力聚合体近似：合并、反弹、吸收或有限能量碎裂。碎片继续受引力；碰撞后的正则动量匹配到幸存体，未解析角动量存入 spin。该模型不求解材料断裂、冲击波或相对论流体。</p></section><section><h3>适用边界</h3><p>保留 1PN 保守项，未包含高阶 PN、引力波辐射、黑洞合并、潮汐形变、流体和旋转耦合。初态仍为 JPL J2000 近似轨道元素与教学月球相位，并非实时精密星历。</p><p>当 v²/c²、外场 U/c² 或有限球体 GM/(Rc²) 达到 0.01 时暂停，明确提示超出本模型范围。物理半径保持用户设置，不用自动改变体积掩盖失效。</p></section></div><div class="source-links"><a href="https://fiteoweb.unige.ch/~maggiore/GWVol1/EIHLagrangian.pdf" target="_blank" rel="noreferrer">EIH 方程与作用量 ↗</a><a href="https://ssd.jpl.nasa.gov/astro_par.html" target="_blank" rel="noreferrer">JPL · 天文常数 ↗</a><a href="./SCIENCE.md" target="_blank">完整物理说明 ↗</a><a href="./TEXTURE-CREDITS.md" target="_blank">纹理署名 ↗</a></div></dialog>
  <dialog id="scene-dialog" class="modal"><button class="modal-close icon-button" data-close>${icon('close')}</button><span class="eyebrow">INITIAL CONDITIONS</span><h2>构造你的实验</h2><p id="scene-settings-description"></p><form id="scene-form"><div class="form-grid">${number('initial-count','星团天体数',64,8,160,1)}${number('initial-seed','随机种子',42,0,2147483647,1)}${number('initial-eccentricity','轨道偏心率',0,0,.9,.01)}${number('initial-separation','双星半长轴 / 间距',2,.05,100,'any','AU')}${number('initial-mass-ratio','双星质量比',.7,.01,10,.01)}${number('initial-velocity-scale','初始速度倍率',1,0,5,.05)}${number('initial-inclination','轨道倾角',0,0,180,1,'°')}${number('initial-virial-ratio','星团维里比 K / |U|',.5,0,2,.05)}</div><p class="field-hint" id="initial-scope"></p><button class="primary-button" type="submit">重新生成当前场景 ${icon('arrow')}</button></form></dialog>
  <dialog id="add-dialog" class="modal"><button class="modal-close icon-button" data-close>${icon('close')}</button><span class="eyebrow">CREATE A CELESTIAL BODY</span><h2>向宇宙中，添加一颗天体。</h2><form id="add-form"><div class="form-grid"><label class="field"><span>名称</span><input id="new-name" value="新行星" required maxlength="36"/></label><label class="field"><span>颜色</span><input type="color" id="new-color" value="#9ddfd3"/></label>${number('new-mass','质量',.000003,1e-15,null,'any','M☉')}${number('new-radius','实际半径',6371,0,null,'any','km')}</div>${select('new-method','初始状态',option('orbit','根据开普勒轨道参数生成')+option('manual','直接设置三维位置与速度'))}<div id="new-orbit-fields">${select('new-parent','环绕主天体','')}<div class="form-grid">${number('new-a','半长轴 a',1.5,.00001,null,'any','AU')}${number('new-e','偏心率 e',.1,0,.99,.01)}${number('new-i','轨道倾角 i',10,0,180,1,'°')}${number('new-node','升交点经度 Ω',0,0,360,1,'°')}${number('new-peri','近心点幅角 ω',0,0,360,1,'°')}${number('new-phase','真近点角 ν',0,0,360,1,'°')}</div><p class="field-hint">按主天体与新天体总质量计算相对开普勒速度；为保持原系统的总线动量，添加后整体重置质心速度。</p></div><div id="new-manual-fields" hidden><div class="section-label">位置 <span>AU</span></div><div class="vector-fields">${['x','y','z'].map(k=>number(`new-p${k}`,k,0,null,null)).join('')}</div><div class="section-label">速度 <span>AU / 年</span></div><div class="vector-fields">${['x','y','z'].map(k=>number(`new-v${k}`,k,0,null,null)).join('')}</div></div><button class="primary-button" type="submit">创建天体 ${icon('plus')}</button></form></dialog>
  <input type="file" id="import-file" accept="application/json,.json" hidden/>
  <div class="toast" id="toast" role="status" hidden></div>
`;

document.body.insertAdjacentHTML('beforeend',`<dialog id="orbit-dialog" class="modal"><button class="modal-close icon-button" id="orbit-close">${icon('close')}</button><span class="eyebrow">ORBITAL ELEMENTS</span><h2 id="orbit-edit-title">编辑天体轨道</h2><p>从当前状态计算瞬时二体轨道。应用后，位置和速度由六个参数重新计算，其他天体将继续对它施加引力。</p><form id="orbit-form">${select('edit-parent','参考主天体','')}<div class="form-grid">${number('edit-a','半长轴 a',1,.0000001,null,'any','AU')}${number('edit-e','偏心率 e',.1,0,.999,.001)}${number('edit-i','轨道倾角 i',0,0,180,'any','°')}${number('edit-node','升交点经度 Ω',0,0,360,'any','°')}${number('edit-peri','近心点幅角 ω',0,0,360,'any','°')}${number('edit-nu','真近点角 ν',0,0,360,'any','°')}</div><p class="field-hint">此编辑器生成束缚椭圆轨道（0 ≤ e &lt; 1）。改变轨道会改变系统能量和动量，应用后重新记录守恒参考点。</p><button class="primary-button" type="submit">应用轨道参数 ${icon('arrow')}</button></form></dialog>`);

const mobileMedia=matchMedia('(max-width: 960px), (max-width: 1180px) and (pointer: coarse)');
document.body.insertAdjacentHTML('beforeend',`<dialog id="impact-dialog" class="modal"><button class="modal-close icon-button" id="impact-close">${icon('close')}</button><span class="eyebrow">COLLISION EXPERIMENT</span><h2 id="impact-title">发射撞击体</h2><p>在目标附近生成一个真正参与引力计算的撞击体。根据碰撞能量，观察合并、吸收或碎裂。</p><form id="impact-form">${number('impact-mass','撞击体质量 / 目标质量',15,.1,100, .1,'%')}${number('impact-radius','撞击体实际半径',3000,0.001,null,'any','km')}${number('impact-speed','初始相对速度',50,.01,1000,'any','km/s')}${number('impact-offset','偏移量 / 接触半径',.15,0,2,.05)}<p class="field-hint">0 为正面相撞，大于 1 可能掠过。撞击体的质量和半径独立设置，修改质量不会改变体积。发射时会靠近镜头、显示碰撞边界，并放慢演化以观察接触过程；底部重置可恢复初始太阳系。</p><button class="primary-button" type="submit">发射并观察 ${icon('arrow')}</button></form></dialog>`);
document.body.insertAdjacentHTML('beforeend',`<button id="panel-backdrop" aria-label="关闭面板" hidden></button><nav class="mobile-nav" aria-label="实验室导航"><button id="mobile-bodies" data-mobile-panel="left" aria-controls="left-panel" aria-expanded="false">${icon('list')}<span>天体</span></button><button id="mobile-parameters" data-mobile-panel="right" data-mobile-tab="body" aria-controls="right-panel" aria-expanded="false">${icon('sliders')}<span>参数</span></button><button id="mobile-display" data-mobile-panel="right" data-mobile-tab="display" aria-controls="right-panel" aria-expanded="false">${icon('focus')}<span>显示</span></button><button id="mobile-data" data-mobile-panel="stats" aria-controls="telemetry" aria-expanded="false">${icon('orbit')}<span>数据</span></button></nav>`);
$('.telemetry').id='telemetry';
const mobilePanels={left:$('#left-panel'),right:$('#right-panel'),stats:$('.telemetry')};
for(const [key,panel] of Object.entries(mobilePanels)){
  panel.insertAdjacentHTML('afterbegin',`<div class="mobile-sheet-heading"><strong>${key==='left'?'天体与视角':key==='right'?'天体参数':'守恒量观测'}</strong><button class="icon-button sheet-close" aria-label="关闭${key==='left'?'天体列表':key==='right'?'参数面板':'数据面板'}">${icon('close')}</button></div>`);
  panel.querySelector('.sheet-close').onclick=()=>closeMobilePanels();
}
$('.inspector-footer').insertAdjacentHTML('beforebegin',`<div class="mobile-applybar" hidden><button type="button" class="outline-button" id="mobile-back">返回观察</button><button type="submit" form="body-form" class="primary-button" id="mobile-apply" disabled>应用参数 ${icon('arrow')}</button></div>`);
$('#mobile-back').onclick=()=>closeMobilePanels();
let mobilePanel=null, mobilePanelTab='body';
function closeMobilePanels(){
  mobilePanel=null;
  Object.values(mobilePanels).forEach(panel=>panel.classList.remove('mobile-open'));
  $('#panel-backdrop').hidden=true;document.body.classList.remove('mobile-panel-open');
  document.querySelectorAll('[data-mobile-panel]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-expanded','false');});
  if(mobileMedia.matches){mobilePanels.left.inert=true;mobilePanels.right.inert=true;}
  document.activeElement?.blur();
}
function openMobilePanel(key,tab='body'){
  closeMobilePanels();if(!mobileMedia.matches)return;
  mobilePanel=key;mobilePanelTab=tab;const panel=mobilePanels[key];
  panel.inert=false;panel.classList.add('mobile-open');$('#panel-backdrop').hidden=false;document.body.classList.add('mobile-panel-open');
  if(key==='right')switchTab(tab);
  document.querySelectorAll('[data-mobile-panel]').forEach(b=>{const active=b.dataset.mobilePanel===key&&(key!=='right'||(tab==='display')===(b.dataset.mobileTab==='display'));b.classList.toggle('active',active);b.setAttribute('aria-expanded',String(active));});
}
$('#panel-backdrop').onclick=()=>closeMobilePanels();
document.querySelectorAll('[data-mobile-panel]').forEach(b=>b.onclick=()=>{const key=b.dataset.mobilePanel,tab=b.dataset.mobileTab||'body';if(mobilePanel===key&&(key!=='right'||mobilePanelTab===tab))closeMobilePanels();else openMobilePanel(key,tab);});
function updateMobileViewport(){
  document.documentElement.style.setProperty('--app-height',`${Math.round(window.visualViewport?.height||innerHeight)}px`);
  if(mobileMedia.matches){mobilePanels.left.inert=mobilePanel!=='left';mobilePanels.right.inert=mobilePanel!=='right';}
  else{closeMobilePanels();mobilePanels.left.inert=false;mobilePanels.right.inert=false;}
  $('.viewport-note small').textContent=mobileMedia.matches?'单指旋转 · 双指缩放与平移':'拖动旋转 · 滚轮缩放 · 右键平移';
}
window.visualViewport?.addEventListener('resize',updateMobileViewport);
window.addEventListener('resize',updateMobileViewport);mobileMedia.addEventListener('change',updateMobileViewport);updateMobileViewport();
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&mobilePanel&&!document.querySelector('dialog[open]'))closeMobilePanels();});

let engine, selectedId, currentPreset='solar', initialOptions={}, running=true, dirty=false, speed=.5, initialState;
let energyHistory=[], lastTelemetry=0, lastWall=performance.now(), simAccum=0, frameCount=0, realWindow=0, simWindow=0, actualSpeed=0;
let isolated=false, resetKind='preset', lastError='';
let seenCollisionEvents=new Set();
const editedBodyFields=new Set();
const view=new UniverseView($('#viewport'),selectBody);
const toast=message=>{$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,4200);};
function setRunning(value){running=value;$('#play').innerHTML=icon(running?'pause':'play');$('#play-state').textContent=running?'演化中':'已暂停';$('.running-state').classList.toggle('paused',!running);simAccum=0;}
function switchTab(id){document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===id);b.setAttribute('aria-selected',b.dataset.tab===id);});document.querySelectorAll('.tab-content').forEach(el=>el.hidden=el.id!==`tab-${id}`);$('.mobile-applybar').hidden=id!=='body';mobilePanelTab=id;}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
function resetEnergy(){engine.resetReference();energyHistory=[];view.clearTrails();view.recordStep(engine.bodies,engine.time);simAccum=0;}
function consumeCollisionEvents(){
  const events=engine.events??[],fresh=events.filter(event=>!seenCollisionEvents.has(event.id));
  if(!fresh.length)return;
  seenCollisionEvents=new Set(events.map(event=>event.id));view.addCollisionEvents(fresh);$('#collision-count').textContent=String(engine.collisionCount);
  $('#collision-log').replaceChildren(...events.slice(-5).reverse().map(event=>{
    const row=document.createElement('p');row.textContent=`${event.names.join(' + ')} · ${event.type==='fragment'?`碎裂 → ${event.resultIds.length} 个碎块`:event.type==='bounce'?'反弹':'合并 / 吸收'}`;return row;
  }));
  $('#destruction-count').textContent=`${engine.destroyedCount??0} 个天体毁坏`;
  if(!getSelected()){
    const result=fresh.at(-1).resultIds.map(id=>engine.bodies.find(b=>b.id===id)).find(Boolean);
    if(result){if(view.followId===selectedId)view.followId=result.id;selectBody(result.id);}
  }
  const last=fresh.at(-1);toast(`${last.names.join(' + ')}：${last.type==='fragment'?'撞击碎裂':last.type==='bounce'?'碰撞反弹':'合并 / 吸收'}`);
}
function setSpeed(value){speed=value;$('#speed').value=Math.log10(speed);$('#speed-value').textContent=speed<.001?`${fmt(speed*365.25*86400,2)} 秒/秒`:`${fmt(speed,3)} 年/秒`;}
function syncPhysicsInputs(){
  const gr=engine.params.gravityModel==='gr1pn';$('#coordinate-frame').textContent=gr?'太阳系谐和坐标':'惯性坐标';$('#gravity-model').value=engine.params.gravityModel;$('#gravity-model-badge').textContent=gr?'广义相对论 · EIH 1PN':'牛顿引力 · 对照';$('#integrator').disabled=gr;$('#softening').disabled=gr;$('#gr-description').hidden=!gr;
  $('#gravity').value=engine.params.gravityScale;$('#integrator').value=engine.params.integrator;$('#timestep').value=engine.params.dt;$('#softening').value=engine.params.softening;$('#collision-mode').value=engine.params.collisionMode;$('#restitution').value=engine.params.restitution;
  $('#restitution').disabled=engine.params.collisionMode!=='elastic';$('#restitution-value').textContent=engine.params.restitution;
  $('#disruption-threshold').value=engine.params.disruptionThreshold??1;$('#fragment-count').value=engine.params.fragmentCount??6;
  $('#disruption-threshold').disabled=engine.params.collisionMode!=='fragment';$('#fragment-count').disabled=engine.params.collisionMode!=='fragment';
  $('#integrator-badge').textContent=engine.params.integrator==='verlet'?'Velocity Verlet':'Runge–Kutta 4';
}
function loadPreset(id,options={}){
  const p=createPreset(id,options);currentPreset=id;initialOptions={...options};resetKind='preset';
  engine=new PhysicsEngine(p.bodies,p.params);engine.bodies.forEach(b=>b.originalColor=b.color);initialState=structuredClone({bodies:engine.bodies,params:engine.params});
  const meta=PRESETS.find(v=>v.id===id);$('#scene-title').textContent=meta.name;$('#scene-description').textContent=p.description||meta.description;
  $('#scene-code').textContent=`SCENE 0${PRESETS.indexOf(meta)+1}`;document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===id));
  isolated=false;view.settings.isolateId=null;$('#exit-isolate').hidden=true;$('#isolate-badge').hidden=true;
  view.settings.markers=true;view.settings.showCollisionBounds=false;$('#show-markers').checked=true;$('#collision-bounds').checked=false;
  view.sync([]);view.frame(id==='solar'?33:p.viewScale||meta.scale||6);view.clearTrails();view.recordStep(engine.bodies,engine.time);energyHistory=[];seenCollisionEvents.clear();$('#collision-log').textContent='尚未发生碰撞。可在天体面板发射撞击体。';$('#destruction-count').textContent='0 个天体毁坏';
  setSpeed(p.speed||meta.speed||.5);setRunning(true);dirty=false;
  syncPhysicsInputs();refreshList();selectBody((engine.bodies.find(b=>b.name==='地球')||engine.bodies[0]).id);lastError='';
  if(mobileMedia.matches)closeMobilePanels();
}
function refreshList(){
  $('#body-count').textContent=String(engine.bodies.length).padStart(2,'0');
  $('#body-list').replaceChildren(...engine.bodies.map((b,i)=>{
    const button=document.createElement('button');button.className='body-list-item';button.dataset.id=b.id;
    const dot=document.createElement('i');dot.style.background=b.color;dot.style.boxShadow=`0 0 12px ${b.color}30`;
    const name=document.createElement('span');name.textContent=b.name;
    const mass=document.createElement('small');mass.textContent=fmt(b.mass,3);
    const index=document.createElement('b');index.textContent=String(i+1).padStart(2,'0');
    button.append(index,dot,name,mass);button.onclick=()=>{selectBody(b.id);if(mobileMedia.matches)openMobilePanel('right','body');};return button;
  }));
}
function getSelected(){return engine.bodies.find(b=>b.id===selectedId);}
function selectBody(id){
  selectedId=id;dirty=false;editedBodyFields.clear();view.select(id);const b=getSelected();if(!b)return;
  document.querySelectorAll('.body-list-item').forEach(el=>el.classList.toggle('selected',el.dataset.id===String(id)));
  $('#selected-name').textContent=b.name;$('#body-type').textContent=b.isFragment?'碰撞碎片 · 引力聚合体':b.id==='moon'?'天然卫星 · 地球':b.mass>=.08?'恒星质量天体':b.mass>=1e-7?'行星质量天体':'小质量天体';
  $('#fall-sun').disabled=b.id==='sun'||engine.params.gravityScale===0||!engine.bodies.some(x=>x.id==='sun');
  $('#body-index').textContent=String(engine.bodies.indexOf(b)+1).padStart(2,'0');$('#body-orb').style.setProperty('--orb-color',b.color);
  $('#body-orb').style.backgroundImage=textureUrls[b.id]?`radial-gradient(circle at 30% 28%,transparent 30%,#010910c9 90%),url("${textureUrls[b.id]}")`:'';
  $('#body-orb').style.backgroundSize='auto 100%';
  $('#body-name').value=b.name;$('#body-color').value=b.color;$('#body-mass').value=b.mass;$('#body-radius').value=b.radius*AU_KM;
  syncBodyFields(b);$('#apply-body').classList.remove('pending');$('#mobile-apply').disabled=true;$('#mobile-parameters').setAttribute('aria-label',`${b.name}的参数`);switchTab('body');
  if(isolated){view.settings.isolateId=id;view.focus(b,true);setSceneHeading(b);}
}
function syncBodyFields(b){['x','y','z'].forEach((k,i)=>{$(`#body-p${k}`).value=+b.position[i].toPrecision(9);$(`#body-v${k}`).value=+b.velocity[i].toPrecision(9);});}
function setSceneHeading(b){$('#scene-title').textContent=b?b.name:resetKind==='preset'?'太阳系':'我的宇宙';$('#scene-description').textContent=b?'单独观察此天体。其他天体的引力保持参与，右侧可编辑其物理属性与轨道。':resetKind==='preset'?PRESETS[0].description:'从保存的天体状态继续实验。导入点作为新的能量参考。';}
function exitIsolate(){isolated=false;view.settings.isolateId=null;$('#exit-isolate').hidden=true;$('#isolate-badge').hidden=true;setSceneHeading();fitAll();}
function fitAll(){
  const d=engine.diagnostics();const scale=Math.max(.1,...engine.bodies.map(b=>Math.hypot(...b.position.map((v,i)=>v-d.com[i]))))*1.15;
  view.frame(scale);view.controls.target.fromArray(d.com);view.camera.position.add(view.controls.target);
  $('#view-3d').classList.add('active');$('#view-top').classList.remove('active');
}
function modifyPhysics(input,key,{reference=false}={}){
  const el=$(input);const value=el.tagName==='SELECT'?el.value:Number(el.value);
  if(!el.checkValidity()||typeof value==='number'&&!Number.isFinite(value)){el.reportValidity();return;}
  engine.params[key]=value;if(reference){resetEnergy();toast('物理参数已更新，开始新的守恒量参考段。');}syncPhysicsInputs();
}
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>loadPreset(b.dataset.preset));
$('#play').onclick=()=>setRunning(!running);$('#step').onclick=()=>{setRunning(false);try{engine.step();view.recordStep(engine.bodies,engine.time);consumeCollisionEvents();refreshList();if(!getSelected())selectBody(engine.bodies[0].id);else selectBody(selectedId);view.sync(engine.bodies);updateTelemetry(performance.now(),true);}catch(error){lastError=error.message;$('#physics-warning').textContent=`模拟已暂停：${error.message}`;$('#physics-warning').hidden=false;}};
$('#reset').onclick=()=>{if(resetKind==='preset')loadPreset(currentPreset,initialOptions);else restoreSnapshot(initialState);toast('实验已重置。');};
$('#speed').oninput=e=>setSpeed(10**Number(e.target.value));
$('#gravity').onchange=()=>modifyPhysics('#gravity','gravityScale',{reference:true});$('#softening').onchange=()=>modifyPhysics('#softening','softening',{reference:true});
$('#gravity-model').onchange=()=>{engine.params.gravityModel=$('#gravity-model').value;if(engine.params.gravityModel==='gr1pn'){engine.params.integrator='rk4';engine.params.softening=0;}lastError='';resetEnergy();syncPhysicsInputs();};
$('#integrator').onchange=()=>modifyPhysics('#integrator','integrator');$('#timestep').onchange=()=>modifyPhysics('#timestep','dt');
$('#collision-mode').onchange=()=>modifyPhysics('#collision-mode','collisionMode',{reference:true});$('#restitution').oninput=()=>modifyPhysics('#restitution','restitution');
$('#disruption-threshold').onchange=()=>modifyPhysics('#disruption-threshold','disruptionThreshold');$('#fragment-count').onchange=()=>modifyPhysics('#fragment-count','fragmentCount');
document.querySelectorAll('[data-dt]').forEach(b=>b.onclick=()=>{$('#timestep').value=b.dataset.dt;modifyPhysics('#timestep','dt');});
$('#body-form').addEventListener('input',event=>{editedBodyFields.add(event.target.id);dirty=true;setRunning(false);$('#apply-body').classList.add('pending');$('#mobile-apply').disabled=false;});
$('#body-form').onsubmit=e=>{
  e.preventDefault();const b=getSelected();if(!b)return;
  if(editedBodyFields.has('body-name'))b.name=$('#body-name').value.trim()||'未命名天体';
  if(editedBodyFields.has('body-color'))b.color=$('#body-color').value;
  if(editedBodyFields.has('body-mass'))b.mass=+$('#body-mass').value;
  if(editedBodyFields.has('body-radius'))b.radius=+$('#body-radius').value/AU_KM;
  ['x','y','z'].forEach((k,i)=>{if(editedBodyFields.has(`body-p${k}`))b.position[i]=+$(`#body-p${k}`).value;if(editedBodyFields.has(`body-v${k}`))b.velocity[i]=+$(`#body-v${k}`).value;});
  b.referenceOrbit=undefined;view.sync([]);dirty=false;lastError='';resetEnergy();
  engine.resolveContacts();consumeCollisionEvents();refreshList();selectBody(engine.bodies.some(x=>x.id===b.id)?b.id:engine.bodies[0].id);view.sync(engine.bodies);updateTelemetry(performance.now(),true);
  if(mobileMedia.matches)closeMobilePanels();toast('已应用修改；半径仅在编辑半径时变化，重叠天体已处理接触。');
};
$('#isolate-body').onclick=()=>{const b=getSelected();if(!b)return;isolated=true;view.settings.isolateId=b.id;view.focus(b,true);setSceneHeading(b);$('#exit-isolate').hidden=false;$('#isolate-badge').hidden=false;if(mobileMedia.matches)closeMobilePanels();};
$('#follow-body').onclick=()=>{view.focus(getSelected());if(mobileMedia.matches)closeMobilePanels();toast(`镜头跟随 ${getSelected().name}`);};
$('#exit-isolate').onclick=exitIsolate;
$('#delete-body').onclick=()=>{
  if(engine.bodies.length===1){toast('实验至少保留一个天体。');return;}
  const name=getSelected().name;engine.bodies=engine.bodies.filter(b=>b.id!==selectedId);resetEnergy();refreshList();selectBody(engine.bodies[0].id);toast(`已移除 ${name}，引力系统已更新。`);
};
const displayBindings={'show-trails':'trails','show-references':'references','show-labels':'labels','show-grid':'grid','show-vectors':'vectors','show-markers':'markers','collision-bounds':'showCollisionBounds'};
$('#impact-close').onclick=()=>$('#impact-dialog').close();
$('#impact-body').onclick=()=>{
  const target=getSelected();
  if(target.radius<=0){toast('先设置非零实际半径，再进行接触撞击实验。');return;}
  setRunning(false);$('#impact-radius').value=target.radius*AU_KM/2;$('#impact-title').textContent=`撞击「${target.name}」`;$('#impact-dialog').showModal();
};
$('#impact-form').onsubmit=event=>{
  event.preventDefault();const target=getSelected(),ratio=+$('#impact-mass').value/100,velocity=+$('#impact-speed').value/V_KMS;
  const radius=+$('#impact-radius').value/AU_KM,contactRadius=target.radius+radius,distance=contactRadius*7;
  const impactor={id:crypto.randomUUID(),name:`${target.name}撞击体`,mass:target.mass*ratio,radius,color:'#ffab79',position:target.position.map((x,i)=>x+(i===0?distance:i===1?contactRadius*+$('#impact-offset').value:0)),velocity:target.velocity.map((v,i)=>v-(i===0?velocity:0)),spin:[0,0,0],parentId:target.id};
  engine.bodies.push(impactor);engine.params.collisionMode='fragment';
  const flightTime=distance/velocity;engine.params.dt=Math.max(1e-8,Math.min(engine.params.dt,flightTime/240));
  resetEnergy();syncPhysicsInputs();refreshList();selectBody(target.id);
  isolated=false;view.settings.isolateId=null;$('#exit-isolate').hidden=true;$('#isolate-badge').hidden=true;
  view.settings.markers=false;view.settings.showCollisionBounds=true;$('#show-markers').checked=false;$('#collision-bounds').checked=true;
  view.frame(distance*1.1);view.controls.target.fromArray(target.position);view.camera.position.add(view.controls.target);view.followId=target.id;
  $('#scene-title').textContent=`${target.name} · 撞击实验`;$('#scene-description').textContent='按实际物理半径观察接触；碰撞结果由动力学与简化碎裂模型计算。';
  setSpeed(Math.max(1e-8,Math.min(100,flightTime/5)));$('#impact-dialog').close();if(mobileMedia.matches)closeMobilePanels();setRunning(true);
};
$('#fall-sun').onclick=()=>{
  const target=getSelected(),sun=engine.bodies.find(b=>b.id==='sun');
  if(engine.params.gravityScale===0){toast('自由落体需要非零引力。');return;}
  target.velocity=[...sun.velocity];delete target.referenceOrbit;delete target.orbitalElements;
  engine.params.collisionMode='fragment';
  resetEnergy();engine.resolveContacts();consumeCollisionEvents();
  if(!engine.bodies.includes(target)){refreshList();selectBody(sun.id);view.sync(engine.bodies);updateTelemetry(performance.now(),true);return;}
  const distance=norm(target.position.map((x,i)=>x-sun.position[i]));
  const fallTime=Math.PI/(2*Math.sqrt(2))*Math.sqrt(distance**3/(G*engine.params.gravityScale*(sun.mass+target.mass)));
  engine.params.dt=Math.min(engine.params.dt,fallTime/1000);
  resetEnergy();engine.resolveContacts();consumeCollisionEvents();syncPhysicsInputs();refreshList();selectBody(engine.bodies.some(b=>b.id===target.id)?target.id:sun.id);
  isolated=false;view.settings.isolateId=null;$('#exit-isolate').hidden=true;$('#isolate-badge').hidden=true;
  view.frame(Math.max(distance,sun.radius*10));view.controls.target.fromArray(sun.position);view.camera.position.add(view.controls.target);view.followId=sun.id;
  $('#scene-title').textContent=`${target.name} → 太阳`;$('#scene-description').textContent='移除相对太阳的初始速度，质量与体积保持不变，随后由引力决定是否接触。';
  setSpeed(Math.max(1e-8,Math.min(100,fallTime/8)));if(mobileMedia.matches)closeMobilePanels();setRunning(true);toast('已移除相对太阳的初始速度；质量和实际半径保持不变。');
};
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{
  isolated=false;view.settings.isolateId=null;$('#exit-isolate').hidden=true;$('#isolate-badge').hidden=true;setSceneHeading();
  const mode=button.dataset.view;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b===button));
  if(mode==='all')fitAll();
  if(mode==='inner'){view.frame(2.1);setSpeed(.12);}
  if(mode==='outer'){view.frame(33);setSpeed(2);selectBody(engine.bodies.find(b=>b.id==='saturn')?.id||engine.bodies[0].id);}
  if(mode==='moon'){const earth=engine.bodies.find(b=>b.id==='earth');if(!earth){toast('当前实验中没有地球。');return;}view.frame(.0037);view.controls.target.fromArray(earth.position);view.camera.position.add(view.controls.target);view.followId=earth.id;setSpeed(.006);selectBody(engine.bodies.find(b=>b.id==='moon')?.id||earth.id);}
  if(mobileMedia.matches)closeMobilePanels();
});
Object.entries(displayBindings).forEach(([id,key])=>$(`#${id}`).onchange=e=>view.settings[key]=e.target.checked);
$('#body-scale').oninput=e=>{view.settings.bodyScale=+e.target.value;$('#body-scale-value').textContent=`${e.target.value}×`;};
$('#trail-length').oninput=e=>{view.settings.trailLength=+e.target.value;$('#trail-length-value').textContent=e.target.value;};
$('#clear-trails').onclick=()=>view.clearTrails();
function orientCamera(top){const center=view.controls.target.clone(),follow=view.followId,scale=view.camera.position.distanceTo(center)/(2.8*Math.max(1,1/view.camera.aspect));view.frame(scale,top);view.camera.position.add(center);view.controls.target.copy(center);view.followId=follow;$('#view-top').classList.toggle('active',top);$('#view-3d').classList.toggle('active',!top);}
$('#view-top').onclick=()=>orientCamera(true);
$('#view-3d').onclick=()=>orientCamera(false);
$('#view-fit').onclick=()=>{if(isolated)exitIsolate();else fitAll();};
$('#fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen();};
$('#toggle-left').onclick=()=>openMobilePanel('left');
$('#toggle-right').onclick=()=>openMobilePanel('right');
const help=()=>$('#help-dialog').showModal();$('#help').onclick=help;$('#physics-help').onclick=help;
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
function download(url,name){const a=document.createElement('a');a.href=url;a.download=name;a.click();}
$('#capture').onclick=()=>{view.render();download(view.snapshot(),'cosmos-observation.png');toast('已保存当前宇宙画面。');};
function snapshot(){return {format:'cosmos-lab-1',preset:currentPreset,bodies:structuredClone(engine.bodies).map(b=>{delete b.referenceOrbit;return b;}),params:{...engine.params},time:engine.time,speed,selectedId,options:initialOptions};}
$('#export').onclick=()=>{const blob=new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);download(url,'cosmos-experiment.json');setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已保存全部天体参数与当前模拟时间。');};
$('#import').onclick=()=>$('#import-file').click();
function validateSnapshot(s){
  if(s.format!=='cosmos-lab-1'||!Array.isArray(s.bodies)||!s.bodies.length||s.bodies.length>256)throw new Error('请选择 COSMOS LAB 导出的实验 JSON（1–256 个天体）。');
  const ids=new Set();
  for(const b of s.bodies){if(typeof b.id!=='string'||ids.has(b.id)||typeof b.name!=='string'||!/^#[\da-f]{6}$/i.test(b.color)||!Number.isFinite(b.mass)||b.mass<=0||!Number.isFinite(b.radius)||b.radius<0||![b.position,b.velocity,b.spin||[0,0,0]].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)))throw new Error('天体参数无效：请检查 ID、质量、半径、颜色或三维向量。');ids.add(b.id);}
  if(!s.params||!['verlet','rk4'].includes(s.params.integrator)||!['none','merge','elastic','fragment'].includes(s.params.collisionMode)||!Number.isFinite(s.params.dt)||s.params.dt<1e-8||s.params.dt>1||!Number.isFinite(s.params.gravityScale)||s.params.gravityScale<0||s.params.gravityScale>1000||!Number.isFinite(s.params.softening)||s.params.softening<0||!Number.isFinite(s.params.restitution)||s.params.restitution<0||s.params.restitution>1||!Number.isFinite(s.time)||s.time<0||!Number.isFinite(s.speed)||s.speed<1e-8||s.speed>100)throw new Error('实验的时间或物理参数超出支持范围。');
}
function restoreSnapshot(s){
  validateSnapshot(s);engine=new PhysicsEngine(s.bodies,s.params);engine.time=s.time;currentPreset=s.preset||'custom';resetKind='snapshot';initialState=structuredClone(s);initialOptions=s.options||{};
  $('#scene-title').textContent='我的宇宙';$('#scene-description').textContent='从保存的天体状态继续实验。导入点作为新的能量参考。';$('#scene-code').textContent='CUSTOM SCENE';document.querySelectorAll('[data-preset]').forEach(b=>b.classList.remove('active'));
  seenCollisionEvents.clear();$('#collision-log').textContent='尚未发生碰撞。可在天体面板发射撞击体。';$('#destruction-count').textContent='0 个天体毁坏';lastError='';
  view.sync([]);isolated=false;view.settings.isolateId=null;$('#exit-isolate').hidden=true;$('#isolate-badge').hidden=true;fitAll();resetEnergy();setSpeed(s.speed);setRunning(false);syncPhysicsInputs();refreshList();selectBody(engine.bodies.find(b=>b.id===s.selectedId)?.id||engine.bodies[0].id);
}
$('#import-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{restoreSnapshot(JSON.parse(await f.text()));toast('实验已导入，按播放继续。');}catch(error){toast(`导入失败：${error.message}`);}e.target.value='';};
const sceneOptions={count:'initial-count',seed:'initial-seed',eccentricity:'initial-eccentricity',separation:'initial-separation',massRatio:'initial-mass-ratio',velocityScale:'initial-velocity-scale',inclination:'initial-inclination',virialRatio:'initial-virial-ratio'};
const optionScope={solar:['eccentricity','velocityScale','inclination'],binary:['eccentricity','separation','massRatio','velocityScale','inclination'],figure8:['velocityScale','inclination'],cluster:['count','seed','virialRatio','velocityScale'],collision:['count','seed','separation','velocityScale','inclination'],slingshot:['velocityScale','inclination']};
$('#scene-settings').onclick=()=>{
  if(!optionScope[currentPreset]){toast('先选择一个预设场景，再调整初始条件。');return;}
  const scope=optionScope[currentPreset];$('#scene-settings-description').textContent=`重新生成「${PRESETS.find(p=>p.id===currentPreset).name}」。当前实验将被新的初态替换。`;
  Object.entries(sceneOptions).forEach(([key,id])=>{const el=$(`#${id}`);el.disabled=!scope.includes(key);el.closest('.field').hidden=!scope.includes(key);if(initialOptions[key]!==undefined)el.value=initialOptions[key];});
  $('#initial-scope').textContent='此处是教学实验：将所有行星统一设为指定偏心率与倾角，并重新生成位置和速度。点击左侧「太阳系实验室」恢复 JPL 近似初态。月球保留地心初始元素。';$('#scene-dialog').showModal();
};
$('#scene-form').onsubmit=e=>{e.preventDefault();const options={};for(const key of optionScope[currentPreset])options[key]=Number($(`#${sceneOptions[key]}`).value);loadPreset(currentPreset,options);$('#scene-dialog').close();};
$('#add-body').onclick=()=>{if(engine.bodies.length>=256){toast('当前实验最多 256 个天体。');return;}setRunning(false);$('#new-parent').replaceChildren(...engine.bodies.map(b=>{const o=document.createElement('option');o.value=b.id;o.textContent=b.name;return o;}));$('#new-parent').value=selectedId;updateAddFields();$('#add-dialog').showModal();};
function updateAddFields(){const isOrbit=$('#new-method').value==='orbit';$('#new-orbit-fields').hidden=!isOrbit;$('#new-manual-fields').hidden=isOrbit;document.querySelectorAll('#new-orbit-fields input,#new-orbit-fields select').forEach(el=>el.disabled=!isOrbit);document.querySelectorAll('#new-manual-fields input').forEach(el=>el.disabled=isOrbit);}
$('#new-method').onchange=updateAddFields;updateAddFields();
$('#add-form').onsubmit=e=>{
  e.preventDefault();const b={id:crypto.randomUUID(),name:$('#new-name').value.trim()||'新天体',mass:+$('#new-mass').value,radius:+$('#new-radius').value/AU_KM,color:$('#new-color').value,spin:[0,0,0]};
  if($('#new-method').value==='orbit'){
    if(engine.params.gravityScale===0){toast('轨道生成需要非零引力。');return;}
    if(engine.params.softening>0){toast('开普勒轨道生成使用无软化公式；请先将软化长度设为 0，或使用手动状态。');return;}
    const parent=engine.bodies.find(x=>x.id===$('#new-parent').value),a=+$('#new-a').value,ecc=+$('#new-e').value;
    const rad=id=>Number($(id).value)*Math.PI/180;
    const inc=rad('#new-i'),node=rad('#new-node'),peri=rad('#new-peri'),nu=rad('#new-phase'),p=a*(1-ecc**2),r=p/(1+ecc*Math.cos(nu));
    const rot=([x,y])=>{const X=x*Math.cos(peri)-y*Math.sin(peri),Y=x*Math.sin(peri)+y*Math.cos(peri);return [Math.cos(node)*X-Math.sin(node)*Y*Math.cos(inc),Math.sin(node)*X+Math.cos(node)*Y*Math.cos(inc),Y*Math.sin(inc)];};
    const v=Math.sqrt(G*engine.params.gravityScale*(parent.mass+b.mass)/p);
    b.position=rot([r*Math.cos(nu),r*Math.sin(nu)]).map((x,i)=>x+parent.position[i]);b.velocity=rot([-v*Math.sin(nu),v*(ecc+Math.cos(nu))]).map((x,i)=>x+parent.velocity[i]);b.parentId=parent.id;
  }else{b.position=['x','y','z'].map(k=>+$(`#new-p${k}`).value);b.velocity=['x','y','z'].map(k=>+$(`#new-v${k}`).value);}
  engine.bodies.push(b);
  if($('#new-method').value==='orbit'){const m=engine.bodies.reduce((s,x)=>s+x.mass,0);const added=b.velocity.map(v=>v*b.mass);for(const body of engine.bodies)body.velocity=body.velocity.map((v,i)=>v-added[i]/m);}
  resetEnergy();refreshList();selectBody(b.id);$('#add-dialog').close();toast('新天体已加入系统，按播放开始演化。');
};
window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||document.querySelector('dialog[open]'))return;if(e.code==='Space'){e.preventDefault();setRunning(!running);}if(e.key.toLowerCase()==='r')$('#reset').click();if(e.key.toLowerCase()==='f')$('#view-fit').click();if(e.key==='Escape'&&isolated)exitIsolate();});

function orbitalElements(b){
  const primary=engine.bodies.find(x=>x.id===(b.orbitalElements?.centralId||b.parentId))||engine.bodies.filter(x=>x.id!==b.id).sort((a,b)=>b.mass-a.mass)[0];
    if(!primary||primary.mass<b.mass||engine.params.gravityScale===0||engine.params.softening>0)return null;
  const r=b.position.map((x,i)=>x-primary.position[i]),v=b.velocity.map((x,i)=>x-primary.velocity[i]);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const R=norm(r),mu=G*engine.params.gravityScale*(b.mass+primary.mass),h=cross(r,v),energy=norm(v)**2/2-mu/R,a=-mu/(2*energy);
  const ev=cross(v,h).map((x,i)=>x/mu-r[i]/R),ecc=norm(ev),inc=norm(h)>0?Math.acos(Math.max(-1,Math.min(1,h[2]/norm(h))))*180/Math.PI:NaN;
  const n=[-h[1],h[0],0],N=norm(n),H=norm(h),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),deg=x=>(x*180/Math.PI+360)%360;
  const node=N>1e-12?deg(Math.atan2(n[1],n[0])):0;
  const peri=ecc>1e-10?N>1e-12?deg(Math.atan2(dot(cross(n,ev),h)/(N*ecc*H),dot(n,ev)/(N*ecc))):deg(Math.atan2(ev[1],ev[0])):0;
  const nu=ecc>1e-10?deg(Math.atan2(dot(cross(ev,r),h)/(ecc*R*H),dot(ev,r)/(ecc*R))):N>1e-12?deg(Math.atan2(dot(cross(n,r),h)/(N*R*H),dot(n,r)/(N*R))):deg(Math.atan2(r[1],r[0]));
  return {a,e:ecc,i:inc,node,peri,nu,centralId:primary.id,period:a>0?2*Math.PI*Math.sqrt(a**3/mu):Infinity};
}
$('#orbit-close').onclick=()=>$('#orbit-dialog').close();
$('#edit-orbit').onclick=()=>{
  const b=getSelected();setRunning(false);
  if(engine.params.gravityScale===0||engine.params.softening>0){toast('开普勒轨道编辑需要非零引力，且软化长度为 0。');return;}
  $('#orbit-edit-title').textContent=`设置「${b.name}」的轨道`;
  $('#edit-parent').replaceChildren(...engine.bodies.filter(x=>x.id!==b.id).map(body=>{const el=document.createElement('option');el.value=body.id;el.textContent=body.name;return el;}));
  const elements=orbitalElements(b);
  if(elements){$('#edit-parent').value=elements.centralId;for(const key of ['a','e','i','node','peri','nu'])$(`#edit-${key}`).value=Number(elements[key].toPrecision(10));}
  if(!elements||elements.e>=1||elements.a<=0){$('#edit-a').value=1;$('#edit-e').value=.1;toast('当前无束缚二体椭圆；可指定主天体并生成新轨道。');}
  $('#orbit-dialog').showModal();
};
$('#orbit-form').onsubmit=e=>{
  e.preventDefault();const b=getSelected(),parent=engine.bodies.find(x=>x.id===$('#edit-parent').value);if(!parent){toast('请选择参考主天体。');return;}
  const a=+$('#edit-a').value,ecc=+$('#edit-e').value,inc=+$('#edit-i').value*Math.PI/180,node=+$('#edit-node').value*Math.PI/180,peri=+$('#edit-peri').value*Math.PI/180,nu=+$('#edit-nu').value*Math.PI/180;
  const p=a*(1-ecc*ecc),r=p/(1+ecc*Math.cos(nu)),vel=Math.sqrt(G*engine.params.gravityScale*(parent.mass+b.mass)/p);
  const rotate=(x,y)=>{const X=x*Math.cos(peri)-y*Math.sin(peri),Y=x*Math.sin(peri)+y*Math.cos(peri);return [X*Math.cos(node)-Y*Math.cos(inc)*Math.sin(node),X*Math.sin(node)+Y*Math.cos(inc)*Math.cos(node),Y*Math.sin(inc)];};
  b.position=rotate(r*Math.cos(nu),r*Math.sin(nu)).map((x,i)=>x+parent.position[i]);b.velocity=rotate(-vel*Math.sin(nu),vel*(ecc+Math.cos(nu))).map((x,i)=>x+parent.velocity[i]);
  b.parentId=parent.id;b.orbitalElements={a,e:ecc,i:inc*180/Math.PI,node:node*180/Math.PI,peri:peri*180/Math.PI,nu:nu*180/Math.PI,centralId:parent.id};
  b.referenceOrbit=Array.from({length:257},(_,i)=>{const f=i/256*2*Math.PI,R=p/(1+ecc*Math.cos(f));return rotate(R*Math.cos(f),R*Math.sin(f)).map((x,j)=>x+parent.position[j]);});
  b.referenceCenterId=parent.id;b.referenceCenter=[...parent.position];view.sync([]);resetEnergy();selectBody(b.id);$('#orbit-dialog').close();toast('轨道参数已应用，按播放继续演化。');
};
function updateTelemetry(now,force=false){
  if(!force&&now-lastTelemetry<150)return;lastTelemetry=now;
  const d=engine.diagnostics(),b=getSelected();
  const timeUnit=engine.time<1/365.25?'小时':engine.time<.01?'天':'年',timeValue=engine.time*(timeUnit==='小时'?365.25*24:timeUnit==='天'?365.25:1);
  $('#sim-time').innerHTML=`${fmt(timeValue,4)} <small>${timeUnit}</small>`;$('#actual-speed').textContent=`实际 ${fmt(actualSpeed,3)} 年/秒`;
  $('#total-energy').textContent=sci(d.energy);$('#total-momentum').textContent=sci(norm(d.momentum));$('#total-angular').textContent=sci(norm(d.angularMomentum));$('#collision-count').textContent=String(engine.collisionCount);$('#collision-energy').textContent=`ΔE ${sci(d.dissipated)}`;
  const err=d.correctedEnergyError;$('#energy-error').textContent=`${err>=0?'+':''}${Math.abs(err)<1e-5?(err*100).toExponential(2):(err*100).toFixed(4)}%`;
  const warning=Math.abs(err)>.001;$('#energy-status').textContent=warning?'请减小步长':'误差监测中';$('#energy-status').classList.toggle('warn',warning);
  if(running||force){energyHistory.push(err);if(energyHistory.length>240)energyHistory.shift();}drawEnergyChart();
  $('#step-hint').textContent=`当前 ${fmt(engine.params.dt*365.25,5)} 天/步；交会建议 ≤ ${fmt(d.suggestedDt,6)} 年。`;
  const risk=engine.params.dt>d.suggestedDt;
  $('#physics-warning').hidden=!risk&&!lastError;
  if(!lastError)$('#physics-warning').textContent=`近距离交会：建议将物理步长减小到 ${sci(d.suggestedDt)} 年以下。`;
  $('#scale-value').textContent=`网格 ${fmt(view.gridStep)} AU`;
  $('.scale-key small').textContent='实心球为真实半径 · 圆环为定位标记';
  $('#pn-parameter').textContent=engine.params.gravityModel==='gr1pn'?sci(d.pnParameter):'牛顿对照';
  if(b){const index=engine.bodies.indexOf(b);$('#body-clock').textContent=engine.params.gravityModel==='gr1pn'?d.clockRates[index].toFixed(12):'—';$('#body-schwarzschild').textContent=`${sci(2*G*engine.params.gravityScale*b.mass/LIGHT_SPEED**2*AU_KM)} km`;}
  if(b){
    $('#body-speed').textContent=fmt(norm(b.velocity)*V_KMS,2);
    $('#body-density').textContent=b.radius>0?fmt(b.mass*(GM_SUN_SI/6.67430e-11)/(4/3*Math.PI*(b.radius*AU_KM*1000)**3),1):'质点';
    if(!dirty)syncBodyFields(b);
    const o=orbitalElements(b);$('#orbit-a').textContent=o?`${fmt(o.a)} AU`:'—';$('#orbit-e').textContent=o?fmt(o.e,5):'—';$('#orbit-i').textContent=o?`${fmt(o.i,2)}°`:'—';$('#orbit-period').textContent=o?Number.isFinite(o.period)?`${fmt(o.period)} 年`:'非闭合轨道':'—';
  }
}
function drawEnergyChart(){
  const c=$('#energy-chart'),r=c.getBoundingClientRect(),ratio=Math.min(devicePixelRatio,2);if(!r.width)return;
  c.width=Math.round(r.width*ratio);c.height=Math.round(r.height*ratio);const ctx=c.getContext('2d');ctx.scale(ratio,ratio);const w=r.width,h=r.height;
  const range=Math.max(1e-7,...energyHistory.map(Math.abs))*1.15;
  $('#energy-range').textContent=`±${(range*100).toExponential(1)}%`;
  ctx.strokeStyle='#25353c';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle='#9cdac8';ctx.lineWidth=1.5;ctx.beginPath();energyHistory.forEach((v,i)=>{const x=i/239*w,y=h/2-v/range*(h/2-3);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();
}
function animate(now){
  requestAnimationFrame(animate);const wall=Math.min((now-lastWall)/1000,.1);lastWall=now;let elapsed=0;
  if(running){
    simAccum+=wall*speed;const deadline=performance.now()+10;let n=0,oldCount=engine.bodies.length;
    try{
      while(simAccum>=engine.params.dt&&n<3000){const dt=engine.params.dt;engine.step(dt);view.recordStep(engine.bodies,engine.time);simAccum-=dt;elapsed+=dt;n++;if(n%8===0&&performance.now()>deadline)break;}
      // Preserve fractional steps at slow playback; only drop unprocessed whole steps when the frame budget is exhausted.
      if(simAccum>=engine.params.dt)simAccum%=engine.params.dt;
    }catch(error){setRunning(false);lastError=error.message;$('#physics-warning').textContent=`模拟已暂停：${error.message}`;$('#physics-warning').hidden=false;}
    consumeCollisionEvents();if(engine.bodies.length!==oldCount){refreshList();if(!getSelected())selectBody(engine.bodies[0].id);else selectBody(selectedId);}
  }
  realWindow+=wall;simWindow+=elapsed;if(realWindow>.5){actualSpeed=simWindow/realWindow;realWindow=simWindow=0;}
  view.sync(engine.bodies);view.render();updateTelemetry(now);
}
loadPreset('solar');requestAnimationFrame(animate);
