(function () {
    "use strict";

    var API = window.MotionStudy;
    var slug = document.body.dataset.study;
    var study = window.MotionStudyManifest.find(function (entry) { return entry.slug === slug; });
    var factory = API.registry[slug];
    if (!study || !factory) throw new Error("Missing exact motion study handler: " + slug);

    var stage = document.querySelector("[data-study-stage]");
    var canvas = document.querySelector("[data-study-canvas]");
    var dom = document.querySelector("[data-study-dom]");
    var stateNode = document.querySelector("[data-study-state]");
    var promptNode = document.querySelector("[data-study-prompt]");
    var action = document.querySelector("[data-study-action]");
    var meter = document.querySelector("[data-study-meter]");
    var preview = new URLSearchParams(location.search).has("preview");
    var reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var mobile = matchMedia("(max-width: 760px), (pointer: coarse)").matches;
    var active = !preview;
    var visible = !document.hidden;
    var width = 1, height = 1, dpr = 1, now = performance.now(), last = now, lastPointerTime = now, frame = 0, accumulator = 0;
    var pointer = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, vx: 0, vy: 0, down: false, inside: false, pressure: 0, type: "mouse" };
    var activePointerIds = new Set();
    var previewPointerId = -1;
    var audioContext = null;
    var lastState = "", lastPrompt = "", lastAction = "", lastMeter = -1;

    if (preview) document.documentElement.classList.add("motion-study-preview");

    var env = {
        API: API,
        study: study,
        stage: stage,
        canvas: canvas,
        dom: dom,
        pointer: pointer,
        preview: preview,
        mobile: mobile,
        reducedMotion: reducedMotion,
        width: width,
        height: height,
        dpr: dpr,
        time: 0,
        dt: 0,
        accent: getComputedStyle(document.body).getPropertyValue("--accent").trim() || "#7dd3fc",
        accent2: getComputedStyle(document.body).getPropertyValue("--accent-2").trim() || "#f0abfc",
        setState: function (label, prompt) {
            if (label !== lastState) { stateNode.textContent = label; lastState = label; }
            if (prompt && prompt !== lastPrompt) { promptNode.textContent = prompt; lastPrompt = prompt; }
        },
        setAction: function (label) { if (label !== lastAction) { action.textContent = label; lastAction = label; } },
        setMeter: function (value) {
            var next = API.clamp(value, 0, 1);
            if (Math.abs(next - lastMeter) > 0.002) { meter.style.setProperty("--study-progress", next); lastMeter = next; }
        },
        audio: function () {
            if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (audioContext.state === "suspended") audioContext.resume();
            return audioContext;
        },
        requestFrame: wake
    };

    var effect = factory(env);

    function resize() {
        var rect = stage.getBoundingClientRect();
        width = Math.max(1, rect.width);
        height = Math.max(1, rect.height);
        dpr = Math.min(window.devicePixelRatio || 1, preview || mobile ? 1 : 1.6);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
        env.width = width; env.height = height; env.dpr = dpr;
        if (effect.resize) effect.resize(width, height, dpr);
        wake();
    }

    function local(event) {
        var rect = stage.getBoundingClientRect();
        return { x: API.clamp((event.clientX - rect.left) / rect.width, 0, 1), y: API.clamp((event.clientY - rect.top) / rect.height, 0, 1) };
    }

    function updatePointer(position, event) {
        var pointerTime = performance.now();
        var elapsed = Math.max(8, pointerTime - lastPointerTime) / 1000;
        lastPointerTime = pointerTime;
        pointer.px = pointer.x; pointer.py = pointer.y;
        pointer.x = position.x; pointer.y = position.y;
        pointer.vx = (pointer.x - pointer.px) / elapsed;
        pointer.vy = (pointer.y - pointer.py) / elapsed;
        pointer.pressure = event && event.pressure || (pointer.down ? 0.5 : 0);
        pointer.type = event && event.pointerType || pointer.type;
    }

    function resetPointerMotion() {
        pointer.down = activePointerIds.size > 0;
        pointer.pressure = pointer.down ? pointer.pressure : 0;
        if (!pointer.down) { pointer.vx = 0; pointer.vy = 0; }
    }

    function cancelPointer(event) {
        if (!activePointerIds.has(event.pointerId)) return;
        activePointerIds.delete(event.pointerId);
        resetPointerMotion();
        if (effect.pointerCancel) effect.pointerCancel(pointer, event);
        else if (effect.pointerUp) effect.pointerUp(pointer, event);
        wake();
    }

    function cancelAll(reason) {
        var ids = Array.from(activePointerIds);
        activePointerIds.clear();
        resetPointerMotion();
        ids.forEach(function (pointerId) {
            var event = { pointerId: pointerId, type: reason, pressure: 0, pointerType: pointer.type };
            if (effect.pointerCancel) effect.pointerCancel(pointer, event);
            else if (effect.pointerUp) effect.pointerUp(pointer, event);
        });
        if (effect.cancelAll) effect.cancelAll(reason);
        wake();
    }

    stage.addEventListener("pointerenter", function () { pointer.inside = true; wake(); });
    stage.addEventListener("pointerleave", function () { pointer.inside = false; if (!pointer.down && effect.pointerLeave) effect.pointerLeave(pointer); wake(); });
    stage.addEventListener("pointerdown", function (event) {
        updatePointer(local(event), event);
        activePointerIds.add(event.pointerId);
        pointer.down = true; pointer.inside = true;
        stage.focus({ preventScroll: true });
        stage.setPointerCapture(event.pointerId);
        if (effect.pointerDown) effect.pointerDown(pointer, event);
        wake();
    });
    stage.addEventListener("pointermove", function (event) {
        updatePointer(local(event), event);
        if (effect.pointerMove) effect.pointerMove(pointer, event);
        wake();
    }, { passive: true });
    stage.addEventListener("pointerup", function (event) {
        updatePointer(local(event), event);
        activePointerIds.delete(event.pointerId);
        resetPointerMotion();
        if (effect.pointerUp) effect.pointerUp(pointer, event);
        wake();
    });
    stage.addEventListener("pointercancel", cancelPointer);
    stage.addEventListener("lostpointercapture", cancelPointer);
    stage.addEventListener("wheel", function (event) {
        if (effect.wheel) { effect.wheel(event.deltaX, event.deltaY, event); event.preventDefault(); wake(); }
    }, { passive: false });
    stage.addEventListener("keydown", function (event) {
        if (effect.keyDown) effect.keyDown(event);
        if (event.key === "Escape" && activePointerIds.size) cancelAll("escape");
        if (!event.defaultPrevented && (event.key === "Enter" || event.key === " ") && event.target === stage) { action.click(); event.preventDefault(); }
        wake();
    });
    action.addEventListener("click", function () { if (effect.action) effect.action(); wake(); });

    function previewDrive(time) {
        if (!preview || reducedMotion) return;
        var cycle = time % 8;
        var pos = { x: 0.5 + Math.cos(time * 0.71 + study.id) * 0.28, y: 0.5 + Math.sin(time * 0.93 + study.id * 0.17) * 0.28 };
        var previewEvent = { pointerId: previewPointerId, pointerType: "mouse", pressure: pointer.down ? 0.5 : 0, type: "pointermove" };
        updatePointer(pos, previewEvent);
        pointer.inside = true;
        if (effect.demo) {
            effect.demo(time, cycle);
            return;
        }
        if (cycle > 1 && cycle < 3.8 && !pointer.down) {
            activePointerIds.add(previewPointerId);
            pointer.down = true;
            previewEvent.type = "pointerdown";
            previewEvent.pressure = 0.5;
            if (effect.pointerDown) effect.pointerDown(pointer, previewEvent);
        }
        if (pointer.down && effect.pointerMove) { previewEvent.type = "pointermove"; previewEvent.pressure = 0.5; effect.pointerMove(pointer, previewEvent); }
        if (cycle >= 3.8 && pointer.down) {
            activePointerIds.delete(previewPointerId);
            resetPointerMotion();
            previewEvent.type = "pointerup";
            previewEvent.pressure = 0;
            if (effect.pointerUp) effect.pointerUp(pointer, previewEvent);
        }
        if (cycle > 6.9 && cycle < 7.0 && effect.action) effect.action();
    }

    function tick(timestamp) {
        frame = 0;
        if (!active || !visible) return;
        var raw = Math.min(0.05, Math.max(0.001, (timestamp - last) / 1000));
        last = timestamp;
        var cap = preview || mobile ? 1 / 30 : 1 / 60;
        accumulator += raw;
        if (accumulator < cap * 0.82) { frame = requestAnimationFrame(tick); return; }
        var dt = Math.min(0.034, accumulator);
        accumulator = 0;
        now = timestamp;
        env.time = timestamp / 1000;
        env.dt = reducedMotion ? Math.min(dt, 1 / 30) : dt;
        previewDrive(env.time);
        if (effect.update) effect.update(env.dt, env.time);
        if (effect.draw) effect.draw(env.time, env.dt);
        frame = requestAnimationFrame(tick);
    }

    function wake() {
        if (active && visible && !frame) { last = performance.now(); frame = requestAnimationFrame(tick); }
    }

    addEventListener("message", function (event) {
        if (!event.data || event.data.type !== "motion-preview-active") return;
        active = Boolean(event.data.active);
        if (!active) {
            cancelAll("preview-hidden");
            if (frame) { cancelAnimationFrame(frame); frame = 0; }
        }
        wake();
    });
    addEventListener("blur", function () { cancelAll("window-blur"); });
    document.addEventListener("visibilitychange", function () {
        visible = !document.hidden;
        if (!visible) cancelAll("visibility-hidden");
        wake();
    });
    addEventListener("pagehide", function (event) {
        cancelAll("pagehide");
        if (event.persisted) { active = false; if (frame) cancelAnimationFrame(frame); frame = 0; return; }
        if (effect.destroy) effect.destroy();
        if (audioContext) audioContext.close();
    });
    addEventListener("pageshow", function (event) { if (event.persisted) { active = !preview; visible = !document.hidden; wake(); } });
    new ResizeObserver(resize).observe(stage);
    resize();
    env.setState(study.modeLabel + " / READY", study.interaction);
    wake();
}());
