(function () {
    "use strict";

    var factories = {};
    var helpers = {
        clamp: function (value, minimum, maximum) { return Math.min(Math.max(value, minimum), maximum); },
        lerp: function (start, end, amount) { return start + (end - start) * amount; },
        distance: function (ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); },
        random: function (minimum, maximum) { return minimum + Math.random() * (maximum - minimum); },
        map: function (value, inMin, inMax, outMin, outMax) {
            return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
        }
    };

    window.MotionExtended = {
        helpers: helpers,
        register: function (definitions) { Object.assign(factories, definitions); }
    };

    document.addEventListener("DOMContentLoaded", function () {
        var body = document.body;
        var isPreview = new URLSearchParams(window.location.search).has("preview");
        body.classList.toggle("is-preview", isPreview);
        var effect = body.dataset.effect;
        var stage = document.querySelector("[data-stage]");
        var surface = document.querySelector("[data-surface]");
        var zone = document.querySelector("[data-zone]");
        var canvas = document.querySelector("[data-canvas]");
        var dom = document.querySelector("[data-dom]");
        var stateLabel = document.querySelector("[data-state]");
        var promptLabel = document.querySelector("[data-prompt]");
        var actionButton = document.querySelector("[data-action]");
        var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

        if (!stage || !surface || !zone || !canvas || !dom || !factories[effect]) return;

        var context = null;
        var webgl = null;
        var pointers = new Map();
        var pointer = { x: 0.5, y: 0.5, px: 0, py: 0, pressure: 0.5, tiltX: 0, tiltY: 0, down: false };
        var size = { width: 1, height: 1, dpr: 1 };
        var frameId = 0;
        var lastTime = 0;
        var visible = true;
        var reducedMotion = motionQuery.matches;
        var scrollPosition = window.scrollY;
        var scrollVelocity = 0;
        var scrollProgress = 0;
        var renderer;

        function setState(value) { if (stateLabel) stateLabel.textContent = value; }
        function setPrompt(value) { if (promptLabel) promptLabel.textContent = value; }
        function setAction(value) { if (actionButton) actionButton.textContent = value; }

        function useDom(markup) {
            canvas.hidden = true;
            dom.hidden = false;
            dom.innerHTML = markup;
            return dom;
        }

        function useCanvas(background) {
            if (!context) {
                context = canvas.getContext("2d", { alpha: false });
                api.context = context;
            }
            canvas.hidden = false;
            dom.hidden = true;
            dom.innerHTML = "";
            if (background) zone.style.background = background;
            return context;
        }

        function useWebGL(options) {
            if (!webgl) {
                webgl = canvas.getContext("webgl2", options || { alpha: false, antialias: true });
                api.gl = webgl;
            }
            canvas.hidden = false;
            dom.hidden = true;
            dom.innerHTML = "";
            return webgl;
        }

        function getPoint(event) {
            var bounds = zone.getBoundingClientRect();
            return {
                x: helpers.clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
                y: helpers.clamp((event.clientY - bounds.top) / bounds.height, 0, 1),
                px: helpers.clamp(event.clientX - bounds.left, 0, bounds.width),
                py: helpers.clamp(event.clientY - bounds.top, 0, bounds.height),
                pressure: event.pressure || (event.buttons ? 0.5 : 0),
                tiltX: event.tiltX || 0,
                tiltY: event.tiltY || 0,
                pointerType: event.pointerType,
                id: event.pointerId
            };
        }

        var api = {
            body: body,
            stage: stage,
            surface: surface,
            zone: zone,
            canvas: canvas,
            context: context,
            gl: webgl,
            dom: dom,
            pointer: pointer,
            pointers: pointers,
            size: size,
            helpers: helpers,
            useDom: useDom,
            useCanvas: useCanvas,
            useWebGL: useWebGL,
            setState: setState,
            setPrompt: setPrompt,
            setAction: setAction,
            invalidate: renderStatic,
            isPreview: isPreview,
            isReduced: function () { return reducedMotion; }
        };

        function resize() {
            var bounds = zone.getBoundingClientRect();
            size.width = Math.max(1, bounds.width);
            size.height = Math.max(1, bounds.height);
            size.dpr = Math.min(window.devicePixelRatio || 1, isPreview ? 0.75 : 2, 1920 / size.width, 1080 / size.height);
            var pixelWidth = Math.max(1, Math.round(size.width * size.dpr));
            var pixelHeight = Math.max(1, Math.round(size.height * size.dpr));
            if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
                canvas.width = pixelWidth;
                canvas.height = pixelHeight;
            }
            if (context) context.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
            if (webgl) webgl.viewport(0, 0, pixelWidth, pixelHeight);
            if (renderer && renderer.resize) renderer.resize(size.width, size.height);
            renderStatic();
        }

        function updateScroll(delta) {
            if (body.dataset.mode !== "scroll") return;
            var current = window.scrollY;
            var rawVelocity = delta > 0 ? (current - scrollPosition) / delta * 16.667 : 0;
            scrollVelocity = helpers.lerp(scrollVelocity, rawVelocity, 0.22);
            scrollPosition = current;
            var range = Math.max(1, stage.offsetHeight - window.innerHeight);
            scrollProgress = helpers.clamp(-stage.getBoundingClientRect().top / range, 0, 1);
            if (renderer && renderer.scroll) renderer.scroll(scrollProgress, scrollVelocity);
        }

        function draw(now, delta, isStatic) {
            updateScroll(delta);
            if (renderer && renderer.frame) renderer.frame(now, delta, reducedMotion, isStatic);
        }

        function renderStatic() {
            if (!renderer) return;
            draw(performance.now(), 0, true);
        }

        function frame(now) {
            frameId = 0;
            if (reducedMotion || document.hidden || !visible) return;
            var delta = lastTime ? Math.min(50, now - lastTime) : 16.667;
            lastTime = now;
            draw(now, delta, false);
            frameId = requestAnimationFrame(frame);
        }

        function start() {
            if (frameId) cancelAnimationFrame(frameId);
            frameId = 0;
            lastTime = 0;
            if (reducedMotion) {
                renderStatic();
            } else if (!document.hidden && visible) {
                frameId = requestAnimationFrame(frame);
            }
        }

        function handlePointer(event, type) {
            var point = getPoint(event);
            Object.assign(pointer, point);
            pointer.down = type !== "up" && type !== "cancel" && (event.buttons > 0 || type === "down");
            if (type === "down" || type === "move") pointers.set(event.pointerId, point);
            if (renderer && renderer.pointer) renderer.pointer(type, point, event);
            if (type === "up" || type === "cancel") pointers.delete(event.pointerId);
            if (reducedMotion) renderStatic();
        }

        zone.addEventListener("pointerdown", function (event) {
            handlePointer(event, "down");
            zone.setPointerCapture(event.pointerId);
        });
        zone.addEventListener("pointermove", function (event) {
            if (event.pointerType === "mouse" || pointers.has(event.pointerId)) handlePointer(event, "move");
        }, { passive: true });
        zone.addEventListener("pointerup", function (event) {
            handlePointer(event, "up");
            if (zone.hasPointerCapture(event.pointerId)) zone.releasePointerCapture(event.pointerId);
        });
        zone.addEventListener("pointercancel", function (event) { handlePointer(event, "cancel"); });
        zone.addEventListener("wheel", function (event) {
            if (renderer && renderer.wheel && renderer.wheel(event.deltaY, event)) event.preventDefault();
            if (reducedMotion) renderStatic();
        }, { passive: false });
        zone.addEventListener("keydown", function (event) {
            if (renderer && renderer.keydown) renderer.keydown(event);
            if (reducedMotion) renderStatic();
        });

        if (actionButton) {
            actionButton.addEventListener("click", function () {
                if (renderer && renderer.action) renderer.action();
                renderStatic();
            });
        }

        window.addEventListener("resize", resize);
        window.addEventListener("scroll", function () { if (reducedMotion) renderStatic(); }, { passive: true });
        document.addEventListener("visibilitychange", start);
        motionQuery.addEventListener("change", function () {
            reducedMotion = motionQuery.matches;
            setState(reducedMotion ? "MOTION REDUCED" : "LIVE / READY");
            start();
        });

        var observer = new IntersectionObserver(function (entries) {
            visible = entries[0].isIntersecting;
            start();
        }, { threshold: 0.01 });
        observer.observe(stage);

        renderer = factories[effect](api) || {};
        resize();
        start();
    });
}());
