# Motion Field · 100 项机制评估

这批页面把 React Bits 当作完成度与响应感参照，不把它当作选题库。术语来自界面编排、HCI、浏览器规范、计算几何、图像处理、三维渲染、数值模拟、生成系统、数据可视化、信号处理和音频合成。

## 冻结规则

每项必须同时满足以下条件：

1. 有可说明的状态变量、更新规则或图形管线，而不是换配色、换文案、换粒子形状。
2. 与已有 45 项及本批其他项在核心机制上不同；同一算法跨领域只保留一次。
3. 目录封面与详情页运行同一处理器，预览不得伪造另一套动画。
4. 至少提供一种直接操纵，并让输入改变算法内部状态而非只移动镜头光斑。
5. 移动端限制 DPR、计算规模与预览帧率，但不把算法替换成低质量占位效果。

最终候选经过一轮交叉去重。被淘汰的典型项包括：与 Marking Menu 重叠的 Pie Menu、被 Lenia 覆盖的 Game of Life、与已有滚动场景重叠的普通 Scroll Timeline、与 Voronoi 重复的 Voronoi Fracture / Voronoi Treemap，以及容易退化成同类粒子场的 Boids / Physarum。

## 100 项清单

| ID | 领域 | 术语 | 主要验收点 |
|---:|---|---|---|
| 46–55 | Interface Choreography | Shared Axis、Fade Through、Explode、Radial Reaction、Staggered Choreography、Staged Transition、Predictive Back、Swipe-to-Dismiss、Symbol Replace、Variable Color Symbol | 分别固定为轴向关系、交换点、epicenter、距离波前、对象错时、属性阶段、可逆导航、命令阈值、图层交换和语义图层进度 |
| 56–65 | HCI Navigation | Semantic Zoom、SDAZ、Smooth & Efficient Zoom/Pan、Overview + Detail、Fisheye Menu、Marking Menu、Magic Lens、Dynamic Queries、Bubble Cursor、Crossing-based Interaction | 每项使用各自的信息空间或目标获取模型，Bubble Cursor 不施加磁力，Magic Lens 不做光学折射 |
| 66–75 | Temporal Control | CSS Scroll Snap、Scroll Anchoring、Scroll Shadows、Scroll Edge Effect、Swipe-to-Refresh、Edge Scrolling、Rate-Controlled Scrolling、View Progress Timeline、Variable Font Interpolation、RSVP | 展示浏览器滚动语义、速率控制、元素视图进度和字形/阅读时间模型，不复刻现有滚动场景 |
| 76–85 | Computational Geometry | Voronoi、Delaunay、Convex Hull、Alpha Shape、Poisson-Disk、Marching Squares、Medial Axis、Fourier Epicycles、Apollonian Packing、Catmull–Clark | 分别呈现最近点区域、空外接圆、极点边界、尺度凹包、蓝噪声约束、等值线、骨架、频谱重建、相切圆和细分拓扑 |
| 86–95 | Image Processes | SVG Morphology、Convolution Matrix、SVG Lighting、Component Transfer、Seam Carving、Bilateral、Kuwahara、Floyd–Steinberg、Pixel Sorting、Slit-Scan | 使用真实邻域/通道/能量/历史时间规则；Floyd–Steinberg 明确显示误差扩散权重 |
| 96–105 | Spatial Projection | Arcball、Dolly Zoom、Recursive Portal、Projective Texture、POM、Shadow Mapping、SSR、Circle of Confusion、Weighted OIT、CSG | 页面分别展示四元数、透视补偿、递归相机、投影矩阵、高度步进、光深度、屏幕射线、CoC、透明累积和 BSP 布尔 |
| 106–115 | Physical Simulation | Stable Fluids、MPM、XPBD Cloth、Meshless Shape Matching、FABRIK、Double Pendulum、Electrostatic Field Lines、Magnetic Pendulum、N-Body Gravity、Shallow Water | 必须保留各求解器的核心状态；Stable Fluids 需要速度场与压力投影，XPBD 需要 compliance，CSG/MPM 不得以视觉近似冒充 |
| 116–125 | Emergent Systems | WFC、L-System、Space Colonization、DLA、Lenia、Differential Growth、Abelian Sandpile、Interactive Evolution、Penrose Tiling、Cyclic CA | 约束传播、文法、吸引场、不可逆粘附、连续生命场、边界增殖、toppling、选择变异、非周期 inflation、循环捕食各自独立 |
| 126–135 | Data Motion | Force Graph、Streamgraph、Sankey、Horizon Graph、Edge Bundling、Brushing and Linking、Bump Chart、Chord Diagram、Parallel Coordinates、Beeswarm | 视觉运动必须保持数据身份、守恒量或布局约束，不使用无数据含义的装饰路径 |
| 136–145 | Audio & Signal | STFT、Onset Detection、YIN、Granular Synthesis、Karplus–Strong、HRTF、Chladni、Spirograph、Fourier-Domain Filtering、Shepard–Risset | 区分分析、事件检测、基频估计、合成、空间化、模态、参数曲线、频域编辑与心理声学错觉 |

## 风险分级

- 高风险、必须逐项验收：MPM、Stable Fluids、XPBD Cloth、CSG、SSR、Weighted OIT、Recursive Portal、Seam Carving、Medial Axis、Catmull–Clark、WFC、Lenia、STFT、Granular Synthesis、Fourier-Domain Filtering。
- 中风险：需要真实几何或状态但可在 CPU/Canvas 规模内完成的 HCI、计算几何、数据布局和多数生成系统。
- 低风险不等于允许做成模板：Fade Through、Scroll Shadows、Convex Hull 等仍须以自己的边界条件和状态反馈呈现。

逐项的中文名、核心机制、主交互、去重说明和复杂度记录在 [`study-manifest.js`](./study-manifest.js)；它也是目录和页面校验的唯一术语清单。
