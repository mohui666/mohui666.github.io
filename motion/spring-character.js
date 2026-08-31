(function () {
    "use strict";

    var Motion = window.MotionExtended;
    var h = Motion.helpers;
    var TAU = Math.PI * 2;

    function Spring(value, frequency, damping) {
        this.value = value;
        this.velocity = 0;
        this.target = value;
        this.frequency = frequency;
        this.damping = damping;
    }

    Spring.prototype.step = function (delta) {
        var remaining = Math.min(0.05, delta / 1000);
        var omega = TAU * this.frequency;
        while (remaining > 0) {
            var dt = Math.min(1 / 120, remaining);
            var acceleration = (this.target - this.value) * omega * omega - 2 * this.damping * omega * this.velocity;
            this.velocity += acceleration * dt;
            this.value += this.velocity * dt;
            remaining -= dt;
        }
        return this.value;
    };

    Spring.prototype.snap = function () {
        this.value = this.target;
        this.velocity = 0;
        return this.value;
    };

    function springCreature(api) {
        var ctx = api.useCanvas("#050817");
        var pointCount = 24;
        var bodyRadii = Array.from({ length: pointCount }, function () { return new Spring(1, 2.6, 0.7); });
        var bodyX = new Spring(0.63, 1.9, 0.72);
        var bodyY = new Spring(0.52, 1.9, 0.72);
        var squashX = new Spring(1, 2.8, 0.58);
        var squashY = new Spring(1, 2.8, 0.58);
        var rotation = new Spring(0, 2.2, 0.68);
        var eyeOpen = new Spring(1, 5.2, 0.72);
        var smile = new Spring(0.18, 3.1, 0.78);
        var glow = new Spring(0.34, 2.4, 0.7);
        var gazeX = new Spring(0, 3.6, 0.82);
        var gazeY = new Spring(0, 3.6, 0.82);
        var press = new Spring(0, 3.8, 0.66);
        var particles = [];
        var stateIndex = 0;
        var stateStarted = performance.now();
        var blinkAt = performance.now() + 1700;
        var blinking = false;
        var lastPointerMove = 0;
        var seed = 0x45c0ffee;
        var dragging = false;

        var states = [
            { id: "IDLE", label: "IDLE / BREATHING", color: "#7dd3fc", edge: "#dbeafe", shape: "round", eye: 1, mouth: 0.18, glow: 0.34 },
            { id: "CURIOUS", label: "CURIOUS / LISTENING", color: "#a5b4fc", edge: "#ede9fe", shape: "ears", eye: 1.1, mouth: 0.04, glow: 0.5 },
            { id: "FOCUS", label: "FOCUS / PROCESSING", color: "#22d3ee", edge: "#cffafe", shape: "focus", eye: 0.72, mouth: -0.08, glow: 0.62 },
            { id: "DELIGHT", label: "DELIGHT / SPARK", color: "#f0abfc", edge: "#fae8ff", shape: "petal", eye: 0.9, mouth: 0.92, glow: 0.9 },
            { id: "SLEEP", label: "SLEEP / DRIFT", color: "#818cf8", edge: "#e0e7ff", shape: "puddle", eye: 0.12, mouth: 0.02, glow: 0.18 },
            { id: "ALERT", label: "ALERT / SIGNAL", color: "#fb7185", edge: "#ffe4e6", shape: "diamond", eye: 1.25, mouth: -0.62, glow: 0.78 }
        ];

        function random() {
            seed ^= seed << 13;
            seed ^= seed >>> 17;
            seed ^= seed << 5;
            return (seed >>> 0) / 4294967296;
        }

        function state() { return states[stateIndex]; }

        function targetRadius(kind, angle, index) {
            var top = Math.sin(angle);
            if (kind === "ears") {
                var leftEar = Math.exp(-Math.pow((angle - 4.08) / 0.22, 2)) * 0.38;
                var rightEar = Math.exp(-Math.pow((angle - 5.34) / 0.22, 2)) * 0.38;
                return 0.98 + leftEar + rightEar + Math.sin(angle * 3) * 0.025;
            }
            if (kind === "focus") return 1 + Math.cos(angle * 2) * -0.11 + Math.sin(angle * 4) * 0.026;
            if (kind === "petal") return 0.96 + Math.cos(angle * 6) * 0.12 + Math.sin(angle * 3) * 0.035;
            if (kind === "puddle") return 1 + top * -0.12 + Math.cos(angle * 2) * 0.1;
            if (kind === "diamond") return 0.88 + Math.pow(Math.abs(Math.cos(angle * 2)), 5) * 0.2;
            return 1 + Math.sin(index * 2.17) * 0.018 + Math.cos(angle * 3) * 0.014;
        }

        function applyState(nextIndex, burst) {
            stateIndex = (nextIndex + states.length) % states.length;
            stateStarted = performance.now();
            var active = state();
            bodyRadii.forEach(function (radius, index) {
                radius.target = targetRadius(active.shape, index / pointCount * TAU, index);
            });
            smile.target = active.mouth;
            glow.target = active.glow;
            eyeOpen.target = active.eye;
            api.setState(active.label);
            api.setAction("NEXT MOOD");
            if (burst || active.id === "DELIGHT") emitBurst(active.color, burst ? 54 : 28);
        }

        function emitBurst(color, amount) {
            var x = bodyX.value * api.size.width;
            var y = bodyY.value * api.size.height;
            for (var index = 0; index < amount; index += 1) {
                var angle = random() * TAU;
                var speed = 55 + random() * 180;
                particles.push({
                    x: x,
                    y: y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 0.7 + random() * 0.7,
                    age: 0,
                    size: 1.5 + random() * 4.5,
                    color: color,
                    spin: random() * TAU
                });
            }
        }

        function drawBackground(now, width, height) {
            var t = now * 0.0002;
            ctx.fillStyle = "#050817";
            ctx.fillRect(0, 0, width, height);

            var wash = ctx.createRadialGradient(width * 0.64, height * 0.52, 0, width * 0.64, height * 0.52, Math.max(width, height) * 0.58);
            wash.addColorStop(0, "rgba(74, 132, 255," + (0.12 + glow.value * 0.08) + ")");
            wash.addColorStop(0.48, "rgba(90, 48, 180,0.055)");
            wash.addColorStop(1, "rgba(5,8,23,0)");
            ctx.fillStyle = wash;
            ctx.fillRect(0, 0, width, height);

            ctx.lineWidth = 1;
            ctx.strokeStyle = "rgba(180,210,255,0.075)";
            for (var ring = 1; ring <= 4; ring += 1) {
                ctx.beginPath();
                ctx.ellipse(width * 0.64, height * 0.53, ring * Math.min(width, height) * 0.14, ring * Math.min(width, height) * 0.085, t + ring * 0.17, 0, TAU);
                ctx.stroke();
            }

            ctx.fillStyle = "rgba(220,235,255,0.34)";
            for (var dot = 0; dot < 34; dot += 1) {
                var dx = ((dot * 157) % 997) / 997 * width;
                var dy = ((dot * 283) % 991) / 991 * height;
                var pulse = 0.55 + Math.sin(t * 12 + dot) * 0.35;
                ctx.globalAlpha = pulse;
                ctx.fillRect(dx, dy, dot % 5 === 0 ? 2 : 1, dot % 5 === 0 ? 2 : 1);
            }
            ctx.globalAlpha = 1;
        }

        function bodyPath(cx, cy, radius, scaleX, scaleY, angleOffset) {
            var points = bodyRadii.map(function (spring, index) {
                var angle = index / pointCount * TAU - Math.PI / 2;
                var breathing = 1 + Math.sin(angle * 2 + performance.now() * 0.0017) * 0.008;
                var r = radius * spring.value * breathing;
                var x = Math.cos(angle) * r * scaleX;
                var y = Math.sin(angle) * r * scaleY;
                var cosine = Math.cos(angleOffset);
                var sine = Math.sin(angleOffset);
                return { x: cx + x * cosine - y * sine, y: cy + x * sine + y * cosine };
            });
            var first = points[0];
            var last = points[points.length - 1];
            ctx.beginPath();
            ctx.moveTo((last.x + first.x) * 0.5, (last.y + first.y) * 0.5);
            points.forEach(function (point, index) {
                var next = points[(index + 1) % points.length];
                ctx.quadraticCurveTo(point.x, point.y, (point.x + next.x) * 0.5, (point.y + next.y) * 0.5);
            });
            ctx.closePath();
        }

        function drawFace(cx, cy, radius, scaleX, scaleY, active) {
            var spread = radius * (active.id === "CURIOUS" ? 0.32 : 0.27);
            var eyeY = cy - radius * 0.11;
            var eyeWidth = radius * 0.155;
            var eyeHeight = radius * 0.2 * Math.max(0.045, eyeOpen.value);
            var pupilX = gazeX.value * radius * 0.06;
            var pupilY = gazeY.value * radius * 0.055;

            [-1, 1].forEach(function (side) {
                var ex = cx + side * spread * scaleX;
                ctx.save();
                ctx.translate(ex, eyeY);
                ctx.rotate(rotation.value * 0.2);
                ctx.fillStyle = "rgba(4,8,20,.94)";
                ctx.beginPath();
                ctx.ellipse(0, 0, eyeWidth * scaleX, eyeHeight, 0, 0, TAU);
                ctx.fill();
                if (eyeHeight > radius * 0.035) {
                    ctx.fillStyle = "rgba(245,250,255,.94)";
                    ctx.beginPath();
                    ctx.arc(pupilX, pupilY, radius * 0.047, 0, TAU);
                    ctx.fill();
                    ctx.fillStyle = active.color;
                    ctx.beginPath();
                    ctx.arc(pupilX + radius * 0.012, pupilY + radius * 0.01, radius * 0.018, 0, TAU);
                    ctx.fill();
                }
                ctx.restore();
            });

            var mouthY = cy + radius * 0.27 * scaleY;
            var mouthWidth = radius * (0.18 + Math.abs(smile.value) * 0.11);
            var mouthCurve = radius * smile.value * 0.15;
            ctx.strokeStyle = "rgba(4,8,20,.9)";
            ctx.lineWidth = Math.max(2, radius * 0.028);
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(cx - mouthWidth, mouthY);
            ctx.quadraticCurveTo(cx, mouthY + mouthCurve, cx + mouthWidth, mouthY);
            ctx.stroke();
            if (smile.value > 0.58) {
                ctx.fillStyle = "rgba(4,8,20,.88)";
                ctx.beginPath();
                ctx.ellipse(cx, mouthY + mouthCurve * 0.45, mouthWidth * 0.62, radius * 0.055, 0, 0, TAU);
                ctx.fill();
            }
        }

        function updateParticles(delta) {
            var dt = Math.min(0.034, delta / 1000);
            particles = particles.filter(function (particle) {
                particle.age += dt;
                particle.x += particle.vx * dt;
                particle.y += particle.vy * dt;
                particle.vx *= Math.pow(0.988, delta / 16.667);
                particle.vy = particle.vy * Math.pow(0.99, delta / 16.667) + 36 * dt;
                return particle.age < particle.life;
            });
        }

        function drawParticles() {
            particles.forEach(function (particle) {
                var life = 1 - particle.age / particle.life;
                ctx.save();
                ctx.translate(particle.x, particle.y);
                ctx.rotate(particle.spin + particle.age * 2.4);
                ctx.globalAlpha = life;
                ctx.fillStyle = particle.color;
                ctx.fillRect(-particle.size * life, -particle.size * 0.35, particle.size * 2 * life, particle.size * 0.7);
                ctx.restore();
            });
            ctx.globalAlpha = 1;
        }

        function triggerBlink(now) {
            if (!blinking && now >= blinkAt) {
                blinking = true;
                eyeOpen.target = 0.02;
                window.setTimeout(function () {
                    blinking = false;
                    eyeOpen.target = state().eye;
                }, 115);
                blinkAt = now + 1800 + random() * 2600;
            }
        }

        applyState(0, false);
        api.setPrompt("移动视线 · 按住牵引 · 点击切换状态");

        return {
            pointer: function (type, point) {
                lastPointerMove = performance.now();
                gazeX.target = h.clamp((point.x - bodyX.value) * 2.4, -1, 1);
                gazeY.target = h.clamp((point.y - bodyY.value) * 2.4, -1, 1);
                if (type === "down") {
                    dragging = true;
                    press.target = 1;
                    squashX.target = 1.14;
                    squashY.target = 0.86;
                    applyState(5, false);
                }
                if (type === "move" && dragging) {
                    bodyX.target = h.clamp(point.x, 0.2, 0.86);
                    bodyY.target = h.clamp(point.y, 0.2, 0.82);
                    rotation.target = (point.x - bodyX.value) * 0.34;
                }
                if (type === "up" || type === "cancel") {
                    dragging = false;
                    press.target = 0;
                    bodyX.target = 0.63;
                    bodyY.target = 0.52;
                    squashX.target = 0.9;
                    squashY.target = 1.12;
                    rotation.target = 0;
                    applyState(3, true);
                    window.setTimeout(function () { squashX.target = 1; squashY.target = 1; }, 130);
                }
            },
            keydown: function (event) {
                if (event.key === "ArrowLeft") bodyX.target = h.clamp(bodyX.target - 0.05, 0.2, 0.86);
                if (event.key === "ArrowRight") bodyX.target = h.clamp(bodyX.target + 0.05, 0.2, 0.86);
                if (event.key === "ArrowUp") bodyY.target = h.clamp(bodyY.target - 0.05, 0.2, 0.82);
                if (event.key === "ArrowDown") bodyY.target = h.clamp(bodyY.target + 0.05, 0.2, 0.82);
                if (event.key === " " || event.key === "Enter") {
                    event.preventDefault();
                    applyState(stateIndex + 1, true);
                }
            },
            action: function () { applyState(stateIndex + 1, true); },
            frame: function (now, delta, reduced) {
                if (api.isPreview && !dragging) {
                    var orbit = now * 0.00042;
                    gazeX.target = Math.cos(orbit * 1.7) * 0.82;
                    gazeY.target = Math.sin(orbit * 1.3) * 0.58;
                } else if (!dragging && now - lastPointerMove > 1100) {
                    gazeX.target = Math.sin(now * 0.00055) * 0.28;
                    gazeY.target = Math.cos(now * 0.00043) * 0.16;
                }
                if (!dragging && !reduced && now - stateStarted > (api.isPreview ? 2400 : 4200)) applyState(stateIndex + 1, false);
                if (!reduced) triggerBlink(now);

                if (reduced) {
                    bodyRadii.forEach(function (spring) { spring.snap(); });
                    [bodyX, bodyY, squashX, squashY, rotation, eyeOpen, smile, glow, gazeX, gazeY, press].forEach(function (spring) { spring.snap(); });
                    particles = [];
                } else {
                    bodyRadii.forEach(function (spring) { spring.step(delta); });
                    bodyX.step(delta); bodyY.step(delta); squashX.step(delta); squashY.step(delta);
                    rotation.step(delta); eyeOpen.step(delta); smile.step(delta); glow.step(delta);
                    gazeX.step(delta); gazeY.step(delta); press.step(delta);
                    updateParticles(delta);
                }

                var width = api.size.width;
                var height = api.size.height;
                var radius = Math.min(width, height) * (api.isPreview ? 0.235 : 0.205);
                var cx = bodyX.value * width;
                var cy = bodyY.value * height;
                var speedStretch = h.clamp(Math.hypot(bodyX.velocity, bodyY.velocity) * 0.035, 0, 0.12);
                var scaleX = squashX.value + speedStretch;
                var scaleY = squashY.value - speedStretch * 0.55;
                var active = state();

                drawBackground(now, width, height);

                if (dragging) {
                    ctx.strokeStyle = "rgba(235,245,255,.34)";
                    ctx.setLineDash([6, 10]);
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(width * 0.63, height * 0.52);
                    ctx.quadraticCurveTo(width * 0.63, cy, cx, cy);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                ctx.save();
                ctx.shadowColor = active.color;
                ctx.shadowBlur = radius * (0.22 + glow.value * 0.5);
                bodyPath(cx, cy, radius, scaleX, scaleY, rotation.value);
                var fill = ctx.createRadialGradient(cx - radius * 0.34, cy - radius * 0.43, radius * 0.05, cx, cy, radius * 1.3);
                fill.addColorStop(0, "#ffffff");
                fill.addColorStop(0.15, active.edge);
                fill.addColorStop(0.58, active.color);
                fill.addColorStop(1, "#31426f");
                ctx.fillStyle = fill;
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.strokeStyle = "rgba(255,255,255,.72)";
                ctx.lineWidth = Math.max(1.2, radius * 0.012);
                ctx.stroke();
                ctx.restore();

                drawFace(cx, cy, radius, scaleX, scaleY, active);
                drawParticles();

                if (!api.isPreview) {
                    ctx.fillStyle = "rgba(230,240,255,.52)";
                    ctx.font = "700 10px 'Cascadia Code', monospace";
                    ctx.letterSpacing = "0.12em";
                    ctx.fillText("STATE / " + active.id, 20, height - 22);
                }
            }
        };
    }

    Motion.register({ "spring-creature": springCreature });
}());
