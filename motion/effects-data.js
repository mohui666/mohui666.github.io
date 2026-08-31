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

    var source = [
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

    var summaries = {
        1: "程序噪声与指针速度共同驱动图像 UV 位移；它是无反馈纹理扭曲，不伪称流体求解。",
        26: "滚动连续调制 feTurbulence 与 feDisplacementMap，固定矢量轮廓经过真实 SVG 滤镜场位移。",
        33: "片元着色器在屏幕空间沿像素到光源的方向做径向采样，形成随遮挡变化的光束。",
        36: "允许有限边界穿透，以接触弹簧、阻尼和法向力连续推出物体。",
        37: "释放速度进入重力积分，同时保存角速度、姿态与地面碰撞状态。"
    };

    var effects = source.map(function (item) {
        return {
            id: item[0],
            slug: item[1],
            titleEn: item[2],
            titleZh: item[3],
            modeLabel: item[4],
            sectionId: item[5],
            legacy: true,
            palette: palettes[(item[0] - 1) % palettes.length],
            summaryZh: summaries[item[0]] || item[3] + "的独立交互实验。目录封面直接运行这一详情页。"
        };
    });

    var byId = {};
    var bySlug = {};
    effects.forEach(function (effect) {
        byId[effect.id] = effect;
        bySlug[effect.slug] = effect;
    });

    return {
        total: effects.length,
        maxId: effects.length,
        handAuthoredCount: effects.length,
        generatedCount: 0,
        effects: effects,
        byId: byId,
        bySlug: bySlug,
        sections: sections,
        palettes: palettes
    };
}));
