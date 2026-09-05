/*
 * 站点共享动效：柔和光斑背景、滚动渐入、打字机标题。
 * 所有功能都可独立降级：缺少对应元素或用户偏好减少动效时自动跳过。
 */
(function () {
    "use strict";

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- 柔和光斑（bokeh）背景 ---------- */
    function initBokeh() {
        var canvas = document.createElement("canvas");
        canvas.setAttribute("aria-hidden", "true");
        canvas.style.cssText = "position:fixed;inset:0;z-index:-1;pointer-events:none;";
        document.body.appendChild(canvas);

        var ctx = canvas.getContext("2d");
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var w = 0;
        var h = 0;
        var orbs = [];
        var animationFrame = null;
        var mouse = { x: -9999, y: -9999 };
        var tints = [
            [255, 255, 255],
            [165, 180, 252],
            [125, 211, 252],
            [240, 171, 252]
        ];

        function makeOrb() {
            var tint = tints[Math.floor(Math.random() * tints.length)];
            return {
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.16,
                vy: (Math.random() - 0.5) * 0.12 - 0.04,
                r: 8 + Math.random() * 42,
                tint: tint,
                alpha: 0.04 + Math.random() * 0.1,
                phase: Math.random() * Math.PI * 2,
                pulse: 0.4 + Math.random() * 0.8
            };
        }

        function resize() {
            w = window.innerWidth;
            h = window.innerHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = w + "px";
            canvas.style.height = h + "px";
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            var count = Math.max(14, Math.min(34, Math.floor((w * h) / 52000)));
            while (orbs.length < count) orbs.push(makeOrb());
            orbs.length = count;
        }

        function drawOrb(o, t) {
            var breathe = 1 + 0.12 * Math.sin(t * 0.0006 * o.pulse + o.phase);
            var r = o.r * breathe;
            var mdx = o.x - mouse.x;
            var mdy = o.y - mouse.y;
            var mdist = Math.hypot(mdx, mdy);
            var glow = mdist < 240 ? 1 + 0.7 * (1 - mdist / 240) : 1;
            var grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, r);
            var c = o.tint;
            grad.addColorStop(0, "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (o.alpha * glow) + ")");
            grad.addColorStop(0.6, "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (o.alpha * glow * 0.35) + ")");
            grad.addColorStop(1, "rgba(" + c[0] + "," + c[1] + "," + c[2] + ",0)");
            ctx.beginPath();
            ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
        }

        function step(t) {
            ctx.clearRect(0, 0, w, h);
            var i;
            var o;
            for (i = 0; i < orbs.length; i++) {
                o = orbs[i];
                o.x += o.vx;
                o.y += o.vy;
                if (o.x < -60) o.x = w + 60;
                if (o.x > w + 60) o.x = -60;
                if (o.y < -60) o.y = h + 60;
                if (o.y > h + 60) o.y = -60;
                drawOrb(o, t);
            }
            animationFrame = window.requestAnimationFrame(step);
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
            /* 减少动效时只画一帧静态光斑 */
            var i;
            for (i = 0; i < orbs.length; i++) {
                drawOrb(orbs[i], 0);
            }
            return;
        }
        function syncAnimation() {
            if (animationFrame !== null) {
                window.cancelAnimationFrame(animationFrame);
                animationFrame = null;
            }
            if (!document.hidden) {
                animationFrame = window.requestAnimationFrame(step);
            }
        }

        document.addEventListener("visibilitychange", syncAnimation);
        syncAnimation();
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
        caret.textContent = "▏";
        caret.style.cssText = "color:rgba(255,255,255,0.85);font-weight:300;-webkit-text-fill-color:rgba(255,255,255,0.85);";
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
        initBokeh();
        initReveal();
        initTyping();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
