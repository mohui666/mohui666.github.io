(function (root, factory) {
    "use strict";
    var manifest = factory();
    if (typeof module === "object" && module.exports) module.exports = manifest;
    root.MotionStudyManifest = manifest;
}(typeof window !== "undefined" ? window : globalThis, function () {
    "use strict";

    function item(id, slug, titleEn, titleZh, sectionId, modeLabel, mechanism, interaction, differentiator, complexity) {
        if (complexity === undefined) {
            complexity = differentiator;
            differentiator = interaction;
            interaction = mechanism;
            mechanism = modeLabel;
            modeLabel = { temporal: "CONTROL", spatial: "RENDER", "physics-sim": "SIMULATE" }[sectionId] || "INTERACT";
        }
        return { id: id, slug: slug, titleEn: titleEn, titleZh: titleZh, sectionId: sectionId, modeLabel: modeLabel, mechanism: mechanism, interaction: interaction, differentiator: differentiator, complexity: complexity, bundle: sectionId };
    }

    return [
        item(46, "shared-axis-transition", "Shared Axis Transition", "共享轴转场", "choreography", "SWITCH", "关联场景沿同一 X/Y/Z 轴同步位移、缩放与淡入淡出。", "切换轴向与前后层级。", "编码导航关系，不匹配共享元素身份。", 3),
        item(47, "fade-through-transition", "Fade Through Transition", "穿越式淡化转场", "choreography", "SWITCH", "旧内容先退出，新内容越过明确交换点后进入。", "切换无直接空间关系的内容。", "先出后入，不是两画面同时交叉溶解。", 2),
        item(48, "explode-transition", "Explode Transition", "放射分解转场", "choreography", "EPICENTER", "真实界面块按其到触发焦点的向量分解或聚合。", "点击任意位置设定 epicenter。", "移动界面块，不生成装饰粒子。", 3),
        item(49, "radial-reaction", "Radial Reaction", "径向反应", "choreography", "PRESS", "触点发出波前，按空间距离延迟各界面属性响应。", "点击或拖动触发传播。", "改变状态时序，不做几何水波扭曲。", 3),
        item(50, "staggered-choreography", "Staggered Choreography", "错时编舞", "choreography", "ORDER", "元素按阅读顺序、空间序或层级施加重叠时间偏移。", "切换排序规则并重播。", "错开对象时刻，不拆分文字。", 3),
        item(51, "staged-transition", "Staged Transition", "分阶段转场", "choreography", "STAGES", "复杂状态变化按尺度、位置、数值三个语义阶段执行。", "拖动时间轴或自动播放。", "分离属性阶段，不是对象延迟队列。", 4),
        item(52, "predictive-back", "Predictive Back", "预测式返回", "choreography", "EDGE DRAG", "边缘手势进度连续预览导航栈目标，并可提交或取消。", "从左边缘拖动后释放。", "预览下一导航目的地，不是关闭当前卡片。", 4),
        item(53, "swipe-to-dismiss", "Swipe-to-Dismiss", "滑动消除", "choreography", "SWIPE", "位移揭示语义动作，依据距离与释放速度阈值提交或复位。", "横向拖动通知卡片。", "有命令阈值与撤销状态，不是自由投掷。", 3),
        item(54, "symbol-replace-transition", "Symbol Replace Transition", "分层符号替换", "choreography", "TOGGLE", "原创分层矢量符号按 down-up / off-up 序列交换语义图层。", "切换播放、静音和收藏。", "交换图层而不插值轮廓。", 3),
        item(55, "variable-color-symbol", "Variable Color Symbol", "可变色符号动效", "choreography", "PROGRESS", "符号语义图层按累计或迭代顺序改变颜色和透明度。", "拖动进度或切换累计模式。", "逐层编码状态，不是整体脉冲或 RGB 偏移。", 3),

        item(56, "semantic-zoom", "Semantic Zoom", "语义缩放", "hci", "ZOOM", "缩放跨阈值时改变对象的信息粒度和表示法。", "滚轮、捏合或拖动缩放尺。", "表示发生语义重构，不是单纯几何放大。", 4),
        item(57, "speed-dependent-zoom", "Speed-Dependent Automatic Zooming", "速度依赖自动缩放", "hci", "FLICK", "导航速度越高镜头越远，减速后自动靠近以限制视觉流。", "快速拖动画布后观察自动尺度。", "尺度由速度驱动，不由滚动位置驱动。", 4),
        item(58, "efficient-zoom-pan", "Smooth & Efficient Zooming and Panning", "平滑高效缩放平移", "hci", "FOCUS", "按感知速度度量计算目标视图之间的单镜头 zoom-pan 路径。", "点击地标，途中可重定向。", "是最优相机路径，不是多层视差。", 4),
        item(59, "overview-detail", "Overview + Detail", "总览加细节", "hci", "VIEWPORT", "全局缩略视图与局部高分辨率视图同时存在并同步视口框。", "拖动总览中的视口。", "空间上并存两种视图，不靠时间切换尺度。", 3),
        item(60, "fisheye-menu", "Fisheye Menu", "鱼眼菜单", "hci", "HOVER", "指针附近菜单项按 Degree of Interest 放大，远端项目压缩。", "沿长菜单移动指针。", "改变项目尺寸与布局，不吸附指针。", 3),
        item(61, "marking-menu", "Marking Menu", "标记菜单", "hci", "GESTURE", "按住显示径向提示；熟练路径直接以方向笔画选择命令。", "按住并划出折线路径。", "专家模式可脱离可见菜单，不等同常驻 Pie Menu。", 4),
        item(62, "magic-lens", "Magic Lens", "魔法透镜", "hci", "DRAG", "可移动局部区域对下方信息应用放大、过滤与语义重绘算子。", "拖动透镜并切换算子。", "是局部信息视图，不是光学折射。", 4),
        item(63, "dynamic-queries", "Dynamic Queries", "动态查询", "hci", "FILTER", "参数变化立即更新结果集，使查询与视觉结果形成直接操纵闭环。", "拖动范围与类别筛选。", "动态的是查询结果，不是普通布局转场。", 4),
        item(64, "bubble-cursor", "Bubble Cursor", "气泡光标", "hci", "TARGET", "光标激活区动态扩展到最近目标但不触及次近目标。", "穿过密集目标并点击。", "改变命中区域，不对光标或目标施加磁力。", 4),
        item(65, "crossing-based-interaction", "Crossing-based Interaction", "穿越式交互", "hci", "CROSS", "命令由指针轨迹穿过目标边界触发，而非在目标内部点击。", "连续划过门线组合命令。", "以边界穿越为离散事件，不是方向菜单。", 4),

        item(66, "css-scroll-snap", "CSS Scroll Snap", "CSS 滚动吸附", "temporal", "SCROLL", "scrollport 在输入结束后落到声明式 snap 对齐位置。", "滚轮、触摸滑动或键盘翻页。", "吸附视口，不吸附被拖对象。", 2),
        item(67, "scroll-anchoring", "Scroll Anchoring", "滚动锚定", "temporal", "上方内容插入时补偿 scroll offset，使选定锚点保持稳定。", "触发异步插入并开关补偿。", "抵消布局位移而不是制造滚动场景。", 3),
        item(68, "scroll-shadows", "Scroll Shadows", "滚动阴影", "temporal", "根据容器剩余滚动范围连续显露顶部或底部溢出阴影。", "滚动内嵌长列表。", "表达可滚方向，不保护固定控件对比度。", 2),
        item(69, "scroll-edge-effect", "Scroll Edge Effect", "滚动边缘效果", "temporal", "内容经过悬浮控件下方时用可变模糊与溶解建立层级边界。", "滚动内容穿过浮动工具栏。", "保护控件层级，不是溢出提示阴影。", 3),
        item(70, "swipe-to-refresh", "Swipe-to-Refresh", "下拉刷新", "temporal", "顶部继续下拉显示连续进度，越过阈值后锁定刷新状态。", "从列表顶部下拉并释放。", "包含阈值和 loading 状态机，不是橡皮筋装饰。", 3),
        item(71, "edge-scrolling", "Edge Scrolling", "边缘自动滚动", "temporal", "拖选时指针进入视口边缘区，按接近度控制自动滚动速度。", "拖动选区靠近画布边缘。", "由边缘热区驱动视口，不是物体惯性。", 4),
        item(72, "rate-controlled-scrolling", "Rate-Controlled Scrolling", "速率控制滚动", "temporal", "拨杆偏移控制滚动速度与方向，而不是映射绝对位置。", "拖动 jog bar 改变速率。", "控制一阶速度，不是 scrubber 位置。", 4),
        item(73, "view-progress-timeline", "View Progress Timeline", "视图进度时间轴", "temporal", "动画进度由单个目标穿越 scrollport 的 entry/exit 区间决定。", "滚动观察元素局部进度。", "限定为 view() 目标进度，不复刻整页场景切换。", 3),
        item(74, "variable-font-interpolation", "Variable Font Interpolation", "可变字体插值", "temporal", "在 wght、wdth、slnt 等 OpenType 变体轴的设计空间连续插值。", "在二维轴面拖动。", "改变字形设计空间，不做文字位置编舞。", 4),
        item(75, "rapid-serial-visual-presentation", "Rapid Serial Visual Presentation", "快速序列视觉呈现", "temporal", "词语在同一注视位置逐个替换，节奏按词长与标点修正。", "播放、调速、暂停与回退。", "固定注视点替词，不让文字在空间中飞行。", 3),

        item(76, "voronoi-tessellation", "Voronoi Tessellation", "Voronoi 镶嵌", "geometry", "COMPUTE", "按最近种子归属把平面分割为凸多边形单元。", "拖动、增加或删除种子。", "展示最近点区域，不编码层级或权重面积。", 3),
        item(77, "delaunay-triangulation", "Delaunay Triangulation", "Delaunay 三角剖分", "geometry", "COMPUTE", "用空外接圆条件维护点集的三角剖分。", "拖动点并观察局部翻边。", "展示三角邻接与翻边，不复用 Voronoi 面。", 4),
        item(78, "convex-hull", "Convex Hull", "凸包", "geometry", "DRAG", "以单调链/叉积求包含点集的最小凸多边形。", "拖动点并逐步重放扫描。", "只保留极点边界，不构造三角网。", 2),
        item(79, "alpha-shape", "Alpha Shape", "Alpha 形状", "geometry", "RADIUS", "按 alpha 半径筛选 Delaunay 单形，得到可含凹陷和孔洞的点云边界。", "调节 alpha 并移动样本。", "是尺度相关凹包，不等于凸包或 Voronoi。", 4),
        item(80, "poisson-disk-sampling", "Poisson-Disk Sampling", "泊松圆盘采样", "geometry", "PAINT", "活动列表与加速网格生成满足最小间距的蓝噪声样本。", "绘制密度场与禁区。", "点无速度，目标是空间采样约束。", 3),
        item(81, "marching-squares", "Marching Squares", "移动方格等值线", "geometry", "FIELD", "对网格标量场的 16 种单元配置插值提取等值线。", "绘制标量场并调节等值阈值。", "使用手绘势场，不借用 Metaballs 场。", 4),
        item(82, "medial-axis", "Medial Axis Transform", "中轴变换", "geometry", "DRAW", "从形状边界的等距点集合提取骨架与局部半径。", "绘制轮廓并观察骨架重建。", "求内部骨架，不是最近种子分区。", 5),
        item(83, "fourier-epicycles", "Fourier Epicycles", "傅里叶旋轮线", "geometry", "DRAW", "把闭合笔迹的复数傅里叶系数重建为旋转圆链。", "画一条闭合路径并播放重建。", "由频谱分量重建任意轮廓，不是固定参数花线。", 4),
        item(84, "apollonian-circle-packing", "Apollonian Circle Packing", "阿波罗圆填充", "geometry", "PACK", "利用笛卡尔圆定理在三相切圆间递归放置精确相切圆。", "拖动初始圆并增加递归层。", "圆精确相切且不融合。", 4),
        item(85, "catmull-clark-subdivision", "Catmull–Clark Subdivision", "Catmull–Clark 细分曲面", "geometry", "SUBDIVIDE", "按面点、边点和顶点权重递归细分任意四边形控制网。", "拖动控制点并切换细分级别。", "改变网格拓扑与极限曲面，不是形态目标插值。", 5),

        item(86, "svg-morphology-filter", "SVG Morphology Filter", "SVG 形态学滤镜", "image", "KERNEL", "feMorphology 对 alpha 邻域执行 erosion 或 dilation。", "拖动半径并切换腐蚀/膨胀。", "邻域取极值，不做路径节点插值。", 3),
        item(87, "svg-convolution-matrix", "SVG Convolution Matrix", "SVG 卷积矩阵", "image", "KERNEL", "feConvolveMatrix 以真实 3×3 核重算每个像素邻域。", "切换锐化、浮雕和边缘核。", "线性卷积核，不是形态学极值。", 3),
        item(88, "svg-lighting-filter", "SVG Diffuse / Specular Lighting", "SVG 漫反射与镜面光照", "image", "LIGHT", "从 SourceAlpha 高度图估算法线，再用移动点光源求漫反射与镜面项。", "移动光源并调节表面尺度。", "从高度场重建光照，不是渐变高光。", 4),
        item(89, "svg-component-transfer", "SVG Component Transfer", "SVG 分量传递", "image", "CURVE", "feComponentTransfer 对 RGBA 通道应用 table、gamma 或 discrete 曲线。", "编辑通道曲线和模式。", "逐通道传递函数，不偏移 RGB 采样坐标。", 3),
        item(90, "seam-carving", "Seam Carving", "接缝裁剪", "image", "RESIZE", "动态规划寻找最低能量连续 seam 并逐条删除或插入。", "拖动目标宽度并保护区域。", "内容感知改变图像尺寸，不做普通缩放。", 5),
        item(91, "bilateral-filter", "Bilateral Filtering", "双边滤波", "image", "FILTER", "空间距离与颜色距离共同加权，实现保边平滑。", "移动探针并调整 sigma。", "权重依赖像素差异，不是固定卷积模糊。", 4),
        item(92, "kuwahara-filter", "Kuwahara Filtering", "Kuwahara 滤波", "image", "FILTER", "比较邻域象限方差，采用最均匀区域均值形成绘画块面。", "拖动半径与方向探针。", "非线性方差选择，不是双边权重平均。", 4),
        item(93, "floyd-steinberg-dithering", "Floyd–Steinberg Dithering", "Floyd–Steinberg 误差扩散", "image", "DITHER", "量化误差按 7/16、3/16、5/16、1/16 向未处理像素扩散。", "拖动量化分界线和色阶。", "显式误差扩散，不生成网点筛纹。", 4),
        item(94, "pixel-sorting", "Pixel Sorting", "像素排序", "image", "THRESHOLD", "按亮度阈值分段并沿扫描方向排序每段像素。", "拖动阈值与方向。", "重排像素段，不做运动拖尾或通道偏移。", 3),
        item(95, "slit-scan", "Slit-Scan Imaging", "狭缝扫描成像", "image", "TIME", "输出图像的空间列取自不同历史时间切片。", "移动场景并旋转时间狭缝。", "空间轴编码时间，不叠加旧帧残像。", 4),

        item(96, "arcball-manipulation", "Arcball Manipulation", "虚拟轨迹球操控", "spatial", "ORBIT", "将屏幕指针投影到虚拟球面，用四元数累积旋转。", "拖动模型并快速甩动。", "无欧拉角锁且不约束固定圆轨。", 4),
        item(97, "dolly-zoom", "Dolly Zoom", "滑动变焦", "spatial", "相机距离与视场角反向联动，保持前景尺寸同时改变透视压缩。", "拖动 dolly 轨道。", "前景尺度近似恒定，背景透视发生变化。", 4),
        item(98, "recursive-portal-rendering", "Recursive Portal Rendering", "递归传送门渲染", "spatial", "相机姿态通过成对门变换递归映射，并在门面内裁剪重绘。", "移动相机和旋转门体。", "递归重定向空间视图，不是镜面反射。", 5),
        item(99, "projective-texture-mapping", "Projective Texture Mapping", "投影纹理映射", "spatial", "以投影机 view-projection 矩阵生成表面纹理坐标与遮挡。", "移动投影机并改变焦锥。", "纹理来自另一相机投影，不是物体 UV。", 4),
        item(100, "parallax-occlusion-mapping", "Parallax Occlusion Mapping", "视差遮蔽映射", "spatial", "沿切线空间视线步进高度图并插值首次交点。", "倾斜视角与调节高度。", "改变纹理采样坐标制造自遮挡，不移动几何。", 5),
        item(101, "shadow-mapping", "Shadow Mapping", "阴影贴图", "spatial", "先渲染光源深度，再比较相机片元深度并做 PCF 采样。", "移动光源和遮挡体。", "基于光空间深度测试，不是径向暗角。", 5),
        item(102, "screen-space-reflections", "Screen-Space Reflections", "屏幕空间反射", "spatial", "在深度缓冲重建空间中沿反射方向步进并二分命中。", "移动相机和粗糙度探针。", "只能反射屏幕中可见信息，明确展示 miss 区域。", 5),
        item(103, "circle-of-confusion", "Circle of Confusion Depth of Field", "弥散圆景深", "spatial", "由焦距、焦平面和像素深度计算 CoC，再分层散景合成。", "拖动焦平面和光圈。", "模糊半径来自光学 CoC，不是统一高斯模糊。", 5),
        item(104, "weighted-blended-oit", "Weighted Blended OIT", "加权混合次序无关透明", "spatial", "透明片元分别累积加权颜色与 revealage，最后无排序合成。", "旋转重叠透明体并比较普通混合。", "避免逐物体深度排序，不是假玻璃材质。", 5),
        item(105, "constructive-solid-geometry", "Constructive Solid Geometry", "构造实体几何", "spatial", "用 BSP 多边形切分执行实体 union、subtract 与 intersect。", "拖动切割体并切换布尔运算。", "改变实体拓扑，不使用 SDF 光线步进。", 5),

        item(106, "stable-fluids", "Stable Fluids", "稳定流体", "physics-sim", "INJECT", "欧拉网格维护速度和染料，经平流、扩散与压力投影保持近似不可压缩。", "指针注入染料和动量。", "真实维护自平流速度场，不是噪声 UV 扭曲。", 5),
        item(107, "material-point-method", "Material Point Method", "材料点法", "physics-sim", "P2G、网格力学与 G2P 在材料点和背景网格间交换质量动量。", "拖动挡板挤压雪体。", "粒子代表连续介质并保存形变，不是装饰粒子。", 5),
        item(108, "xpbd-cloth", "Extended Position-Based Dynamics Cloth", "XPBD 布料", "physics-sim", "带 compliance 和累计拉格朗日乘子的拉伸、剪切与弯曲约束。", "抓取布角、移动碰撞体。", "二维织物多约束，不是单根 Verlet 绳。", 5),
        item(109, "meshless-shape-matching", "Meshless Shape Matching", "无网格形状匹配", "physics-sim", "点云以最小二乘最佳刚体变换生成回归目标并恢复整体形状。", "按压、扭曲和投掷软体。", "整体拟合目标，不由局部弹簧网络定义形状。", 5),
        item(110, "fabrik-inverse-kinematics", "FABRIK Inverse Kinematics", "FABRIK 逆运动学", "physics-sim", "骨段定长链从末端前向到达、再从根部后向校正并施加关节限位。", "拖动末端执行器。", "有根部、目标和关节限位，不是自由绳索。", 4),
        item(111, "chaotic-double-pendulum", "Chaotic Double Pendulum", "混沌双摆", "physics-sim", "两角度与两角速度构成耦合非线性 ODE，并用 RK4 积分微扰轨迹。", "拖动初始姿态并释放。", "展示初值敏感性，不是固定圆轨道。", 4),
        item(112, "electrostatic-field-lines", "Electrostatic Field-Line Tracing", "静电场线追踪", "physics-sim", "叠加点电荷反平方库仑场并沿归一化场方向积分曲线。", "拖放正负电荷。", "展示连续矢量场与积分线，不做 UI 吸附。", 4),
        item(113, "magnetic-pendulum", "Magnetic Pendulum", "磁摆吸引盆", "physics-sim", "受重力、阻尼和多个磁偶极吸引的摆锤落入不同吸引子。", "选择初值并拖动磁体。", "核心是混沌吸引盆，不是磁性停靠。", 4),
        item(114, "n-body-gravitation", "N-Body Gravitation", "N 体引力", "physics-sim", "多个质量体按成对万有引力相互加速，以 symplectic 积分保持轨道。", "投放质量体并拖动初速度。", "每个物体都是动态引力源，不受单一中心轨道约束。", 4),
        item(115, "shallow-water-equations", "Shallow-Water Equations", "浅水方程", "physics-sim", "二维高度与水平动量守恒方程传播波、反射并绕过障碍。", "点击扰动水面并移动闸门。", "维护自由表面高度，不求不可压缩染料流。", 5),

        item(116, "wave-function-collapse", "Wave Function Collapse", "波函数坍缩生成", "generative", "COLLAPSE", "每格维护可行图块集合，按最小熵观测并传播邻接约束。", "锁定图块、擦除局部并重新坍缩。", "展示熵与可能集收缩，不是随机贴砖。", 5),
        item(117, "l-system", "L-System", "林登迈尔系统", "generative", "GROW", "公理经产生式并行重写，再由 turtle 栈解释为分枝几何。", "编辑角度并逐代生长。", "拓扑由形式文法生成，不是固定路径形变。", 3),
        item(118, "space-colonization", "Space Colonization", "空间殖民生长", "generative", "GROW", "枝节点向影响半径内吸引点的平均方向生长并消耗近邻。", "绘制吸引区、移动光源与剪枝。", "结构来自外部吸引场，不来自预写文法。", 4),
        item(119, "diffusion-limited-aggregation", "Diffusion-Limited Aggregation", "扩散限制聚集", "generative", "RANDOM WALK", "随机游走体接触种子簇后不可逆粘附，形成分形拓扑。", "放置种子与漂移场。", "粒子粘附后停止，不是持续运动粒子场。", 4),
        item(120, "lenia", "Lenia", "Lenia 连续人工生命", "generative", "LIFE", "连续状态场经卷积核和增长函数更新，形成可移动生命体。", "绘制干扰并调核半径。", "单连续生命场，不是双化学物反应扩散。", 5),
        item(121, "differential-growth", "Differential Growth", "差分生长", "generative", "GROW", "边界节点沿切向增殖，同时受相邻弹性和非邻近排斥形成褶皱。", "绘制障碍并改变生长速率。", "增长的是一维边界拓扑，不是流体或形态目标。", 5),
        item(122, "abelian-sandpile", "Abelian Sandpile Model", "阿贝尔沙堆模型", "generative", "TOPPLE", "格点超过阈值便向邻居确定性 toppling，最终稳定态与加料顺序无关。", "连续投放沙粒并切换边界。", "演化由守恒 toppling，不模拟真实沙粒运动。", 4),
        item(123, "interactive-evolution", "Interactive Evolutionary Computation", "交互式进化计算", "generative", "SELECT", "用户选择表型作为适应度，基因经重组和变异产生下一代。", "挑选多个候选并繁殖。", "探索开放设计空间，不在预设目标间插值。", 4),
        item(124, "penrose-tiling", "Penrose Tiling", "Penrose 非周期铺砌", "generative", "INFLATE", "风筝/飞镖或菱形按 inflation/deflation 规则产生五重非周期铺砌。", "选择种子并逐级膨胀。", "确定性准周期结构，不是 WFC 约束采样。", 4),
        item(125, "cyclic-cellular-automaton", "Cyclic Cellular Automaton", "循环元胞自动机", "generative", "PAINT", "离散状态按循环捕食规则在满足邻居阈值时前进一相。", "绘制状态、改变邻域与阈值。", "多状态波前演化，不是 Lenia 连续卷积。", 4),

        item(126, "force-directed-graph", "Force-Directed Graph Layout", "力导向图布局", "data", "DRAG", "边吸引、节点排斥、碰撞与冷却系数共同求图布局。", "固定节点、展开社群。", "力由数据连边关系决定，没有预设槽位。", 4),
        item(127, "streamgraph", "Streamgraph", "流图", "data", "SCRUB", "多时间序列按 wiggle baseline 堆叠为连续层带。", "刷选时间并改变层排序。", "厚度编码定量序列，不是装饰波浪。", 4),
        item(128, "sankey-diagram", "Sankey Diagram", "桑基流图", "data", "FLOW", "守恒流量决定链接宽度，节点层级与链接碰撞经松弛求解。", "拖动节点并追踪源汇。", "有宽度的守恒网络路由，不是普通连线图。", 4),
        item(129, "horizon-graph", "Horizon Graph", "地平线图", "data", "BANDS", "时间序列按固定幅度切成多层 bands，再折叠叠加以压缩垂直空间。", "拖动 band 数与基准线。", "以分层折叠压缩序列，不用流图堆叠基线。", 4),
        item(130, "hierarchical-edge-bundling", "Hierarchical Edge Bundling", "层次边捆绑", "data", "HOVER", "非树边沿层级共同祖先路径插值，并由 tension 控制解捆程度。", "悬停节点并调节 tension。", "节点由层级固定，优化的是边路由。", 4),
        item(131, "brushing-and-linking", "Brushing and Linking", "刷选与联动", "data", "BRUSH", "多个视图共享记录 ID 与选择集合，一处刷选立即同步其他编码。", "在散点图框选记录。", "跨视图保持数据身份，不是单视图 hover。", 4),
        item(132, "bump-chart", "Bump Chart", "排名河流图", "data", "TIME", "实体按时间排名映射到离散纵位，并以对象恒常性连续交叉。", "拖动时间与锁定实体。", "编码名次变化，不编码数值堆叠。", 3),
        item(133, "chord-diagram", "Chord Diagram", "弦图", "data", "FOCUS", "矩阵行列总量映射外弧，成对流量映射内部 ribbon 宽度。", "悬停扇区过滤关系。", "圆周矩阵关系，不是层级边捆绑。", 4),
        item(134, "parallel-coordinates", "Parallel Coordinates", "平行坐标", "data", "BRUSH", "每条记录穿过多个数值轴，轴序与区间刷选共同过滤高维数据。", "刷选区间并拖动重排轴。", "表示高维记录，不是网络边。", 4),
        item(135, "beeswarm-plot", "Beeswarm Plot", "蜂群图", "data", "FILTER", "点沿数值轴定位，并通过一维碰撞松弛避免重叠。", "改变分组和数值筛选。", "位置一轴定量、另一轴仅防碰撞。", 3),

        item(136, "stft-spectrogram", "STFT Spectrogram", "短时傅里叶声谱图", "signal", "LISTEN", "重叠窗音频帧经 FFT 形成时间×频率能量历史。", "播放合成声、冻结并读取频率。", "二维坐标严格对应时频能量，不是音量波形。", 5),
        item(137, "audio-onset-detection", "Audio Onset Detection", "音频起始点检测", "signal", "TAP", "spectral flux、动态阈值与峰值拾取输出稀疏瞬态事件。", "敲击节奏或播放内置鼓点。", "输出离散起音时刻，不输出连续频谱。", 4),
        item(138, "yin-pitch-detection", "YIN Pitch Detection", "YIN 基频估计", "signal", "PITCH", "差分函数经累积均值归一化得到周期候选和置信度。", "拖动合成音高或启用麦克风。", "估计连续 F0，不检测瞬态或最大 FFT bin。", 5),
        item(139, "granular-synthesis", "Granular Synthesis", "颗粒合成", "signal", "GRAINS", "调度大量带窗微声粒，独立控制起点、时长、移调与密度。", "在二维音频纹理上拖动。", "主动重组重叠微声事件，不是粒子视觉换皮。", 5),
        item(140, "karplus-strong", "Karplus–Strong String Synthesis", "Karplus–Strong 拨弦合成", "signal", "PLUCK", "噪声激励进入循环延迟线与低通反馈，延迟长度决定音高。", "拨动多根弦并改变拨弦位置。", "声音来自采样级反馈延迟，不是视觉弹簧配音。", 5),
        item(141, "hrtf-spatialization", "HRTF Spatialization", "HRTF 空间化", "signal", "ORBIT", "声源与监听者姿态输入 HRTF panning 和距离衰减。", "戴耳机围绕头像拖动声源。", "主要反馈是听觉方位，轨道只是空间控制器。", 4),
        item(142, "chladni-figures", "Numerical Chladni Figures", "数值克拉尼图形", "signal", "MODES", "薄板本征模的零位移节点线聚集虚拟沙粒。", "调节频率、板形与固定点。", "图案来自驻波模态节点，不是反应扩散纹理。", 5),
        item(143, "spirograph", "Spirograph / Hypotrochoid", "万花尺内旋轮线", "signal", "GEARS", "内滚圆的半径比与笔偏心参数生成 hypotrochoid。", "拖动齿比和偏心距。", "固定齿轮运动方程，不重建任意路径频谱。", 3),
        item(144, "fourier-domain-filtering", "Fourier-Domain Filtering", "傅里叶域滤波", "signal", "FILTER", "二维图像 FFT 的复频谱乘以可绘制频率掩模后逆变换。", "在频谱上涂抹低通、带阻与方向掩模。", "直接编辑频域，不用空间卷积核。", 5),
        item(145, "shepard-risset-glissando", "Shepard–Risset Glissando", "谢泼德–里塞特无限滑音", "signal", "LISTEN", "跨八度正弦组按钟形包络循环换位，形成无尽上升或下降错觉。", "改变方向、速度与音色并试听。", "心理声学循环音高，不是频谱分析。", 4)
    ];
}));
