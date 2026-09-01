(function () {
    "use strict";

    var M = window.MotionStudy;
    var TAU = M.TAU;

    function replace(slug, factory) { M.registry[slug] = factory; }
    function context(env) { return env.canvas.getContext("2d"); }
    function begin(env, ctx, color) {
        ctx.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
        ctx.clearRect(0, 0, env.width, env.height);
        if (color) { ctx.fillStyle = color; ctx.fillRect(0, 0, env.width, env.height); }
    }
    function addHud(env, items) {
        env.dom.innerHTML = '<aside class="flagship-hud"><p>Interaction vocabulary</p><ul>' + items.map(function (item) {
            return '<li><kbd>' + item[0] + '</kbd><span>' + item[1] + '</span></li>';
        }).join("") + '</ul></aside>';
    }
    function rounded(ctx, x, y, width, height, radius, fill, stroke) {
        M.roundedRect(ctx, x, y, width, height, radius);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
    }
    function label(ctx, value, x, y, size, color, align, weight) {
        ctx.fillStyle = color || "#fff";
        ctx.font = (weight || 750) + " " + size + "px Inter, Segoe UI, sans-serif";
        ctx.textAlign = align || "left";
        ctx.textBaseline = "middle";
        ctx.fillText(value, x, y);
    }
    function mono(ctx, value, x, y, size, color, align) {
        ctx.fillStyle = color || "#fff";
        ctx.font = "700 " + size + "px Cascadia Code, Consolas, monospace";
        ctx.textAlign = align || "left";
        ctx.textBaseline = "middle";
        ctx.fillText(value, x, y);
    }
    function pixels(env, pointer) { return { x: pointer.x * env.width, y: pointer.y * env.height }; }
    function contains(rect, point) { return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h; }
    function focusArea(env, mobileTop) {
        if (env.preview) return { x: env.width * .035, y: env.height * .055, w: env.width * .93, h: env.height * .87 };
        if (env.mobile) return { x: 16, y: env.height * (mobileTop || .37), w: env.width - 32, h: env.height * .48 };
        return { x: env.width * .425, y: env.height * .155, w: env.width * .535, h: env.height * .69 };
    }
    function clampPoint(point, rect) {
        return { x: M.clamp(point.x, rect.x, rect.x + rect.w), y: M.clamp(point.y, rect.y, rect.y + rect.h) };
    }
    function mix(a, b, t) { return M.lerp(a, b, t); }

    /* 48 — Explode Transition -------------------------------------------- */
    replace("explode-transition", function (env) {
        var ctx = context(env);
        var progress = 0;
        var target = 0;
        var velocity = 0;
        var energy = 1;
        var epic = { x: .69, y: .51 };
        var active = false;
        var activePointerId = null;
        var down = null;
        var previousTarget = 0;
        var pieces = [
            { x: .04, y: .05, w: .92, h: .12, type: "header", depth: .32, label: "ORBITAL CONTROL" },
            { x: .04, y: .21, w: .27, h: .31, type: "metric", depth: .72, label: "VELOCITY" },
            { x: .335, y: .21, w: .625, h: .31, type: "chart", depth: 1, label: "SIGNAL / 24H" },
            { x: .04, y: .56, w: .44, h: .38, type: "queue", depth: .86, label: "ACTIVE QUEUE" },
            { x: .505, y: .56, w: .215, h: .18, type: "dial", depth: .56, label: "THRUST" },
            { x: .745, y: .56, w: .215, h: .18, type: "dial", depth: .68, label: "VECTOR" },
            { x: .505, y: .77, w: .455, h: .17, type: "status", depth: .46, label: "LINK STATUS" }
        ];

        addHud(env, [
            ["TAP", "以触点为 epicenter 分解或重组界面"],
            ["DRAG", "连续控制爆炸进度与受力方向"],
            ["WHEEL", "调节分解能量，不改变界面语义"]
        ]);
        env.setAction("EXPLODE / GATHER");

        function drawPiece(piece, rect, index) {
            var x = rect.x + piece.x * rect.w;
            var y = rect.y + piece.y * rect.h;
            var w = piece.w * rect.w;
            var h = piece.h * rect.h;
            var centerX = x + w * .5;
            var centerY = y + h * .5;
            var epicX = epic.x * env.width;
            var epicY = epic.y * env.height;
            var dx = centerX - epicX;
            var dy = centerY - epicY;
            var distance = Math.hypot(dx, dy) || 1;
            var force = progress * energy * (46 + piece.depth * Math.min(rect.w, rect.h) * .34);
            var offsetX = dx / distance * force;
            var offsetY = dy / distance * force;
            var rotation = progress * (dx * dy < 0 ? -1 : 1) * (.035 + piece.depth * .055);
            var alpha = 1 - progress * piece.depth * .12;
            ctx.save();
            ctx.translate(centerX + offsetX, centerY + offsetY);
            ctx.rotate(rotation);
            ctx.scale(1 - progress * piece.depth * .055, 1 - progress * piece.depth * .055);
            ctx.translate(-w * .5, -h * .5);
            ctx.globalAlpha = alpha;
            ctx.shadowColor = "rgba(0,0,0,.55)";
            ctx.shadowBlur = 18 + progress * 40;
            rounded(ctx, 0, 0, w, h, Math.min(18, h * .18), "rgba(13,20,29,.94)", index === 2 ? "rgba(255,186,82,.42)" : "rgba(255,255,255,.13)");
            ctx.shadowBlur = 0;
            mono(ctx, piece.label, 14, 17, Math.max(6, Math.min(9, h * .12)), "rgba(255,255,255,.46)");
            if (piece.type === "header") {
                rounded(ctx, 14, h * .48, w * .25, Math.max(4, h * .16), 4, "#ffba52");
                for (var nav = 0; nav < 4; nav += 1) rounded(ctx, w - 150 + nav * 34, h * .39, 22, 22, 7, nav === 2 ? "rgba(255,186,82,.23)" : "rgba(255,255,255,.07)");
            } else if (piece.type === "metric") {
                label(ctx, "7.42", 16, h * .57, Math.min(46, h * .28), "#fff", "left", 820);
                mono(ctx, "+18.4%", 18, h * .79, 8, "#72f1b8");
            } else if (piece.type === "chart") {
                ctx.beginPath();
                for (var p = 0; p <= 38; p += 1) {
                    var px = 14 + p / 38 * (w - 28);
                    var py = h * .73 - (Math.sin(p * .34) * .18 + Math.sin(p * .11 + 1) * .24 + .42) * h * .48;
                    if (!p) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.strokeStyle = "#ffba52"; ctx.lineWidth = 2.5; ctx.stroke();
                ctx.lineTo(w - 14, h - 12); ctx.lineTo(14, h - 12); ctx.closePath();
                ctx.fillStyle = "rgba(255,186,82,.08)"; ctx.fill();
            } else if (piece.type === "queue") {
                for (var row = 0; row < 4; row += 1) {
                    var rowY = 35 + row * (h - 44) / 4;
                    rounded(ctx, 13, rowY, 26, 26, 8, ["#ffba52", "#72f1b8", "#77a8ff", "#ff7d9f"][row]);
                    rounded(ctx, 50, rowY + 3, w * (.34 + row * .06), 6, 3, "rgba(255,255,255,.16)");
                    rounded(ctx, 50, rowY + 15, w * .24, 4, 2, "rgba(255,255,255,.07)");
                }
            } else if (piece.type === "dial") {
                var r = Math.min(w, h) * .19;
                ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 7;
                ctx.beginPath(); ctx.arc(w * .5, h * .58, r, .65, Math.PI * 2.35); ctx.stroke();
                ctx.strokeStyle = index % 2 ? "#77a8ff" : "#72f1b8";
                ctx.beginPath(); ctx.arc(w * .5, h * .58, r, .65, .65 + Math.PI * 1.7 * (.52 + index * .04)); ctx.stroke();
            } else {
                for (var dot = 0; dot < 5; dot += 1) {
                    ctx.fillStyle = dot < 4 ? "#72f1b8" : "rgba(255,255,255,.12)";
                    ctx.beginPath(); ctx.arc(22 + dot * 32, h * .62, 5, 0, TAU); ctx.fill();
                }
                mono(ctx, "NOMINAL", w - 14, h * .62, 8, "#72f1b8", "right");
            }
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        return {
            pointerDown: function (pointer, event) {
                var pointerId = event ? event.pointerId : 1;
                if (activePointerId !== null) return;
                activePointerId = pointerId;
                active = true;
                previousTarget = target;
                down = { x: pointer.x, y: pointer.y, epic: { x: epic.x, y: epic.y } };
                epic.x = pointer.x; epic.y = pointer.y;
            },
            pointerMove: function (pointer, event) {
                if (activePointerId !== (event ? event.pointerId : 1)) return;
                if (!active || !down) return;
                epic.x = pointer.x; epic.y = pointer.y;
                var distance = M.dist(pointer.x, pointer.y, down.x, down.y);
                if (distance > .012) target = M.clamp(distance * 2.8, 0, 1);
            },
            pointerUp: function (pointer, event) {
                if (activePointerId !== (event ? event.pointerId : 1)) return;
                if (!active || !down) return;
                var moved = M.dist(pointer.x, pointer.y, down.x, down.y);
                target = moved < .018 ? (previousTarget < .5 ? 1 : 0) : (target > .42 ? 1 : 0);
                active = false; down = null; activePointerId = null;
            },
            pointerCancel: function (_, event) {
                if (activePointerId !== (event ? event.pointerId : 1)) return;
                if (down && down.epic) { epic.x = down.epic.x; epic.y = down.epic.y; }
                active = false; down = null; target = previousTarget; activePointerId = null;
            },
            wheel: function (_, dy) { energy = M.clamp(energy - dy * .0012, .55, 1.65); },
            action: function () { target = target < .5 ? 1 : 0; },
            keyDown: function (event) {
                if (event.key === "Enter" || event.key === " ") { target = target < .5 ? 1 : 0; event.preventDefault(); }
                if (event.key.toLowerCase() === "r") { target = 0; energy = 1; }
            },
            demo: function (time, cycle) {
                epic.x = .62 + Math.cos(time * .37) * .2;
                epic.y = .5 + Math.sin(time * .43) * .22;
                target = cycle > 1.1 && cycle < 5.4 ? 1 : 0;
            },
            update: function (dt) {
                var result = M.spring(progress, velocity, target, 155, 22, Math.min(dt, .034));
                progress = result.value; velocity = result.velocity;
                env.setMeter(progress);
                env.setState(progress > .96 ? "TOPOLOGY / SEPARATED" : progress < .04 ? "TOPOLOGY / ASSEMBLED" : "EPICENTER FORCE / " + Math.round(progress * 100) + "%", "真实界面块沿其到触发焦点的向量分解，组件身份保持不变");
            },
            draw: function () {
                begin(env, ctx, "#080b11");
                var rect = focusArea(env, .36);
                rounded(ctx, rect.x - 10, rect.y - 10, rect.w + 20, rect.h + 20, 30, "rgba(255,255,255,.025)", "rgba(255,255,255,.08)");
                pieces.forEach(function (piece, index) { drawPiece(piece, rect, index); });
                var ex = epic.x * env.width, ey = epic.y * env.height;
                ctx.strokeStyle = "rgba(255,186,82," + (.32 + progress * .48) + ")"; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(ex, ey, 12 + progress * 16, 0, TAU); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(ex - 22, ey); ctx.lineTo(ex + 22, ey); ctx.moveTo(ex, ey - 22); ctx.lineTo(ex, ey + 22); ctx.stroke();
            }
        };
    });

    /* 64 — Bubble Cursor -------------------------------------------------- */
    replace("bubble-cursor", function (env) {
        var ctx = context(env);
        var rand = M.random(64031);
        var targets = [];
        var cursor = { x: env.width * .68, y: env.height * .5 };
        var nearest = -1;
        var second = -1;
        var bubbleRadius = 20;
        var sequence = 0;
        var hits = 0;
        var misses = 0;
        var down = false;
        var activePointerId = null;
        var cancelled = false;
        var flash = 0;
        var lastDemoStep = -1;

        addHud(env, [
            ["MOVE", "气泡扩展到最近目标，但不触及次近目标"],
            ["TAP", "即使点在目标外，也命中气泡接触的目标"],
            ["R", "重置目标获取序列与命中统计"]
        ]);
        env.setAction("RESET ACQUISITION TRIAL");

        function playRect() {
            var area = focusArea(env, .36);
            return { x: area.x + 12, y: area.y + 12, w: area.w - 24, h: area.h - 24 };
        }

        function reset() {
            var rect = playRect();
            targets = [];
            var count = env.mobile ? 24 : 42;
            for (var i = 0; i < count; i += 1) {
                var radius = 5 + rand() * (env.mobile ? 10 : 13);
                var candidate = null;
                for (var attempt = 0; attempt < 80; attempt += 1) {
                    candidate = { x: rect.x + 24 + rand() * (rect.w - 48), y: rect.y + 24 + rand() * (rect.h - 48), r: radius, id: i, pulse: 0 };
                    if (targets.every(function (other) { return M.dist(candidate.x, candidate.y, other.x, other.y) > candidate.r + other.r + 7; })) break;
                }
                targets.push(candidate);
            }
            cursor = { x: rect.x + rect.w * .5, y: rect.y + rect.h * .5 };
            sequence = 0; hits = 0; misses = 0; flash = 0; activePointerId = null; down = false;
            updateBubble();
        }

        function updateBubble() {
            if (!targets.length) return;
            var ranked = targets.map(function (target, index) {
                var center = M.dist(cursor.x, cursor.y, target.x, target.y);
                return { index: index, center: center, edge: Math.max(0, center - target.r) };
            }).sort(function (a, b) { return a.edge - b.edge || a.center - b.center; });
            nearest = ranked[0].index;
            second = ranked[1] ? ranked[1].index : nearest;
            var secondEdge = ranked[1] ? ranked[1].edge : ranked[0].center + 40;
            bubbleRadius = Math.max(3, Math.min(ranked[0].center, secondEdge));
        }

        function relocate(target) {
            var rect = playRect();
            for (var attempt = 0; attempt < 60; attempt += 1) {
                var x = rect.x + 22 + rand() * (rect.w - 44);
                var y = rect.y + 22 + rand() * (rect.h - 44);
                if (targets.every(function (other) { return other === target || M.dist(x, y, other.x, other.y) > target.r + other.r + 8; })) {
                    target.x = x; target.y = y; break;
                }
            }
        }

        function acquire() {
            if (nearest < 0) return;
            var expected = sequence % targets.length;
            if (nearest === expected) {
                hits += 1;
                targets[nearest].pulse = 1;
                relocate(targets[nearest]);
                sequence = (sequence + 1) % targets.length;
                flash = 1;
            } else {
                misses += 1;
                flash = -1;
            }
        }

        function setCursor(pointer) {
            var rect = playRect();
            cursor = clampPoint(pixels(env, pointer), rect);
            updateBubble();
        }

        reset();
        return {
            resize: reset,
            pointerDown: function (pointer, event) {
                if (activePointerId !== null) return;
                activePointerId = event ? event.pointerId : 1; down = true; cancelled = false; setCursor(pointer);
            },
            pointerMove: function (pointer, event) {
                var pointerId = event ? event.pointerId : 1;
                if (activePointerId !== null && activePointerId !== pointerId) return;
                setCursor(pointer);
            },
            pointerUp: function (pointer, event) {
                if (activePointerId !== (event ? event.pointerId : 1)) return;
                setCursor(pointer); if (down && !cancelled) acquire(); down = false; activePointerId = null;
            },
            pointerCancel: function (_, event) {
                if (activePointerId !== (event ? event.pointerId : 1)) return;
                cancelled = true; down = false; activePointerId = null;
            },
            action: reset,
            keyDown: function (event) { if (event.key.toLowerCase() === "r") reset(); },
            demo: function (time) {
                if (!targets.length) return;
                var target = targets[sequence % targets.length];
                cursor.x += (target.x + Math.sin(time * 2.1) * (target.r + 13) - cursor.x) * .08;
                cursor.y += (target.y + Math.cos(time * 1.7) * (target.r + 11) - cursor.y) * .08;
                updateBubble();
                var step = Math.floor(time / 2.4);
                if (step !== lastDemoStep) {
                    lastDemoStep = step;
                    cursor.x = target.x; cursor.y = target.y;
                    updateBubble(); acquire();
                }
            },
            update: function (dt) {
                flash *= Math.exp(-5 * dt);
                targets.forEach(function (target) { target.pulse *= Math.exp(-5 * dt); });
                updateBubble();
                var accuracy = hits + misses ? hits / (hits + misses) : 1;
                env.setMeter(accuracy);
                env.setState("TARGET " + String(sequence + 1).padStart(2, "0") + " / HIT " + hits + " / MISS " + misses, "气泡半径由最近目标中心和次近目标边界共同约束");
            },
            draw: function () {
                begin(env, ctx, "#f0efe8");
                var rect = playRect();
                rounded(ctx, rect.x - 12, rect.y - 12, rect.w + 24, rect.h + 24, 28, "rgba(255,255,255,.62)", "rgba(21,28,24,.16)");
                ctx.strokeStyle = "rgba(21,28,24,.07)"; ctx.lineWidth = 1;
                for (var gx = rect.x; gx <= rect.x + rect.w; gx += 34) { ctx.beginPath(); ctx.moveTo(gx, rect.y); ctx.lineTo(gx, rect.y + rect.h); ctx.stroke(); }
                for (var gy = rect.y; gy <= rect.y + rect.h; gy += 34) { ctx.beginPath(); ctx.moveTo(rect.x, gy); ctx.lineTo(rect.x + rect.w, gy); ctx.stroke(); }
                targets.forEach(function (target, index) {
                    var expected = index === sequence % targets.length;
                    var activeTarget = index === nearest;
                    ctx.beginPath(); ctx.arc(target.x, target.y, target.r + target.pulse * 11, 0, TAU);
                    ctx.fillStyle = expected ? "#ff5a3d" : activeTarget ? "#164f3e" : "rgba(22,79,62,.22)";
                    ctx.fill();
                    if (expected) {
                        ctx.strokeStyle = "rgba(255,90,61,.3)"; ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.arc(target.x, target.y, target.r + 8, 0, TAU); ctx.stroke();
                    }
                    if (target.r > 9) mono(ctx, String(index + 1).padStart(2, "0"), target.x, target.y, 6, expected ? "#fff" : "rgba(255,255,255,.8)", "center");
                });
                ctx.fillStyle = flash < 0 ? "rgba(255,70,70,.08)" : "rgba(30,140,92,.08)";
                if (Math.abs(flash) > .01) ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
                ctx.beginPath(); ctx.arc(cursor.x, cursor.y, bubbleRadius, 0, TAU);
                ctx.fillStyle = "rgba(13,79,61,.055)"; ctx.fill();
                ctx.strokeStyle = "rgba(13,79,61,.72)"; ctx.lineWidth = 1.5; ctx.stroke();
                if (nearest >= 0) {
                    ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(cursor.x, cursor.y); ctx.lineTo(targets[nearest].x, targets[nearest].y); ctx.stroke(); ctx.setLineDash([]);
                }
                ctx.beginPath(); ctx.arc(cursor.x, cursor.y, down ? 5 : 3, 0, TAU); ctx.fillStyle = "#0d4f3d"; ctx.fill();
                mono(ctx, "BUBBLE R " + bubbleRadius.toFixed(1) + " PX", rect.x + 12, rect.y + rect.h - 14, 7, "rgba(21,28,24,.55)");
            }
        };
    });

    /* 71 — Edge Scrolling ------------------------------------------------- */
    replace("edge-scrolling", function (env) {
        var ctx = context(env);
        var rand = M.random(71009);
        var world = { w: 1900, h: 1320 };
        var scroll = { x: 360, y: 270 };
        var items = [];
        var selected = new Set();
        var previousSelection = new Set();
        var selecting = false;
        var paused = false;
        var pointerScreen = { x: 0, y: 0 };
        var anchor = null;
        var head = null;
        var velocity = { x: 0, y: 0 };
        var lastDemoPhase = -1;
        var activePointerId = null;

        addHud(env, [
            ["DRAG", "在大型画板中建立连续世界坐标选区"],
            ["EDGE HOLD", "进入边缘热区后按深入程度自动滚动"],
            ["SPACE", "拖选期间暂停或继续边缘速率"]
        ]);
        env.setAction("CLEAR / RECENTER");

        for (var i = 0; i < 96; i += 1) {
            items.push({
                id: i,
                x: 70 + rand() * (world.w - 180),
                y: 70 + rand() * (world.h - 150),
                w: 58 + rand() * 94,
                h: 34 + rand() * 55,
                group: i % 5
            });
        }

        function viewport() { return focusArea(env, .36); }
        function maxScroll(rect) { return { x: Math.max(0, world.w - rect.w), y: Math.max(0, world.h - rect.h) }; }
        function toWorld(point) { var rect = viewport(); return { x: scroll.x + point.x - rect.x, y: scroll.y + point.y - rect.y }; }
        function updateSelection() {
            if (!anchor || !head) return;
            var x0 = Math.min(anchor.x, head.x), x1 = Math.max(anchor.x, head.x);
            var y0 = Math.min(anchor.y, head.y), y1 = Math.max(anchor.y, head.y);
            selected = new Set(previousSelection);
            items.forEach(function (item) {
                var cx = item.x + item.w * .5, cy = item.y + item.h * .5;
                if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) selected.add(item.id);
            });
        }
        function start(pointer, event) {
            var pointerId = event ? event.pointerId : 1;
            if (activePointerId !== null) return;
            var point = pixels(env, pointer);
            var rect = viewport();
            if (!contains(rect, point)) return;
            activePointerId = pointerId;
            selecting = true;
            pointerScreen = clampPoint(point, rect);
            previousSelection = event && event.shiftKey ? new Set(selected) : new Set();
            if (!(event && event.shiftKey)) selected.clear();
            anchor = toWorld(pointerScreen);
            head = { x: anchor.x, y: anchor.y };
            velocity.x = 0; velocity.y = 0;
        }
        function move(pointer, event) {
            if (activePointerId !== (event ? event.pointerId : 1)) return;
            if (!selecting) return;
            var rect = viewport();
            pointerScreen = clampPoint(pixels(env, pointer), rect);
            head = toWorld(pointerScreen);
            updateSelection();
        }
        function finish(cancelled) {
            if (!selecting) return;
            if (cancelled) selected = new Set(previousSelection);
            selecting = false; activePointerId = null; anchor = null; head = null; velocity.x = 0; velocity.y = 0;
        }

        return {
            pointerDown: start,
            pointerMove: move,
            pointerUp: function (_, event) { if (activePointerId === (event ? event.pointerId : 1)) finish(false); },
            pointerCancel: function (_, event) { if (activePointerId === (event ? event.pointerId : 1)) finish(true); },
            wheel: function (dx, dy) {
                var rect = viewport(), max = maxScroll(rect);
                scroll.x = M.clamp(scroll.x + dx, 0, max.x);
                scroll.y = M.clamp(scroll.y + dy, 0, max.y);
            },
            action: function () { selected.clear(); scroll.x = 360; scroll.y = 270; },
            keyDown: function (event) {
                if (event.key === " ") { paused = !paused; event.preventDefault(); }
                if (event.key === "Escape") finish(true);
            },
            demo: function (time, cycle) {
                var rect = viewport();
                if (!selecting) {
                    selecting = true; previousSelection.clear(); selected.clear();
                    pointerScreen = { x: rect.x + rect.w * .38, y: rect.y + rect.h * .42 };
                    anchor = toWorld(pointerScreen); head = { x: anchor.x, y: anchor.y };
                }
                var phase = Math.floor(time / 8);
                if (phase !== lastDemoPhase) { lastDemoPhase = phase; scroll.x = 260; scroll.y = 210; anchor = toWorld({ x: rect.x + rect.w * .35, y: rect.y + rect.h * .38 }); }
                pointerScreen.x = cycle < 4 ? rect.x + rect.w - 5 : rect.x + rect.w * .55;
                pointerScreen.y = cycle < 2 ? rect.y + rect.h - 6 : rect.y + rect.h * .64;
                head = toWorld(pointerScreen); updateSelection();
                if (cycle > 6.7) finish(false);
            },
            update: function (dt) {
                var rect = viewport();
                var edge = env.mobile ? 48 : 64;
                var desiredX = 0, desiredY = 0;
                if (selecting && !paused) {
                    if (pointerScreen.x < rect.x + edge) desiredX = -Math.pow((rect.x + edge - pointerScreen.x) / edge, 2) * 780;
                    if (pointerScreen.x > rect.x + rect.w - edge) desiredX = Math.pow((pointerScreen.x - (rect.x + rect.w - edge)) / edge, 2) * 780;
                    if (pointerScreen.y < rect.y + edge) desiredY = -Math.pow((rect.y + edge - pointerScreen.y) / edge, 2) * 720;
                    if (pointerScreen.y > rect.y + rect.h - edge) desiredY = Math.pow((pointerScreen.y - (rect.y + rect.h - edge)) / edge, 2) * 720;
                }
                var response = 1 - Math.exp(-9 * dt);
                velocity.x += (desiredX - velocity.x) * response;
                velocity.y += (desiredY - velocity.y) * response;
                var max = maxScroll(rect);
                scroll.x = M.clamp(scroll.x + velocity.x * dt, 0, max.x);
                scroll.y = M.clamp(scroll.y + velocity.y * dt, 0, max.y);
                if (selecting) { head = toWorld(pointerScreen); updateSelection(); }
                env.setMeter(Math.min(1, Math.hypot(velocity.x, velocity.y) / 820));
                env.setState(selected.size + " ITEMS / " + Math.round(Math.hypot(velocity.x, velocity.y)) + " PX·S⁻¹", "视口移动期间选区终点持续重算为世界坐标，不依赖新的 pointermove");
            },
            draw: function () {
                begin(env, ctx, "#07101c");
                var rect = viewport();
                rounded(ctx, rect.x, rect.y, rect.w, rect.h, 24, "#0a1525", "rgba(127,176,255,.24)");
                ctx.save(); M.roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 24); ctx.clip();
                ctx.translate(rect.x - scroll.x, rect.y - scroll.y);
                ctx.strokeStyle = "rgba(127,176,255,.07)"; ctx.lineWidth = 1;
                for (var gx = 0; gx <= world.w; gx += 80) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, world.h); ctx.stroke(); }
                for (var gy = 0; gy <= world.h; gy += 80) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(world.w, gy); ctx.stroke(); }
                var colors = ["#79b7ff", "#f4ca72", "#ff7e9d", "#7de6bd", "#ad91ff"];
                items.forEach(function (item) {
                    var on = selected.has(item.id);
                    rounded(ctx, item.x, item.y, item.w, item.h, 10, on ? colors[item.group] : "rgba(255,255,255,.055)", on ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.11)");
                    mono(ctx, "NODE " + String(item.id + 1).padStart(2, "0"), item.x + 9, item.y + 12, 6, on ? "#07101c" : "rgba(255,255,255,.38)");
                    rounded(ctx, item.x + 9, item.y + item.h - 13, item.w * .46, 3, 2, on ? "rgba(7,16,28,.35)" : "rgba(255,255,255,.1)");
                });
                if (anchor && head) {
                    var x0 = Math.min(anchor.x, head.x), y0 = Math.min(anchor.y, head.y);
                    var w = Math.abs(head.x - anchor.x), h = Math.abs(head.y - anchor.y);
                    ctx.fillStyle = "rgba(121,183,255,.09)"; ctx.fillRect(x0, y0, w, h);
                    ctx.strokeStyle = "#79b7ff"; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.strokeRect(x0, y0, w, h); ctx.setLineDash([]);
                }
                ctx.restore();
                var edge = env.mobile ? 48 : 64;
                var gradients = [
                    [ctx.createLinearGradient(rect.x, 0, rect.x + edge, 0), rect.x, rect.y, edge, rect.h, Math.max(0, -velocity.x)],
                    [ctx.createLinearGradient(rect.x + rect.w, 0, rect.x + rect.w - edge, 0), rect.x + rect.w - edge, rect.y, edge, rect.h, Math.max(0, velocity.x)],
                    [ctx.createLinearGradient(0, rect.y, 0, rect.y + edge), rect.x, rect.y, rect.w, edge, Math.max(0, -velocity.y)],
                    [ctx.createLinearGradient(0, rect.y + rect.h, 0, rect.y + rect.h - edge), rect.x, rect.y + rect.h - edge, rect.w, edge, Math.max(0, velocity.y)]
                ];
                gradients.forEach(function (entry) {
                    entry[0].addColorStop(0, "rgba(121,183,255," + (.08 + entry[5] / 900 * .28) + ")"); entry[0].addColorStop(1, "transparent");
                    ctx.fillStyle = entry[0]; ctx.fillRect(entry[1], entry[2], entry[3], entry[4]);
                });
                var mapW = 112, mapH = 78, mapX = rect.x + rect.w - mapW - 13, mapY = rect.y + 13;
                rounded(ctx, mapX, mapY, mapW, mapH, 10, "rgba(4,8,14,.82)", "rgba(255,255,255,.15)");
                ctx.strokeStyle = "#79b7ff"; ctx.strokeRect(mapX + scroll.x / world.w * mapW, mapY + scroll.y / world.h * mapH, rect.w / world.w * mapW, rect.h / world.h * mapH);
                mono(ctx, paused ? "EDGE RATE / PAUSED" : "EDGE RATE / LIVE", rect.x + 14, rect.y + 18, 7, paused ? "#f4ca72" : "rgba(255,255,255,.55)");
            }
        };
    });

    /* 123 — Interactive Evolution ---------------------------------------- */
    replace("interactive-evolution", function (env) {
        var ctx = context(env);
        var rand = M.random(123071);
        var population = [];
        var ratings = [];
        var parentSlots = [-1, -1];
        var lockedGenes = new Set();
        var history = [];
        var generation = 0;
        var pressed = null;
        var dragPoint = null;
        var mutationPulse = 0;
        var lastDemoGeneration = -1;
        var activePointerId = null;
        var geneNames = ["SYMM", "LAYERS", "WAVE", "TWIST", "VOID", "HUE", "BRANCH"];

        addHud(env, [
            ["TAP", "给候选增加 0–3 级人工适应度"],
            ["DRAG", "把候选放入两个亲本槽，明确交叉来源"],
            ["GENE DOT", "锁定基因，使繁殖时继承亲本值"]
        ]);

        function randomGenes() { return geneNames.map(function () { return rand(); }); }
        function cloneGenes(genes) { return genes.slice(); }
        function reset() {
            var count = env.mobile ? 6 : 9;
            population = Array.from({ length: count }, function () { return { genes: randomGenes(), parents: [], mutations: new Set() }; });
            ratings = Array(count).fill(0);
            parentSlots = [-1, -1]; lockedGenes.clear(); history = []; generation = 0; mutationPulse = 0;
            pressed = null; dragPoint = null; activePointerId = null;
            env.setAction("BREED SELECTED PARENTS");
        }
        function layout() {
            var area = focusArea(env, .32);
            var slotH = Math.min(62, area.h * .13);
            var gap = env.mobile ? 7 : 10;
            var cols = env.mobile ? 2 : 3;
            var rows = Math.ceil(population.length / cols);
            var gridY = area.y + slotH + gap * 1.5;
            var cardW = (area.w - gap * (cols - 1)) / cols;
            var cardH = (area.y + area.h - gridY - gap * (rows - 1)) / rows;
            var cards = population.map(function (_, index) {
                return { x: area.x + (index % cols) * (cardW + gap), y: gridY + Math.floor(index / cols) * (cardH + gap), w: cardW, h: cardH };
            });
            var slotW = Math.min(area.w * .27, 190);
            return {
                area: area,
                cards: cards,
                slots: [
                    { x: area.x + area.w - slotW * 2 - gap, y: area.y, w: slotW, h: slotH },
                    { x: area.x + area.w - slotW, y: area.y, w: slotW, h: slotH }
                ]
            };
        }
        function hitCandidate(point, cards) {
            for (var i = cards.length - 1; i >= 0; i -= 1) if (contains(cards[i], point)) return i;
            return -1;
        }
        function geneAt(point, card) {
            if (point.y < card.y + card.h - 22) return -1;
            var usable = card.w - 18;
            var index = Math.floor((point.x - card.x - 9) / usable * geneNames.length);
            return index >= 0 && index < geneNames.length ? index : -1;
        }
        function chooseParents() {
            var ranked = population.map(function (_, index) { return index; }).sort(function (a, b) { return ratings[b] - ratings[a]; });
            var a = parentSlots[0] >= 0 ? parentSlots[0] : ranked[0];
            var b = parentSlots[1] >= 0 ? parentSlots[1] : ranked.find(function (index) { return index !== a; });
            return [a, b === undefined ? a : b];
        }
        function breed() {
            var parents = chooseParents();
            var sourceA = population[parents[0]].genes;
            var sourceB = population[parents[1]].genes;
            history.push({ population: population.map(function (candidate) { return { genes: cloneGenes(candidate.genes), parents: candidate.parents.slice(), mutations: new Set(candidate.mutations) }; }), ratings: ratings.slice(), parentSlots: parentSlots.slice(), generation: generation });
            if (history.length > 6) history.shift();
            population = population.map(function (_, childIndex) {
                var mutations = new Set();
                var genes = sourceA.map(function (value, geneIndex) {
                    var next = childIndex === 0 ? sourceA[geneIndex] : childIndex === 1 ? sourceB[geneIndex] : (rand() < .5 ? sourceA[geneIndex] : sourceB[geneIndex]);
                    if (!lockedGenes.has(geneIndex) && childIndex > 1 && rand() < .2) {
                        next = M.clamp(next + (rand() - .5) * .42, 0, 1);
                        mutations.add(geneIndex);
                    }
                    return next;
                });
                return { genes: genes, parents: parents.slice(), mutations: mutations };
            });
            generation += 1; ratings = Array(population.length).fill(0); parentSlots = [0, 1]; mutationPulse = 1;
        }
        function undo() {
            var snapshot = history.pop();
            if (!snapshot) return;
            population = snapshot.population; ratings = snapshot.ratings; parentSlots = snapshot.parentSlots; generation = snapshot.generation;
        }
        function drawPhenotype(candidate, card, index) {
            var genes = candidate.genes;
            var cx = card.x + card.w * .5;
            var cy = card.y + card.h * .48;
            var radius = Math.min(card.w, card.h) * .28;
            var symmetry = 3 + Math.floor(genes[0] * 7);
            var layers = 2 + Math.floor(genes[1] * 4);
            var hue = Math.round(genes[5] * 310 + 20);
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(genes[3] * TAU * .22);
            for (var branch = 0; branch < symmetry; branch += 1) {
                var angle = branch / symmetry * TAU;
                var branchLength = radius * (.48 + genes[6] * .5);
                ctx.strokeStyle = "hsla(" + (hue + branch * 5) + ",78%,67%,.38)";
                ctx.lineWidth = 1 + genes[6] * 2;
                ctx.beginPath(); ctx.moveTo(Math.cos(angle) * radius * .18, Math.sin(angle) * radius * .18); ctx.lineTo(Math.cos(angle + genes[3] * .18) * branchLength, Math.sin(angle + genes[3] * .18) * branchLength); ctx.stroke();
            }
            for (var layer = layers - 1; layer >= 0; layer -= 1) {
                var layerRadius = radius * (.38 + layer / Math.max(1, layers - 1) * .62);
                ctx.beginPath();
                var steps = symmetry * 10;
                for (var step = 0; step <= steps; step += 1) {
                    var a = step / steps * TAU;
                    var wave = Math.sin(a * symmetry + genes[3] * TAU + layer * .7) * genes[2] * .22;
                    var r = layerRadius * (1 + wave);
                    var x = Math.cos(a) * r, y = Math.sin(a) * r;
                    if (!step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fillStyle = "hsla(" + (hue + layer * 18) + ",72%," + (48 + layer * 5) + "%," + (.12 + layer * .055) + ")";
                ctx.fill();
                ctx.strokeStyle = "hsla(" + (hue + layer * 16) + ",82%,72%," + (.32 + layer * .08) + ")";
                ctx.stroke();
            }
            ctx.globalCompositeOperation = "destination-out";
            ctx.beginPath(); ctx.arc(0, 0, radius * genes[4] * .42, 0, TAU); ctx.fill();
            ctx.globalCompositeOperation = "source-over";
            ctx.restore();
            if (ratings[index]) {
                for (var star = 0; star < ratings[index]; star += 1) label(ctx, "✦", card.x + 15 + star * 14, card.y + 16, 11, "#ffd36e", "center");
            }
            candidate.mutations.forEach(function (geneIndex) {
                if (mutationPulse < .02) return;
                var x = card.x + 9 + (geneIndex + .5) / geneNames.length * (card.w - 18);
                ctx.beginPath(); ctx.arc(x, card.y + card.h - 11, 5 + mutationPulse * 4, 0, TAU); ctx.strokeStyle = "rgba(255,109,145," + mutationPulse + ")"; ctx.stroke();
            });
        }

        reset();
        return {
            resize: function () {},
            pointerDown: function (pointer, event) {
                if (activePointerId !== null) return;
                var point = pixels(env, pointer), view = layout();
                var candidate = hitCandidate(point, view.cards);
                if (candidate < 0) return;
                activePointerId = event ? event.pointerId : 1;
                pressed = { index: candidate, point: point, moved: 0, gene: geneAt(point, view.cards[candidate]) };
                dragPoint = point;
            },
            pointerMove: function (pointer, event) {
                if (activePointerId !== (event ? event.pointerId : 1)) return;
                if (!pressed) return;
                dragPoint = pixels(env, pointer);
                pressed.moved = Math.max(pressed.moved, M.dist(dragPoint.x, dragPoint.y, pressed.point.x, pressed.point.y));
            },
            pointerUp: function (pointer, event) {
                if (activePointerId !== (event ? event.pointerId : 1)) return;
                if (!pressed) return;
                var point = pixels(env, pointer), view = layout(), placed = false;
                view.slots.forEach(function (slot, slotIndex) {
                    if (contains(slot, point) && pressed.moved > 8) { parentSlots[slotIndex] = pressed.index; placed = true; }
                });
                if (!placed && pressed.moved < 8) {
                    if (pressed.gene >= 0) {
                        if (lockedGenes.has(pressed.gene)) lockedGenes.delete(pressed.gene); else lockedGenes.add(pressed.gene);
                    } else ratings[pressed.index] = (ratings[pressed.index] + 1) % 4;
                }
                pressed = null; dragPoint = null; activePointerId = null;
            },
            pointerCancel: function (_, event) {
                if (activePointerId !== (event ? event.pointerId : 1)) return;
                pressed = null; dragPoint = null; activePointerId = null;
            },
            action: breed,
            keyDown: function (event) {
                if (event.key.toLowerCase() === "z") undo();
                if (event.key.toLowerCase() === "r") reset();
                if (event.key === "Enter") { breed(); event.preventDefault(); }
            },
            demo: function (time) {
                var step = Math.floor(time / 7);
                if (step !== lastDemoGeneration) {
                    lastDemoGeneration = step;
                    ratings[(step * 2) % population.length] = 3;
                    ratings[(step * 2 + 4) % population.length] = 2;
                    parentSlots = [(step * 2) % population.length, (step * 2 + 4) % population.length];
                    if (step > 0) breed();
                }
            },
            update: function (dt) {
                mutationPulse *= Math.exp(-2.7 * dt);
                var parents = chooseParents();
                env.setMeter(ratings.reduce(function (sum, rating) { return sum + rating; }, 0) / (population.length * 3));
                env.setState("GEN " + generation + " / PARENTS " + (parents[0] + 1) + " × " + (parents[1] + 1) + " / " + lockedGenes.size + " LOCKS", "子代逐基因交叉；粉色脉冲明确标记发生变异的位点");
            },
            draw: function () {
                begin(env, ctx, "#100b19");
                var view = layout();
                mono(ctx, "GENERATION " + String(generation).padStart(2, "0"), view.area.x, view.area.y + 13, 8, "rgba(255,255,255,.48)");
                view.slots.forEach(function (slot, slotIndex) {
                    var candidateIndex = parentSlots[slotIndex];
                    rounded(ctx, slot.x, slot.y, slot.w, slot.h, 15, candidateIndex >= 0 ? "rgba(183,137,255,.12)" : "rgba(255,255,255,.035)", candidateIndex >= 0 ? "rgba(183,137,255,.52)" : "rgba(255,255,255,.13)");
                    mono(ctx, candidateIndex >= 0 ? "PARENT " + (slotIndex ? "B / " : "A / ") + String(candidateIndex + 1).padStart(2, "0") : "DROP PARENT " + (slotIndex ? "B" : "A"), slot.x + slot.w * .5, slot.y + slot.h * .5, 7, candidateIndex >= 0 ? "#d9c2ff" : "rgba(255,255,255,.35)", "center");
                });
                view.cards.forEach(function (card, index) {
                    var isParent = parentSlots.indexOf(index) >= 0;
                    rounded(ctx, card.x, card.y, card.w, card.h, 16, "rgba(255,255,255,.035)", isParent ? "rgba(183,137,255,.72)" : ratings[index] ? "rgba(255,211,110,.55)" : "rgba(255,255,255,.11)");
                    drawPhenotype(population[index], card, index);
                    for (var gene = 0; gene < geneNames.length; gene += 1) {
                        var gx = card.x + 9 + (gene + .5) / geneNames.length * (card.w - 18);
                        ctx.beginPath(); ctx.arc(gx, card.y + card.h - 11, lockedGenes.has(gene) ? 4.3 : 2.8, 0, TAU);
                        ctx.fillStyle = lockedGenes.has(gene) ? "#72f1b8" : "rgba(255,255,255,.22)"; ctx.fill();
                    }
                    mono(ctx, String(index + 1).padStart(2, "0"), card.x + card.w - 10, card.y + 13, 7, "rgba(255,255,255,.35)", "right");
                });
                if (pressed && dragPoint && pressed.moved > 8) {
                    ctx.beginPath(); ctx.arc(dragPoint.x, dragPoint.y, 20, 0, TAU); ctx.fillStyle = "rgba(183,137,255,.25)"; ctx.fill();
                    mono(ctx, "CANDIDATE " + String(pressed.index + 1).padStart(2, "0"), dragPoint.x, dragPoint.y, 6, "#fff", "center");
                }
            }
        };
    });

    /* 131 — Brushing and Linking ----------------------------------------- */
    replace("brushing-and-linking", function (env) {
        var ctx = context(env);
        var rand = M.random(131019);
        var records = [];
        var selected = new Set();
        var previewSelection = new Set();
        var operation = 0;
        var operations = ["REPLACE", "UNION", "INTERSECT", "SUBTRACT"];
        var brush = null;
        var hover = -1;
        var pinned = -1;
        var lastDemoCycle = -1;
        var activePointerId = null;
        var colors = ["#6ee7ff", "#ff8db8", "#ffd36e", "#9f8cff"];

        addHud(env, [
            ["DRAG", "任一视图发起刷选，同一记录 ID 跨视图联动"],
            ["ACTION", "循环 Replace / Union / Intersect / Subtract"],
            ["TAP", "固定单条记录并追踪其全部编码位置"]
        ]);
        function setAction() { env.setAction("SET OP / " + operations[operation]); }
        setAction();

        for (var i = 0; i < 84; i += 1) {
            var group = i % 4;
            var a = M.clamp(rand() * .68 + group * .09, 0, 1);
            var b = M.clamp(.16 + a * (.52 - group * .05) + (rand() - .5) * .42, 0, 1);
            records.push({ id: i, a: a, b: b, c: M.clamp(.2 + (1 - a) * .45 + group * .08 + (rand() - .5) * .3, 0, 1), d: M.clamp((a + b) * .35 + rand() * .38, 0, 1), group: group });
        }

        function plots() {
            var area = focusArea(env, .34);
            if (env.mobile) {
                return {
                    area: area,
                    scatter: { x: area.x, y: area.y, w: area.w, h: area.h * .48 },
                    parallel: { x: area.x, y: area.y + area.h * .52, w: area.w * .64, h: area.h * .48 },
                    bands: { x: area.x + area.w * .68, y: area.y + area.h * .52, w: area.w * .32, h: area.h * .48 }
                };
            }
            return {
                area: area,
                scatter: { x: area.x, y: area.y, w: area.w * .48, h: area.h * .61 },
                parallel: { x: area.x + area.w * .51, y: area.y, w: area.w * .49, h: area.h * .61 },
                bands: { x: area.x, y: area.y + area.h * .65, w: area.w, h: area.h * .35 }
            };
        }
        function normalize(point, rect) { return { x: M.clamp((point.x - rect.x) / rect.w, 0, 1), y: M.clamp((point.y - rect.y) / rect.h, 0, 1) }; }
        function combine(base, incoming) {
            if (operation === 0) return new Set(incoming);
            if (operation === 1) { var union = new Set(base); incoming.forEach(function (id) { union.add(id); }); return union; }
            if (operation === 2) return new Set(Array.from(base).filter(function (id) { return incoming.has(id); }));
            return new Set(Array.from(base).filter(function (id) { return !incoming.has(id); }));
        }
        function candidatesForBrush(view) {
            var incoming = new Set();
            if (!brush) return incoming;
            var x0 = Math.min(brush.start.x, brush.end.x), x1 = Math.max(brush.start.x, brush.end.x);
            var y0 = Math.min(brush.start.y, brush.end.y), y1 = Math.max(brush.start.y, brush.end.y);
            records.forEach(function (record) {
                if (brush.type === "scatter" && record.a >= x0 && record.a <= x1 && 1 - record.b >= y0 && 1 - record.b <= y1) incoming.add(record.id);
                if (brush.type === "parallel") {
                    var value = [record.a, record.b, record.c, record.d][brush.axis];
                    if (1 - value >= y0 && 1 - value <= y1) incoming.add(record.id);
                }
                if (brush.type === "bands" && record.group === brush.group && record.c >= x0 && record.c <= x1) incoming.add(record.id);
            });
            return incoming;
        }
        function nearestRecord(point, view) {
            if (!contains(view.scatter, point)) return -1;
            var best = -1, distance = 18;
            records.forEach(function (record) {
                var x = view.scatter.x + record.a * view.scatter.w;
                var y = view.scatter.y + (1 - record.b) * view.scatter.h;
                var next = M.dist(point.x, point.y, x, y);
                if (next < distance) { distance = next; best = record.id; }
            });
            return best;
        }
        function start(pointer, event) {
            if (activePointerId !== null) return;
            var point = pixels(env, pointer), view = plots();
            hover = nearestRecord(point, view);
            var type = null, startPoint = null, axis = 0, group = 0;
            if (contains(view.scatter, point)) { type = "scatter"; startPoint = normalize(point, view.scatter); }
            else if (contains(view.parallel, point)) {
                type = "parallel"; startPoint = normalize(point, view.parallel);
                axis = M.clamp(Math.round(startPoint.x * 3), 0, 3); startPoint.x = axis / 3;
            } else if (contains(view.bands, point)) {
                type = "bands"; startPoint = normalize(point, view.bands);
                group = M.clamp(Math.floor(startPoint.y * 4), 0, 3); startPoint.y = group / 4;
            }
            if (!type) return;
            activePointerId = event ? event.pointerId : 1;
            brush = { type: type, axis: axis, group: group, start: startPoint, end: { x: startPoint.x, y: startPoint.y }, base: new Set(selected), down: point, moved: 0 };
            previewSelection = new Set(selected);
        }
        function move(pointer, event) {
            var pointerId = event ? event.pointerId : 1;
            if (activePointerId !== null && activePointerId !== pointerId) return;
            var point = pixels(env, pointer), view = plots();
            hover = nearestRecord(point, view);
            if (!brush) return;
            var rect = brush.type === "scatter" ? view.scatter : brush.type === "parallel" ? view.parallel : view.bands;
            var next = normalize(point, rect);
            if (brush.type === "parallel") next.x = brush.axis / 3;
            if (brush.type === "bands") next.y = brush.group / 4;
            brush.end = next;
            brush.moved = Math.max(brush.moved, M.dist(point.x, point.y, brush.down.x, brush.down.y));
            previewSelection = combine(brush.base, candidatesForBrush(view));
        }
        function finish(cancelled) {
            if (!brush) { activePointerId = null; return; }
            if (cancelled) selected = new Set(brush.base);
            else if (brush.moved < 6 && hover >= 0) pinned = pinned === hover ? -1 : hover;
            else selected = new Set(previewSelection);
            brush = null; activePointerId = null; previewSelection = new Set(selected);
        }
        function isOn(id) { return (brush ? previewSelection : selected).has(id); }

        return {
            pointerDown: start,
            pointerMove: move,
            pointerUp: function (_, event) { if (activePointerId === (event ? event.pointerId : 1)) finish(false); },
            pointerCancel: function (_, event) { if (activePointerId === (event ? event.pointerId : 1)) finish(true); },
            action: function () { operation = (operation + 1) % operations.length; setAction(); },
            keyDown: function (event) {
                var number = Number(event.key);
                if (number >= 1 && number <= 4) { operation = number - 1; setAction(); }
                if (event.key.toLowerCase() === "c") {
                    finish(true); selected.clear(); previewSelection.clear(); pinned = -1;
                }
                if (event.key === "Escape") finish(true);
            },
            demo: function (time) {
                var view = plots(), cycle = Math.floor(time / 6);
                if (cycle !== lastDemoCycle) {
                    lastDemoCycle = cycle; operation = cycle % 2; setAction();
                    var sx = .08 + (cycle % 3) * .12;
                    brush = { type: "scatter", axis: 0, group: 0, start: { x: sx, y: .18 }, end: { x: sx + .4, y: .72 }, base: new Set(selected), down: { x: 0, y: 0 }, moved: 30 };
                }
                brush.end.x = M.clamp(brush.start.x + .32 + Math.sin(time * .8) * .1, 0, 1);
                previewSelection = combine(brush.base, candidatesForBrush(view));
            },
            update: function () {
                var activeSet = brush ? previewSelection : selected;
                env.setMeter(activeSet.size / records.length);
                env.setState(activeSet.size + " / " + records.length + " LINKED IDs / " + operations[operation], "所有视图复用同一稳定记录 ID 集，而不是分别执行近似筛选");
            },
            draw: function () {
                begin(env, ctx, "#071016");
                var view = plots();
                [view.scatter, view.parallel, view.bands].forEach(function (rect) { rounded(ctx, rect.x, rect.y, rect.w, rect.h, 18, "rgba(255,255,255,.028)", "rgba(255,255,255,.12)"); });
                mono(ctx, "SCATTER / A × B", view.scatter.x + 10, view.scatter.y + 14, 7, "rgba(255,255,255,.43)");
                records.forEach(function (record) {
                    var on = isOn(record.id), pinnedRecord = record.id === pinned;
                    var x = view.scatter.x + record.a * view.scatter.w;
                    var y = view.scatter.y + (1 - record.b) * view.scatter.h;
                    ctx.beginPath(); ctx.arc(x, y, pinnedRecord ? 7 : on ? 4.2 : 2.3, 0, TAU);
                    ctx.fillStyle = on || pinnedRecord ? colors[record.group] : "rgba(255,255,255,.11)"; ctx.fill();
                    if (pinnedRecord) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke(); }
                });
                mono(ctx, "PARALLEL / A B C D", view.parallel.x + 10, view.parallel.y + 14, 7, "rgba(255,255,255,.43)");
                records.forEach(function (record) {
                    var values = [record.a, record.b, record.c, record.d];
                    ctx.beginPath();
                    values.forEach(function (value, axis) {
                        var x = view.parallel.x + axis / 3 * view.parallel.w;
                        var y = view.parallel.y + (1 - value) * view.parallel.h;
                        if (!axis) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    });
                    var on = isOn(record.id), pinnedRecord = record.id === pinned;
                    ctx.strokeStyle = on || pinnedRecord ? colors[record.group] : "rgba(255,255,255,.035)";
                    ctx.globalAlpha = pinnedRecord ? 1 : on ? .55 : 1; ctx.lineWidth = pinnedRecord ? 2.4 : on ? 1.25 : .7; ctx.stroke(); ctx.globalAlpha = 1;
                });
                mono(ctx, "GROUP DISTRIBUTION / C", view.bands.x + 10, view.bands.y + 13, 7, "rgba(255,255,255,.43)");
                for (var group = 0; group < 4; group += 1) {
                    var groupRecords = records.filter(function (record) { return record.group === group; });
                    var onCount = groupRecords.filter(function (record) { return isOn(record.id); }).length;
                    var y = view.bands.y + (group + .5) / 4 * view.bands.h;
                    ctx.strokeStyle = "rgba(255,255,255,.09)"; ctx.beginPath(); ctx.moveTo(view.bands.x + 12, y); ctx.lineTo(view.bands.x + view.bands.w - 48, y); ctx.stroke();
                    groupRecords.forEach(function (record) {
                        var x = view.bands.x + 12 + record.c * (view.bands.w - 64);
                        var jitter = (record.id % 5 - 2) * 2.1;
                        var linked = isOn(record.id), pinnedRecord = record.id === pinned;
                        ctx.beginPath(); ctx.arc(x, y + jitter, pinnedRecord ? 4.5 : linked ? 3.4 : 1.8, 0, TAU);
                        ctx.fillStyle = linked || pinnedRecord ? colors[group] : "rgba(255,255,255,.12)"; ctx.fill();
                        if (pinnedRecord) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2; ctx.stroke(); }
                    });
                    mono(ctx, "G" + (group + 1) + "  " + onCount, view.bands.x + view.bands.w - 12, y, 7, colors[group], "right");
                }
                if (brush) {
                    var rect = brush.type === "scatter" ? view.scatter : brush.type === "parallel" ? view.parallel : view.bands;
                    if (brush.type === "scatter") {
                        var x0 = rect.x + Math.min(brush.start.x, brush.end.x) * rect.w, x1 = rect.x + Math.max(brush.start.x, brush.end.x) * rect.w;
                        var y0 = rect.y + Math.min(brush.start.y, brush.end.y) * rect.h, y1 = rect.y + Math.max(brush.start.y, brush.end.y) * rect.h;
                        ctx.fillStyle = "rgba(110,231,255,.09)"; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.strokeStyle = "#6ee7ff"; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
                    } else if (brush.type === "parallel") {
                        var axisX = rect.x + brush.axis / 3 * rect.w;
                        var ay0 = rect.y + Math.min(brush.start.y, brush.end.y) * rect.h, ay1 = rect.y + Math.max(brush.start.y, brush.end.y) * rect.h;
                        ctx.strokeStyle = "#6ee7ff"; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(axisX, ay0); ctx.lineTo(axisX, ay1); ctx.stroke();
                    } else {
                        var bx0 = rect.x + Math.min(brush.start.x, brush.end.x) * rect.w, bx1 = rect.x + Math.max(brush.start.x, brush.end.x) * rect.w;
                        var by = rect.y + (brush.group + .5) / 4 * rect.h;
                        ctx.strokeStyle = "#6ee7ff"; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(bx0, by); ctx.lineTo(bx1, by); ctx.stroke();
                    }
                }
                mono(ctx, operations[operation], view.area.x + view.area.w - 8, view.area.y + view.area.h - 9, 8, "#6ee7ff", "right");
            }
        };
    });
}());
