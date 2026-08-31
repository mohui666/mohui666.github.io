(function () {
    "use strict";

    var Motion = window.MotionExtended;
    var Data = window.MotionFieldData;
    var h = Motion.helpers;
    var TAU = Math.PI * 2;

    function makeRandom(seed) {
        return function () {
            seed |= 0;
            seed = seed + 0x6D2B79F5 | 0;
            var value = Math.imul(seed ^ seed >>> 15, 1 | seed);
            value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
            return ((value ^ value >>> 14) >>> 0) / 4294967296;
        };
    }

    function rgba(hex, alpha) {
        var value = hex.replace("#", "");
        if (value.length === 3) value = value.split("").map(function (part) { return part + part; }).join("");
        return "rgba(" + parseInt(value.slice(0, 2), 16) + "," + parseInt(value.slice(2, 4), 16) + "," + parseInt(value.slice(4, 6), 16) + "," + alpha + ")";
    }

    function createState(api, definition) {
        var ctx = api.useCanvas("#050817");
        var random = makeRandom(definition.seed);
        var initialPointer = { x: 0.5, y: 0.5, px: 0, py: 0, down: false, pressure: 0.5 };
        return {
            api: api,
            def: definition,
            ctx: ctx,
            random: random,
            accent: definition.palette[0],
            secondary: definition.palette[1],
            inputPointer: Object.assign({}, initialPointer),
            pointer: Object.assign({}, initialPointer),
            pulses: [{ x: 0.32, y: 0.46, born: performance.now() - 500 }],
            sources: [
                { x: 0.24, y: 0.34, phase: 0.2 },
                { x: 0.72, y: 0.4, phase: 2.1 },
                { x: 0.5, y: 0.73, phase: 4.3 }
            ],
            strokes: [],
            inputTrail: [],
            gestureStroke: [],
            particles: [],
            nodes: [],
            trails: [],
            cells: null,
            buffer: null,
            bufferContext: null,
            rawScroll: 0,
            scroll: 0,
            velocity: 0,
            userPreset: definition.algorithmIndex % 4,
            preset: definition.algorithmIndex % 4,
            profile: null,
            sequence: 0,
            frameCount: 0,
            lastStep: 0,
            lastMechanismStep: 0,
            dirty: true
        };
    }

    function setCanvasFont(ctx, weight, size, family) {
        ctx.font = weight + " " + size + "px " + (family || "Inter, Segoe UI, sans-serif");
    }

    function begin(state, now, fade) {
        var ctx = state.ctx;
        var width = state.api.size.width;
        var height = state.api.size.height;
        if (fade) {
            ctx.fillStyle = "rgba(5,8,23," + fade + ")";
            ctx.fillRect(0, 0, width, height);
        } else {
            ctx.fillStyle = "#050817";
            ctx.fillRect(0, 0, width, height);
        }
        var glow = ctx.createRadialGradient(state.pointer.x * width, state.pointer.y * height, 0, state.pointer.x * width, state.pointer.y * height, Math.max(width, height) * 0.65);
        glow.addColorStop(0, rgba(state.accent, 0.1));
        glow.addColorStop(0.5, rgba(state.secondary, 0.035));
        glow.addColorStop(1, "rgba(5,8,23,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
        drawDriverGeometry(state, now);
        topologyHandlers[state.def.mechanism.topology].canvas(state, state.profile);
    }

    function drawStrokes(state) {
        var ctx = state.ctx;
        ctx.save();
        ctx.lineWidth = 10;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = rgba(state.secondary, 0.24);
        state.strokes.forEach(function (stroke) {
            if (stroke.length < 2) return;
            ctx.beginPath();
            stroke.forEach(function (point, index) {
                var x = point.x * state.api.size.width;
                var y = point.y * state.api.size.height;
                if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
        });
        ctx.restore();
    }

    function pulseValue(state, x, y, now, speed) {
        var value = 0;
        state.pulses.forEach(function (pulse) {
            var age = (now - pulse.born) * 0.001;
            var distance = Math.hypot(x - pulse.x, y - pulse.y);
            value += Math.sin((distance * 24 - age * (speed || 8)) * Math.PI) * Math.exp(-distance * 3.6) * Math.exp(-age * 0.18);
        });
        return value;
    }

    function syntheticInput(state, now) {
        var mechanism = state.def.mechanism;
        if (!(state.api.isPreview || mechanism.driver === "sequenced-forcing")) return;
        var offset = state.def.algorithmIndex * 0.73 + state.def.familyIndex * 0.19;
        state.inputPointer.x = 0.5 + Math.cos(now * 0.00047 + offset) * 0.29;
        state.inputPointer.y = 0.5 + Math.sin(now * 0.00061 + offset) * 0.27;
        state.inputPointer.px = state.inputPointer.x * state.api.size.width;
        state.inputPointer.py = state.inputPointer.y * state.api.size.height;
        if (state.api.isPreview && mechanism.driver === "parameter-scroll") state.rawScroll = 0.5 - 0.5 * Math.cos(now * 0.00048 + offset);
        if (state.api.isPreview && mechanism.driver === "constraint-brush" && !state.strokes.length) {
            state.strokes.push(Array.from({ length: 48 }, function (_, index) {
                var angle = index / 47 * TAU;
                return { x: 0.5 + Math.cos(angle) * (0.2 + 0.045 * Math.sin(angle * 3)), y: 0.5 + Math.sin(angle) * (0.18 + 0.035 * Math.cos(angle * 2)) };
            }));
        }
        if (state.api.isPreview && mechanism.driver === "source-coupling") {
            state.sources.forEach(function (source, index) {
                source.x = 0.5 + Math.cos(now * 0.00019 + source.phase + offset) * (0.18 + index * 0.035);
                source.y = 0.5 + Math.sin(now * 0.00023 + source.phase * 1.3 + offset) * (0.17 + index * 0.025);
            });
        }
        if (now - state.lastStep > 1700) {
            state.pulses.push({ x: state.inputPointer.x, y: state.inputPointer.y, born: now });
            state.pulses = state.pulses.slice(-8);
            state.lastStep = now;
        }
    }

    function commonPointer(state, type, point) {
        var driver = state.def.mechanism.driver;
        Object.assign(state.inputPointer, point);
        state.inputPointer.down = type === "down" || (type === "move" && point.pressure > 0);
        if (type === "down") {
            state.pulses.push({ x: point.x, y: point.y, born: performance.now() });
            state.pulses = state.pulses.slice(-10);
            if (driver === "source-coupling") {
                state.sources.push({ x: point.x, y: point.y, phase: state.random() * TAU });
                state.sources = state.sources.slice(-6);
            }
            if (driver === "constraint-brush") state.strokes.push([{ x: point.x, y: point.y }]);
            if (state.def.familyId === "gesture-pen") state.gestureStroke = [{ x: point.x, y: point.y, p: point.pressure || 0.5, tiltX: point.tiltX || 0, tiltY: point.tiltY || 0 }];
        }
        if (type === "move" && driver === "constraint-brush" && state.inputPointer.down) {
            var current = state.strokes[state.strokes.length - 1];
            if (current) current.push({ x: point.x, y: point.y });
        }
        if (type === "move" && state.def.familyId === "gesture-pen" && state.inputPointer.down) state.gestureStroke.push({ x: point.x, y: point.y, p: point.pressure || 0.5, tiltX: point.tiltX || 0, tiltY: point.tiltY || 0 });
        if (type === "up" || type === "cancel") state.inputPointer.down = false;
        state.dirty = true;
    }

    function commonAction(state) {
        state.userPreset = (state.userPreset + 1) % 4;
        state.pulses.push({ x: 0.2 + state.random() * 0.6, y: 0.2 + state.random() * 0.6, born: performance.now() });
        if (state.def.mechanism.driver === "constraint-brush") state.strokes = [];
        if (state.def.mechanism.driver === "source-coupling") state.sources.push({ x: 0.18 + state.random() * 0.64, y: 0.18 + state.random() * 0.64, phase: state.random() * TAU });
        state.dirty = true;
        state.api.setState(state.def.mechanism.update.toUpperCase().replaceAll("-", " ") + " / " + String(state.userPreset + 1).padStart(2, "0"));
    }

    function wrap01(value) { return ((value % 1) + 1) % 1; }
    function reflect01(value) {
        var phase = ((value % 2) + 2) % 2;
        return phase > 1 ? 2 - phase : phase;
    }
    function nearestStrokePoint(state, point) {
        var nearest = null, distance = Infinity;
        state.strokes.forEach(function (stroke) {
            stroke.forEach(function (sample) {
                var current = Math.hypot(point.x - sample.x, point.y - sample.y);
                if (current < distance) { distance = current; nearest = sample; }
            });
        });
        return nearest ? { point: nearest, distance: distance } : null;
    }

    var driverHandlers = {
        "direct-force": function (state, profile) {
            profile.pointer = { x: state.inputPointer.x, y: state.inputPointer.y };
            profile.energy = 0.7 + (state.inputPointer.down ? 0.85 : 0.15);
        },
        "source-coupling": function (state, profile) {
            var weight = 0, x = 0, y = 0;
            state.sources.forEach(function (source, index) {
                var pulse = 0.72 + 0.28 * Math.sin(profile.now * 0.001 + source.phase + index);
                weight += pulse; x += source.x * pulse; y += source.y * pulse;
            });
            profile.pointer = { x: x / weight, y: y / weight };
            profile.energy = Math.min(1.8, 0.42 + state.sources.length * 0.19);
        },
        "constraint-brush": function (state, profile) {
            var pointer = { x: state.inputPointer.x, y: state.inputPointer.y };
            var nearest = nearestStrokePoint(state, pointer);
            if (nearest && nearest.distance < 0.16) {
                var dx = pointer.x - nearest.point.x, dy = pointer.y - nearest.point.y;
                var scale = (0.16 - nearest.distance) / Math.max(0.002, nearest.distance) * 0.48;
                pointer.x += dx * scale; pointer.y += dy * scale;
            }
            profile.pointer = pointer;
            profile.energy = 0.52 + Math.min(1, state.strokes.reduce(function (sum, stroke) { return sum + stroke.length; }, 0) / 90);
        },
        "parameter-scroll": function (state, profile) {
            profile.pointer = {
                x: 0.1 + state.rawScroll * 0.8,
                y: 0.5 + Math.sin(state.rawScroll * TAU * (1 + state.def.algorithmIndex % 3)) * 0.27
            };
            profile.energy = 0.45 + Math.abs(state.velocity) * 0.08 + state.rawScroll * 0.75;
        },
        "sequenced-forcing": function (state, profile) {
            var step = Math.floor(profile.now / 1350 + state.userPreset) % 6;
            var phase = profile.now * 0.001 * (0.7 + step * 0.08);
            profile.pointer = {
                x: 0.5 + Math.cos(phase * (2 + step % 3)) * (0.16 + step * 0.025),
                y: 0.5 + Math.sin(phase * (3 + (step + 1) % 2)) * (0.14 + step * 0.02)
            };
            profile.sequence = step;
            profile.energy = 0.58 + step * 0.17;
        }
    };

    var topologyHandlers = {
        "cartesian-lattice": {
            input: function () {}, canvas: function () {}
        },
        "radial-neighborhood": {
            input: function (state, profile) {
                var dx = profile.pointer.x - 0.5, dy = profile.pointer.y - 0.5;
                var radius = Math.hypot(dx, dy), angle = Math.atan2(dy, dx) + state.scroll * 0.7;
                profile.pointer.x = 0.5 + Math.cos(angle) * radius;
                profile.pointer.y = 0.5 + Math.sin(angle) * radius;
            },
            canvas: function (state) {
                var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height;
                ctx.translate(w * 0.5, ht * 0.5); ctx.rotate((state.scroll - 0.5) * 0.12); ctx.translate(-w * 0.5, -ht * 0.5);
            }
        },
        "branched-graph": {
            input: function (state, profile) {
                var dx = profile.pointer.x - 0.5, dy = profile.pointer.y - 0.5, radius = Math.hypot(dx, dy);
                var branches = 3 + state.def.mechanism.parameters.symmetry;
                var angle = Math.round(Math.atan2(dy, dx) / TAU * branches) / branches * TAU;
                profile.pointer.x = 0.5 + Math.cos(angle) * radius;
                profile.pointer.y = 0.5 + Math.sin(angle) * radius;
            },
            canvas: function (state) {
                var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height;
                ctx.translate(w * 0.5, ht * 0.5); ctx.transform(1, 0.04, -0.09, 1, 0, 0); ctx.translate(-w * 0.5, -ht * 0.5);
            }
        },
        "masked-domain": {
            input: function (state, profile) {
                var dx = profile.pointer.x - 0.5, dy = profile.pointer.y - 0.5, length = Math.hypot(dx, dy);
                if (length > 0.43) { profile.pointer.x = 0.5 + dx / length * 0.43; profile.pointer.y = 0.5 + dy / length * 0.43; }
            },
            canvas: function (state) {
                var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height;
                ctx.beginPath(); ctx.arc(w * 0.5, ht * 0.5, Math.min(w, ht) * 0.47, 0, TAU); ctx.clip();
            }
        },
        "layered-history": {
            input: function (state, profile) { profile.pointer.y = Math.round(profile.pointer.y * 7) / 7; },
            canvas: function (state) { state.ctx.globalAlpha = 0.9; }
        },
        "toroidal-grid": {
            input: function (state, profile) { profile.pointer.x = wrap01(profile.pointer.x + state.scroll * 0.23); profile.pointer.y = wrap01(profile.pointer.y - state.scroll * 0.17); },
            canvas: function (state) { state.ctx.translate((state.scroll - 0.5) * state.api.size.width * 0.035, Math.sin(state.scroll * TAU) * state.api.size.height * 0.025); }
        },
        "adaptive-mesh": {
            input: function (state, profile) {
                profile.pointer.x = 0.5 + Math.sign(profile.pointer.x - 0.5) * Math.pow(Math.abs(profile.pointer.x - 0.5) * 2, 1.35) * 0.5;
                profile.pointer.y = 0.5 + Math.sign(profile.pointer.y - 0.5) * Math.pow(Math.abs(profile.pointer.y - 0.5) * 2, 0.78) * 0.5;
            },
            canvas: function (state) {
                var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height;
                ctx.translate(w * 0.5, ht * 0.5); ctx.scale(1 + state.scroll * 0.035, 1 - state.scroll * 0.025); ctx.translate(-w * 0.5, -ht * 0.5);
            }
        },
        "particle-cloud": {
            input: function (state, profile) {
                profile.pointer.x += Math.sin(profile.now * 0.0031 + state.def.seed) * 0.035;
                profile.pointer.y += Math.cos(profile.now * 0.0027 + state.def.seed) * 0.035;
            },
            canvas: function () {}
        },
        "path-manifold": {
            input: function (state, profile) { profile.pointer.y = 0.5 + Math.sin(profile.pointer.x * TAU * 1.5 + state.scroll * TAU) * 0.24; },
            canvas: function (state) {
                var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height;
                ctx.translate(w * 0.5, ht * 0.5); ctx.rotate(Math.sin(state.scroll * TAU) * 0.035); ctx.translate(-w * 0.5, -ht * 0.5);
            }
        },
        "phase-space": {
            input: function (state, profile) {
                var x = profile.pointer.x;
                profile.pointer.x = 0.5 + Math.sin((profile.pointer.y - 0.5) * Math.PI) * 0.48;
                profile.pointer.y = 0.5 + Math.cos((x - 0.5) * Math.PI) * 0.42;
            },
            canvas: function (state) {
                var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height;
                ctx.translate(w * 0.5, ht * 0.5); ctx.rotate(Math.PI * 0.25); ctx.scale(0.94, 0.94); ctx.translate(-w * 0.5, -ht * 0.5);
            }
        }
    };

    var boundaryHandlers = {
        "fixed": function (point) { point.x = h.clamp(point.x, 0.06, 0.94); point.y = h.clamp(point.y, 0.06, 0.94); },
        "periodic": function (point) { point.x = wrap01(point.x); point.y = wrap01(point.y); },
        "reflective": function (point) { point.x = reflect01(point.x); point.y = reflect01(point.y); },
        "absorbing": function (point) { point.x = 0.5 + (point.x - 0.5) * 0.74; point.y = 0.5 + (point.y - 0.5) * 0.74; },
        "painted": function (point, state) {
            var nearest = nearestStrokePoint(state, point);
            if (!nearest || nearest.distance > 0.13) return;
            var dx = point.x - nearest.point.x, dy = point.y - nearest.point.y, length = Math.max(0.002, Math.hypot(dx, dy));
            point.x = nearest.point.x + dx / length * 0.13; point.y = nearest.point.y + dy / length * 0.13;
        },
        "elastic": function (point) { point.x = 0.5 + Math.tanh((point.x - 0.5) * 2.4) * 0.46; point.y = 0.5 + Math.tanh((point.y - 0.5) * 2.4) * 0.46; },
        "open": function (point) { point.x = h.clamp(point.x, -0.18, 1.18); point.y = h.clamp(point.y, -0.18, 1.18); },
        "adaptive": function (point, state) {
            var dx = point.x - 0.5, dy = point.y - 0.5, length = Math.hypot(dx, dy), limit = 0.28 + state.scroll * 0.22;
            if (length > limit) { point.x = 0.5 + dx / length * limit; point.y = 0.5 + dy / length * limit; }
        },
        "clamped": function (point) { point.x = h.clamp(point.x, 0, 1); point.y = h.clamp(point.y, 0, 1); },
        "moving": function (point, state, profile) {
            var cx = 0.5 + Math.sin(profile.now * 0.0007) * 0.12, cy = 0.5 + Math.cos(profile.now * 0.00053) * 0.1;
            point.x = h.clamp(point.x, cx - 0.32, cx + 0.32); point.y = h.clamp(point.y, cy - 0.3, cy + 0.3);
        }
    };

    var updateHandlers = {
        "impulse-injection": function (state, profile) {
            if (profile.now - state.lastMechanismStep > 1050 / profile.rate) {
                state.pulses.push({ x: profile.pointer.x, y: profile.pointer.y, born: profile.now });
                state.pulses = state.pulses.slice(-12); state.lastMechanismStep = profile.now;
            }
            profile.energy *= 1 + Math.min(0.7, state.pulses.length * 0.035);
        },
        "source-coupling": function (state, profile) {
            profile.energy *= 0.75 + state.sources.length * 0.12;
            profile.pointer.x = (profile.pointer.x + state.sources[state.sequence % state.sources.length].x) * 0.5;
        },
        "constraint-projection": function (state, profile) {
            var count = state.strokes.reduce(function (sum, stroke) { return sum + stroke.length; }, 0);
            profile.energy *= 0.78 + Math.min(0.85, count / 120);
            state.preset = (state.userPreset + Math.floor(count / 24)) % 4;
        },
        "parameter-continuation": function (state, profile) {
            state.scroll = state.rawScroll;
            state.preset = Math.min(3, Math.floor(state.rawScroll * 4));
            profile.energy *= 0.62 + state.rawScroll * 0.9;
        },
        "sequenced-forcing": function (state, profile) {
            state.sequence = profile.sequence || Math.floor(profile.now / 1350) % 6;
            state.preset = (state.userPreset + state.sequence) % 4;
            profile.energy *= 0.72 + (state.sequence % 3) * 0.28;
        }
    };

    function prepareMechanism(state, now, delta) {
        var mechanism = state.def.mechanism;
        var profile = {
            now: now * mechanism.parameters.rate,
            delta: delta * mechanism.parameters.rate,
            rate: mechanism.parameters.rate,
            gain: mechanism.parameters.gain,
            density: mechanism.parameters.density,
            symmetry: mechanism.parameters.symmetry,
            energy: 1,
            pointer: { x: state.inputPointer.x, y: state.inputPointer.y },
            sequence: state.sequence
        };
        state.scroll = state.rawScroll;
        state.preset = state.userPreset;
        driverHandlers[mechanism.driver](state, profile);
        topologyHandlers[mechanism.topology].input(state, profile);
        boundaryHandlers[mechanism.boundary](profile.pointer, state, profile);
        updateHandlers[mechanism.update](state, profile);
        state.pointer.x = profile.pointer.x;
        state.pointer.y = profile.pointer.y;
        state.pointer.px = profile.pointer.x * state.api.size.width;
        state.pointer.py = profile.pointer.y * state.api.size.height;
        state.pointer.down = state.inputPointer.down;
        state.pointer.pressure = state.inputPointer.pressure;
        state.pointer.tiltX = state.inputPointer.tiltX || 0;
        state.pointer.tiltY = state.inputPointer.tiltY || 0;
        if (state.frameCount % 3 === 0) {
            state.inputTrail.push({ x: state.pointer.x, y: state.pointer.y });
            state.inputTrail = state.inputTrail.slice(-36);
        }
        state.profile = profile;
        return profile;
    }

    function drawDriverGeometry(state, now) {
        var driver = state.def.mechanism.driver;
        var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height;
        if (driver === "constraint-brush") drawStrokes(state);
        if (driver === "source-coupling") {
            ctx.save();
            state.sources.forEach(function (source, index) {
                var radius = 8 + (index % 3) * 4 + Math.sin(now * 0.002 + source.phase) * 2;
                ctx.strokeStyle = index % 2 ? rgba(state.secondary, 0.52) : rgba(state.accent, 0.52);
                ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(source.x * w, source.y * ht, radius, 0, TAU); ctx.stroke();
                ctx.beginPath(); ctx.arc(source.x * w, source.y * ht, 2.4, 0, TAU); ctx.fillStyle = index % 2 ? state.secondary : state.accent; ctx.fill();
            });
            ctx.restore();
        }
        if (driver === "parameter-scroll") {
            ctx.save(); ctx.fillStyle = rgba(state.accent, 0.16); ctx.fillRect(w * 0.08, ht * 0.92, w * 0.84, 2);
            ctx.fillStyle = state.secondary; ctx.fillRect(w * 0.08, ht * 0.915, w * 0.84 * state.rawScroll, 4); ctx.restore();
        }
    }

    var visualizerHandlers = {
        "physical-state": function (state) {
            var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height;
            ctx.strokeStyle = rgba(state.secondary, 0.62); ctx.lineWidth = 1.5; ctx.beginPath();
            ctx.arc(state.pointer.x * w, state.pointer.y * ht, 10 + state.profile.energy * 4, 0, TAU); ctx.stroke();
        },
        "vector-state": function (state) {
            var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height;
            ctx.strokeStyle = rgba(state.accent, 0.42); ctx.lineWidth = 1;
            state.sources.slice(-5).forEach(function (source) { ctx.beginPath(); ctx.moveTo(source.x * w, source.y * ht); ctx.lineTo(state.pointer.x * w, state.pointer.y * ht); ctx.stroke(); });
        },
        "constraint-state": function (state) { drawStrokes(state); },
        "history-state": function (state) {
            var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height;
            if (state.inputTrail.length < 2) return; ctx.beginPath();
            state.inputTrail.forEach(function (point, index) { if (!index) ctx.moveTo(point.x * w, point.y * ht); else ctx.lineTo(point.x * w, point.y * ht); });
            ctx.strokeStyle = rgba(state.secondary, 0.44); ctx.lineWidth = 2; ctx.stroke();
        },
        "phase-state": function (state) {
            var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height, r = Math.min(w, ht) * 0.085;
            ctx.strokeStyle = rgba(state.accent, 0.35); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w - r - 20, r + 20, r, -Math.PI / 2, -Math.PI / 2 + state.scroll * TAU); ctx.stroke();
        },
        "energy-map": function (state) {
            var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height;
            for (var ring = 1; ring <= 3; ring += 1) { ctx.strokeStyle = rgba(state.accent, 0.2 / ring); ctx.beginPath(); ctx.arc(state.pointer.x * w, state.pointer.y * ht, ring * 22 * state.profile.energy, 0, TAU); ctx.stroke(); }
        },
        "topology-map": function (state) {
            var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height, sides = 3 + state.profile.symmetry;
            ctx.strokeStyle = rgba(state.secondary, 0.3); ctx.beginPath();
            for (var i = 0; i <= sides; i += 1) { var a = i / sides * TAU - Math.PI / 2, x = w * 0.5 + Math.cos(a) * Math.min(w, ht) * 0.39, y = ht * 0.5 + Math.sin(a) * Math.min(w, ht) * 0.39; if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
        },
        "density-map": function (state) {
            var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height, count = Math.min(32, state.profile.density);
            ctx.fillStyle = rgba(state.secondary, 0.25);
            for (var i = 0; i < count; i += 1) { var a = i * 2.399 + state.profile.now * 0.0001, r = Math.sqrt((i + 1) / count) * Math.min(w, ht) * 0.22; ctx.fillRect(w * 0.5 + Math.cos(a) * r, ht * 0.5 + Math.sin(a) * r, 2, 2); }
        },
        "iteration-map": function (state) {
            var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height, step = 18 + state.def.algorithmIndex * 3;
            ctx.strokeStyle = rgba(state.accent, 0.14); ctx.lineWidth = 1;
            for (var x = (state.frameCount % step); x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ht); ctx.stroke(); }
        },
        "signal-map": function (state) {
            var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height;
            ctx.strokeStyle = rgba(state.secondary, 0.46); ctx.beginPath();
            for (var x = 0; x <= w; x += 6) { var y = ht * 0.88 + Math.sin(x * 0.035 + state.profile.now * 0.004) * 9 * state.profile.energy; if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
        }
    };

    function drawMechanismVisualizer(state) {
        state.ctx.save();
        visualizerHandlers[state.def.mechanism.visualizer](state);
        state.ctx.restore();
    }

    function drawOscillatory(state, now) {
        begin(state, now);
        var ctx = state.ctx, width = state.api.size.width, height = state.api.size.height;
        var mode = state.def.algorithmIndex;
        var phase = now * 0.0016 + state.scroll * 9 + state.preset * 0.7;
        if (mode === 0) {
            for (var row = 0; row < 13; row += 1) {
                ctx.beginPath();
                for (var step = 0; step <= 160; step += 1) {
                    var x = step / 160;
                    var proximity = Math.exp(-Math.pow((x - state.pointer.x) * 8, 2));
                    var wave = Math.sin(x * TAU * (2 + state.preset * 0.25) - phase + row * 0.38) * 0.018;
                    wave += proximity * (state.pointer.y - 0.5) * 0.18 + pulseValue(state, x, row / 12, now, 6) * 0.012;
                    var px = x * width, py = (0.14 + row * 0.06 + wave) * height;
                    if (!step) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.strokeStyle = row % 3 === 0 ? state.accent : rgba(state.secondary, 0.38);
                ctx.lineWidth = row % 3 === 0 ? 2 : 1;
                ctx.stroke();
            }
        } else if (mode === 1) {
            var columns = state.api.isPreview ? 24 : 38, rows = state.api.isPreview ? 14 : 22;
            for (var y = 0; y < rows; y += 1) for (var xIndex = 0; xIndex < columns; xIndex += 1) {
                var nx = xIndex / (columns - 1), ny = y / (rows - 1);
                var displacement = Math.sin(Math.hypot(nx - state.pointer.x, ny - state.pointer.y) * 34 - phase * 5) * 0.5 + pulseValue(state, nx, ny, now, 8) * 0.7;
                var radius = Math.max(0.2, 1.2 + (displacement + 1) * 2.1);
                ctx.fillStyle = displacement > 0 ? rgba(state.accent, 0.35 + displacement * 0.35) : rgba(state.secondary, 0.26);
                ctx.beginPath(); ctx.arc(nx * width, ny * height, radius, 0, TAU); ctx.fill();
            }
        } else if (mode === 2) {
            var count = state.api.isPreview ? 90 : 160;
            for (var index = 0; index < count; index += 1) {
                var baseAngle = index / count * TAU;
                var coupling = Math.sin(phase * 1.4 + index * 0.21) * (0.3 + state.pointer.x * 0.7);
                var radiusRing = Math.min(width, height) * (0.22 + 0.09 * Math.sin(index * 0.37 + phase));
                var cx = width * 0.5 + Math.cos(baseAngle + coupling) * radiusRing;
                var cy = height * 0.5 + Math.sin(baseAngle + coupling) * radiusRing;
                ctx.strokeStyle = rgba(state.accent, 0.1);
                ctx.beginPath(); ctx.moveTo(width * 0.5, height * 0.5); ctx.lineTo(cx, cy); ctx.stroke();
                ctx.fillStyle = index % 7 === 0 ? state.secondary : state.accent;
                ctx.beginPath(); ctx.arc(cx, cy, index % 7 === 0 ? 4 : 2, 0, TAU); ctx.fill();
            }
        } else {
            ctx.save(); ctx.translate(width * 0.5, height * 0.5);
            for (var band = 0; band < 8; band += 1) {
                ctx.beginPath();
                for (var point = 0; point <= 360; point += 1) {
                    var a = point / 360 * TAU;
                    var mx = Math.sin(a * (2 + band % 3) + phase * (0.6 + band * 0.05));
                    var my = Math.sin(a * (3 + band % 4) - phase * 0.5);
                    var radiusMode = Math.min(width, height) * (0.18 + band * 0.018);
                    var dx = mx * radiusMode * (0.65 + state.pointer.x * 0.45);
                    var dy = my * radiusMode * (0.65 + state.pointer.y * 0.45);
                    if (!point) ctx.moveTo(dx, dy); else ctx.lineTo(dx, dy);
                }
                ctx.strokeStyle = band % 2 ? rgba(state.secondary, 0.32) : rgba(state.accent, 0.48);
                ctx.lineWidth = 1.2; ctx.stroke();
            }
            ctx.restore();
        }
    }

    function initDeformable(state, mode, width, height) {
        var particles = [], constraints = [];
        if (mode === 0 || mode === 2) {
            var cols = mode === 0 ? (state.api.isPreview ? 14 : 20) : (state.api.isPreview ? 9 : 13), rows = mode === 0 ? (state.api.isPreview ? 10 : 14) : (state.api.isPreview ? 7 : 10);
            for (var y = 0; y < rows; y += 1) for (var x = 0; x < cols; x += 1) {
                var px = width * (0.18 + x / (cols - 1) * 0.64), py = height * (0.14 + y / (rows - 1) * 0.62);
                particles.push({ x: px, y: py, px: px, py: py, vx: 0, vy: 0, restX: px, restY: py, pinned: mode === 0 && y === 0 && x % 3 === 0 });
            }
            function connect(a, b) { constraints.push({ a: a, b: b, rest: Math.hypot(particles[a].x - particles[b].x, particles[a].y - particles[b].y) }); }
            for (y = 0; y < rows; y += 1) for (x = 0; x < cols; x += 1) {
                var index = y * cols + x;
                if (x + 1 < cols) connect(index, index + 1);
                if (y + 1 < rows) connect(index, index + cols);
                if (mode === 0 && x + 1 < cols && y + 1 < rows) connect(index, index + cols + 1);
            }
            state.deformable = { mode: mode, width: width, height: height, particles: particles, constraints: constraints, cols: cols, rows: rows };
            return;
        }
        var count = mode === 1 ? (state.api.isPreview ? 24 : 36) : (state.api.isPreview ? 18 : 28), radius = Math.min(width, height) * (mode === 1 ? 0.23 : 0.26);
        for (var ring = 0; ring < count; ring += 1) {
            var angle = ring / count * TAU, rx = Math.cos(angle) * radius * (mode === 3 ? 1.18 : 1), ry = Math.sin(angle) * radius * (mode === 3 ? 0.84 : 1);
            particles.push({ x: width * 0.5 + rx, y: height * 0.5 + ry, px: width * 0.5 + rx, py: height * 0.5 + ry, vx: 0, vy: 0, restX: rx, restY: ry });
            constraints.push({ a: ring, b: (ring + 1) % count, rest: Math.hypot(rx - Math.cos((ring + 1) / count * TAU) * radius * (mode === 3 ? 1.18 : 1), ry - Math.sin((ring + 1) / count * TAU) * radius * (mode === 3 ? 0.84 : 1)), lambda: 0 });
        }
        var area = 0; for (var i = 0; i < count; i += 1) { var next = particles[(i + 1) % count]; area += particles[i].x * next.y - next.x * particles[i].y; }
        state.deformable = { mode: mode, width: width, height: height, particles: particles, constraints: constraints, restArea: Math.abs(area * 0.5) };
    }

    function projectDistanceConstraint(particles, constraint, stiffness) {
        var a = particles[constraint.a], b = particles[constraint.b], dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy) || 0.001;
        var correction = (distance - constraint.rest) / distance * 0.5 * stiffness;
        if (!a.pinned) { a.x += dx * correction; a.y += dy * correction; }
        if (!b.pinned) { b.x -= dx * correction; b.y -= dy * correction; }
    }

    function drawDeformable(state, now, delta) {
        var width = state.api.size.width, height = state.api.size.height, mode = state.def.algorithmIndex;
        if (!state.deformable || state.deformable.mode !== mode || state.deformable.width !== width || state.deformable.height !== height) initDeformable(state, mode, width, height);
        begin(state, now);
        var ctx = state.ctx, model = state.deformable, particles = model.particles, dt = Math.min(1.35, (delta || 16.667) / 16.667), pointerX = state.pointer.x * width, pointerY = state.pointer.y * height;

        if (mode === 0) {
            particles.forEach(function (particle) {
                if (particle.pinned) { particle.x = particle.restX; particle.y = particle.restY; particle.px = particle.x; particle.py = particle.y; return; }
                var velocityX = (particle.x - particle.px) * 0.992, velocityY = (particle.y - particle.py) * 0.992; particle.px = particle.x; particle.py = particle.y;
                particle.x += velocityX * dt; particle.y += velocityY * dt + 0.16 * dt * dt;
                if (state.pointer.down) { var dx = pointerX - particle.x, dy = pointerY - particle.y, distance = Math.hypot(dx, dy); if (distance < Math.min(width, height) * 0.19) { particle.x += dx * 0.035; particle.y += dy * 0.035; } }
            });
            for (var pass = 0; pass < 5; pass += 1) model.constraints.forEach(function (constraint) { projectDistanceConstraint(particles, constraint, 0.92); });
        } else if (mode === 2) {
            particles.forEach(function (particle) { particle.vy += 0.012 * dt; if (state.pointer.down) { var dx = pointerX - particle.x, dy = pointerY - particle.y, distance = Math.hypot(dx, dy) || 1; if (distance < Math.min(width, height) * 0.25) { particle.vx += dx / distance * 0.22; particle.vy += dy / distance * 0.22; } } });
            model.constraints.forEach(function (constraint) { var a = particles[constraint.a], b = particles[constraint.b], dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy) || 1, force = (distance - constraint.rest) * 0.012; a.vx += dx / distance * force; a.vy += dy / distance * force; b.vx -= dx / distance * force; b.vy -= dy / distance * force; });
            particles.forEach(function (particle) { particle.vx *= 0.985; particle.vy *= 0.985; particle.x += particle.vx * dt; particle.y += particle.vy * dt; if (particle.x < 20 || particle.x > width - 20) { particle.x = h.clamp(particle.x, 20, width - 20); particle.vx *= -0.52; } if (particle.y > height - 20) { particle.y = height - 20; particle.vy *= -0.42; } });
        } else if (mode === 1) {
            particles.forEach(function (particle) { particle.vy += 0.006 * dt; if (state.pointer.down) { var dx = pointerX - particle.x, dy = pointerY - particle.y, distance = Math.hypot(dx, dy) || 1; if (distance < Math.min(width, height) * 0.3) { particle.vx += dx / distance * 0.18; particle.vy += dy / distance * 0.18; } } particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vx *= 0.94; particle.vy *= 0.94; });
            var center = particles.reduce(function (sum, particle) { sum.x += particle.x; sum.y += particle.y; return sum; }, { x: 0, y: 0 }); center.x /= particles.length; center.y /= particles.length;
            var dot = 0, cross = 0; particles.forEach(function (particle) { var dx = particle.x - center.x, dy = particle.y - center.y; dot += particle.restX * dx + particle.restY * dy; cross += particle.restX * dy - particle.restY * dx; });
            var rotation = Math.atan2(cross, dot), cosine = Math.cos(rotation), sine = Math.sin(rotation);
            particles.forEach(function (particle) { var goalX = center.x + particle.restX * cosine - particle.restY * sine, goalY = center.y + particle.restX * sine + particle.restY * cosine; particle.vx += (goalX - particle.x) * 0.045; particle.vy += (goalY - particle.y) * 0.045; particle.x = h.clamp(particle.x, 18, width - 18); particle.y = h.clamp(particle.y, 18, height - 18); });
        } else {
            particles.forEach(function (particle) { var oldX = particle.x, oldY = particle.y; particle.x += (particle.x - particle.px) * 0.99; particle.y += (particle.y - particle.py) * 0.99 + 0.08 * dt; particle.px = oldX; particle.py = oldY; if (state.pointer.down && Math.hypot(pointerX - particle.x, pointerY - particle.y) < 70) { particle.x += (pointerX - particle.x) * 0.08; particle.y += (pointerY - particle.y) * 0.08; } });
            for (var iteration = 0; iteration < 6; iteration += 1) {
                model.constraints.forEach(function (constraint) { projectDistanceConstraint(particles, constraint, 0.72); });
                var area = 0; for (var index = 0; index < particles.length; index += 1) { var next = particles[(index + 1) % particles.length]; area += particles[index].x * next.y - next.x * particles[index].y; } area *= 0.5;
                var compliance = 0.000008, constraintValue = area - model.restArea, gradients = [], denominator = compliance;
                for (index = 0; index < particles.length; index += 1) { var previous = particles[(index - 1 + particles.length) % particles.length], following = particles[(index + 1) % particles.length], gradient = { x: (following.y - previous.y) * 0.5, y: (previous.x - following.x) * 0.5 }; gradients.push(gradient); denominator += gradient.x * gradient.x + gradient.y * gradient.y; }
                var lambda = -constraintValue / Math.max(1, denominator); particles.forEach(function (particle, particleIndex) { particle.x += gradients[particleIndex].x * lambda; particle.y += gradients[particleIndex].y * lambda; });
            }
        }

        if (mode === 0 || mode === 2) {
            ctx.strokeStyle = rgba(state.accent, 0.42); ctx.lineWidth = mode === 2 ? 1.4 : 1;
            model.constraints.forEach(function (constraint) { var a = particles[constraint.a], b = particles[constraint.b]; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); });
            particles.forEach(function (particle, index) { ctx.fillStyle = particle.pinned || index % model.cols === 0 ? state.secondary : state.accent; ctx.beginPath(); ctx.arc(particle.x, particle.y, mode === 2 ? 3.2 : 2, 0, TAU); ctx.fill(); });
        } else {
            ctx.beginPath(); particles.forEach(function (particle, index) { if (!index) ctx.moveTo(particle.x, particle.y); else ctx.lineTo(particle.x, particle.y); }); ctx.closePath();
            var centerX = particles.reduce(function (sum, particle) { return sum + particle.x; }, 0) / particles.length, centerY = particles.reduce(function (sum, particle) { return sum + particle.y; }, 0) / particles.length;
            var gradient = ctx.createRadialGradient(centerX - 35, centerY - 45, 0, centerX, centerY, Math.min(width, height) * 0.32); gradient.addColorStop(0, "#fff"); gradient.addColorStop(0.15, state.accent); gradient.addColorStop(1, rgba(state.secondary, 0.34));
            ctx.fillStyle = gradient; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.76)"; ctx.lineWidth = 2; ctx.stroke();
            if (mode === 3) particles.forEach(function (particle, index) { if (index % 2) return; ctx.strokeStyle = rgba(state.secondary, 0.24); ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.lineTo(particle.x, particle.y); ctx.stroke(); });
        }
    }

    function initialChain(origin, target, lengths, bend) {
        var points = [{ x: origin.x, y: origin.y }];
        var total = lengths.reduce(function (sum, value) { return sum + value; }, 0);
        var dx = target.x - origin.x, dy = target.y - origin.y, distance = Math.hypot(dx,dy) || 1;
        var angle = Math.atan2(dy,dx);
        for (var i = 0; i < lengths.length; i += 1) {
            var progress = (i + 1) / lengths.length;
            var curve = Math.sin(progress * Math.PI) * bend * Math.min(total,distance);
            points.push({ x: origin.x + Math.cos(angle) * Math.min(distance,total) * progress - Math.sin(angle) * curve, y: origin.y + Math.sin(angle) * Math.min(distance,total) * progress + Math.cos(angle) * curve });
        }
        return points;
    }

    function solveFabrik(origin, target, lengths, bend) {
        var points = initialChain(origin, target, lengths, bend);
        points[points.length - 1] = { x: target.x, y: target.y };
        for (var pass = 0; pass < 5; pass += 1) {
            points[points.length - 1] = { x: target.x, y: target.y };
            for (var back = points.length - 2; back >= 0; back -= 1) { var bdx=points[back].x-points[back+1].x,bdy=points[back].y-points[back+1].y,bd=Math.hypot(bdx,bdy)||1; points[back].x=points[back+1].x+bdx/bd*lengths[back]; points[back].y=points[back+1].y+bdy/bd*lengths[back]; }
            points[0] = { x: origin.x, y: origin.y };
            for (var f=1;f<points.length;f+=1) { var fdx=points[f].x-points[f-1].x,fdy=points[f].y-points[f-1].y,fd=Math.hypot(fdx,fdy)||1; points[f].x=points[f-1].x+fdx/fd*lengths[f-1]; points[f].y=points[f-1].y+fdy/fd*lengths[f-1]; }
        }
        return points;
    }

    function rotatePoint(point, pivot, angle) {
        var dx = point.x - pivot.x, dy = point.y - pivot.y, cosine = Math.cos(angle), sine = Math.sin(angle);
        return { x: pivot.x + dx * cosine - dy * sine, y: pivot.y + dx * sine + dy * cosine };
    }

    function solveCCD(origin, target, lengths, bend) {
        var points = initialChain(origin, target, lengths, bend);
        for (var pass = 0; pass < 10; pass += 1) {
            for (var joint = points.length - 2; joint >= 0; joint -= 1) {
                var pivot = points[joint], end = points[points.length - 1];
                var currentAngle = Math.atan2(end.y - pivot.y, end.x - pivot.x);
                var targetAngle = Math.atan2(target.y - pivot.y, target.x - pivot.x);
                var rotation = Math.atan2(Math.sin(targetAngle - currentAngle), Math.cos(targetAngle - currentAngle));
                for (var child = joint + 1; child < points.length; child += 1) points[child] = rotatePoint(points[child], pivot, rotation * 0.78);
            }
        }
        points[0] = { x: origin.x, y: origin.y };
        return points;
    }

    function forwardChain(origin, lengths, angles) {
        var points = [{ x: origin.x, y: origin.y }], heading = 0;
        lengths.forEach(function (length, index) {
            heading += angles[index];
            var previous = points[points.length - 1];
            points.push({ x: previous.x + Math.cos(heading) * length, y: previous.y + Math.sin(heading) * length });
        });
        return points;
    }

    function solveJacobian(origin, target, lengths, bend) {
        var baseAngle = Math.atan2(target.y - origin.y, target.x - origin.x) / lengths.length;
        var angles = lengths.map(function (_, index) { return baseAngle + Math.sin(index * 0.9) * bend; });
        var points;
        for (var pass = 0; pass < 18; pass += 1) {
            points = forwardChain(origin, lengths, angles);
            var end = points[points.length - 1], errorX = target.x - end.x, errorY = target.y - end.y;
            for (var joint = 0; joint < angles.length; joint += 1) {
                var armX = end.x - points[joint].x, armY = end.y - points[joint].y;
                var gradient = -armY * errorX + armX * errorY;
                angles[joint] += gradient / (armX * armX + armY * armY + 1200) * 0.7;
            }
        }
        return forwardChain(origin, lengths, angles);
    }

    function solveAnalyticTwoLink(origin, target, lengths, bend) {
        var first = lengths[0], second = lengths[1], dx = target.x - origin.x, dy = target.y - origin.y;
        var distance = h.clamp(Math.hypot(dx, dy), Math.abs(first - second) + 0.001, first + second - 0.001);
        var base = Math.atan2(dy, dx);
        var shoulderOffset = Math.acos(h.clamp((first * first + distance * distance - second * second) / (2 * first * distance), -1, 1));
        var shoulder = base + (bend < 0 ? -shoulderOffset : shoulderOffset);
        var elbow = { x: origin.x + Math.cos(shoulder) * first, y: origin.y + Math.sin(shoulder) * first };
        var end = { x: origin.x + Math.cos(base) * distance, y: origin.y + Math.sin(base) * distance };
        return [{ x: origin.x, y: origin.y }, elbow, end];
    }

    var chainSolvers = [solveFabrik, solveCCD, solveJacobian, solveAnalyticTwoLink];

    function drawArticulated(state, now) {
        begin(state, now);
        var ctx=state.ctx,w=state.api.size.width,hgt=state.api.size.height,mode=state.def.algorithmIndex;
        var chains = mode === 2 ? 7 : mode === 3 ? 2 : 4;
        for (var c=0;c<chains;c+=1) {
            var origin={x:w*(.18+(c%4)*.2),y:hgt*(mode===2?.78:.72)};
            var target={x:state.pointer.x*w + Math.cos(now*.001+c)*w*.05,y:state.pointer.y*hgt + Math.sin(now*.0013+c)*hgt*.05};
            if (mode===3) { origin={x:w*(c? .72:.28),y:hgt*.72}; target={x:w*.5+(c?1:-1)*w*.08,y:state.pointer.y*hgt}; }
            var segments=mode===3?2:mode===2?12:mode===1?7:9;
            var length=Math.min(w,hgt)*(mode===2?.035:.055);
            var lengths=Array.from({length:segments},function(){return length;});
            var points=chainSolvers[mode](origin,target,lengths,Math.sin(now*.001+c)*.18 || .08);
            ctx.strokeStyle=c%2?rgba(state.secondary,.52):rgba(state.accent,.68);ctx.lineWidth=mode===2?3:7;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();points.forEach(function(p,i){if(!i)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.stroke();
            points.forEach(function(p,i){ctx.fillStyle=i===points.length-1?state.secondary:"#07101e";ctx.strokeStyle=state.accent;ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,i===points.length-1?8:5,0,TAU);ctx.fill();ctx.stroke();});
        }
    }

    function ensureParticles(state, count) {
        while (state.particles.length < count) state.particles.push({x:state.random(),y:state.random()*.8,vx:(state.random()-.5)*.001,vy:state.random()*.0015,r:2+state.random()*4,phase:state.random()*TAU});
        if (state.particles.length > count) state.particles.length=count;
    }

    function drawGranular(state, now, delta) {
        begin(state,now);
        var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex;
        if(mode===0){
            var cols=state.api.isPreview?70:110,rows=state.api.isPreview?40:64;
            if(!state.granularGrid||state.granularGrid.cols!==cols)state.granularGrid={cols:cols,rows:rows,data:new Uint8Array(cols*rows)};
            var grid=state.granularGrid,steps=state.api.isPreview?2:4;
            for(var source=0;source<5;source++){var sx=Math.floor((.34+source*.08+Math.sin(now*.0007+source)*.04)*cols);grid.data[Math.max(0,Math.min(grid.data.length-1,sx))]=1+source%2;}
            if(state.pointer.down){var brushX=Math.floor(state.pointer.x*cols),brushY=Math.floor(state.pointer.y*rows);for(var by=-2;by<=2;by++)for(var bx=-2;bx<=2;bx++){var bi=(brushY+by)*cols+brushX+bx;if(bi>=0&&bi<grid.data.length)grid.data[bi]=1+(Math.abs(bx+by)%2);}}
            for(var pass=0;pass<steps;pass++)for(var y=rows-2;y>=0;y--)for(var x=0;x<cols;x++){var index=y*cols+x;if(!grid.data[index])continue;var below=index+cols;if(!grid.data[below]){grid.data[below]=grid.data[index];grid.data[index]=0;}else{var direction=(x+y+state.frameCount+pass)%2?1:-1;var diagonal=below+direction;if(x+direction>=0&&x+direction<cols&&!grid.data[diagonal]){grid.data[diagonal]=grid.data[index];grid.data[index]=0;}}}
            var cellW=w/cols,cellH=ht/rows;for(var gi=0;gi<grid.data.length;gi++){if(!grid.data[gi])continue;ctx.fillStyle=grid.data[gi]===2?state.secondary:state.accent;ctx.fillRect(gi%cols*cellW,Math.floor(gi/cols)*cellH,cellW+.4,cellH+.4);}return;
        }
        var count=state.api.isPreview?84:150;ensureParticles(state,count);
        if(mode===2){
            var cols=25,rows=15;for(var y=0;y<rows;y+=1)for(var x=0;x<cols;x+=1){var dx=x-cols/2,dy=y-rows/2;var grains=Math.abs(Math.sin(dx*1.7+dy*.9+now*.001))*4+Math.max(0,8-Math.hypot(dx,dy));var level=Math.floor(grains+state.preset)%5;ctx.fillStyle=level>3?state.secondary:level>1?state.accent:rgba(state.accent,.16);ctx.fillRect(x/cols*w,y/rows*ht,w/cols+1,ht/rows+1);}return;
        }
        var dt=Math.min(1.5,(delta||16)/16.667);
        state.particles.forEach(function(p){if(mode===1){p.vy+=.000055*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}else{p.x+=(state.pointer.x-p.x)*.0008*dt;p.y+=(state.pointer.y-p.y)*.0008*dt;}});
        for(var i=0;i<count;i++)for(var j=i+1;j<count;j++){var a=state.particles[i],b=state.particles[j],dx=(b.x-a.x)*w,dy=(b.y-a.y)*ht,distance=Math.hypot(dx,dy)||.001,minDistance=(a.r+b.r)*(mode===3?1.55:1.05);if(distance>=minDistance)continue;var correction=(minDistance-distance)/distance*.5,nx=dx*correction/w,ny=dy*correction/ht;a.x-=nx;a.y-=ny;b.x+=nx;b.y+=ny;if(mode===1){var relative=(b.vx-a.vx)*dx+(b.vy-a.vy)*dy;if(relative<0){a.vx-=dx/distance*.00004;b.vx+=dx/distance*.00004;a.vy-=dy/distance*.00004;b.vy+=dy/distance*.00004;}}}
        state.particles.forEach(function(p,index){var floor=.88-p.r/ht;if(mode===1){if(p.y>floor){p.y=floor;p.vy*=-.08;p.vx*=.88;}p.x=h.clamp(p.x,.02,.98);}else{var radius=Math.hypot(p.x-.5,p.y-.5);if(radius>.42){p.x=.5+(p.x-.5)/radius*.42;p.y=.5+(p.y-.5)/radius*.42;}}ctx.fillStyle=index%9===0?state.secondary:rgba(state.accent,.72);ctx.beginPath();ctx.arc(p.x*w,p.y*ht,p.r*(mode===3?1.35:1),0,TAU);ctx.fill();});
    }

    function drawSwarm(state,now,delta){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex,count=state.api.isPreview?72:130;ensureParticles(state,count);var dt=Math.min(2,(delta||16)/16.667);
        state.particles.forEach(function(p,i){var ax=0,ay=0;if(mode===0){for(var j=Math.max(0,i-8);j<Math.min(count,i+8);j++){if(i===j)continue;var q=state.particles[j],dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy)||1;if(d<.12){ax+=dx*.0002;ay+=dy*.0002;}if(d<.04){ax-=dx*.0018;ay-=dy*.0018;}}}else if(mode===1){ax=Math.cos(now*.0008+i*.18)*.0002;ay=Math.sin(now*.0008+i*.18)*.0002;}else if(mode===2){var dx=state.pointer.x-p.x,dy=state.pointer.y-p.y,d=Math.hypot(dx,dy)||1;ax+=dx/d*.00022*(state.pointer.down?-1:1);ay+=dy/d*.00022*(state.pointer.down?-1:1);}else{var field=Math.sin(p.x*18+now*.001)+Math.cos(p.y*16-now*.0013);ax=Math.cos(field*3)*.00025;ay=Math.sin(field*3)*.00025;state.trails.push({x:p.x,y:p.y,life:1});}
            p.vx=(p.vx+ax*dt)*.992;p.vy=(p.vy+ay*dt)*.992;var speed=Math.hypot(p.vx,p.vy)||1,max=.004;if(speed>max){p.vx=p.vx/speed*max;p.vy=p.vy/speed*max;}p.x=(p.x+p.vx*dt+1)%1;p.y=(p.y+p.vy*dt+1)%1;var angle=Math.atan2(p.vy,p.vx);ctx.save();ctx.translate(p.x*w,p.y*ht);ctx.rotate(angle);ctx.fillStyle=i%11===0?state.secondary:state.accent;ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(-5,-3.5);ctx.lineTo(-2,0);ctx.lineTo(-5,3.5);ctx.closePath();ctx.fill();ctx.restore();});
        if(mode===3){state.trails=state.trails.slice(-1000);state.trails.forEach(function(t){t.life*=.986;ctx.fillStyle=rgba(state.secondary,t.life*.16);ctx.fillRect(t.x*w,t.y*ht,2,2);});}
    }

    function ensureNodes(state, count) {
        while (state.nodes.length < count) state.nodes.push({ x: 0.12 + state.random() * 0.76, y: 0.12 + state.random() * 0.76, vx: 0, vy: 0, size: 3 + state.random() * 5, group: Math.floor(state.random() * 4) });
        if (state.nodes.length > count) state.nodes.length = count;
    }

    function initNetworkGraph(state, count, mode) {
        ensureNodes(state, count);
        var edges = [];
        if (mode === 3) {
            for (var child = 1; child < count; child += 1) edges.push([(child - 1) >> 1, child]);
        } else {
            for (var index = 0; index < count; index += 1) {
                edges.push([index, (index + 1) % count]);
                if (index % 2 === 0) edges.push([index, (index * 7 + 5) % count]);
                if (index % 5 === 0) edges.push([index, (index + Math.floor(count / 3)) % count]);
            }
        }
        var distances = Array.from({ length: count }, function (_, row) {
            var values = new Float32Array(count);
            values.fill(count);
            values[row] = 0;
            return values;
        });
        edges.forEach(function (edge) { distances[edge[0]][edge[1]] = 1; distances[edge[1]][edge[0]] = 1; });
        for (var pivot = 0; pivot < count; pivot += 1) for (var row = 0; row < count; row += 1) for (var column = 0; column < count; column += 1) {
            var candidate = distances[row][pivot] + distances[pivot][column];
            if (candidate < distances[row][column]) distances[row][column] = candidate;
        }
        state.networkGraph = { count: count, mode: mode, edges: edges, distances: distances };
    }

    function drawNetworks(state, now, delta) {
        begin(state, now);
        var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height, mode = state.def.algorithmIndex;
        var count = mode === 3 ? 31 : state.api.isPreview ? 28 : 44;
        if (!state.networkGraph || state.networkGraph.count !== count || state.networkGraph.mode !== mode) initNetworkGraph(state, count, mode);
        var graph = state.networkGraph, dt = Math.min(1.5, (delta || 16) / 16.667), nodes = state.nodes;

        if (mode === 0) {
            for (var aIndex = 0; aIndex < count; aIndex += 1) for (var bIndex = aIndex + 1; bIndex < count; bIndex += 1) {
                var a = nodes[aIndex], b = nodes[bIndex], dx = a.x - b.x, dy = a.y - b.y, distance2 = dx * dx + dy * dy + 0.0015;
                var repulsion = 0.000018 / distance2;
                a.vx += dx * repulsion; a.vy += dy * repulsion; b.vx -= dx * repulsion; b.vy -= dy * repulsion;
            }
            graph.edges.forEach(function (edge) {
                var a = nodes[edge[0]], b = nodes[edge[1]], dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy) || 0.001;
                var attraction = (distance - 0.13) * 0.0017 / distance;
                a.vx += dx * attraction; a.vy += dy * attraction; b.vx -= dx * attraction; b.vy -= dy * attraction;
            });
        } else if (mode === 1) {
            for (var i = 0; i < count; i += 1) for (var j = i + 1; j < count; j += 1) {
                var graphDistance = graph.distances[i][j], first = nodes[i], second = nodes[j];
                var offsetX = second.x - first.x, offsetY = second.y - first.y, current = Math.hypot(offsetX, offsetY) || 0.001;
                var desired = Math.min(0.52, 0.055 * graphDistance), spring = 0.0028 / (graphDistance * graphDistance);
                var force = (current - desired) * spring / current;
                first.vx += offsetX * force; first.vy += offsetY * force; second.vx -= offsetX * force; second.vy -= offsetY * force;
            }
        } else if (mode === 2) {
            var targets = nodes.map(function (node, i) {
                var sumX = 0, sumY = 0, weightSum = 0;
                for (var j = 0; j < count; j += 1) {
                    if (i === j) continue;
                    var other = nodes[j], graphDistance = graph.distances[i][j], weight = 1 / (graphDistance * graphDistance);
                    var dx = node.x - other.x, dy = node.y - other.y, current = Math.hypot(dx, dy) || 0.001, ideal = Math.min(0.5, graphDistance * 0.05);
                    sumX += weight * (other.x + ideal * dx / current); sumY += weight * (other.y + ideal * dy / current); weightSum += weight;
                }
                return { x: sumX / weightSum, y: sumY / weightSum };
            });
            targets.forEach(function (target, index) { nodes[index].vx += (target.x - nodes[index].x) * 0.035; nodes[index].vy += (target.y - nodes[index].y) * 0.035; });
        } else {
            nodes.forEach(function (node, index) {
                var layer = Math.floor(Math.log2(index + 1)), firstInLayer = Math.pow(2, layer) - 1, layerCount = Math.pow(2, layer);
                var targetX = 0.1 + layer / 4 * 0.8, targetY = 0.09 + ((index - firstInLayer) + 0.5) / layerCount * 0.82;
                node.x += (targetX - node.x) * 0.075; node.y += (targetY - node.y) * 0.075;
            });
        }

        if (mode !== 3) nodes.forEach(function (node) {
            if (state.pointer.down) { node.vx += (state.pointer.x - node.x) * 0.00045; node.vy += (state.pointer.y - node.y) * 0.00045; }
            node.vx *= 0.88; node.vy *= 0.88;
            node.x = h.clamp(node.x + node.vx * dt, 0.045, 0.955); node.y = h.clamp(node.y + node.vy * dt, 0.055, 0.945);
        });

        ctx.lineWidth = 1;
        graph.edges.forEach(function (edge, index) {
            var a = nodes[edge[0]], b = nodes[edge[1]];
            ctx.strokeStyle = rgba(index % 3 ? state.accent : state.secondary, mode === 2 ? 0.26 : 0.2);
            ctx.beginPath(); ctx.moveTo(a.x * w, a.y * ht);
            if (mode === 3) { var midX = (a.x + b.x) * 0.5 * w; ctx.bezierCurveTo(midX, a.y * ht, midX, b.y * ht, b.x * w, b.y * ht); }
            else ctx.lineTo(b.x * w, b.y * ht);
            ctx.stroke();
        });
        nodes.forEach(function (node, index) {
            ctx.fillStyle = index % 9 === 0 ? state.secondary : state.accent;
            ctx.beginPath(); ctx.arc(node.x * w, node.y * ht, node.size, 0, TAU); ctx.fill();
        });
    }

    function addEdenFrontier(growth, x, y) {
        if (x < 0 || y < 0 || x >= growth.cols || y >= growth.rows) return;
        var index = y * growth.cols + x;
        if (growth.cells[index] || growth.frontierMask[index]) return;
        growth.frontierMask[index] = 1;
        growth.frontier.push(index);
    }

    function initGrowth(state, mode) {
        var preview = state.api.isPreview;
        if (mode === 0) {
            var walkers = Array.from({ length: preview ? 20 : 34 }, function () { return { x: state.random(), y: state.random(), angle: state.random() * TAU }; });
            state.growth = { mode: mode, cluster: [{ x: 0.5, y: 0.5 }], walkers: walkers };
        } else if (mode === 1) {
            var attractors = Array.from({ length: preview ? 90 : 170 }, function () {
                var angle = state.random() * TAU, radius = Math.sqrt(state.random());
                return { x: 0.5 + Math.cos(angle) * radius * 0.39, y: 0.47 + Math.sin(angle) * radius * 0.36 };
            });
            state.growth = { mode: mode, attractors: attractors, branches: [{ x: 0.5, y: 0.9, parent: -1 }] };
        } else if (mode === 2) {
            var cols = preview ? 64 : 92, rows = preview ? 38 : 54;
            var agents = Array.from({ length: preview ? 150 : 280 }, function () { return { x: 0.44 + state.random() * 0.12, y: 0.44 + state.random() * 0.12, angle: state.random() * TAU }; });
            state.growth = { mode: mode, cols: cols, rows: rows, trail: new Float32Array(cols * rows), next: new Float32Array(cols * rows), agents: agents };
        } else {
            var edenCols = preview ? 70 : 100, edenRows = preview ? 42 : 60, cells = new Uint8Array(edenCols * edenRows), frontierMask = new Uint8Array(cells.length);
            var seedX = Math.floor(edenCols * 0.5), seedY = Math.floor(edenRows * 0.5), seed = seedY * edenCols + seedX;
            cells[seed] = 1;
            state.growth = { mode: mode, cols: edenCols, rows: edenRows, cells: cells, frontierMask: frontierMask, frontier: [] };
            addEdenFrontier(state.growth, seedX + 1, seedY); addEdenFrontier(state.growth, seedX - 1, seedY); addEdenFrontier(state.growth, seedX, seedY + 1); addEdenFrontier(state.growth, seedX, seedY - 1);
        }
    }

    function drawGrowth(state, now) {
        var mode = state.def.algorithmIndex;
        if (!state.growth || state.growth.mode !== mode) initGrowth(state, mode);
        begin(state, now, mode === 2 ? 0.08 : 0.16);
        var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height, growth = state.growth;

        if (mode === 0) {
            var cluster = growth.cluster, stickDistance = state.api.isPreview ? 0.018 : 0.012, steps = state.api.isPreview ? 2 : 3;
            for (var pass = 0; pass < steps; pass += 1) growth.walkers.forEach(function (walker) {
                walker.angle += (state.random() - 0.5) * 1.8;
                walker.x += Math.cos(walker.angle) * 0.006 + (0.5 - walker.x) * 0.0006;
                walker.y += Math.sin(walker.angle) * 0.006 + (0.5 - walker.y) * 0.0006;
                if (walker.x < 0 || walker.x > 1 || walker.y < 0 || walker.y > 1) { walker.x = state.random(); walker.y = state.random() < 0.5 ? 0.02 : 0.98; }
                for (var index = cluster.length - 1; index >= 0; index -= 1) {
                    if (Math.hypot(walker.x - cluster[index].x, walker.y - cluster[index].y) < stickDistance) {
                        cluster.push({ x: walker.x, y: walker.y });
                        var border = Math.floor(state.random() * 4);
                        walker.x = border < 2 ? state.random() : border === 2 ? 0.02 : 0.98;
                        walker.y = border > 1 ? state.random() : border === 0 ? 0.02 : 0.98;
                        break;
                    }
                }
            });
            if (cluster.length > (state.api.isPreview ? 900 : 1600)) cluster.splice(1, cluster.length - (state.api.isPreview ? 900 : 1600));
            cluster.forEach(function (point, index) { ctx.fillStyle = index % 17 ? rgba(state.accent, 0.62) : state.secondary; ctx.beginPath(); ctx.arc(point.x * w, point.y * ht, index ? 1.5 : 5, 0, TAU); ctx.fill(); });
            growth.walkers.forEach(function (walker) { ctx.fillStyle = rgba(state.secondary, 0.34); ctx.fillRect(walker.x * w, walker.y * ht, 1.5, 1.5); });
            return;
        }

        if (mode === 1) {
            var branches = growth.branches, attractors = growth.attractors, influence = 0.12, kill = 0.026;
            var accumulators = branches.map(function () { return { x: 0, y: 0, count: 0 }; });
            growth.attractors = attractors.filter(function (attractor) {
                var nearest = -1, nearestDistance = Infinity;
                branches.forEach(function (branch, index) { var distance = Math.hypot(attractor.x - branch.x, attractor.y - branch.y); if (distance < nearestDistance) { nearestDistance = distance; nearest = index; } });
                if (nearestDistance < kill) return false;
                if (nearestDistance < influence) { var dx = attractor.x - branches[nearest].x, dy = attractor.y - branches[nearest].y, length = Math.hypot(dx, dy) || 1; accumulators[nearest].x += dx / length; accumulators[nearest].y += dy / length; accumulators[nearest].count += 1; }
                return true;
            });
            accumulators.forEach(function (accumulator, index) {
                if (!accumulator.count || branches.length > (state.api.isPreview ? 620 : 1100)) return;
                var length = Math.hypot(accumulator.x, accumulator.y) || 1, parent = branches[index];
                branches.push({ x: parent.x + accumulator.x / length * 0.014, y: parent.y + accumulator.y / length * 0.014, parent: index });
            });
            branches.forEach(function (branch, index) { if (branch.parent < 0) return; var parent = branches[branch.parent]; ctx.strokeStyle = index % 19 ? rgba(state.accent, 0.42) : state.secondary; ctx.lineWidth = 1 + Math.max(0, 2 - index / 160); ctx.beginPath(); ctx.moveTo(parent.x * w, parent.y * ht); ctx.lineTo(branch.x * w, branch.y * ht); ctx.stroke(); });
            growth.attractors.forEach(function (point) { ctx.fillStyle = rgba(state.secondary, 0.24); ctx.fillRect(point.x * w, point.y * ht, 2, 2); });
            return;
        }

        if (mode === 2) {
            var cols = growth.cols, rows = growth.rows, trail = growth.trail, next = growth.next;
            function sense(agent, angle) { var sx = Math.floor(wrap01(agent.x + Math.cos(angle) * 0.034) * cols), sy = Math.floor(wrap01(agent.y + Math.sin(angle) * 0.034) * rows); return trail[sy * cols + sx]; }
            growth.agents.forEach(function (agent, index) {
                var left = sense(agent, agent.angle - 0.55), forward = sense(agent, agent.angle), right = sense(agent, agent.angle + 0.55);
                if (forward < left || forward < right) agent.angle += left > right ? -0.42 : left < right ? 0.42 : (state.random() - 0.5) * 0.8;
                agent.angle += (state.random() - 0.5) * 0.08;
                agent.x = wrap01(agent.x + Math.cos(agent.angle) * 0.0055); agent.y = wrap01(agent.y + Math.sin(agent.angle) * 0.0055);
                trail[Math.floor(agent.y * rows) * cols + Math.floor(agent.x * cols)] = Math.min(1, trail[Math.floor(agent.y * rows) * cols + Math.floor(agent.x * cols)] + 0.55);
                if (index % 5 === 0) { ctx.fillStyle = state.secondary; ctx.fillRect(agent.x * w, agent.y * ht, 1.6, 1.6); }
            });
            if (state.pointer.down) trail[Math.floor(state.pointer.y * rows) * cols + Math.floor(state.pointer.x * cols)] = 1;
            for (var y = 0; y < rows; y += 1) for (var x = 0; x < cols; x += 1) {
                var sum = 0; for (var oy = -1; oy <= 1; oy += 1) for (var ox = -1; ox <= 1; ox += 1) sum += trail[((y + oy + rows) % rows) * cols + (x + ox + cols) % cols];
                next[y * cols + x] = sum / 9 * 0.965;
            }
            growth.trail = next; growth.next = trail;
            var cellW = w / cols, cellH = ht / rows;
            for (var cell = 0; cell < growth.trail.length; cell += 1) if (growth.trail[cell] > 0.025) { ctx.fillStyle = rgba(cell % 7 ? state.accent : state.secondary, Math.min(0.58, growth.trail[cell] * 0.52)); ctx.fillRect(cell % cols * cellW, Math.floor(cell / cols) * cellH, cellW + 0.5, cellH + 0.5); }
            return;
        }

        var additions = state.api.isPreview ? 8 : 15;
        for (var add = 0; add < additions && growth.frontier.length; add += 1) {
            var selected = Math.floor(state.random() * growth.frontier.length), cellIndex = growth.frontier[selected];
            growth.frontier[selected] = growth.frontier[growth.frontier.length - 1]; growth.frontier.pop(); growth.frontierMask[cellIndex] = 0; growth.cells[cellIndex] = 1;
            var cellX = cellIndex % growth.cols, cellY = Math.floor(cellIndex / growth.cols);
            addEdenFrontier(growth, cellX + 1, cellY); addEdenFrontier(growth, cellX - 1, cellY); addEdenFrontier(growth, cellX, cellY + 1); addEdenFrontier(growth, cellX, cellY - 1);
        }
        var edenW = w / growth.cols, edenH = ht / growth.rows;
        for (var edenIndex = 0; edenIndex < growth.cells.length; edenIndex += 1) if (growth.cells[edenIndex]) { ctx.fillStyle = edenIndex % 13 ? rgba(state.accent, 0.68) : state.secondary; ctx.fillRect(edenIndex % growth.cols * edenW, Math.floor(edenIndex / growth.cols) * edenH, edenW + 0.35, edenH + 0.35); }
    }

    function initCells(state,cols,rows,states){
        var cells=new Uint8Array(cols*rows);for(var i=0;i<cells.length;i++)cells[i]=state.random()>(states>2?.7:.78)?Math.floor(state.random()*states):0;state.cells={data:cells,next:new Uint8Array(cells.length),cols:cols,rows:rows,states:states};
    }

    function stepCells(state){
        var grid=state.cells,data=grid.data,next=grid.next,cols=grid.cols,rows=grid.rows,mode=state.def.algorithmIndex;
        for(var y=0;y<rows;y++)for(var x=0;x<cols;x++){var index=y*cols+x;if(mode===0){var count=0;for(var oy=-1;oy<=1;oy++)for(var ox=-1;ox<=1;ox++){if(!ox&&!oy)continue;count+=data[((y+oy+rows)%rows)*cols+(x+ox+cols)%cols]?1:0;}next[index]=data[index]?(count===2||count===3):count===3;}else if(mode===1){var left=data[((y-1+rows)%rows)*cols+(x-1+cols)%cols],center=data[((y-1+rows)%rows)*cols+x],right=data[((y-1+rows)%rows)*cols+(x+1)%cols];var rule=[30,90,110,150][state.preset];next[index]=(rule>>((left<<2)|(center<<1)|right))&1;}else if(mode===2){var current=data[index],target=(current+1)%grid.states,found=false;for(var yy=-1;yy<=1;yy++)for(var xx=-1;xx<=1;xx++)if(data[((y+yy+rows)%rows)*cols+(x+xx+cols)%cols]===target)found=true;next[index]=found?target:current;}else{var sum=0;for(var ky=-2;ky<=2;ky++)for(var kx=-2;kx<=2;kx++)sum+=data[((y+ky+rows)%rows)*cols+(x+kx+cols)%cols];var avg=sum/25;next[index]=avg>0.34&&avg<0.66?1:data[index]*.94>state.random()?1:0;}}
        grid.data=next;grid.next=data;
    }

    function drawCellular(state,now){
        var cols=state.api.isPreview?54:84,rows=state.api.isPreview?30:48,states=state.def.algorithmIndex===2?8:2;if(!state.cells||state.cells.cols!==cols)initCells(state,cols,rows,states);if(now-state.lastStep>(state.def.algorithmIndex===3?45:85)){stepCells(state);state.lastStep=now;}begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,cw=w/cols,ch=ht/rows,data=state.cells.data;for(var i=0;i<data.length;i++){var value=data[i];if(!value)continue;var x=i%cols,y=Math.floor(i/cols);ctx.fillStyle=state.def.algorithmIndex===2?(value%2?state.accent:state.secondary):value?state.accent:rgba(state.secondary,.1);ctx.globalAlpha=state.def.algorithmIndex===2?.25+value/states*.75:.75;ctx.fillRect(x*cw+.5,y*ch+.5,cw-.8,ch-.8);}ctx.globalAlpha=1;
    }

    function initPathGrid(state) {
        var cols = state.api.isPreview ? 28 : 36, rows = state.api.isPreview ? 17 : 22, blocked = new Uint8Array(cols * rows);
        for (var index = 0; index < blocked.length; index += 1) {
            var x = index % cols, y = Math.floor(index / cols);
            blocked[index] = state.random() < 0.19 && x > 2 && x < cols - 3 && y > 1 && y < rows - 2 ? 1 : 0;
        }
        state.cells = { cols: cols, rows: rows, blocked: blocked, path: [], visited: new Uint8Array(blocked.length), distance: new Int32Array(blocked.length) };
        state.pathAgents = [];
    }

    function computeFlowField(state, goal) {
        var grid = state.cells, cols = grid.cols, rows = grid.rows, distance = grid.distance, queue = [goal.y * cols + goal.x], head = 0;
        distance.fill(-1); distance[queue[0]] = 0;
        while (head < queue.length) {
            var index = queue[head++], x = index % cols, y = Math.floor(index / cols);
            [[1,0],[-1,0],[0,1],[0,-1]].forEach(function (direction) {
                var nx = x + direction[0], ny = y + direction[1], next = ny * cols + nx;
                if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || grid.blocked[next] || distance[next] !== -1) return;
                distance[next] = distance[index] + 1; queue.push(next);
            });
        }
        grid.visited = new Uint8Array(grid.blocked.length);
        queue.forEach(function (index) { grid.visited[index] = 1; });
        var start = { x: 1, y: Math.floor(rows * 0.5) }, path = [start], cursor = start;
        for (var step = 0; step < cols * rows && distance[cursor.y * cols + cursor.x] > 0; step += 1) {
            var best = cursor, bestDistance = distance[cursor.y * cols + cursor.x];
            [[1,0],[-1,0],[0,1],[0,-1]].forEach(function (direction) {
                var nx = cursor.x + direction[0], ny = cursor.y + direction[1];
                if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return;
                var candidate = distance[ny * cols + nx];
                if (candidate >= 0 && candidate < bestDistance) { bestDistance = candidate; best = { x: nx, y: ny }; }
            });
            if (best === cursor) break; cursor = best; path.push(cursor);
        }
        grid.path = path.slice().reverse();
    }

    function computeGridPath(state) {
        var grid = state.cells, cols = grid.cols, rows = grid.rows, mode = state.def.algorithmIndex;
        var start = { x: 1, y: Math.floor(rows * 0.5) }, goal = { x: cols - 2, y: h.clamp(Math.floor(state.pointer.y * rows), 1, rows - 2) };
        grid.blocked[start.y * cols + start.x] = 0; grid.blocked[goal.y * cols + goal.x] = 0;
        if (mode === 3) { computeFlowField(state, goal); return; }
        var total = cols * rows, costs = new Float32Array(total), came = new Int32Array(total), visited = new Uint8Array(total), open = [start];
        costs.fill(Infinity); came.fill(-1); costs[start.y * cols + start.x] = 0;
        function walkable(x, y) { return x >= 0 && y >= 0 && x < cols && y < rows && !grid.blocked[y * cols + x]; }
        function heuristic(point) {
            var dx = Math.abs(goal.x - point.x), dy = Math.abs(goal.y - point.y);
            return mode === 1 ? 0 : mode === 2 ? Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy) : dx + dy;
        }
        function jump(x, y, dx, dy) {
            var nx = x + dx, ny = y + dy;
            if (!walkable(nx, ny)) return null;
            if (nx === goal.x && ny === goal.y) return { x: nx, y: ny };
            if (dx && dy) {
                if ((!walkable(nx - dx, ny) && walkable(nx - dx, ny + dy)) || (!walkable(nx, ny - dy) && walkable(nx + dx, ny - dy))) return { x: nx, y: ny };
                if (jump(nx, ny, dx, 0) || jump(nx, ny, 0, dy)) return { x: nx, y: ny };
            } else if (dx) {
                if ((!walkable(nx, ny + 1) && walkable(nx + dx, ny + 1)) || (!walkable(nx, ny - 1) && walkable(nx + dx, ny - 1))) return { x: nx, y: ny };
            } else if ((!walkable(nx + 1, ny) && walkable(nx + 1, ny + dy)) || (!walkable(nx - 1, ny) && walkable(nx - 1, ny + dy))) return { x: nx, y: ny };
            return jump(nx, ny, dx, dy);
        }
        while (open.length) {
            open.sort(function (a, b) { return costs[a.y * cols + a.x] + heuristic(a) - costs[b.y * cols + b.x] - heuristic(b); });
            var current = open.shift(), currentIndex = current.y * cols + current.x;
            if (visited[currentIndex]) continue;
            visited[currentIndex] = 1;
            if (current.x === goal.x && current.y === goal.y) break;
            var successors = [];
            if (mode === 2) {
                [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(function (direction) { var point = jump(current.x, current.y, direction[0], direction[1]); if (point) successors.push(point); });
            } else {
                [[1,0],[-1,0],[0,1],[0,-1]].forEach(function (direction) { var nx = current.x + direction[0], ny = current.y + direction[1]; if (walkable(nx, ny)) successors.push({ x: nx, y: ny }); });
            }
            successors.forEach(function (next) {
                var nextIndex = next.y * cols + next.x, newCost = costs[currentIndex] + Math.hypot(next.x - current.x, next.y - current.y);
                if (newCost < costs[nextIndex]) { costs[nextIndex] = newCost; came[nextIndex] = currentIndex; open.push(next); }
            });
        }
        var path = [], cursor = goal.y * cols + goal.x, safety = 0;
        while (cursor >= 0 && safety++ < total) { path.push({ x: cursor % cols, y: Math.floor(cursor / cols) }); if (cursor === start.y * cols + start.x) break; cursor = came[cursor]; }
        if (!path.length || path[path.length - 1].x !== start.x) path = [goal];
        grid.path = path; grid.visited = visited;
    }

    function drawPathPlanning(state, now) {
        if (!state.cells || !state.cells.blocked) initPathGrid(state);
        computeGridPath(state); begin(state, now);
        var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height, grid = state.cells, cellW = w / grid.cols, cellH = ht / grid.rows;
        for (var index = 0; index < grid.blocked.length; index += 1) {
            var x = index % grid.cols, y = Math.floor(index / grid.cols);
            if (grid.blocked[index]) ctx.fillStyle = rgba(state.secondary, 0.48);
            else if (grid.visited[index]) ctx.fillStyle = rgba(state.accent, state.def.algorithmIndex === 3 ? 0.035 : 0.09);
            else continue;
            ctx.fillRect(x * cellW + 0.5, y * cellH + 0.5, cellW - 1, cellH - 1);
        }
        ctx.strokeStyle = state.accent; ctx.lineWidth = Math.max(2, cellW * 0.18); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
        grid.path.slice().reverse().forEach(function (point, index) { var x = (point.x + 0.5) * cellW, y = (point.y + 0.5) * cellH; if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke();

        if (state.def.algorithmIndex === 2) grid.path.forEach(function (point, index) { ctx.fillStyle = index % 2 ? state.secondary : "#fff"; ctx.beginPath(); ctx.arc((point.x + 0.5) * cellW, (point.y + 0.5) * cellH, 3.2, 0, TAU); ctx.fill(); });
        if (state.def.algorithmIndex === 3) {
            for (var yy = 1; yy < grid.rows - 1; yy += 2) for (var xx = 1; xx < grid.cols - 1; xx += 2) {
                var currentDistance = grid.distance[yy * grid.cols + xx]; if (currentDistance < 0) continue;
                var bestX = xx, bestY = yy, bestDistance = currentDistance;
                [[1,0],[-1,0],[0,1],[0,-1]].forEach(function (direction) { var nx = xx + direction[0], ny = yy + direction[1], candidate = grid.distance[ny * grid.cols + nx]; if (candidate >= 0 && candidate < bestDistance) { bestDistance = candidate; bestX = nx; bestY = ny; } });
                ctx.strokeStyle = rgba(state.secondary, 0.42); ctx.beginPath(); ctx.moveTo((xx + 0.5) * cellW, (yy + 0.5) * cellH); ctx.lineTo((xx + 0.5 + (bestX - xx) * 0.7) * cellW, (yy + 0.5 + (bestY - yy) * 0.7) * cellH); ctx.stroke();
            }
            while (state.pathAgents.length < (state.api.isPreview ? 14 : 28)) state.pathAgents.push({ x: 1.5, y: 1.5 + state.random() * (grid.rows - 3) });
            state.pathAgents.forEach(function (agent, index) {
                var gx = h.clamp(Math.floor(agent.x), 0, grid.cols - 1), gy = h.clamp(Math.floor(agent.y), 0, grid.rows - 1), best = { x: gx, y: gy, d: grid.distance[gy * grid.cols + gx] };
                [[1,0],[-1,0],[0,1],[0,-1]].forEach(function (direction) { var nx = gx + direction[0], ny = gy + direction[1]; if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows) return; var distance = grid.distance[ny * grid.cols + nx]; if (distance >= 0 && (best.d < 0 || distance < best.d)) best = { x: nx, y: ny, d: distance }; });
                agent.x += (best.x + 0.5 - agent.x) * 0.11; agent.y += (best.y + 0.5 - agent.y) * 0.11;
                if (best.d <= 1) { agent.x = 1.5; agent.y = 1.5 + state.random() * (grid.rows - 3); }
                ctx.fillStyle = index % 5 ? state.accent : state.secondary; ctx.beginPath(); ctx.arc(agent.x * cellW, agent.y * cellH, 3.3, 0, TAU); ctx.fill();
            });
        }
    }

    function drawComputationalGeometry(state,now){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex;ensureNodes(state,mode===3?18:22);state.nodes.forEach(function(n,i){n.x=h.clamp(n.x+Math.sin(now*.0004+i)*.00035,.05,.95);n.y=h.clamp(n.y+Math.cos(now*.00037+i*2)*.0003,.05,.95);});
        if(mode===0){var size=state.api.isPreview?18:12;for(var y=0;y<ht;y+=size)for(var x=0;x<w;x+=size){var best=Infinity,owner=0;state.nodes.forEach(function(n,i){var d=(n.x*w-x)*(n.x*w-x)+(n.y*ht-y)*(n.y*ht-y);if(d<best){best=d;owner=i;}});ctx.fillStyle=owner%2?rgba(state.accent,.22):rgba(state.secondary,.18);ctx.fillRect(x,y,size+1,size+1);}}
        else if(mode===1){ctx.strokeStyle=rgba(state.accent,.32);for(var i=0;i<state.nodes.length;i++){var distances=state.nodes.map(function(n,j){return {j:j,d:Math.hypot(n.x-state.nodes[i].x,n.y-state.nodes[i].y)};}).sort(function(a,b){return a.d-b.d;}).slice(1,4);distances.forEach(function(item){ctx.beginPath();ctx.moveTo(state.nodes[i].x*w,state.nodes[i].y*ht);ctx.lineTo(state.nodes[item.j].x*w,state.nodes[item.j].y*ht);ctx.stroke();});}}
        else if(mode===2){var pts=state.nodes.map(function(n){return{x:n.x*w,y:n.y*ht};}).sort(function(a,b){return a.x===b.x?a.y-b.y:a.x-b.x;});function cross(o,a,b){return(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);}var lower=[],upper=[];pts.forEach(function(p){while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],p)<=0)lower.pop();lower.push(p);});pts.slice().reverse().forEach(function(p){while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],p)<=0)upper.pop();upper.push(p);});var hull=lower.slice(0,-1).concat(upper.slice(0,-1));ctx.fillStyle=rgba(state.accent,.12);ctx.strokeStyle=state.accent;ctx.lineWidth=2;ctx.beginPath();hull.forEach(function(p,i){if(!i)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.closePath();ctx.fill();ctx.stroke();}
        else{var cols=34,rows=21,cw=w/(cols-1),ch=ht/(rows-1);ctx.strokeStyle=state.accent;ctx.lineWidth=1.5;for(var gy=0;gy<rows-1;gy++)for(var gx=0;gx<cols-1;gx++){var values=[[0,0],[1,0],[1,1],[0,1]].map(function(o){var nx=(gx+o[0])/(cols-1),ny=(gy+o[1])/(rows-1);return Math.sin(nx*12+now*.001)+Math.cos(ny*11-now*.0013)+Math.exp(-Math.hypot(nx-state.pointer.x,ny-state.pointer.y)*8)*2;});var mask=values.reduce(function(m,v,i){return m|(v>0?1<<i:0);},0);if(mask===0||mask===15)continue;ctx.beginPath();ctx.moveTo((gx+.5)*cw,gy*ch);ctx.lineTo((gx+.5)*cw,(gy+1)*ch);ctx.stroke();}}
        state.nodes.forEach(function(n,i){ctx.fillStyle=i%5===0?state.secondary:state.accent;ctx.beginPath();ctx.arc(n.x*w,n.y*ht,3.5,0,TAU);ctx.fill();});
    }

    function curvePoint(mode, points, t) {
        if (mode === 0) {
            var a = 1 - t;
            return { x: a*a*a*points[0].x + 3*a*a*t*points[1].x + 3*a*t*t*points[2].x + t*t*t*points[3].x, y: a*a*a*points[0].y + 3*a*a*t*points[1].y + 3*a*t*t*points[2].y + t*t*t*points[3].y };
        }
        if (mode === 1) {
            var segment = Math.min(points.length - 4, Math.floor(t * (points.length - 3)));
            var u = t * (points.length - 3) - segment;
            var p0=points[segment],p1=points[segment+1],p2=points[segment+2],p3=points[segment+3];
            return {x:.5*((2*p1.x)+(-p0.x+p2.x)*u+(2*p0.x-5*p1.x+4*p2.x-p3.x)*u*u+(-p0.x+3*p1.x-3*p2.x+p3.x)*u*u*u),y:.5*((2*p1.y)+(-p0.y+p2.y)*u+(2*p0.y-5*p1.y+4*p2.y-p3.y)*u*u+(-p0.y+3*p1.y-3*p2.y+p3.y)*u*u*u)};
        }
        if (mode === 2) {
            var b0=Math.pow(1-t,3)/6,b1=(3*t*t*t-6*t*t+4)/6,b2=(-3*t*t*t+3*t*t+3*t+1)/6,b3=t*t*t/6;
            return{x:points[0].x*b0+points[1].x*b1+points[2].x*b2+points[3].x*b3,y:points[0].y*b0+points[1].y*b1+points[2].y*b2+points[3].y*b3};
        }
        return {x:t,y:0.5};
    }

    function drawCurves(state,now){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex,t=now*.001;
        var points=[{x:.12,y:.7},{x:.28,y:.18},{x:.54,y:.82},{x:.84,y:.28},{x:.92,y:.6},{x:.72,y:.75}];points.forEach(function(p,i){p.y+=Math.sin(t*.7+i)*.035;});if(state.pointer.down)points[2]={x:state.pointer.x,y:state.pointer.y};
        ctx.strokeStyle=rgba(state.secondary,.28);ctx.lineWidth=1;ctx.setLineDash([5,7]);ctx.beginPath();points.forEach(function(p,i){if(!i)ctx.moveTo(p.x*w,p.y*ht);else ctx.lineTo(p.x*w,p.y*ht);});ctx.stroke();ctx.setLineDash([]);
        ctx.strokeStyle=state.accent;ctx.lineWidth=4;ctx.lineCap="round";ctx.beginPath();
        if(mode<3){for(var i=0;i<=240;i++){var u=i/240,p=curvePoint(mode,points,u);if(!i)ctx.moveTo(p.x*w,p.y*ht);else ctx.lineTo(p.x*w,p.y*ht);}}
        else{var x=.14*w,y=.62*ht,angle=-.72,ds=Math.min(w,ht)*.004;ctx.moveTo(x,y);for(var step=0;step<260;step++){var s=step/260,curvature=(s-.5)*.09+(state.pointer.x-.5)*.035;angle+=curvature;x+=Math.cos(angle)*ds;y+=Math.sin(angle)*ds;ctx.lineTo(x,y);}}
        ctx.stroke();points.slice(0,mode===1?6:4).forEach(function(p,i){ctx.fillStyle=i===2?state.secondary:"#07101e";ctx.strokeStyle=state.accent;ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x*w,p.y*ht,7,0,TAU);ctx.fill();ctx.stroke();});
    }

    function drawFractal(state,now){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex;
        if(mode<2){var pixel=state.api.isPreview?6:4,zoom=1.35+state.scroll*8+Math.sin(now*.0003)*.08,cx=mode===0?-.66:-.02,cy=0;for(var y=0;y<ht;y+=pixel)for(var x=0;x<w;x+=pixel){var zx=(x/w-.5)*3/zoom+cx,zy=(y/ht-.5)*2/zoom+cy,cr=mode===0?zx:-.745+state.pointer.x*.18,ci=mode===0?zy:.113+(state.pointer.y-.5)*.24;if(mode===0){zx=0;zy=0;}var iter=0;for(;iter<42&&zx*zx+zy*zy<4;iter++){var nextX=zx*zx-zy*zy+cr;zy=2*zx*zy+ci;zx=nextX;}var alpha=iter===42?0.06:.15+iter/42*.85;ctx.fillStyle=iter%5<2?rgba(state.accent,alpha):rgba(state.secondary,alpha);ctx.fillRect(x,y,pixel+1,pixel+1);}}
        else if(mode===2){var x0=.5,y0=.1;ctx.fillStyle=rgba(state.accent,.55);for(var i=0;i<(state.api.isPreview?18000:42000);i++){var r=state.random(),nx,ny;if(r<.01){nx=0;ny=.16*y0;}else if(r<.86){nx=.85*x0+.04*y0;ny=-.04*x0+.85*y0+1.6;}else if(r<.93){nx=.2*x0-.26*y0;ny=.23*x0+.22*y0+1.6;}else{nx=-.15*x0+.28*y0;ny=.26*x0+.24*y0+.44;}x0=nx;y0=ny;ctx.fillRect(w*.5+x0*w*.09,ht*.95-y0*ht*.095,1,1);}}
        else{var iterations=14+Math.floor(state.scroll*4),segments=[{x1:w*.22,y1:ht*.68,x2:w*.78,y2:ht*.68}];for(var it=0;it<iterations;it++){var next=[];segments.forEach(function(s){var mx=(s.x1+s.x2)*.5,my=(s.y1+s.y2)*.5,dx=(s.x2-s.x1)*.5,dy=(s.y2-s.y1)*.5;next.push({x1:s.x1,y1:s.y1,x2:mx-dy,y2:my+dx},{x1:mx-dy,y1:my+dx,x2:s.x2,y2:s.y2});});segments=next;if(segments.length>12000)break;}ctx.strokeStyle=state.accent;ctx.lineWidth=1;ctx.beginPath();segments.forEach(function(s,i){if(!i)ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);});ctx.stroke();}
    }

    function initChaos(state) { state.chaos = { x: 0.1, y: 0, z: 0, x2: 0.11, y2: 0.07, a: 1.2, b: 0.6 }; state.trails = []; }
    function drawChaos(state, now) {
        if (!state.chaos) initChaos(state);
        begin(state, now, 0.075);
        var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height, mode = state.def.algorithmIndex, point = state.chaos;
        for (var index = 0; index < (state.api.isPreview ? 90 : 180); index += 1) {
            var oldX = point.x, oldY = point.y, oldZ = point.z;
            if (mode === 0) {
                var dt = 0.006, sigma = 10, rho = 25 + state.pointer.x * 7, beta = 8 / 3;
                point.x = oldX + sigma * (oldY - oldX) * dt;
                point.y = oldY + (oldX * (rho - oldZ) - oldY) * dt;
                point.z = oldZ + (oldX * oldY - beta * oldZ) * dt;
            } else if (mode === 1) {
                var a = -1.4 + state.pointer.x * 0.5, b = 1.6, c = 1, d = 0.7;
                point.x = Math.sin(a * oldY) + c * Math.cos(a * oldX);
                point.y = Math.sin(b * oldX) + d * Math.cos(b * oldY);
            } else if (mode === 2) {
                var phase = 0.4 - 6 / (1 + oldX * oldX + oldY * oldY);
                point.x = 1 + 0.9 * (oldX * Math.cos(phase) - oldY * Math.sin(phase));
                point.y = 0.9 * (oldX * Math.sin(phase) + oldY * Math.cos(phase));
            } else {
                var gravity = 9.81, length = 1, mass = 1, step = 0.008, theta1 = point.a, theta2 = point.b, omega1 = point.x2, omega2 = point.y2;
                var deltaTheta = theta1 - theta2, denominator1 = length * (2 * mass - mass * Math.cos(2 * deltaTheta));
                var acceleration1 = (-gravity * (2 * mass) * Math.sin(theta1) - mass * gravity * Math.sin(theta1 - 2 * theta2) - 2 * Math.sin(deltaTheta) * mass * (omega2 * omega2 * length + omega1 * omega1 * length * Math.cos(deltaTheta))) / denominator1;
                var denominator2 = length * (2 * mass - mass * Math.cos(2 * deltaTheta));
                var acceleration2 = (2 * Math.sin(deltaTheta) * (omega1 * omega1 * length * (2 * mass) + gravity * (2 * mass) * Math.cos(theta1) + omega2 * omega2 * length * mass * Math.cos(deltaTheta))) / denominator2;
                point.x2 += acceleration1 * step; point.y2 += acceleration2 * step; point.a += point.x2 * step; point.b += point.y2 * step;
                point.x = point.a; point.y = point.x2;
            }
            var screenX, screenY, oldScreenX, oldScreenY;
            if (mode === 0) {
                screenX = w * 0.5 + point.x * w * 0.012; screenY = ht * 0.82 - point.z * ht * 0.022;
                oldScreenX = w * 0.5 + oldX * w * 0.012; oldScreenY = ht * 0.82 - oldZ * ht * 0.022;
            } else {
                var scale = mode === 1 ? 0.16 : mode === 2 ? 0.13 : 0.18;
                screenX = w * 0.5 + point.x * w * scale; screenY = ht * 0.5 + point.y * ht * scale;
                oldScreenX = w * 0.5 + oldX * w * scale; oldScreenY = ht * 0.5 + oldY * ht * scale;
            }
            ctx.strokeStyle = index % 9 === 0 ? rgba(state.secondary, 0.55) : rgba(state.accent, 0.27); ctx.beginPath(); ctx.moveTo(oldScreenX, oldScreenY); ctx.lineTo(screenX, screenY); ctx.stroke();
        }
    }

    function drawOptics(state,now){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex,t=now*.001;
        if(mode===0){var bands=state.api.isPreview?100:160;for(var x=0;x<bands;x++){var nx=x/bands-.5,phase=nx*nx*(50+state.pointer.x*80)+Math.sin(t)*2,intensity=Math.pow(Math.cos(phase),2);ctx.fillStyle=rgba(intensity>.5?state.accent:state.secondary,.08+intensity*.78);ctx.fillRect(x/bands*w,0,w/bands+1,ht);}ctx.fillStyle="#fff";ctx.fillRect(w*.48,ht*.08,2,ht*.1);ctx.fillRect(w*.52,ht*.08,2,ht*.1);}
        else if(mode===1){ctx.lineWidth=1;for(var i=-90;i<90;i++){var angle1=(i*.07+state.pointer.x*.4),angle2=(i*.073-state.pointer.y*.35);ctx.strokeStyle=i%2?rgba(state.accent,.2):rgba(state.secondary,.18);ctx.beginPath();ctx.moveTo(w*.5-Math.cos(angle1)*w,ht*.5-Math.sin(angle1)*w);ctx.lineTo(w*.5+Math.cos(angle1)*w,ht*.5+Math.sin(angle1)*w);ctx.stroke();ctx.beginPath();ctx.moveTo(w*.5-Math.cos(angle2)*w,ht*.5-Math.sin(angle2)*w);ctx.lineTo(w*.5+Math.cos(angle2)*w,ht*.5+Math.sin(angle2)*w);ctx.stroke();}}
        else if(mode===2){var cx=state.pointer.x*w,cy=state.pointer.y*ht;var obstacles=[];for(var j=0;j<9;j++){var ox=w*(.12+(j%3)*.36),oy=ht*(.18+Math.floor(j/3)*.32),rw=w*.08,rh=ht*.055;obstacles.push({x:ox,y:oy,rw:rw,rh:rh});ctx.fillStyle="rgba(5,8,23,.85)";ctx.strokeStyle=rgba(state.secondary,.55);ctx.fillRect(ox-rw,oy-rh,rw*2,rh*2);ctx.strokeRect(ox-rw,oy-rh,rw*2,rh*2);}ctx.fillStyle=rgba(state.accent,.18);ctx.beginPath();ctx.moveTo(cx,cy);for(var r=0;r<=360;r++){var a=r/360*TAU,d=Math.max(w,ht);obstacles.forEach(function(o){var dx=o.x-cx,dy=o.y-cy,projection=dx*Math.cos(a)+dy*Math.sin(a);if(projection>0&&Math.abs(dx*Math.sin(a)-dy*Math.cos(a))<Math.max(o.rw,o.rh))d=Math.min(d,projection);});ctx.lineTo(cx+Math.cos(a)*d,cy+Math.sin(a)*d);}ctx.closePath();ctx.fill();}
        else{ctx.lineWidth=1.4;for(var ray=0;ray<70;ray++){var x0=state.pointer.x*w,y0=state.pointer.y*ht,angle=ray/70*TAU+t*.1;ctx.strokeStyle=ray%6===0?state.secondary:rgba(state.accent,.24);ctx.beginPath();ctx.moveTo(x0,y0);for(var bounce=0;bounce<6;bounce++){var dx=Math.cos(angle),dy=Math.sin(angle),tx=dx>0?(w-x0)/dx:-x0/dx,ty=dy>0?(ht-y0)/dy:-y0/dy;if(tx<ty){x0+=dx*tx;y0+=dy*tx;angle=Math.PI-angle;}else{x0+=dx*ty;y0+=dy*ty;angle=-angle;}ctx.lineTo(x0,y0);}ctx.stroke();}}
    }

    function imageValue(x, y, state, now) {
        var dx = x - 0.52, dy = y - 0.48;
        var portrait = Math.exp(-(dx * dx * 8 + dy * dy * 11));
        var rings = 0.5 + 0.5 * Math.sin(Math.hypot(dx, dy) * 36 - now * 0.0015);
        var bars = 0.5 + 0.5 * Math.sin(x * 18 + y * 9);
        return h.clamp(portrait * 0.8 + rings * 0.28 + bars * 0.16, 0, 1);
    }

    function initStipple(state, count, now) {
        state.stipple = [];
        while (state.stipple.length < count) {
            var x = state.random(), y = state.random();
            if (state.random() < imageValue(x, y, state, now)) state.stipple.push({ x: x, y: y });
        }
    }

    function drawImageReconstruction(state, now) {
        begin(state, now);
        var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height, mode = state.def.algorithmIndex;
        var cell = state.api.isPreview ? 9 : 7, cols = Math.ceil(w / cell), rows = Math.ceil(ht / cell);
        var x, y, index;

        if (mode === 0) {
            var bayer = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
            for (y = 0; y < rows; y += 1) for (x = 0; x < cols; x += 1) {
                var orderedValue = imageValue((x + 0.5) / cols, (y + 0.5) / rows, state, now);
                var threshold = (bayer[y % 4][x % 4] + 0.5) / 16;
                ctx.fillStyle = orderedValue > threshold ? (x + y) % 4 ? state.accent : state.secondary : "rgba(255,255,255,.018)";
                ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
            }
            return;
        }

        if (mode === 1) {
            var values = new Float32Array(cols * rows);
            for (y = 0; y < rows; y += 1) for (x = 0; x < cols; x += 1) values[y * cols + x] = imageValue((x + 0.5) / cols, (y + 0.5) / rows, state, now);
            for (y = 0; y < rows; y += 1) for (x = 0; x < cols; x += 1) {
                index = y * cols + x;
                var oldValue = values[index], quantized = oldValue >= 0.5 ? 1 : 0, error = oldValue - quantized;
                values[index] = quantized;
                if (x + 1 < cols) values[index + 1] += error * 7 / 16;
                if (y + 1 < rows) {
                    if (x > 0) values[index + cols - 1] += error * 3 / 16;
                    values[index + cols] += error * 5 / 16;
                    if (x + 1 < cols) values[index + cols + 1] += error / 16;
                }
                ctx.fillStyle = quantized ? (x + y) % 7 ? state.accent : state.secondary : "rgba(255,255,255,.018)";
                ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
            }
            return;
        }

        if (mode === 2) {
            var count = state.api.isPreview ? 74 : 128;
            if (!state.stipple || state.stipple.length !== count) initStipple(state, count, now);
            var accumulators = state.stipple.map(function () { return { x: 0, y: 0, weight: 0 }; });
            var samples = state.api.isPreview ? 520 : 1100;
            for (index = 0; index < samples; index += 1) {
                x = state.random(); y = state.random();
                var density = imageValue(x, y, state, now), nearest = 0, nearestDistance = Infinity;
                state.stipple.forEach(function (point, pointIndex) { var distance = (point.x - x) * (point.x - x) + (point.y - y) * (point.y - y); if (distance < nearestDistance) { nearestDistance = distance; nearest = pointIndex; } });
                accumulators[nearest].x += x * density; accumulators[nearest].y += y * density; accumulators[nearest].weight += density;
            }
            state.stipple.forEach(function (point, pointIndex) {
                var accumulator = accumulators[pointIndex];
                if (accumulator.weight) { point.x += (accumulator.x / accumulator.weight - point.x) * 0.22; point.y += (accumulator.y / accumulator.weight - point.y) * 0.22; }
                var value = imageValue(point.x, point.y, state, now);
                ctx.fillStyle = pointIndex % 9 ? state.accent : state.secondary; ctx.beginPath(); ctx.arc(point.x * w, point.y * ht, 1.8 + value * 3.6, 0, TAU); ctx.fill();
            });
            return;
        }

        var seamCols = state.api.isPreview ? 52 : 72, seamRows = state.api.isPreview ? 30 : 42;
        var pixels = new Float32Array(seamCols * seamRows), energy = new Float32Array(pixels.length), cumulative = new Float32Array(pixels.length), parent = new Int8Array(pixels.length);
        for (y = 0; y < seamRows; y += 1) for (x = 0; x < seamCols; x += 1) pixels[y * seamCols + x] = imageValue((x + 0.5) / seamCols, (y + 0.5) / seamRows, state, now);
        for (y = 0; y < seamRows; y += 1) for (x = 0; x < seamCols; x += 1) {
            index = y * seamCols + x;
            var left = pixels[y * seamCols + Math.max(0, x - 1)], right = pixels[y * seamCols + Math.min(seamCols - 1, x + 1)];
            var up = pixels[Math.max(0, y - 1) * seamCols + x], down = pixels[Math.min(seamRows - 1, y + 1) * seamCols + x];
            energy[index] = Math.abs(right - left) + Math.abs(down - up) + Math.abs(x / seamCols - state.pointer.x) * 0.025;
            if (!y) cumulative[index] = energy[index];
            else {
                var bestOffset = 0, best = cumulative[(y - 1) * seamCols + x];
                if (x > 0 && cumulative[(y - 1) * seamCols + x - 1] < best) { best = cumulative[(y - 1) * seamCols + x - 1]; bestOffset = -1; }
                if (x + 1 < seamCols && cumulative[(y - 1) * seamCols + x + 1] < best) { best = cumulative[(y - 1) * seamCols + x + 1]; bestOffset = 1; }
                cumulative[index] = energy[index] + best; parent[index] = bestOffset;
            }
        }
        var seamX = 0, minimum = Infinity;
        for (x = 0; x < seamCols; x += 1) if (cumulative[(seamRows - 1) * seamCols + x] < minimum) { minimum = cumulative[(seamRows - 1) * seamCols + x]; seamX = x; }
        var seam = new Int16Array(seamRows);
        for (y = seamRows - 1; y >= 0; y -= 1) { seam[y] = seamX; seamX += parent[y * seamCols + seamX]; }
        var seamW = w / seamCols, seamH = ht / seamRows;
        for (y = 0; y < seamRows; y += 1) for (x = 0; x < seamCols; x += 1) {
            var value = pixels[y * seamCols + x];
            ctx.fillStyle = x === seam[y] ? "#ffffff" : value > 0.55 ? rgba(state.accent, 0.78) : rgba(state.secondary, 0.12 + value * 0.42);
            ctx.fillRect(x * seamW, y * seamH, seamW + 0.3, seamH + 0.3);
        }
    }

    function ensureBuffer(state){var canvas=state.buffer;if(!canvas){canvas=document.createElement("canvas");state.buffer=canvas;state.bufferContext=canvas.getContext("2d");}var pw=state.api.canvas.width,ph=state.api.canvas.height;if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;}}
    function drawTemporal(state,now){
        ensureBuffer(state);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex,bctx=state.bufferContext;bctx.setTransform(1,0,0,1,0,0);bctx.clearRect(0,0,state.buffer.width,state.buffer.height);bctx.drawImage(state.api.canvas,0,0);ctx.fillStyle="rgba(5,8,23,.12)";ctx.fillRect(0,0,w,ht);ctx.save();ctx.globalAlpha=.91;ctx.translate(w*.5,ht*.5);if(mode===1){ctx.rotate(.012+state.pointer.x*.012);ctx.scale(.986,.986);}else if(mode===2){ctx.rotate(Math.sin(now*.0007)*.006);ctx.scale(1.004,.996);}else if(mode===3){ctx.translate(Math.sin(now*.002)*6,Math.cos(now*.0017)*4);}ctx.translate(-w*.5,-ht*.5);ctx.drawImage(state.buffer,0,0,w,ht);ctx.restore();
        if(mode===0){var slices=32;for(var i=0;i<slices;i++){var x=i/slices*w,offset=Math.sin(now*.001+i*.55)*18;ctx.globalAlpha=.5;ctx.drawImage(state.buffer,x*state.api.size.dpr,0,w/slices*state.api.size.dpr,state.buffer.height,x+offset,0,w/slices+1,ht);}ctx.globalAlpha=1;}
        var x=state.pointer.x*w,y=state.pointer.y*ht;ctx.fillStyle=state.accent;ctx.shadowColor=state.secondary;ctx.shadowBlur=28;ctx.beginPath();ctx.arc(x,y,18+Math.sin(now*.004)*7,0,TAU);ctx.fill();ctx.shadowBlur=0;for(var n=0;n<8;n++){ctx.strokeStyle=rgba(n%2?state.secondary:state.accent,.35);ctx.strokeRect(x-20-n*7,y-20-n*7,40+n*14,40+n*14);}
    }

    function rotate3D(point, ax, ay) {
        var x = point.x * Math.cos(ay) - point.z * Math.sin(ay), z = point.x * Math.sin(ay) + point.z * Math.cos(ay);
        var y = point.y * Math.cos(ax) - z * Math.sin(ax);
        z = point.y * Math.sin(ax) + z * Math.cos(ax);
        return { x: x, y: y, z: z };
    }

    var cubeVertices = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
    var cubeEdges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];

    function drawProjectedCube(state, options) {
        var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height;
        var center = options.center || { x: 0, y: 0, z: 0 }, scale = options.scale || 1, focal = options.focal || Math.min(w, ht) * 0.72, cameraDistance = options.cameraDistance || 4;
        var points = cubeVertices.map(function (vertex) {
            var point = rotate3D({ x: vertex[0] * scale, y: vertex[1] * scale, z: vertex[2] * scale }, options.ax || 0, options.ay || 0);
            point.x += center.x; point.y += center.y; point.z += center.z;
            var depth = Math.max(0.4, cameraDistance + point.z);
            return { x: w * 0.5 + (point.x - (options.cameraX || 0)) / depth * focal, y: ht * 0.5 + (point.y - (options.cameraY || 0)) / depth * focal, z: point.z };
        });
        cubeEdges.forEach(function (edge, index) {
            ctx.strokeStyle = index % 3 ? rgba(state.accent, options.alpha || 0.5) : state.secondary;
            ctx.lineWidth = options.lineWidth || 1.5; ctx.beginPath(); ctx.moveTo(points[edge[0]].x, points[edge[0]].y); ctx.lineTo(points[edge[1]].x, points[edge[1]].y); ctx.stroke();
        });
        return points;
    }

    function drawSpatial3D(state, now) {
        begin(state, now);
        var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height, mode = state.def.algorithmIndex;
        var ax = (state.pointer.y - 0.5) * 1.35, ay = (state.pointer.x - 0.5) * 1.8;

        if (mode === 0) {
            var radius = Math.min(w, ht) * 0.34;
            ctx.strokeStyle = rgba(state.secondary, 0.22); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(w * 0.5, ht * 0.5, radius, 0, TAU); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(w * 0.5, ht * 0.5, radius, radius * 0.26, 0, 0, TAU); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(w * 0.5, ht * 0.5, radius * 0.26, radius, 0, 0, TAU); ctx.stroke();
            drawProjectedCube(state, { ax: ax, ay: ay, scale: 1.1, cameraDistance: 4, focal: Math.min(w, ht) * 0.95, alpha: 0.72, lineWidth: 2.4 });
            var sphereX = w * 0.5 + (state.pointer.x - 0.5) * radius * 2, sphereY = ht * 0.5 + (state.pointer.y - 0.5) * radius * 2;
            ctx.fillStyle = state.secondary; ctx.beginPath(); ctx.arc(sphereX, sphereY, 5, 0, TAU); ctx.fill();
            return;
        }

        if (mode === 1) {
            var distance = 2.4 + state.pointer.y * 5.2, focal = distance * Math.min(w, ht) * 0.23;
            for (var depth = 0; depth < 9; depth += 1) {
                var z = depth * 1.1 - 3.8, projected = focal / Math.max(0.5, distance + z), gridWidth = w * 0.33 * projected;
                ctx.strokeStyle = rgba(depth % 2 ? state.accent : state.secondary, 0.12 + depth * 0.025);
                ctx.strokeRect(w * 0.5 - gridWidth, ht * 0.5 - gridWidth * 0.62, gridWidth * 2, gridWidth * 1.24);
            }
            drawProjectedCube(state, { ax: -0.18, ay: 0.48, scale: 0.9, cameraDistance: distance, focal: focal, alpha: 0.85, lineWidth: 2.6 });
            ctx.fillStyle = "rgba(255,255,255,.72)"; setCanvasFont(ctx, 700, 12, "Cascadia Code, monospace");
            var fov = 2 * Math.atan(ht / (2 * focal)) * 180 / Math.PI;
            ctx.fillText("DOLLY " + distance.toFixed(2) + "  /  FOV " + fov.toFixed(1) + "°", 20, 30);
            return;
        }

        if (mode === 2) {
            var explosion = 0.18 + state.pointer.x * 1.45;
            var components = [[0,0,0],[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];
            components.forEach(function (component, index) {
                var center = { x: component[0] * explosion, y: component[1] * explosion, z: component[2] * explosion };
                drawProjectedCube(state, { center: center, ax: ax * 0.35, ay: ay * 0.35 + now * 0.00008, scale: index ? 0.34 : 0.55, cameraDistance: 4.6, focal: Math.min(w, ht) * 1.15, alpha: index ? 0.48 : 0.78, lineWidth: index ? 1.4 : 2.3 });
                if (index) { ctx.strokeStyle = rgba(state.secondary, 0.3); ctx.setLineDash([4,6]); ctx.beginPath(); ctx.moveTo(w * 0.5, ht * 0.5); var projectedX = w * 0.5 + center.x / (4.6 + center.z) * Math.min(w, ht) * 1.15, projectedY = ht * 0.5 + center.y / (4.6 + center.z) * Math.min(w, ht) * 1.15; ctx.lineTo(projectedX, projectedY); ctx.stroke(); ctx.setLineDash([]); }
            });
            return;
        }

        var portal = { x: w * 0.2, y: ht * 0.17, width: w * 0.6, height: ht * 0.66 };
        ctx.fillStyle = "rgba(2,4,12,.92)"; ctx.fillRect(portal.x, portal.y, portal.width, portal.height);
        ctx.save(); ctx.beginPath(); ctx.rect(portal.x, portal.y, portal.width, portal.height); ctx.clip();
        var eyeX = (state.pointer.x - 0.5) * portal.width * 0.45, eyeY = (state.pointer.y - 0.5) * portal.height * 0.42;
        for (var layer = 0; layer < 8; layer += 1) {
            var depthScale = 1 / (1 + layer * 0.34), frameW = portal.width * depthScale, frameH = portal.height * depthScale;
            var frameX = portal.x + portal.width * 0.5 - frameW * 0.5 - eyeX * (1 - depthScale), frameY = portal.y + portal.height * 0.5 - frameH * 0.5 - eyeY * (1 - depthScale);
            ctx.fillStyle = layer % 2 ? rgba(state.accent, 0.055) : rgba(state.secondary, 0.05); ctx.fillRect(frameX, frameY, frameW, frameH);
            ctx.strokeStyle = layer % 2 ? rgba(state.accent, 0.46) : rgba(state.secondary, 0.5); ctx.lineWidth = Math.max(1, 3 - layer * 0.25); ctx.strokeRect(frameX, frameY, frameW, frameH);
            if (layer) { ctx.beginPath(); ctx.moveTo(portal.x, portal.y); ctx.lineTo(frameX, frameY); ctx.moveTo(portal.x + portal.width, portal.y); ctx.lineTo(frameX + frameW, frameY); ctx.moveTo(portal.x, portal.y + portal.height); ctx.lineTo(frameX, frameY + frameH); ctx.moveTo(portal.x + portal.width, portal.y + portal.height); ctx.lineTo(frameX + frameW, frameY + frameH); ctx.stroke(); }
        }
        ctx.restore();
        ctx.strokeStyle = "rgba(255,255,255,.82)"; ctx.lineWidth = 3; ctx.strokeRect(portal.x, portal.y, portal.width, portal.height);
        ctx.fillStyle = state.secondary; ctx.beginPath(); ctx.arc(w * 0.5 + eyeX, ht * 0.5 + eyeY, 5, 0, TAU); ctx.fill();
    }

    function gesturePathLength(points) {
        var length = 0;
        for (var index = 1; index < points.length; index += 1) length += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
        return length;
    }

    function resampleGesture(points, count) {
        if (points.length < 2) return points.slice();
        var interval = gesturePathLength(points) / (count - 1), distance = 0, result = [{ x: points[0].x, y: points[0].y }], source = points.map(function (point) { return { x: point.x, y: point.y }; });
        for (var index = 1; index < source.length && result.length < count; index += 1) {
            var previous = source[index - 1], current = source[index], segment = Math.hypot(current.x - previous.x, current.y - previous.y);
            if (distance + segment >= interval) {
                var t = (interval - distance) / Math.max(0.000001, segment), point = { x: previous.x + t * (current.x - previous.x), y: previous.y + t * (current.y - previous.y) };
                result.push(point); source.splice(index, 0, point); distance = 0;
            } else distance += segment;
        }
        while (result.length < count) result.push({ x: source[source.length - 1].x, y: source[source.length - 1].y });
        return result;
    }

    function normalizeGesture(points, ordered) {
        var samples = resampleGesture(points, 48);
        var centroid = samples.reduce(function (sum, point) { sum.x += point.x; sum.y += point.y; return sum; }, { x: 0, y: 0 });
        centroid.x /= samples.length; centroid.y /= samples.length;
        if (ordered) {
            var angle = Math.atan2(samples[0].y - centroid.y, samples[0].x - centroid.x);
            samples = samples.map(function (point) { var dx = point.x - centroid.x, dy = point.y - centroid.y; return { x: dx * Math.cos(-angle) - dy * Math.sin(-angle), y: dx * Math.sin(-angle) + dy * Math.cos(-angle) }; });
        } else samples = samples.map(function (point) { return { x: point.x - centroid.x, y: point.y - centroid.y }; });
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        samples.forEach(function (point) { minX = Math.min(minX, point.x); minY = Math.min(minY, point.y); maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y); });
        var width = Math.max(0.001, maxX - minX), height = Math.max(0.001, maxY - minY);
        return samples.map(function (point) { return { x: (point.x - minX) / width - 0.5, y: (point.y - minY) / height - 0.5 }; });
    }

    function gestureTemplate(kind) {
        var points = [];
        if (kind === "CIRCLE") for (var index = 0; index < 64; index += 1) { var angle = index / 63 * TAU; points.push({ x: Math.cos(angle), y: Math.sin(angle) }); }
        else if (kind === "TRIANGLE") points = [{x:0,y:-1},{x:.86,y:.5},{x:-.86,y:.5},{x:0,y:-1}];
        else if (kind === "ZIGZAG") points = [{x:-1,y:-.5},{x:-.5,y:.5},{x:0,y:-.5},{x:.5,y:.5},{x:1,y:-.5}];
        else points = [{x:-1,y:.6},{x:1,y:.6},{x:1,y:-.6},{x:-1,y:-.6},{x:-1,y:.6}];
        return normalizeGesture(points, true);
    }

    function gestureDistance(points, template, unordered) {
        if (unordered) return points.reduce(function (sum, point) { var best = Infinity; template.forEach(function (target) { best = Math.min(best, Math.hypot(point.x - target.x, point.y - target.y)); }); return sum + best; }, 0) / points.length;
        return points.reduce(function (sum, point, index) { return sum + Math.hypot(point.x - template[index].x, point.y - template[index].y); }, 0) / points.length;
    }

    function defaultGesture(now) {
        return Array.from({ length: 96 }, function (_, index) { var angle = index / 95 * TAU; return { x: 0.5 + Math.cos(angle + now * 0.00008) * 0.22, y: 0.5 + Math.sin(angle) * 0.28, p: 0.35 + 0.6 * Math.pow(Math.sin(angle * 0.5), 2), tiltX: Math.cos(angle) * 52, tiltY: Math.sin(angle) * 52 }; });
    }

    function drawGesturePen(state, now) {
        begin(state, now, 0.22);
        var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height, mode = state.def.algorithmIndex;
        var raw = state.gestureStroke.length > 2 ? state.gestureStroke : defaultGesture(now);
        ctx.lineCap = "round"; ctx.lineJoin = "round";

        if (mode < 2) {
            var normalized = normalizeGesture(raw, mode === 0), kinds = ["CIRCLE", "TRIANGLE", "ZIGZAG", "RECTANGLE"], best = null;
            kinds.forEach(function (kind) { var template = gestureTemplate(kind), distance = gestureDistance(normalized, template, mode === 1); if (!best || distance < best.distance) best = { kind: kind, distance: distance, template: template }; });
            var scale = Math.min(w, ht) * 0.52, centerX = w * 0.5, centerY = ht * 0.53;
            ctx.strokeStyle = rgba(state.secondary, 0.32); ctx.lineWidth = 2; ctx.setLineDash([5,7]); ctx.beginPath();
            best.template.forEach(function (point, index) { if (!index) ctx.moveTo(centerX + point.x * scale, centerY + point.y * scale); else ctx.lineTo(centerX + point.x * scale, centerY + point.y * scale); }); ctx.stroke(); ctx.setLineDash([]);
            if (mode === 0) {
                ctx.strokeStyle = state.accent; ctx.lineWidth = 4; ctx.beginPath(); normalized.forEach(function (point, index) { if (!index) ctx.moveTo(centerX + point.x * scale, centerY + point.y * scale); else ctx.lineTo(centerX + point.x * scale, centerY + point.y * scale); }); ctx.stroke();
            } else normalized.forEach(function (point, index) { ctx.fillStyle = index % 7 ? state.accent : state.secondary; ctx.beginPath(); ctx.arc(centerX + point.x * scale, centerY + point.y * scale, index % 7 ? 3 : 5, 0, TAU); ctx.fill(); });
            ctx.fillStyle = "rgba(255,255,255,.82)"; setCanvasFont(ctx, 800, 12, "Cascadia Code, monospace");
            ctx.fillText((mode === 0 ? "$1 PATH MATCH / " : "$P CLOUD MATCH / ") + best.kind + "  " + Math.max(0, 1 - best.distance).toFixed(2), 18, 28);
            return;
        }

        if (mode === 2) {
            var pointers = Array.from(state.api.pointers.values());
            if (pointers.length < 2) {
                var orbit = now * 0.0012;
                pointers = [{ x: 0.5 + Math.cos(orbit) * 0.18, y: 0.5 + Math.sin(orbit) * 0.12 }, { x: 0.5 - Math.cos(orbit) * 0.18, y: 0.5 - Math.sin(orbit) * 0.12 }];
            }
            var first = pointers[0], second = pointers[1], center = { x: (first.x + second.x) * 0.5, y: (first.y + second.y) * 0.5 };
            var distance = Math.hypot(second.x - first.x, second.y - first.y), angle = Math.atan2(second.y - first.y, second.x - first.x);
            if (!state.pinchBase || state.api.pointers.size < 2) state.pinchBase = { distance: state.api.pointers.size >= 2 ? distance : 0.28, angle: state.api.pointers.size >= 2 ? angle : 0, center: center };
            var scaleValue = h.clamp(distance / Math.max(0.01, state.pinchBase.distance), 0.4, 2.4), rotation = angle - state.pinchBase.angle;
            ctx.strokeStyle = rgba(state.secondary, 0.52); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(first.x * w, first.y * ht); ctx.lineTo(second.x * w, second.y * ht); ctx.stroke();
            pointers.slice(0, 2).forEach(function (point) { ctx.fillStyle = state.secondary; ctx.beginPath(); ctx.arc(point.x * w, point.y * ht, 10, 0, TAU); ctx.fill(); });
            ctx.save(); ctx.translate(center.x * w, center.y * ht); ctx.rotate(rotation); ctx.scale(scaleValue, scaleValue); ctx.fillStyle = rgba(state.accent, 0.16); ctx.strokeStyle = state.accent; ctx.lineWidth = 4 / scaleValue; roundRect(ctx, -w * 0.13, -ht * 0.16, w * 0.26, ht * 0.32, 22, true, true); ctx.restore();
            ctx.fillStyle = "rgba(255,255,255,.82)"; setCanvasFont(ctx, 800, 12, "Cascadia Code, monospace"); ctx.fillText("SIMILARITY  S " + scaleValue.toFixed(2) + "  R " + (rotation * 180 / Math.PI).toFixed(1) + "°", 18, 28);
            return;
        }

        raw.forEach(function (point, index) {
            if (!index) return;
            var previous = raw[index - 1], dx = point.x - previous.x, dy = point.y - previous.y, speed = Math.hypot(dx, dy);
            var pressure = point.p || 0.5, tilt = Math.atan2(point.tiltY || dy, point.tiltX || dx), width = 2 + pressure * 16;
            ctx.save(); ctx.translate(point.x * w, point.y * ht); ctx.rotate(tilt); ctx.fillStyle = index % 11 ? rgba(state.accent, 0.52 + pressure * 0.35) : state.secondary;
            ctx.beginPath(); ctx.ellipse(0, 0, width, Math.max(1.2, width * (0.22 + speed * 3)), 0, 0, TAU); ctx.fill(); ctx.restore();
        });
        ctx.fillStyle = "rgba(255,255,255,.82)"; setCanvasFont(ctx, 800, 12, "Cascadia Code, monospace"); ctx.fillText("PRESSURE + TILT NIB", 18, 28);
    }

    function clipVoronoiCell(polygon, site, other) {
        var output = [], ax = 2 * (other.x - site.x), ay = 2 * (other.y - site.y), constant = other.x * other.x + other.y * other.y - site.x * site.x - site.y * site.y;
        function inside(point) { return ax * point.x + ay * point.y <= constant; }
        function intersection(a, b) { var da = ax * a.x + ay * a.y - constant, db = ax * b.x + ay * b.y - constant, t = da / (da - db); return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
        for (var index = 0; index < polygon.length; index += 1) {
            var current = polygon[index], previous = polygon[(index + polygon.length - 1) % polygon.length], currentInside = inside(current), previousInside = inside(previous);
            if (currentInside) { if (!previousInside) output.push(intersection(previous, current)); output.push(current); }
            else if (previousInside) output.push(intersection(previous, current));
        }
        return output;
    }

    function segmentHitsCircle(a, b, center, radius) {
        var dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy || 1;
        var t = h.clamp(((center.x - a.x) * dx + (center.y - a.y) * dy) / length2, 0, 1);
        return Math.hypot(a.x + dx * t - center.x, a.y + dy * t - center.y) <= radius;
    }

    function drawTargetAcquisition(state, now) {
        begin(state, now);
        var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height, mode = state.def.algorithmIndex;
        ensureNodes(state, 32);
        var pointerX = state.pointer.x * w, pointerY = state.pointer.y * ht, best = null, second = null;
        state.nodes.forEach(function (node) { var distance = Math.hypot(node.x * w - pointerX, node.y * ht - pointerY); if (!best || distance < best.distance) { second = best; best = { node: node, distance: distance }; } else if (!second || distance < second.distance) second = { node: node, distance: distance }; });
        if (mode === 0 && best) {
            var radius = Math.min(second ? second.distance : 80, best.distance + best.node.size + 18);
            ctx.strokeStyle = state.accent; ctx.lineWidth = 2; ctx.fillStyle = rgba(state.accent, 0.08); ctx.beginPath(); ctx.arc(pointerX, pointerY, radius, 0, TAU); ctx.fill(); ctx.stroke();
        }
        if (mode === 1) {
            state.nodes.forEach(function (site, siteIndex) {
                var polygon = [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
                state.nodes.forEach(function (other, otherIndex) { if (siteIndex !== otherIndex && polygon.length) polygon = clipVoronoiCell(polygon, site, other); });
                if (!polygon.length) return;
                ctx.fillStyle = best && site === best.node ? rgba(state.secondary, 0.13) : "rgba(0,0,0,0)"; ctx.strokeStyle = rgba(siteIndex % 3 ? state.accent : state.secondary, 0.18); ctx.lineWidth = 1; ctx.beginPath();
                polygon.forEach(function (point, index) { if (!index) ctx.moveTo(point.x * w, point.y * ht); else ctx.lineTo(point.x * w, point.y * ht); }); ctx.closePath(); ctx.fill(); ctx.stroke();
            });
        }
        if (mode === 2) {
            state.crossedTargets = state.crossedTargets || new Set();
            var previous = state.inputTrail.length > 1 ? state.inputTrail[state.inputTrail.length - 2] : { x: state.pointer.x, y: state.pointer.y }, current = { x: state.pointer.x, y: state.pointer.y };
            state.nodes.forEach(function (node, index) { if (segmentHitsCircle(previous, current, node, (node.size + 7) / Math.min(w, ht))) state.crossedTargets.add(index); });
            ctx.strokeStyle = state.secondary; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(previous.x * w, previous.y * ht); ctx.lineTo(current.x * w, current.y * ht); ctx.stroke();
        }
        if (mode === 3 && best && best.distance < 90) for (var index = 0; index < 7; index += 1) {
            var angle = -1.2 + index * 0.4, x = best.node.x * w + Math.cos(angle) * 80, y = best.node.y * ht + Math.sin(angle) * 80;
            ctx.strokeStyle = rgba(state.secondary, 0.35); ctx.beginPath(); ctx.moveTo(best.node.x * w, best.node.y * ht); ctx.lineTo(x, y); ctx.stroke(); ctx.fillStyle = index === 3 ? state.secondary : state.accent; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill();
        }
        state.nodes.forEach(function (node, index) {
            var active = best && node === best.node, crossed = state.crossedTargets && state.crossedTargets.has(index);
            ctx.fillStyle = crossed ? "#ffffff" : active ? state.secondary : rgba(state.accent, 0.72); ctx.beginPath(); ctx.arc(node.x * w, node.y * ht, node.size + (active ? 4 : 0), 0, TAU); ctx.fill();
        });
    }

    function roundRect(ctx,x,y,w,hgt,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,hgt,r);if(fill)ctx.fill();if(stroke)ctx.stroke();}
    function drawNavigation(state,now){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex,px=state.pointer.x*w,py=state.pointer.y*ht;
        if(mode===0){var drawLensContent=function(){for(var row=0;row<6;row++)for(var column=0;column<9;column++){var cellX=w*(.07+column*.108),cellY=ht*(.11+row*.15),active=(row*9+column)%7===0;ctx.fillStyle=active?rgba(state.secondary,.34):rgba(state.accent,.1);ctx.strokeStyle=rgba(active?state.secondary:state.accent,.26);roundRect(ctx,cellX,cellY,w*.08,ht*.09,8,true,true);ctx.fillStyle=rgba("#ffffff",.38);ctx.fillRect(cellX+w*.012,cellY+ht*.022,w*.043,2);ctx.fillRect(cellX+w*.012,cellY+ht*.043,w*.055,2);}};drawLensContent();var lensRadius=Math.min(w,ht)*(.15+state.scroll*.05);ctx.save();ctx.beginPath();ctx.arc(px,py,lensRadius,0,TAU);ctx.clip();ctx.translate(px,py);ctx.scale(1.75,1.75);ctx.translate(-px,-py);ctx.fillStyle="#07101e";ctx.fillRect(0,0,w,ht);drawLensContent();ctx.restore();ctx.strokeStyle="#fff";ctx.lineWidth=3;ctx.beginPath();ctx.arc(px,py,lensRadius,0,TAU);ctx.stroke();ctx.strokeStyle=state.secondary;ctx.lineWidth=1;ctx.beginPath();ctx.arc(px,py,lensRadius+7,0,TAU);ctx.stroke();}
        else if(mode===1){var progress=h.clamp((state.pointer.x+.5*state.scroll),0,1);ctx.globalAlpha=1-progress;for(var c=0;c<12;c++){ctx.fillStyle=c%2?state.accent:state.secondary;ctx.beginPath();ctx.arc(w*(.15+(c%4)*.23),ht*(.23+Math.floor(c/4)*.27),12+progress*20,0,TAU);ctx.fill();}ctx.globalAlpha=progress;ctx.fillStyle="#eef2ff";roundRect(ctx,w*.18,ht*.16,w*.64,ht*.68,28,true,false);ctx.fillStyle="#11172b";setCanvasFont(ctx,900,Math.min(w,ht)*.09);ctx.fillText("DETAIL",w*.25,ht*.47);ctx.globalAlpha=1;}
        else{var cols=4,rows=3,focusX=Math.round(state.pointer.x*(cols-1)),focusY=Math.round(state.pointer.y*(rows-1));for(var y=0;y<rows;y++)for(var x=0;x<cols;x++){var distance=Math.hypot(x-focusX,y-focusY),scale=mode===3?1+Math.max(0,1-distance)*.38:1,cellW=w*.17*scale,cellH=ht*.18*scale,cx=w*(.17+x*.22),cy=ht*(.22+y*.27);ctx.fillStyle=x===focusX&&y===focusY?rgba(state.secondary,.58):rgba(state.accent,.12);ctx.strokeStyle=x===focusX&&y===focusY?"#fff":rgba(state.accent,.35);ctx.lineWidth=x===focusX&&y===focusY?3:1;roundRect(ctx,cx-cellW/2,cy-cellH/2,cellW,cellH,18,true,true);}}
    }

    function drawMicro(state,now){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex,t=now*.001,px=state.pointer.x*w,py=state.pointer.y*ht;
        if(mode===0){var bw=w*.38,bh=ht*.18,bx=w*.5-bw/2,by=ht*.5-bh/2;ctx.fillStyle=rgba(state.accent,.22);ctx.strokeStyle=state.accent;roundRect(ctx,bx,by,bw,bh,bh/2,true,true);state.pulses.forEach(function(p){var age=(now-p.born)/900;if(age<1){ctx.save();ctx.beginPath();ctx.roundRect(bx,by,bw,bh,bh/2);ctx.clip();ctx.globalAlpha=1-age;ctx.strokeStyle=state.secondary;ctx.lineWidth=5;ctx.beginPath();ctx.arc(p.x*w,p.y*ht,age*Math.hypot(bw,bh),0,TAU);ctx.stroke();ctx.restore();}});}
        else if(mode===1){var progress=state.pointer.down?h.clamp((now-(state.pulses[state.pulses.length-1]||{born:now}).born)/1300,0,1):(.5+.5*Math.sin(t))*.3;ctx.lineWidth=16;ctx.strokeStyle=rgba(state.accent,.18);ctx.beginPath();ctx.arc(w*.5,ht*.5,Math.min(w,ht)*.2,0,TAU);ctx.stroke();ctx.strokeStyle=state.accent;ctx.beginPath();ctx.arc(w*.5,ht*.5,Math.min(w,ht)*.2,-Math.PI/2,-Math.PI/2+TAU*progress);ctx.stroke();}
        else if(mode===2){for(var i=0;i<4;i++){var y=ht*(.2+i*.18),shift=(state.pointer.y>i/4&&state.pointer.y<(i+1)/4)?(state.pointer.x-.5)*w*.35:Math.sin(t+i)*12;ctx.fillStyle=rgba(state.secondary,.35);roundRect(ctx,w*.2,y,w*.6,ht*.12,16,true,false);ctx.fillStyle="#11172b";ctx.strokeStyle=rgba(state.accent,.4);roundRect(ctx,w*.2+shift,y,w*.6,ht*.12,16,true,true);}}
        else{var shapes=["READY","ACTIVE","SUCCESS","RESET"],index=(Math.floor(t*.65)+state.preset)%4,size=Math.min(w,ht)*(.18+index*.025);ctx.save();ctx.translate(w*.5,ht*.5);ctx.rotate(index*Math.PI/4+Math.sin(t)*.1);ctx.fillStyle=index===2?state.secondary:state.accent;ctx.beginPath();if(index%2===0)ctx.roundRect(-size,-size*.65,size*2,size*1.3,index===0?size*.65:24);else{for(var p=0;p<8;p++){var a=p/8*TAU,r=p%2?size*.55:size,x=Math.cos(a)*r,y=Math.sin(a)*r;if(!p)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();}ctx.fill();ctx.restore();ctx.fillStyle="#fff";setCanvasFont(ctx,800,12,"Cascadia Code, monospace");ctx.fillText(shapes[index],w*.5-28,ht*.82);}
    }

    function drawScrubbing(state,now){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex,trackY=ht*.68,position=mode===3?(state.def.mechanism.driver==="parameter-scroll"?(state.def.canonicalTerm==="Reversible Time Remap"&&state.userPreset%2?1-state.rawScroll:state.rawScroll):.5+.45*Math.sin(now*.0007)):state.pointer.x;if(mode===0)position=Math.pow(state.pointer.x,1+state.pointer.y*4);if(mode===1)position=h.clamp(state.pointer.x+(state.velocity*.006),0,1);if(mode===2)position=Math.round(state.pointer.x*16)/16;
        ctx.strokeStyle=rgba(state.accent,.25);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w*.08,trackY);ctx.lineTo(w*.92,trackY);ctx.stroke();for(var i=0;i<=32;i++){var x=w*(.08+i/32*.84),major=i%4===0;ctx.strokeStyle=major?state.accent:rgba(state.accent,.3);ctx.beginPath();ctx.moveTo(x,trackY-(major?18:7));ctx.lineTo(x,trackY+(major?18:7));ctx.stroke();}
        for(var frame=0;frame<9;frame++){var fx=w*(.08+frame/9*.84),fw=w*.084,phase=frame*.8+position*8;ctx.fillStyle=frame/9<position?rgba(state.secondary,.38):rgba(state.accent,.12);roundRect(ctx,fx,ht*.2,fw,ht*.27,12,true,false);ctx.strokeStyle=rgba(state.accent,.22);ctx.beginPath();ctx.moveTo(fx+fw*.18,ht*(.38+Math.sin(phase)*.04));ctx.lineTo(fx+fw*.82,ht*(.29+Math.cos(phase)*.05));ctx.stroke();}
        var cursorX=w*(.08+position*.84);ctx.strokeStyle="#fff";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cursorX,ht*.15);ctx.lineTo(cursorX,ht*.82);ctx.stroke();ctx.fillStyle=state.secondary;ctx.beginPath();ctx.arc(cursorX,trackY,9,0,TAU);ctx.fill();
    }

    function drawDataLayout(state,now){
        begin(state,now);var ctx=state.ctx,w=state.api.size.width,ht=state.api.size.height,mode=state.def.algorithmIndex,t=now*.001;
        if(mode===0){var x=w*.1,y=ht*.14,rw=w*.8,rh=ht*.72;for(var i=0;i<18;i++){var horizontal=i%2===0,ratio=.28+.35*(.5+.5*Math.sin(t*.5+i));ctx.fillStyle=i%3===0?rgba(state.secondary,.45):rgba(state.accent,.16+i%4*.08);ctx.strokeStyle="rgba(255,255,255,.18)";if(horizontal){var part=rw*ratio;roundRect(ctx,x,y,part,rh,6,true,true);x+=part;rw-=part;}else{var partH=rh*ratio;roundRect(ctx,x,y,rw,partH,6,true,true);y+=partH;rh-=partH;}if(rw<12||rh<12)break;}}
        else if(mode===1){var circles=[{x:.5,y:.5,r:.3,depth:0}];for(var c=0;c<24;c++){var parent=circles[Math.floor(circles.length*.35)],a=c*2.399,r=parent.r*(.18+(c%4)*.035);circles.push({x:parent.x+Math.cos(a)*(parent.r-r)*.72,y:parent.y+Math.sin(a)*(parent.r-r)*.72,r:r,depth:parent.depth+1});}circles.forEach(function(c,i){ctx.fillStyle=i%5===0?rgba(state.secondary,.35):rgba(state.accent,.1);ctx.strokeStyle=i%5===0?state.secondary:rgba(state.accent,.45);ctx.beginPath();ctx.arc(c.x*w,c.y*ht,c.r*Math.min(w,ht),0,TAU);ctx.fill();ctx.stroke();});}
        else if(mode===2){var left=Array.from({length:6},function(_,i){return{x:w*.15,y:ht*(.15+i*.14)};}),right=Array.from({length:5},function(_,i){return{x:w*.85,y:ht*(.2+i*.15)};});left.forEach(function(a,i){right.forEach(function(b,j){var value=(Math.sin(i*2+j+t)+1)/2;ctx.strokeStyle=rgba((i+j)%2?state.accent:state.secondary,.06+value*.22);ctx.lineWidth=1+value*10;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.bezierCurveTo(w*.42,a.y,w*.58,b.y,b.x,b.y);ctx.stroke();});});left.concat(right).forEach(function(n,i){ctx.fillStyle=i%2?state.secondary:state.accent;roundRect(ctx,n.x-10,n.y-26,20,52,8,true,false);});}
        else{var lanes=12,values=Array.from({length:lanes},function(_,i){return(i*7+state.preset*3)%lanes;});for(var stage=0;stage<8;stage++){var x=w*(.12+stage*.1);for(var lane=0;lane<lanes;lane++){var y1=ht*(.12+lane/(lanes-1)*.76),swap=(lane+stage*3)%lanes,y2=ht*(.12+swap/(lanes-1)*.76);ctx.strokeStyle=lane%3===0?state.secondary:rgba(state.accent,.3);ctx.beginPath();ctx.moveTo(x,y1);ctx.lineTo(x+w*.1,y2);ctx.stroke();ctx.fillStyle=state.accent;ctx.beginPath();ctx.arc(x,y1,2.5,0,TAU);ctx.fill();}}}
    }

    function ensureGlyphField(state) {
        if (state.glyphField) return state.glyphField;
        var canvas = document.createElement("canvas"), width = 144, height = 72, ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = width; canvas.height = height;
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, width, height); ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = "900 52px Arial Black, Arial, sans-serif"; ctx.fillText("SDF", width * 0.5, height * 0.52);
        var pixels = ctx.getImageData(0, 0, width, height).data, mask = new Uint8Array(width * height), distance = new Float32Array(width * height);
        for (var index = 0; index < mask.length; index += 1) mask[index] = pixels[index * 4] > 127 ? 1 : 0;
        distance.fill(999);
        for (var y = 1; y < height - 1; y += 1) for (var x = 1; x < width - 1; x += 1) {
            index = y * width + x; var value = mask[index];
            if (mask[index - 1] !== value || mask[index + 1] !== value || mask[index - width] !== value || mask[index + width] !== value) distance[index] = 0;
        }
        var diagonal = Math.SQRT2;
        for (y = 1; y < height - 1; y += 1) for (x = 1; x < width - 1; x += 1) {
            index = y * width + x;
            distance[index] = Math.min(distance[index], distance[index - 1] + 1, distance[index - width] + 1, distance[index - width - 1] + diagonal, distance[index - width + 1] + diagonal);
        }
        for (y = height - 2; y > 0; y -= 1) for (x = width - 2; x > 0; x -= 1) {
            index = y * width + x;
            distance[index] = Math.min(distance[index], distance[index + 1] + 1, distance[index + width] + 1, distance[index + width + 1] + diagonal, distance[index + width - 1] + diagonal);
        }
        for (index = 0; index < distance.length; index += 1) if (!mask[index]) distance[index] *= -1;
        state.glyphField = { width: width, height: height, mask: mask, distance: distance };
        return state.glyphField;
    }

    function drawTypography(state, now) {
        begin(state, now);
        var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height, mode = state.def.algorithmIndex, t = now * 0.001;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (mode === 0) {
            var weight = 180 + Math.round(state.pointer.y * 720), stretch = 70 + Math.round(state.pointer.x * 55), size = Math.min(w, ht) * 0.27;
            ctx.save(); ctx.translate(w * 0.5, ht * 0.5);
            ctx.fillStyle = rgba(state.secondary, 0.18); ctx.font = "180 70% " + size + "px 'Segoe UI Variable', 'Arial', sans-serif"; ctx.fillText("AXIS", 0, -size * 0.08);
            ctx.fillStyle = state.accent; ctx.font = weight + " " + stretch + "% " + size + "px 'Segoe UI Variable', 'Arial', sans-serif"; ctx.fillText("AXIS", 0, 0);
            ctx.restore();
            ctx.fillStyle = "rgba(255,255,255,.78)"; setCanvasFont(ctx, 800, 12, "Cascadia Code, monospace"); ctx.textAlign = "start"; ctx.fillText("wght " + weight + "  ·  wdth " + stretch, 18, 28);
        } else if (mode === 1) {
            var field = ensureGlyphField(state), stepX = 4, stepY = 4, originX = w * 0.08, originY = ht * 0.14, drawW = w * 0.84, drawH = ht * 0.72;
            for (var y = 0; y < field.height - stepY; y += stepY) for (var x = 0; x < field.width - stepX; x += stepX) {
                var a = field.mask[y * field.width + x], b = field.mask[y * field.width + x + stepX], c = field.mask[(y + stepY) * field.width + x + stepX], d = field.mask[(y + stepY) * field.width + x];
                if (!(a || b || c || d)) continue;
                var x0 = originX + x / field.width * drawW, y0 = originY + y / field.height * drawH, x1 = originX + (x + stepX) / field.width * drawW, y1 = originY + (y + stepY) / field.height * drawH;
                var offset = Math.sin(x * 0.21 + y * 0.17 + t) * 1.8 * state.pointer.y;
                ctx.fillStyle = (x / stepX + y / stepY) % 3 ? rgba(state.accent, 0.42) : rgba(state.secondary, 0.6); ctx.strokeStyle = rgba(state.accent, 0.32); ctx.lineWidth = 0.75;
                ctx.beginPath(); ctx.moveTo(x0 + offset, y0); ctx.lineTo(x1 + offset, y0); ctx.lineTo(x1 - offset, y1); ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(x0 + offset, y0); ctx.lineTo(x1 - offset, y1); ctx.lineTo(x0 - offset, y1); ctx.closePath(); ctx.fill(); ctx.stroke();
            }
        } else if (mode === 2) {
            var sdf = ensureGlyphField(state), cellW = w / sdf.width, cellH = ht / sdf.height, threshold = (state.pointer.y - 0.5) * 8;
            for (var sy = 0; sy < sdf.height; sy += 2) for (var sx = 0; sx < sdf.width; sx += 2) {
                var sample = sdf.distance[sy * sdf.width + sx], nx = sx / sdf.width, ny = sy / sdf.height;
                var warp = Math.sin(ny * 18 + t * 1.8) * state.pointer.x * 9;
                if (sample < threshold - 3) continue;
                var band = Math.abs(sample - threshold), alpha = band < 1.7 ? 0.95 : sample > threshold ? 0.2 + Math.min(0.42, sample * 0.035) : 0.08;
                ctx.fillStyle = band < 1.7 ? state.secondary : rgba(state.accent, alpha);
                ctx.fillRect(sx * cellW + warp, sy * cellH, cellW * 2.2, cellH * 2.2);
            }
        } else {
            var text = "COMPUTATIONAL TYPOGRAPHY · PATH LAYOUT · ", radius = Math.min(w, ht) * 0.28;
            var chars = Array.from(text), advances = chars.map(function (char) { setCanvasFont(ctx, 800, Math.min(w, ht) * 0.038); return ctx.measureText(char).width + 1.4; });
            var totalAdvance = advances.reduce(function (sum, value) { return sum + value; }, 0), cursor = 0;
            ctx.save(); ctx.translate(w * 0.5, ht * 0.5);
            chars.forEach(function (char, index) {
                cursor += advances[index] * 0.5; var angle = cursor / totalAdvance * TAU + t * 0.16;
                ctx.save(); ctx.rotate(angle); ctx.translate(0, -radius - Math.sin(angle * 3 + t) * 8 * state.pointer.y); ctx.rotate(Math.PI / 2);
                ctx.fillStyle = index % 5 === 0 ? state.secondary : state.accent; setCanvasFont(ctx, 800, Math.min(w, ht) * 0.038); ctx.fillText(char, 0, 0); ctx.restore(); cursor += advances[index] * 0.5;
            });
            ctx.restore();
        }
        ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
    }

    function buildAudioGraph(state, definition) {
        var context = state.audioContext, bus = context.createGain(), term = definition.familyTermIndex;
        bus.gain.value = 0.32; bus.connect(state.analyser);
        state.audioNodes = [bus];
        function remember(node) { state.audioNodes.push(node); return node; }
        function tone(frequency, type, level, target) {
            var oscillator = remember(context.createOscillator()), gain = remember(context.createGain());
            oscillator.type = type || "sine"; oscillator.frequency.value = frequency; gain.gain.value = level == null ? 0.2 : level;
            oscillator.connect(gain).connect(target || bus); oscillator.start(); return { oscillator: oscillator, gain: gain };
        }
        function shaperCurve(kind) {
            var curve = new Float32Array(1024);
            for (var index = 0; index < curve.length; index += 1) {
                var x = index / (curve.length - 1) * 2 - 1;
                curve[index] = kind === "fold" ? Math.asin(Math.sin(x * Math.PI * 2.5)) * 2 / Math.PI : Math.tanh(x * 4.5);
            }
            return curve;
        }

        if (term === 4 || term === 0 || term === 1 || term === 2 || term === 3) {
            var partials = term === 4 ? [1,2,3,5,8] : [1,1.5,2];
            partials.forEach(function (ratio, index) { tone(110 * ratio, index % 2 ? "triangle" : "sine", 0.24 / Math.max(1, index), bus); });
        } else if (term === 5 || term === 15) {
            var filter = remember(context.createBiquadFilter()); filter.type = "lowpass"; filter.frequency.value = term === 5 ? 760 : 420; filter.Q.value = 7;
            filter.connect(bus); tone(110, "sawtooth", 0.35, filter);
        } else if (term === 6) {
            var wavetable = remember(context.createOscillator()), real = new Float32Array([0,1,0.35,0.2,0.1]), imaginary = new Float32Array(real.length);
            wavetable.setPeriodicWave(context.createPeriodicWave(real, imaginary)); wavetable.frequency.value = 110;
            var wavetableGain = remember(context.createGain()); wavetableGain.gain.value = 0.28; wavetable.connect(wavetableGain).connect(bus); wavetable.start();
        } else if (term === 7) {
            var carrier = tone(150, "sine", 0.3, bus), modulator = remember(context.createOscillator()), modulation = remember(context.createGain());
            modulator.frequency.value = 47; modulation.gain.value = 120; modulator.connect(modulation).connect(carrier.oscillator.frequency); modulator.start();
        } else if (term === 9 || term === 10) {
            var amplitude = remember(context.createGain()), carrierTone = remember(context.createOscillator()), modulatorTone = remember(context.createOscillator()), depth = remember(context.createGain());
            carrierTone.frequency.value = 164.81; modulatorTone.frequency.value = term === 9 ? 31 : 4.5; amplitude.gain.value = term === 9 ? 0 : 0.5; depth.gain.value = term === 9 ? 0.7 : 0.45;
            modulatorTone.connect(depth).connect(amplitude.gain); carrierTone.connect(amplitude).connect(bus); carrierTone.start(); modulatorTone.start();
        } else if (term === 8 || term === 12 || term === 13) {
            var shaper = remember(context.createWaveShaper()); shaper.curve = shaperCurve(term === 13 ? "fold" : "drive"); shaper.oversample = "2x"; shaper.connect(bus); tone(term === 8 ? 96 : 110, term === 8 ? "sawtooth" : "sine", 0.28, shaper);
        } else if (term === 11) {
            tone(110, "square", 0.18, bus); tone(220.8, "square", 0.1, bus); tone(331.9, "sawtooth", 0.06, bus);
        } else if (term === 14) {
            var grainBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate), channel = grainBuffer.getChannelData(0);
            for (var sample = 0; sample < channel.length; sample += 1) { var local = sample % 1400 / 1400; channel[sample] = (Math.random() * 2 - 1) * Math.sin(Math.PI * local) * (sample % 4100 < 1400 ? 1 : 0); }
            var grains = remember(context.createBufferSource()); grains.buffer = grainBuffer; grains.loop = true; var grainGain = remember(context.createGain()); grainGain.gain.value = 0.22; grains.connect(grainGain).connect(bus); grains.start();
        } else if (term === 16) {
            var low = remember(context.createBiquadFilter()), high = remember(context.createBiquadFilter()); low.type = "lowpass"; high.type = "highpass"; low.frequency.value = high.frequency.value = 620; low.connect(bus); high.connect(bus); var source = tone(92, "sawtooth", 0.18, low); source.oscillator.connect(high);
        } else if (term === 17) {
            var convolver = remember(context.createConvolver()), impulse = context.createBuffer(2, context.sampleRate * 1.4, context.sampleRate);
            for (var channelIndex = 0; channelIndex < 2; channelIndex += 1) { var impulseData = impulse.getChannelData(channelIndex); for (var impulseIndex = 0; impulseIndex < impulseData.length; impulseIndex += 1) impulseData[impulseIndex] = (Math.random() * 2 - 1) * Math.pow(1 - impulseIndex / impulseData.length, 2.8); }
            convolver.buffer = impulse; convolver.connect(bus); tone(125, "triangle", 0.22, convolver); tone(125, "triangle", 0.07, bus);
        } else if (term === 18 || term === 19) {
            var dry = tone(term === 18 ? 104 : 118, "triangle", 0.1, bus), delays = term === 18 ? [0.029,0.037,0.041,0.043] : [0.067,0.089,0.113,0.149];
            delays.forEach(function (time, index) {
                var delay = remember(context.createDelay(0.5)), feedback = remember(context.createGain()), damping = remember(context.createBiquadFilter());
                delay.delayTime.value = time; feedback.gain.value = term === 18 ? 0.58 - index * 0.035 : 0.48; damping.type = "lowpass"; damping.frequency.value = 2800 - index * 320;
                dry.gain.connect(delay); delay.connect(damping).connect(feedback).connect(delay); delay.connect(bus);
            });
        }
    }

    function drawAudio(state, now) {
        begin(state, now, 0.18);
        var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height, mode = state.def.algorithmIndex, t = now * 0.001, bins = state.audioData || null;
        function sample(index, count) { if (bins && bins.length) return bins[Math.floor(index / count * bins.length)] / 255; return 0.18 + 0.16 * Math.sin(t * 2 + index * 0.29) + 0.12 * Math.sin(t * 0.73 + index * 0.11); }
        if (mode === 0) {
            var count = state.api.isPreview ? 56 : 96, barWidth = w / count;
            for (var index = 0; index < count; index += 1) { var value = h.clamp(sample(index, count), 0.03, 1), bar = value * ht * 0.72; ctx.fillStyle = index % 7 === 0 ? state.secondary : state.accent; ctx.fillRect(index * barWidth, ht - bar, barWidth * 0.72, bar); }
            return;
        }
        if (mode === 1) {
            var flux = 0;
            if (bins && bins.length) {
                if (!state.previousAudioData || state.previousAudioData.length !== bins.length) state.previousAudioData = new Uint8Array(bins.length);
                for (var bin = 0; bin < bins.length; bin += 1) flux += Math.max(0, bins[bin] - state.previousAudioData[bin]) / 255;
                flux /= bins.length; state.previousAudioData.set(bins);
            } else flux = Math.max(0, Math.sin(t * 3.7) * Math.sin(t * 1.13)) * 0.18;
            state.spectralFluxHistory = (state.spectralFluxHistory || []).concat(flux).slice(-120);
            ctx.strokeStyle = state.accent; ctx.lineWidth = 3; ctx.beginPath(); state.spectralFluxHistory.forEach(function (value, index) { var x = index / 119 * w, y = ht * 0.78 - value * ht * 2.6; if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke();
            for (var ring = 0; ring < 8; ring += 1) { ctx.strokeStyle = rgba(ring % 2 ? state.accent : state.secondary, 0.15 + flux * 2); ctx.lineWidth = 1 + flux * 20; ctx.beginPath(); ctx.arc(w * 0.5, ht * 0.44, Math.min(w, ht) * (0.05 + ring * 0.035) + flux * 80, 0, TAU); ctx.stroke(); }
            ctx.fillStyle = "rgba(255,255,255,.78)"; setCanvasFont(ctx, 800, 12, "Cascadia Code, monospace"); ctx.fillText("SPECTRAL FLUX  " + flux.toFixed(4), 18, 28); return;
        }
        if (mode === 2) {
            var rms = 0, timeData = state.audioTimeData;
            if (timeData && timeData.length) { for (var sampleIndex = 0; sampleIndex < timeData.length; sampleIndex += 1) { var centered = (timeData[sampleIndex] - 128) / 128; rms += centered * centered; } rms = Math.sqrt(rms / timeData.length); }
            else rms = 0.16 + Math.abs(Math.sin(t * 1.7)) * 0.18;
            state.rmsHistory = (state.rmsHistory || []).concat(rms).slice(-140);
            var gradient = ctx.createLinearGradient(0, 0, 0, ht); gradient.addColorStop(0, state.secondary); gradient.addColorStop(1, rgba(state.accent, 0.06));
            ctx.fillStyle = gradient; ctx.beginPath(); ctx.moveTo(0, ht * 0.66); state.rmsHistory.forEach(function (value, index) { ctx.lineTo(index / 139 * w, ht * 0.66 - value * ht); }); ctx.lineTo(w, ht); ctx.lineTo(0, ht); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = state.accent; ctx.lineWidth = 2; ctx.beginPath(); for (var x = 0; x <= w; x += 3) { var nx = x / w, waveform = Math.sin(nx * TAU * (3 + state.preset) + t * 2) * rms * ht * 0.62, y = ht * 0.46 + waveform; if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
            ctx.fillStyle = "rgba(255,255,255,.78)"; setCanvasFont(ctx, 800, 12, "Cascadia Code, monospace"); ctx.fillText("RMS ENVELOPE  " + rms.toFixed(3), 18, 28); return;
        }
        var sourceX = state.pointer.x * w, sourceY = state.pointer.y * ht, listenerX = w * 0.5, listenerY = ht * 0.5;
        var pan = h.clamp((sourceX - listenerX) / (w * 0.5), -1, 1), distance = Math.hypot(sourceX - listenerX, sourceY - listenerY) / Math.min(w, ht);
        ctx.strokeStyle = rgba(state.accent, 0.25); for (var radiusIndex = 1; radiusIndex < 8; radiusIndex += 1) { ctx.beginPath(); ctx.arc(sourceX, sourceY, radiusIndex * Math.min(w, ht) * 0.055 + (t * 30 % 40), 0, TAU); ctx.stroke(); }
        ctx.strokeStyle = state.secondary; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(listenerX, listenerY); ctx.lineTo(sourceX, sourceY); ctx.stroke();
        ctx.fillStyle = state.accent; ctx.beginPath(); ctx.arc(sourceX, sourceY, 15, 0, TAU); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(listenerX, listenerY, 9, 0, TAU); ctx.fill();
        ctx.fillStyle = rgba(state.secondary, 0.38 + Math.max(0, -pan) * 0.5); ctx.fillRect(w * 0.07, ht * 0.84, w * 0.38 * (1 - pan) * 0.5, 10); ctx.fillStyle = rgba(state.accent, 0.38 + Math.max(0, pan) * 0.5); ctx.fillRect(w * 0.55, ht * 0.84, w * 0.38 * (1 + pan) * 0.5, 10);
        ctx.fillStyle = "rgba(255,255,255,.78)"; setCanvasFont(ctx, 800, 12, "Cascadia Code, monospace"); ctx.fillText("HRTF  AZ " + (pan * 90).toFixed(1) + "°  D " + distance.toFixed(2), 18, 28);
    }

    var drawers = {
        "oscillatory-fields": drawOscillatory,
        "deformable-matter": drawDeformable,
        "articulated-solvers": drawArticulated,
        "granular-systems": drawGranular,
        "swarm-intelligence": drawSwarm,
        "dynamic-networks": drawNetworks,
        "morphogenetic-growth": drawGrowth,
        "cellular-automata": drawCellular,
        "path-planning": drawPathPlanning,
        "computational-geometry": drawComputationalGeometry,
        "curve-construction": drawCurves,
        "fractal-navigation": drawFractal,
        "chaotic-dynamics": drawChaos,
        "optical-fields": drawOptics,
        "image-reconstruction": drawImageReconstruction,
        "temporal-compositing": drawTemporal,
        "spatial-3d": drawSpatial3D,
        "gesture-pen": drawGesturePen,
        "target-acquisition": drawTargetAcquisition,
        "navigation-focus": drawNavigation,
        "micro-state": drawMicro,
        "temporal-scrubbing": drawScrubbing,
        "data-layout": drawDataLayout,
        "computational-type": drawTypography,
        "audio-spatial": drawAudio
    };

    var termMotionLaws = [
        function () {},
        function (state, profile, phase) { state.pointer.x = h.clamp(state.pointer.x + Math.cos(phase) * 0.018, 0, 1); state.pointer.y = h.clamp(state.pointer.y + Math.sin(phase) * 0.018, 0, 1); },
        function (state, profile, phase) { var dx = state.pointer.x - 0.5, dy = state.pointer.y - 0.5, angle = Math.atan2(dy, dx) + 0.08 * Math.sin(phase), radius = Math.hypot(dx, dy); state.pointer.x = 0.5 + Math.cos(angle) * radius; state.pointer.y = 0.5 + Math.sin(angle) * radius; },
        function (state) { state.pointer.x = Math.round(state.pointer.x * 18) / 18; state.pointer.y = Math.round(state.pointer.y * 12) / 12; },
        function (state, profile, phase) { state.pointer.x = h.clamp(state.pointer.x + Math.sin(phase * 2) * 0.022, 0, 1); state.pointer.y = h.clamp(state.pointer.y + Math.sin(phase * 3) * 0.017, 0, 1); },
        function (state, profile) { var dx = state.pointer.x - 0.5, dy = state.pointer.y - 0.5, radius = Math.pow(Math.hypot(dx, dy) * 1.42, 0.82) * 0.7, angle = Math.atan2(dy, dx); state.pointer.x = 0.5 + Math.cos(angle) * radius; state.pointer.y = 0.5 + Math.sin(angle) * radius; },
        function (state) { if (state.sequence % 2) state.pointer.x = 1 - state.pointer.x; },
        function (state, profile) { state.pointer.x = h.clamp(state.pointer.x + (state.pointer.y - 0.5) * 0.12 * profile.gain, 0, 1); },
        function (state, profile, phase) { profile.energy *= 0.72 + 0.48 * Math.pow(Math.sin(phase), 2); },
        function (state, profile, phase) { var amount = 0.012 + state.scroll * 0.018; state.pointer.x = h.clamp(state.pointer.x + Math.cos(phase * 0.5) * amount, 0, 1); state.pointer.y = h.clamp(state.pointer.y + Math.sin(phase * 0.5) * amount, 0, 1); },
        function (state, profile, phase) { state.pointer.x = h.clamp(state.pointer.x + ((phase / TAU) % 1 - 0.5) * 0.025, 0, 1); },
        function (state, profile, phase) { var triangle = Math.abs(((phase / Math.PI) % 2 + 2) % 2 - 1) - 0.5; state.pointer.y = h.clamp(state.pointer.y + triangle * 0.045, 0, 1); },
        function (state, profile, phase) { state.pointer.x = h.clamp(state.pointer.x + Math.sin(phase * 1.37 + state.def.seed) * 0.014, 0, 1); state.pointer.y = h.clamp(state.pointer.y + Math.cos(phase * 1.71 + state.def.seed) * 0.014, 0, 1); },
        function (state, profile) { var source = state.sources[(state.frameCount >> 5) % state.sources.length]; state.pointer.x = state.pointer.x * 0.76 + source.x * 0.24; state.pointer.y = state.pointer.y * 0.76 + source.y * 0.24; profile.energy *= 1.08; },
        function (state, profile, phase) { var sign = Math.sin(phase) > 0 ? 1 : -1; state.pointer.x = h.clamp(state.pointer.x + (state.pointer.x - 0.5) * sign * 0.035, 0, 1); state.pointer.y = h.clamp(state.pointer.y + (state.pointer.y - 0.5) * sign * 0.035, 0, 1); },
        function (state, profile, phase) { profile.energy *= 0.88 + 0.18 * Math.sin(phase * 4) + 0.12 * Math.sin(phase * 7); },
        function (state) { if (state.inputTrail.length > 10) { var delayed = state.inputTrail[state.inputTrail.length - 10]; state.pointer.x = state.pointer.x * 0.7 + delayed.x * 0.3; state.pointer.y = state.pointer.y * 0.7 + delayed.y * 0.3; } },
        function (state, profile) { var continuation = Math.pow(state.scroll, 1.6); state.pointer.x = state.pointer.x * (1 - continuation * 0.28) + continuation * 0.5; profile.energy *= 0.8 + continuation * 0.55; },
        function (state, profile, phase) { var limit = 0.35 + Math.sin(phase * 0.7) * 0.06, dx = state.pointer.x - 0.5, dy = state.pointer.y - 0.5, length = Math.hypot(dx, dy); if (length > limit) { state.pointer.x = 0.5 + dx / length * limit; state.pointer.y = 0.5 + dy / length * limit; } },
        function (state, profile) { profile.energy *= state.sequence % 3 === 0 ? 1.36 : state.sequence % 3 === 1 ? 0.72 : 1.02; state.preset = (state.userPreset + state.sequence) % 4; }
    ];

    function drawTermFingerprint(state, handler) {
        var ctx = state.ctx, w = state.api.size.width, ht = state.api.size.height, count = 4 + handler.termIndex % 7;
        ctx.save(); ctx.translate(w - 34, ht - 31); ctx.rotate(handler.phase * 0.12 + state.profile.now * 0.00008);
        ctx.strokeStyle = rgba(handler.termIndex % 2 ? state.accent : state.secondary, 0.34); ctx.lineWidth = 1; ctx.beginPath();
        for (var index = 0; index <= count; index += 1) { var angle = index / count * TAU, radius = 6 + (index % 3) * 4 + handler.amplitude * 22, x = Math.cos(angle) * radius, y = Math.sin(angle) * radius; if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.closePath(); ctx.stroke(); ctx.restore();
    }

    function createTermHandler(definition) {
        var baseDrawer = drawers[definition.familyId];
        if (!baseDrawer) throw new Error("Missing family kernel for " + definition.algorithmKey);
        var hash = 2166136261;
        for (var index = 0; index < definition.algorithmKey.length; index += 1) { hash ^= definition.algorithmKey.charCodeAt(index); hash = Math.imul(hash, 16777619); }
        var handler = {
            key: definition.algorithmKey,
            termIndex: definition.familyTermIndex,
            phase: (hash >>> 0) / 4294967296 * TAU,
            amplitude: 0.2 + ((hash >>> 8) & 255) / 255 * 0.8,
            step: function (state, profile) {
                var phase = profile.now * (0.00035 + this.amplitude * 0.00042) + this.phase;
                termMotionLaws[this.termIndex](state, profile, phase);
                state.pointer.px = state.pointer.x * state.api.size.width; state.pointer.py = state.pointer.y * state.api.size.height;
                state.termProfile = this;
            },
            draw: function (state, now, delta) { baseDrawer(state, now, delta); drawTermFingerprint(state, this); }
        };
        return handler;
    }

    var solverRegistry = Object.create(null);
    Data.effects.forEach(function (definition) {
        if (definition.familyTermIndex == null) return;
        solverRegistry[definition.mechanism.solver] = createTermHandler(definition);
    });
    window.MotionSolverRegistry = solverRegistry;

    function generatedEffect(api) {
        var definition = Data.byId[Number(api.body.dataset.effectId)];
        if (!definition) return {};
        var state = createState(api, definition);
        var solver = solverRegistry[definition.mechanism.solver];
        if (!solver) throw new Error("Missing term solver: " + definition.mechanism.solver);
        api.setState(definition.algorithmKey.toUpperCase().replaceAll("-", " ") + " / LIVE");
        api.setPrompt(definition.instructionZh);
        api.setAction(definition.mechanism.driver === "sequenced-forcing" ? "NEXT SIGNAL" : "CHANGE STATE");

        function toggleAudio() {
            if (definition.familyId !== "audio-spatial") return commonAction(state);
            if (!state.audioContext) {
                state.audioContext = new AudioContext();
                state.analyser = state.audioContext.createAnalyser();
                state.analyser.fftSize = 512;
                state.analyser.smoothingTimeConstant = 0.68;
                state.audioData = new Uint8Array(state.analyser.frequencyBinCount);
                state.audioTimeData = new Uint8Array(state.analyser.fftSize);
                state.panner = state.audioContext.createPanner();
                state.panner.panningModel = "HRTF";
                state.panner.distanceModel = "inverse";
                state.panner.refDistance = 1;
                state.panner.maxDistance = 12;
                state.panner.rolloffFactor = 0.8;
                state.gain = state.audioContext.createGain();
                state.gain.gain.value = 0.025;
                state.analyser.connect(state.panner).connect(state.gain).connect(state.audioContext.destination);
                buildAudioGraph(state, definition);
                state.audioRunning = true;
            } else if (state.audioRunning) { state.audioContext.suspend(); state.audioRunning = false; }
            else { state.audioContext.resume(); state.audioRunning = true; }
            api.setState(state.audioRunning ? "AUDIO / LIVE" : "AUDIO / PAUSED");
            api.setAction(state.audioRunning ? "PAUSE AUDIO" : "START AUDIO");
        }

        if (definition.familyId === "audio-spatial") {
            document.addEventListener("visibilitychange", function () { if (document.hidden && state.audioContext && state.audioRunning) { state.audioContext.suspend(); state.audioRunning = false; } });
        }

        return {
            pointer: function (type, point) { commonPointer(state, type, point); },
            wheel: function (delta) { state.rawScroll = h.clamp(state.rawScroll - delta * 0.0009, 0, 1); return definition.mechanism.driver !== "parameter-scroll"; },
            scroll: function (progress, velocity) { state.rawScroll = progress; state.velocity = velocity; },
            keydown: function (event) {
                if (event.key === " " || event.key === "Enter") { event.preventDefault(); definition.familyId === "audio-spatial" ? toggleAudio() : commonAction(state); }
                if (event.key === "ArrowLeft") state.inputPointer.x = h.clamp(state.inputPointer.x - .04, 0, 1);
                if (event.key === "ArrowRight") state.inputPointer.x = h.clamp(state.inputPointer.x + .04, 0, 1);
                if (event.key === "ArrowUp") state.inputPointer.y = h.clamp(state.inputPointer.y - .04, 0, 1);
                if (event.key === "ArrowDown") state.inputPointer.y = h.clamp(state.inputPointer.y + .04, 0, 1);
            },
            action: definition.familyId === "audio-spatial" ? toggleAudio : function () { commonAction(state); },
            resize: function () { state.buffer = null; state.cells = null; state.deformable = null; state.networkGraph = null; state.growth = null; state.glyphField = null; state.dirty = true; },
            frame: function (now, delta, reduced) {
                syntheticInput(state, now);
                if (state.analyser && state.audioRunning) {
                    state.analyser.getByteFrequencyData(state.audioData);
                    state.analyser.getByteTimeDomainData(state.audioTimeData);
                    if (state.panner.positionX) {
                        state.panner.positionX.value = (state.pointer.x - 0.5) * 5;
                        state.panner.positionY.value = (0.5 - state.pointer.y) * 3;
                        state.panner.positionZ.value = -1;
                    } else state.panner.setPosition((state.pointer.x - 0.5) * 5, (0.5 - state.pointer.y) * 3, -1);
                }
                var profile = prepareMechanism(state, now, reduced ? 0 : delta);
                solver.step(state, profile);
                state.ctx.save();
                solver.draw(state, profile.now, profile.delta);
                state.ctx.restore();
                drawMechanismVisualizer(state);
                state.frameCount += 1;
            }
        };
    }

    Motion.register({ "generated-effect": generatedEffect });
}());
