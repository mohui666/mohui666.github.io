(function () {
    "use strict";

    var registry = Object.create(null);
    var TAU = Math.PI * 2;

    function register(slug, factory) {
        if (registry[slug]) throw new Error("Duplicate motion study handler: " + slug);
        registry[slug] = factory;
    }

    function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function invLerp(a, b, value) { return clamp((value - a) / (b - a), 0, 1); }
    function smoothstep(a, b, value) { var t = invLerp(a, b, value); return t * t * (3 - 2 * t); }
    function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
    function easeInOut(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function mod(value, length) { return ((value % length) + length) % length; }
    function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
    function dot(ax, ay, bx, by) { return ax * bx + ay * by; }
    function cross(ax, ay, bx, by) { return ax * by - ay * bx; }
    function mixColor(a, b, t) {
        function channels(hex) {
            var value = hex.replace("#", "");
            if (value.length === 3) value = value.split("").map(function (v) { return v + v; }).join("");
            return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
        }
        var ca = channels(a), cb = channels(b);
        return "rgb(" + Math.round(lerp(ca[0], cb[0], t)) + "," + Math.round(lerp(ca[1], cb[1], t)) + "," + Math.round(lerp(ca[2], cb[2], t)) + ")";
    }

    function mulberry32(seed) {
        return function () {
            seed |= 0;
            seed = seed + 0x6D2B79F5 | 0;
            var value = Math.imul(seed ^ seed >>> 15, 1 | seed);
            value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
            return ((value ^ value >>> 14) >>> 0) / 4294967296;
        };
    }

    function hash(value) {
        var h = 2166136261;
        for (var i = 0; i < value.length; i += 1) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }

    function roundedRect(ctx, x, y, width, height, radius) {
        var r = Math.min(radius, width * 0.5, height * 0.5);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + width, y, x + width, y + height, r);
        ctx.arcTo(x + width, y + height, x, y + height, r);
        ctx.arcTo(x, y + height, x, y, r);
        ctx.arcTo(x, y, x + width, y, r);
        ctx.closePath();
    }

    function line(ctx, points, close) {
        if (!points.length) return;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (var i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
        if (close) ctx.closePath();
    }

    function label(ctx, text, x, y, color, size, align) {
        ctx.save();
        ctx.fillStyle = color || "rgba(242,246,255,.76)";
        ctx.font = "700 " + (size || 11) + "px Inter,Segoe UI,sans-serif";
        ctx.textAlign = align || "left";
        ctx.textBaseline = "middle";
        ctx.letterSpacing = "0.08em";
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    function grid(ctx, width, height, spacing, color, offsetX, offsetY) {
        ctx.save();
        ctx.strokeStyle = color || "rgba(255,255,255,.055)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        var x;
        for (x = mod(offsetX || 0, spacing); x < width; x += spacing) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
        for (x = mod(offsetY || 0, spacing); x < height; x += spacing) { ctx.moveTo(0, x); ctx.lineTo(width, x); }
        ctx.stroke();
        ctx.restore();
    }

    function arrow(ctx, ax, ay, bx, by, color, width) {
        var angle = Math.atan2(by - ay, bx - ax);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = width || 1.5;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - Math.cos(angle - 0.45) * 7, by - Math.sin(angle - 0.45) * 7);
        ctx.lineTo(bx - Math.cos(angle + 0.45) * 7, by - Math.sin(angle + 0.45) * 7);
        ctx.closePath(); ctx.fill();
        ctx.restore();
    }

    function spring(value, velocity, target, stiffness, damping, dt) {
        velocity += (target - value) * stiffness * dt;
        velocity *= Math.exp(-damping * dt);
        value += velocity * dt;
        return { value: value, velocity: velocity };
    }

    function gaussian(value, sigma) { return Math.exp(-(value * value) / (2 * sigma * sigma)); }

    function createOffscreen(width, height) {
        var canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return { canvas: canvas, ctx: canvas.getContext("2d", { willReadFrequently: true }) };
    }

    window.MotionStudy = {
        registry: registry,
        register: register,
        TAU: TAU,
        clamp: clamp,
        lerp: lerp,
        invLerp: invLerp,
        smoothstep: smoothstep,
        easeOut: easeOut,
        easeInOut: easeInOut,
        mod: mod,
        dist: dist,
        dot: dot,
        cross: cross,
        mixColor: mixColor,
        random: mulberry32,
        hash: hash,
        roundedRect: roundedRect,
        line: line,
        label: label,
        grid: grid,
        arrow: arrow,
        spring: spring,
        gaussian: gaussian,
        createOffscreen: createOffscreen
    };
}());
