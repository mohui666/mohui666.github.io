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
        [4, "kinetic-typography", "Kinetic Typography", "动态排版", "SCROLL", "core"],
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
        [26, "scroll-svg-morph", "Scroll-driven SVG Filter Displacement", "滚动驱动 SVG 滤镜位移", "SCROLL", "space"],
        [27, "reaction-diffusion", "Reaction–Diffusion", "反应–扩散模拟", "POINTER", "gpu"],
        [28, "sdf-ray-marching", "SDF Ray Marching", "距离场光线步进", "WEBGL", "gpu"],
        [29, "gpgpu-particles", "GPU Procedural Particle Field", "GPU 程序化粒子流场", "POINTER", "gpu"],
        [30, "lens-refraction", "WebGL Lens Refraction", "WebGL 透镜折射", "POINTER", "gpu"],
        [31, "rgb-shift", "RGB Shift / Chromatic Aberration", "RGB 通道偏移与色差", "POINTER", "gpu"],
        [32, "afterimage-feedback", "Afterimage Feedback", "残像反馈", "POINTER", "gpu"],
        [33, "volumetric-god-rays", "Screen-space God Rays", "屏幕空间径向光束", "POINTER", "gpu"],
        [34, "morph-targets", "3D Morph Targets", "三维形态目标动画", "CLICK", "gpu"],
        [35, "spring-drag", "Spring Drag", "二阶弹簧跟随拖拽", "SPRING", "physics"],
        [36, "elastic-bounds", "Compliant Boundary Contact", "柔顺边界接触", "CONTACT", "physics"],
        [37, "momentum-throw", "Ballistic Throw", "弹道投掷", "THROW", "physics"],
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
        gpu: ["GPU / Canvas Lab", "GPU 与画布模拟", "WEBGL · CANVAS · SHADER"],
        physics: ["Drag Physics", "物理拖拽实验", "SPRING · INERTIA · CONSTRAINT"],
        character: ["Character Systems", "角色与状态机", "STATE · SPRING · MORPH"]
    };

    var interactionSlots = [
        { routeKey: "direct-manipulation", driver: "direct-force", mode: "pointer", label: "POINTER", instruction: "移动、按住或拖动指针，直接向系统状态注入能量。" },
        { routeKey: "multi-source", driver: "source-coupling", mode: "pointer", label: "COUPLE", instruction: "点击放置多个源；源之间会通过当前求解器真实耦合。" },
        { routeKey: "drawn-constraints", driver: "constraint-brush", mode: "draw", label: "CONSTRAINT", instruction: "按住绘制约束；笔迹会参与边界、碰撞或权重计算。" },
        { routeKey: "scroll-traverse", driver: "parameter-scroll", mode: "scroll", label: "SCROLL", instruction: "上下滚动连续扫描求解参数与历史阶段。" },
        { routeKey: "signal-orchestra", driver: "sequenced-forcing", mode: "auto", label: "SEQUENCE", instruction: "点击切换事件序列；系统按阶段接受不同的外力与参数。" }
    ];

    function family(id, en, zh, medium, routeAlgorithms, note, terms) {
        var algorithms = terms.split("|").map(function (term, index) {
            var parts = term.trim().split("~");
            return [id + "-term-" + String(index + 1).padStart(2, "0"), parts[0], parts[1], parts[2] || note];
        });
        return { id: id, en: en, zh: zh, medium: medium, routeAlgorithms: routeAlgorithms, note: note, algorithms: algorithms };
    }

    var families = [
        family("oscillatory-fields", "Oscillatory Fields", "波动与耦合振子", "CANVAS · DIFFERENTIAL", ["fd-string","membrane-wave","kuramoto-lattice","modal-resonance"], "以独立振动状态、相位或模态系数推进波动", `Finite-Difference String~有限差分弦|Membrane Wave Grid~二维膜面波|Kuramoto Phase Lattice~Kuramoto 相位晶格|Modal Resonance Stack~模态共振叠层|Chladni Figures~克拉尼图形|Harmonograph~谐振描绘仪|Lissajous Oscilloscope~李萨如示波图|Van der Pol Oscillator~范德波尔振子|Forced Harmonic Oscillator~受迫谐振子|Coupled Pendulum~耦合摆|Foucault Pendulum~傅科摆|Height-Field Wave Equation~高度场波动方程|Standing Wave~驻波|Normal Mode Analysis~简正模态分析|Fourier Epicycles~傅里叶旋轮|Digital Waveguide Synthesis~数字波导合成|Karplus–Strong Synthesis~Karplus–Strong 拨弦合成|FDTD Acoustic Membrane~FDTD 声学膜|Duffing Oscillator~Duffing 非线性振子|Wave Superposition~波的叠加`),
        family("deformable-matter", "Deformable Matter", "可变形物质", "PBD · SOFT BODY", ["pbd-cloth","shape-match","spring-jelly","xpbd-cell"], "以材料能量、几何约束或形状目标推进可变形体", `Position-Based Cloth~基于位置的布料|Shape-Matching Soft Body~形状匹配软体|Mass–Spring Jelly~质点弹簧果冻|XPBD Volume Cell~XPBD 体积胞元|Projective Dynamics~投影动力学|Corotational FEM~共旋有限元|Neo-Hookean FEM~新胡克有限元|Saint Venant–Kirchhoff FEM~圣维南–基尔霍夫有限元|Reduced Modal Dynamics~降阶模态动力学|Boundary Element Elastodynamics~边界元弹性动力学|Regularized Kelvinlets~正则 Kelvinlet 弹性刷|Cosserat Rod Dynamics~Cosserat 杆动力学|Discrete Elastic Rods~离散弹性杆|Kirchhoff Rod Model~Kirchhoff 杆模型|Baraff–Witkin Implicit Cloth~Baraff–Witkin 隐式布料|Discrete Shells~离散薄壳|Cloth Strain Limiting~布料应变限制|Cloth Self-Collision CCD~布料自碰撞连续检测|Pneumatic Soft-Body Dynamics~气压软体动力学|Peridynamic Fracture~近场动力学断裂`),
        family("articulated-solvers", "Articulated Solvers", "关节链与逆向运动学", "IK · CONSTRAINTS", ["fabrik-chain","ccd-arm","jacobian-tentacle","analytic-two-link"], "以不同关节误差分配或动力学递归更新骨架", `FABRIK Chain~FABRIK 关节链|CCD IK Arm~CCD 逆解机械臂|Jacobian Transpose IK~Jacobian 转置逆解|Analytic Two-Link IK~解析二连杆逆解|Jacobian Pseudoinverse IK~Jacobian 伪逆逆解|Damped Least-Squares IK~阻尼最小二乘逆解|Selectively Damped Least-Squares IK~选择性阻尼逆解|Differential Inverse Kinematics~微分逆运动学|Task-Priority Inverse Kinematics~任务优先逆解|Multiple End-Effector IK~多末端逆解|Joint-Limit-Constrained IK~关节限位逆解|Constraint-Relaxation IK~约束松弛逆解|Particle Inverse Kinematics~粒子逆运动学|Forward Kinematics~正向运动学|Computed-Torque Control~计算力矩控制|Articulated-Body Algorithm~关节体算法|Recursive Newton–Euler Algorithm~递归牛顿–欧拉算法|Lie-Group Rigid-Body Kinematics~李群刚体运动学|Operational Space Control~操作空间控制|Cyclic Coordinate Descent~循环坐标下降`),
        family("granular-systems", "Granular Systems", "颗粒与堆积系统", "PARTICLES · CELLULAR", ["falling-sand","pbd-grains","abelian-sandpile","circle-packing"], "以离散占据、接触投影或塑性屈服推进颗粒介质", `Falling Sand Automaton~落沙元胞自动机|PBD Grain Heap~PBD 颗粒堆|Abelian Sandpile~阿贝尔沙堆|Relaxed Circle Packing~松弛圆堆积|Discrete Element Method~离散单元法|Material Point Method~物质点法|Moving Least-Squares MPM~移动最小二乘物质点法|Snow MPM~雪体物质点法|Drucker–Prager Sand MPM~Drucker–Prager 砂土 MPM|Particle-in-Cell~粒子网格法|Affine Particle-in-Cell~仿射粒子网格法|Ballistic Aggregation~弹道凝聚|Granular Column Collapse~颗粒柱坍塌|Mohr–Coulomb Plasticity~莫尔–库仑塑性|Bagnold Rheology~Bagnold 流变|Granular Gas~颗粒气体|Janssen Silo Effect~Janssen 筒仓效应|Brazil Nut Effect~巴西坚果效应|Angle of Repose~安息角堆积|Random Close Packing~随机密堆积`),
        family("swarm-intelligence", "Swarm Intelligence", "群集智能", "AGENTS · EMERGENCE", ["boids","vicsek","potential-steering","pheromone-walkers"], "由局部邻域规则、势场或环境记忆产生群体涌现", `Reynolds Boids~Reynolds 鸟群|Vicsek Model~Vicsek 自驱粒子|Potential-Field Steering~势场导向|Couzin Collective Motion~Couzin 集体运动模型|Particle Life~粒子生命|Ant Colony Pheromone System~蚁群信息素系统|Physarum Particle Model~黏菌粒子模型|Gravitational N-Body System~引力 N 体系统|Coulomb Particle System~库仑粒子系统|Brownian Dynamics~布朗动力学|Langevin Dynamics~朗之万动力学|Social Force Model~社会力模型|Active Brownian Particles~活性布朗粒子|Particle Swarm Optimization~粒子群优化|Firefly Synchronization~萤火虫同步|Swarmalators~群振子|Bacterial Chemotaxis~细菌趋化|Predator–Prey Flocking~捕食者鸟群|Reynolds Obstacle Avoidance~Reynolds 避障|Milling Swarm Model~环流群集模型`),
        family("dynamic-networks", "Dynamic Networks", "动态图网络", "GRAPH · RELAXATION", ["fruchterman-reingold","kamada-kawai","stress-majorization","sugiyama-layers"], "以图距离、力模型、分层或矩阵编码重排网络", `Fruchterman–Reingold Layout~Fruchterman–Reingold 布局|Kamada–Kawai Layout~Kamada–Kawai 布局|Stress Majorization~应力主化布局|Sugiyama Layered Layout~Sugiyama 分层布局|ForceAtlas2~ForceAtlas2 布局|Multilevel Spring–Electrical Layout~多层弹簧电布局|Radial BFS Layout~径向广度优先布局|Circular Block Layout~圆形块布局|Clustered Graph Layout~聚类图布局|Reingold–Tilford Tidy Tree~Reingold–Tilford 整洁树|Dendrogram Cluster Layout~树状聚类布局|Spectral Graph Drawing~谱图布局|LinLog Layout~LinLog 布局|Yifan Hu Layout~Yifan Hu 布局|OpenOrd Layout~OpenOrd 布局|Graphviz SFDP~Graphviz SFDP 布局|Arc Diagram~弧线图|Hierarchical Edge Bundling~层次边捆绑|Adjacency Matrix Ordering~邻接矩阵排序|Hive Plot~蜂巢图`),
        family("morphogenetic-growth", "Morphogenetic Growth", "形态发生与生长", "GROWTH · AGENTS", ["dla","space-colonization","physarum","eden-growth"], "以空间资源、重写规则或边界不稳定性生长结构", `Diffusion-Limited Aggregation~扩散限制凝聚|Space Colonization Tree~空间殖民树|Physarum Transport Network~黏菌输运网络|Eden Growth Model~Eden 生长模型|L-System~林登迈尔系统|Differential Growth~差分生长|Laplacian Growth~拉普拉斯生长|Vein Growth Model~叶脉生长模型|Phyllotaxis~叶序生长|Cellular Potts Model~细胞 Potts 模型|Reaction–Diffusion Morphogenesis~反应扩散形态发生|Meinhardt Branching Model~Meinhardt 分枝模型|Cell Division Simulation~细胞分裂模拟|Neural Cellular Growth~神经元胞生长|Wave Function Collapse~波函数坍缩生成|Recursive Subdivision Growth~递归细分生长|Space-Filling Curve Growth~空间填充曲线生长|Colonization Competition~菌落竞争生长|Angiogenesis Model~血管生成模型|Coral Accretive Growth~珊瑚增生模型`),
        family("cellular-automata", "Cellular Automata", "元胞自动机", "GRID · RULES", ["game-of-life","elementary-ca","cyclic-ca","lenia-kernel"], "由局部邻域状态转移规则推进离散或连续格点", `Conway’s Game of Life~康威生命游戏|Elementary Cellular Automaton~初等元胞自动机|Cyclic Cellular Automaton~循环元胞自动机|Lenia~Lenia 连续元胞自动机|Margolus Neighborhood Automaton~Margolus 分块自动机|Neural Cellular Automata~神经元胞自动机|Brian’s Brain~Brian 大脑|Wireworld~线世界|Langton’s Ant~兰顿蚂蚁|Rule 30~规则 30|Rule 110~规则 110|HighLife~HighLife 规则|Seeds Cellular Automaton~Seeds 元胞自动机|Day & Night Cellular Automaton~Day & Night 元胞自动机|Larger-than-Life Cellular Automaton~广域生命元胞|Generations Cellular Automaton~世代元胞自动机|Totalistic Cellular Automaton~总和型元胞自动机|Reversible Cellular Automaton~可逆元胞自动机|Lattice Gas Automaton~格子气体自动机|Forest-Fire Model~森林火灾模型`),
        family("path-planning", "Path Planning Fields", "路径规划场", "SEARCH · GRID", ["a-star","dijkstra","jump-point","flow-field"], "以不同搜索前沿、采样空间或代价场构造路径", `A* Heuristic Search~A* 启发式搜索|Dijkstra Wavefront~Dijkstra 波前|Jump Point Search~跳点搜索|Multi-Agent Flow Field~多代理流场|Breadth-First Search~广度优先搜索|Greedy Best-First Search~贪心最佳优先搜索|Bidirectional Search~双向搜索|D* Lite~D* Lite 动态搜索|Lifelong Planning A*~终身规划 A*|Theta* Any-Angle Search~Theta* 任意角搜索|Rapidly-Exploring Random Tree~快速扩展随机树|RRT*~最优快速扩展随机树|Probabilistic Roadmap~概率路网|Fast Marching Method~快速行进法|Wavefront Planner~波前规划器|Navigation Mesh~导航网格|Funnel Algorithm~漏斗算法|Artificial Potential Field~人工势场法|Hybrid A*~混合 A*|Ant Colony Path Planning~蚁群路径规划`),
        family("computational-geometry", "Computational Geometry", "计算几何", "VORONOI · CONTOUR", ["voronoi","delaunay","convex-hull","marching-squares"], "以精确几何谓词、距离或等值拓扑构造平面结构", `Voronoi Diagram~Voronoi 图|Delaunay Triangulation~Delaunay 三角剖分|Convex Hull~凸包|Marching Squares~行进方格|Power Diagram~幂图|Centroidal Voronoi Tessellation~质心 Voronoi 剖分|Alpha Shapes~Alpha 形状|Straight Skeleton~直骨架|Medial Axis Transform~中轴变换|Minkowski Sum~Minkowski 和|Visibility Polygon~可见性多边形|Ramer–Douglas–Peucker Simplification~RDP 折线简化|Jump Flooding Algorithm~跳跃洪泛算法|Poisson Disk Sampling~泊松圆盘采样|Apollonian Gasket~阿波罗尼斯圆垫|Lloyd Relaxation~Lloyd 松弛|Bentley–Ottmann Sweep Line~Bentley–Ottmann 扫描线|Polygon Boolean Clipping~多边形布尔裁剪|Monotone Polygon Triangulation~单调多边形三角化|Line Arrangement~直线排列`),
        family("curve-construction", "Curve Construction", "曲线构造与拟合", "SVG · SPLINE", ["bezier-casteljau","catmull-rom","bspline","clothoid"], "以不同基函数、节点向量或曲率约束构造曲线", `Bézier / De Casteljau~Bézier / De Casteljau|Catmull–Rom Spline~Catmull–Rom 样条|B-Spline Basis~B-Spline 基函数|Clothoid Spiral~回旋曲线|NURBS~非均匀有理 B 样条|Chaikin Corner Cutting~Chaikin 切角|Catmull–Clark Subdivision~Catmull–Clark 细分|Loop Subdivision~Loop 三角细分|Laplacian Mesh Editing~拉普拉斯网格编辑|As-Rigid-As-Possible Deformation~尽可能刚性变形|Bounded Biharmonic Weights~有界双调和权重|Heat Method for Geodesics~热方法测地线|Cubic Hermite Spline~三次 Hermite 样条|Kochanek–Bartels Spline~Kochanek–Bartels 样条|Cardinal Spline~基数样条|Natural Cubic Spline~自然三次样条|Euler Elastica~欧拉弹性线|Pythagorean Hodograph Curve~勾股速端曲线|Dubins Path~Dubins 路径|Reeds–Shepp Curve~Reeds–Shepp 曲线`),
        family("fractal-navigation", "Fractal Navigation", "分形与递归空间", "FRACTAL · ZOOM", ["mandelbrot","julia","ifs","dragon-curve"], "以逃逸时间、仿射迭代或替换规则生成自相似结构", `Mandelbrot Set~Mandelbrot 集|Julia Set~Julia 集|Iterated Function System~迭代函数系统|Dragon Curve~龙形曲线|Mandelbulb~Mandelbulb 三维分形|Quaternion Julia Set~四元数 Julia 集|Fractional Brownian Motion~分形布朗运动|Ridged Multifractal~脊状多重分形|Sierpiński Triangle~Sierpiński 三角形|Menger Sponge~Menger 海绵|Barnsley Fern~Barnsley 蕨|Koch Snowflake~Koch 雪花|Newton Fractal~Newton 分形|Burning Ship Fractal~燃烧船分形|Buddhabrot~Buddhabrot 分形|Lyapunov Fractal~Lyapunov 分形|Phoenix Fractal~Phoenix 分形|Orbit Trap Fractal~轨道陷阱分形|Pickover Stalks~Pickover 茎线|Multibrot Set~Multibrot 集`),
        family("chaotic-dynamics", "Chaotic Dynamics", "混沌动力系统", "ODE · ATTRACTOR", ["lorenz","clifford","ikeda","double-pendulum"], "以非线性常微分方程或离散映射推进相空间轨迹", `Lorenz Attractor~Lorenz 吸引子|Clifford Attractor~Clifford 吸引子|Ikeda Map~Ikeda 映射|Double-Pendulum Poincaré~双摆庞加莱截面|Hénon Map~Hénon 映射|Chirikov Standard Map~Chirikov 标准映射|Baker’s Map~面包师映射|Rössler System~Rössler 系统|Chua’s Circuit~Chua 电路|Thomas Attractor~Thomas 吸引子|Rucklidge Attractor~Rucklidge 吸引子|Aizawa Attractor~Aizawa 吸引子|Halvorsen Attractor~Halvorsen 吸引子|Dadras Attractor~Dadras 吸引子|Rabinovich–Fabrikant System~Rabinovich–Fabrikant 系统|Chen Attractor~Chen 吸引子|Gumowski–Mira Map~Gumowski–Mira 映射|Logistic Map~Logistic 映射|Lotka–Volterra System~Lotka–Volterra 系统|Arnold Cat Map~Arnold 猫映射`),
        family("optical-fields", "Optical Fields", "光学与干涉场", "LIGHT · INTERFERENCE", ["double-slit","moire","visibility-polygon","mirror-rays"], "以波前、相位、几何射线或偏振状态计算光学图样", `Double-Slit Diffraction~双缝衍射|Moiré Grating Field~莫尔光栅场|Radial Light Visibility~径向光可见域|Mirror Ray Array~镜面射线阵列|Thin-Film Interference~薄膜干涉|Diffraction Grating~衍射光栅|Fresnel Diffraction~Fresnel 衍射|Fraunhofer Diffraction~Fraunhofer 衍射|Geometric Caustics~几何焦散|Fermat Optical Path~Fermat 光程|Snell Refraction~Snell 折射|Total Internal Reflection~全反射|Chromatic Dispersion~色散|Linear Polarization~线偏振|Birefringence~双折射|Malus’s Law~Malus 定律|Huygens Wavefront~Huygens 波前|Lensmaker’s Equation~透镜制造者公式|Ray Transfer Matrix~光线传递矩阵|Catacaustic~反射焦散`),
        family("image-reconstruction", "Image Reconstruction", "图像采样与重建", "PIXELS · QUANTIZE", ["ordered-dither","floyd-steinberg","lloyd-stipple","seam-carving"], "以量化、误差传播、采样优化或能量路径重建图像", `Ordered Dithering~有序抖动|Floyd–Steinberg Dithering~Floyd–Steinberg 抖动|Lloyd Stippling~Lloyd 点描|Seam Carving~内容感知接缝裁剪|Blue Noise Sampling~蓝噪声采样|Poisson Disk Stippling~泊松圆盘点描|Halftoning~半色调网点|Jarvis–Judice–Ninke Dithering~Jarvis–Judice–Ninke 抖动|Atkinson Dithering~Atkinson 抖动|Stucki Dithering~Stucki 抖动|Sierra Dithering~Sierra 抖动|Burkes Dithering~Burkes 抖动|Dot Diffusion~点扩散抖动|Median-Cut Quantization~中位切分量化|K-Means Color Quantization~K-Means 颜色量化|Poisson Image Editing~Poisson 图像编辑|PatchMatch~PatchMatch 块匹配|Image Quilting~图像拼布|Canny Edge Detection~Canny 边缘检测|CLAHE~限制对比度自适应直方图均衡`),
        family("temporal-compositing", "Temporal Compositing", "时间反馈与合成", "FEEDBACK · TIME", ["slit-scan","kaleido-feedback","displacement-feedback","block-motion-echo"], "以帧历史、运动估计或反馈缓冲合成时间结构", `Slit-Scan Imaging~狭缝扫描成像|Kaleidoscopic Feedback~万花筒反馈|Displacement Feedback~位移反馈|Block-Motion Echo~块运动回声|Temporal Anti-Aliasing~时域抗锯齿|Velocity-Buffer Motion Blur~速度缓冲运动模糊|Afterimage Feedback~残像反馈|Frame Differencing~帧间差分|Temporal Median Filter~时间中值滤波|Optical-Flow Trails~光流轨迹|Datamoshing~数据蚀刻|Feedback Delay Buffer~反馈延迟缓冲|Video Feedback~视频反馈|Time Displacement~时间位移|Rolling-Shutter Distortion~滚动快门畸变|Frame Blending~帧混合|Motion-Vector Reprojection~运动矢量重投影|Temporal Upsampling~时间上采样|Echo Compositing~回声合成|History Rejection Mask~历史拒绝遮罩`),
        family("spatial-3d", "Spatial 3D Interfaces", "三维空间界面", "3D · CAMERA", ["arcball","dolly-zoom","exploded-view","portal-projection"], "以投影、相机约束或对象层级构造空间交互", `Arcball Inspection~Arcball 检视|Dolly Zoom~Dolly Zoom 舞台|Exploded Assembly View~爆炸分解视图|Off-Axis Portal Projection~离轴门户投影|Perspective Projection~透视投影|Orthographic Projection~正交投影|Oblique Projection~斜投影|Virtual Trackball~虚拟轨迹球|Orbit Camera~轨道相机|Pan–Dolly Camera~平移推拉相机|View Cube Navigation~视图立方体导航|Camera Frustum Visualization~相机视锥可视化|Recursive Portal Rendering~递归门户渲染|Planar Mirror Camera~平面镜像相机|Cubemap Reflection~立方体贴图反射|Billboarding~公告板技术|Impostor Rendering~替身渲染|Device Motion Parallax~设备运动视差|Parallax Occlusion Mapping~视差遮蔽映射|Light Field Rendering~光场渲染`),
        family("gesture-pen", "Gesture & Pen Systems", "手势与笔输入", "GESTURE · POINTER", ["unistroke","point-cloud","pinch-similarity","pressure-tilt"], "以轨迹归一、触点几何或笔传感数据识别输入", `$1 Unistroke Recognizer~$1 单笔划识别器|$P Point-Cloud Recognizer~$P 点云识别器|Pinch Similarity Transform~捏合相似变换|Pressure / Tilt Brush~压感倾斜笔刷|$N Multistroke Recognizer~$N 多笔划识别器|$Q Super-Quick Recognizer~$Q 快速手势识别器|Rubine Gesture Classifier~Rubine 手势分类器|Protractor Recognizer~Protractor 手势识别器|Graffiti Unistroke Alphabet~Graffiti 单笔字母|Coalesced Stroke Rendering~合并事件笔迹重建|Predicted Pointer Rendering~预测指针渲染|One Euro Filter~一欧元滤波器|Kalman Pointer Smoothing~Kalman 指针平滑|Velocity-Sensitive Brush~速度感应笔刷|Calligraphic Nib Model~书法笔尖模型|Bézier Stroke Fitting~Bézier 笔迹拟合|Scribble Erase Gesture~涂抹删除手势|Chorded Touch Gesture~和弦触控手势|Sequential Touch Gesture~序列触控手势|Simultaneous Pen + Touch~笔触并用`),
        family("target-acquisition", "Target Acquisition", "目标获取技术", "CURSOR · SELECTION", ["bubble-cursor","voronoi-cursor","crossing-selection","fan-out"], "以命中几何、控制显示比或轨迹约束提高目标获取", `Bubble Cursor~气泡光标|Voronoi Cursor~Voronoi 光标|Crossing-Based Interaction~越界交互|Fan-Out Disambiguation~扇出消歧|Area Cursor~区域光标|Semantic Pointing~语义指向|Object Pointing~对象指向|Expanding Targets~扩张目标|Sticky Targets~粘性目标|Target Gravity~目标引力|DynaSpot~动态热点光标|Ninja Cursors~忍者多光标|Delphian Desktop~德尔斐预测桌面|Steering Tunnel~隧道导引|Pie Menu~饼形菜单|Marking Menu~标记菜单|Hierarchical Marking Menu~分层标记菜单|FlowMenu~流式菜单|Control Menu~控制菜单|Toolglass~工具玻璃`),
        family("navigation-focus", "Navigation & Focus", "导航与焦点系统", "FOCUS · NAV", ["marking-menu","semantic-zoom","spatial-nav","fisheye-focus"], "以多尺度几何、兴趣度或多视图关系保持焦点与上下文", `Magic Lens~魔法透镜|Semantic Zoom~语义缩放|Spatial Navigation~空间焦点导航|Fisheye Focus + Context~鱼眼焦点上下文|Zoomable User Interface~可缩放界面|Continuous Geometric Zoom~连续几何缩放|Speed-Dependent Automatic Zooming~速度依赖自动缩放|OrthoZoom Scroller~正交缩放滚动器|Peephole Display~窥孔显示|Overview + Detail~总览加细节|Generalized Fisheye View~广义鱼眼视图|Bifocal Display~双焦显示|Perspective Wall~透视墙|Document Lens~文档透镜|Table Lens~表格透镜|Polyfocal Lens~多焦透镜|Conformal Magnifier~保角放大镜|Flip Zooming~翻页式缩放|Hyperbolic Browser~双曲浏览器|Excentric Labeling~偏心标注`),
        family("micro-state", "Microinteraction State Machines", "微交互状态机", "DOM · STATE", ["bounded-ripple","hold-confirm","swipe-reveal","statechart-morph"], "以明确状态、事件和时间合成规则驱动组件动效", `Bounded Ripple~有界涟漪|Hold-to-Confirm~长按确认|Swipe Reveal~滑动揭示|Statechart Morph~状态图形变|CSS Transition~CSS 状态过渡|CSS Keyframe Animation~CSS 关键帧动画|Web Animations KeyframeEffect~程序化关键帧|Additive Animation~加法动画|Accumulative Animation~累积动画|Reversible Animation~可逆动画|Playback-Rate Modulation~播放速率调制|Discrete Property Transition~离散属性过渡|Starting-Style Entry Transition~初始样式入场|Staggered Choreography~错峰编舞|Container Transform~容器变形转场|Shared Axis Transition~共享轴转场|Fade Through~穿越淡化|Radial Transformation~径向变形|Direct Manipulation~直接操控|Pseudo-Haptic Feedback~伪触觉反馈`),
        family("temporal-scrubbing", "Temporal Scrubbing", "时间导航与精细拖动", "TIMELINE · INPUT", ["log-scrub","velocity-scrub","beat-quantized","time-remap"], "以滚动、速度、量化或非线性映射寻址时间", `Logarithmic Scrubbing~对数精细拖动|Velocity-Adaptive Scrubbing~速度自适应拖动|Beat-Quantized Timeline~节拍量化时间轴|Reversible Time Remap~可逆时间重映射|Scroll Progress Timeline~滚动进度时间轴|View Progress Timeline~视图进度时间轴|Named Timeline Range Animation~命名区间动画|CSS Scroll Snap~滚动吸附|Scroll Snap Event Transition~吸附事件转场|Scroll-Scrubbed Animation~滚动擦洗动画|Image Sequence Scrubbing~序列帧滚动擦洗|Visual Analysis History~可视分析历史|Timeline Zooming~时间轴缩放|Jog Wheel Scrubbing~Jog 轮擦洗|Shuttle Control~穿梭控制|JKL Playback Control~JKL 播放控制|Variable-Rate Scrubbing~可变速率擦洗|Live Scrubbing~实时擦洗|Thumbnail Scrubbing~缩略图擦洗|Temporal Brushing~时间刷选`),
        family("data-layout", "Data Layout Transformations", "数据布局变换", "DATA · GEOMETRY", ["treemap","circle-pack","sankey","sorting-network"], "以面积、包含、流量或比较器拓扑编码数据关系", `Squarified Treemap~方形化树图|Circle Packing Layout~圆形打包布局|Sankey Layout~桑基流图布局|Sorting Network~排序网络|Slice-and-Dice Treemap~切片切丁树图|Binary Treemap~二叉树图|Resquarified Treemap~稳定方形树图|Icicle Partition Layout~冰柱分区布局|Sunburst Partition Layout~旭日分区布局|Chord Diagram~弦图|Alluvial Diagram~冲积图|Parallel Coordinates~平行坐标|Streamgraph~流图|Beeswarm Plot~蜂群图|Bump Chart~排名变化图|Marimekko Chart~马赛克图|Horizon Graph~地平线图|Hexbin Binning~六边形分箱|Mosaic Plot~马赛克统计图|Voronoi Treemap~Voronoi 树图`),
        family("computational-type", "Computational Typography", "计算排版", "TYPE · GEOMETRY", ["variable-axis","glyph-triangulation","sdf-text","text-path"], "以字形轮廓、距离场、字体轴或曲线弧长构造文字", `Variable Font Axes~可变字体轴|Glyph Triangulation~字形三角剖分|SDF Text Deformation~SDF 文字形变|Text Path Layout~路径文字布局|Multi-Channel Signed Distance Field Text~MSDF 多通道距离场文字|SVG Stroke-Dash Animation~SVG 虚线描边动画|Shape Context Matching~形状上下文匹配|Kinetic Typography~动态排版|Glyph Morphing~字形形变|Font Master Interpolation~字体母版插值|Typographic Grid System~字体网格系统|Optical Size Axis~光学尺寸字轴|Ligature Substitution~连字替换|Text Tessellation~文字曲面细分|Calligram Layout~图形诗排版|Concrete Poetry Layout~具体诗排版|ASCII Art Rendering~字符画渲染|Typographic Particle System~文字粒子系统|Per-Character Stagger~逐字错峰动画|Signed Distance Glyph Outline~有符号距离字形轮廓`),
        family("audio-spatial", "Audio & Spatial Sound", "音频响应与空间声场", "WEB AUDIO · SIGNAL", ["fft-spectrum","spectral-flux","rms-envelope","spatial-panner"], "以真实音频状态、滤波拓扑或空间声学参数驱动画面", `FFT Spectrum Field~FFT 频谱场|Spectral Flux Onsets~频谱通量起音|RMS Envelope~RMS 包络|HRTF Binaural Spatialization~HRTF 双耳空间化|Additive Synthesis~加法合成|Subtractive Synthesis~减法合成|Wavetable Synthesis~波表合成|Frequency-Modulation Synthesis~调频合成|Phase-Distortion Synthesis~相位失真合成|Ring Modulation~环形调制|Amplitude Modulation~幅度调制|Oscillator Hard Sync~振荡器硬同步|Waveshaping Distortion~波形整形失真|Wavefolding~波形折叠|Granular Synthesis~颗粒合成|Biquad Low-Pass Filter~双二阶低通滤波|State-Variable Filter~状态变量滤波器|Convolution Reverb~卷积混响|Schroeder Reverb~Schroeder 混响|Feedback Delay Network~反馈延迟网络`)
    ];

    var renderRules = {
        "oscillatory-fields": [/String|Standing|Wave Superposition|Waveguide|Karplus/, /Membrane|Chladni|Height-Field|FDTD/, /Kuramoto|Phase|Van der Pol|Coupled|Foucault/, /Modal|Harmonograph|Lissajous|Normal Mode|Fourier|Forced/],
        "deformable-matter": [/Cloth|Shell|Strain/, /Shape|Kelvinlet|Reduced Modal|Boundary Element/, /Spring|Rod|Cosserat|Kirchhoff/, /XPBD|FEM|Pneumatic|Fracture|Projective/],
        "articulated-solvers": [/FABRIK|Constraint-Relaxation|Particle/, /CCD|Cyclic/, /Jacobian|Damped|Differential|Task-Priority|Operational|Multiple End/, /Analytic|Kinematics|Dynamics|Articulated|Newton|Featherstone/],
        "granular-systems": [/Falling|Sand MPM|Column|Silo|Angle of Repose/, /PBD|Discrete Element|Particle-in-Cell|Close Packing|Granular Gas|Brazil/, /Abelian|Plasticity|Rheology/, /Circle|Ballistic|Affine|Snow/],
        "swarm-intelligence": [/Boids|Flocking|Collective/, /Vicsek|Brownian|Langevin|Active|Firefly|Swarmalator|Phase Transition/, /Potential|N-Body|Coulomb|Social Force|Particle Swarm|Obstacle|Predator/, /Pheromone|Physarum|Bacterial|Particle Life/],
        "dynamic-networks": [/Fruchterman|ForceAtlas|LinLog|Yifan|OpenOrd|SFDP/, /Kamada|Stress|Spectral|Multilevel/, /Edge Bundling|Adjacency|Hive|Arc Diagram/, /Sugiyama|Radial|Circular|Clustered|Tree|Dendrogram/],
        "morphogenetic-growth": [/Diffusion-Limited|Laplacian|Coral|Accretive/, /Space Colonization|Vein|Phyllotaxis|Fibonacci|L-System|Turtle/, /Physarum|Differential|Meinhardt|Angiogenesis/, /Eden|Cell Division|Neural|Wave Function|Subdivision|Space-Filling|Competition/],
        "cellular-automata": [/Life|HighLife|Seeds|Day & Night|Larger-than-Life/, /Elementary|Rule 30|Rule 110|Totalistic/, /Cyclic|Brian|Wireworld|Langton|Forest-Fire|Generations/, /Lenia|Neural|Margolus|Reversible|Lattice Gas/],
        "path-planning": [/A\*|Greedy|Hybrid|Lifelong/, /Dijkstra|Breadth|D\* Lite|Bidirectional/, /Jump Point|Theta|Random Tree|RRT|Roadmap|Navigation Mesh|Funnel/, /Flow Field|Fast Marching|Wavefront|Potential|Ant Colony/],
        "computational-geometry": [/Voronoi|Power|Centroidal|Lloyd/, /Delaunay|Triangulation|Sweep Line|Arrangement/, /Convex|Alpha|Skeleton|Medial|Minkowski|Visibility|Clipping|Simplification/, /Marching|Flooding|Poisson|Apollonian/],
        "curve-construction": [/Bézier|Hermite|Pythagorean/, /Catmull|Kochanek|Cardinal/, /B-Spline|NURBS|Natural|Subdivision|Weights|Laplacian|Rigid|Heat/, /Clothoid|Elastica|Dubins|Reeds|Chaikin/],
        "fractal-navigation": [/Mandelbrot|Multibrot|Buddhabrot/, /Julia|Newton|Phoenix|Lyapunov/, /Function System|Fern|Sierpiński|Menger|Snowflake|Brownian|Multifractal/, /Dragon|Burning Ship|Orbit Trap|Pickover/],
        "chaotic-dynamics": [/Lorenz|Rössler|Chua|Thomas|Rucklidge|Aizawa|Halvorsen|Dadras|Rabinovich|Chen/, /Clifford/, /Ikeda|Hénon|Chirikov|Baker|Gumowski|Logistic|Cat Map/, /Pendulum|Lotka/],
        "optical-fields": [/Double-Slit|Diffraction|Interference|Grating|Huygens|Malus|Polarization|Birefringence/, /Moiré|Dispersion|Thin-Film/, /Visibility|Fermat|Lensmaker|Transfer Matrix/, /Mirror|Caustic|Refraction|Reflection|Catacaustic/],
        "image-reconstruction": [/Ordered|Blue Noise|Halftone|Threshold/, /Floyd|Jarvis|Atkinson|Stucki|Sierra|Burkes|Diffusion/, /Lloyd|Stippling|Poisson|K-Means|Median-Cut|CLAHE/, /Seam|PatchMatch|Quilting|Canny/],
        "temporal-compositing": [/Slit|Rolling|Time Displacement/, /Kaleidoscopic|Video Feedback|Frame Blending|Echo/, /Displacement|Optical-Flow|Motion-Vector|Temporal Anti|Upsampling|Rejection/, /Block|Datamoshing|Differencing|Median|Afterimage|Delay/],
        "spatial-3d": [/Arcball|Trackball|Orbit|View Cube/, /Dolly|Perspective|Orthographic|Oblique|Frustum|Pan/, /Exploded|Billboard|Impostor|Cubemap|Parallax|Light Field/, /Portal|Mirror|Off-Axis|Device Motion/],
        "gesture-pen": [/\$1|Unistroke|Rubine|Protractor|Graffiti|Stroke Fitting|Scribble/, /\$P|\$N|\$Q|Point-Cloud|Multistroke|Coalesced|Predicted|Filter|Smoothing/, /Pinch|Touch Gesture|Pen \+ Touch/, /Pressure|Tilt|Brush|Nib/],
        "target-acquisition": [/Bubble|Area|DynaSpot|Expanding|Sticky/, /Voronoi|Semantic|Object|Gravity|Delphian/, /Crossing|Steering|Ninja/, /Fan-Out|Pie|Marking|FlowMenu|Control Menu|Toolglass/],
        "navigation-focus": [/Magic Lens|Magnifier|Lens|Peephole/, /Semantic|Zoom|Hyperbolic|Perspective|Bifocal/, /Spatial|Overview|Excentric/, /Fisheye|Focus|Polyfocal|Degree/],
        "micro-state": [/Ripple|Radial|Starting|Entry/, /Hold|Transition|Fade|Container|Shared Axis/, /Swipe|Manipulation|Pseudo-Haptic/, /Statechart|Keyframe|Additive|Accumulative|Reversible|Playback|Staggered|Discrete/],
        "temporal-scrubbing": [/Logarithmic|Timeline Zoom|Jog|Thumbnail/, /Velocity|Variable-Rate|Shuttle|JKL/, /Beat|Snap|Temporal Brushing/, /Time Remap|Progress Timeline|View Progress|Named Timeline|Scroll-Scrubbed|Sequence|History|Live/],
        "data-layout": [/Treemap|Mosaic|Marimekko/, /Circle|Beeswarm|Hexbin/, /Sankey|Alluvial|Streamgraph|Chord|Bump/, /Sorting|Parallel|Horizon/],
        "computational-type": [/Variable|Axis|Font Master|Optical|Ligature|Grid/, /Triangulation|Tessellation|Particle/, /SDF|Distance|MSDF|ASCII/, /Path|Stroke|Shape Context|Kinetic|Morph|Calligram|Poetry|Stagger/],
        "audio-spatial": [/FFT|Additive|Subtractive|Wavetable|Frequency-Modulation/, /Spectral|Phase|Ring|Amplitude|Hard Sync/, /RMS|Waveshaping|Wavefolding|Granular|Filter/, /HRTF|Reverb|Delay Network/]
    };

    function renderIndexFor(familyId, title, fallback) {
        var rules = renderRules[familyId];
        if (!rules) return fallback % 4;
        for (var index = 0; index < rules.length; index += 1) if (rules[index].test(title)) return index;
        return fallback % 4;
    }

    var mechanismOps = {
        drivers: interactionSlots.map(function (item) { return item.driver; }),
        topologies: ["cartesian-lattice","radial-neighborhood","branched-graph","masked-domain","layered-history","toroidal-grid","adaptive-mesh","particle-cloud","path-manifold","phase-space"],
        updates: ["impulse-injection","source-coupling","constraint-projection","parameter-continuation","sequenced-forcing"],
        boundaries: ["fixed","periodic","reflective","absorbing","painted","elastic","open","adaptive","clamped","moving"],
        visualizers: ["physical-state","vector-state","constraint-state","history-state","phase-state","energy-map","topology-map","density-map","iteration-map","signal-map"]
    };

    function interactionForTerm(entry, title, termIndex) {
        if (entry.id === "temporal-scrubbing" || /Scroll|Timeline|Scrub|Zoom|Dolly|Progress|Time Remap/.test(title)) return interactionSlots[3];
        if (entry.id === "gesture-pen" || entry.id === "target-acquisition") {
            if (/Multistroke|Point-Cloud|Chorded|Simultaneous/.test(title)) return interactionSlots[1];
            if (/Stroke|Brush|Graffiti|Scribble|Calligraphic|Pen/.test(title)) return interactionSlots[2];
            return interactionSlots[0];
        }
        if (entry.id === "audio-spatial") return /HRTF|Spatial/.test(title) ? interactionSlots[0] : interactionSlots[4];
        if (/Multi|Coupled|Network|N-Body|Swarm|Cluster|Colony|Source|Binaural|Collective/.test(title)) return interactionSlots[1];
        if (/Constraint|Brush|Stroke|Cloth|Rod|Path|Gesture|Drawing|Editing|Fitting|Selection|Carving|Triangulation/.test(title)) return interactionSlots[2];
        if (/Animation|Synthesis|Oscillator|Automaton|Growth|Dynamics|Map|Reverb|Feedback|Layout|Fractal|Attractor/.test(title)) return interactionSlots[4];
        return interactionSlots[termIndex % 2 ? 0 : 3];
    }

    function createMechanism(entry, familyIndex, algorithm, termIndex, renderIndex, slot) {
        return {
            schemaVersion: 2,
            engine: entry.id,
            solver: algorithm[0],
            driver: slot.driver,
            topology: mechanismOps.topologies[(familyIndex + Math.floor(termIndex / 5) * 2) % mechanismOps.topologies.length],
            update: mechanismOps.updates[(familyIndex + termIndex) % mechanismOps.updates.length],
            boundary: mechanismOps.boundaries[(familyIndex * 3 + termIndex) % mechanismOps.boundaries.length],
            visualizer: mechanismOps.visualizers[(familyIndex * 7 + termIndex * 3) % mechanismOps.visualizers.length],
            parameters: {
                rate: Number((0.72 + ((familyIndex + termIndex * 2) % 7) * 0.11).toFixed(2)),
                gain: Number((0.64 + ((renderIndex * 3 + termIndex) % 6) * 0.13).toFixed(2)),
                density: 18 + ((familyIndex * 7 + renderIndex * 5 + termIndex * 3) % 23),
                symmetry: 1 + ((familyIndex + renderIndex + termIndex * 2) % 6)
            }
        };
    }

    function structuralMechanism(mechanism) {
        return [mechanism.engine, mechanism.solver, mechanism.driver, mechanism.topology, mechanism.update, mechanism.boundary, mechanism.visualizer].join("/");
    }

    function effectiveMechanism(mechanism) {
        return structuralMechanism(mechanism) + "/" + [mechanism.parameters.rate, mechanism.parameters.gain, mechanism.parameters.density, mechanism.parameters.symmetry].join(":");
    }

    var legacySummaries = {
        1: "程序噪声与指针速度共同驱动图像 UV 位移；它是无反馈纹理扭曲，不伪称流体求解。",
        26: "滚动连续调制 feTurbulence 与 feDisplacementMap，固定矢量轮廓经过真实 SVG 滤镜场位移。",
        33: "片元着色器在屏幕空间沿像素到光源的方向做径向采样，形成随遮挡变化的光束。",
        36: "允许有限边界穿透，以接触弹簧、阻尼和法向力连续推出物体。",
        37: "释放速度进入重力积分，同时保存角速度、姿态与地面碰撞状态。"
    };

    var effects = legacy.map(function (item) {
        var palette = palettes[(item[0] - 1) % palettes.length];
        return {
            id: item[0], slug: item[1], titleEn: item[2], titleZh: item[3], modeLabel: item[4],
            sectionId: item[5], legacy: true, familyId: item[5], palette: palette,
            summaryZh: legacySummaries[item[0]] || item[3] + "的完整交互实验。目录封面直接运行这一详情页。",
            signature: "hand-authored/" + item[1]
        };
    });

    families.forEach(function (entry, familyIndex) {
        sections[entry.id] = [entry.en, entry.zh, entry.medium];
        entry.algorithms.forEach(function (algorithm, termIndex) {
            var routeSlot = interactionSlots[termIndex % interactionSlots.length];
            var slot = interactionForTerm(entry, algorithm[1], termIndex);
            var id = 46 + familyIndex * 20 + termIndex;
            var palette = palettes[(familyIndex * 3 + termIndex * 2) % palettes.length];
            var renderIndex = renderIndexFor(entry.id, algorithm[1], termIndex);
            var mechanism = createMechanism(entry, familyIndex, algorithm, termIndex, renderIndex, slot);
            var routeAlgorithm = entry.routeAlgorithms[Math.floor(termIndex / 5)];
            effects.push({
                id: id,
                slug: entry.id + "-" + routeAlgorithm + "-" + routeSlot.routeKey,
                titleEn: algorithm[1],
                titleZh: algorithm[2],
                modeLabel: slot.label,
                interactionMode: slot.mode,
                sectionId: entry.id,
                familyId: entry.id,
                familyIndex: familyIndex,
                familyTermIndex: termIndex,
                algorithmIndex: renderIndex,
                algorithmKey: algorithm[0],
                algorithmNote: algorithm[3],
                canonicalTerm: algorithm[1],
                interaction: slot.driver,
                instructionZh: slot.instruction,
                mechanism: mechanism,
                mechanismKey: entry.id + "/" + algorithm[0],
                structuralSignature: structuralMechanism(mechanism),
                effectiveSignature: effectiveMechanism(mechanism),
                stateModel: entry.id + "/" + algorithm[0],
                interactionLaw: slot.driver,
                visualEncoding: mechanism.visualizer,
                differenceClaim: algorithm[2] + " 使用独立术语处理器，并组合 " + mechanism.topology + "、" + mechanism.update + " 与 " + mechanism.visualizer + "。",
                implementationLevel: "interactive-study",
                palette: palette,
                seed: id * 2654435761 >>> 0,
                summaryZh: algorithm[2] + "交互研究：" + algorithm[3] + "；输入通过独立术语处理器改变核心状态、边界或拓扑。",
                signature: "mechanism/" + structuralMechanism(mechanism)
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
        recipes: interactionSlots,
        interactionSlots: interactionSlots,
        mechanismOps: mechanismOps,
        palettes: palettes
    };
}));
