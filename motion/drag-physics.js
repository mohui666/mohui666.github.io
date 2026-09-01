(() => {
    "use strict";

    const effect = document.body.dataset.effect;
    const stage = document.querySelector("[data-physics-stage]");
    const object = document.querySelector("[data-physics-object]");
    const resetButton = document.querySelector("[data-reset]");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!effect || !stage || !object) return;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const mix = (from, to, amount) => from + (to - from) * amount;
    const speed = (vx, vy) => Math.hypot(vx, vy);
    const readout = (name, value) => {
        const node = document.querySelector(`[data-readout="${name}"]`);
        if (node) node.textContent = value;
    };
    const setState = (value) => {
        const node = document.querySelector('[data-readout="state"]');
        if (node && node.textContent !== value) node.textContent = value;
        if (object.dataset.state !== value) object.dataset.state = value;
    };
    const setDragging = (value) => document.body.classList.toggle("is-dragging", value);
    const stagePoint = (event) => {
        const rect = stage.getBoundingClientRect();
        return {
            x: event.clientX - rect.left - rect.width / 2,
            y: event.clientY - rect.top - rect.height / 2
        };
    };
    const boundsFor = (padding = 16) => ({
        x: Math.max(0, (stage.clientWidth - object.offsetWidth) / 2 - padding),
        y: Math.max(0, (stage.clientHeight - object.offsetHeight) / 2 - padding)
    });
    const putObject = (x, y, rotation = 0, scaleX = 1, scaleY = 1) => {
        object.style.setProperty("--x", `${x.toFixed(2)}px`);
        object.style.setProperty("--y", `${y.toFixed(2)}px`);
        object.style.setProperty("--rotation", `${rotation.toFixed(2)}deg`);
        object.style.setProperty("--scale-x", scaleX.toFixed(4));
        object.style.setProperty("--scale-y", scaleY.toFixed(4));
    };
    const arrowVector = (event, amount) => {
        const distance = event.shiftKey ? amount * 2 : amount;
        return {
            ArrowLeft: [-distance, 0],
            ArrowRight: [distance, 0],
            ArrowUp: [0, -distance],
            ArrowDown: [0, distance]
        }[event.key];
    };

    const createRunner = (step, shouldRun) => {
        let frame = 0;
        let previousTime = 0;

        const loop = (time) => {
            frame = 0;
            if (document.hidden) {
                previousTime = 0;
                return;
            }
            const dt = previousTime ? Math.min(0.034, (time - previousTime) / 1000) : 1 / 60;
            previousTime = time;
            step(dt, time);
            if (shouldRun()) frame = requestAnimationFrame(loop);
            else previousTime = 0;
        };

        const wake = () => {
            if (!frame && !document.hidden && shouldRun()) frame = requestAnimationFrame(loop);
        };
        const stop = () => {
            if (frame) cancelAnimationFrame(frame);
            frame = 0;
            previousTime = 0;
        };

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) stop();
            else wake();
        });

        return { wake, stop };
    };

    const createSamples = (windowMs = 140) => {
        let points = [];
        return {
            clear(x, y, time = performance.now()) {
                points = [{ x, y, time }];
            },
            add(x, y, time = performance.now()) {
                points.push({ x, y, time });
                const cutoff = time - windowMs;
                while (points.length > 2 && points[1].time < cutoff) points.shift();
            },
            velocity() {
                if (points.length < 2) return { x: 0, y: 0 };
                const first = points[0];
                const last = points[points.length - 1];
                const dt = Math.max(16, last.time - first.time) / 1000;
                return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
            }
        };
    };

    const bindReset = (reset) => {
        if (!resetButton) return;
        resetButton.addEventListener("click", () => {
            reset();
            object.focus({ preventScroll: true });
        });
    };
    const bindHiddenCancel = (cancelDrag) => {
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) return;
            setDragging(false);
            cancelDrag();
        });
    };

    function initSpringDrag() {
        const targetNode = document.querySelector("[data-spring-target]");
        const tether = document.querySelector("[data-spring-tether]");
        const stiffnessInput = document.querySelector("[data-stiffness]");
        const dampingInput = document.querySelector("[data-damping]");
        const stiffnessOutput = document.querySelector("[data-stiffness-value]");
        const dampingOutput = document.querySelector("[data-damping-value]");
        let x = 0;
        let y = 0;
        let targetX = 0;
        let targetY = 0;
        let vx = 0;
        let vy = 0;
        let pointerId = null;
        let grabX = 0;
        let grabY = 0;
        let active = false;

        const coefficients = () => ({
            stiffness: Number(stiffnessInput ? stiffnessInput.value : 170),
            damping: Number(dampingInput ? dampingInput.value : 18)
        });

        const render = () => {
            putObject(x, y, clamp(vx * 0.018, -10, 10));
            targetNode.style.setProperty("--x", `${targetX.toFixed(2)}px`);
            targetNode.style.setProperty("--y", `${targetY.toFixed(2)}px`);
            const dx = targetX - x;
            const dy = targetY - y;
            tether.style.setProperty("--line-x", `${x.toFixed(2)}px`);
            tether.style.setProperty("--line-y", `${y.toFixed(2)}px`);
            tether.style.setProperty("--line-length", `${Math.hypot(dx, dy).toFixed(2)}px`);
            tether.style.setProperty("--line-angle", `${Math.atan2(dy, dx)}rad`);
            readout("distance", `${Math.round(Math.hypot(dx, dy))} px`);
            readout("speed", `${Math.round(speed(vx, vy))} px/s`);
        };

        const runner = createRunner((dt) => {
            if (reducedMotion) {
                x = targetX;
                y = targetY;
                vx = 0;
                vy = 0;
                active = false;
                render();
                return;
            }
            const { stiffness, damping } = coefficients();
            vx += ((targetX - x) * stiffness - vx * damping) * dt;
            vy += ((targetY - y) * stiffness - vy * damping) * dt;
            x += vx * dt;
            y += vy * dt;
            render();
            if (pointerId === null && Math.hypot(targetX - x, targetY - y) < 0.35 && speed(vx, vy) < 1) {
                x = targetX;
                y = targetY;
                vx = 0;
                vy = 0;
                active = false;
                setState("SETTLED");
                render();
            }
        }, () => pointerId !== null || active);

        const moveTarget = (nextX, nextY) => {
            const limit = boundsFor(22);
            targetX = clamp(nextX, -limit.x, limit.x);
            targetY = clamp(nextY, -limit.y, limit.y);
            active = true;
            setState("FOLLOWING");
            if (reducedMotion) {
                x = targetX;
                y = targetY;
                active = false;
                setState("PLACED");
                render();
            } else runner.wake();
        };

        object.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;
            const point = stagePoint(event);
            pointerId = event.pointerId;
            grabX = targetX - point.x;
            grabY = targetY - point.y;
            object.setPointerCapture(pointerId);
            setDragging(true);
            moveTarget(point.x + grabX, point.y + grabY);
        });
        object.addEventListener("pointermove", (event) => {
            if (event.pointerId !== pointerId) return;
            const point = stagePoint(event);
            moveTarget(point.x + grabX, point.y + grabY);
        });
        const release = (event) => {
            if (event.pointerId !== pointerId) return;
            pointerId = null;
            setDragging(false);
            setState(reducedMotion ? "PLACED" : "SETTLING");
            if (!reducedMotion) {
                active = true;
                runner.wake();
            }
        };
        object.addEventListener("pointerup", release);
        object.addEventListener("pointercancel", release);
        bindHiddenCancel(() => {
            if (pointerId === null) return;
            pointerId = null;
            const moving = Math.hypot(targetX - x, targetY - y) >= 0.35 || speed(vx, vy) >= 1;
            active = !reducedMotion && moving;
            if (!active) {
                x = targetX;
                y = targetY;
                vx = 0;
                vy = 0;
            }
            setState(active ? "SETTLING" : reducedMotion ? "PLACED" : "SETTLED");
            render();
        });
        object.addEventListener("keydown", (event) => {
            const vector = arrowVector(event, 28);
            if (!vector) {
                if (event.key === "Home") reset();
                else return;
            } else {
                moveTarget(targetX + vector[0], targetY + vector[1]);
            }
            event.preventDefault();
        });

        [stiffnessInput, dampingInput].forEach((input) => {
            if (!input) return;
            input.addEventListener("input", () => {
                if (stiffnessOutput) stiffnessOutput.textContent = stiffnessInput.value;
                if (dampingOutput) dampingOutput.textContent = dampingInput.value;
                if (Math.hypot(targetX - x, targetY - y) > 0.35 || speed(vx, vy) > 1) {
                    active = true;
                    runner.wake();
                }
            });
        });

        function reset() {
            runner.stop();
            x = 0;
            y = 0;
            targetX = 0;
            targetY = 0;
            vx = 0;
            vy = 0;
            pointerId = null;
            active = false;
            setDragging(false);
            setState("SETTLED");
            render();
        }

        window.addEventListener("resize", () => {
            const limit = boundsFor(22);
            targetX = clamp(targetX, -limit.x, limit.x);
            targetY = clamp(targetY, -limit.y, limit.y);
            x = clamp(x, -limit.x, limit.x);
            y = clamp(y, -limit.y, limit.y);
            render();
        }, { passive: true });
        bindReset(reset);
        reset();
    }

    function initElasticBounds() {
        const edgeMeter = document.querySelector("[data-edge-meter]");
        const samples = createSamples(130);
        let x = 0;
        let y = 0;
        let vx = 0;
        let vy = 0;
        let scaleX = 1;
        let scaleY = 1;
        let impact = 0;
        let pointerId = null;
        let grabX = 0;
        let grabY = 0;
        let active = false;

        const render = () => {
            putObject(x, y, clamp(vx * 0.012, -8, 8), scaleX, scaleY);
            readout("velocity", `${Math.round(vx)}, ${Math.round(vy)}`);
            readout("impact", `${Math.round(impact * 100)}%`);
            if (edgeMeter) edgeMeter.style.setProperty("--impact", impact.toFixed(3));
        };

        const collide = (axis, side, incoming) => {
            const force = clamp(Math.abs(incoming) / 1050, 0.08, 1);
            impact = Math.max(impact, force);
            if (axis === "x") {
                scaleX = 1 - force * 0.28;
                scaleY = 1 + force * 0.14;
                edgeMeter.style.setProperty("--impact-x", side < 0 ? "0%" : "100%");
                edgeMeter.style.setProperty("--impact-y", `${clamp(50 + y / Math.max(1, stage.clientHeight) * 100, 8, 92)}%`);
            } else {
                scaleY = 1 - force * 0.28;
                scaleX = 1 + force * 0.14;
                edgeMeter.style.setProperty("--impact-y", side < 0 ? "0%" : "100%");
                edgeMeter.style.setProperty("--impact-x", `${clamp(50 + x / Math.max(1, stage.clientWidth) * 100, 8, 92)}%`);
            }
            setState("IMPACT");
        };

        const runner = createRunner((dt) => {
            const settle = 1 - Math.exp(-12 * dt);
            scaleX = mix(scaleX, 1, settle);
            scaleY = mix(scaleY, 1, settle);
            impact *= Math.exp(-6.5 * dt);

            if (pointerId === null && active) {
                const limit = boundsFor(20);
                const edgeX = Math.max(0, 64 - (limit.x - Math.abs(x))) / 64;
                const edgeY = Math.max(0, 64 - (limit.y - Math.abs(y))) / 64;
                const drag = 1.1 + Math.max(edgeX, edgeY) * 2.7;
                vx *= Math.exp(-drag * dt);
                vy *= Math.exp(-drag * dt);
                x += vx * dt;
                y += vy * dt;

                if (x < -limit.x || x > limit.x) {
                    const side = x < 0 ? -1 : 1;
                    const incoming = vx;
                    x = side * limit.x;
                    vx = -vx * 0.74;
                    collide("x", side, incoming);
                }
                if (y < -limit.y || y > limit.y) {
                    const side = y < 0 ? -1 : 1;
                    const incoming = vy;
                    y = side * limit.y;
                    vy = -vy * 0.74;
                    collide("y", side, incoming);
                }
            }

            render();
            if (pointerId === null && speed(vx, vy) < 4 && impact < 0.01 && Math.abs(scaleX - 1) < 0.002) {
                vx = 0;
                vy = 0;
                scaleX = 1;
                scaleY = 1;
                impact = 0;
                active = false;
                setState("RESTING");
                render();
            }
        }, () => pointerId !== null || active || impact > 0.01);

        object.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;
            const point = stagePoint(event);
            pointerId = event.pointerId;
            grabX = x - point.x;
            grabY = y - point.y;
            vx = 0;
            vy = 0;
            active = true;
            samples.clear(x, y);
            object.setPointerCapture(pointerId);
            setDragging(true);
            setState("GRABBED");
            runner.wake();
        });
        object.addEventListener("pointermove", (event) => {
            if (event.pointerId !== pointerId) return;
            const point = stagePoint(event);
            const limit = boundsFor(20);
            x = clamp(point.x + grabX, -limit.x, limit.x);
            y = clamp(point.y + grabY, -limit.y, limit.y);
            samples.add(x, y);
            render();
        });
        const release = (event) => {
            if (event.pointerId !== pointerId) return;
            pointerId = null;
            setDragging(false);
            samples.add(x, y);
            const sampled = samples.velocity();
            vx = reducedMotion ? 0 : clamp(sampled.x, -1900, 1900);
            vy = reducedMotion ? 0 : clamp(sampled.y, -1900, 1900);
            active = !reducedMotion && speed(vx, vy) > 4;
            setState(active ? "BOUNCING" : "PLACED");
            runner.wake();
            render();
        };
        object.addEventListener("pointerup", release);
        object.addEventListener("pointercancel", release);
        bindHiddenCancel(() => {
            if (pointerId === null) return;
            pointerId = null;
            vx = 0;
            vy = 0;
            active = impact > 0.01 || Math.abs(scaleX - 1) >= 0.002 || Math.abs(scaleY - 1) >= 0.002;
            if (!active) {
                impact = 0;
                scaleX = 1;
                scaleY = 1;
            }
            setState(active ? "SETTLING" : "RESTING");
            render();
        });
        object.addEventListener("keydown", (event) => {
            const vector = arrowVector(event, reducedMotion ? 32 : 520);
            if (!vector) {
                if (event.key === "Home") reset();
                else return;
            } else if (reducedMotion) {
                const limit = boundsFor(20);
                x = clamp(x + vector[0], -limit.x, limit.x);
                y = clamp(y + vector[1], -limit.y, limit.y);
                setState("PLACED");
                render();
            } else {
                vx += vector[0];
                vy += vector[1];
                active = true;
                setState("BOUNCING");
                runner.wake();
            }
            event.preventDefault();
        });

        function reset() {
            runner.stop();
            x = 0;
            y = 0;
            vx = 0;
            vy = 0;
            scaleX = 1;
            scaleY = 1;
            impact = 0;
            pointerId = null;
            active = false;
            setDragging(false);
            setState("RESTING");
            render();
        }

        window.addEventListener("resize", () => {
            const limit = boundsFor(20);
            x = clamp(x, -limit.x, limit.x);
            y = clamp(y, -limit.y, limit.y);
            render();
        }, { passive: true });
        bindReset(reset);
        reset();
    }

    function initMomentumThrow() {
        const canvas = document.querySelector("[data-trail-canvas]");
        const context = canvas.getContext("2d");
        const samples = createSamples(150);
        const trail = [];
        let x = 0;
        let y = 0;
        let vx = 0;
        let vy = 0;
        let pointerId = null;
        let grabX = 0;
        let grabY = 0;
        let active = false;

        const resizeCanvas = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const width = Math.max(1, Math.round(stage.clientWidth * dpr));
            const height = Math.max(1, Math.round(stage.clientHeight * dpr));
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
                context.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
        };

        const addTrail = () => {
            const previous = trail[trail.length - 1];
            if (!previous || Math.hypot(x - previous.x, y - previous.y) > 4) {
                trail.push({ x, y });
                if (trail.length > 76) trail.shift();
            }
        };

        const drawTrail = () => {
            resizeCanvas();
            const width = stage.clientWidth;
            const height = stage.clientHeight;
            context.clearRect(0, 0, width, height);
            context.lineCap = "round";
            for (let index = 1; index < trail.length; index += 1) {
                const fade = index / trail.length;
                context.beginPath();
                context.moveTo(width / 2 + trail[index - 1].x, height / 2 + trail[index - 1].y);
                context.lineTo(width / 2 + trail[index].x, height / 2 + trail[index].y);
                context.strokeStyle = `rgba(255, 79, 61, ${0.08 + fade * 0.72})`;
                context.lineWidth = 1 + fade * 3;
                context.stroke();
            }

            const magnitude = speed(vx, vy);
            if (magnitude > 2) {
                const arrowLength = clamp(magnitude * 0.09, 24, 140);
                const angle = Math.atan2(vy, vx);
                const fromX = width / 2 + x;
                const fromY = height / 2 + y;
                const toX = fromX + Math.cos(angle) * arrowLength;
                const toY = fromY + Math.sin(angle) * arrowLength;
                context.beginPath();
                context.moveTo(fromX, fromY);
                context.lineTo(toX, toY);
                context.strokeStyle = "rgba(255, 208, 92, 0.95)";
                context.lineWidth = 2;
                context.stroke();
                context.beginPath();
                context.moveTo(toX, toY);
                context.lineTo(toX - Math.cos(angle - 0.55) * 11, toY - Math.sin(angle - 0.55) * 11);
                context.moveTo(toX, toY);
                context.lineTo(toX - Math.cos(angle + 0.55) * 11, toY - Math.sin(angle + 0.55) * 11);
                context.stroke();
            }
        };

        const render = () => {
            const magnitude = speed(vx, vy);
            putObject(x, y, magnitude > 1 ? clamp(Math.atan2(vy, vx) * 180 / Math.PI, -180, 180) : 0);
            readout("speed", `${Math.round(magnitude)} px/s`);
            readout("angle", magnitude > 1 ? `${Math.round((Math.atan2(vy, vx) * 180 / Math.PI + 360) % 360)}°` : "—");
            readout("samples", String(trail.length));
            drawTrail();
        };

        const runner = createRunner((dt) => {
            if (pointerId === null && active) {
                vx *= Math.exp(-1.55 * dt);
                vy *= Math.exp(-1.55 * dt);
                x += vx * dt;
                y += vy * dt;
                const limit = boundsFor(18);
                if (x < -limit.x || x > limit.x) {
                    x = clamp(x, -limit.x, limit.x);
                    vx *= -0.42;
                }
                if (y < -limit.y || y > limit.y) {
                    y = clamp(y, -limit.y, limit.y);
                    vy *= -0.42;
                }
                addTrail();
            }
            render();
            if (pointerId === null && speed(vx, vy) < 5) {
                vx = 0;
                vy = 0;
                active = false;
                setState("RESTING");
                render();
            }
        }, () => pointerId !== null || active);

        object.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;
            const point = stagePoint(event);
            pointerId = event.pointerId;
            grabX = x - point.x;
            grabY = y - point.y;
            vx = 0;
            vy = 0;
            active = true;
            trail.length = 0;
            samples.clear(x, y);
            addTrail();
            object.setPointerCapture(pointerId);
            setDragging(true);
            setState("SAMPLING");
            runner.wake();
        });
        object.addEventListener("pointermove", (event) => {
            if (event.pointerId !== pointerId) return;
            const point = stagePoint(event);
            const limit = boundsFor(18);
            x = clamp(point.x + grabX, -limit.x, limit.x);
            y = clamp(point.y + grabY, -limit.y, limit.y);
            samples.add(x, y);
            const sampled = samples.velocity();
            vx = sampled.x;
            vy = sampled.y;
            addTrail();
            render();
        });
        const release = (event) => {
            if (event.pointerId !== pointerId) return;
            pointerId = null;
            setDragging(false);
            samples.add(x, y);
            const sampled = samples.velocity();
            vx = reducedMotion ? 0 : clamp(sampled.x, -2200, 2200);
            vy = reducedMotion ? 0 : clamp(sampled.y, -2200, 2200);
            active = !reducedMotion && speed(vx, vy) > 5;
            setState(active ? "THROWN" : "PLACED");
            runner.wake();
            render();
        };
        object.addEventListener("pointerup", release);
        object.addEventListener("pointercancel", release);
        bindHiddenCancel(() => {
            if (pointerId === null) return;
            pointerId = null;
            vx = 0;
            vy = 0;
            active = false;
            setState("PLACED");
            render();
        });
        object.addEventListener("keydown", (event) => {
            const vector = arrowVector(event, reducedMotion ? 30 : 620);
            if (!vector) {
                if (event.key === "Home") reset();
                else return;
            } else if (reducedMotion) {
                const limit = boundsFor(18);
                x = clamp(x + vector[0], -limit.x, limit.x);
                y = clamp(y + vector[1], -limit.y, limit.y);
                trail.length = 0;
                addTrail();
                setState("PLACED");
                render();
            } else {
                vx += vector[0];
                vy += vector[1];
                active = true;
                trail.length = 0;
                addTrail();
                setState("THROWN");
                runner.wake();
            }
            event.preventDefault();
        });

        function reset() {
            runner.stop();
            x = 0;
            y = 0;
            vx = 0;
            vy = 0;
            pointerId = null;
            active = false;
            trail.length = 0;
            addTrail();
            setDragging(false);
            setState("RESTING");
            render();
        }

        window.addEventListener("resize", () => {
            const limit = boundsFor(18);
            x = clamp(x, -limit.x, limit.x);
            y = clamp(y, -limit.y, limit.y);
            resizeCanvas();
            render();
        }, { passive: true });
        bindReset(reset);
        reset();
    }

    function initInertialSnapGrid() {
        const targetNode = document.querySelector("[data-snap-target]");
        const vectorNode = document.querySelector("[data-snap-vector]");
        const samples = createSamples(145);
        const gridSize = 72;
        let x = 0;
        let y = 0;
        let vx = 0;
        let vy = 0;
        let targetX = 0;
        let targetY = 0;
        let pointerId = null;
        let grabX = 0;
        let grabY = 0;
        let active = false;
        let phase = "rest";
        let coastTime = 0;

        const snappedTarget = (nextX, nextY) => {
            const limit = boundsFor(20);
            const cellX = Math.floor(limit.x / gridSize);
            const cellY = Math.floor(limit.y / gridSize);
            return {
                x: clamp(Math.round(nextX / gridSize), -cellX, cellX) * gridSize,
                y: clamp(Math.round(nextY / gridSize), -cellY, cellY) * gridSize
            };
        };

        const predict = () => {
            const landing = snappedTarget(x + vx / 3.1, y + vy / 3.1);
            targetX = landing.x;
            targetY = landing.y;
            targetNode.classList.add("is-visible");
            vectorNode.classList.add("is-visible");
        };

        const render = () => {
            putObject(x, y, clamp(vx * 0.011, -9, 9));
            targetNode.style.setProperty("--x", `${targetX.toFixed(2)}px`);
            targetNode.style.setProperty("--y", `${targetY.toFixed(2)}px`);
            const dx = targetX - x;
            const dy = targetY - y;
            vectorNode.style.setProperty("--line-x", `${x.toFixed(2)}px`);
            vectorNode.style.setProperty("--line-y", `${y.toFixed(2)}px`);
            vectorNode.style.setProperty("--line-length", `${Math.hypot(dx, dy).toFixed(2)}px`);
            vectorNode.style.setProperty("--line-angle", `${Math.atan2(dy, dx)}rad`);
            readout("cell", `${targetX / gridSize >= 0 ? "+" : ""}${targetX / gridSize}, ${targetY / gridSize >= 0 ? "+" : ""}${targetY / gridSize}`);
            readout("velocity", `${Math.round(vx)}, ${Math.round(vy)}`);
        };

        const runner = createRunner((dt) => {
            if (pointerId !== null) {
                render();
                return;
            }
            if (phase === "coast") {
                coastTime += dt;
                vx *= Math.exp(-2.15 * dt);
                vy *= Math.exp(-2.15 * dt);
                x += vx * dt;
                y += vy * dt;
                const limit = boundsFor(20);
                if (x < -limit.x || x > limit.x) {
                    x = clamp(x, -limit.x, limit.x);
                    vx *= -0.28;
                }
                if (y < -limit.y || y > limit.y) {
                    y = clamp(y, -limit.y, limit.y);
                    vy *= -0.28;
                }
                if (coastTime > 0.22 || Math.hypot(targetX - x, targetY - y) < gridSize * 0.72) {
                    phase = "snap";
                    setState("SNAPPING");
                }
            } else if (phase === "snap") {
                const stiffness = 92;
                const damping = 15;
                vx += ((targetX - x) * stiffness - vx * damping) * dt;
                vy += ((targetY - y) * stiffness - vy * damping) * dt;
                x += vx * dt;
                y += vy * dt;
            }
            render();
            if (phase === "snap" && Math.hypot(targetX - x, targetY - y) < 0.3 && speed(vx, vy) < 1.2) {
                x = targetX;
                y = targetY;
                vx = 0;
                vy = 0;
                phase = "rest";
                active = false;
                setState("SNAPPED");
                render();
            }
        }, () => pointerId !== null || active);

        const launchSnap = () => {
            predict();
            if (reducedMotion) {
                x = targetX;
                y = targetY;
                vx = 0;
                vy = 0;
                phase = "rest";
                active = false;
                setState("SNAPPED");
                render();
                return;
            }
            coastTime = 0;
            phase = speed(vx, vy) > 24 ? "coast" : "snap";
            active = true;
            setState(phase === "coast" ? "PREDICTING" : "SNAPPING");
            runner.wake();
        };

        object.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;
            runner.stop();
            const point = stagePoint(event);
            pointerId = event.pointerId;
            grabX = x - point.x;
            grabY = y - point.y;
            vx = 0;
            vy = 0;
            active = true;
            phase = "drag";
            targetNode.classList.remove("is-visible");
            vectorNode.classList.remove("is-visible");
            samples.clear(x, y);
            object.setPointerCapture(pointerId);
            setDragging(true);
            setState("SAMPLING");
            runner.wake();
        });
        object.addEventListener("pointermove", (event) => {
            if (event.pointerId !== pointerId) return;
            const point = stagePoint(event);
            const limit = boundsFor(20);
            x = clamp(point.x + grabX, -limit.x, limit.x);
            y = clamp(point.y + grabY, -limit.y, limit.y);
            samples.add(x, y);
            const sampled = samples.velocity();
            vx = sampled.x;
            vy = sampled.y;
            render();
        });
        const release = (event) => {
            if (event.pointerId !== pointerId) return;
            pointerId = null;
            setDragging(false);
            samples.add(x, y);
            const sampled = samples.velocity();
            vx = reducedMotion ? 0 : clamp(sampled.x, -1900, 1900);
            vy = reducedMotion ? 0 : clamp(sampled.y, -1900, 1900);
            launchSnap();
        };
        object.addEventListener("pointerup", release);
        object.addEventListener("pointercancel", release);
        bindHiddenCancel(() => {
            if (pointerId === null) return;
            pointerId = null;
            vx = 0;
            vy = 0;
            const next = snappedTarget(x, y);
            targetX = next.x;
            targetY = next.y;
            targetNode.classList.add("is-visible");
            vectorNode.classList.add("is-visible");
            const displaced = Math.hypot(targetX - x, targetY - y) >= 0.3;
            if (reducedMotion || !displaced) {
                x = targetX;
                y = targetY;
                phase = "rest";
                active = false;
                setState("SNAPPED");
            } else {
                phase = "snap";
                active = true;
                setState("SNAPPING");
            }
            render();
        });
        object.addEventListener("keydown", (event) => {
            const vector = arrowVector(event, gridSize);
            if (!vector) {
                if (event.key === "Home") reset();
                else return;
            } else {
                vx = reducedMotion ? 0 : vector[0] * 4;
                vy = reducedMotion ? 0 : vector[1] * 4;
                const next = snappedTarget(x + vector[0], y + vector[1]);
                targetX = next.x;
                targetY = next.y;
                targetNode.classList.add("is-visible");
                vectorNode.classList.add("is-visible");
                phase = "snap";
                active = !reducedMotion;
                if (reducedMotion) {
                    x = targetX;
                    y = targetY;
                    setState("SNAPPED");
                    render();
                } else {
                    setState("SNAPPING");
                    runner.wake();
                }
            }
            event.preventDefault();
        });

        function reset() {
            runner.stop();
            x = 0;
            y = 0;
            vx = 0;
            vy = 0;
            targetX = 0;
            targetY = 0;
            pointerId = null;
            active = false;
            phase = "rest";
            targetNode.classList.remove("is-visible");
            vectorNode.classList.remove("is-visible");
            setDragging(false);
            setState("RESTING");
            render();
        }

        window.addEventListener("resize", () => {
            const limit = boundsFor(20);
            x = clamp(x, -limit.x, limit.x);
            y = clamp(y, -limit.y, limit.y);
            const next = snappedTarget(targetX, targetY);
            targetX = next.x;
            targetY = next.y;
            render();
        }, { passive: true });
        bindReset(reset);
        reset();
    }

    function initMagneticDocking() {
        const docks = Array.from(document.querySelectorAll("[data-dock]"));
        let x = 0;
        let y = 0;
        let vx = 0;
        let vy = 0;
        let pointerX = 0;
        let pointerY = 0;
        let pointerId = null;
        let grabX = 0;
        let grabY = 0;
        let active = false;
        let lockedDock = null;

        const dockData = () => docks.map((dock) => {
            const dx = dock.offsetLeft - stage.clientWidth / 2 - x;
            const dy = dock.offsetTop - stage.clientHeight / 2 - y;
            const distance = Math.hypot(dx, dy);
            const radius = Math.max(130, Math.min(stage.clientWidth, stage.clientHeight) * 0.42);
            const strength = 1 / (1 + Math.pow(distance / radius, 3));
            return { dock, dx, dy, distance, strength };
        });

        const strongest = () => dockData().sort((a, b) => b.strength - a.strength)[0];

        const render = () => {
            putObject(x, y, clamp(vx * 0.01, -8, 8));
            const data = dockData();
            let best = data[0];
            data.forEach((entry) => {
                entry.dock.style.setProperty("--strength", entry.strength.toFixed(3));
                entry.dock.classList.toggle("is-active", entry.dock === (lockedDock || best.dock));
                if (entry.strength > best.strength) best = entry;
            });
            docks.forEach((dock) => dock.classList.toggle("is-active", dock === (lockedDock || best.dock)));
            const selected = lockedDock ? data.find((entry) => entry.dock === lockedDock) : best;
            readout("dock", selected.dock.dataset.dock);
            readout("field", `${Math.round(selected.strength * 100)}%`);
            readout("distance", `${Math.round(selected.distance)} px`);
        };

        const runner = createRunner((dt) => {
            if (pointerId !== null) {
                let ax = (pointerX - x) * 105 - vx * 17;
                let ay = (pointerY - y) * 105 - vy * 17;
                dockData().forEach((entry) => {
                    const divisor = Math.max(1, entry.distance);
                    const magnetic = Math.pow(entry.strength, 3) * 1150;
                    ax += entry.dx / divisor * magnetic;
                    ay += entry.dy / divisor * magnetic;
                });
                vx += ax * dt;
                vy += ay * dt;
                x += vx * dt;
                y += vy * dt;
            } else if (active && lockedDock) {
                const targetX = lockedDock.offsetLeft - stage.clientWidth / 2;
                const targetY = lockedDock.offsetTop - stage.clientHeight / 2;
                vx += ((targetX - x) * 96 - vx * 15) * dt;
                vy += ((targetY - y) * 96 - vy * 15) * dt;
                x += vx * dt;
                y += vy * dt;
                if (Math.hypot(targetX - x, targetY - y) < 0.35 && speed(vx, vy) < 1.2) {
                    x = targetX;
                    y = targetY;
                    vx = 0;
                    vy = 0;
                    active = false;
                    setState("DOCKED");
                }
            }
            const limit = boundsFor(18);
            x = clamp(x, -limit.x, limit.x);
            y = clamp(y, -limit.y, limit.y);
            render();
        }, () => pointerId !== null || active);

        const lock = (dock) => {
            lockedDock = dock;
            const targetX = dock.offsetLeft - stage.clientWidth / 2;
            const targetY = dock.offsetTop - stage.clientHeight / 2;
            if (reducedMotion) {
                x = targetX;
                y = targetY;
                vx = 0;
                vy = 0;
                active = false;
                setState("DOCKED");
                render();
            } else {
                active = true;
                setState("LOCKING");
                runner.wake();
            }
        };

        object.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;
            const point = stagePoint(event);
            pointerId = event.pointerId;
            grabX = x - point.x;
            grabY = y - point.y;
            pointerX = point.x + grabX;
            pointerY = point.y + grabY;
            lockedDock = null;
            active = true;
            object.setPointerCapture(pointerId);
            setDragging(true);
            setState("MAGNETIZED");
            if (reducedMotion) {
                x = pointerX;
                y = pointerY;
                render();
            } else runner.wake();
        });
        object.addEventListener("pointermove", (event) => {
            if (event.pointerId !== pointerId) return;
            const point = stagePoint(event);
            const limit = boundsFor(18);
            pointerX = clamp(point.x + grabX, -limit.x, limit.x);
            pointerY = clamp(point.y + grabY, -limit.y, limit.y);
            if (reducedMotion) {
                x = pointerX;
                y = pointerY;
                render();
            }
        });
        const release = (event) => {
            if (event.pointerId !== pointerId) return;
            pointerId = null;
            setDragging(false);
            lock(strongest().dock);
        };
        object.addEventListener("pointerup", release);
        object.addEventListener("pointercancel", release);
        bindHiddenCancel(() => {
            if (pointerId === null) return;
            pointerId = null;
            lock(strongest().dock);
        });
        object.addEventListener("keydown", (event) => {
            const vector = arrowVector(event, 30);
            if (vector) {
                const limit = boundsFor(18);
                lockedDock = null;
                active = false;
                vx = 0;
                vy = 0;
                x = clamp(x + vector[0], -limit.x, limit.x);
                y = clamp(y + vector[1], -limit.y, limit.y);
                setState("SEEKING");
                render();
                event.preventDefault();
            } else if (event.key === "Enter" || event.key === " ") {
                lock(strongest().dock);
                event.preventDefault();
            } else if (event.key === "Home") {
                reset();
                event.preventDefault();
            }
        });
        docks.forEach((dock) => {
            dock.addEventListener("click", () => lock(dock));
        });

        function reset() {
            runner.stop();
            const limit = boundsFor(18);
            x = 0;
            y = -Math.min(112, limit.y * 0.56);
            vx = 0;
            vy = 0;
            pointerX = x;
            pointerY = y;
            pointerId = null;
            active = false;
            lockedDock = null;
            setDragging(false);
            setState("SEEKING");
            render();
        }

        window.addEventListener("resize", () => {
            if (lockedDock) {
                x = lockedDock.offsetLeft - stage.clientWidth / 2;
                y = lockedDock.offsetTop - stage.clientHeight / 2;
            } else {
                const limit = boundsFor(18);
                x = clamp(x, -limit.x, limit.x);
                y = clamp(y, -limit.y, limit.y);
            }
            render();
        }, { passive: true });
        bindReset(reset);
        reset();
    }

    const initializers = {
        "spring-drag": initSpringDrag,
        "elastic-bounds": initElasticBounds,
        "momentum-throw": initMomentumThrow,
        "inertial-snap-grid": initInertialSnapGrid,
        "magnetic-docking": initMagneticDocking
    };

    if (initializers[effect]) initializers[effect]();
})();
