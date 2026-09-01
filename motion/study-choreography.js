(function () {
    "use strict";
    var M = window.MotionStudy, TAU = M.TAU;

    function surface(env) {
        var ctx = env.canvas.getContext("2d");
        function begin() {
            ctx.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
            ctx.clearRect(0, 0, env.width, env.height);
        }
        function panel(x, y, w, h, fill, radius) {
            M.roundedRect(ctx, x, y, w, h, radius || 22);
            ctx.fillStyle = fill || "rgba(14,18,31,.86)"; ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,.13)"; ctx.stroke();
        }
        return { ctx: ctx, begin: begin, panel: panel };
    }

    M.register("shared-axis-transition", function (env) {
        var s = surface(env), p = 0, target = 0, velocity = 0, axis = 0;
        env.setAction("CHANGE AXIS");
        function pointerMove(pointer) { if (pointer.down) target = pointer.x; }
        function drawScene(offset, scale, alpha, incoming) {
            var ctx = s.ctx, w = Math.min(470, env.width * .42), h = Math.min(360, env.height * .52);
            var x = env.width * .64 - w * .5 + (axis === 0 ? offset : 0);
            var y = env.height * .5 - h * .5 + (axis === 1 ? offset : 0);
            ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x + w / 2, y + h / 2); ctx.scale(scale, scale); ctx.translate(-w / 2, -h / 2);
            s.panel(0, 0, w, h, incoming ? "rgba(15,27,43,.94)" : "rgba(27,18,40,.94)", 32);
            ctx.fillStyle = incoming ? env.accent : env.accent2; ctx.fillRect(26, 30, 62, 6);
            for (var i = 0; i < 3; i += 1) {
                var yy = 78 + i * 82;
                s.panel(24, yy, w - 48, 62, "rgba(255,255,255," + (.055 + i * .012) + ")", 15);
                ctx.fillStyle = i === 1 ? (incoming ? env.accent : env.accent2) : "rgba(255,255,255,.28)";
                ctx.beginPath(); ctx.arc(48, yy + 31, 10 + i * 2, 0, TAU); ctx.fill();
                ctx.fillStyle = "rgba(255,255,255,.52)"; ctx.fillRect(72, yy + 20, 90 + i * 38, 5);
                ctx.fillStyle = "rgba(255,255,255,.16)"; ctx.fillRect(72, yy + 34, 150, 4);
            }
            ctx.restore();
        }
        return {
            pointerDown: function (pointer) { target = pointer.x; }, pointerMove: pointerMove,
            pointerUp: function () { target = target > .5 ? 1 : 0; },
            action: function () { axis = (axis + 1) % 3; target = target < .5 ? 1 : 0; env.setState(["X AXIS", "Y AXIS", "Z AXIS"][axis] + " / NAVIGATION", "拖动控制进度 · 按钮切换共享轴"); },
            demo: function (time) { target = .5 + .5 * Math.sin(time * .7); },
            update: function (dt) { var v = M.spring(p, velocity, target, 32, 8, dt); p = v.value; velocity = v.velocity; env.setMeter(p); },
            draw: function () { s.begin(); M.grid(s.ctx, env.width, env.height, 70); var span = axis === 2 ? 0 : Math.min(env.width, env.height) * .46; drawScene(-p * span, 1 - (axis === 2 ? p * .12 : 0), 1 - p * .72, false); drawScene((1 - p) * span, .88 + (axis === 2 ? p * .12 : .12), .28 + p * .72, true); M.label(s.ctx, ["SHARED X", "SHARED Y", "SHARED Z"][axis], env.width * .64, env.height * .18, "rgba(255,255,255,.52)", 11, "center"); }
        };
    });

    M.register("fade-through-transition", function (env) {
        var s = surface(env), progress = 0, target = 0, velocity = 0;
        env.setAction("SWAP CONTENT");
        function layer(alpha, scale, second) {
            var ctx = s.ctx, w = Math.min(530, env.width * .52), h = Math.min(330, env.height * .48), x = env.width * .62 - w / 2, y = env.height * .5 - h / 2;
            ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x + w / 2, y + h / 2); ctx.scale(scale, scale); ctx.translate(-w / 2, -h / 2);
            s.panel(0, 0, w, h, second ? "rgba(13,27,35,.94)" : "rgba(30,18,35,.94)", 30);
            var gradient = ctx.createLinearGradient(24, 24, w - 24, h - 24); gradient.addColorStop(0, second ? env.accent : env.accent2); gradient.addColorStop(1, "rgba(255,255,255,.05)");
            M.roundedRect(ctx, 24, 24, w - 48, 140, 22); ctx.fillStyle = gradient; ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.font = "800 32px Inter,Segoe UI"; ctx.fillText(second ? "AFTER" : "BEFORE", 38, 210);
            ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(38, 234, w * .62, 6); ctx.fillRect(38, 252, w * .43, 6);
            ctx.restore();
        }
        return {
            pointerDown: function (p) { target = p.x; }, pointerMove: function (p) { if (p.down) target = p.x; }, pointerUp: function () { target = target > .5 ? 1 : 0; },
            action: function () { target = target < .5 ? 1 : 0; }, demo: function (time) { target = .5 + .5 * Math.sin(time * .55); },
            update: function (dt) { var v = M.spring(progress, velocity, target, 30, 9, dt); progress = v.value; velocity = v.velocity; env.setMeter(progress); env.setState(progress < .45 ? "OUTGOING / FADE" : progress < .55 ? "EXCHANGE POINT" : "INCOMING / FADE", "先完全退出，再让新内容进入"); },
            draw: function () { s.begin(); var out = 1 - M.smoothstep(0, .46, progress), inside = M.smoothstep(.54, 1, progress); layer(out, 1 - progress * .035, false); layer(inside, .965 + inside * .035, true); var ctx = s.ctx; ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.beginPath(); ctx.moveTo(env.width * .42, env.height * .78); ctx.lineTo(env.width * .82, env.height * .78); ctx.stroke(); ctx.fillStyle = env.accent; ctx.fillRect(env.width * .42 + env.width * .4 * progress - 2, env.height * .78 - 7, 4, 14); }
        };
    });

    M.register("explode-transition", function (env) {
        var s = surface(env), epic = { x: .68, y: .5 }, open = 0, target = 0, vel = 0, pieces = [];
        for (var i = 0; i < 18; i += 1) pieces.push({ col: i % 6, row: Math.floor(i / 6), spin: ((i * 73) % 11 - 5) * .018 });
        env.setAction("EXPLODE / GATHER");
        function trigger(p) { epic.x = p.x; epic.y = p.y; target = target < .5 ? 1 : 0; }
        return {
            pointerDown: trigger, action: function () { target = target < .5 ? 1 : 0; }, demo: function (time) { epic.x = .64 + Math.cos(time) * .12; epic.y = .5 + Math.sin(time * .8) * .15; target = Math.sin(time * .65) > 0 ? 1 : 0; },
            update: function (dt) { var v = M.spring(open, vel, target, 28, 7, dt); open = v.value; vel = v.velocity; env.setMeter(open); env.setState(target ? "EXPLODING / EPICENTER" : "GATHERING / LAYOUT", "点击任意位置重设放射焦点"); },
            draw: function () {
                s.begin(); var ctx = s.ctx, w = Math.min(600, env.width * .55), h = Math.min(390, env.height * .56), x0 = env.width * .63 - w / 2, y0 = env.height * .5 - h / 2, gap = 10, cw = (w - gap * 5) / 6, ch = (h - gap * 2) / 3;
                pieces.forEach(function (piece, index) {
                    var bx = x0 + piece.col * (cw + gap), by = y0 + piece.row * (ch + gap), cx = bx + cw / 2, cy = by + ch / 2;
                    var dx = cx - epic.x * env.width, dy = cy - epic.y * env.height, length = Math.hypot(dx, dy) || 1, amount = M.easeInOut(open);
                    ctx.save(); ctx.translate(cx + dx / length * amount * (110 + length * .18), cy + dy / length * amount * (110 + length * .18)); ctx.rotate(piece.spin * length * amount); ctx.globalAlpha = 1 - amount * .38;
                    M.roundedRect(ctx, -cw / 2, -ch / 2, cw, ch, 15); ctx.fillStyle = index % 5 === 0 ? env.accent : "rgba(255,255,255," + (.07 + piece.row * .025) + ")"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.stroke(); ctx.restore();
                });
                ctx.strokeStyle = env.accent2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(epic.x * env.width, epic.y * env.height, 12 + open * 18, 0, TAU); ctx.stroke();
            }
        };
    });

    M.register("radial-reaction", function (env) {
        var s = surface(env), origin = { x: .68, y: .52 }, elapsed = 1.2, pulses = 0;
        env.setAction("SEND REACTION");
        function trigger(p) { if (p) { origin.x = p.x; origin.y = p.y; } elapsed = 0; pulses += 1; }
        return {
            pointerDown: trigger, action: function () { trigger(); }, demo: function (time, cycle) { origin.x = .66 + Math.sin(time * .71) * .16; origin.y = .52 + Math.cos(time * .57) * .17; if (cycle < .04) trigger(); },
            update: function (dt) { elapsed += dt; env.setMeter(M.clamp(elapsed / 1.5, 0, 1)); env.setState("WAVE " + String(pulses).padStart(2, "0") + " / " + Math.round(elapsed * 1000) + "MS", "触点距离决定每个单元的响应时刻"); },
            draw: function () {
                s.begin(); var ctx = s.ctx, cols = env.mobile ? 6 : 9, rows = 6, areaW = Math.min(690, env.width * .62), areaH = Math.min(430, env.height * .62), x0 = env.width * .64 - areaW / 2, y0 = env.height * .51 - areaH / 2, cellW = areaW / cols, cellH = areaH / rows;
                for (var y = 0; y < rows; y += 1) for (var x = 0; x < cols; x += 1) {
                    var cx = x0 + (x + .5) * cellW, cy = y0 + (y + .5) * cellH, d = M.dist(cx, cy, origin.x * env.width, origin.y * env.height), local = M.clamp((elapsed - d / 620) / .34, 0, 1), pop = Math.sin(local * Math.PI);
                    ctx.save(); ctx.translate(cx, cy); ctx.scale(1 + pop * .18, 1 + pop * .18); M.roundedRect(ctx, -cellW * .38, -cellH * .34, cellW * .76, cellH * .68, 11); ctx.fillStyle = M.mixColor("#151a2a", (x + y) % 2 ? env.accent : env.accent2, local * .72); ctx.globalAlpha = .58 + local * .42; ctx.fill(); ctx.restore();
                }
                var radius = elapsed * 620; ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(origin.x * env.width, origin.y * env.height, radius, 0, TAU); ctx.stroke(); ctx.fillStyle = env.accent; ctx.beginPath(); ctx.arc(origin.x * env.width, origin.y * env.height, 6, 0, TAU); ctx.fill();
            }
        };
    });

    M.register("staggered-choreography", function (env) {
        var s = surface(env), elapsed = 0, order = 0, playing = true;
        env.setAction("CHANGE ORDER");
        function restart() { elapsed = 0; playing = true; }
        return {
            pointerDown: restart, action: function () { order = (order + 1) % 3; restart(); env.setState(["READING ORDER", "DISTANCE ORDER", "HIERARCHY ORDER"][order], "同一元素，三种有语义的错时规则"); }, demo: function (time, cycle) { if (cycle < .04) { order = Math.floor(time / 8) % 3; restart(); } },
            update: function (dt) { if (playing) elapsed += dt; if (elapsed > 2.4) playing = false; env.setMeter(M.clamp(elapsed / 1.8, 0, 1)); },
            draw: function () {
                s.begin(); var ctx = s.ctx, count = 12, cols = 4, w = Math.min(620, env.width * .58), h = Math.min(390, env.height * .57), x0 = env.width * .64 - w / 2, y0 = env.height * .51 - h / 2;
                for (var i = 0; i < count; i += 1) {
                    var col = i % cols, row = Math.floor(i / cols), index = order === 0 ? i : order === 1 ? Math.abs(col - 1.5) + Math.abs(row - 1) * .8 : row * .42 + col * .11, delay = index * (order === 0 ? .075 : .11), p = M.easeOut(M.clamp((elapsed - delay) / .55, 0, 1));
                    var cw = w / cols - 12, ch = h / 3 - 12, x = x0 + col * w / cols, y = y0 + row * h / 3 + (1 - p) * 44;
                    ctx.save(); ctx.globalAlpha = p; M.roundedRect(ctx, x, y, cw, ch, 18); ctx.fillStyle = i === 5 ? env.accent : "rgba(255,255,255," + (.055 + p * .055) + ")"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.stroke(); M.label(ctx, String(i + 1).padStart(2, "0"), x + 15, y + 18, i === 5 ? "#071019" : "rgba(255,255,255,.48)", 9); ctx.restore();
                }
            }
        };
    });

    M.register("staged-transition", function (env) {
        var s = surface(env), progress = 0, target = 1, velocity = 0;
        env.setAction("REPLAY STAGES");
        return {
            pointerDown: function (p) { target = p.x; }, pointerMove: function (p) { if (p.down) target = p.x; }, pointerUp: function () { target = target > .5 ? 1 : 0; }, action: function () { progress = 0; target = 1; }, demo: function (time) { target = .5 + .5 * Math.sin(time * .45); },
            update: function (dt) { var v = M.spring(progress, velocity, target, 22, 8, dt); progress = v.value; velocity = v.velocity; env.setMeter(progress); env.setState(progress < .33 ? "STAGE 1 / SCALE" : progress < .66 ? "STAGE 2 / POSITION" : "STAGE 3 / VALUE", "尺度 → 位置 → 数值，属性阶段不重叠"); },
            draw: function () {
                s.begin(); var ctx = s.ctx, bars = [72, 118, 155, 96, 180, 132], w = Math.min(600, env.width * .58), base = env.height * .72, x0 = env.width * .64 - w / 2;
                var scaleP = M.smoothstep(0, .33, progress), posP = M.smoothstep(.33, .66, progress), valueP = M.smoothstep(.66, 1, progress);
                ctx.strokeStyle = "rgba(255,255,255,.13)"; ctx.beginPath(); ctx.moveTo(x0, base); ctx.lineTo(x0 + w, base); ctx.stroke();
                bars.forEach(function (height, i) {
                    var oldX = x0 + i * w / bars.length, newIndex = [2, 5, 0, 4, 1, 3][i], newX = x0 + newIndex * w / bars.length, x = M.lerp(oldX, newX, posP), oldH = 60 + i * 15, h = M.lerp(oldH, height, valueP), bw = M.lerp(26, w / bars.length - 16, scaleP);
                    var gradient = ctx.createLinearGradient(0, base - h, 0, base); gradient.addColorStop(0, i % 2 ? env.accent : env.accent2); gradient.addColorStop(1, "rgba(255,255,255,.08)"); M.roundedRect(ctx, x + 7, base - h, bw, h, 11); ctx.fillStyle = gradient; ctx.fill();
                    M.label(ctx, Math.round(M.lerp(20 + i * 7, height, valueP)), x + 7 + bw / 2, base - h - 17, "rgba(255,255,255,.58)", 9, "center");
                });
                [0, .33, .66, 1].forEach(function (tick, i) { var tx = x0 + tick * w; ctx.fillStyle = progress >= tick ? env.accent : "rgba(255,255,255,.18)"; ctx.fillRect(tx - 1, base + 22, 2, 12); if (i < 3) M.label(ctx, ["SCALE", "POSITION", "VALUE"][i], x0 + (tick + .165) * w, base + 48, "rgba(255,255,255,.38)", 8, "center"); });
            }
        };
    });

    M.register("predictive-back", function (env) {
        var s = surface(env), progress = 0, target = 0, velocity = 0, dragging = false, committed = false;
        env.setAction("RESET STACK");
        function down(p) { if (p.x < .22 || env.preview) { dragging = true; target = 0; committed = false; } }
        return {
            pointerDown: down,
            pointerMove: function (p) { if (dragging) target = M.clamp((p.x - .02) / .72, 0, 1); },
            pointerUp: function (p) { if (!dragging) return; dragging = false; committed = target > .48 || p.vx > 1.15; target = committed ? 1 : 0; },
            action: function () { target = 0; committed = false; },
            demo: function (time, cycle) { if (cycle < .05) down({ x: 0 }); if (cycle < 4) { dragging = true; target = M.smoothstep(.4, 3.7, cycle) * .78; } else if (dragging) { dragging = false; committed = true; target = 1; } if (cycle > 6.5) target = 0; },
            update: function (dt) { var v = M.spring(progress, velocity, target, dragging ? 70 : 30, dragging ? 13 : 8, dt); progress = v.value; velocity = v.velocity; env.setMeter(progress); env.setState(dragging ? "PREVIEW / " + Math.round(progress * 100) + "%" : committed ? "COMMITTED / BACK" : "CURRENT / READY", "从左边缘拖动，释放可提交或取消"); },
            draw: function () {
                s.begin(); var ctx = s.ctx, w = Math.min(430, env.width * .44), h = Math.min(560, env.height * .72), cx = env.width * .66, y = env.height * .5 - h / 2;
                ctx.save(); ctx.translate(cx - w / 2 - 34 + progress * 34, y + 16); ctx.scale(.94 + progress * .06, .94 + progress * .06); s.panel(0, 0, w, h, "rgba(18,30,40,.94)", 35); ctx.fillStyle = env.accent; ctx.fillRect(28, 34, 92, 7); for (var i = 0; i < 4; i += 1) { s.panel(26, 82 + i * 93, w - 52, 70, "rgba(255,255,255,.06)", 17); } ctx.restore();
                ctx.save(); ctx.translate(cx - w / 2 + progress * (w + 70), y); ctx.rotate(progress * .025); ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 40; s.panel(0, 0, w, h, "rgba(27,18,40,.98)", 35); ctx.shadowBlur = 0; ctx.fillStyle = env.accent2; ctx.fillRect(28, 34, 74, 7); M.label(ctx, "CURRENT VIEW", 28, 68, "rgba(255,255,255,.58)", 9); for (var j = 0; j < 3; j += 1) { s.panel(26, 104 + j * 104, w - 52, 82, "rgba(255,255,255,.065)", 18); } ctx.restore();
                ctx.strokeStyle = env.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(18, env.height * .35); ctx.lineTo(18, env.height * .65); ctx.stroke();
            }
        };
    });

    M.register("swipe-to-dismiss", function (env) {
        var s = surface(env), cards = [0, 1, 2, 3].map(function (i) { return { id: i, x: 0, vx: 0, gone: false }; }), active = -1, dragStartX = 0, cardStartX = 0;
        env.setAction("UNDO ALL");
        function indexAt(p) {
            var top = env.height * .31, cardH = Math.min(76, env.height * .095), gap = 14, w = Math.min(560, env.width * .55), left = env.width * .64 - w / 2;
            var px = p.x * env.width, localY = p.y * env.height - top, index = Math.floor(localY / (cardH + gap));
            if (px < left || px > left + w || index < 0 || index >= cards.length || localY - index * (cardH + gap) > cardH || cards[index].gone) return -1;
            return index;
        }
        return {
            pointerDown: function (p) { active = indexAt(p); if (active >= 0) { dragStartX = p.x * env.width; cardStartX = cards[active].x; cards[active].vx = 0; } },
            pointerMove: function (p) { if (active >= 0 && p.down) { cards[active].x = cardStartX + p.x * env.width - dragStartX; cards[active].vx = p.vx * env.width; } },
            pointerUp: function () { if (active < 0) return; var card = cards[active]; card.gone = Math.abs(card.x) > env.width * .16 || Math.abs(card.vx) > 620; active = -1; },
            action: function () { cards.forEach(function (c) { c.gone = false; c.x = 0; c.vx = 0; }); },
            demo: function (time, cycle) { var index = Math.floor(time / 8) % cards.length; if (cycle < 3.4) { active = index; cards[index].x = M.easeInOut(cycle / 3.4) * env.width * .34; cards[index].vx = 240; } else if (active >= 0) { cards[active].gone = true; active = -1; } if (cycle > 7.4 && cards.filter(function (c) { return !c.gone; }).length < 2) cards.forEach(function (c) { c.gone = false; c.x = 0; }); },
            update: function (dt) { cards.forEach(function (c) { if (c.gone) { c.vx += (Math.sign(c.x || 1) * env.width * 1.4 - c.x) * 8 * dt; c.x += c.vx * dt; } else if (c.id !== active) { var v = M.spring(c.x, c.vx, 0, 42, 10, dt); c.x = v.value; c.vx = v.velocity; } }); var remain = cards.filter(function (c) { return !c.gone; }).length; env.setMeter(1 - remain / cards.length); env.setState(remain + " ITEMS / THRESHOLD", "横向位移或释放速度越过阈值才执行"); },
            draw: function () {
                s.begin(); var ctx = s.ctx, w = Math.min(560, env.width * .55), x = env.width * .64 - w / 2, top = env.height * .31, cardH = Math.min(76, env.height * .095), gap = 14;
                cards.forEach(function (card, i) { var y = top + i * (cardH + gap); M.roundedRect(ctx, x, y, w, cardH, 18); ctx.fillStyle = card.x > 15 ? "rgba(52,211,153,.25)" : card.x < -15 ? "rgba(251,113,133,.25)" : "rgba(255,255,255,.035)"; ctx.fill(); ctx.fillStyle = card.x > 15 ? "#6ee7b7" : "#fb7185"; M.label(ctx, card.x > 15 ? "ARCHIVE" : "DELETE", card.x > 15 ? x + 28 : x + w - 28, y + cardH / 2, ctx.fillStyle, 9, card.x > 15 ? "left" : "right"); ctx.save(); ctx.translate(card.x, 0); M.roundedRect(ctx, x, y, w, cardH, 18); ctx.fillStyle = "rgba(18,23,38,.98)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.stroke(); ctx.fillStyle = i % 2 ? env.accent : env.accent2; ctx.beginPath(); ctx.arc(x + 34, y + cardH / 2, 10, 0, TAU); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.fillRect(x + 58, y + cardH / 2 - 8, 118 + i * 24, 5); ctx.fillStyle = "rgba(255,255,255,.15)"; ctx.fillRect(x + 58, y + cardH / 2 + 7, 190, 4); ctx.restore(); });
            }
        };
    });

    M.register("symbol-replace-transition", function (env) {
        var s = surface(env), progress = 0, target = 0, velocity = 0, icon = 0;
        env.setAction("REPLACE SYMBOL");
        function drawIcon(ctx, type, alpha, scale) {
            ctx.save(); ctx.globalAlpha = alpha; ctx.scale(scale, scale); ctx.strokeStyle = type ? env.accent : env.accent2; ctx.fillStyle = type ? env.accent : env.accent2; ctx.lineWidth = 10; ctx.lineCap = "round"; ctx.lineJoin = "round";
            if (icon === 0) { if (type === 0) { ctx.beginPath(); ctx.moveTo(-25, -38); ctx.lineTo(38, 0); ctx.lineTo(-25, 38); ctx.closePath(); ctx.fill(); } else { ctx.fillRect(-32, -37, 20, 74); ctx.fillRect(12, -37, 20, 74); } }
            else if (icon === 1) { if (type === 0) { ctx.beginPath(); ctx.arc(0, 0, 38, .25, TAU - .25); ctx.stroke(); ctx.beginPath(); ctx.moveTo(29, -28); ctx.lineTo(43, -22); ctx.lineTo(40, -40); ctx.stroke(); } else { ctx.beginPath(); ctx.moveTo(-38, 0); ctx.lineTo(-14, 25); ctx.lineTo(40, -31); ctx.stroke(); } }
            else { if (type === 0) { ctx.beginPath(); ctx.moveTo(-45, -24); ctx.lineTo(-18, -24); ctx.lineTo(10, -49); ctx.lineTo(10, 49); ctx.lineTo(-18, 24); ctx.lineTo(-45, 24); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(11, 0, 28, -1.1, 1.1); ctx.stroke(); } else { ctx.beginPath(); ctx.moveTo(-38, -34); ctx.lineTo(38, 34); ctx.moveTo(38, -34); ctx.lineTo(-38, 34); ctx.stroke(); } }
            ctx.restore();
        }
        return {
            pointerDown: function () { target = target < .5 ? 1 : 0; }, action: function () { icon = (icon + 1) % 3; target = target < .5 ? 1 : 0; }, demo: function (time) { target = Math.sin(time * .8) > 0 ? 1 : 0; icon = Math.floor(time / 6) % 3; },
            update: function (dt) { var v = M.spring(progress, velocity, target, 44, 10, dt); progress = v.value; velocity = v.velocity; env.setMeter(progress); env.setState(["PLAY / PAUSE", "SYNC / DONE", "SOUND / MUTED"][icon], "分层符号执行 down-up 替换序列"); },
            draw: function () { s.begin(); var ctx = s.ctx, x = env.width * .66, y = env.height * .51, out = M.clamp(1 - progress * 1.7, 0, 1), inside = M.clamp((progress - .35) * 1.55, 0, 1); ctx.save(); ctx.translate(x, y); ctx.shadowColor = env.accent; ctx.shadowBlur = 30; ctx.beginPath(); ctx.arc(0, 0, 104, 0, TAU); ctx.fillStyle = "rgba(255,255,255,.045)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.13)"; ctx.stroke(); ctx.shadowBlur = 0; drawIcon(ctx, 0, out, .72 + out * .28); drawIcon(ctx, 1, inside, .72 + inside * .28); ctx.restore(); }
        };
    });

    M.register("variable-color-symbol", function (env) {
        var s = surface(env), progress = .2, target = .8, velocity = 0, cumulative = true;
        env.setAction("CHANGE MODE");
        return {
            pointerDown: function (p) { target = p.x; }, pointerMove: function (p) { if (p.down) target = p.x; }, action: function () { cumulative = !cumulative; }, demo: function (time) { target = .5 + .48 * Math.sin(time * .68); cumulative = Math.floor(time / 8) % 2 === 0; },
            update: function (dt) { var v = M.spring(progress, velocity, target, 35, 9, dt); progress = M.clamp(v.value, 0, 1); velocity = v.velocity; env.setMeter(progress); env.setState((cumulative ? "CUMULATIVE" : "ITERATIVE") + " / " + Math.round(progress * 100) + "%", "语义图层按进度独立点亮"); },
            draw: function () {
                s.begin(); var ctx = s.ctx, cx = env.width * .66, cy = env.height * .54, layers = 5;
                ctx.save(); ctx.translate(cx, cy); ctx.lineCap = "round";
                for (var i = 0; i < layers; i += 1) {
                    var threshold = i / layers, local = cumulative ? M.smoothstep(threshold, threshold + .28, progress) : Math.pow(Math.max(0, 1 - Math.abs(progress * layers - i - .5)), 2), radius = 40 + i * 35;
                    ctx.strokeStyle = M.mixColor("#31384b", i % 2 ? env.accent2 : env.accent, local); ctx.lineWidth = 13; ctx.globalAlpha = .42 + local * .58; ctx.beginPath(); ctx.arc(0, 48, radius, Math.PI * 1.16, Math.PI * 1.84); ctx.stroke();
                }
                ctx.globalAlpha = 1; ctx.fillStyle = progress > .82 ? env.accent : "rgba(255,255,255,.24)"; ctx.beginPath(); ctx.arc(0, 52, 13, 0, TAU); ctx.fill(); ctx.restore();
                var barW = Math.min(430, env.width * .4), x = cx - barW / 2, y = cy + 205; ctx.fillStyle = "rgba(255,255,255,.09)"; ctx.fillRect(x, y, barW, 3); ctx.fillStyle = env.accent; ctx.fillRect(x, y, barW * progress, 3); ctx.beginPath(); ctx.arc(x + barW * progress, y + 1.5, 8, 0, TAU); ctx.fill();
            }
        };
    });
}());
