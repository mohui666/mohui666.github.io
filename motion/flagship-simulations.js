(function () {
    "use strict";

    var M = window.MotionStudy;
    var TAU = M.TAU;

    function replace(slug, factory) {
        M.registry[slug] = factory;
    }

    function context(env) {
        return env.canvas.getContext("2d");
    }

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

    function pointerPixels(env, pointer) {
        return { x: pointer.x * env.width, y: pointer.y * env.height };
    }

    function segmentDistance(px, py, ax, ay, bx, by) {
        var dx = bx - ax;
        var dy = by - ay;
        var t = M.clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
        return M.dist(px, py, ax + dx * t, ay + dy * t);
    }

    function segmentsIntersect(a, b, c, d) {
        var abx = b.x - a.x;
        var aby = b.y - a.y;
        var cdx = d.x - c.x;
        var cdy = d.y - c.y;
        var denominator = M.cross(abx, aby, cdx, cdy);
        if (Math.abs(denominator) < .0001) return false;
        var acx = c.x - a.x;
        var acy = c.y - a.y;
        var t = M.cross(acx, acy, cdx, cdy) / denominator;
        var u = M.cross(acx, acy, abx, aby) / denominator;
        return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    }

    /* 106 — Stable Fluids ------------------------------------------------- */
    replace("stable-fluids", function (env) {
        var ctx = context(env);
        var W = env.mobile ? 52 : 82;
        var H = env.mobile ? 34 : 52;
        var size = W * H;
        var u = new Float32Array(size);
        var v = new Float32Array(size);
        var u0 = new Float32Array(size);
        var v0 = new Float32Array(size);
        var pressure = new Float32Array(size);
        var divergence = new Float32Array(size);
        var red = new Float32Array(size);
        var green = new Float32Array(size);
        var blue = new Float32Array(size);
        var red0 = new Float32Array(size);
        var green0 = new Float32Array(size);
        var blue0 = new Float32Array(size);
        var solid = new Uint8Array(size);
        var offscreen = document.createElement("canvas");
        offscreen.width = W;
        offscreen.height = H;
        var offCtx = offscreen.getContext("2d");
        var pixels = offCtx.createImageData(W, H);
        var activePointers = new Map();
        var tools = ["INK", "VORTEX", "WALL", "ERASE"];
        var tool = 0;
        var radius = env.mobile ? 3.2 : 4.8;
        var paused = false;
        var demoPoint = null;
        var demoPrevious = null;

        addHud(env, [
            ["DRAG / MULTI-TOUCH", "同时注入染料和动量，可形成相撞射流"],
            ["1—4 / BUTTON", "切换 INK、VORTEX、WALL、ERASE"],
            ["WHEEL / [ ]", "改变笔刷半径；Space 暂停求解"]
        ]);
        env.setAction("TOOL / INK");

        function index(x, y) { return x + y * W; }

        function clear() {
            [u, v, u0, v0, pressure, divergence, red, green, blue, red0, green0, blue0].forEach(function (array) { array.fill(0); });
            solid.fill(0);
        }

        function sample(field, x, y) {
            x = M.clamp(x, .5, W - 1.5);
            y = M.clamp(y, .5, H - 1.5);
            var x0 = Math.floor(x);
            var y0 = Math.floor(y);
            var x1 = x0 + 1;
            var y1 = y0 + 1;
            var tx = x - x0;
            var ty = y - y0;
            var top = M.lerp(field[index(x0, y0)], field[index(x1, y0)], tx);
            var bottom = M.lerp(field[index(x0, y1)], field[index(x1, y1)], tx);
            return M.lerp(top, bottom, ty);
        }

        function enforceBoundaries(field) {
            for (var x = 0; x < W; x += 1) { field[index(x, 0)] = 0; field[index(x, H - 1)] = 0; }
            for (var y = 0; y < H; y += 1) { field[index(0, y)] = 0; field[index(W - 1, y)] = 0; }
            for (var i = 0; i < size; i += 1) if (solid[i]) field[i] = 0;
        }

        function project(iterations) {
            pressure.fill(0);
            for (var y = 1; y < H - 1; y += 1) {
                for (var x = 1; x < W - 1; x += 1) {
                    var i = index(x, y);
                    if (solid[i]) { divergence[i] = 0; continue; }
                    divergence[i] = -.5 * (u[index(x + 1, y)] - u[index(x - 1, y)] + v[index(x, y + 1)] - v[index(x, y - 1)]);
                }
            }
            for (var iteration = 0; iteration < iterations; iteration += 1) {
                for (var yy = 1; yy < H - 1; yy += 1) {
                    for (var xx = 1; xx < W - 1; xx += 1) {
                        var cell = index(xx, yy);
                        if (solid[cell]) continue;
                        var left = index(xx - 1, yy);
                        var right = index(xx + 1, yy);
                        var up = index(xx, yy - 1);
                        var down = index(xx, yy + 1);
                        var sum = (solid[left] ? pressure[cell] : pressure[left]) +
                            (solid[right] ? pressure[cell] : pressure[right]) +
                            (solid[up] ? pressure[cell] : pressure[up]) +
                            (solid[down] ? pressure[cell] : pressure[down]);
                        pressure[cell] = (divergence[cell] + sum) * .25;
                    }
                }
            }
            for (var py = 1; py < H - 1; py += 1) {
                for (var px = 1; px < W - 1; px += 1) {
                    var p = index(px, py);
                    if (solid[p]) { u[p] = 0; v[p] = 0; continue; }
                    var leftSolid = solid[index(px - 1, py)];
                    var rightSolid = solid[index(px + 1, py)];
                    var upSolid = solid[index(px, py - 1)];
                    var downSolid = solid[index(px, py + 1)];
                    if (leftSolid || rightSolid) u[p] = 0;
                    else u[p] -= .5 * (pressure[index(px + 1, py)] - pressure[index(px - 1, py)]);
                    if (upSolid || downSolid) v[p] = 0;
                    else v[p] -= .5 * (pressure[index(px, py + 1)] - pressure[index(px, py - 1)]);
                }
            }
            enforceBoundaries(u);
            enforceBoundaries(v);
        }

        function advect(output, source, velocityX, velocityY, dt) {
            for (var y = 1; y < H - 1; y += 1) {
                for (var x = 1; x < W - 1; x += 1) {
                    var i = index(x, y);
                    if (solid[i]) { output[i] = 0; continue; }
                    var backX = x - velocityX[i] * dt;
                    var backY = y - velocityY[i] * dt;
                    for (var stepIndex = 1; stepIndex <= 4; stepIndex += 1) {
                        var traceX = Math.round(M.lerp(x, backX, stepIndex / 4));
                        var traceY = Math.round(M.lerp(y, backY, stepIndex / 4));
                        if (solid[index(M.clamp(traceX, 0, W - 1), M.clamp(traceY, 0, H - 1))]) { backX = x; backY = y; break; }
                    }
                    output[i] = sample(source, backX, backY);
                }
            }
            enforceBoundaries(output);
        }

        function swapVelocity() {
            var temp = u; u = u0; u0 = temp;
            temp = v; v = v0; v0 = temp;
        }

        function swapDye() {
            var temp = red; red = red0; red0 = temp;
            temp = green; green = green0; green0 = temp;
            temp = blue; blue = blue0; blue0 = temp;
        }

        function step(dt) {
            project(env.mobile ? 6 : 10);
            advect(u0, u, u, v, dt);
            advect(v0, v, u, v, dt);
            swapVelocity();
            project(env.mobile ? 6 : 10);
            advect(red0, red, u, v, dt);
            advect(green0, green, u, v, dt);
            advect(blue0, blue, u, v, dt);
            swapDye();
            for (var i = 0; i < size; i += 1) {
                red[i] *= .994;
                green[i] *= .994;
                blue[i] *= .994;
                u[i] *= .996;
                v[i] *= .996;
            }
        }

        function inject(pointer, previous, strength) {
            var cx = 1 + pointer.x * (W - 2);
            var cy = 1 + pointer.y * (H - 2);
            var dx = previous ? (pointer.x - previous.x) * W * 62 : 0;
            var dy = previous ? (pointer.y - previous.y) * H * 62 : 0;
            var speed = Math.hypot(dx, dy);
            if (speed > 38) { dx *= 38 / speed; dy *= 38 / speed; }
            var huePhase = env.time * .7 + pointer.x * 3 + pointer.y * 5;
            var cr = .55 + .45 * Math.sin(huePhase);
            var cg = .55 + .45 * Math.sin(huePhase + 2.1);
            var cb = .55 + .45 * Math.sin(huePhase + 4.2);
            var reach = Math.ceil(radius);
            for (var oy = -reach; oy <= reach; oy += 1) {
                for (var ox = -reach; ox <= reach; ox += 1) {
                    var x = Math.round(cx + ox);
                    var y = Math.round(cy + oy);
                    if (x <= 0 || x >= W - 1 || y <= 0 || y >= H - 1) continue;
                    var distance = Math.hypot(ox, oy);
                    if (distance > radius) continue;
                    var falloff = Math.exp(-distance * distance / (radius * radius * .52)) * (strength || 1);
                    var i = index(x, y);
                    if (tool === 0) {
                        solid[i] = 0;
                        u[i] += dx * falloff;
                        v[i] += dy * falloff;
                        red[i] += cr * falloff * .42;
                        green[i] += cg * falloff * .42;
                        blue[i] += cb * falloff * .42;
                    } else if (tool === 1) {
                        var length = distance || 1;
                        u[i] += -oy / length * falloff * 20 + dx * falloff * .18;
                        v[i] += ox / length * falloff * 20 + dy * falloff * .18;
                        red[i] += .16 * falloff;
                        green[i] += .44 * falloff;
                        blue[i] += .58 * falloff;
                    } else if (tool === 2) {
                        solid[i] = 1;
                        u[i] = 0; v[i] = 0;
                        red[i] = 0; green[i] = 0; blue[i] = 0;
                    } else {
                        solid[i] = 0;
                        u[i] *= .45; v[i] *= .45;
                        red[i] *= .35; green[i] *= .35; blue[i] *= .35;
                    }
                }
            }
        }

        function selectTool(next) {
            tool = M.mod(next, tools.length);
            env.setAction("TOOL / " + tools[tool]);
        }

        return {
            pointerDown: function (pointer, event) {
                var id = event ? event.pointerId : 1;
                var copy = { x: pointer.x, y: pointer.y };
                activePointers.set(id, copy);
                inject(copy, { x: copy.x - .008, y: copy.y }, 1.25);
            },
            pointerMove: function (pointer, event) {
                var id = event ? event.pointerId : 1;
                if (!activePointers.has(id)) return;
                var previous = activePointers.get(id);
                var copy = { x: pointer.x, y: pointer.y };
                inject(copy, previous, .9);
                activePointers.set(id, copy);
            },
            pointerUp: function (_, event) { activePointers.delete(event ? event.pointerId : 1); },
            pointerCancel: function (_, event) { activePointers.delete(event ? event.pointerId : 1); },
            wheel: function (_, dy) { radius = M.clamp(radius - dy * .01, 1.5, 10); },
            action: function () { selectTool(tool + 1); },
            keyDown: function (event) {
                var number = Number(event.key);
                if (number >= 1 && number <= 4) selectTool(number - 1);
                if (event.key === "[") radius = M.clamp(radius - .8, 1.5, 10);
                if (event.key === "]") radius = M.clamp(radius + .8, 1.5, 10);
                if (event.key === " ") { paused = !paused; event.preventDefault(); }
                if (event.key.toLowerCase() === "r") clear();
            },
            demo: function (time) {
                demoPrevious = demoPoint;
                demoPoint = { x: .5 + Math.sin(time * .83) * .31, y: .5 + Math.cos(time * .61) * .28 };
                tool = Math.floor(time / 9) % 2;
            },
            update: function (dt) {
                if (env.preview && demoPoint) inject(demoPoint, demoPrevious, .45);
                activePointers.forEach(function (pointer) { if (tool === 0 || tool === 1) inject(pointer, pointer, .055); });
                if (!paused) step(Math.min(dt, 1 / 30));
                var div = 0;
                for (var i = 0; i < size; i += Math.max(1, Math.floor(size / 220))) div += Math.abs(divergence[i]);
                env.setMeter(M.clamp(radius / 10, 0, 1));
                env.setState((paused ? "PAUSED" : "SOLVING") + " / " + tools[tool] + " / R " + radius.toFixed(1), "半拉格朗日平流与压力投影维持近似不可压缩速度场");
            },
            draw: function () {
                begin(env, ctx, "#01050b");
                for (var y = 0; y < H; y += 1) {
                    for (var x = 0; x < W; x += 1) {
                        var i = index(x, y);
                        var p = i * 4;
                        if (solid[i]) {
                            pixels.data[p] = 3; pixels.data[p + 1] = 8; pixels.data[p + 2] = 13; pixels.data[p + 3] = 255;
                        } else {
                            var rr = 1 - Math.exp(-red[i] * 2.4);
                            var gg = 1 - Math.exp(-green[i] * 2.4);
                            var bb = 1 - Math.exp(-blue[i] * 2.4);
                            var energy = M.clamp(Math.hypot(u[i], v[i]) * .02, 0, .28);
                            pixels.data[p] = Math.round(2 + (rr + energy * .45) * 250);
                            pixels.data[p + 1] = Math.round(5 + (gg + energy * .65) * 248);
                            pixels.data[p + 2] = Math.round(11 + (bb + energy) * 244);
                            pixels.data[p + 3] = 255;
                        }
                    }
                }
                offCtx.putImageData(pixels, 0, 0);
                ctx.imageSmoothingEnabled = true;
                ctx.drawImage(offscreen, 0, 0, env.width, env.height);
                var shade = ctx.createLinearGradient(0, 0, env.width, 0);
                shade.addColorStop(0, "rgba(0,4,10,.68)");
                shade.addColorStop(.31, "rgba(0,4,10,.1)");
                shade.addColorStop(1, "rgba(0,4,10,.06)");
                ctx.fillStyle = shade; ctx.fillRect(0, 0, env.width, env.height);
                var pointer = pointerPixels(env, env.pointer);
                var brushPx = radius / W * env.width;
                ctx.strokeStyle = tools[tool] === "WALL" ? "rgba(255,255,255,.7)" : "rgba(104,247,255,.72)";
                ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(pointer.x, pointer.y, brushPx, 0, TAU); ctx.stroke();
                var gx = Math.round(env.pointer.x * (W - 1));
                var gy = Math.round(env.pointer.y * (H - 1));
                for (var oy = -3; oy <= 3; oy += 2) {
                    for (var ox = -3; ox <= 3; ox += 2) {
                        var sx = M.clamp(gx + ox, 1, W - 2);
                        var sy = M.clamp(gy + oy, 1, H - 2);
                        var cell = index(sx, sy);
                        var px = sx / (W - 1) * env.width;
                        var py = sy / (H - 1) * env.height;
                        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + u[cell] * 1.8, py + v[cell] * 1.8);
                        ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.stroke();
                    }
                }
                mono(ctx, W + "×" + H + " EULERIAN GRID", env.width - 18, env.height - 94, 8, "rgba(221,251,255,.42)", "right");
            }
        };
    });

    /* 108 — XPBD Cloth ---------------------------------------------------- */
    replace("xpbd-cloth", function (env) {
        var ctx = context(env);
        var cols = env.mobile ? 15 : 24;
        var rows = env.mobile ? 11 : 17;
        var points = [];
        var constraints = [];
        var structural = new Map();
        var modes = ["GRAB", "PIN", "CUT", "STITCH"];
        var mode = 0;
        var grabbed = -1;
        var grabbedSphere = false;
        var grabTarget = { x: 0, y: 0 };
        var cutPrevious = null;
        var stitchFrom = -1;
        var sphere = { x: 0, y: 0, r: 70 };
        var wind = 0;
        var windPulse = 0;
        var lastWidth = 0;
        var lastHeight = 0;
        var press = null;

        addHud(env, [
            ["BUTTON / G P X S", "抓取、铆接、切断、缝合四种拓扑工具"],
            ["DRAG", "抓布或移动碰撞体；Cut 模式划开约束"],
            ["W / WHEEL / R", "风脉冲、连续风力与整块复位"]
        ]);
        env.setAction("TOOL / GRAB");

        function key(a, b) { return a < b ? a + ":" + b : b + ":" + a; }

        function addConstraint(a, b, type, compliance) {
            var pa = points[a];
            var pb = points[b];
            var constraint = { a: a, b: b, rest: M.dist(pa.x, pa.y, pb.x, pb.y), type: type, compliance: compliance, lambda: 0, enabled: true, stress: 0 };
            constraints.push(constraint);
            if (type <= 1) structural.set(key(a, b), constraint);
            return constraint;
        }

        function build(width, height) {
            points = [];
            constraints = [];
            structural = new Map();
            var clothX = env.mobile || env.preview ? width * .08 : width * .07;
            var clothY = env.mobile ? height * .23 : height * .14;
            var clothW = env.mobile || env.preview ? width * .84 : width * .59;
            var clothH = env.mobile ? height * .48 : height * .62;
            for (var row = 0; row < rows; row += 1) {
                for (var col = 0; col < cols; col += 1) {
                    var x = clothX + col / (cols - 1) * clothW;
                    var y = clothY + row / (rows - 1) * clothH;
                    var pinned = row === 0 && (col === 0 || col === cols - 1 || col % Math.max(3, Math.floor((cols - 1) / 4)) === 0);
                    points.push({ x: x, y: y, px: x, py: y, inv: pinned ? 0 : 1, pinned: pinned, basePinned: pinned });
                }
            }
            for (var r = 0; r < rows; r += 1) {
                for (var c = 0; c < cols; c += 1) {
                    var i = c + r * cols;
                    if (c < cols - 1) addConstraint(i, i + 1, 0, .000018);
                    if (r < rows - 1) addConstraint(i, i + cols, 1, .000018);
                    if (c < cols - 1 && r < rows - 1) {
                        addConstraint(i, i + cols + 1, 2, .000055);
                        addConstraint(i + 1, i + cols, 2, .000055);
                    }
                    if (c < cols - 2) addConstraint(i, i + 2, 3, .00018);
                    if (r < rows - 2) addConstraint(i, i + cols * 2, 3, .00018);
                }
            }
            sphere.x = clothX + clothW * .6;
            sphere.y = clothY + clothH * .74;
            sphere.r = Math.min(width, height) * (env.mobile ? .09 : .105);
            lastWidth = width;
            lastHeight = height;
            grabbed = -1;
            stitchFrom = -1;
        }

        function nearest(pointer) {
            var pixel = pointerPixels(env, pointer);
            var best = -1;
            var distance = env.mobile ? 38 : 30;
            points.forEach(function (point, index) {
                var next = M.dist(pixel.x, pixel.y, point.x, point.y);
                if (next < distance) { distance = next; best = index; }
            });
            return best;
        }

        function cutSegment(a, b) {
            constraints.forEach(function (constraint) {
                if (!constraint.enabled || constraint.type === 3) return;
                var pa = points[constraint.a];
                var pb = points[constraint.b];
                var d1 = segmentDistance(pa.x, pa.y, a.x, a.y, b.x, b.y);
                var d2 = segmentDistance(pb.x, pb.y, a.x, a.y, b.x, b.y);
                var d3 = segmentDistance(a.x, a.y, pa.x, pa.y, pb.x, pb.y);
                var d4 = segmentDistance(b.x, b.y, pa.x, pa.y, pb.x, pb.y);
                if (segmentsIntersect(a, b, pa, pb) || Math.min(d1, d2, d3, d4) < 8) constraint.enabled = false;
            });
        }

        function setMode(next) {
            mode = M.mod(next, modes.length);
            stitchFrom = -1;
            env.setAction("TOOL / " + modes[mode]);
        }

        function solveConstraint(constraint, dt) {
            if (!constraint.enabled) return;
            var a = points[constraint.a];
            var b = points[constraint.b];
            var dx = b.x - a.x;
            var dy = b.y - a.y;
            var length = Math.hypot(dx, dy) || .0001;
            var c = length - constraint.rest;
            constraint.stress = Math.abs(c) / constraint.rest;
            var wa = a.inv;
            var wb = b.inv;
            if (constraint.a === grabbed) wa = 0;
            if (constraint.b === grabbed) wb = 0;
            var alpha = constraint.compliance / (dt * dt);
            var dlambda = (-c - alpha * constraint.lambda) / (wa + wb + alpha || 1);
            constraint.lambda += dlambda;
            var nx = dx / length;
            var ny = dy / length;
            if (wa) { a.x -= wa * dlambda * nx; a.y -= wa * dlambda * ny; }
            if (wb) { b.x += wb * dlambda * nx; b.y += wb * dlambda * ny; }
        }

        function collide(point) {
            var dx = point.x - sphere.x;
            var dy = point.y - sphere.y;
            var distance = Math.hypot(dx, dy) || 1;
            if (distance < sphere.r) {
                point.x = sphere.x + dx / distance * sphere.r;
                point.y = sphere.y + dy / distance * sphere.r;
            }
            point.x = M.clamp(point.x, 4, env.width - 4);
            point.y = M.clamp(point.y, 70, env.height - 72);
        }

        function simulate(dt) {
            var substeps = env.mobile ? 3 : 4;
            var step = Math.min(dt, 1 / 30) / substeps;
            constraints.forEach(function (constraint) { constraint.lambda = 0; });
            for (var sub = 0; sub < substeps; sub += 1) {
                points.forEach(function (point, index) {
                    if (!point.inv || index === grabbed) return;
                    var vx = (point.x - point.px) * .994;
                    var vy = (point.y - point.py) * .994;
                    point.px = point.x;
                    point.py = point.y;
                    var gust = wind + windPulse * Math.sin(point.y * .018 + env.time * 4.2);
                    point.x += vx + gust * step * step * 115;
                    point.y += vy + 980 * step * step;
                });
                if (grabbed >= 0) {
                    var held = points[grabbed];
                    held.x = grabTarget.x; held.y = grabTarget.y; held.px = held.x; held.py = held.y;
                }
                for (var iteration = 0; iteration < (env.mobile ? 4 : 6); iteration += 1) {
                    constraints.forEach(function (constraint) { solveConstraint(constraint, step); });
                    points.forEach(function (point, index) { if (point.inv && index !== grabbed) collide(point); });
                }
            }
            windPulse *= Math.exp(-2.8 * dt);
        }

        function fillIntactCell(row, col) {
            var a = col + row * cols;
            var b = a + 1;
            var c = a + cols + 1;
            var d = a + cols;
            return [key(a,b), key(b,c), key(c,d), key(d,a)].every(function (value) { var edge = structural.get(value); return edge && edge.enabled; });
        }

        return {
            resize: function (width, height) {
                if (!points.length) { build(width, height); return; }
                var sx = width / lastWidth;
                var sy = height / lastHeight;
                points.forEach(function (point) { point.x *= sx; point.px *= sx; point.y *= sy; point.py *= sy; });
                sphere.x *= sx; sphere.y *= sy; sphere.r *= Math.min(sx, sy);
                constraints.forEach(function (constraint) { constraint.rest *= Math.hypot(sx, sy) / Math.SQRT2; });
                lastWidth = width; lastHeight = height;
            },
            pointerDown: function (pointer) {
                var pixel = pointerPixels(env, pointer);
                press = { x: pixel.x, y: pixel.y, time: env.time, moved: 0 };
                if (mode === 0) {
                    if (M.dist(pixel.x, pixel.y, sphere.x, sphere.y) < sphere.r * 1.05) { grabbedSphere = true; return; }
                    grabbed = nearest(pointer);
                    if (grabbed >= 0) grabTarget = pixel;
                } else if (mode === 1) {
                    var pin = nearest(pointer);
                    if (pin >= 0) { points[pin].pinned = !points[pin].pinned; points[pin].inv = points[pin].pinned ? 0 : 1; points[pin].px = points[pin].x; points[pin].py = points[pin].y; }
                } else if (mode === 2) {
                    cutPrevious = pixel;
                } else {
                    var next = nearest(pointer);
                    if (next >= 0) {
                        if (stitchFrom < 0) stitchFrom = next;
                        else if (next !== stitchFrom) { addConstraint(stitchFrom, next, 4, .000035); stitchFrom = -1; }
                    }
                }
            },
            pointerMove: function (pointer) {
                var pixel = pointerPixels(env, pointer);
                if (press) press.moved = Math.max(press.moved, M.dist(pixel.x, pixel.y, press.x, press.y));
                if (grabbedSphere) { sphere.x = pixel.x; sphere.y = pixel.y; }
                else if (grabbed >= 0) grabTarget = pixel;
                else if (mode === 2 && cutPrevious) { cutSegment(cutPrevious, pixel); cutPrevious = pixel; }
            },
            pointerUp: function () {
                if (mode === 0 && grabbed >= 0 && press && press.moved < 7 && env.time - press.time > .55) {
                    var point = points[grabbed]; point.pinned = !point.pinned; point.inv = point.pinned ? 0 : 1;
                }
                grabbed = -1; grabbedSphere = false; cutPrevious = null; press = null;
            },
            pointerCancel: function () { grabbed = -1; grabbedSphere = false; cutPrevious = null; press = null; },
            wheel: function (_, dy) { wind = M.clamp(wind - dy * .035, -18, 18); },
            action: function () { setMode(mode + 1); },
            keyDown: function (event) {
                var keyName = event.key.toLowerCase();
                if (keyName === "g") setMode(0);
                if (keyName === "p") setMode(1);
                if (keyName === "x") setMode(2);
                if (keyName === "s") setMode(3);
                if (keyName === "w") windPulse = 22;
                if (keyName === "r") build(env.width, env.height);
            },
            demo: function (time, cycle) {
                if (!points.length) return;
                if (cycle < .08) grabbed = Math.floor(rows * .52) * cols + Math.floor(cols * .58);
                if (grabbed >= 0 && cycle < 4.8) {
                    var anchor = points[grabbed];
                    grabTarget = { x: env.width * (.42 + Math.sin(time * .83) * .18), y: env.height * (.48 + Math.cos(time * .67) * .16) };
                    anchor.x = grabTarget.x; anchor.y = grabTarget.y;
                } else grabbed = -1;
                if (cycle > 5.2) windPulse = 12;
            },
            update: function (dt) {
                if (points.length) simulate(dt);
                var enabled = constraints.filter(function (constraint) { return constraint.enabled; });
                var maxStress = enabled.reduce(function (value, constraint) { return Math.max(value, constraint.stress); }, 0);
                env.setMeter(M.clamp(maxStress * 4, 0, 1));
                env.setState(modes[mode] + " / " + enabled.length + " CONSTRAINTS / STRAIN " + maxStress.toFixed(2), "XPBD compliance 与累计拉格朗日乘子约束真实布面拓扑");
            },
            draw: function () {
                begin(env, ctx, "#1b120f");
                var light = ctx.createRadialGradient(env.width * .38, env.height * .3, 0, env.width * .38, env.height * .3, env.width * .58);
                light.addColorStop(0, "rgba(255,198,143,.18)"); light.addColorStop(1, "transparent");
                ctx.fillStyle = light; ctx.fillRect(0, 0, env.width, env.height);
                ctx.beginPath(); ctx.ellipse(sphere.x, sphere.y + sphere.r * .85, sphere.r * 1.2, sphere.r * .3, 0, 0, TAU); ctx.fillStyle = "rgba(0,0,0,.24)"; ctx.fill();
                var sphereGradient = ctx.createRadialGradient(sphere.x - sphere.r * .32, sphere.y - sphere.r * .38, 0, sphere.x, sphere.y, sphere.r);
                sphereGradient.addColorStop(0, "#ffd9a3"); sphereGradient.addColorStop(.28, "#ad654f"); sphereGradient.addColorStop(1, "#3b1c1a");
                ctx.beginPath(); ctx.arc(sphere.x, sphere.y, sphere.r, 0, TAU); ctx.fillStyle = sphereGradient; ctx.fill();
                for (var row = 0; row < rows - 1; row += 1) {
                    for (var col = 0; col < cols - 1; col += 1) {
                        if (!fillIntactCell(row, col)) continue;
                        var a = points[col + row * cols];
                        var b = points[col + 1 + row * cols];
                        var c = points[col + 1 + (row + 1) * cols];
                        var d = points[col + (row + 1) * cols];
                        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
                        var shade = .11 + row / rows * .09 + (col % 2) * .025;
                        ctx.fillStyle = "rgba(255,111,91," + shade + ")"; ctx.fill();
                    }
                }
                constraints.forEach(function (constraint) {
                    if (!constraint.enabled || constraint.type >= 3) return;
                    var a = points[constraint.a];
                    var b = points[constraint.b];
                    var hot = M.clamp(constraint.stress * 7, 0, 1);
                    ctx.strokeStyle = hot > .55 ? "rgba(255,218,141," + (.28 + hot * .65) + ")" : "rgba(255,255,255,.16)";
                    ctx.lineWidth = hot > .55 ? 1.8 : .65;
                    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                });
                constraints.forEach(function (constraint) {
                    if (!constraint.enabled || constraint.type !== 4) return;
                    var a = points[constraint.a]; var b = points[constraint.b];
                    ctx.strokeStyle = "#6ee7ff"; ctx.setLineDash([5,5]); ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); ctx.setLineDash([]);
                });
                points.forEach(function (point, index) {
                    if (!point.pinned && index !== stitchFrom) return;
                    ctx.beginPath(); ctx.arc(point.x, point.y, index === stitchFrom ? 8 : 6, 0, TAU);
                    ctx.fillStyle = index === stitchFrom ? "#6ee7ff" : "#ffd38d"; ctx.fill();
                    ctx.strokeStyle = "#3b1c1a"; ctx.lineWidth = 2; ctx.stroke();
                });
                if (mode === 2 && cutPrevious) {
                    ctx.beginPath(); ctx.arc(cutPrevious.x, cutPrevious.y, 15, 0, TAU); ctx.strokeStyle = "#fff"; ctx.stroke();
                }
                mono(ctx, "WIND " + wind.toFixed(1) + " / " + cols + "×" + rows + " NODES", env.width - 18, env.height - 94, 8, "rgba(255,224,204,.45)", "right");
            }
        };
    });

    /* 116 — Wave Function Collapse --------------------------------------- */
    replace("wave-function-collapse", function (env) {
        var ctx = context(env);
        var W = env.mobile ? 13 : 22;
        var H = env.mobile ? 18 : 14;
        var TILE_COUNT = 16;
        var ALL = 0xffff;
        var cells = new Uint32Array(W * H);
        var pins = new Map();
        var adjacency = Array.from({ length: 4 }, function () { return new Uint32Array(TILE_COUNT); });
        var directions = [{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}];
        var weights = new Float32Array([.28,.52,.52,1.25,.52,1.55,1.15,.54,.52,1.22,1.55,.58,1.18,.58,.58,.14]);
        var rand = M.random(116021);
        var running = true;
        var speed = env.mobile ? 13 : 22;
        var accumulator = 0;
        var lastObserved = -1;
        var downCell = -1;
        var lastDragCell = -1;
        var contradictions = 0;

        addHud(env, [
            ["TAP", "锁定或轮换一个道路图块并传播约束"],
            ["DRAG", "擦除局部确定性，再从边界重新坍缩"],
            ["WHEEL / SPACE / R", "改变求解速度、暂停、重生成"]
        ]);
        env.setAction("REGENERATE CITY");

        function tileEdge(tile, direction) { return (tile >> direction) & 1; }
        for (var direction = 0; direction < 4; direction += 1) {
            for (var tile = 0; tile < TILE_COUNT; tile += 1) {
                var mask = 0;
                for (var other = 0; other < TILE_COUNT; other += 1) if (tileEdge(tile, direction) === tileEdge(other, (direction + 2) % 4)) mask |= 1 << other;
                adjacency[direction][tile] = mask;
            }
        }

        function popcount(mask) {
            var count = 0;
            while (mask) { mask &= mask - 1; count += 1; }
            return count;
        }

        function singleTile(mask) {
            for (var i = 0; i < TILE_COUNT; i += 1) if (mask === (1 << i)) return i;
            return -1;
        }

        function choose(mask) {
            var total = 0;
            for (var i = 0; i < TILE_COUNT; i += 1) if (mask & (1 << i)) total += weights[i];
            var value = rand() * total;
            for (var tile = 0; tile < TILE_COUNT; tile += 1) {
                if (!(mask & (1 << tile))) continue;
                value -= weights[tile];
                if (value <= 0) return tile;
            }
            return 0;
        }

        function propagate(queue) {
            var head = 0;
            while (head < queue.length) {
                var cell = queue[head++];
                var x = cell % W;
                var y = Math.floor(cell / W);
                var mask = cells[cell];
                for (var direction = 0; direction < 4; direction += 1) {
                    var nx = x + directions[direction].x;
                    var ny = y + directions[direction].y;
                    if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                    var neighbor = nx + ny * W;
                    var allowed = 0;
                    for (var tile = 0; tile < TILE_COUNT; tile += 1) if (mask & (1 << tile)) allowed |= adjacency[direction][tile];
                    var next = cells[neighbor] & allowed;
                    if (!next) return false;
                    if (next !== cells[neighbor]) { cells[neighbor] = next; queue.push(neighbor); }
                }
            }
            return true;
        }

        function rebuild() {
            cells.fill(ALL);
            var queue = [];
            pins.forEach(function (tile, cell) { cells[cell] = 1 << tile; queue.push(cell); });
            return propagate(queue);
        }

        function reset(clearPins) {
            if (clearPins) pins.clear();
            rebuild();
            lastObserved = -1;
            running = true;
        }

        function collapseOne() {
            var minimum = 99;
            var choices = [];
            for (var i = 0; i < cells.length; i += 1) {
                var entropy = popcount(cells[i]);
                if (entropy <= 1) continue;
                if (entropy < minimum) { minimum = entropy; choices = [i]; }
                else if (entropy === minimum) choices.push(i);
            }
            if (!choices.length) return false;
            var cell = choices[Math.floor(rand() * choices.length)];
            var tile = choose(cells[cell]);
            cells[cell] = 1 << tile;
            lastObserved = cell;
            if (!propagate([cell])) {
                contradictions += 1;
                reset(false);
            }
            return true;
        }

        function gridBounds() {
            var x = env.preview ? 10 : env.mobile ? 10 : Math.min(410, env.width * .31);
            var y = env.preview ? 10 : env.mobile ? 186 : 106;
            var right = 14;
            var bottom = env.preview ? 10 : env.mobile ? 148 : 94;
            return { x: x, y: y, w: env.width - x - right, h: env.height - y - bottom };
        }

        function cellAt(pointer) {
            var bounds = gridBounds();
            var pixel = pointerPixels(env, pointer);
            if (pixel.x < bounds.x || pixel.x > bounds.x + bounds.w || pixel.y < bounds.y || pixel.y > bounds.y + bounds.h) return -1;
            var x = M.clamp(Math.floor((pixel.x - bounds.x) / bounds.w * W), 0, W - 1);
            var y = M.clamp(Math.floor((pixel.y - bounds.y) / bounds.h * H), 0, H - 1);
            return x + y * W;
        }

        function pinTile(cell, tile) {
            var previous = new Map(pins);
            pins.set(cell, tile);
            if (!rebuild()) { pins = previous; rebuild(); contradictions += 1; }
            running = true;
            accumulator = 0;
            lastObserved = -1;
        }

        function eraseAround(cell) {
            var cx = cell % W;
            var cy = Math.floor(cell / W);
            pins.forEach(function (_, pinned) {
                var px = pinned % W;
                var py = Math.floor(pinned / W);
                if (Math.hypot(px - cx, py - cy) < 2.2) pins.delete(pinned);
            });
            rebuild();
            running = true;
        }

        reset(true);

        function drawTile(tile, x, y, width, height, pinned) {
            var pad = Math.max(1, Math.min(width, height) * .08);
            ctx.fillStyle = pinned ? "rgba(225,107,61,.13)" : "rgba(255,255,255,.48)";
            ctx.fillRect(x + pad, y + pad, width - pad * 2, height - pad * 2);
            var cx = x + width * .5;
            var cy = y + height * .5;
            var roadWidth = Math.max(2, Math.min(width, height) * .2);
            ctx.strokeStyle = pinned ? "#e16b3d" : "#155f9a";
            ctx.lineWidth = roadWidth;
            ctx.lineCap = "round";
            ctx.beginPath();
            for (var direction = 0; direction < 4; direction += 1) {
                if (!tileEdge(tile, direction)) continue;
                var ex = cx + directions[direction].x * width * .52;
                var ey = cy + directions[direction].y * height * .52;
                ctx.moveTo(cx, cy); ctx.lineTo(ex, ey);
            }
            ctx.stroke();
            ctx.beginPath(); ctx.arc(cx, cy, roadWidth * .45, 0, TAU); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
            if (tile === 0) {
                ctx.fillStyle = "rgba(21,48,74,.32)";
                ctx.fillRect(x + width * .22, y + height * .22, width * .22, height * .22);
                ctx.fillRect(x + width * .55, y + height * .54, width * .2, height * .2);
            }
        }

        return {
            pointerDown: function (pointer) {
                downCell = cellAt(pointer);
                lastDragCell = downCell;
            },
            pointerMove: function (pointer) {
                if (downCell < 0) return;
                var cell = cellAt(pointer);
                if (cell >= 0 && cell !== lastDragCell) { eraseAround(cell); lastDragCell = cell; }
            },
            pointerUp: function () {
                if (downCell >= 0 && downCell === lastDragCell) {
                    var tile = singleTile(cells[downCell]);
                    pinTile(downCell, tile < 0 ? choose(cells[downCell]) : (tile + 1) % TILE_COUNT);
                }
                downCell = -1; lastDragCell = -1;
            },
            pointerCancel: function () { downCell = -1; lastDragCell = -1; },
            wheel: function (_, dy) { speed = M.clamp(speed - dy * .035, 2, 60); },
            action: function () { reset(true); },
            keyDown: function (event) {
                if (event.key === " ") { running = !running; event.preventDefault(); }
                if (event.key.toLowerCase() === "r") reset(true);
                if (event.key === "Enter") { while (collapseOne()) {} event.preventDefault(); }
            },
            demo: function (time, cycle) {
                running = true;
                speed = 28;
                if (cycle < .04) reset(true);
                if (cycle > 5.6 && pins.size < 2) {
                    var cell = (3 + Math.floor(time) % (W - 6)) + Math.floor(H * .5) * W;
                    var tile = singleTile(cells[cell]);
                    if (tile >= 0) pins.set(cell, tile);
                }
            },
            update: function (dt) {
                if (running) {
                    accumulator += dt * speed;
                    while (accumulator >= 1) { if (!collapseOne()) { running = false; accumulator = 0; break; } accumulator -= 1; }
                }
                var resolved = 0;
                for (var i = 0; i < cells.length; i += 1) if (popcount(cells[i]) === 1) resolved += 1;
                env.setMeter(resolved / cells.length);
                env.setState((running ? "COLLAPSING" : "SOLVED") + " / " + resolved + "/" + cells.length + " / " + pins.size + " LOCKS", "最小熵观测后传播四向道路邻接约束");
            },
            draw: function () {
                begin(env, ctx, "#e7ebe5");
                ctx.strokeStyle = "rgba(21,48,74,.055)";
                for (var x = 0; x < env.width; x += 24) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,env.height); ctx.stroke(); }
                for (var y = 0; y < env.height; y += 24) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(env.width,y); ctx.stroke(); }
                var bounds = gridBounds();
                rounded(ctx, bounds.x - 8, bounds.y - 8, bounds.w + 16, bounds.h + 16, 14, "rgba(240,244,239,.82)", "rgba(21,48,74,.24)");
                var cw = bounds.w / W;
                var ch = bounds.h / H;
                for (var row = 0; row < H; row += 1) {
                    for (var col = 0; col < W; col += 1) {
                        var cell = col + row * W;
                        var x = bounds.x + col * cw;
                        var y = bounds.y + row * ch;
                        var entropy = popcount(cells[cell]);
                        ctx.strokeStyle = "rgba(21,48,74,.1)"; ctx.lineWidth = .6; ctx.strokeRect(x, y, cw, ch);
                        if (entropy === 1) drawTile(singleTile(cells[cell]), x, y, cw, ch, pins.has(cell));
                        else {
                            var alpha = .05 + (1 - entropy / TILE_COUNT) * .18;
                            ctx.fillStyle = "rgba(21,95,154," + alpha + ")"; ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
                            if (cw > 24) mono(ctx, String(entropy), x + cw * .5, y + ch * .5, 6, "rgba(21,48,74,.36)", "center");
                        }
                        if (cell === lastObserved) {
                            ctx.strokeStyle = "#e16b3d"; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, cw - 2, ch - 2);
                        }
                    }
                }
                mono(ctx, "MIN ENTROPY / " + speed.toFixed(0) + " CELLS·S⁻¹ / " + contradictions + " CONTRADICTIONS", env.width - 18, env.height - 94, 8, "rgba(21,48,74,.52)", "right");
            }
        };
    });

    /* 136 — STFT Spectrogram --------------------------------------------- */
    replace("stft-spectrogram", function (env) {
        var ctx = context(env);
        var N = env.mobile ? 128 : 256;
        var sampleRate = 8000;
        var maxHistory = env.mobile ? 96 : 168;
        var history = [];
        var phase = 0;
        var frequency = 260;
        var targetFrequency = 440;
        var harmonic = 2;
        var balance = .42;
        var windowType = 0;
        var windows = ["HANN", "HAMMING", "BLACKMAN"];
        var frameAccumulator = 0;
        var frozen = false;
        var pointerActive = false;
        var latched = false;
        var audio = null;
        var spectrumCanvas = document.createElement("canvas");
        spectrumCanvas.width = maxHistory;
        spectrumCanvas.height = N / 2;
        var spectrumCtx = spectrumCanvas.getContext("2d");
        var spectrumPixels = spectrumCtx.createImageData(maxHistory, N / 2);
        var spectrumDirty = true;

        addHud(env, [
            ["PRESS / DRAG", "纵向控制基频，横向改变谐波结构并发声"],
            ["WHEEL / W", "切换 Hann、Hamming、Blackman 窗"],
            ["SPACE / BUTTON", "冻结时频历史，或锁存持续声音"]
        ]);
        env.setAction("AUDIO LATCH / OFF");

        function fftReal(signal) {
            var n = signal.length;
            var re = new Float32Array(signal);
            var im = new Float32Array(n);
            for (var i = 1, j = 0; i < n; i += 1) {
                var bit = n >> 1;
                for (; j & bit; bit >>= 1) j ^= bit;
                j ^= bit;
                if (i < j) { var temp = re[i]; re[i] = re[j]; re[j] = temp; }
            }
            for (var length = 2; length <= n; length <<= 1) {
                var angle = -TAU / length;
                var cos = Math.cos(angle);
                var sin = Math.sin(angle);
                for (var start = 0; start < n; start += length) {
                    var wr = 1;
                    var wi = 0;
                    for (var k = 0; k < length / 2; k += 1) {
                        var even = start + k;
                        var odd = even + length / 2;
                        var tr = re[odd] * wr - im[odd] * wi;
                        var ti = re[odd] * wi + im[odd] * wr;
                        re[odd] = re[even] - tr;
                        im[odd] = im[even] - ti;
                        re[even] += tr;
                        im[even] += ti;
                        var nextWr = wr * cos - wi * sin;
                        wi = wr * sin + wi * cos;
                        wr = nextWr;
                    }
                }
            }
            var output = new Float32Array(n / 2);
            for (var bin = 0; bin < output.length; bin += 1) output[bin] = Math.log1p(Math.hypot(re[bin], im[bin])) / 4.2;
            return output;
        }

        function windowValue(index) {
            var x = index / (N - 1);
            if (windowType === 0) return .5 - .5 * Math.cos(TAU * x);
            if (windowType === 1) return .54 - .46 * Math.cos(TAU * x);
            return .42 - .5 * Math.cos(TAU * x) + .08 * Math.cos(TAU * 2 * x);
        }

        function analyseFrame() {
            var signal = new Float32Array(N);
            for (var i = 0; i < N; i += 1) {
                var time = (phase + i) / sampleRate;
                var fundamental = Math.sin(TAU * frequency * time);
                var partial = Math.sin(TAU * frequency * harmonic * time + balance * 1.7) * (.18 + balance * .42);
                var shimmer = Math.sin(TAU * frequency * (harmonic + .5) * time) * balance * .14;
                signal[i] = (fundamental * .74 + partial + shimmer) * windowValue(i);
            }
            phase += N / 4;
            if (!frozen) {
                history.push(fftReal(signal));
                if (history.length > maxHistory) history.shift();
                spectrumDirty = true;
            }
        }

        function ensureAudio() {
            if (audio) return;
            var ac = env.audio();
            var master = ac.createGain();
            var gainA = ac.createGain();
            var gainB = ac.createGain();
            var oscillatorA = ac.createOscillator();
            var oscillatorB = ac.createOscillator();
            var filter = ac.createBiquadFilter();
            oscillatorA.type = "sine";
            oscillatorB.type = "triangle";
            gainA.gain.value = .055;
            gainB.gain.value = .018;
            master.gain.value = 0;
            filter.type = "lowpass";
            filter.frequency.value = 3200;
            oscillatorA.connect(gainA).connect(filter);
            oscillatorB.connect(gainB).connect(filter);
            filter.connect(master).connect(ac.destination);
            oscillatorA.start(); oscillatorB.start();
            audio = { ac: ac, master: master, gainB: gainB, oscillatorA: oscillatorA, oscillatorB: oscillatorB, filter: filter };
        }

        function updateAudio() {
            if (!audio) return;
            var now = audio.ac.currentTime;
            audio.oscillatorA.frequency.setTargetAtTime(frequency, now, .025);
            audio.oscillatorB.frequency.setTargetAtTime(frequency * harmonic, now, .025);
            audio.gainB.gain.setTargetAtTime(.008 + balance * .045, now, .03);
            audio.filter.frequency.setTargetAtTime(Math.min(5200, frequency * (4 + harmonic)), now, .04);
            audio.master.gain.setTargetAtTime(pointerActive || latched ? .72 : 0, now, .035);
        }

        function setFromPointer(pointer) {
            targetFrequency = 70 * Math.pow(2, (1 - pointer.y) * 5.75);
            balance = M.clamp(pointer.x, 0, 1);
            harmonic = 1 + Math.round(pointer.x * 5);
        }

        function cycleWindow(direction) {
            windowType = M.mod(windowType + direction, windows.length);
        }

        function renderSpectrum() {
            if (!spectrumDirty) return;
            var rows = N / 2;
            for (var x = 0; x < maxHistory; x += 1) {
                var spectrum = history[x - (maxHistory - history.length)];
                for (var y = 0; y < rows; y += 1) {
                    var value = spectrum ? M.clamp(spectrum[y] * 1.55, 0, 1) : 0;
                    var p = ((rows - 1 - y) * maxHistory + x) * 4;
                    spectrumPixels.data[p] = Math.round(2 + value * value * 250);
                    spectrumPixels.data[p + 1] = Math.round(8 + Math.pow(value, 1.45) * 92 + Math.max(0, value - .7) * 380);
                    spectrumPixels.data[p + 2] = Math.round(13 + Math.sin(value * Math.PI) * 178 + value * 38);
                    spectrumPixels.data[p + 3] = 255;
                }
            }
            spectrumCtx.putImageData(spectrumPixels, 0, 0);
            spectrumDirty = false;
        }

        return {
            pointerDown: function (pointer) {
                pointerActive = true;
                setFromPointer(pointer);
                if (!env.preview) ensureAudio();
            },
            pointerMove: function (pointer) { if (pointerActive || env.preview) setFromPointer(pointer); },
            pointerUp: function () { pointerActive = false; },
            pointerCancel: function () { pointerActive = false; },
            wheel: function (_, dy) { cycleWindow(dy > 0 ? 1 : -1); },
            action: function () {
                latched = !latched;
                if (latched && !env.preview) ensureAudio();
                env.setAction(latched ? "AUDIO LATCH / ON" : "AUDIO LATCH / OFF");
            },
            keyDown: function (event) {
                if (event.key === " ") { frozen = !frozen; event.preventDefault(); }
                if (event.key.toLowerCase() === "w") cycleWindow(1);
                if (event.key === "ArrowUp") targetFrequency = M.clamp(targetFrequency * Math.pow(2, 1 / 12), 70, 3800);
                if (event.key === "ArrowDown") targetFrequency = M.clamp(targetFrequency / Math.pow(2, 1 / 12), 70, 3800);
            },
            demo: function (time) {
                targetFrequency = 100 + Math.pow(Math.sin(time * .34) * .5 + .5, 2) * 2600;
                balance = Math.sin(time * .21) * .5 + .5;
                harmonic = 1 + Math.floor((Math.sin(time * .17) * .5 + .5) * 5);
                windowType = Math.floor(time / 8) % windows.length;
            },
            update: function (dt) {
                frequency += (targetFrequency - frequency) * (1 - Math.exp(-8 * dt));
                frameAccumulator += dt;
                var interval = env.mobile || env.preview ? 1 / 24 : 1 / 30;
                if (frameAccumulator >= interval) { frameAccumulator %= interval; analyseFrame(); }
                updateAudio();
                env.setMeter(M.clamp(Math.log2(frequency / 70) / 5.75, 0, 1));
                env.setState((frozen ? "FROZEN" : "STFT LIVE") + " / " + Math.round(frequency) + " HZ / H×" + harmonic + " / " + windows[windowType], "重叠窗帧经 FFT 写入严格的时间 × 频率能量历史");
            },
            draw: function (time) {
                begin(env, ctx, "#000605");
                renderSpectrum();
                ctx.imageSmoothingEnabled = true;
                ctx.globalAlpha = .88;
                ctx.drawImage(spectrumCanvas, 0, 0, env.width, env.height);
                ctx.globalAlpha = 1;
                var shade = ctx.createLinearGradient(0, 0, env.width * .48, 0);
                shade.addColorStop(0, "rgba(0,6,5,.92)");
                shade.addColorStop(.72, "rgba(0,6,5,.32)");
                shade.addColorStop(1, "transparent");
                ctx.fillStyle = shade; ctx.fillRect(0, 0, env.width * .55, env.height);
                var frequencyY = env.height - frequency / (sampleRate * .5) * env.height;
                ctx.strokeStyle = "rgba(157,255,100,.72)";
                ctx.lineWidth = 1;
                ctx.setLineDash([5,7]);
                ctx.beginPath(); ctx.moveTo(0, frequencyY); ctx.lineTo(env.width, frequencyY); ctx.stroke();
                ctx.setLineDash([]);
                for (var band = 0; band <= 4; band += 1) {
                    var y = env.height - band / 4 * env.height;
                    mono(ctx, band + " KHZ", env.width - 16, M.clamp(y, 18, env.height - 94), 7, "rgba(226,255,236,.42)", "right");
                }
                var waveY = env.height * .74;
                ctx.beginPath();
                for (var i = 0; i <= 180; i += 1) {
                    var x = env.width * .08 + i / 180 * env.width * .32;
                    var envelope = Math.sin(i / 180 * Math.PI);
                    var y = waveY + Math.sin(i / 180 * TAU * (2 + harmonic) + time * 7) * 18 * envelope;
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.strokeStyle = "rgba(157,255,100,.8)"; ctx.lineWidth = 2; ctx.stroke();
                label(ctx, Math.round(frequency).toLocaleString(), env.width * (env.mobile ? .5 : .72), env.height * .24, Math.min(112, env.width * .095), "rgba(245,255,248,.9)", "center", 880);
                mono(ctx, "HZ / HARMONIC ×" + harmonic, env.width * (env.mobile ? .5 : .72), env.height * .34, 9, "rgba(157,255,100,.72)", "center");
                mono(ctx, frozen ? "HISTORY HOLD" : (latched ? "AUDIO LATCHED" : pointerActive ? "PRESSURE ACTIVE" : "PRESS TO LISTEN"), env.width - 18, env.height - 94, 8, "rgba(226,255,236,.48)", "right");
            },
            destroy: function () {
                if (!audio) return;
                audio.oscillatorA.stop(); audio.oscillatorB.stop();
                audio = null;
            }
        };
    });
}());
