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
    function cross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
    function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
    function normalize3(value) { var length = Math.hypot(value.x, value.y, value.z) || 1; return { x: value.x / length, y: value.y / length, z: value.z / length }; }

    /* 81 — Marching Squares ---------------------------------------------- */
    replace("marching-squares", function (env) {
        var ctx = context(env);
        var W = env.mobile ? 42 : 64;
        var H = env.mobile ? 30 : 44;
        var field = new Float32Array(W * H);
        var threshold = .48;
        var tool = 0;
        var tools = ["ADD FIELD", "SUBTRACT", "SMOOTH"];
        var radius = env.mobile ? 3.2 : 4.3;
        var touches = new Map();
        var pinch = null;
        var suppressPaint = false;
        var pointerCell = { x: W * .5, y: H * .5 };
        var asymptotic = true;
        var ambiguousCount = 0;
        var offscreen = document.createElement("canvas");
        offscreen.width = W; offscreen.height = H;
        var offCtx = offscreen.getContext("2d");
        var heat = offCtx.createImageData(W, H);
        var heatDirty = true;

        addHud(env, [
            ["PAINT", "增加、减去或平滑同一标量场"],
            ["WHEEL / PINCH", "独立调节 iso threshold，不污染画笔"],
            ["A", "切换 5/10 歧义格的渐近判别"]
        ]);
        function setAction() { env.setAction("BRUSH / " + tools[tool]); }
        setAction();

        function panel() { return focusArea(env, .34); }
        function index(x, y) { return M.clamp(x, 0, W - 1) + M.clamp(y, 0, H - 1) * W; }
        function reset() {
            field.fill(0);
            var blobs = [[.29, .46, .2, .85], [.55, .38, .16, .78], [.68, .64, .21, .9], [.42, .7, .12, .62]];
            for (var y = 0; y < H; y += 1) for (var x = 0; x < W; x += 1) {
                var value = 0;
                blobs.forEach(function (blob) {
                    var dx = x / (W - 1) - blob[0], dy = y / (H - 1) - blob[1];
                    value += Math.exp(-(dx * dx + dy * dy) / (blob[2] * blob[2])) * blob[3];
                });
                field[index(x, y)] = M.clamp(value, 0, 1);
            }
            heatDirty = true;
        }
        function toGrid(point) {
            var rect = panel();
            return { x: M.clamp((point.x - rect.x) / rect.w * (W - 1), 0, W - 1), y: M.clamp((point.y - rect.y) / rect.h * (H - 1), 0, H - 1) };
        }
        function paintAt(grid, strength) {
            pointerCell = grid;
            var cx = Math.round(grid.x), cy = Math.round(grid.y), r = Math.ceil(radius);
            if (tool === 2) {
                var copy = new Float32Array(field);
                for (var sy = cy - r; sy <= cy + r; sy += 1) for (var sx = cx - r; sx <= cx + r; sx += 1) {
                    if (sx < 1 || sx >= W - 1 || sy < 1 || sy >= H - 1 || Math.hypot(sx - grid.x, sy - grid.y) > radius) continue;
                    var sum = 0;
                    for (var oy = -1; oy <= 1; oy += 1) for (var ox = -1; ox <= 1; ox += 1) sum += copy[index(sx + ox, sy + oy)];
                    field[index(sx, sy)] = M.lerp(copy[index(sx, sy)], sum / 9, .42 * strength);
                }
            } else {
                for (var y = cy - r; y <= cy + r; y += 1) for (var x = cx - r; x <= cx + r; x += 1) {
                    if (x < 0 || x >= W || y < 0 || y >= H) continue;
                    var distance = Math.hypot(x - grid.x, y - grid.y);
                    if (distance > radius) continue;
                    var falloff = Math.pow(1 - distance / radius, 2) * .18 * strength;
                    field[index(x, y)] = M.clamp(field[index(x, y)] + (tool === 0 ? falloff : -falloff), 0, 1);
                }
            }
            heatDirty = true;
        }
        function caseAt(x, y) {
            var tl = field[index(x, y)], tr = field[index(x + 1, y)], br = field[index(x + 1, y + 1)], bl = field[index(x, y + 1)];
            return {
                tl: tl,
                tr: tr,
                br: br,
                bl: bl,
                code: (tl >= threshold ? 1 : 0) | (tr >= threshold ? 2 : 0) | (br >= threshold ? 4 : 0) | (bl >= threshold ? 8 : 0),
                decider: (tl - threshold) * (br - threshold) - (tr - threshold) * (bl - threshold)
            };
        }
        function interpolation(a, b) { return Math.abs(b - a) < .0001 ? .5 : M.clamp((threshold - a) / (b - a), 0, 1); }
        function segments(cell) {
            var top = { x: interpolation(cell.tl, cell.tr), y: 0 };
            var right = { x: 1, y: interpolation(cell.tr, cell.br) };
            var bottom = { x: interpolation(cell.bl, cell.br), y: 1 };
            var left = { x: 0, y: interpolation(cell.tl, cell.bl) };
            var table = {
                1: [[left, top]], 2: [[top, right]], 3: [[left, right]], 4: [[right, bottom]],
                6: [[top, bottom]], 7: [[left, bottom]], 8: [[bottom, left]], 9: [[top, bottom]],
                11: [[right, bottom]], 12: [[left, right]], 13: [[top, right]], 14: [[left, top]]
            };
            if (cell.code === 5) return (asymptotic ? cell.decider >= 0 : false) ? [[top, right], [bottom, left]] : [[left, top], [right, bottom]];
            if (cell.code === 10) return (asymptotic ? cell.decider < 0 : false) ? [[left, top], [right, bottom]] : [[top, right], [bottom, left]];
            return table[cell.code] || [];
        }
        function updateHeat() {
            if (!heatDirty) return;
            for (var i = 0; i < field.length; i += 1) {
                var v = M.clamp(field[i], 0, 1), p = i * 4;
                heat.data[p] = Math.round(8 + v * 242);
                heat.data[p + 1] = Math.round(14 + Math.sin(v * Math.PI) * 168);
                heat.data[p + 2] = Math.round(28 + (1 - v) * 126);
                heat.data[p + 3] = 255;
            }
            offCtx.putImageData(heat, 0, 0); heatDirty = false;
        }
        function rebasePinch() {
            if (touches.size < 2) { pinch = null; return; }
            var values = Array.from(touches.values());
            pinch = { distance: M.dist(values[0].x, values[0].y, values[1].x, values[1].y), threshold: threshold };
            suppressPaint = true;
        }
        function setTouch(pointer, event, paint) {
            var id = event ? event.pointerId : 1;
            var point = pixels(env, pointer);
            touches.set(id, point);
            if (touches.size >= 2) {
                if (!pinch || touches.size === 2) rebasePinch();
            } else if (paint && !suppressPaint && contains(panel(), point)) paintAt(toGrid(point), 1);
        }
        function moveTouch(pointer, event) {
            var id = event ? event.pointerId : 1, point = pixels(env, pointer);
            if (!touches.has(id)) return;
            touches.set(id, point);
            if (touches.size >= 2) {
                if (!pinch) rebasePinch();
                var values = Array.from(touches.values());
                var distance = M.dist(values[0].x, values[0].y, values[1].x, values[1].y);
                threshold = M.clamp(pinch.threshold + (distance - pinch.distance) / Math.max(160, env.height * .35), .08, .92);
            } else if (!suppressPaint && contains(panel(), point)) paintAt(toGrid(point), .72);
        }
        function endTouch(event) {
            touches.delete(event ? event.pointerId : 1);
            if (touches.size >= 2) rebasePinch();
            else pinch = null;
            if (!touches.size) suppressPaint = false;
        }

        reset();
        return {
            pointerDown: function (pointer, event) { setTouch(pointer, event, true); },
            pointerMove: moveTouch,
            pointerUp: function (_, event) { endTouch(event); },
            pointerCancel: function (_, event) { endTouch(event); },
            wheel: function (_, dy) { threshold = M.clamp(threshold - dy * .0012, .08, .92); },
            action: function () { tool = (tool + 1) % tools.length; setAction(); },
            keyDown: function (event) {
                if (event.key.toLowerCase() === "a") asymptotic = !asymptotic;
                if (event.key.toLowerCase() === "r") reset();
                if (event.key === "ArrowUp") { threshold = M.clamp(threshold + .03, .08, .92); event.preventDefault(); }
                if (event.key === "ArrowDown") { threshold = M.clamp(threshold - .03, .08, .92); event.preventDefault(); }
            },
            demo: function (time) {
                var grid = { x: W * (.5 + Math.sin(time * .43) * .28), y: H * (.5 + Math.cos(time * .61) * .25) };
                tool = Math.floor(time / 8) % 2; paintAt(grid, .18); threshold = .42 + Math.sin(time * .25) * .16;
            },
            update: function () {
                ambiguousCount = 0;
                for (var y = 0; y < H - 1; y += 1) for (var x = 0; x < W - 1; x += 1) { var code = caseAt(x, y).code; if (code === 5 || code === 10) ambiguousCount += 1; }
                env.setMeter(threshold);
                env.setState("ISO " + threshold.toFixed(2) + " / " + ambiguousCount + " AMBIGUOUS CELLS", "16 种单元配置经边值插值；case 5/10 由双线性鞍点判别式消歧");
            },
            draw: function () {
                begin(env, ctx, "#060a17"); updateHeat();
                var rect = panel(), cellW = rect.w / (W - 1), cellH = rect.h / (H - 1);
                ctx.save(); M.roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 24); ctx.clip();
                ctx.imageSmoothingEnabled = true; ctx.drawImage(offscreen, rect.x, rect.y, rect.w, rect.h);
                ctx.fillStyle = "rgba(3,6,15,.22)"; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
                ambiguousCount = 0;
                for (var y = 0; y < H - 1; y += 1) for (var x = 0; x < W - 1; x += 1) {
                    var cell = caseAt(x, y), lines = segments(cell);
                    if (cell.code === 5 || cell.code === 10) {
                        ambiguousCount += 1; ctx.fillStyle = "rgba(255,213,110,.12)"; ctx.fillRect(rect.x + x * cellW, rect.y + y * cellH, cellW, cellH);
                    }
                    lines.forEach(function (line) {
                        ctx.beginPath();
                        ctx.moveTo(rect.x + (x + line[0].x) * cellW, rect.y + (y + line[0].y) * cellH);
                        ctx.lineTo(rect.x + (x + line[1].x) * cellW, rect.y + (y + line[1].y) * cellH);
                        ctx.strokeStyle = "rgba(255,255,255,.94)"; ctx.lineWidth = env.preview ? 1.5 : 2.2; ctx.stroke();
                    });
                }
                ctx.restore();
                rounded(ctx, rect.x, rect.y, rect.w, rect.h, 24, null, "rgba(255,255,255,.16)");
                var px = rect.x + pointerCell.x / (W - 1) * rect.w, py = rect.y + pointerCell.y / (H - 1) * rect.h;
                ctx.beginPath(); ctx.arc(px, py, radius / W * rect.w, 0, TAU); ctx.strokeStyle = tools[tool] === "SUBTRACT" ? "#ff7198" : tools[tool] === "SMOOTH" ? "#ffd56e" : "#74e6ff"; ctx.lineWidth = 2; ctx.stroke();
                var inspectX = M.clamp(Math.floor(pointerCell.x), 0, W - 2), inspectY = M.clamp(Math.floor(pointerCell.y), 0, H - 2), inspected = caseAt(inspectX, inspectY);
                rounded(ctx, rect.x + 12, rect.y + 12, 152, 46, 10, "rgba(3,7,16,.78)", "rgba(255,255,255,.14)");
                mono(ctx, "CASE " + inspected.code.toString(2).padStart(4, "0") + " / " + inspected.code, rect.x + 24, rect.y + 29, 8, inspected.code === 5 || inspected.code === 10 ? "#ffd56e" : "#fff");
                mono(ctx, asymptotic ? "ASYMPTOTIC / ON" : "ASYMPTOTIC / FIXED", rect.x + 24, rect.y + 46, 6, "rgba(255,255,255,.46)");
            }
        };
    });

    /* 90 — Seam Carving --------------------------------------------------- */
    replace("seam-carving", function (env) {
        var ctx = context(env);
        var baseW = env.mobile ? 144 : 220;
        var imageH = Math.round(baseW * 9 / 16);
        var currentW = baseW;
        var targetW = baseW;
        var pixelsData = new Uint8ClampedArray(baseW * imageH * 4);
        var protect = new Float32Array(baseW * imageH);
        var remove = new Float32Array(baseW * imageH);
        var energy = new Float32Array(baseW * imageH);
        var seam = null;
        var ready = false;
        var active = false;
        var activePointerId = null;
        var tool = 0;
        var tools = ["RESIZE", "PROTECT", "REMOVE"];
        var brushRadius = env.mobile ? 7 : 9;
        var lastStep = 0;
        var dirty = true;
        var sourceImage = new Image();
        var sourceCanvas = document.createElement("canvas");
        var sourceCtx = sourceCanvas.getContext("2d");
        var workCanvas = document.createElement("canvas");
        var workCtx = workCanvas.getContext("2d");
        var energyCanvas = document.createElement("canvas");
        var energyCtx = energyCanvas.getContext("2d");

        addHud(env, [
            ["RESIZE", "横向拖动目标宽度，逐条删除或插入 seam"],
            ["PROTECT", "绘制高代价掩模，迫使 seam 绕开主体"],
            ["REMOVE", "绘制负能量掩模，主动吸引删除路径"]
        ]);
        function setAction() { env.setAction("TOOL / " + tools[tool]); }
        setAction();

        function layout() {
            var area = focusArea(env, .34);
            if (env.mobile) {
                return {
                    area: area,
                    main: { x: area.x, y: area.y + 52, w: area.w, h: area.h - 52 },
                    original: { x: area.x, y: area.y, w: area.w * .47, h: 44 },
                    energy: { x: area.x + area.w * .53, y: area.y, w: area.w * .47, h: 44 }
                };
            }
            return {
                area: area,
                original: { x: area.x, y: area.y, w: area.w * .21, h: area.h * .28 },
                energy: { x: area.x, y: area.y + area.h * .32, w: area.w * .21, h: area.h * .28 },
                main: { x: area.x + area.w * .245, y: area.y, w: area.w * .755, h: area.h }
            };
        }
        function resultRect() {
            var slot = layout().main;
            var scale = Math.min((slot.w - 20) / (baseW * 1.1), (slot.h - 34) / imageH);
            var width = currentW * scale, height = imageH * scale;
            return { x: slot.x + (slot.w - width) * .5, y: slot.y + (slot.h - height) * .5, w: width, h: height, scale: scale };
        }
        function setFromImage() {
            sourceCanvas.width = baseW; sourceCanvas.height = imageH;
            sourceCtx.drawImage(sourceImage, 0, 0, baseW, imageH);
            var imageData = sourceCtx.getImageData(0, 0, baseW, imageH);
            pixelsData = new Uint8ClampedArray(imageData.data);
            protect = new Float32Array(baseW * imageH);
            remove = new Float32Array(baseW * imageH);
            currentW = baseW; targetW = baseW; ready = true; dirty = true;
            computeSeam();
        }
        sourceImage.onload = setFromImage;
        sourceImage.src = "../assets/bg8-720.webp";

        function luminance(x, y) {
            x = M.clamp(x, 0, currentW - 1); y = M.clamp(y, 0, imageH - 1);
            var p = (x + y * currentW) * 4;
            return pixelsData[p] * .2126 + pixelsData[p + 1] * .7152 + pixelsData[p + 2] * .0722;
        }
        function computeEnergy() {
            energy = new Float32Array(currentW * imageH);
            for (var y = 0; y < imageH; y += 1) for (var x = 0; x < currentW; x += 1) {
                var gx = Math.abs(luminance(x + 1, y) - luminance(x - 1, y));
                var gy = Math.abs(luminance(x, y + 1) - luminance(x, y - 1));
                var i = x + y * currentW;
                energy[i] = gx + gy + protect[i] * 1200 - remove[i] * 720 + (x === 0 || x === currentW - 1 ? 180 : 0);
            }
        }
        function computeSeam() {
            if (!ready || currentW < 3) return;
            computeEnergy();
            var cost = new Float32Array(currentW * imageH);
            var parent = new Int8Array(currentW * imageH);
            for (var x = 0; x < currentW; x += 1) cost[x] = energy[x];
            for (var y = 1; y < imageH; y += 1) for (var x = 0; x < currentW; x += 1) {
                var bestX = x, best = cost[x + (y - 1) * currentW];
                if (x > 0 && cost[x - 1 + (y - 1) * currentW] < best) { best = cost[x - 1 + (y - 1) * currentW]; bestX = x - 1; }
                if (x + 1 < currentW && cost[x + 1 + (y - 1) * currentW] < best) { best = cost[x + 1 + (y - 1) * currentW]; bestX = x + 1; }
                cost[x + y * currentW] = energy[x + y * currentW] + best;
                parent[x + y * currentW] = bestX - x;
            }
            var end = 0, endCost = cost[(imageH - 1) * currentW];
            for (var sx = 1; sx < currentW; sx += 1) if (cost[sx + (imageH - 1) * currentW] < endCost) { end = sx; endCost = cost[sx + (imageH - 1) * currentW]; }
            seam = new Int16Array(imageH); seam[imageH - 1] = end;
            for (var sy = imageH - 1; sy > 0; sy -= 1) seam[sy - 1] = seam[sy] + parent[seam[sy] + sy * currentW];
            dirty = true;
        }
        function copyPixel(source, sourceIndex, output, outputIndex) {
            var a = sourceIndex * 4, b = outputIndex * 4;
            output[b] = source[a]; output[b + 1] = source[a + 1]; output[b + 2] = source[a + 2]; output[b + 3] = source[a + 3];
        }
        function removeSeam() {
            if (!seam || currentW <= Math.round(baseW * .56)) return;
            var nextW = currentW - 1;
            var nextPixels = new Uint8ClampedArray(nextW * imageH * 4);
            var nextProtect = new Float32Array(nextW * imageH), nextRemove = new Float32Array(nextW * imageH);
            for (var y = 0; y < imageH; y += 1) {
                var nx = 0;
                for (var x = 0; x < currentW; x += 1) {
                    if (x === seam[y]) continue;
                    copyPixel(pixelsData, x + y * currentW, nextPixels, nx + y * nextW);
                    nextProtect[nx + y * nextW] = protect[x + y * currentW];
                    nextRemove[nx + y * nextW] = remove[x + y * currentW];
                    nx += 1;
                }
            }
            currentW = nextW; pixelsData = nextPixels; protect = nextProtect; remove = nextRemove; computeSeam();
        }
        function insertSeam() {
            if (!seam || currentW >= Math.round(baseW * 1.1)) return;
            var nextW = currentW + 1;
            var nextPixels = new Uint8ClampedArray(nextW * imageH * 4);
            var nextProtect = new Float32Array(nextW * imageH), nextRemove = new Float32Array(nextW * imageH);
            for (var y = 0; y < imageH; y += 1) {
                var nx = 0;
                for (var x = 0; x < currentW; x += 1) {
                    var sourceIndex = x + y * currentW;
                    copyPixel(pixelsData, sourceIndex, nextPixels, nx + y * nextW);
                    nextProtect[nx + y * nextW] = protect[sourceIndex]; nextRemove[nx + y * nextW] = remove[sourceIndex]; nx += 1;
                    if (x === seam[y]) {
                        var neighbor = Math.min(currentW - 1, x + 1), a = sourceIndex * 4, b = (neighbor + y * currentW) * 4, out = (nx + y * nextW) * 4;
                        for (var channel = 0; channel < 4; channel += 1) nextPixels[out + channel] = Math.round((pixelsData[a + channel] + pixelsData[b + channel]) * .5);
                        nextProtect[nx + y * nextW] = protect[sourceIndex]; nextRemove[nx + y * nextW] = remove[sourceIndex]; nx += 1;
                    }
                }
            }
            currentW = nextW; pixelsData = nextPixels; protect = nextProtect; remove = nextRemove; computeSeam();
        }
        function renderBuffers() {
            if (!ready || !dirty) return;
            workCanvas.width = currentW; workCanvas.height = imageH;
            var workImage = workCtx.createImageData(currentW, imageH); workImage.data.set(pixelsData); workCtx.putImageData(workImage, 0, 0);
            energyCanvas.width = currentW; energyCanvas.height = imageH;
            var energyImage = energyCtx.createImageData(currentW, imageH);
            var maxEnergy = 1;
            for (var i = 0; i < energy.length; i += 1) if (energy[i] < 1200) maxEnergy = Math.max(maxEnergy, energy[i]);
            for (var j = 0; j < energy.length; j += 1) {
                var value = M.clamp((energy[j] + 180) / (maxEnergy + 180), 0, 1), p = j * 4;
                energyImage.data[p] = Math.round(value * 255);
                energyImage.data[p + 1] = Math.round(value * value * 120);
                energyImage.data[p + 2] = Math.round(40 + (1 - value) * 130);
                energyImage.data[p + 3] = 255;
            }
            energyCtx.putImageData(energyImage, 0, 0); dirty = false;
        }
        function setTarget(point) {
            var slot = layout().main;
            var t = M.clamp((point.x - slot.x) / slot.w, 0, 1);
            targetW = Math.round(baseW * (.58 + t * .52));
        }
        function paintMask(point) {
            var rect = resultRect();
            if (!contains(rect, point)) return;
            var gx = (point.x - rect.x) / rect.w * currentW, gy = (point.y - rect.y) / rect.h * imageH;
            for (var y = Math.floor(gy - brushRadius); y <= Math.ceil(gy + brushRadius); y += 1) for (var x = Math.floor(gx - brushRadius); x <= Math.ceil(gx + brushRadius); x += 1) {
                if (x < 0 || x >= currentW || y < 0 || y >= imageH) continue;
                var distance = Math.hypot(x - gx, y - gy);
                if (distance > brushRadius) continue;
                var value = Math.pow(1 - distance / brushRadius, 2), i = x + y * currentW;
                if (tool === 1) { protect[i] = Math.max(protect[i], value); remove[i] = 0; }
                else { remove[i] = Math.max(remove[i], value); protect[i] = 0; }
            }
            computeSeam();
        }
        function handle(pointer) {
            var point = pixels(env, pointer);
            if (tool === 0) setTarget(point); else paintMask(point);
        }

        return {
            pointerDown: function (pointer, event) {
                if (activePointerId !== null) return;
                activePointerId = event ? event.pointerId : 1;
                active = true;
                handle(pointer);
            },
            pointerMove: function (pointer, event) {
                if (!active || activePointerId !== (event ? event.pointerId : 1)) return;
                handle(pointer);
            },
            pointerUp: function (_, event) {
                if (activePointerId !== (event ? event.pointerId : 1)) return;
                active = false;
                activePointerId = null;
                computeSeam();
            },
            pointerCancel: function (_, event) {
                if (activePointerId !== (event ? event.pointerId : 1)) return;
                active = false;
                activePointerId = null;
            },
            wheel: function (_, dy) { targetW = M.clamp(Math.round(targetW - dy * .035), Math.round(baseW * .58), Math.round(baseW * 1.1)); },
            action: function () { tool = (tool + 1) % tools.length; setAction(); },
            keyDown: function (event) {
                var number = Number(event.key);
                if (number >= 1 && number <= 3) { tool = number - 1; setAction(); }
                if (event.key.toLowerCase() === "r" && ready) setFromImage();
            },
            demo: function (time) { if (ready) { tool = 0; targetW = Math.round(baseW * (.78 + Math.sin(time * .34) * .17)); } },
            update: function (dt) {
                if (ready && !active && currentW !== targetW && env.time - lastStep > (env.mobile ? .075 : .045)) {
                    lastStep = env.time;
                    if (currentW > targetW) removeSeam(); else insertSeam();
                }
                env.setMeter(ready ? (currentW - baseW * .58) / (baseW * .52) : 0);
                env.setState(ready ? currentW + " × " + imageH + " / TARGET " + targetW + " / " + tools[tool] : "LOADING SOURCE IMAGE", "梯度能量叠加 Protect / Remove 权重后，以动态规划求最低代价连续 seam");
            },
            draw: function () {
                begin(env, ctx, "#090d12");
                var view = layout();
                if (!ready) { mono(ctx, "LOADING / SOURCE", view.area.x + view.area.w * .5, view.area.y + view.area.h * .5, 9, "rgba(255,255,255,.5)", "center"); return; }
                renderBuffers();
                rounded(ctx, view.original.x, view.original.y, view.original.w, view.original.h, 14, "rgba(255,255,255,.035)", "rgba(255,255,255,.12)");
                ctx.save(); M.roundedRect(ctx, view.original.x + 5, view.original.y + 5, view.original.w - 10, view.original.h - 10, 10); ctx.clip(); ctx.drawImage(sourceCanvas, view.original.x + 5, view.original.y + 5, view.original.w - 10, view.original.h - 10); ctx.restore();
                mono(ctx, "SOURCE", view.original.x + 10, view.original.y + 13, 6, "rgba(255,255,255,.62)");
                rounded(ctx, view.energy.x, view.energy.y, view.energy.w, view.energy.h, 14, "rgba(255,255,255,.035)", "rgba(255,255,255,.12)");
                ctx.save(); M.roundedRect(ctx, view.energy.x + 5, view.energy.y + 5, view.energy.w - 10, view.energy.h - 10, 10); ctx.clip(); ctx.drawImage(energyCanvas, view.energy.x + 5, view.energy.y + 5, view.energy.w - 10, view.energy.h - 10); ctx.restore();
                mono(ctx, "ENERGY", view.energy.x + 10, view.energy.y + 13, 6, "rgba(255,255,255,.62)");
                rounded(ctx, view.main.x, view.main.y, view.main.w, view.main.h, 22, "rgba(255,255,255,.025)", "rgba(255,255,255,.12)");
                var rect = resultRect();
                ctx.save(); M.roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 12); ctx.clip(); ctx.imageSmoothingEnabled = true; ctx.drawImage(workCanvas, rect.x, rect.y, rect.w, rect.h);
                for (var y = 0; y < imageH; y += 2) for (var x = 0; x < currentW; x += 2) {
                    var i = x + y * currentW;
                    if (protect[i] > .08 || remove[i] > .08) {
                        ctx.fillStyle = protect[i] > remove[i] ? "rgba(90,255,170," + protect[i] * .38 + ")" : "rgba(255,68,112," + remove[i] * .42 + ")";
                        ctx.fillRect(rect.x + x / currentW * rect.w, rect.y + y / imageH * rect.h, rect.w / currentW * 2.2, rect.h / imageH * 2.2);
                    }
                }
                if (seam) {
                    ctx.beginPath();
                    for (var sy = 0; sy < imageH; sy += 1) {
                        var sx = rect.x + (seam[sy] + .5) / currentW * rect.w, py = rect.y + sy / (imageH - 1) * rect.h;
                        if (!sy) ctx.moveTo(sx, py); else ctx.lineTo(sx, py);
                    }
                    ctx.strokeStyle = "#ffdf5d"; ctx.lineWidth = 1.6; ctx.stroke();
                }
                ctx.restore();
                rounded(ctx, rect.x, rect.y, rect.w, rect.h, 12, null, "rgba(255,255,255,.25)");
                var targetDisplayW = targetW * rect.scale;
                ctx.strokeStyle = "rgba(255,223,93,.44)"; ctx.setLineDash([5, 5]); ctx.strokeRect(view.main.x + (view.main.w - targetDisplayW) * .5, rect.y - 7, targetDisplayW, rect.h + 14); ctx.setLineDash([]);
                mono(ctx, tools[tool] + " / SEAM PREVIEW", view.main.x + 13, view.main.y + 16, 7, tool === 1 ? "#5affaa" : tool === 2 ? "#ff4470" : "#ffdf5d");
            },
            destroy: function () { sourceImage.onload = null; }
        };
    });

    /* 96 — Arcball Manipulation ------------------------------------------ */
    replace("arcball-manipulation", function (env) {
        var ctx = context(env);
        var orientation = { w: 1, x: 0, y: 0, z: 0 };
        var snapTarget = null;
        var angularAxis = { x: 0, y: 1, z: 0 };
        var angularSpeed = 0;
        var scale = 1;
        var targetScale = 1;
        var touches = new Map();
        var drag = null;
        var gesture = null;
        var snapIndex = 0;

        addHud(env, [
            ["DRAG SPHERE", "相邻球面投影向量生成累积四元数"],
            ["FLICK", "由真实切向旋转轴延续惯性"],
            ["PINCH / TWIST", "双指缩放并绕视线滚转"]
        ]);
        env.setAction("SNAP ORIENTATION");

        function sphere() {
            var area = focusArea(env, .34);
            var radius = Math.min(area.w, area.h) * (env.mobile ? .43 : .46);
            return { x: area.x + area.w * .5, y: area.y + area.h * .51, r: radius, area: area };
        }
        function qNormalize(q) {
            var length = Math.hypot(q.w, q.x, q.y, q.z) || 1;
            return { w: q.w / length, x: q.x / length, y: q.y / length, z: q.z / length };
        }
        function qMultiply(a, b) {
            return qNormalize({
                w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
                x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
                y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
                z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
            });
        }
        function qAxisAngle(axis, angle) {
            axis = normalize3(axis); var half = angle * .5, sine = Math.sin(half);
            return { w: Math.cos(half), x: axis.x * sine, y: axis.y * sine, z: axis.z * sine };
        }
        function qFromVectors(a, b) {
            var axis = cross(a, b), value = 1 + dot(a, b);
            if (value < .00001) {
                axis = Math.abs(a.x) > Math.abs(a.z) ? { x: -a.y, y: a.x, z: 0 } : { x: 0, y: -a.z, z: a.y };
                return qAxisAngle(axis, Math.PI);
            }
            return qNormalize({ w: value, x: axis.x, y: axis.y, z: axis.z });
        }
        function qRotate(q, point) {
            var qv = { x: q.x, y: q.y, z: q.z };
            var uv = cross(qv, point), uuv = cross(qv, uv);
            return { x: point.x + 2 * (q.w * uv.x + uuv.x), y: point.y + 2 * (q.w * uv.y + uuv.y), z: point.z + 2 * (q.w * uv.z + uuv.z) };
        }
        function qSlerp(a, b, t) {
            var cosine = a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;
            if (cosine < 0) { b = { w: -b.w, x: -b.x, y: -b.y, z: -b.z }; cosine = -cosine; }
            if (cosine > .9995) return qNormalize({ w: M.lerp(a.w, b.w, t), x: M.lerp(a.x, b.x, t), y: M.lerp(a.y, b.y, t), z: M.lerp(a.z, b.z, t) });
            var theta = Math.acos(M.clamp(cosine, -1, 1)), sine = Math.sin(theta);
            var wa = Math.sin((1 - t) * theta) / sine, wb = Math.sin(t * theta) / sine;
            return qNormalize({ w: a.w * wa + b.w * wb, x: a.x * wa + b.x * wb, y: a.y * wa + b.y * wb, z: a.z * wa + b.z * wb });
        }
        function mapSphere(point) {
            var ball = sphere();
            var x = (point.x - ball.x) / ball.r, y = (ball.y - point.y) / ball.r;
            var length2 = x * x + y * y;
            if (length2 <= 1) return { x: x, y: y, z: Math.sqrt(1 - length2) };
            var length = Math.sqrt(length2); return { x: x / length, y: y / length, z: 0 };
        }
        function beginSingle(id, point) {
            drag = { id: id, start: mapSphere(point), current: mapSphere(point), quat: orientation, last: mapSphere(point), time: env.time };
            gesture = null; angularSpeed = 0; snapTarget = null;
        }
        function beginGesture() {
            if (touches.size < 2) return;
            var values = Array.from(touches.values());
            gesture = {
                distance: Math.max(10, M.dist(values[0].x, values[0].y, values[1].x, values[1].y)),
                angle: Math.atan2(values[1].y - values[0].y, values[1].x - values[0].x),
                scale: targetScale,
                quat: orientation
            };
            drag = null; angularSpeed = 0; snapTarget = null;
        }
        function reset() {
            orientation = { w: 1, x: 0, y: 0, z: 0 };
            snapTarget = null; angularSpeed = 0; targetScale = 1; scale = 1;
            touches.clear(); drag = null; gesture = null;
        }
        function pointerDown(pointer, event) {
            var point = pixels(env, pointer), ball = sphere();
            if (M.dist(point.x, point.y, ball.x, ball.y) > ball.r * 1.08) return;
            var id = event ? event.pointerId : 1; touches.set(id, point);
            if (touches.size === 1) beginSingle(id, point); else beginGesture();
        }
        function pointerMove(pointer, event) {
            var id = event ? event.pointerId : 1, point = pixels(env, pointer);
            if (!touches.has(id)) return;
            touches.set(id, point);
            if (touches.size >= 2) {
                var values = Array.from(touches.values());
                if (!gesture) beginGesture();
                var distance = Math.max(10, M.dist(values[0].x, values[0].y, values[1].x, values[1].y));
                var angle = Math.atan2(values[1].y - values[0].y, values[1].x - values[0].x);
                targetScale = M.clamp(gesture.scale * distance / gesture.distance, .62, 1.55);
                orientation = qMultiply(qAxisAngle({ x: 0, y: 0, z: 1 }, angle - gesture.angle), gesture.quat);
                return;
            }
            if (!drag || drag.id !== id) return;
            var current = mapSphere(point);
            var delta = qFromVectors(drag.start, current);
            if (event && event.shiftKey) {
                var axis = normalize3({ x: delta.x, y: delta.y, z: delta.z });
                var valuesAxis = [Math.abs(axis.x), Math.abs(axis.y), Math.abs(axis.z)], dominant = valuesAxis.indexOf(Math.max.apply(null, valuesAxis));
                axis = dominant === 0 ? { x: Math.sign(axis.x) || 1, y: 0, z: 0 } : dominant === 1 ? { x: 0, y: Math.sign(axis.y) || 1, z: 0 } : { x: 0, y: 0, z: Math.sign(axis.z) || 1 };
                delta = qAxisAngle(axis, 2 * Math.acos(M.clamp(delta.w, -1, 1)));
            }
            orientation = qMultiply(delta, drag.quat);
            var incremental = qFromVectors(drag.last, current);
            var elapsed = Math.max(.008, env.time - drag.time);
            var sine = Math.hypot(incremental.x, incremental.y, incremental.z);
            if (sine > .0001) {
                angularAxis = normalize3({ x: incremental.x, y: incremental.y, z: incremental.z });
                angularSpeed = M.clamp(2 * Math.atan2(sine, incremental.w) / elapsed, 0, 10);
            }
            drag.current = current; drag.last = current; drag.time = env.time;
        }
        function pointerEnd(_, event, cancelled) {
            var id = event ? event.pointerId : 1;
            if (!touches.has(id)) return;
            touches.delete(id);
            if (cancelled) angularSpeed = 0;
            if (touches.size === 1) { var remaining = Array.from(touches.entries())[0]; beginSingle(remaining[0], remaining[1]); }
            else { drag = null; gesture = null; }
        }
        function snap() {
            var presets = [
                qMultiply(qAxisAngle({ x: 1, y: 0, z: 0 }, -.58), qAxisAngle({ x: 0, y: 1, z: 0 }, .72)),
                qAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI * .5),
                qAxisAngle({ x: 1, y: 0, z: 0 }, -Math.PI * .5),
                { w: 1, x: 0, y: 0, z: 0 }
            ];
            snapTarget = presets[snapIndex % presets.length]; snapIndex += 1; angularSpeed = 0;
        }

        return {
            pointerDown: pointerDown,
            pointerMove: pointerMove,
            pointerUp: function (pointer, event) { pointerEnd(pointer, event, false); },
            pointerCancel: function (pointer, event) { pointerEnd(pointer, event, true); },
            wheel: function (_, dy) { targetScale = M.clamp(targetScale - dy * .001, .62, 1.55); },
            action: snap,
            keyDown: function (event) {
                if (event.key.toLowerCase() === "r" || event.key === "Escape") reset();
                if (event.key === "Enter") { snap(); event.preventDefault(); }
            },
            demo: function (time) {
                orientation = qMultiply(qAxisAngle({ x: .45, y: 1, z: .18 }, time * .18), qAxisAngle({ x: 1, y: 0, z: 0 }, -.38));
                targetScale = 1 + Math.sin(time * .33) * .08;
            },
            update: function (dt) {
                scale += (targetScale - scale) * (1 - Math.exp(-8 * dt));
                if (!touches.size) {
                    if (snapTarget) {
                        orientation = qSlerp(orientation, snapTarget, 1 - Math.exp(-8 * dt));
                        var closeness = Math.abs(orientation.w * snapTarget.w + orientation.x * snapTarget.x + orientation.y * snapTarget.y + orientation.z * snapTarget.z);
                        if (closeness > .9998) { orientation = snapTarget; snapTarget = null; }
                    } else if (angularSpeed > .01 && !env.reducedMotion) {
                        orientation = qMultiply(qAxisAngle(angularAxis, angularSpeed * dt), orientation);
                        angularSpeed *= Math.exp(-2.6 * dt);
                    }
                }
                env.setMeter(M.clamp(angularSpeed / 8, 0, 1));
                env.setState("QUAT [" + orientation.w.toFixed(2) + ", " + orientation.x.toFixed(2) + ", " + orientation.y.toFixed(2) + ", " + orientation.z.toFixed(2) + "]", "可见球面与命中投影使用同一圆；增量四元数避免欧拉角锁");
            },
            draw: function () {
                begin(env, ctx, "#f2eee5");
                var ball = sphere();
                var halo = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, ball.r * 1.2);
                halo.addColorStop(0, "rgba(66,73,255,.08)"); halo.addColorStop(.72, "rgba(66,73,255,.02)"); halo.addColorStop(1, "transparent");
                ctx.fillStyle = halo; ctx.fillRect(ball.x - ball.r * 1.3, ball.y - ball.r * 1.3, ball.r * 2.6, ball.r * 2.6);
                ctx.strokeStyle = "rgba(25,31,42,.16)"; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, TAU); ctx.stroke();
                ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.ellipse(ball.x, ball.y, ball.r, ball.r * .24, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
                var vertices = [
                    { x: -1, y: -1, z: -1 }, { x: 1, y: -1, z: -1 }, { x: 1, y: 1, z: -1 }, { x: -1, y: 1, z: -1 },
                    { x: -1, y: -1, z: 1 }, { x: 1, y: -1, z: 1 }, { x: 1, y: 1, z: 1 }, { x: -1, y: 1, z: 1 }
                ].map(function (point) {
                    var rotated = qRotate(orientation, point), perspective = 1 / (1 + rotated.z * .1);
                    return { x: ball.x + rotated.x * ball.r * .43 * scale * perspective, y: ball.y - rotated.y * ball.r * .43 * scale * perspective, z: rotated.z };
                });
                var faces = [
                    { i: [0, 1, 2, 3], color: "#ff7a61" }, { i: [4, 7, 6, 5], color: "#4856ff" },
                    { i: [0, 4, 5, 1], color: "#ffd15b" }, { i: [3, 2, 6, 7], color: "#64cf9a" },
                    { i: [1, 5, 6, 2], color: "#9c77f5" }, { i: [0, 3, 7, 4], color: "#33a9c7" }
                ];
                faces.forEach(function (face) { face.depth = face.i.reduce(function (sum, index) { return sum + vertices[index].z; }, 0) / 4; });
                faces.sort(function (a, b) { return b.depth - a.depth; }).forEach(function (face) {
                    ctx.beginPath(); face.i.forEach(function (index, order) { var point = vertices[index]; if (!order) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y); }); ctx.closePath();
                    ctx.fillStyle = face.color + "cc"; ctx.fill(); ctx.strokeStyle = "rgba(22,27,37,.68)"; ctx.lineWidth = 1.6; ctx.stroke();
                });
                if (drag) {
                    ctx.strokeStyle = "rgba(72,86,255,.65)"; ctx.lineWidth = 2.5;
                    ctx.beginPath(); ctx.moveTo(ball.x + drag.start.x * ball.r, ball.y - drag.start.y * ball.r); ctx.quadraticCurveTo(ball.x, ball.y, ball.x + drag.current.x * ball.r, ball.y - drag.current.y * ball.r); ctx.stroke();
                }
                var axisEnd = qRotate(orientation, { x: 0, y: 1.42, z: 0 });
                ctx.strokeStyle = "rgba(17,24,39,.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(ball.x + axisEnd.x * ball.r * .43, ball.y - axisEnd.y * ball.r * .43); ctx.stroke();
                mono(ctx, touches.size >= 2 ? "PINCH + ROLL" : angularSpeed > .1 ? "INERTIA " + angularSpeed.toFixed(2) + " RAD/S" : "ARCBALL / READY", ball.area.x + 12, ball.area.y + 18, 7, "rgba(25,31,42,.56)");
            }
        };
    });

    /* 110 — FABRIK Inverse Kinematics ----------------------------------- */
    replace("fabrik-inverse-kinematics", function (env) {
        var ctx = context(env);
        var points = [];
        var lengths = [];
        var root = { x: 0, y: 0 };
        var target = { x: 0, y: 0 };
        var pole = { x: 0, y: 0 };
        var obstacles = [];
        var active = null;
        var activePointerId = null;
        var restore = null;
        var modes = [180, 55, 25];
        var mode = 0;
        var reachable = true;
        var solved = true;
        var residual = 0;
        var maxLengthError = 0;
        var maxAngleExcess = 0;
        var maxPenetration = 0;

        addHud(env, [
            ["DRAG TARGET", "前后向迭代满足固定骨长并追踪末端"],
            ["DRAG POLE", "控制链条弯曲侧，避免解突然翻转"],
            ["ACTION", "循环 FREE / 55° / 25° 关节限位"]
        ]);
        function setAction() { env.setAction("JOINT LIMIT / " + (mode ? modes[mode] + "°" : "FREE")); }
        setAction();

        function area() { return focusArea(env, .34); }
        function build() {
            var rect = area();
            var count = env.mobile ? 8 : 10;
            var segment = Math.min(rect.w * .072, rect.h * .1);
            root = { x: rect.x + rect.w * .18, y: rect.y + rect.h * .62 };
            points = Array.from({ length: count }, function (_, index) { return { x: root.x + index * segment, y: root.y - Math.sin(index * .45) * 7 }; });
            lengths = Array(count - 1).fill(segment);
            var reach = segment * (count - 1);
            target = { x: root.x + reach * .76, y: root.y - reach * .28 };
            pole = { x: root.x + reach * .42, y: root.y - reach * .55 };
            obstacles = [
                { x: root.x + reach * .42, y: root.y + reach * .08, r: segment * .72 },
                { x: root.x + reach * .69, y: root.y - reach * .2, r: segment * .62 }
            ];
            active = null; activePointerId = null; restore = null;
        }
        function totalLength() { return lengths.reduce(function (sum, length) { return sum + length; }, 0); }
        function constrainDirection(previousAngle, proposedAngle, limit) {
            var delta = Math.atan2(Math.sin(proposedAngle - previousAngle), Math.cos(proposedAngle - previousAngle));
            return previousAngle + M.clamp(delta, -limit, limit);
        }
        function projectObstacles() {
            for (var i = 1; i < points.length - 1; i += 1) obstacles.forEach(function (obstacle) {
                var dx = points[i].x - obstacle.x, dy = points[i].y - obstacle.y, distance = Math.hypot(dx, dy);
                if (distance < .00001) {
                    var segmentX = points[i + 1].x - points[i - 1].x, segmentY = points[i + 1].y - points[i - 1].y;
                    var segmentLength = Math.hypot(segmentX, segmentY) || 1;
                    dx = -segmentY / segmentLength; dy = segmentX / segmentLength; distance = 1;
                    if (Math.hypot(dx, dy) < .5) { dx = 1; dy = 0; }
                }
                var clearance = obstacle.r + 7;
                if (distance < clearance) { points[i].x = obstacle.x + dx / distance * clearance; points[i].y = obstacle.y + dy / distance * clearance; }
            });
        }
        function applyPole() {
            var tx = target.x - root.x, ty = target.y - root.y, length2 = tx * tx + ty * ty || 1;
            var poleSide = Math.sign(tx * (pole.y - root.y) - ty * (pole.x - root.x)) || 1;
            for (var i = 1; i < points.length - 1; i += 1) {
                var t = ((points[i].x - root.x) * tx + (points[i].y - root.y) * ty) / length2;
                var lineX = root.x + tx * t, lineY = root.y + ty * t;
                var currentSide = Math.sign(tx * (points[i].y - root.y) - ty * (points[i].x - root.x)) || poleSide;
                if (currentSide !== poleSide) {
                    var nx = -ty / Math.sqrt(length2), ny = tx / Math.sqrt(length2);
                    var distance = M.dist(points[i].x, points[i].y, lineX, lineY);
                    points[i].x = lineX + nx * poleSide * distance;
                    points[i].y = lineY + ny * poleSide * distance;
                }
            }
        }
        function enforceLengths() {
            points[0].x = root.x; points[0].y = root.y;
            for (var i = 0; i < points.length - 1; i += 1) {
                var dx = points[i + 1].x - points[i].x, dy = points[i + 1].y - points[i].y;
                var distance = Math.hypot(dx, dy) || 1;
                var angle = Math.atan2(dy, dx);
                if (mode && i > 0) {
                    var previousAngle = Math.atan2(points[i].y - points[i - 1].y, points[i].x - points[i - 1].x);
                    angle = constrainDirection(previousAngle, angle, modes[mode] * Math.PI / 180);
                }
                points[i + 1].x = points[i].x + Math.cos(angle) * lengths[i];
                points[i + 1].y = points[i].y + Math.sin(angle) * lengths[i];
            }
        }
        function measureConstraints() {
            maxLengthError = 0; maxAngleExcess = 0; maxPenetration = 0;
            for (var i = 0; i < lengths.length; i += 1) {
                maxLengthError = Math.max(maxLengthError, Math.abs(M.dist(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y) - lengths[i]));
                if (mode && i > 0) {
                    var previousAngle = Math.atan2(points[i].y - points[i - 1].y, points[i].x - points[i - 1].x);
                    var nextAngle = Math.atan2(points[i + 1].y - points[i].y, points[i + 1].x - points[i].x);
                    var bend = Math.abs(Math.atan2(Math.sin(nextAngle - previousAngle), Math.cos(nextAngle - previousAngle)));
                    maxAngleExcess = Math.max(maxAngleExcess, Math.max(0, bend - modes[mode] * Math.PI / 180) * 180 / Math.PI);
                }
            }
            for (var joint = 1; joint < points.length - 1; joint += 1) obstacles.forEach(function (obstacle) {
                maxPenetration = Math.max(maxPenetration, obstacle.r + 7 - M.dist(points[joint].x, points[joint].y, obstacle.x, obstacle.y));
            });
            maxPenetration = Math.max(0, maxPenetration);
        }
        function solve() {
            if (!points.length) return;
            var reach = totalLength();
            var rootDistance = M.dist(root.x, root.y, target.x, target.y);
            reachable = rootDistance <= reach;
            if (!reachable) {
                var dx = (target.x - root.x) / (rootDistance || 1), dy = (target.y - root.y) / (rootDistance || 1);
                points[0].x = root.x; points[0].y = root.y;
                for (var u = 1; u < points.length; u += 1) { points[u].x = points[u - 1].x + dx * lengths[u - 1]; points[u].y = points[u - 1].y + dy * lengths[u - 1]; }
            } else {
                for (var iteration = 0; iteration < 16; iteration += 1) {
                    var end = points.length - 1;
                    points[end].x = target.x; points[end].y = target.y;
                    for (var i = end - 1; i >= 0; i -= 1) {
                        var dxBack = points[i].x - points[i + 1].x, dyBack = points[i].y - points[i + 1].y;
                        var dBack = Math.hypot(dxBack, dyBack) || 1;
                        points[i].x = points[i + 1].x + dxBack / dBack * lengths[i];
                        points[i].y = points[i + 1].y + dyBack / dBack * lengths[i];
                    }
                    enforceLengths();
                    applyPole();
                    projectObstacles();
                    enforceLengths();
                }
            }
            residual = M.dist(points[points.length - 1].x, points[points.length - 1].y, target.x, target.y);
            measureConstraints();
            solved = reachable && residual < 3 && maxAngleExcess < .05 && maxPenetration < 1;
        }
        function hit(point) {
            var handles = [{ type: "target", point: target }, { type: "pole", point: pole }].concat(obstacles.map(function (obstacle, index) { return { type: "obstacle", index: index, point: obstacle }; }));
            var best = { distance: Infinity, handle: null };
            handles.forEach(function (handle) {
                var distance = M.dist(point.x, point.y, handle.point.x, handle.point.y);
                var radius = handle.type === "obstacle" ? handle.point.r + 10 : 30;
                if (distance < radius && distance < best.distance) best = { distance: distance, handle: handle };
            });
            return best.handle || { type: "target", point: target };
        }
        function start(pointer, event) {
            if (activePointerId !== null) return;
            activePointerId = event ? event.pointerId : 1;
            var point = pixels(env, pointer); active = hit(point);
            restore = { target: { x: target.x, y: target.y }, pole: { x: pole.x, y: pole.y }, obstacles: obstacles.map(function (obstacle) { return { x: obstacle.x, y: obstacle.y, r: obstacle.r }; }) };
            move(pointer, event);
        }
        function move(pointer, event) {
            if (!active || activePointerId !== (event ? event.pointerId : 1)) return;
            var point = pixels(env, pointer), rect = area();
            point.x = M.clamp(point.x, rect.x + 4, rect.x + rect.w - 4); point.y = M.clamp(point.y, rect.y + 4, rect.y + rect.h - 4);
            if (active.type === "target") { target.x = point.x; target.y = point.y; }
            else if (active.type === "pole") { pole.x = point.x; pole.y = point.y; }
            else { obstacles[active.index].x = point.x; obstacles[active.index].y = point.y; }
        }
        function finish(event) {
            if (activePointerId !== (event ? event.pointerId : 1)) return;
            active = null; restore = null; activePointerId = null;
        }
        function cancel(_, event) {
            if (event && activePointerId !== event.pointerId) return;
            if (restore) { target = restore.target; pole = restore.pole; obstacles = restore.obstacles; }
            active = null; restore = null; activePointerId = null;
        }

        build(); solve();
        return {
            resize: function () { build(); solve(); },
            pointerDown: start,
            pointerMove: move,
            pointerUp: function (_, event) { finish(event); },
            pointerCancel: cancel,
            wheel: function (_, dy) { obstacles.forEach(function (obstacle) { obstacle.r = M.clamp(obstacle.r - dy * .02, 18, 72); }); },
            action: function () { mode = (mode + 1) % modes.length; setAction(); },
            keyDown: function (event) {
                var number = Number(event.key);
                if (number >= 1 && number <= 3) { mode = number - 1; setAction(); }
                if (event.key.toLowerCase() === "r") { build(); solve(); }
                if (event.key === "Escape") cancel();
            },
            demo: function (time) {
                var rect = area(), reach = totalLength();
                target.x = root.x + reach * (.55 + Math.sin(time * .43) * .24);
                target.y = root.y - reach * (.08 + Math.cos(time * .61) * .34);
                pole.x = rect.x + rect.w * (.48 + Math.sin(time * .23) * .18);
                pole.y = rect.y + rect.h * (.24 + Math.cos(time * .31) * .12);
                mode = Math.floor(time / 9) % modes.length; setAction();
            },
            update: function () {
                solve();
                env.setMeter(M.clamp(1 - residual / Math.max(1, totalLength() * .2), 0, 1));
                var status = !reachable ? "FULL EXTENSION" : solved ? "TARGET SOLVED" : "CONSTRAINT LIMITED";
                env.setState(status + " / RESIDUAL " + residual.toFixed(1) + " PX / ΔL " + maxLengthError.toFixed(2) + " / Δθ " + maxAngleExcess.toFixed(2) + "°", "FABRIK 交替执行 backward、带关节限位的 forward、pole 与障碍投影");
            },
            draw: function () {
                begin(env, ctx, "#0b0f18");
                var rect = area(), reach = totalLength();
                rounded(ctx, rect.x, rect.y, rect.w, rect.h, 24, "rgba(255,255,255,.025)", "rgba(255,255,255,.11)");
                ctx.strokeStyle = "rgba(117,196,255,.13)"; ctx.setLineDash([5, 7]); ctx.beginPath(); ctx.arc(root.x, root.y, reach, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
                obstacles.forEach(function (obstacle, index) {
                    var gradient = ctx.createRadialGradient(obstacle.x - obstacle.r * .25, obstacle.y - obstacle.r * .3, 2, obstacle.x, obstacle.y, obstacle.r);
                    gradient.addColorStop(0, "rgba(255,133,112,.34)"); gradient.addColorStop(1, "rgba(255,88,88,.08)");
                    ctx.beginPath(); ctx.arc(obstacle.x, obstacle.y, obstacle.r, 0, TAU); ctx.fillStyle = gradient; ctx.fill(); ctx.strokeStyle = "rgba(255,118,101,.55)"; ctx.stroke();
                    mono(ctx, "O" + (index + 1), obstacle.x, obstacle.y, 7, "rgba(255,255,255,.62)", "center");
                });
                ctx.lineCap = "round";
                for (var i = 0; i < points.length - 1; i += 1) {
                    var gradientLine = ctx.createLinearGradient(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
                    gradientLine.addColorStop(0, i % 2 ? "#78d9ff" : "#9f8cff"); gradientLine.addColorStop(1, i % 2 ? "#9f8cff" : "#78d9ff");
                    ctx.strokeStyle = gradientLine; ctx.lineWidth = env.mobile ? 9 : 12;
                    ctx.beginPath(); ctx.moveTo(points[i].x, points[i].y); ctx.lineTo(points[i + 1].x, points[i + 1].y); ctx.stroke();
                    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1.2; ctx.stroke();
                }
                points.forEach(function (point, index) {
                    ctx.beginPath(); ctx.arc(point.x, point.y, index === 0 ? 11 : 7, 0, TAU); ctx.fillStyle = index === 0 ? "#fff" : "#101827"; ctx.fill(); ctx.strokeStyle = index === 0 ? "#101827" : "rgba(255,255,255,.72)"; ctx.lineWidth = 2; ctx.stroke();
                    if (mode && index > 0 && index < points.length - 1) {
                        var baseAngle = Math.atan2(points[index].y - points[index - 1].y, points[index].x - points[index - 1].x), limit = modes[mode] * Math.PI / 180;
                        ctx.strokeStyle = "rgba(255,211,110,.18)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(point.x, point.y, 18, baseAngle - limit, baseAngle + limit); ctx.stroke();
                    }
                });
                ctx.strokeStyle = "rgba(255,211,110,.4)"; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(root.x, root.y); ctx.lineTo(pole.x, pole.y); ctx.stroke(); ctx.setLineDash([]);
                ctx.beginPath(); ctx.arc(pole.x, pole.y, 10, 0, TAU); ctx.fillStyle = "#ffd36e"; ctx.fill(); mono(ctx, "POLE", pole.x, pole.y - 18, 6, "#ffd36e", "center");
                ctx.beginPath(); ctx.arc(target.x, target.y, 14, 0, TAU); ctx.strokeStyle = solved ? "#72f1b8" : "#ff6f78"; ctx.lineWidth = 3; ctx.stroke();
                ctx.beginPath(); ctx.moveTo(target.x - 20, target.y); ctx.lineTo(target.x + 20, target.y); ctx.moveTo(target.x, target.y - 20); ctx.lineTo(target.x, target.y + 20); ctx.stroke();
                mono(ctx, !reachable ? "OUT OF REACH" : solved ? "TARGET" : "CONSTRAINT", target.x, target.y + 30, 7, solved ? "#72f1b8" : "#ff6f78", "center");
            }
        };
    });

    /* 140 — Karplus–Strong String Synthesis ------------------------------ */
    replace("karplus-strong", function (env) {
        var ctx = context(env);
        var frequencies = [110, 146.83, 196, 246.94, 329.63, 440];
        var names = ["A2", "D3", "G3", "B3", "E4", "A4"];
        var energy = new Float32Array(frequencies.length);
        var pluckPosition = new Float32Array(frequencies.length);
        var phase = new Float32Array(frequencies.length);
        var touches = new Map();
        var feedback = .994;
        var voices = [];
        var lastDemoNote = -1;
        var lastFrequency = 0;
        var lastDelay = 0;

        addHud(env, [
            ["PRESS + PULL", "按住弦并垂直拉伸，释放时才注入能量"],
            ["X POSITION", "拨弦位置形成梳状激励并改变谐波"],
            ["WHEEL", "调节反馈阻尼与延音长度"]
        ]);
        env.setAction("PLUCK A–G–E VOICING");

        function stage() { return focusArea(env, .34); }
        function stringY(index) { var rect = stage(); return rect.y + (index + .7) / frequencies.length * rect.h; }
        function stringAt(point) {
            var rect = stage();
            if (!contains(rect, point)) return -1;
            var best = -1, distance = env.mobile ? 30 : 24;
            frequencies.forEach(function (_, index) {
                var next = Math.abs(point.y - stringY(index));
                if (next < distance) { distance = next; best = index; }
            });
            return best;
        }
        function ensureAudio() {
            if (env.preview) return null;
            return env.audio();
        }
        function pruneVoices(limit) {
            voices = voices.filter(function (voice) { return !voice.ended; });
            while (voices.length >= limit) {
                var voice = voices.shift();
                try {
                    var now = voice.context.currentTime;
                    voice.gain.gain.cancelScheduledValues(now);
                    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
                    voice.gain.gain.linearRampToValueAtTime(0, now + .025);
                    voice.source.stop(now + .03);
                } catch (_) {}
            }
        }
        function synthesize(index, strength, position, audible) {
            strength = M.clamp(strength, .08, 1);
            position = M.clamp(position, .06, .94);
            energy[index] = Math.max(energy[index], strength);
            pluckPosition[index] = position;
            phase[index] = 0;
            lastFrequency = frequencies[index];
            if (!audible || env.preview) return;
            var audio = ensureAudio();
            if (!audio) return;
            var delayLength = Math.max(2, Math.round(audio.sampleRate / frequencies[index]));
            var duration = 2.7;
            var sampleCount = Math.floor(audio.sampleRate * duration);
            var delay = new Float32Array(delayLength);
            var rawNoise = new Float32Array(delayLength);
            for (var i = 0; i < delayLength; i += 1) rawNoise[i] = Math.random() * 2 - 1;
            var comb = Math.max(1, Math.round(position * delayLength));
            for (var d = 0; d < delayLength; d += 1) delay[d] = (rawNoise[d] - rawNoise[(d - comb + delayLength) % delayLength]) * .56 * strength;
            var buffer = audio.createBuffer(1, sampleCount, audio.sampleRate);
            var output = buffer.getChannelData(0);
            var pointer = 0;
            for (var sample = 0; sample < sampleCount; sample += 1) {
                var value = delay[pointer];
                var averaged = (delay[pointer] + delay[(pointer + 1) % delayLength]) * .5 * feedback;
                delay[pointer] = averaged;
                output[sample] = value * .42;
                pointer = (pointer + 1) % delayLength;
            }
            pruneVoices(env.mobile ? 3 : 6);
            var source = audio.createBufferSource(), gain = audio.createGain();
            source.buffer = buffer; gain.gain.value = .12;
            source.connect(gain).connect(audio.destination);
            var voice = { source: source, gain: gain, context: audio, ended: false };
            source.onended = function () { voice.ended = true; };
            source.start(); voices.push(voice); lastDelay = delayLength;
        }
        function start(pointer, event) {
            var point = pixels(env, pointer), index = stringAt(point);
            if (index < 0) return;
            ensureAudio();
            var rect = stage(), id = event ? event.pointerId : 1;
            touches.set(id, { index: index, startY: stringY(index), y: point.y, position: M.clamp((point.x - rect.x) / rect.w, .04, .96), strength: 0 });
        }
        function move(pointer, event) {
            var id = event ? event.pointerId : 1, active = touches.get(id);
            if (!active) return;
            var point = pixels(env, pointer), rect = stage();
            active.y = point.y;
            active.position = M.clamp((point.x - rect.x) / rect.w, .04, .96);
            active.strength = M.clamp(Math.abs(point.y - active.startY) / Math.max(46, rect.h * .13), 0, 1);
        }
        function finish(_, event, cancelled) {
            var id = event ? event.pointerId : 1, active = touches.get(id);
            if (!active) return;
            if (!cancelled) synthesize(active.index, Math.max(.14, active.strength), active.position, true);
            touches.delete(id);
        }
        function chord(audible) { [0, 2, 4].forEach(function (index, order) { synthesize(index, .72 - order * .08, [.2, .48, .73][order], audible); }); }
        function fadeVoices() {
            touches.clear();
            voices.forEach(function (voice) {
                try {
                    var now = voice.context.currentTime;
                    voice.gain.gain.cancelScheduledValues(now);
                    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
                    voice.gain.gain.linearRampToValueAtTime(0, now + .035);
                    voice.source.stop(now + .045);
                } catch (_) {}
            });
        }
        function stopVoices() {
            voices.forEach(function (voice) { try { voice.source.stop(); } catch (_) {} }); voices = [];
        }

        return {
            pointerDown: start,
            pointerMove: move,
            pointerUp: function (pointer, event) { finish(pointer, event, false); },
            pointerCancel: function (pointer, event) { finish(pointer, event, true); },
            cancelAll: fadeVoices,
            wheel: function (_, dy) { feedback = M.clamp(feedback - dy * .00001, .982, .9985); },
            action: function () { chord(true); },
            keyDown: function (event) {
                var keys = "asdfgh", index = keys.indexOf(event.key.toLowerCase());
                if (index >= 0) synthesize(index, .72, .22 + index * .11, true);
                if (event.key === "Enter") { chord(true); event.preventDefault(); }
            },
            demo: function (time) {
                var note = Math.floor(time * 1.35) % frequencies.length;
                if (note !== lastDemoNote) { lastDemoNote = note; synthesize(note, .72, .14 + (note % 4) * .22, false); }
            },
            update: function (dt) {
                for (var i = 0; i < energy.length; i += 1) { energy[i] *= Math.exp(-(1.35 + (1 - feedback) * 90) * dt); phase[i] += dt * frequencies[i] * TAU; }
                voices = voices.filter(function (voice) { return !voice.ended; });
                env.setMeter(Math.max.apply(null, energy));
                env.setState((lastFrequency ? lastFrequency.toFixed(2) + " HZ / " : "READY / ") + "FEEDBACK " + feedback.toFixed(4) + (lastDelay ? " / DELAY " + lastDelay : ""), "噪声激励进入 sampleRate / frequency 长度的循环延迟线与低通反馈");
            },
            draw: function () {
                begin(env, ctx, "#080709");
                var rect = stage();
                rounded(ctx, rect.x, rect.y, rect.w, rect.h, 24, "#100d10", "rgba(255,210,125,.15)");
                var activeByString = new Map();
                touches.forEach(function (touch) { activeByString.set(touch.index, touch); });
                frequencies.forEach(function (frequency, index) {
                    var y = stringY(index), active = activeByString.get(index), position = active ? active.position : pluckPosition[index] || .5;
                    ctx.beginPath();
                    var samples = env.mobile ? 70 : 120;
                    for (var sample = 0; sample <= samples; sample += 1) {
                        var t = sample / samples;
                        var envelope = t < position ? t / Math.max(.04, position) : (1 - t) / Math.max(.04, 1 - position);
                        var displacement;
                        if (active) displacement = (active.y - active.startY) * envelope;
                        else {
                            var fundamental = Math.sin(phase[index] + t * TAU * (2 + index * .42));
                            var harmonic = Math.sin(phase[index] * 1.97 + t * TAU * (5 + index)) * (position - .5) * 1.4;
                            displacement = (fundamental + harmonic) * energy[index] * 13 * Math.sin(t * Math.PI);
                        }
                        var x = rect.x + 24 + t * (rect.w - 48), py = y + displacement;
                        if (!sample) ctx.moveTo(x, py); else ctx.lineTo(x, py);
                    }
                    var palette = ["#ffb65f", "#ff837a", "#f46fc3", "#b881ff", "#75a9ff", "#62d9d1"];
                    ctx.strokeStyle = active || energy[index] > .04 ? palette[index] : "rgba(255,255,255,.25)";
                    ctx.lineWidth = active ? 3.4 : 1.6 + energy[index] * 2; ctx.stroke();
                    ctx.beginPath(); ctx.arc(rect.x + 24, y, 6, 0, TAU); ctx.fillStyle = palette[index]; ctx.fill();
                    ctx.beginPath(); ctx.arc(rect.x + rect.w - 24, y, 6, 0, TAU); ctx.fill();
                    mono(ctx, names[index] + "  " + frequency.toFixed(index ? 2 : 0) + " Hz", rect.x + rect.w - 30, y - 12, 6, active ? palette[index] : "rgba(255,255,255,.38)", "right");
                    if (active) {
                        var px = rect.x + 24 + active.position * (rect.w - 48);
                        ctx.setLineDash([4, 4]); ctx.strokeStyle = palette[index]; ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, active.y); ctx.stroke(); ctx.setLineDash([]);
                        mono(ctx, Math.round(active.strength * 100) + "% ENERGY", px, active.y + (active.y < y ? -13 : 13), 6, palette[index], "center");
                    }
                });
                var delayY = rect.y + rect.h - 17, cells = Math.min(48, Math.max(8, lastDelay || 28));
                for (var cell = 0; cell < cells; cell += 1) {
                    var alpha = .06 + .2 * Math.exp(-cell / Math.max(1, cells * .32));
                    ctx.fillStyle = "rgba(255,210,125," + alpha + ")"; ctx.fillRect(rect.x + 18 + cell / cells * (rect.w - 36), delayY, Math.max(1, (rect.w - 36) / cells - 1), 3);
                }
                mono(ctx, "FEEDBACK DELAY LINE", rect.x + 18, rect.y + 16, 7, "rgba(255,210,125,.48)");
            },
            destroy: stopVoices
        };
    });
}());
