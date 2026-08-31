(function (root, factory) {
    "use strict";
    var data = factory();
    if (typeof module === "object" && module.exports) module.exports = data;
    root.MotionFieldData = data;
}(typeof window !== "undefined" ? window : globalThis, function () {
    "use strict";

    var palettes = [
        ["#7dd3fc", "#a5b4fc", "125,211,252"], ["#f0abfc", "#818cf8", "240,171,252"],
        ["#5eead4", "#38bdf8", "94,234,212"], ["#fb7185", "#fbbf24", "251,113,133"],
        ["#a3e635", "#34d399", "163,230,53"], ["#c084fc", "#f472b6", "192,132,252"],
        ["#f97316", "#fde68a", "249,115,22"], ["#60a5fa", "#22d3ee", "96,165,250"]
    ];

    var legacy = [
        [1, "fluid-distortion", "Interactive Fluid Distortion", "交互式流体扭曲", "POINTER", "core"],
        [2, "fullscreen-expansion", "Full-screen Expansion", "全屏扩展转场", "SCROLL", "core"],
        [3, "scroll-scenes", "Scroll-driven Scenes", "滚动驱动场景切换", "SCROLL", "core"],
        [4, "kinetic-typography", "Kinetic Typography", "动态排版", "POINTER", "core"],
        [5, "metaballs", "Gooey Metaballs", "黏性融合球", "POINTER", "core"],
        [6, "image-motion-trail", "Image Motion Trail", "图像运动拖尾", "POINTER", "core"],
        [7, "magnetic-cursor", "Magnetic Cursor", "磁力光标", "POINTER", "light"],
        [8, "fullscreen-crosshair", "Full-screen Crosshair", "全屏十字准星", "POINTER", "light"],
        [9, "direction-aware-reveal", "Direction-aware Reveal", "方向感知揭示", "HOVER", "light"],
        [10, "direction-aware-marquee", "Direction-aware Marquee", "方向感知跑马灯", "HOVER", "light"],
        [11, "tilt-hover", "Tilt Hover", "悬停倾斜", "HOVER", "light"],
        [12, "svg-path-morphing", "SVG Path Morphing", "SVG 路径形变", "POINTER", "light"],
        [13, "svg-stroke-drawing", "SVG Stroke Drawing", "SVG 描边绘制", "CLICK", "light"],
        [14, "svg-mask-reveal", "SVG Mask Reveal", "SVG 蒙版揭示", "POINTER", "light"],
        [15, "css-motion-path", "CSS Motion Path", "CSS 运动路径", "CONTROL", "light"],
        [16, "split-text-reveal", "Split-Text Mask Reveal", "分割文字蒙版揭示", "CLICK", "light"],
        [17, "flip-layout-transition", "FLIP Layout Transition", "FLIP 布局转场", "CLICK", "light"],
        [18, "shared-element-transition", "Shared Element Transition", "共享元素视图转场", "CLICK", "light"],
        [19, "infinite-canvas", "Infinite Pannable Canvas", "无限可平移画布", "DRAG", "space"],
        [20, "inertial-drag", "Inertial Drag", "惯性拖拽", "DRAG", "space"],
        [21, "drag-parallax-carousel", "Drag-driven Parallax Carousel", "拖拽驱动视差轮播", "DRAG", "space"],
        [22, "horizontal-scroll", "Vertical-to-Horizontal Scroll", "纵向滚动驱动横向轨道", "SCROLL", "space"],
        [23, "parallax-depth-scroll", "Parallax Depth Scroll", "视差深度滚动", "SCROLL", "space"],
        [24, "layered-zoom-scroll", "Layered Zoom Scroll", "分层推镜滚动", "SCROLL", "space"],
        [25, "scroll-3d-stack", "On-Scroll 3D Stack Motion", "滚动驱动三维卡片堆栈", "SCROLL", "space"],
        [26, "scroll-svg-morph", "SVG Path Morphing on Scroll", "滚动驱动 SVG 路径形变", "SCROLL", "space"],
        [27, "reaction-diffusion", "Reaction–Diffusion", "反应–扩散模拟", "POINTER", "gpu"],
        [28, "sdf-ray-marching", "SDF Ray Marching", "距离场光线步进", "WEBGL", "gpu"],
        [29, "gpgpu-particles", "GPU Procedural Particle Field", "GPU 程序化粒子流场", "POINTER", "gpu"],
        [30, "lens-refraction", "WebGL Lens Refraction", "WebGL 透镜折射", "POINTER", "gpu"],
        [31, "rgb-shift", "RGB Shift / Chromatic Aberration", "RGB 通道偏移与色差", "POINTER", "gpu"],
        [32, "afterimage-feedback", "Afterimage Feedback", "残像反馈", "POINTER", "gpu"],
        [33, "volumetric-god-rays", "Volumetric God Rays", "体积光束", "POINTER", "gpu"],
        [34, "morph-targets", "3D Morph Targets", "三维形态目标动画", "CLICK", "gpu"],
        [35, "spring-drag", "Spring Drag", "二阶弹簧跟随拖拽", "SPRING", "physics"],
        [36, "elastic-bounds", "Elastic Bounds", "弹性边界与撞墙回弹", "BOUNCE", "physics"],
        [37, "momentum-throw", "Momentum Throw", "速度采样与动量投掷", "THROW", "physics"],
        [38, "inertial-snap-grid", "Inertial Snap Grid", "惯性预测与网格吸附", "SNAP", "physics"],
        [39, "magnetic-docking", "Magnetic Docking", "距离磁力与停靠锁定", "MAGNET", "physics"],
        [40, "rope-constraint", "Rope Constraint Drag", "绳段长度约束拖拽", "VERLET", "physics"],
        [41, "collision-drag", "Multi-body Collision Drag", "多物体碰撞与投掷", "COLLIDE", "physics"],
        [42, "orbital-drag", "Orbital Constraint Drag", "轨道约束与角动量", "ORBIT", "physics"],
        [43, "rubber-band-drag", "Rubber-band Drag", "渐进阻力与橡皮筋回弹", "RESIST", "physics"],
        [44, "physics-reorder", "Physics Reorder", "弹簧让位式拖拽重排", "REORDER", "physics"],
        [45, "spring-creature", "Spring Creature State Machine", "弹簧角色状态机", "CHARACTER", "character"]
    ];

    var sections = {
        core: ["Core Experiments", "核心实验", "POINTER · SCROLL · TRANSITION"],
        light: ["Interface Motion", "界面与图形实验", "CSS · SVG · POINTER"],
        space: ["Spatial Motion", "空间与滚动实验", "DRAG · SCROLL · DEPTH"],
        gpu: ["GPU / Shader", "GPU 与着色实验", "WEBGL · CANVAS · SHADER"],
        physics: ["Drag Physics", "物理拖拽实验", "SPRING · INERTIA · CONSTRAINT"],
        character: ["Character Systems", "角色与状态机", "STATE · SPRING · MORPH"]
    };

    var recipes = [
        { key: "direct-manipulation", en: "Direct Manipulation", zh: "指针直控", mode: "pointer", interaction: "pointer-position-and-drag", composition: "single-focus-stage", instruction: "移动、按住或拖动指针，直接改变系统的主状态。" },
        { key: "multi-source", en: "Radial Multiplex", zh: "径向多路复用", mode: "pointer", interaction: "multi-point-lens-input", composition: "three-radial-live-samples", instruction: "点击不同位置放置多个实时取样窗，比较同一系统在多个局部焦点中的响应。" },
        { key: "drawn-constraints", en: "Drawn Field Mask", zh: "绘制场遮罩", mode: "draw", interaction: "draw-output-mask", composition: "field-with-drawn-cutout", instruction: "按住绘制路径，用笔迹切开动态场并留下发光边界。" },
        { key: "scroll-traverse", en: "Scroll Slice Traverse", zh: "滚动切片穿越", mode: "scroll", interaction: "scroll-progress-and-velocity", composition: "four-counter-moving-slices", instruction: "上下滚动，让四条时间切片以相反方向穿越同一动态场。" },
        { key: "signal-orchestra", en: "Signal Triptych", zh: "信号三联画", mode: "auto", interaction: "autonomous-signal-with-preset-action", composition: "three-live-cropped-panels", instruction: "点击切换信号预设；三个实时裁切面板以不同相位共同呈现系统。" }
    ];

    function family(id, en, zh, medium, algorithms) {
        return { id: id, en: en, zh: zh, medium: medium, algorithms: algorithms };
    }

    var families = [
        family("oscillatory-fields", "Oscillatory Fields", "波动与耦合振子", "CANVAS · DIFFERENTIAL", [["fd-string","Finite-Difference String","有限差分弦","离散位移网格传播并在边界反射"],["membrane-wave","Membrane Wave Grid","二维膜面波","二维高度场产生干涉、衍射与驻波"],["kuramoto-lattice","Kuramoto Phase Lattice","Kuramoto 相位晶格","局部耦合振子从失同步逐步锁相"],["modal-resonance","Modal Resonance Stack","模态共振叠层","多个固有模态按频率与振幅叠加"]]),
        family("deformable-matter", "Deformable Matter", "可变形物质", "PBD · SOFT BODY", [["pbd-cloth","Position-Based Cloth","基于位置的布料","结构、剪切与弯曲约束塑造布面"],["shape-match","Shape-Matching Soft Body","形状匹配软体","粒子团拟合休止形状并保留整体旋转"],["spring-jelly","Mass-Spring Jelly","质点弹簧果冻","质点与弹簧网络产生弹性振荡"],["xpbd-cell","XPBD Volume Cell","XPBD 体积胞元","顺应性约束维持面积并允许可控软化"]]),
        family("articulated-solvers", "Articulated Solvers", "关节链与逆向运动学", "IK · CONSTRAINTS", [["fabrik-chain","FABRIK Chain","FABRIK 关节链","前后向到达迭代保持每节长度"],["ccd-arm","CCD IK Arm","CCD 逆解机械臂","从末端反向旋转关节逼近目标"],["jacobian-tentacle","Jacobian Tentacle","Jacobian 触手","末端误差通过雅可比转置分配到关节"],["analytic-two-link","Analytic Two-Link Rig","解析二连杆","余弦定理直接求解肘点与末端姿态"]]),
        family("granular-systems", "Granular Systems", "颗粒与堆积系统", "PARTICLES · CELLULAR", [["falling-sand","Falling Sand Automaton","落沙元胞自动机","离散材料按局部空位与密度下落"],["pbd-grains","PBD Grain Heap","PBD 颗粒堆","圆粒通过位置投影消解穿透并堆积"],["abelian-sandpile","Abelian Sandpile","Abelian 沙堆","超过阈值的格点向邻居守恒分配颗粒"],["circle-packing","Relaxed Circle Packing","松弛圆堆积","不同半径圆体迭代排斥直至无重叠"]]),
        family("swarm-intelligence", "Swarm Intelligence", "群集智能", "AGENTS · EMERGENCE", [["boids","Reynolds Boids","Reynolds 鸟群","分离、对齐与聚合产生群体运动"],["vicsek","Vicsek Alignment","Vicsek 对齐模型","固定速度个体在噪声中趋向局部同向"],["potential-steering","Potential-field Steering","势场导向代理","吸引势与排斥势共同决定代理方向"],["pheromone-walkers","Pheromone Walkers","信息素游走者","代理沉积并追随会扩散衰减的轨迹"]]),
        family("dynamic-networks", "Dynamic Networks", "动态图网络", "GRAPH · RELAXATION", [["fruchterman-reingold","Fruchterman–Reingold Graph","Fruchterman–Reingold 图","边吸引与节点排斥达到力学平衡"],["kamada-kawai","Kamada–Kawai Graph","Kamada–Kawai 图","图论距离转化为全局弹簧能量"],["stress-majorization","Stress-Majorized Graph","应力主化图","迭代降低理想距离与实际距离误差"],["sugiyama-layers","Sugiyama Layered Graph","Sugiyama 分层图","有向图分层、消交叉并正交布线"]]),
        family("morphogenetic-growth", "Morphogenetic Growth", "形态发生与生长", "GROWTH · AGENTS", [["dla","Diffusion-Limited Aggregation","扩散限制凝聚","随机游走粒子粘附成分形枝晶"],["space-colonization","Space Colonization Tree","空间殖民树","枝梢追逐吸引点并逐步占据空间"],["physarum","Physarum Trail Network","黏菌轨迹网络","感知器沿化学场游走并强化高效路径"],["eden-growth","Eden Growth Cluster","Eden 生长簇","随机选择边界胞元形成致密粗糙前沿"]]),
        family("cellular-automata", "Cellular Automata", "元胞自动机", "GRID · RULES", [["game-of-life","Conway Life","康威生命游戏","邻域计数控制细胞出生与死亡"],["elementary-ca","Elementary Rule Tape","一维初等元胞带","三邻域位模式逐行生成时空图"],["cyclic-ca","Cyclic Cellular Wave","循环元胞波","多状态细胞追逐下一状态形成旋涡"],["lenia-kernel","Lenia Kernel Field","Lenia 卷积场","连续状态经径向卷积核产生生命状结构"]]),
        family("path-planning", "Path Planning Fields", "路径规划场", "SEARCH · GRID", [["a-star","A* Heuristic Search","A* 启发式搜索","代价与启发式共同扩展通向目标的节点"],["dijkstra","Dijkstra Wavefront","Dijkstra 波前","按累计代价均匀扩张保证最短路径"],["jump-point","Jump Point Search","跳点搜索","在规则网格中跳过对称冗余节点"],["flow-field","Multi-agent Flow Field","多代理流场","反向距离场为所有代理提供局部方向"]]),
        family("computational-geometry", "Computational Geometry", "计算几何", "VORONOI · CONTOUR", [["voronoi","Voronoi Cells","Voronoi 单元","空间按最近站点划分动态区域"],["delaunay","Delaunay Triangulation","Delaunay 三角剖分","空圆性质连接分布均衡的三角网"],["convex-hull","Dynamic Convex Hull","动态凸包","外层极点形成包围全部点的最小凸多边形"],["marching-squares","Marching Squares","行进方格等值线","十六种网格拓扑提取连续等值轮廓"]]),
        family("curve-construction", "Curve Construction", "曲线构造与拟合", "SVG · SPLINE", [["bezier-casteljau","Bézier / De Casteljau","Bézier / De Casteljau","递归线性插值构造参数曲线"],["catmull-rom","Catmull–Rom Spline","Catmull–Rom 样条","局部控制点生成穿点光滑曲线"],["bspline","B-spline Basis","B-spline 基函数","分段多项式基控制连续度与局部形状"],["clothoid","Clothoid Spiral","回旋曲线","曲率随弧长线性变化形成平顺转向"]]),
        family("fractal-navigation", "Fractal Navigation", "分形与递归空间", "FRACTAL · ZOOM", [["mandelbrot","Mandelbrot Orbit Field","Mandelbrot 轨道场","复二次迭代按逃逸时间着色"],["julia","Julia Parameter Plane","Julia 参数平面","固定复参数形成连通或尘埃状集合"],["ifs","Iterated Function System","迭代函数系统","仿射变换按概率反复映射点集"],["dragon-curve","Dragon Curve Recursion","龙形递归曲线","折叠替换规则构造自相似路径"]]),
        family("chaotic-dynamics", "Chaotic Dynamics", "混沌动力系统", "ODE · ATTRACTOR", [["lorenz","Lorenz Attractor","Lorenz 吸引子","三变量常微分方程形成蝴蝶相轨迹"],["clifford","Clifford Attractor","Clifford 吸引子","三角映射在二维平面形成稠密奇异结构"],["ikeda","Ikeda Map","Ikeda 映射","非线性旋转收缩映射生成弯卷轨迹"],["double-pendulum","Double-Pendulum Poincaré","双摆庞加莱截面","耦合摆的相空间采样呈现混沌岛"]]),
        family("optical-fields", "Optical Fields", "光学与干涉场", "LIGHT · INTERFERENCE", [["double-slit","Double-Slit Diffraction","双缝衍射","两相干波源相位差形成明暗条纹"],["moire","Moiré Grating Field","莫尔光栅场","接近频率或角度的栅格产生低频拍纹"],["visibility-polygon","Visibility Polygon","可见性多边形","从光源向遮挡顶点投射射线求可见区域"],["mirror-rays","Mirror Ray Array","镜面射线阵列","射线按入射角等于反射角多次弹射"]]),
        family("image-reconstruction", "Image Reconstruction", "图像采样与重建", "PIXELS · QUANTIZE", [["ordered-dither","Ordered Dithering","有序抖动","阈值矩阵把连续色调量化为规则点阵"],["floyd-steinberg","Floyd–Steinberg Diffusion","Floyd–Steinberg 误差扩散","量化误差按权重传播到未处理像素"],["lloyd-stipple","Lloyd Stippling","Lloyd 点描","加权 Voronoi 质心迭代重排采样点"],["seam-carving","Seam Carving","内容感知接缝裁剪","动态规划移除低能量像素路径"]]),
        family("temporal-compositing", "Temporal Compositing", "时间反馈与合成", "FEEDBACK · TIME", [["slit-scan","Slit-scan Time Slices","狭缝扫描时间切片","不同空间列从帧历史的不同时间取样"],["kaleido-feedback","Kaleidoscopic Feedback","万花筒反馈","旋转镜像后的旧帧递归写回当前画面"],["displacement-feedback","Displacement Feedback","位移反馈","旧帧经向量场重采样后持续累积"],["block-motion-echo","Block-motion Echo","块运动回声","局部运动块在多个时间延迟上叠加"]]),
        family("spatial-3d", "Spatial 3D Interfaces", "三维空间界面", "3D · CAMERA", [["arcball","Arcball Inspection","Arcball 检视","二维拖拽映射到虚拟球面旋转"],["dolly-zoom","Dolly Zoom Stage","Dolly Zoom 舞台","相机距离与视场反向变化保持主体尺度"],["exploded-view","Exploded Assembly View","爆炸分解视图","零件沿结构轴分离并保留装配关系"],["portal-projection","Off-axis Portal","离轴门户投影","观察点决定窗口内透视投影的偏移"]]),
        family("gesture-pen", "Gesture & Pen Systems", "手势与笔输入", "GESTURE · POINTER", [["unistroke","$1 Unistroke Recognizer","$1 单笔画识别","轨迹重采样、旋转缩放归一后匹配模板"],["point-cloud","$P Point-cloud Gesture","$P 点云手势","忽略笔画顺序并比较点云几何距离"],["pinch-similarity","Pinch Similarity Transform","双指相似变换","两指质心、距离与夹角同步控制变换"],["pressure-tilt","Pressure / Tilt Brush","压感与倾斜笔刷","压力控制宽度，笔轴方向控制椭圆朝向"]]),
        family("target-acquisition", "Target Acquisition", "目标获取技术", "CURSOR · SELECTION", [["bubble-cursor","Bubble Cursor","气泡光标","命中半径扩展到最近目标且排除次近目标"],["voronoi-cursor","Voronoi Cursor","Voronoi 光标","平面按目标最近邻区域扩大有效命中区"],["crossing-selection","Crossing Selection","穿越选择","轨迹穿过边界即选择目标而无需停留点击"],["fan-out","Fan-out Disambiguation","扇出消歧","重叠目标临时展开成可辨认的扇形菜单"]]),
        family("navigation-focus", "Navigation & Focus", "导航与焦点系统", "FOCUS · NAV", [["marking-menu","Marking Menu","标记菜单","径向方向手势在显示前即可执行熟练命令"],["semantic-zoom","Semantic Zoom","语义缩放","跨越缩放阈值时替换信息表示而非只放大"],["spatial-nav","Spatial Navigation","空间焦点导航","按方向与侧向偏差为候选焦点评分"],["fisheye-focus","Fisheye Focus + Context","鱼眼焦点上下文","局部放大目标同时压缩周边保持全局关系"]]),
        family("micro-state", "Microinteraction State Machines", "微交互状态机", "DOM · STATE", [["bounded-ripple","Bounded Ripple","有界涟漪","点击波从输入点扩张到控件最远角"],["hold-confirm","Hold-to-confirm","长按确认","持续时间填充进度，提前释放则反向取消"],["swipe-reveal","Swipe Reveal","滑动揭示操作","横向位移逐步暴露操作层并越阈值提交"],["statechart-morph","Statechart Morph","状态图形变","有限状态与事件驱动组件结构连续转换"]]),
        family("temporal-scrubbing", "Temporal Scrubbing", "时间导航与精细拖动", "TIMELINE · INPUT", [["log-scrub","Logarithmic Scrubbing","对数精细拖动","垂直距离改变横向拖动的时间分辨率"],["velocity-scrub","Velocity-adaptive Scrubbing","速度自适应拖动","输入速度实时改变时间增益与惯性"],["beat-quantized","Beat-quantized Timeline","节拍量化时间轴","时间游标吸附到节拍网格并保持相位"],["time-remap","Reversible Time Remap","可逆时间重映射","非线性曲线控制局部倒放、停顿和加速"]]),
        family("data-layout", "Data Layout Transformations", "数据布局变换", "DATA · GEOMETRY", [["treemap","Squarified Treemap","方形化树图","层级权重切分为纵横比接近方形的矩形"],["circle-pack","Circle Packing","圆形打包","嵌套无重叠圆表示层级与数值"],["sankey","Sankey Routing","Sankey 流向布局","节点排序与曲线带宽表达流量守恒"],["sorting-network","Sorting Network","排序网络","固定比较器拓扑让数值沿连线交换归位"]]),
        family("computational-type", "Computational Typography", "计算排版", "TYPE · GEOMETRY", [["variable-axis","Variable Font Axes","可变字体轴","字重、字宽、倾斜与光学尺寸连续插值"],["glyph-triangulation","Glyph Triangulation","字形三角剖分","字形轮廓拆成可运动的三角网格"],["sdf-text","SDF Text Deformation","SDF 文字形变","有符号距离场保持边缘同时扭曲字形"],["text-path","Text Path Layout","路径文字布局","字形沿曲线切线逐字定位与旋转"]]),
        family("audio-spatial", "Audio & Spatial Sound", "音频响应与空间声场", "WEB AUDIO · SIGNAL", [["fft-spectrum","FFT Spectrum Field","FFT 频谱场","快速傅里叶频带驱动多尺度几何"],["spectral-flux","Spectral Flux Onsets","频谱通量起音","相邻频谱正向增量检测瞬态并触发脉冲"],["rms-envelope","RMS Envelope","RMS 包络","时域均方根能量控制连续尺度与亮度"],["spatial-panner","Spatial Panner Field","空间声像场","声源与监听者位置驱动声像、距离与声锥"]])
    ];

    var effects = legacy.map(function (item) {
        var palette = palettes[(item[0] - 1) % palettes.length];
        return {
            id: item[0], slug: item[1], titleEn: item[2], titleZh: item[3], modeLabel: item[4],
            sectionId: item[5], legacy: item[0] <= 44, familyId: item[5], palette: palette,
            summaryZh: item[3] + "的完整交互实验。目录封面直接运行这一详情页。",
            signature: "hand-authored/" + item[1]
        };
    });

    families.forEach(function (entry, familyIndex) {
        sections[entry.id] = [entry.en, entry.zh, entry.medium];
        entry.algorithms.forEach(function (algorithm, algorithmIndex) {
            recipes.forEach(function (recipe, recipeIndex) {
                var id = 46 + familyIndex * 20 + algorithmIndex * 5 + recipeIndex;
                var palette = palettes[(familyIndex * 3 + algorithmIndex + recipeIndex) % palettes.length];
                effects.push({
                    id: id,
                    slug: entry.id + "-" + algorithm[0] + "-" + recipe.key,
                    titleEn: algorithm[1] + " — " + recipe.en,
                    titleZh: algorithm[2] + " · " + recipe.zh,
                    modeLabel: recipe.mode === "scroll" ? "SCROLL" : recipe.mode === "draw" ? "DRAW" : recipe.mode === "auto" ? "SIGNAL" : "POINTER",
                    interactionMode: recipe.mode,
                    sectionId: entry.id,
                    familyId: entry.id,
                    familyIndex: familyIndex,
                    algorithmIndex: algorithmIndex,
                    recipeIndex: recipeIndex,
                    algorithmKey: algorithm[0],
                    algorithmNote: algorithm[3],
                    interaction: recipe.interaction,
                    composition: recipe.composition,
                    instructionZh: recipe.instruction,
                    palette: palette,
                    seed: id * 2654435761 >>> 0,
                    summaryZh: algorithm[2] + "以“" + recipe.zh + "”构图：" + algorithm[3] + "。",
                    signature: entry.id + "/" + algorithm[0] + "/" + recipe.interaction + "/" + recipe.composition
                });
            });
        });
    });

    var byId = {};
    var bySlug = {};
    effects.forEach(function (effect) { byId[effect.id] = effect; bySlug[effect.slug] = effect; });

    return {
        total: effects.length,
        maxId: effects[effects.length - 1].id,
        originalCount: 44,
        handAuthoredCount: legacy.length,
        generatedCount: effects.length - legacy.length,
        effects: effects,
        byId: byId,
        bySlug: bySlug,
        sections: sections,
        families: families,
        recipes: recipes,
        palettes: palettes
    };
}));
