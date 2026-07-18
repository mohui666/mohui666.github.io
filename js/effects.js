/*
 * 站点共享动效：粒子连线背景、滚动渐入、打字机标题、扫描线。
 * 所有功能都可独立降级：缺少对应元素或用户偏好减少动效时自动跳过。
 */
(function () {
    "use strict";

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- 粒子连线背景 ---------- */
    function initParticles() {
        var canvas = document.createElement("canvas");
        canvas.setAttribute("aria-hidden", "true");
        canvas.style.cssText = "position:fixed;inset:0;z-index:-1;pointer-events:none;";
        document.body.appendChild(canvas);

        var ctx = canvas.getContext("2d");
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var w = 0;
        var h = 0;
        var points = [];
        var mouse = { x: -9999, y: -9999 };

        function resize() {
            w = window.innerWidth;
            h = window.innerHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = w + "px";
            canvas.style.height = h + "px";
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            var count = Math.max(28, Math.min(80, Math.floor((w * h) / 22000)));
            while (points.length < count) {
                points.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 0.22,
                    vy: (Math.random() - 0.5) * 0.22,
                    r: 1 + Math.random() * 1.4
                });
            }
            points.length = count;
        }

        function step() {
            ctx.clearRect(0, 0, w, h);
            var i;
            var j;
            var p;
            for (i = 0; i < points.length; i++) {
                p = points[i];
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < -20) p.x = w + 20;
                if (p.x > w + 20) p.x = -20;
                if (p.y < -20) p.y = h + 20;
                if (p.y > h + 20) p.y = -20;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(85, 230, 165, 0.4)";
                ctx.fill();
            }
            for (i = 0; i < points.length; i++) {
                for (j = i + 1; j < points.length; j++) {
                    var dx = points[i].x - points[j].x;
                    var dy = points[i].y - points[j].y;
                    var dist = Math.hypot(dx, dy);
                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.moveTo(points[i].x, points[i].y);
                        ctx.lineTo(points[j].x, points[j].y);
                        ctx.strokeStyle = "rgba(95, 201, 255, " + (0.1 * (1 - dist / 120)) + ")";
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                }
                var mdx = points[i].x - mouse.x;
                var mdy = points[i].y - mouse.y;
                var mdist = Math.hypot(mdx, mdy);
                if (mdist < 160) {
                    ctx.beginPath();
                    ctx.moveTo(points[i].x, points[i].y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.strokeStyle = "rgba(85, 230, 165, " + (0.22 * (1 - mdist / 160)) + ")";
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
            window.requestAnimationFrame(step);
        }

        resize();
        window.addEventListener("resize", resize);
        window.addEventListener("pointermove", function (e) {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        });
        window.addEventListener("pointerleave", function () {
            mouse.x = -9999;
            mouse.y = -9999;
        });

        if (reduceMotion) {
            /* 减少动效时只画一帧静态星点 */
            var i;
            for (i = 0; i < points.length; i++) {
                ctx.beginPath();
                ctx.arc(points[i].x, points[i].y, points[i].r, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(85, 230, 165, 0.3)";
                ctx.fill();
            }
            return;
        }
        window.requestAnimationFrame(step);
    }

    /* ---------- 扫描线 ---------- */
    function initScanline() {
        if (reduceMotion) return;
        var bar = document.createElement("div");
        bar.setAttribute("aria-hidden", "true");
        bar.style.cssText =
            "position:fixed;left:0;right:0;top:-14vh;height:14vh;z-index:31;pointer-events:none;" +
            "background:linear-gradient(180deg,transparent,rgba(103,232,190,0.05),transparent);";
        document.body.appendChild(bar);
        bar.animate(
            [{ transform: "translateY(0)" }, { transform: "translateY(128vh)" }],
            { duration: 9000, iterations: Infinity, easing: "linear" }
        );
    }

    /* ---------- 滚动渐入 ---------- */
    function initReveal() {
        var selectors = [
            ".hero-panel", ".quick-strip > div", ".link-card", ".site-footer",
            ".hero-card", ".content-card", ".list-card", ".video-card",
            ".card-link", ".row-link", ".info-list li",
            ".chapter-card", ".catalog-card", ".catalog-list li"
        ];
        var targets = [];
        selectors.forEach(function (sel) {
            document.querySelectorAll(sel).forEach(function (el) {
                if (targets.indexOf(el) === -1) targets.push(el);
            });
        });
        if (!targets.length) return;

        if (reduceMotion || !("IntersectionObserver" in window)) return;

        targets.forEach(function (el) {
            el.classList.add("fx-hidden");
        });

        var observer = new IntersectionObserver(function (entries) {
            var shown = 0;
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var el = entry.target;
                observer.unobserve(el);
                el.style.animationDelay = shown * 90 + "ms";
                shown++;
                el.classList.remove("fx-hidden");
                el.classList.add("fx-reveal");
            });
        }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });

        targets.forEach(function (el) {
            observer.observe(el);
        });
    }

    /* ---------- 打字机标题 ---------- */
    function initTyping() {
        var nodes = Array.prototype.slice.call(document.querySelectorAll("[data-typing]"));
        if (!nodes.length || reduceMotion) return;

        var caret = document.createElement("span");
        caret.setAttribute("aria-hidden", "true");
        caret.textContent = "▊";
        caret.style.cssText = "color:#55e6a5;font-weight:400;-webkit-text-fill-color:#55e6a5;";
        caret.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 900,
            iterations: Infinity,
            easing: "steps(1)"
        });

        var texts = nodes.map(function (el) {
            var text = el.textContent;
            el.textContent = "";
            el.setAttribute("aria-label", text);
            return text;
        });

        function typeLine(index) {
            if (index >= nodes.length) return;
            var el = nodes[index];
            var text = texts[index];
            var i = 0;
            el.appendChild(caret);
            var timer = window.setInterval(function () {
                i++;
                el.textContent = text.slice(0, i);
                el.appendChild(caret);
                if (i >= text.length) {
                    window.clearInterval(timer);
                    window.setTimeout(function () {
                        typeLine(index + 1);
                    }, 260);
                }
            }, 110);
        }

        window.setTimeout(function () {
            typeLine(0);
        }, 350);
    }

    function init() {
        initParticles();
        initScanline();
        initReveal();
        initTyping();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
