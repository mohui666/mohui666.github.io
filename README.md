# mohui666 的个人主页

Persona 3 风格的静态个人主页，展示公开项目、ASOUL 收藏、博客和友站。

- `index.html`：主菜单；`#about`、`#archive`、`#socials`、`#projects` 可直接分享。
- `projects/index.html`：项目大厅，兼容原入口。
- `persona/content.js`：个人介绍、27 个项目、分类和收藏链接；中英文内容在这里维护。
- `island/`：默绘岛，开放世界驾驶作品集；六个地区展示个人档案与 22 个公开项目，支持越野车、摩托、快艇、跟随镜头和手机摇杆。
- `persona/site.js`、`persona/site.css`：原生浏览器模块、场景交互和响应式样式。
- 原有博客、故宫、宇宙实验室、动效、游戏等子项目保持各自入口与实现。

无需构建或安装依赖，用任意静态 HTTP 服务预览仓库即可，例如 `npx serve .`。已有 GitHub Pages 工作流继续直接发布静态文件。

鼠标、触屏和键盘均可操作。方向键选择，回车确认，Esc 返回；项目支持分类、关键词搜索和独立打开链接；显示设置可切换中英文、暂停动态背景，并记住偏好。系统减少动态效果设置默认生效。视频与字体随站点本地提供，背景视频静音播放。

视觉参考 [Persona 3 themed website](https://persona3-themed-website.vercel.app/)，场景几何与素材来自 [MdHussain121/Persona3_themed_website](https://github.com/MdHussain121/Persona3_themed_website)，原项目致谢 [blairxu13/persona3-website](https://github.com/blairxu13/persona3-website)。游戏素材属于 ATLUS / SEGA；本站为非官方个人主页。Anton、Bebas Neue、Barlow Condensed、Montserrat 字体的 OFL 说明保留在 `persona/fonts/`。参见 [完整来源说明](persona/credits.html)。
