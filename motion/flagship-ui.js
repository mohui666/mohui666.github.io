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
        if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, env.width, env.height);
        }
    }

    function hudMarkup(items) {
        return '<aside class="flagship-hud"><p>Interaction vocabulary</p><ul>' + items.map(function (item) {
            return '<li><kbd>' + item[0] + '</kbd><span>' + item[1] + '</span></li>';
        }).join("") + '</ul></aside>';
    }

    function addHud(env, items) {
        env.dom.innerHTML = hudMarkup(items);
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

    function springValue(value, velocity, target, stiffness, damping, dt) {
        return M.spring(value, velocity, target, stiffness, damping, Math.min(dt, .034));
    }

    /* 52 — Predictive Back ------------------------------------------------- */
    replace("predictive-back", function (env) {
        var ctx = context(env);
        var progress = 0;
        var target = 0;
        var velocity = 0;
        var dragging = false;
        var committed = false;
        var startX = 0;
        var startY = .5;
        var pivotY = .5;
        var thresholdPulse = 0;
        var crossed = false;
        var dragVelocity = 0;

        addHud(env, [
            ["EDGE DRAG", "从左边缘拉出真实的上一层页面"],
            ["RELEASE", "距离或速度越过阈值后提交返回"],
            ["ESC / R", "取消预览并复位导航栈"]
        ]);
        env.setAction("RESET NAVIGATION");

        function screenRect() {
            var width = env.mobile ? env.width - 26 : Math.min(610, env.width * .47);
            var height = env.mobile ? Math.min(570, env.height * .62) : Math.min(620, env.height * .74);
            return {
                x: env.mobile || env.preview ? (env.width - width) * .5 : env.width * .66 - width * .5,
                y: env.mobile ? Math.max(178, env.height * .2) : (env.height - height) * .5,
                w: width,
                h: height
            };
        }

        function drawAvatar(x, y, color, index) {
            ctx.beginPath();
            ctx.arc(x, y, 16, 0, TAU);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.fillStyle = "rgba(5,13,12,.72)";
            ctx.beginPath();
            ctx.arc(x - 5, y - 2, 2, 0, TAU);
            ctx.arc(x + 5, y - 2, 2, 0, TAU);
            ctx.fill();
            ctx.strokeStyle = "rgba(5,13,12,.58)";
            ctx.beginPath();
            ctx.arc(x, y + 2, 6, .25, Math.PI - .25);
            ctx.stroke();
            mono(ctx, "0" + (index + 1), x, y + 29, 7, "rgba(255,255,255,.34)", "center");
        }

        function drawDestination(rect, reveal) {
            ctx.save();
            var scale = .91 + reveal * .09;
            ctx.translate(rect.x + rect.w * .5, rect.y + rect.h * .5);
            ctx.scale(scale, scale);
            ctx.translate(-rect.w * .5, -rect.h * .5);
            rounded(ctx, 0, 0, rect.w, rect.h, 38, "#10231f", "rgba(183,243,107,.22)");
            ctx.save();
            M.roundedRect(ctx, 0, 0, rect.w, rect.h, 38);
            ctx.clip();
            var glow = ctx.createRadialGradient(rect.w * .72, rect.h * .16, 0, rect.w * .72, rect.h * .16, rect.w * .7);
            glow.addColorStop(0, "rgba(120,255,214,.18)");
            glow.addColorStop(1, "transparent");
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, rect.w, rect.h);
            label(ctx, "Good evening, Mohui", 32, 52, 21, "#f4fff5", "left", 820);
            mono(ctx, "THE STACK BENEATH", 32, 79, 9, "rgba(183,243,107,.76)");
            rounded(ctx, 28, 106, rect.w - 56, 112, 24, "rgba(183,243,107,.94)");
            label(ctx, "Continue exploring", 50, 144, 15, "#10231f", "left", 820);
            mono(ctx, "12 MOTION STUDIES SAVED", 50, 174, 8, "rgba(16,35,31,.62)");
            ctx.fillStyle = "rgba(16,35,31,.92)";
            ctx.beginPath(); ctx.arc(rect.w - 72, 162, 25, 0, TAU); ctx.fill();
            label(ctx, "→", rect.w - 72, 162, 18, "#b7f36b", "center", 700);
            for (var i = 0; i < 4; i += 1) {
                var y = 246 + i * 76;
                rounded(ctx, 28, y, rect.w - 56, 60, 18, i === 1 ? "rgba(120,255,214,.09)" : "rgba(255,255,255,.045)", "rgba(255,255,255,.055)");
                drawAvatar(58, y + 30, ["#78ffd6", "#b7f36b", "#ffbc73", "#9ca7ff"][i], i);
                label(ctx, ["Field notes", "Prototype review", "Material study", "Signal lab"][i], 88, y + 22, 12, "rgba(244,255,245,.88)", "left", 760);
                mono(ctx, ["18 MIN", "04 NEW", "ACTIVE", "2.4 KHZ"][i], 88, y + 41, 7, "rgba(244,255,245,.38)");
            }
            ctx.restore();
            ctx.restore();
        }

        function drawCurrent(rect) {
            var tx = progress * (rect.w + Math.max(70, env.width * .08));
            var lift = Math.sin(progress * Math.PI) * -7;
            var rotation = (pivotY - .5) * progress * .055;
            var radius = 18 + progress * 22;
            ctx.save();
            ctx.translate(rect.x + tx, rect.y + lift);
            ctx.translate(rect.w * .5, rect.h * .5);
            ctx.rotate(rotation);
            ctx.translate(-rect.w * .5, -rect.h * .5);
            ctx.shadowColor = "rgba(0,0,0," + (.35 + progress * .35) + ")";
            ctx.shadowBlur = 36 + progress * 42;
            ctx.shadowOffsetX = -progress * 16;
            rounded(ctx, 0, 0, rect.w, rect.h, radius, "#191720", "rgba(255,255,255,.15)");
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.save();
            M.roundedRect(ctx, 0, 0, rect.w, rect.h, radius);
            ctx.clip();
            var wash = ctx.createLinearGradient(0, 0, rect.w, rect.h);
            wash.addColorStop(0, "rgba(255,109,139,.14)");
            wash.addColorStop(.6, "transparent");
            wash.addColorStop(1, "rgba(130,105,255,.11)");
            ctx.fillStyle = wash;
            ctx.fillRect(0, 0, rect.w, rect.h);
            mono(ctx, "NOW PLAYING / 04:18", 30, 48, 8, "rgba(255,255,255,.48)");
            rounded(ctx, 28, 82, rect.w - 56, Math.min(245, rect.h * .39), 26, "#2c2636");
            var art = ctx.createRadialGradient(rect.w * .57, 148, 8, rect.w * .57, 148, rect.w * .42);
            art.addColorStop(0, "#ffb260");
            art.addColorStop(.25, "#f15089");
            art.addColorStop(.62, "#6a3b9d");
            art.addColorStop(1, "#211b31");
            ctx.fillStyle = art;
            ctx.fillRect(29, 83, rect.w - 58, Math.min(243, rect.h * .39) - 2);
            ctx.strokeStyle = "rgba(255,255,255,.22)";
            ctx.lineWidth = 1;
            for (var i = 0; i < 8; i += 1) {
                ctx.beginPath();
                ctx.arc(rect.w * .56, 160, 18 + i * 17, -.7, 2.8);
                ctx.stroke();
            }
            var base = Math.min(362, rect.h * .55);
            label(ctx, "Recursive Light", 30, base, 22, "#fff", "left", 840);
            mono(ctx, "MOHUI / MOTION FIELD", 30, base + 30, 8, "rgba(255,255,255,.4)");
            ctx.fillStyle = "rgba(255,255,255,.12)";
            ctx.fillRect(30, base + 66, rect.w - 60, 3);
            ctx.fillStyle = "#ff6d8b";
            ctx.fillRect(30, base + 66, (rect.w - 60) * .62, 3);
            for (var j = 0; j < 3; j += 1) {
                var cy = base + 122 + j * 52;
                ctx.beginPath(); ctx.arc(48 + j * 72, cy, 20, 0, TAU);
                ctx.fillStyle = j === 1 ? "#fff" : "rgba(255,255,255,.08)";
                ctx.fill();
                label(ctx, ["↶", "Ⅱ", "↷"][j], 48 + j * 72, cy, 14, j === 1 ? "#191720" : "#fff", "center", 760);
            }
            ctx.restore();
            ctx.restore();
        }

        function start(pointer) {
            if (pointer.x > .16 && !env.preview) return;
            dragging = true;
            committed = false;
            startX = pointer.x;
            startY = pointer.y;
            pivotY = pointer.y;
            target = progress;
            dragVelocity = 0;
        }

        return {
            pointerDown: start,
            pointerMove: function (pointer) {
                if (!dragging) return;
                pivotY = pointer.y;
                target = M.clamp((pointer.x - startX) / .7, 0, 1);
                dragVelocity = Math.max(pointer.vx, dragVelocity * .76);
                var over = target > .48 || dragVelocity > 1.05;
                if (over !== crossed) { crossed = over; thresholdPulse = 1; }
            },
            pointerUp: function (pointer) {
                if (!dragging) return;
                dragging = false;
                committed = target > .48 || Math.max(pointer.vx, dragVelocity) > 1.05;
                target = committed ? 1 : 0;
            },
            pointerCancel: function () { dragging = false; committed = false; target = 0; },
            action: function () { target = 0; committed = false; dragging = false; },
            keyDown: function (event) {
                if (event.key === "Escape" || event.key.toLowerCase() === "r") { target = 0; committed = false; }
                if (event.key === "ArrowRight" || event.key === "Enter") {
                    target = 1; committed = true;
                    if (event.key === "Enter") event.preventDefault();
                }
            },
            demo: function (_, cycle) {
                if (cycle < .08) start({ x: 0, y: .56 });
                if (cycle < 3.3) { dragging = true; target = M.smoothstep(.25, 3.15, cycle) * .78; pivotY = .52 + Math.sin(cycle * .9) * .12; }
                else if (dragging) { dragging = false; committed = true; target = 1; }
                if (cycle > 6.6) { committed = false; target = 0; }
            },
            update: function (dt) {
                var next = springValue(progress, velocity, target, dragging ? 88 : 34, dragging ? 15 : 9, dt);
                progress = M.clamp(next.value, -.02, 1.04);
                velocity = next.velocity;
                thresholdPulse *= Math.exp(-6 * dt);
                env.setMeter(M.clamp(progress, 0, 1));
                env.setState(dragging ? "PREDICT / " + Math.round(progress * 100) + "%" : committed ? "BACK COMMITTED" : "EDGE READY", "边缘拖动连续预览目标；速度和距离共同决定提交");
            },
            draw: function () {
                begin(env, ctx, "#07100f");
                var ambient = ctx.createRadialGradient(env.width * .7, env.height * .42, 0, env.width * .7, env.height * .42, env.width * .62);
                ambient.addColorStop(0, "rgba(72,188,147,.13)");
                ambient.addColorStop(1, "transparent");
                ctx.fillStyle = ambient;
                ctx.fillRect(0, 0, env.width, env.height);
                var rect = screenRect();
                drawDestination(rect, M.clamp(progress, 0, 1));
                drawCurrent(rect);
                var edgeHeight = Math.max(160, env.height * .38);
                var edgeY = pivotY * env.height - edgeHeight * .5;
                var edgeGlow = ctx.createLinearGradient(0, 0, 38 + progress * 26, 0);
                edgeGlow.addColorStop(0, "rgba(183,243,107,.95)");
                edgeGlow.addColorStop(1, "transparent");
                ctx.fillStyle = edgeGlow;
                ctx.fillRect(0, edgeY, 38 + progress * 26, edgeHeight);
                var thresholdX = rect.x + rect.w * .48;
                ctx.strokeStyle = "rgba(183,243,107," + (.18 + thresholdPulse * .6) + ")";
                ctx.setLineDash([5, 8]);
                ctx.beginPath(); ctx.moveTo(thresholdX, rect.y - 12); ctx.lineTo(thresholdX, rect.y + rect.h + 12); ctx.stroke();
                ctx.setLineDash([]);
                mono(ctx, crossed ? "RELEASE → COMMIT" : "KEEP PULLING", thresholdX, rect.y - 24, 8, crossed ? "#b7f36b" : "rgba(255,255,255,.35)", "center");
            }
        };
    });

    /* 56 — Semantic Zoom -------------------------------------------------- */
    replace("semantic-zoom", function (env) {
        var ctx = context(env);
        var zoom = 1;
        var targetZoom = 1;
        var zoomVelocity = 0;
        var camera = { x: 0, y: 0 };
        var targetCamera = { x: 0, y: 0 };
        var drag = null;
        var touches = new Map();
        var pinch = null;
        var pinchUsed = false;
        var focusIndex = -1;
        var rand = M.random(56017);
        var places = Array.from({ length: 48 }, function (_, index) {
            var angle = index * 2.399963 + rand() * .2;
            var radius = 90 + Math.sqrt(index) * 105;
            return {
                x: Math.cos(angle) * radius + (rand() - .5) * 60,
                y: Math.sin(angle) * radius * .72 + (rand() - .5) * 48,
                score: 48 + Math.floor(rand() * 51),
                kind: index % 4,
                name: ["Archive", "Studio", "Signal", "Commons"][index % 4] + " " + String(index + 1).padStart(2, "0")
            };
        });
        var regions = [
            { name: "NORTH COMMON", color: "#9fc1a8", points: [[-720,-530],[-40,-620],[80,-120],[-220,80],[-690,-40]] },
            { name: "EAST SIGNAL", color: "#e7a17e", points: [[80,-590],[720,-430],[650,100],[180,170],[-20,-100]] },
            { name: "SOUTH STUDIO", color: "#d8c878", points: [[-640,20],[-210,90],[70,610],[-570,520],[-760,210]] },
            { name: "FIELD ARCHIVE", color: "#95b8c8", points: [[-170,80],[190,170],[690,70],[650,560],[80,620]] }
        ];

        addHud(env, [
            ["WHEEL / PINCH", "以指针为焦点跨越三个语义层级"],
            ["DRAG", "平移地图；轻点地点会自动聚焦"],
            ["+ / − / 0", "缩放或返回区域总览"]
        ]);
        env.setAction("CHANGE SEMANTIC LEVEL");

        function baseScale() {
            return Math.min(env.width, env.height) / 1120;
        }

        function toScreen(x, y, useTarget) {
            var z = useTarget ? targetZoom : zoom;
            var cam = useTarget ? targetCamera : camera;
            var scale = baseScale() * z;
            return { x: env.width * .5 + (x - cam.x) * scale, y: env.height * .52 + (y - cam.y) * scale };
        }

        function toWorld(sx, sy, useTarget) {
            var z = useTarget ? targetZoom : zoom;
            var cam = useTarget ? targetCamera : camera;
            var scale = baseScale() * z;
            return { x: cam.x + (sx - env.width * .5) / scale, y: cam.y + (sy - env.height * .52) / scale };
        }

        function nearestPlace(pointer) {
            var point = pointerPixels(env, pointer);
            var best = -1;
            var distance = 46;
            places.forEach(function (place, index) {
                var screen = toScreen(place.x, place.y, false);
                var next = M.dist(point.x, point.y, screen.x, screen.y);
                if (next < distance) { distance = next; best = index; }
            });
            return best;
        }

        function beginPointer(pointer, event) {
            var pixels = pointerPixels(env, pointer);
            var id = event ? event.pointerId : 1;
            touches.set(id, pixels);
            drag = {
                id: id,
                x: pixels.x,
                y: pixels.y,
                cameraX: targetCamera.x,
                cameraY: targetCamera.y,
                moved: 0,
                started: env.time
            };
            if (touches.size === 2) {
                var values = Array.from(touches.values());
                pinch = { distance: M.dist(values[0].x, values[0].y, values[1].x, values[1].y), zoom: targetZoom };
                pinchUsed = true;
            }
        }

        function movePointer(pointer, event) {
            var pixels = pointerPixels(env, pointer);
            var id = event ? event.pointerId : 1;
            if (touches.has(id)) touches.set(id, pixels);
            if (touches.size >= 2) {
                var values = Array.from(touches.values());
                var distance = M.dist(values[0].x, values[0].y, values[1].x, values[1].y);
                if (!pinch) pinch = { distance: distance, zoom: targetZoom };
                targetZoom = M.clamp(pinch.zoom * distance / Math.max(24, pinch.distance), .55, 6.4);
                return;
            }
            if (!drag || drag.id !== id) return;
            var dx = pixels.x - drag.x;
            var dy = pixels.y - drag.y;
            drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
            var scale = baseScale() * targetZoom;
            targetCamera.x = drag.cameraX - dx / scale;
            targetCamera.y = drag.cameraY - dy / scale;
            focusIndex = -1;
        }

        function endPointer(pointer, event, cancelled) {
            var id = event ? event.pointerId : 1;
            var suppressClick = pinchUsed;
            touches.delete(id);
            pinch = null;
            if (!cancelled && !suppressClick && drag && drag.id === id && drag.moved < 9) {
                var index = nearestPlace(pointer);
                if (index >= 0) {
                    focusIndex = index;
                    targetCamera.x = places[index].x;
                    targetCamera.y = places[index].y;
                    targetZoom = 5.4;
                }
            }
            if (touches.size === 1) {
                var remaining = Array.from(touches.entries())[0];
                drag = { id: remaining[0], x: remaining[1].x, y: remaining[1].y, cameraX: targetCamera.x, cameraY: targetCamera.y, moved: 10, started: env.time };
            } else {
                drag = null;
            }
            if (touches.size === 0) pinchUsed = false;
        }

        function zoomAt(delta, pointer) {
            var pixels = pointerPixels(env, pointer);
            var before = toWorld(pixels.x, pixels.y, true);
            targetZoom = M.clamp(targetZoom * Math.exp(-delta * .0016), .55, 6.4);
            var scale = baseScale() * targetZoom;
            targetCamera.x = before.x - (pixels.x - env.width * .5) / scale;
            targetCamera.y = before.y - (pixels.y - env.height * .52) / scale;
        }

        function setLevel(level) {
            targetZoom = [0.78, 2.35, 5.4][level];
            if (level === 0) { targetCamera.x = 0; targetCamera.y = 0; focusIndex = -1; }
        }

        return {
            pointerDown: beginPointer,
            pointerMove: movePointer,
            pointerUp: endPointer,
            pointerCancel: function (pointer, event) { endPointer(pointer, event, true); },
            wheel: function (_, dy) { zoomAt(dy, env.pointer); },
            action: function () { setLevel(targetZoom < 1.45 ? 1 : targetZoom < 3.8 ? 2 : 0); },
            keyDown: function (event) {
                if (event.key === "+" || event.key === "=") zoomAt(-260, env.pointer);
                if (event.key === "-" || event.key === "_") zoomAt(260, env.pointer);
                if (event.key === "0" || event.key === "Escape") setLevel(0);
            },
            demo: function (time) {
                targetZoom = 2.8 + Math.sin(time * .45) * 2.15;
                targetCamera.x = Math.sin(time * .21) * 260;
                targetCamera.y = Math.cos(time * .17) * 190;
            },
            update: function (dt) {
                var next = springValue(zoom, zoomVelocity, targetZoom, 30, 10, dt);
                zoom = M.clamp(next.value, .5, 6.5);
                zoomVelocity = next.velocity;
                var follow = 1 - Math.exp(-9 * dt);
                camera.x += (targetCamera.x - camera.x) * follow;
                camera.y += (targetCamera.y - camera.y) * follow;
                var level = zoom < 1.45 ? 0 : zoom < 3.75 ? 1 : 2;
                env.setMeter((zoom - .55) / 5.85);
                env.setState(["REGIONS / 04", "PLACES / 48", focusIndex >= 0 ? "RECORD / " + places[focusIndex].name.toUpperCase() : "RECORDS / DETAIL"][level], "几何连续缩放，跨阈值后信息表示会重构");
            },
            draw: function () {
                begin(env, ctx, "#e9e6d8");
                ctx.fillStyle = "rgba(21,34,28,.055)";
                for (var gx = (env.width * .5 - camera.x * baseScale() * zoom) % 28; gx < env.width; gx += 28) {
                    for (var gy = (env.height * .52 - camera.y * baseScale() * zoom) % 28; gy < env.height; gy += 28) ctx.fillRect(gx, gy, 1, 1);
                }
                var level = zoom < 1.45 ? 0 : zoom < 3.75 ? 1 : 2;
                var macroAlpha = M.clamp(2.3 - zoom, 0, 1);
                regions.forEach(function (region) {
                    ctx.beginPath();
                    region.points.forEach(function (point, index) {
                        var screen = toScreen(point[0], point[1], false);
                        if (index === 0) ctx.moveTo(screen.x, screen.y); else ctx.lineTo(screen.x, screen.y);
                    });
                    ctx.closePath();
                    ctx.globalAlpha = .34 + macroAlpha * .36;
                    ctx.fillStyle = region.color;
                    ctx.fill();
                    ctx.globalAlpha = 1;
                    ctx.strokeStyle = "rgba(21,34,28,.2)";
                    ctx.lineWidth = 1.2;
                    ctx.stroke();
                    if (level === 0) {
                        var cx = region.points.reduce(function (sum, p) { return sum + p[0]; }, 0) / region.points.length;
                        var cy = region.points.reduce(function (sum, p) { return sum + p[1]; }, 0) / region.points.length;
                        var center = toScreen(cx, cy, false);
                        mono(ctx, region.name, center.x, center.y - 8, 9, "rgba(21,34,28,.72)", "center");
                        label(ctx, "12 places", center.x, center.y + 13, 9, "rgba(21,34,28,.48)", "center", 650);
                    }
                });
                if (level >= 1) {
                    ctx.strokeStyle = "rgba(21,34,28,.2)";
                    ctx.lineWidth = level === 1 ? 1.2 : .7;
                    for (var i = 1; i < places.length; i += 1) {
                        var from = toScreen(places[i - 1].x, places[i - 1].y, false);
                        var to = toScreen(places[i].x, places[i].y, false);
                        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
                        if (i > 4) {
                            var branch = toScreen(places[i - 4].x, places[i - 4].y, false);
                            ctx.beginPath(); ctx.moveTo(to.x, to.y); ctx.lineTo(branch.x, branch.y); ctx.stroke();
                        }
                    }
                }
                places.forEach(function (place, index) {
                    var point = toScreen(place.x, place.y, false);
                    if (point.x < -100 || point.x > env.width + 100 || point.y < -80 || point.y > env.height + 80) return;
                    if (level === 0) {
                        ctx.beginPath(); ctx.arc(point.x, point.y, 2.5 + place.score / 50, 0, TAU);
                        ctx.fillStyle = place.kind === 1 ? "#e15b3a" : "rgba(21,34,28,.58)";
                        ctx.fill();
                    } else if (level === 1) {
                        var radius = 5 + place.score / 24;
                        ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, TAU);
                        ctx.fillStyle = ["#156f4e", "#e15b3a", "#426f8d", "#8b7221"][place.kind];
                        ctx.fill();
                        if (zoom > 2.2 || index % 3 === 0) mono(ctx, place.name.toUpperCase(), point.x + radius + 5, point.y, 7, "rgba(21,34,28,.72)");
                    } else {
                        var cardW = env.mobile ? 92 : 112;
                        var cardH = env.mobile ? 42 : 50;
                        rounded(ctx, point.x - cardW * .5, point.y - cardH * .5, cardW, cardH, 8, index === focusIndex ? "#153f32" : "rgba(248,246,235,.95)", index === focusIndex ? "#153f32" : "rgba(21,34,28,.22)");
                        ctx.beginPath(); ctx.arc(point.x - cardW * .36, point.y, 7, 0, TAU);
                        ctx.fillStyle = ["#156f4e", "#e15b3a", "#426f8d", "#8b7221"][place.kind]; ctx.fill();
                        mono(ctx, place.name.toUpperCase(), point.x - cardW * .22, point.y - 8, 6, index === focusIndex ? "#f7f4e6" : "#15304a");
                        label(ctx, "score " + place.score, point.x - cardW * .22, point.y + 8, 8, index === focusIndex ? "rgba(247,244,230,.64)" : "rgba(21,34,28,.54)", "left", 650);
                    }
                });
                mono(ctx, "GEOMETRY × " + zoom.toFixed(2) + "  /  SEMANTIC L" + (level + 1), env.width - 22, env.height - 92, 8, "rgba(21,34,28,.48)", "right");
            }
        };
    });

    /* 61 — Marking Menu --------------------------------------------------- */
    replace("marking-menu", function (env) {
        var ctx = context(env);
        var active = false;
        var origin = { x: .42, y: .53 };
        var path = [];
        var hold = 0;
        var showMenu = false;
        var expertTraining = false;
        var first = -1;
        var second = 0;
        var lastCommand = "GESTURE READY";
        var commandLife = 0;
        var selectedToken = 0;
        var groups = [
            { name: "MOVE", sub: ["NUDGE", "THROW"], color: "#ff6f59" },
            { name: "LINK", sub: ["CONNECT", "UNLINK"], color: "#ffad68" },
            { name: "NOTE", sub: ["ANNOTATE", "PIN NOTE"], color: "#ffd27a" },
            { name: "LOCK", sub: ["FREEZE", "RELEASE"], color: "#d3f38b" },
            { name: "DELETE", sub: ["REMOVE", "ARCHIVE"], color: "#78e7c0" },
            { name: "COLOR", sub: ["RECOLOR", "INVERT"], color: "#70c8ff" },
            { name: "COPY", sub: ["CLONE", "MIRROR"], color: "#b99cff" },
            { name: "MORE", sub: ["EXPAND", "COLLAPSE"], color: "#ff89cb" }
        ];
        var tokens = Array.from({ length: 9 }, function (_, index) {
            return { x: .18 + (index % 3) * .18, y: .29 + Math.floor(index / 3) * .19, color: groups[index % 8].color, scale: 1, spin: 0, locked: false, life: 1 };
        });
        var bursts = [];

        addHud(env, [
            ["PRESS + HOLD", "停留后出现新手径向提示"],
            ["FLICK / TURN", "熟练模式可直接划出两段命令"],
            ["T / ESC", "切换训练环或取消当前笔画"]
        ]);
        env.setAction("NOVICE RING / AUTO");

        function sector(dx, dy) {
            return M.mod(Math.round(Math.atan2(dy, dx) / TAU * 8), 8);
        }

        function start(pointer) {
            active = true;
            origin = { x: pointer.x, y: pointer.y };
            path = [{ x: pointer.x, y: pointer.y }];
            hold = 0;
            showMenu = expertTraining;
            first = -1;
            second = 0;
            var best = 0;
            var distance = 99;
            tokens.forEach(function (token, index) {
                if (token.life <= 0) return;
                var next = M.dist(pointer.x, pointer.y, token.x, token.y);
                if (next < distance) { distance = next; best = index; }
            });
            selectedToken = best;
        }

        function move(pointer) {
            if (!active) return;
            path.push({ x: pointer.x, y: pointer.y });
            if (path.length > 140) path.shift();
            var dx = pointer.x - origin.x;
            var dy = pointer.y - origin.y;
            var radius = Math.hypot(dx * env.width, dy * env.height);
            if (radius > 36) first = sector(dx, dy);
            if (radius > 118 && path.length > 4) {
                var elbow = path[Math.max(1, Math.floor(path.length * .42))];
                var ax = elbow.x - origin.x;
                var ay = elbow.y - origin.y;
                var bx = pointer.x - elbow.x;
                var by = pointer.y - elbow.y;
                var turn = M.cross(ax, ay, bx, by);
                if (Math.abs(turn) > .0002) second = turn < 0 ? 1 : 0;
            }
        }

        function execute() {
            if (first < 0) return;
            var group = groups[first];
            lastCommand = group.sub[second];
            commandLife = 1;
            var token = tokens[selectedToken];
            token.color = group.color;
            token.spin += second ? -.9 : .9;
            token.scale = 1.55;
            if (group.name === "LOCK") token.locked = !token.locked;
            if (group.name === "DELETE") token.life = second ? .35 : 0;
            if (group.name === "COPY" && tokens.length < 15) tokens.push({ x: M.clamp(token.x + .08, .06, .94), y: M.clamp(token.y + .06, .08, .88), color: token.color, scale: .6, spin: -token.spin, locked: false, life: 1 });
            if (group.name === "MOVE" && !token.locked) { token.x = M.clamp(origin.x + (second ? -.08 : .08), .06, .94); token.y = M.clamp(origin.y - .08, .08, .88); }
            bursts.push({ x: origin.x, y: origin.y, color: group.color, life: 1 });
        }

        return {
            pointerDown: start,
            pointerMove: move,
            pointerUp: function () { if (!active) return; execute(); active = false; showMenu = false; },
            pointerCancel: function () { active = false; showMenu = false; path = []; first = -1; second = -1; },
            action: function () { expertTraining = !expertTraining; env.setAction(expertTraining ? "NOVICE RING / ON" : "NOVICE RING / AUTO"); },
            keyDown: function (event) {
                if (event.key.toLowerCase() === "t") expertTraining = !expertTraining;
                if (event.key === "Escape") { active = false; path = []; first = -1; }
            },
            demo: function (time, cycle) {
                var index = Math.floor(time / 8) % groups.length;
                if (cycle < .08) start({ x: .4, y: .55 });
                if (cycle < 3.5) {
                    active = true;
                    hold = cycle;
                    showMenu = cycle > .5;
                    var angle = index / 8 * TAU;
                    var bend = cycle > 2.1 ? (index % 2 ? .42 : -.42) : 0;
                    move({ x: origin.x + Math.cos(angle + bend) * M.smoothstep(.4, 3.2, cycle) * .22, y: origin.y + Math.sin(angle + bend) * M.smoothstep(.4, 3.2, cycle) * .22 });
                } else if (active) { execute(); active = false; }
            },
            update: function (dt) {
                if (active) {
                    hold += dt;
                    if (hold > .32) showMenu = true;
                }
                commandLife *= Math.exp(-2.2 * dt);
                tokens.forEach(function (token) {
                    token.scale += (1 - token.scale) * (1 - Math.exp(-8 * dt));
                    if (token.life > 0 && token.life < 1) token.life += dt * .22;
                });
                bursts.forEach(function (burst) { burst.life -= dt * .75; });
                bursts = bursts.filter(function (burst) { return burst.life > 0; });
                env.setMeter(active ? M.clamp(hold / .32, 0, 1) : commandLife);
                env.setState(active ? (showMenu ? "NOVICE RING / " + (first >= 0 ? groups[first].name : "HOLD") : "EXPERT STROKE") : lastCommand, "方向笔画选择命令；折线方向进入二级命令");
            },
            draw: function () {
                begin(env, ctx, "#170306");
                var glow = ctx.createRadialGradient(env.width * .42, env.height * .54, 0, env.width * .42, env.height * .54, env.width * .5);
                glow.addColorStop(0, "rgba(255,72,49,.11)");
                glow.addColorStop(1, "transparent");
                ctx.fillStyle = glow; ctx.fillRect(0, 0, env.width, env.height);
                ctx.strokeStyle = "rgba(255,255,255,.035)";
                for (var i = 0; i < 24; i += 1) {
                    ctx.beginPath(); ctx.moveTo(i / 23 * env.width, 0); ctx.lineTo(i / 23 * env.width, env.height); ctx.stroke();
                }
                tokens.forEach(function (token, index) {
                    if (token.life <= 0) return;
                    var x = token.x * env.width;
                    var y = token.y * env.height;
                    ctx.save(); ctx.translate(x, y); ctx.rotate(token.spin); ctx.scale(token.scale, token.scale); ctx.globalAlpha = token.life;
                    ctx.shadowColor = token.color; ctx.shadowBlur = index === selectedToken && active ? 28 : 10;
                    if (index % 3 === 0) {
                        rounded(ctx, -24, -24, 48, 48, 11, token.locked ? "rgba(255,255,255,.12)" : token.color, "rgba(255,255,255,.25)");
                    } else if (index % 3 === 1) {
                        ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.fillStyle = token.color; ctx.fill();
                    } else {
                        ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(26, 20); ctx.lineTo(-26, 20); ctx.closePath(); ctx.fillStyle = token.color; ctx.fill();
                    }
                    ctx.shadowBlur = 0;
                    if (token.locked) mono(ctx, "LOCK", 0, 38, 6, "rgba(255,255,255,.62)", "center");
                    ctx.restore();
                });
                bursts.forEach(function (burst) {
                    ctx.globalAlpha = burst.life;
                    ctx.strokeStyle = burst.color;
                    ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(burst.x * env.width, burst.y * env.height, (1 - burst.life) * 120 + 16, 0, TAU); ctx.stroke();
                    ctx.globalAlpha = 1;
                });
                if (active) {
                    var ox = origin.x * env.width;
                    var oy = origin.y * env.height;
                    if (showMenu) {
                        for (var g = 0; g < groups.length; g += 1) {
                            var angle = g / 8 * TAU;
                            var selected = g === first;
                            var radius = selected ? 104 : 88;
                            ctx.beginPath(); ctx.arc(ox + Math.cos(angle) * radius, oy + Math.sin(angle) * radius, selected ? 30 : 24, 0, TAU);
                            ctx.fillStyle = selected ? groups[g].color : "rgba(255,255,255,.065)"; ctx.fill();
                            ctx.strokeStyle = selected ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.14)"; ctx.stroke();
                            mono(ctx, groups[g].name, ox + Math.cos(angle) * radius, oy + Math.sin(angle) * radius, selected ? 8 : 7, selected ? "#210407" : "rgba(255,255,255,.68)", "center");
                        }
                        if (first >= 0) {
                            mono(ctx, groups[first].sub[second], ox, oy + 142, 10, groups[first].color, "center");
                            mono(ctx, second ? "TURN LEFT" : "TURN RIGHT", ox, oy + 160, 7, "rgba(255,255,255,.38)", "center");
                        }
                    }
                    if (path.length > 1) {
                        ctx.beginPath();
                        path.forEach(function (point, index) { if (index === 0) ctx.moveTo(point.x * env.width, point.y * env.height); else ctx.lineTo(point.x * env.width, point.y * env.height); });
                        ctx.strokeStyle = first >= 0 ? groups[first].color : "#fff";
                        ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
                    }
                    ctx.beginPath(); ctx.arc(ox, oy, 8, 0, TAU); ctx.fillStyle = "#fff"; ctx.fill();
                }
                if (commandLife > .02) {
                    ctx.globalAlpha = commandLife;
                    label(ctx, lastCommand, env.width * .5, env.height * .5, Math.min(96, env.width * .08), "#fff", "center", 900);
                    ctx.globalAlpha = 1;
                }
            }
        };
    });

    /* 76 — Voronoi Tessellation ------------------------------------------ */
    replace("voronoi-tessellation", function (env) {
        var ctx = context(env);
        var rand = M.random(76121);
        var points = [];
        var active = -1;
        var downAt = 0;
        var downPoint = null;
        var relaxing = false;
        var lastCells = [];
        var relaxFrame = 0;

        function seed(count) {
            points = Array.from({ length: count }, function (_, index) {
                return { x: .08 + rand() * .84, y: .09 + rand() * .8, hue: (index * 43 + rand() * 24) % 360 };
            });
        }
        seed(env.mobile ? 13 : 19);
        addHud(env, [
            ["TAP / DRAG", "添加新种子，或直接移动已有种子"],
            ["LONG PRESS", "长按一个种子后释放即可删除"],
            ["SPACE / R", "Lloyd 松弛，或重新生成点集"]
        ]);
        env.setAction("LLOYD RELAX / START");

        function worldPoints() {
            return points.map(function (point) { return { x: point.x * env.width, y: point.y * env.height, hue: point.hue }; });
        }

        function clipHalfPlane(poly, nx, ny, c) {
            var out = [];
            for (var i = 0; i < poly.length; i += 1) {
                var a = poly[i];
                var b = poly[(i + 1) % poly.length];
                var da = a.x * nx + a.y * ny - c;
                var db = b.x * nx + b.y * ny - c;
                if (da <= 0) out.push(a);
                if ((da <= 0) !== (db <= 0)) {
                    var t = da / (da - db);
                    out.push({ x: M.lerp(a.x, b.x, t), y: M.lerp(a.y, b.y, t) });
                }
            }
            return out;
        }

        function cells() {
            var world = worldPoints();
            return world.map(function (point, index) {
                var poly = [{x:0,y:0},{x:env.width,y:0},{x:env.width,y:env.height},{x:0,y:env.height}];
                for (var j = 0; j < world.length && poly.length; j += 1) {
                    if (j === index) continue;
                    var other = world[j];
                    var nx = other.x - point.x;
                    var ny = other.y - point.y;
                    var c = (other.x * other.x + other.y * other.y - point.x * point.x - point.y * point.y) * .5;
                    poly = clipHalfPlane(poly, nx, ny, c);
                }
                return poly;
            });
        }

        function centroid(poly) {
            var area = 0;
            var x = 0;
            var y = 0;
            for (var i = 0; i < poly.length; i += 1) {
                var a = poly[i];
                var b = poly[(i + 1) % poly.length];
                var cross = a.x * b.y - b.x * a.y;
                area += cross;
                x += (a.x + b.x) * cross;
                y += (a.y + b.y) * cross;
            }
            area *= .5;
            if (Math.abs(area) < .001) return poly[0] || { x: env.width * .5, y: env.height * .5 };
            return { x: x / (6 * area), y: y / (6 * area) };
        }

        function nearest(pointer) {
            var pixel = pointerPixels(env, pointer);
            var best = -1;
            var distance = 32;
            points.forEach(function (point, index) {
                var next = M.dist(pixel.x, pixel.y, point.x * env.width, point.y * env.height);
                if (next < distance) { distance = next; best = index; }
            });
            return best;
        }

        function reset() {
            seed(env.mobile ? 13 : 19);
            relaxing = false;
            env.setAction("LLOYD RELAX / START");
        }

        return {
            pointerDown: function (pointer, event) {
                active = nearest(pointer);
                downAt = env.time;
                downPoint = { x: pointer.x, y: pointer.y };
                if (event && event.detail > 1 && active >= 0 && points.length > 4) { points.splice(active, 1); active = -1; return; }
                if (active < 0) {
                    points.push({ x: pointer.x, y: pointer.y, hue: (points.length * 47 + env.time * 29) % 360 });
                    active = points.length - 1;
                }
            },
            pointerMove: function (pointer, event) {
                if (active < 0) return;
                if (event && event.shiftKey) {
                    points.forEach(function (point, index) {
                        if (index === active) return;
                        var dx = point.x - pointer.x;
                        var dy = point.y - pointer.y;
                        var d = Math.hypot(dx, dy);
                        if (d < .18 && d > .001) { point.x = M.clamp(point.x + dx / d * .006, .01, .99); point.y = M.clamp(point.y + dy / d * .006, .01, .99); }
                    });
                }
                points[active].x = M.clamp(pointer.x, .005, .995);
                points[active].y = M.clamp(pointer.y, .005, .995);
            },
            pointerUp: function (pointer) {
                if (active >= 0 && downPoint && env.time - downAt > .62 && M.dist(pointer.x, pointer.y, downPoint.x, downPoint.y) < .025 && points.length > 4) points.splice(active, 1);
                active = -1;
                downPoint = null;
            },
            pointerCancel: function () { active = -1; downPoint = null; },
            action: function () { relaxing = !relaxing; env.setAction(relaxing ? "LLOYD RELAX / STOP" : "LLOYD RELAX / START"); },
            keyDown: function (event) {
                if (event.key === " ") { relaxing = !relaxing; event.preventDefault(); }
                if (event.key.toLowerCase() === "r") reset();
                if ((event.key === "Delete" || event.key === "Backspace") && active >= 0 && points.length > 4) {
                    points.splice(active, 1);
                    active = -1;
                    downPoint = null;
                }
            },
            demo: function (time) {
                if (!points.length) reset();
                points[0].x = .5 + Math.sin(time * .51) * .36;
                points[0].y = .5 + Math.cos(time * .43) * .31;
                points[1].x = .5 + Math.cos(time * .34) * .24;
                points[1].y = .5 + Math.sin(time * .39) * .38;
                relaxing = Math.sin(time * .18) > .2;
            },
            update: function () {
                lastCells = cells();
                if (relaxing && ++relaxFrame % 2 === 0) {
                    lastCells.forEach(function (poly, index) {
                        var center = centroid(poly);
                        points[index].x += (center.x / env.width - points[index].x) * .035;
                        points[index].y += (center.y / env.height - points[index].y) * .035;
                    });
                }
                env.setMeter(M.clamp(points.length / 32, 0, 1));
                env.setState(points.length + " SITES / " + (relaxing ? "LLOYD RELAXING" : "DIRECT MANIPULATION"), "拖动改变最近点半平面；长按删除，空白处点按添加");
            },
            draw: function () {
                begin(env, ctx, "#ede7d9");
                var pixel = pointerPixels(env, env.pointer);
                lastCells.forEach(function (poly, index) {
                    if (!poly.length) return;
                    ctx.beginPath();
                    poly.forEach(function (point, pointIndex) { if (pointIndex === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y); });
                    ctx.closePath();
                    var site = points[index];
                    var sx = site.x * env.width;
                    var sy = site.y * env.height;
                    var distance = M.dist(pixel.x, pixel.y, sx, sy);
                    var lightness = 52 + 16 * Math.exp(-distance / 180);
                    ctx.fillStyle = "hsl(" + site.hue.toFixed(0) + " 58% " + lightness.toFixed(0) + "% / .76)";
                    ctx.fill();
                    ctx.strokeStyle = "rgba(31,27,23,.72)";
                    ctx.lineWidth = index === active ? 4 : 1.5;
                    ctx.stroke();
                    var shine = ctx.createRadialGradient(sx - 18, sy - 22, 0, sx, sy, 110);
                    shine.addColorStop(0, "rgba(255,255,255,.42)");
                    shine.addColorStop(1, "transparent");
                    ctx.fillStyle = shine;
                    ctx.fill();
                });
                points.forEach(function (point, index) {
                    var x = point.x * env.width;
                    var y = point.y * env.height;
                    ctx.beginPath(); ctx.arc(x, y, index === active ? 8 : 4.5, 0, TAU);
                    ctx.fillStyle = index === active ? "#fff" : "#1d1a17"; ctx.fill();
                    ctx.strokeStyle = index === active ? "#1d1a17" : "rgba(255,255,255,.72)"; ctx.stroke();
                });
                mono(ctx, relaxing ? "CENTROID RELAXATION ACTIVE" : "NEAREST-SITE PARTITION", env.width - 20, env.height - 94, 8, "rgba(29,26,23,.58)", "right");
            }
        };
    });

    /* 88 — SVG Diffuse / Specular Lighting ------------------------------- */
    replace("svg-lighting-filter", function (env) {
        var ctx = context(env);
        var light = { x: .72, y: .32 };
        var target = { x: .72, y: .32 };
        var surfaceScale = 8;
        var exponent = 22;
        var material = 0;
        var materials = [
            { name: "LIQUID METAL", word: "TOUCH", fill: "#b7bec8", stroke: "#f8fbff", diffuse: "#ffbe67", specular: "#d9f7ff", base: "#16171a" },
            { name: "CHROMATIC GEL", word: "BEND", fill: "#6c3eff", stroke: "#ff9ce7", diffuse: "#ff4fc8", specular: "#8be8ff", base: "#120b25" },
            { name: "CARVED STONE", word: "DEPTH", fill: "#9c8d72", stroke: "#ead8b4", diffuse: "#d2aa72", specular: "#fff2cf", base: "#17130e" }
        ];
        var pressed = 0;

        env.dom.innerHTML = '<svg class="svg-lighting-canvas" data-light-svg role="presentation" preserveAspectRatio="none">' +
            '<defs><filter id="flagship-light" x="-20%" y="-30%" width="140%" height="170%" color-interpolation-filters="sRGB">' +
            '<feGaussianBlur in="SourceAlpha" stdDeviation="2.3" result="heightMap"/>' +
            '<feDiffuseLighting in="heightMap" surfaceScale="8" diffuseConstant="1.2" lighting-color="#ffbe67" result="diffuse" data-diffuse><fePointLight x="700" y="260" z="130" data-light-a/></feDiffuseLighting>' +
            '<feSpecularLighting in="heightMap" surfaceScale="8" specularConstant="1.45" specularExponent="22" lighting-color="#d9f7ff" result="specular" data-specular><fePointLight x="700" y="260" z="130" data-light-b/></feSpecularLighting>' +
            '<feComposite in="specular" in2="SourceAlpha" operator="in" result="specularCut"/>' +
            '<feBlend in="SourceGraphic" in2="diffuse" mode="multiply" result="lit"/>' +
            '<feBlend in="lit" in2="specularCut" mode="screen"/></filter>' +
            '<radialGradient id="light-bg" cx="70%" cy="30%" r="72%"><stop offset="0" stop-color="#2a2015"/><stop offset=".48" stop-color="#0c0c0b"/><stop offset="1" stop-color="#050505"/></radialGradient></defs>' +
            '<rect width="100%" height="100%" fill="url(#light-bg)" data-light-bg/>' +
            '<g filter="url(#flagship-light)" data-material-group>' +
            '<text x="50%" y="57%" text-anchor="middle" class="svg-lighting-word" data-light-word>TOUCH</text>' +
            '<rect x="8%" y="73%" width="84%" height="8" rx="4" class="svg-lighting-ridge"/>' +
            '<rect x="20%" y="77%" width="60%" height="5" rx="2.5" class="svg-lighting-ridge" opacity=".62"/>' +
            '</g><circle r="9" fill="#fff" opacity=".95" data-light-orb/><circle r="32" fill="none" stroke="#fff" opacity=".2" data-light-ring/></svg>' + hudMarkup([
                ["MOVE / DRAG", "移动 SVG 点光源并重建法线光照"],
                ["WHEEL", "改变高度场 surfaceScale"],
                ["1 / 2 / 3", "切换金属、凝胶与石材参数"]
            ]);
        var svg = env.dom.querySelector("[data-light-svg]");
        var word = env.dom.querySelector("[data-light-word]");
        var group = env.dom.querySelector("[data-material-group]");
        var background = env.dom.querySelector("[data-light-bg]");
        var diffuse = env.dom.querySelector("[data-diffuse]");
        var specular = env.dom.querySelector("[data-specular]");
        var lightA = env.dom.querySelector("[data-light-a]");
        var lightB = env.dom.querySelector("[data-light-b]");
        var orb = env.dom.querySelector("[data-light-orb]");
        var ring = env.dom.querySelector("[data-light-ring]");
        var ridges = env.dom.querySelectorAll(".svg-lighting-ridge");
        env.setAction("NEXT MATERIAL");

        function applyMaterial() {
            var value = materials[material];
            word.textContent = value.word;
            word.style.fill = value.fill;
            word.style.stroke = value.stroke;
            word.style.strokeWidth = material === 2 ? "3" : "1.4";
            word.style.paintOrder = "stroke fill";
            ridges.forEach(function (ridge) { ridge.style.fill = value.fill; ridge.style.stroke = value.stroke; });
            diffuse.setAttribute("lighting-color", value.diffuse);
            specular.setAttribute("lighting-color", value.specular);
            background.setAttribute("fill", value.base);
            group.style.filter = material === 1 ? "url(#flagship-light) saturate(1.35)" : "url(#flagship-light)";
        }
        applyMaterial();

        function setLight(pointer) { target.x = pointer.x; target.y = pointer.y; }

        return {
            resize: function (width, height) {
                svg.setAttribute("viewBox", "0 0 " + width + " " + height);
                word.setAttribute("x", width * .53);
                word.setAttribute("y", height * .56);
                word.style.fontSize = Math.min(width * .18, height * .28) + "px";
            },
            pointerDown: function (pointer) { setLight(pointer); pressed = 1; },
            pointerMove: setLight,
            pointerUp: function () { pressed = 0; },
            pointerCancel: function () { pressed = 0; },
            wheel: function (_, dy) { surfaceScale = M.clamp(surfaceScale - dy * .018, 2, 18); exponent = M.clamp(10 + surfaceScale * 1.8, 10, 42); },
            action: function () { material = (material + 1) % materials.length; applyMaterial(); },
            keyDown: function (event) {
                var index = Number(event.key) - 1;
                if (index >= 0 && index < materials.length) { material = index; applyMaterial(); }
                if (event.key === "ArrowUp") surfaceScale = M.clamp(surfaceScale + 1, 2, 18);
                if (event.key === "ArrowDown") surfaceScale = M.clamp(surfaceScale - 1, 2, 18);
            },
            demo: function (time) {
                target.x = .56 + Math.cos(time * .61) * .32;
                target.y = .48 + Math.sin(time * .77) * .31;
                surfaceScale = 7.5 + Math.sin(time * .33) * 3.5;
                if (Math.floor(time / 7) % materials.length !== material) { material = Math.floor(time / 7) % materials.length; applyMaterial(); }
            },
            update: function (dt) {
                var follow = 1 - Math.exp(-10 * dt);
                light.x += (target.x - light.x) * follow;
                light.y += (target.y - light.y) * follow;
                pressed *= Math.exp(-3 * dt);
                var x = light.x * env.width;
                var y = light.y * env.height;
                var z = 82 + surfaceScale * 8 + pressed * 34;
                [lightA, lightB].forEach(function (node) { node.setAttribute("x", x); node.setAttribute("y", y); node.setAttribute("z", z); });
                diffuse.setAttribute("surfaceScale", surfaceScale.toFixed(2));
                specular.setAttribute("surfaceScale", surfaceScale.toFixed(2));
                specular.setAttribute("specularExponent", exponent.toFixed(1));
                orb.setAttribute("cx", x); orb.setAttribute("cy", y);
                ring.setAttribute("cx", x); ring.setAttribute("cy", y); ring.setAttribute("r", 26 + surfaceScale * 1.4);
                env.setMeter((surfaceScale - 2) / 16);
                env.setState(materials[material].name + " / SCALE " + surfaceScale.toFixed(1), "feDiffuseLighting + feSpecularLighting 使用同一移动点光源");
            },
            draw: function () { begin(env, ctx); }
        };
    });

    /* 98 — Recursive Portal Rendering ------------------------------------ */
    replace("recursive-portal-rendering", function (env) {
        var ctx = context(env);
        var yaw = 0;
        var pitch = 0;
        var targetYaw = 0;
        var targetPitch = 0;
        var depth = 0;
        var targetDepth = 0;
        var dragging = false;
        var dragStart = null;
        var moved = 0;
        var spin = 0;
        var targetSpin = 0;
        var teleportCount = 0;
        var pulse = 0;

        addHud(env, [
            ["DRAG", "环视相机并改变递归裁剪透视"],
            ["WHEEL / TAP", "推进门面；点按门内执行穿越"],
            ["ARROWS / ENTER", "精确旋转或立即传送"]
        ]);
        env.setAction("ROTATE PORTAL PAIR");

        function portalCenter() {
            var width = env.mobile ? Math.min(env.width * .72, 360) : Math.min(env.width * .34, 470);
            var height = Math.min(env.height * .61, width * 1.34);
            return {
                x: env.mobile || env.preview ? env.width * .5 : env.width * .68,
                y: env.mobile ? env.height * .55 : env.height * .48,
                w: width,
                h: height
            };
        }

        function teleport() {
            teleportCount += 1;
            pulse = 1;
            targetDepth = 0;
            depth = -.18;
            targetSpin += Math.PI * .5;
        }

        function portalTransform() {
            var portal = portalCenter();
            return {
                x: portal.x + yaw * 42,
                y: portal.y + pitch * 26,
                w: portal.w,
                h: portal.h,
                scale: 1 + depth * .12 + pulse * .08,
                rotation: spin * .22
            };
        }

        function hitPortal(pointer) {
            var pixel = pointerPixels(env, pointer);
            var transform = portalTransform();
            var dx = pixel.x - transform.x;
            var dy = pixel.y - transform.y;
            var cosine = Math.cos(transform.rotation);
            var sine = Math.sin(transform.rotation);
            var localX = (dx * cosine + dy * sine) / transform.scale;
            var localY = (-dx * sine + dy * cosine) / transform.scale;
            return Math.abs(localX) <= transform.w * .5 && Math.abs(localY) <= transform.h * .5;
        }

        function drawCorridor(vx, vy) {
            var horizon = env.height * (.44 + pitch * .07);
            var vanishX = env.width * .5 + yaw * env.width * .18;
            var gradient = ctx.createLinearGradient(0, 0, 0, env.height);
            gradient.addColorStop(0, "#08062b");
            gradient.addColorStop(.52, "#09051c");
            gradient.addColorStop(1, "#02020a");
            ctx.fillStyle = gradient; ctx.fillRect(0, 0, env.width, env.height);
            ctx.strokeStyle = "rgba(111,231,255,.12)";
            ctx.lineWidth = 1;
            for (var i = -12; i <= 12; i += 1) {
                ctx.beginPath(); ctx.moveTo(vanishX, horizon); ctx.lineTo(env.width * .5 + i * env.width * .09, env.height); ctx.stroke();
            }
            for (var z = 0; z < 14; z += 1) {
                var phase = M.mod(z / 14 + depth * .13, 1);
                var eased = phase * phase;
                var y = horizon + eased * (env.height - horizon);
                ctx.globalAlpha = .12 + eased * .36;
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(env.width, y); ctx.stroke();
            }
            ctx.globalAlpha = 1;
            var ceiling = ctx.createRadialGradient(vanishX, horizon, 0, vanishX, horizon, env.width * .62);
            ceiling.addColorStop(0, "rgba(255,141,255,.11)");
            ceiling.addColorStop(1, "transparent");
            ctx.fillStyle = ceiling; ctx.fillRect(0, 0, env.width, env.height);
            mono(ctx, "CAMERA  YAW " + (yaw * 38).toFixed(1) + "°  /  DEPTH " + depth.toFixed(2), 22, env.height - 96, 8, "rgba(188,215,255,.45)");
        }

        function throughPortal(pose, level) {
            var entryAngle = spin + (level % 2 ? Math.PI : 0);
            var exitAngle = spin + Math.PI * .72 + (level % 2 ? 0 : Math.PI);
            var delta = exitAngle - entryAngle + Math.PI;
            var cosine = Math.cos(delta);
            var sine = Math.sin(delta);
            return {
                x: pose.x * cosine - pose.z * sine + Math.sin(exitAngle) * .48,
                z: pose.x * sine + pose.z * cosine + Math.cos(exitAngle) * .48 + .7,
                yaw: pose.yaw + delta
            };
        }

        function drawPortalView(width, height, pose, level) {
            var hueShift = teleportCount * 38 + level * 17;
            var fill = ctx.createLinearGradient(-width * .5, -height * .5, width * .5, height * .5);
            fill.addColorStop(0, "hsl(" + (280 + hueShift) + " 70% 9%)");
            fill.addColorStop(.5, "hsl(" + (215 + hueShift) + " 74% 14%)");
            fill.addColorStop(1, "hsl(" + (320 + hueShift) + " 72% 8%)");
            ctx.fillStyle = fill; ctx.fillRect(-width * .5, -height * .5, width, height);
            var vanishX = M.clamp(-pose.x * width * .13 + Math.sin(pose.yaw) * width * .16, -width * .28, width * .28);
            var horizon = M.clamp(-height * .12 + Math.cos(pose.yaw * .5) * height * .035, -height * .2, -height * .03);
            ctx.strokeStyle = "rgba(255,255,255,.12)";
            for (var i = -5; i <= 5; i += 1) {
                ctx.beginPath(); ctx.moveTo(vanishX, horizon); ctx.lineTo(i * width * .18 - pose.x * width * .025, height * .62); ctx.stroke();
            }
            for (var row = 0; row < 7; row += 1) {
                var phase = M.mod(row / 7 + pose.z * .08, 1);
                var y = horizon + Math.pow(phase, 1.8) * height * .74;
                ctx.beginPath(); ctx.moveTo(-width * .5, y); ctx.lineTo(width * .5, y); ctx.stroke();
            }
            for (var marker = 0; marker < 6; marker += 1) {
                var distance = M.mod(marker / 6 + pose.z * .065 + level * .09, 1);
                var spread = .12 + distance * .88;
                var markerX = vanishX * (1 - distance) + (((marker % 2 ? 1 : -1) * (.18 + Math.floor(marker / 2) * .11)) - pose.x * .025) * width * spread;
                var markerY = horizon + distance * distance * height * .68;
                var markerHeight = height * (.035 + distance * .15);
                ctx.fillStyle = marker % 2 ? "rgba(255,141,255,.22)" : "rgba(110,231,255,.2)";
                ctx.fillRect(markerX - width * .008 * spread, markerY - markerHeight, width * .016 * spread, markerHeight);
            }
        }

        function drawPortalLayer(width, height, level, maxLevel, pose) {
            var layerRotation = spin * (level % 2 ? -.32 : .22) + Math.sin(level * 1.7) * .018;
            ctx.save();
            ctx.rotate(layerRotation);
            M.roundedRect(ctx, -width * .5, -height * .5, width, height, Math.max(12, width * .1));
            ctx.clip();
            drawPortalView(width, height, pose, level);
            if (level < maxLevel) {
                var nextPose = throughPortal(pose, level);
                ctx.save();
                ctx.translate(Math.sin(nextPose.yaw) * width * .04 - nextPose.x * width * .018, Math.cos(nextPose.yaw) * height * .022 + M.mod(nextPose.z, 1) * height * .03);
                ctx.scale(.64, .64);
                drawPortalLayer(width, height, level + 1, maxLevel, nextPose);
                ctx.restore();
            }
            ctx.restore();
            ctx.save();
            ctx.rotate(layerRotation);
            ctx.shadowColor = level % 2 ? "#ff8dff" : "#6ee7ff";
            ctx.shadowBlur = 22 - level * 2;
            ctx.strokeStyle = level % 2 ? "rgba(255,141,255,.88)" : "rgba(110,231,255,.88)";
            ctx.lineWidth = Math.max(2, 8 - level * .7);
            M.roundedRect(ctx, -width * .5, -height * .5, width, height, Math.max(12, width * .1));
            ctx.stroke();
            ctx.restore();
        }

        return {
            pointerDown: function (pointer) { dragging = true; dragStart = { x: pointer.x, y: pointer.y, yaw: targetYaw, pitch: targetPitch }; moved = 0; },
            pointerMove: function (pointer) {
                if (!dragging || !dragStart) return;
                var dx = pointer.x - dragStart.x;
                var dy = pointer.y - dragStart.y;
                moved = Math.max(moved, Math.hypot(dx, dy));
                targetYaw = M.clamp(dragStart.yaw + dx * 2.2, -1, 1);
                targetPitch = M.clamp(dragStart.pitch + dy * 1.7, -.72, .72);
            },
            pointerUp: function (pointer) {
                if (!dragging) return;
                dragging = false;
                if (moved < .025 && hitPortal(pointer)) teleport();
            },
            pointerCancel: function () { dragging = false; dragStart = null; moved = 0; },
            wheel: function (_, dy) {
                targetDepth += dy * -.0022;
                if (targetDepth > 1 || targetDepth < -1) teleport();
                targetDepth = M.clamp(targetDepth, -.9, .9);
            },
            action: function () { targetSpin += Math.PI * .5; },
            keyDown: function (event) {
                if (event.key === "ArrowLeft") targetYaw -= .12;
                if (event.key === "ArrowRight") targetYaw += .12;
                if (event.key === "ArrowUp") targetPitch -= .1;
                if (event.key === "ArrowDown") targetPitch += .1;
                if (event.key === "Enter" || event.key === " ") { teleport(); event.preventDefault(); }
                if (event.key.toLowerCase() === "r") { targetYaw = 0; targetPitch = 0; targetDepth = 0; }
            },
            demo: function (time, cycle) {
                targetYaw = Math.sin(time * .31) * .42;
                targetPitch = Math.cos(time * .27) * .18;
                targetDepth = Math.sin(time * .48) * .78;
                if (cycle < .04) targetSpin += Math.PI * .5;
            },
            update: function (dt) {
                var follow = 1 - Math.exp(-7 * dt);
                yaw += (targetYaw - yaw) * follow;
                pitch += (targetPitch - pitch) * follow;
                depth += (targetDepth - depth) * follow;
                spin += (targetSpin - spin) * (1 - Math.exp(-5 * dt));
                pulse *= Math.exp(-3.4 * dt);
                env.setMeter((depth + 1) * .5);
                env.setState("RECURSION " + (env.mobile ? 5 : 8) + " / PORTALS " + teleportCount, "相机姿态经门对变换递归映射，并在每层门面裁剪");
            },
            draw: function () {
                begin(env, ctx, "#050416");
                drawCorridor(yaw, pitch);
                var transform = portalTransform();
                var pose = { x: yaw * .7, z: depth * .9, yaw: yaw * .8 + spin * .1 };
                ctx.save();
                ctx.translate(transform.x, transform.y);
                ctx.scale(transform.scale, transform.scale);
                drawPortalLayer(transform.w, transform.h, 0, env.mobile || env.preview ? 5 : 8, pose);
                ctx.restore();
                if (pulse > .01) {
                    ctx.strokeStyle = "rgba(255,255,255," + pulse + ")";
                    ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(transform.x, transform.y, (1 - pulse) * Math.max(env.width, env.height), 0, TAU); ctx.stroke();
                }
            }
        };
    });
}());
