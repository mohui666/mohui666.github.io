(() => {
    "use strict";

    const effect = document.body.dataset.effect;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const lerp = (from, to, amount) => from + (to - from) * amount;
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const setGrabState = (active) => document.body.classList.toggle("is-grabbing", active);
    const setText = (element, value) => {
        if (element && element.textContent !== value) element.textContent = value;
    };
    const localPoint = (element, event) => {
        const rect = element.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const wrapAngle = (value) => {
        let angle = value;
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;
        return angle;
    };

    function sizeCanvas(canvas, context) {
        const rect = canvas.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        return { width, height };
    }

    function createLoop(update, shouldRun) {
        let frame = 0;
        let previousTime = 0;

        const tick = (time) => {
            frame = 0;
            if (document.hidden) {
                previousTime = 0;
                return;
            }

            const delta = previousTime ? Math.min(32, time - previousTime) : 16.67;
            previousTime = time;
            const keepGoing = update(delta, time);

            if (keepGoing && shouldRun()) {
                frame = requestAnimationFrame(tick);
            } else {
                previousTime = 0;
            }
        };

        const start = () => {
            if (frame || document.hidden || !shouldRun()) return;
            frame = requestAnimationFrame(tick);
        };

        const stop = () => {
            if (frame) cancelAnimationFrame(frame);
            frame = 0;
            previousTime = 0;
        };

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) stop();
            else if (shouldRun()) start();
        });

        return { start, stop };
    }

    function initRopeConstraint() {
        const canvas = document.querySelector("[data-rope-canvas]");
        const resetButton = document.querySelector("[data-reset]");
        const status = document.querySelector("[data-status]");
        const tensionReadout = document.querySelector("[data-tension]");
        const lengthReadout = document.querySelector("[data-rope-length]");
        const segmentReadout = document.querySelector("[data-segments]");
        if (!canvas) return;

        const context = canvas.getContext("2d");
        const segmentCount = 16;
        let width = 1;
        let height = 1;
        let restLength = 28;
        let nodes = [];
        let pointerId = null;
        let dragTarget = { x: 0, y: 0 };
        let dragVelocity = { x: 0, y: 0 };
        let lastPointer = { x: 0, y: 0, time: 0 };
        let moving = false;
        let stableFrames = 0;
        let lastRendered = [];

        const solveConstraints = (iterations = 8) => {
            for (let iteration = 0; iteration < iterations; iteration += 1) {
                const anchor = nodes[0];
                anchor.x = width * 0.24;
                anchor.y = height * 0.18;
                anchor.px = anchor.x;
                anchor.py = anchor.y;

                if (pointerId !== null) {
                    const endpoint = nodes[nodes.length - 1];
                    endpoint.x = dragTarget.x;
                    endpoint.y = dragTarget.y;
                }

                for (let index = 0; index < nodes.length - 1; index += 1) {
                    const first = nodes[index];
                    const second = nodes[index + 1];
                    const dx = second.x - first.x;
                    const dy = second.y - first.y;
                    const span = Math.max(0.0001, Math.hypot(dx, dy));
                    const difference = (span - restLength) / span;
                    const firstPinned = index === 0;
                    const secondPinned = pointerId !== null && index + 1 === nodes.length - 1;

                    if (firstPinned && !secondPinned) {
                        second.x -= dx * difference;
                        second.y -= dy * difference;
                    } else if (secondPinned && !firstPinned) {
                        first.x += dx * difference;
                        first.y += dy * difference;
                    } else if (!firstPinned && !secondPinned) {
                        const correctionX = dx * difference * 0.5;
                        const correctionY = dy * difference * 0.5;
                        first.x += correctionX;
                        first.y += correctionY;
                        second.x -= correctionX;
                        second.y -= correctionY;
                    }
                }

                for (let index = 1; index < nodes.length; index += 1) {
                    if (pointerId !== null && index === nodes.length - 1) continue;
                    const node = nodes[index];
                    node.x = clamp(node.x, 10, width - 10);
                    node.y = clamp(node.y, 10, height - 10);
                }
            }
        };

        const render = () => {
            context.clearRect(0, 0, width, height);
            if (!nodes.length) return;

            const anchor = nodes[0];
            const endpoint = nodes[nodes.length - 1];
            const totalLength = restLength * (nodes.length - 1);
            const reach = clamp(distance(anchor, endpoint) / totalLength, 0, 1);

            context.save();
            context.lineCap = "round";
            context.lineJoin = "round";

            context.beginPath();
            context.moveTo(nodes[0].x, nodes[0].y);
            for (let index = 1; index < nodes.length; index += 1) {
                context.lineTo(nodes[index].x, nodes[index].y);
            }
            context.strokeStyle = "rgba(7, 9, 20, 0.7)";
            context.lineWidth = 12;
            context.stroke();

            context.beginPath();
            context.moveTo(nodes[0].x, nodes[0].y);
            for (let index = 1; index < nodes.length; index += 1) {
                context.lineTo(nodes[index].x, nodes[index].y);
            }
            context.strokeStyle = reach > 0.88 ? "#dfff55" : "#7ef2ff";
            context.lineWidth = 3.5;
            context.stroke();

            nodes.forEach((node, index) => {
                context.beginPath();
                context.arc(node.x, node.y, index === 0 ? 8 : 4.2, 0, Math.PI * 2);
                context.fillStyle = index === 0 ? "#dfff55" : "#f5f4ed";
                context.fill();
            });

            context.beginPath();
            context.arc(anchor.x, anchor.y, 18, 0, Math.PI * 2);
            context.strokeStyle = "rgba(223, 255, 85, 0.42)";
            context.lineWidth = 1;
            context.stroke();

            context.beginPath();
            context.arc(endpoint.x, endpoint.y, 28, 0, Math.PI * 2);
            context.fillStyle = pointerId === null ? "#7ef2ff" : "#dfff55";
            context.fill();
            context.beginPath();
            context.arc(endpoint.x, endpoint.y, 12, 0, Math.PI * 2);
            context.strokeStyle = "#0b0e1c";
            context.lineWidth = 2;
            context.stroke();
            context.restore();

            setText(tensionReadout, `${Math.round(reach * 100)}%`);
            setText(lengthReadout, `${Math.round(totalLength)} px`);
            setText(segmentReadout, String(nodes.length - 1).padStart(2, "0"));
        };

        const reset = (animate = true) => {
            restLength = clamp(Math.min(width, height) / 17, 18, 36);
            const anchorX = width * 0.24;
            const anchorY = height * 0.18;
            nodes = Array.from({ length: segmentCount }, (_, index) => {
                const x = anchorX + index * restLength * 0.73;
                const y = anchorY + index * restLength * 0.67;
                return { x, y, px: x, py: y };
            });
            pointerId = null;
            stableFrames = 0;
            lastRendered = nodes.map((node) => ({ x: node.x, y: node.y }));
            moving = animate && !reduceMotion;
            setGrabState(false);
            setText(status, moving ? "SETTLING CONSTRAINTS" : "READY / ENDPOINT FREE");
            if (reduceMotion) solveConstraints(18);
            render();
            if (moving) loop.start();
        };

        const update = (delta) => {
            const scale = delta / 16.67;
            let maxDisplacement = 0;

            for (let index = 1; index < nodes.length; index += 1) {
                if (pointerId !== null && index === nodes.length - 1) continue;
                const node = nodes[index];
                const velocityX = (node.x - node.px) * Math.pow(0.988, scale);
                const velocityY = (node.y - node.py) * Math.pow(0.988, scale);
                node.px = node.x;
                node.py = node.y;
                node.x += velocityX * scale;
                node.y += velocityY * scale + 0.42 * scale * scale;
            }

            if (pointerId !== null) {
                const endpoint = nodes[nodes.length - 1];
                endpoint.px = dragTarget.x - dragVelocity.x;
                endpoint.py = dragTarget.y - dragVelocity.y;
                endpoint.x = dragTarget.x;
                endpoint.y = dragTarget.y;
            }

            solveConstraints(9);
            nodes.forEach((node, index) => {
                const previous = lastRendered[index];
                maxDisplacement = Math.max(maxDisplacement, Math.hypot(node.x - previous.x, node.y - previous.y));
                previous.x = node.x;
                previous.y = node.y;
            });
            render();

            if (pointerId !== null) {
                stableFrames = 0;
                return true;
            }

            stableFrames = maxDisplacement < 0.035 ? stableFrames + 1 : 0;
            if (stableFrames > 20) {
                nodes.forEach((node) => {
                    node.px = node.x;
                    node.py = node.y;
                });
                moving = false;
                setText(status, "RESTING / LENGTH LOCKED");
                return false;
            }
            return true;
        };

        const loop = createLoop(update, () => moving || pointerId !== null);

        const resize = () => {
            const size = sizeCanvas(canvas, context);
            width = size.width;
            height = size.height;
            reset(false);
        };

        canvas.addEventListener("pointerdown", (event) => {
            if (pointerId !== null || event.button !== 0) return;
            const point = localPoint(canvas, event);
            const endpoint = nodes[nodes.length - 1];
            if (distance(point, endpoint) > Math.max(64, restLength * 2.2)) return;
            event.preventDefault();
            pointerId = event.pointerId;
            dragTarget = point;
            dragVelocity = { x: 0, y: 0 };
            lastPointer = { x: point.x, y: point.y, time: performance.now() };
            moving = true;
            stableFrames = 0;
            canvas.setPointerCapture(pointerId);
            setGrabState(true);
            setText(status, "PULLING ENDPOINT");
            if (reduceMotion) {
                solveConstraints(18);
                render();
            } else {
                loop.start();
            }
        });

        canvas.addEventListener("pointermove", (event) => {
            if (event.pointerId !== pointerId) return;
            const point = localPoint(canvas, event);
            const now = performance.now();
            const deltaTime = Math.max(8, now - lastPointer.time);
            dragVelocity.x = lerp(dragVelocity.x, (point.x - lastPointer.x) / deltaTime * 16.67, 0.58);
            dragVelocity.y = lerp(dragVelocity.y, (point.y - lastPointer.y) / deltaTime * 16.67, 0.58);
            dragTarget.x = clamp(point.x, 10, width - 10);
            dragTarget.y = clamp(point.y, 10, height - 10);
            lastPointer = { x: point.x, y: point.y, time: now };
            if (reduceMotion) {
                const endpoint = nodes[nodes.length - 1];
                endpoint.x = dragTarget.x;
                endpoint.y = dragTarget.y;
                solveConstraints(18);
                render();
            }
        });

        const release = (event) => {
            if (event.pointerId !== pointerId) return;
            const endpoint = nodes[nodes.length - 1];
            if (performance.now() - lastPointer.time > 90) {
                endpoint.px = endpoint.x;
                endpoint.py = endpoint.y;
            }
            pointerId = null;
            setGrabState(false);
            setText(status, reduceMotion ? "PLACED / MOTION REDUCED" : "RELEASED / SOLVING");
            if (reduceMotion) {
                moving = false;
                render();
            } else {
                moving = true;
                stableFrames = 0;
                loop.start();
            }
        };

        canvas.addEventListener("pointerup", release);
        canvas.addEventListener("pointercancel", release);
        canvas.addEventListener("keydown", (event) => {
            const moves = {
                ArrowLeft: [-18, 0],
                ArrowRight: [18, 0],
                ArrowUp: [0, -18],
                ArrowDown: [0, 18]
            };
            const move = moves[event.key];
            if (!move) return;
            event.preventDefault();
            const endpoint = nodes[nodes.length - 1];
            endpoint.px = endpoint.x;
            endpoint.py = endpoint.y;
            endpoint.x = clamp(endpoint.x + move[0], 10, width - 10);
            endpoint.y = clamp(endpoint.y + move[1], 10, height - 10);
            solveConstraints(reduceMotion ? 18 : 9);
            setText(status, "KEYBOARD PULL");
            if (reduceMotion) {
                render();
            } else {
                moving = true;
                stableFrames = 0;
                loop.start();
            }
        });

        document.addEventListener("visibilitychange", () => {
            if (!document.hidden || pointerId === null) return;
            pointerId = null;
            setGrabState(false);
            if (reduceMotion) {
                solveConstraints(18);
                nodes.forEach((node) => {
                    node.px = node.x;
                    node.py = node.y;
                });
                moving = false;
                setText(status, "PLACED / MOTION REDUCED");
                render();
            } else {
                moving = true;
            }
        });
        resetButton?.addEventListener("click", () => reset(true));
        window.addEventListener("resize", resize);
        resize();
    }

    function initCollisionDrag() {
        const canvas = document.querySelector("[data-collision-canvas]");
        const resetButton = document.querySelector("[data-reset]");
        const status = document.querySelector("[data-status]");
        const speedReadout = document.querySelector("[data-speed]");
        const collisionReadout = document.querySelector("[data-collisions]");
        const selectedReadout = document.querySelector("[data-selected]");
        if (!canvas) return;

        const context = canvas.getContext("2d");
        const palette = ["#ff4f35", "#4261ff", "#00a889", "#f5b51b", "#8e54e9", "#101218"];
        let width = 1;
        let height = 1;
        let radius = 38;
        let bodies = [];
        let pointerId = null;
        let draggedIndex = -1;
        let selectedIndex = 0;
        let lastPointer = { x: 0, y: 0, time: 0 };
        let moving = false;
        let stableFrames = 0;
        let collisionCount = 0;

        const reset = () => {
            radius = clamp(Math.min(width, height) * 0.072, 27, 48);
            const positions = [
                [0.23, 0.27], [0.52, 0.22], [0.76, 0.34],
                [0.31, 0.66], [0.59, 0.58], [0.79, 0.76]
            ];
            bodies = positions.map((position, index) => ({
                x: clamp(width * position[0], radius, width - radius),
                y: clamp(height * position[1], radius, height - radius),
                vx: 0,
                vy: 0,
                color: palette[index]
            }));
            pointerId = null;
            draggedIndex = -1;
            selectedIndex = 0;
            moving = false;
            stableFrames = 0;
            collisionCount = 0;
            loop.stop();
            setGrabState(false);
            setText(status, "READY / THROW A BODY");
            render();
        };

        const resolveBoundaries = (body, isDragged) => {
            let hits = 0;
            if (body.x < radius || body.x > width - radius) {
                body.x = clamp(body.x, radius, width - radius);
                if (!isDragged) body.vx *= -0.82;
                hits += 1;
            }
            if (body.y < radius || body.y > height - radius) {
                body.y = clamp(body.y, radius, height - radius);
                if (!isDragged) body.vy *= -0.82;
                hits += 1;
            }
            return hits;
        };

        const resolveCollisions = () => {
            let hits = 0;
            const diameter = radius * 2;

            for (let firstIndex = 0; firstIndex < bodies.length - 1; firstIndex += 1) {
                for (let secondIndex = firstIndex + 1; secondIndex < bodies.length; secondIndex += 1) {
                    const first = bodies[firstIndex];
                    const second = bodies[secondIndex];
                    let dx = second.x - first.x;
                    let dy = second.y - first.y;
                    let span = Math.hypot(dx, dy);
                    if (span >= diameter) continue;
                    if (span < 0.001) {
                        dx = 1;
                        dy = 0;
                        span = 1;
                    }

                    const normalX = dx / span;
                    const normalY = dy / span;
                    const overlap = diameter - span;
                    const firstInverseMass = firstIndex === draggedIndex ? 0 : 1;
                    const secondInverseMass = secondIndex === draggedIndex ? 0 : 1;
                    const totalInverseMass = firstInverseMass + secondInverseMass;
                    if (totalInverseMass === 0) continue;

                    first.x -= normalX * overlap * (firstInverseMass / totalInverseMass);
                    first.y -= normalY * overlap * (firstInverseMass / totalInverseMass);
                    second.x += normalX * overlap * (secondInverseMass / totalInverseMass);
                    second.y += normalY * overlap * (secondInverseMass / totalInverseMass);

                    const relativeVelocity = (second.vx - first.vx) * normalX + (second.vy - first.vy) * normalY;
                    if (relativeVelocity < 0) {
                        const impulse = -(1 + 0.88) * relativeVelocity / totalInverseMass;
                        first.vx -= impulse * normalX * firstInverseMass;
                        first.vy -= impulse * normalY * firstInverseMass;
                        second.vx += impulse * normalX * secondInverseMass;
                        second.vy += impulse * normalY * secondInverseMass;
                    }
                    hits += 1;
                }
            }
            return hits;
        };

        const render = () => {
            context.clearRect(0, 0, width, height);
            context.save();
            bodies.forEach((body, index) => {
                context.beginPath();
                context.arc(body.x + 7, body.y + 10, radius, 0, Math.PI * 2);
                context.fillStyle = "rgba(17, 18, 24, 0.13)";
                context.fill();

                context.beginPath();
                context.arc(body.x, body.y, radius, 0, Math.PI * 2);
                context.fillStyle = body.color;
                context.fill();
                context.lineWidth = index === selectedIndex ? 4 : 1.5;
                context.strokeStyle = index === selectedIndex ? "#ffffff" : "rgba(255, 255, 255, 0.55)";
                context.stroke();

                context.fillStyle = index === 5 ? "#ffffff" : "#101218";
                context.font = `900 ${Math.max(12, radius * 0.42)}px ui-monospace, monospace`;
                context.textAlign = "center";
                context.textBaseline = "middle";
                context.fillText(String(index + 1).padStart(2, "0"), body.x, body.y + 1);
            });
            context.restore();

            const maxSpeed = bodies.reduce((maximum, body) => Math.max(maximum, Math.hypot(body.vx, body.vy)), 0);
            setText(speedReadout, `${maxSpeed.toFixed(2)} px/f`);
            setText(collisionReadout, String(collisionCount).padStart(3, "0"));
            setText(selectedReadout, `BODY ${String(selectedIndex + 1).padStart(2, "0")}`);
        };

        const update = (delta) => {
            const scale = delta / 16.67;
            let frameHits = 0;
            let maxSpeed = 0;

            bodies.forEach((body, index) => {
                if (index !== draggedIndex) {
                    body.x += body.vx * scale;
                    body.y += body.vy * scale;
                    const damping = Math.pow(0.986, scale);
                    body.vx *= damping;
                    body.vy *= damping;
                }
                frameHits += resolveBoundaries(body, index === draggedIndex);
            });

            frameHits += resolveCollisions();
            collisionCount += frameHits;
            bodies.forEach((body) => {
                maxSpeed = Math.max(maxSpeed, Math.hypot(body.vx, body.vy));
            });
            render();

            if (draggedIndex !== -1) {
                stableFrames = 0;
                return true;
            }

            stableFrames = maxSpeed < 0.045 ? stableFrames + 1 : 0;
            if (stableFrames > 12) {
                bodies.forEach((body) => {
                    body.vx = 0;
                    body.vy = 0;
                });
                moving = false;
                setText(status, "RESTING / ELASTIC FIELD");
                render();
                return false;
            }
            return true;
        };

        const loop = createLoop(update, () => moving || draggedIndex !== -1);

        const resize = () => {
            const oldWidth = width;
            const oldHeight = height;
            const size = sizeCanvas(canvas, context);
            width = size.width;
            height = size.height;
            if (!bodies.length || oldWidth <= 1 || oldHeight <= 1) {
                reset();
                return;
            }
            const scaleX = width / oldWidth;
            const scaleY = height / oldHeight;
            radius = clamp(Math.min(width, height) * 0.072, 27, 48);
            bodies.forEach((body) => {
                body.x = clamp(body.x * scaleX, radius, width - radius);
                body.y = clamp(body.y * scaleY, radius, height - radius);
            });
            render();
        };

        canvas.addEventListener("pointerdown", (event) => {
            if (pointerId !== null || event.button !== 0) return;
            const point = localPoint(canvas, event);
            let index = -1;
            for (let candidate = bodies.length - 1; candidate >= 0; candidate -= 1) {
                if (distance(point, bodies[candidate]) <= radius * 1.35) {
                    index = candidate;
                    break;
                }
            }
            if (index < 0) return;
            event.preventDefault();
            pointerId = event.pointerId;
            draggedIndex = index;
            selectedIndex = index;
            const body = bodies[index];
            body.vx = 0;
            body.vy = 0;
            lastPointer = { x: point.x, y: point.y, time: performance.now() };
            moving = true;
            stableFrames = 0;
            canvas.setPointerCapture(pointerId);
            setGrabState(true);
            setText(status, `GRABBED / BODY ${String(index + 1).padStart(2, "0")}`);
            render();
            if (!reduceMotion) loop.start();
        });

        canvas.addEventListener("pointermove", (event) => {
            if (event.pointerId !== pointerId || draggedIndex < 0) return;
            const point = localPoint(canvas, event);
            const body = bodies[draggedIndex];
            const now = performance.now();
            const deltaTime = Math.max(8, now - lastPointer.time);
            const nextX = clamp(point.x, radius, width - radius);
            const nextY = clamp(point.y, radius, height - radius);
            body.vx = lerp(body.vx, (nextX - body.x) / deltaTime * 16.67, 0.62);
            body.vy = lerp(body.vy, (nextY - body.y) / deltaTime * 16.67, 0.62);
            body.x = nextX;
            body.y = nextY;
            lastPointer = { x: point.x, y: point.y, time: now };
            collisionCount += resolveCollisions();
            render();
        });

        const release = (event) => {
            if (event.pointerId !== pointerId || draggedIndex < 0) return;
            const body = bodies[draggedIndex];
            if (performance.now() - lastPointer.time > 100 || reduceMotion) {
                body.vx = 0;
                body.vy = 0;
            }
            pointerId = null;
            draggedIndex = -1;
            setGrabState(false);
            moving = !reduceMotion && bodies.some((candidate) => Math.hypot(candidate.vx, candidate.vy) > 0.045);
            setText(status, moving ? "THROWN / COLLISIONS LIVE" : "PLACED / READY");
            if (moving) loop.start();
            else render();
        };

        canvas.addEventListener("pointerup", release);
        canvas.addEventListener("pointercancel", release);
        canvas.addEventListener("keydown", (event) => {
            if (/^[1-6]$/.test(event.key)) {
                selectedIndex = Number(event.key) - 1;
                setText(status, `SELECTED / BODY ${event.key.padStart(2, "0")}`);
                render();
                return;
            }
            if (event.key === "[" || event.key === "]") {
                event.preventDefault();
                const direction = event.key === "[" ? -1 : 1;
                selectedIndex = (selectedIndex + direction + bodies.length) % bodies.length;
                setText(status, `SELECTED / BODY ${String(selectedIndex + 1).padStart(2, "0")}`);
                render();
                return;
            }
            if (event.key === " ") {
                event.preventDefault();
                bodies.forEach((body) => {
                    body.vx = 0;
                    body.vy = 0;
                });
                moving = false;
                loop.stop();
                setText(status, "PAUSED / ALL BODIES");
                render();
                return;
            }
            const pushes = {
                ArrowLeft: [-4.8, 0],
                ArrowRight: [4.8, 0],
                ArrowUp: [0, -4.8],
                ArrowDown: [0, 4.8]
            };
            const push = pushes[event.key];
            if (!push) return;
            event.preventDefault();
            const body = bodies[selectedIndex];
            if (reduceMotion) {
                body.x = clamp(body.x + push[0] * 4, radius, width - radius);
                body.y = clamp(body.y + push[1] * 4, radius, height - radius);
                collisionCount += resolveCollisions();
                setText(status, "KEYBOARD PLACE / MOTION REDUCED");
                render();
            } else {
                body.vx += push[0];
                body.vy += push[1];
                moving = true;
                stableFrames = 0;
                setText(status, "KEYBOARD IMPULSE");
                loop.start();
            }
        });

        document.addEventListener("visibilitychange", () => {
            if (!document.hidden || pointerId === null) return;
            pointerId = null;
            draggedIndex = -1;
            setGrabState(false);
            if (reduceMotion) {
                bodies.forEach((body) => {
                    body.vx = 0;
                    body.vy = 0;
                });
                moving = false;
                setText(status, "PLACED / MOTION REDUCED");
                render();
            } else {
                moving = bodies.some((body) => Math.hypot(body.vx, body.vy) > 0.045);
            }
        });
        resetButton?.addEventListener("click", reset);
        window.addEventListener("resize", resize);
        resize();
    }

    function initOrbitalDrag() {
        const canvas = document.querySelector("[data-orbit-canvas]");
        const resetButton = document.querySelector("[data-reset]");
        const status = document.querySelector("[data-status]");
        const angleReadout = document.querySelector("[data-angle]");
        const angularReadout = document.querySelector("[data-angular-velocity]");
        const radiusReadout = document.querySelector("[data-orbit-radius]");
        if (!canvas) return;

        const context = canvas.getContext("2d");
        let width = 1;
        let height = 1;
        let centerX = 0;
        let centerY = 0;
        let radiusX = 100;
        let radiusY = 70;
        let angle = -0.72;
        let angularVelocity = 0;
        let pointerId = null;
        let lastPointerAngle = angle;
        let lastPointerTime = 0;
        let moving = false;
        let stableFrames = 0;

        const orbPosition = () => ({
            x: centerX + Math.cos(angle) * radiusX,
            y: centerY + Math.sin(angle) * radiusY
        });

        const angleForPoint = (point) => Math.atan2((point.y - centerY) / radiusY, (point.x - centerX) / radiusX);

        const render = () => {
            context.clearRect(0, 0, width, height);
            context.save();

            context.setLineDash([3, 10]);
            context.lineWidth = 1;
            context.strokeStyle = "rgba(197, 160, 255, 0.2)";
            [0.68, 1, 1.28].forEach((scale) => {
                context.beginPath();
                context.ellipse(centerX, centerY, radiusX * scale, radiusY * scale, 0, 0, Math.PI * 2);
                context.stroke();
            });

            context.setLineDash([]);
            context.beginPath();
            context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
            context.lineWidth = 3;
            context.strokeStyle = "rgba(255, 218, 91, 0.72)";
            context.stroke();

            context.beginPath();
            context.ellipse(centerX, centerY, radiusX, radiusY, 0, angle - 0.52, angle);
            context.lineWidth = 10;
            context.strokeStyle = "rgba(197, 160, 255, 0.5)";
            context.stroke();

            context.beginPath();
            context.arc(centerX, centerY, 8, 0, Math.PI * 2);
            context.fillStyle = "#ffda5b";
            context.fill();
            context.beginPath();
            context.arc(centerX, centerY, 25, 0, Math.PI * 2);
            context.strokeStyle = "rgba(255, 218, 91, 0.25)";
            context.lineWidth = 1;
            context.stroke();

            const orb = orbPosition();
            const gradient = context.createRadialGradient(orb.x - 10, orb.y - 12, 2, orb.x, orb.y, 32);
            gradient.addColorStop(0, "#fff9cf");
            gradient.addColorStop(0.32, "#ffda5b");
            gradient.addColorStop(1, "#9c5cff");
            context.beginPath();
            context.arc(orb.x, orb.y, 30, 0, Math.PI * 2);
            context.fillStyle = gradient;
            context.shadowColor = "rgba(197, 160, 255, 0.7)";
            context.shadowBlur = 24;
            context.fill();
            context.shadowBlur = 0;
            context.beginPath();
            context.arc(orb.x, orb.y, pointerId === null ? 40 : 48, 0, Math.PI * 2);
            context.strokeStyle = pointerId === null ? "rgba(255, 255, 255, 0.28)" : "rgba(255, 218, 91, 0.8)";
            context.lineWidth = 1;
            context.stroke();
            context.restore();

            const degrees = ((angle * 180 / Math.PI) % 360 + 360) % 360;
            setText(angleReadout, `${degrees.toFixed(1)}°`);
            setText(angularReadout, `${angularVelocity >= 0 ? "+" : "−"}${Math.abs(angularVelocity).toFixed(2)} rad/s`);
            setText(radiusReadout, `${Math.round(radiusX)} × ${Math.round(radiusY)}`);
        };

        const update = (delta) => {
            if (pointerId === null) {
                const seconds = delta / 1000;
                angle += angularVelocity * seconds;
                angularVelocity *= Math.pow(0.966, delta / 16.67);
            }
            render();

            if (pointerId !== null) {
                stableFrames = 0;
                return true;
            }

            stableFrames = Math.abs(angularVelocity) < 0.008 ? stableFrames + 1 : 0;
            if (stableFrames > 10) {
                angularVelocity = 0;
                moving = false;
                setText(status, "RESTING ON ORBIT");
                render();
                return false;
            }
            return true;
        };

        const loop = createLoop(update, () => moving || pointerId !== null);

        const reset = () => {
            angle = -0.72;
            angularVelocity = 0;
            pointerId = null;
            moving = false;
            stableFrames = 0;
            loop.stop();
            setGrabState(false);
            setText(status, "READY / ORBIT LOCKED");
            render();
        };

        const resize = () => {
            const size = sizeCanvas(canvas, context);
            width = size.width;
            height = size.height;
            centerX = width * 0.51;
            centerY = height * 0.52;
            radiusX = clamp(width * 0.34, 105, 320);
            radiusY = clamp(height * 0.27, 82, 205);
            render();
        };

        canvas.addEventListener("pointerdown", (event) => {
            if (pointerId !== null || event.button !== 0) return;
            const point = localPoint(canvas, event);
            if (distance(point, orbPosition()) > 68) return;
            event.preventDefault();
            pointerId = event.pointerId;
            lastPointerAngle = angleForPoint(point);
            lastPointerTime = performance.now();
            angularVelocity = 0;
            moving = true;
            stableFrames = 0;
            canvas.setPointerCapture(pointerId);
            setGrabState(true);
            setText(status, "DRAGGING / CONSTRAINED");
            render();
            if (!reduceMotion) loop.start();
        });

        canvas.addEventListener("pointermove", (event) => {
            if (event.pointerId !== pointerId) return;
            const point = localPoint(canvas, event);
            const nextAngle = angleForPoint(point);
            const deltaAngle = wrapAngle(nextAngle - lastPointerAngle);
            const now = performance.now();
            const deltaTime = Math.max(8, now - lastPointerTime);
            angle += deltaAngle;
            angularVelocity = lerp(angularVelocity, deltaAngle / deltaTime * 1000, 0.5);
            lastPointerAngle = nextAngle;
            lastPointerTime = now;
            render();
        });

        const release = (event) => {
            if (event.pointerId !== pointerId) return;
            if (performance.now() - lastPointerTime > 110 || reduceMotion) angularVelocity = 0;
            pointerId = null;
            setGrabState(false);
            moving = !reduceMotion && Math.abs(angularVelocity) > 0.008;
            setText(status, moving ? "COASTING / ANGULAR MOMENTUM" : "PLACED ON ORBIT");
            if (moving) loop.start();
            else render();
        };

        canvas.addEventListener("pointerup", release);
        canvas.addEventListener("pointercancel", release);
        canvas.addEventListener("keydown", (event) => {
            if (event.key === " ") {
                event.preventDefault();
                angularVelocity = 0;
                moving = false;
                loop.stop();
                setText(status, "BRAKED / ORBIT HOLD");
                render();
                return;
            }
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const direction = event.key === "ArrowLeft" ? -1 : 1;
            if (reduceMotion) {
                angle += direction * 0.16;
                setText(status, "KEYBOARD STEP / MOTION REDUCED");
                render();
            } else {
                angularVelocity += direction * 0.9;
                moving = true;
                stableFrames = 0;
                setText(status, "KEYBOARD TORQUE");
                loop.start();
            }
        });

        document.addEventListener("visibilitychange", () => {
            if (!document.hidden || pointerId === null) return;
            pointerId = null;
            setGrabState(false);
            if (reduceMotion) {
                angularVelocity = 0;
                moving = false;
                setText(status, "PLACED / MOTION REDUCED");
                render();
            } else {
                moving = Math.abs(angularVelocity) > 0.008;
            }
        });
        resetButton?.addEventListener("click", reset);
        window.addEventListener("resize", resize);
        resize();
        reset();
    }

    function initRubberBandDrag() {
        const canvas = document.querySelector("[data-rubber-canvas]");
        const resetButton = document.querySelector("[data-reset]");
        const status = document.querySelector("[data-status]");
        const pullReadout = document.querySelector("[data-pull]");
        const resistanceReadout = document.querySelector("[data-resistance]");
        const comfortReadout = document.querySelector("[data-comfort]");
        if (!canvas) return;

        const context = canvas.getContext("2d");
        let width = 1;
        let height = 1;
        let centerX = 0;
        let centerY = 0;
        let comfortRadius = 100;
        let offsetX = 0;
        let offsetY = 0;
        let velocityX = 0;
        let velocityY = 0;
        let rawTargetX = 0;
        let rawTargetY = 0;
        let rawDistance = 0;
        let pointerId = null;
        let lastPointerTime = 0;
        let springActive = false;
        let keyboardPulling = false;
        let stableFrames = 0;

        const mappedOffset = (rawX, rawY) => {
            const rawSpan = Math.hypot(rawX, rawY);
            if (rawSpan <= comfortRadius || rawSpan === 0) return { x: rawX, y: rawY, span: rawSpan };
            const excess = rawSpan - comfortRadius;
            const visibleExcess = excess / (1 + excess / (comfortRadius * 0.62));
            const visibleSpan = comfortRadius + visibleExcess;
            const scale = visibleSpan / rawSpan;
            return { x: rawX * scale, y: rawY * scale, span: visibleSpan };
        };

        const render = () => {
            context.clearRect(0, 0, width, height);
            const puckX = centerX + offsetX;
            const puckY = centerY + offsetY;
            const visualDistance = Math.hypot(offsetX, offsetY);
            const resistance = rawDistance > comfortRadius
                ? clamp((1 - Math.max(0, visualDistance - comfortRadius) / Math.max(1, rawDistance - comfortRadius)) * 100, 0, 100)
                : 0;

            context.save();
            context.setLineDash([4, 8]);
            context.beginPath();
            context.arc(centerX, centerY, comfortRadius, 0, Math.PI * 2);
            context.strokeStyle = "rgba(217, 21, 70, 0.35)";
            context.lineWidth = 2;
            context.stroke();
            context.setLineDash([]);

            context.beginPath();
            context.moveTo(centerX, centerY);
            context.lineTo(puckX, puckY);
            context.strokeStyle = visualDistance > comfortRadius ? "#d91546" : "rgba(107, 24, 43, 0.5)";
            context.lineWidth = clamp(3 + resistance * 0.055, 3, 8.5);
            context.stroke();

            if (pointerId !== null && rawDistance > visualDistance + 8) {
                context.beginPath();
                context.moveTo(puckX, puckY);
                context.lineTo(centerX + rawTargetX, centerY + rawTargetY);
                context.strokeStyle = "rgba(107, 24, 43, 0.2)";
                context.lineWidth = 1;
                context.setLineDash([2, 7]);
                context.stroke();
                context.setLineDash([]);
                context.beginPath();
                context.arc(centerX + rawTargetX, centerY + rawTargetY, 8, 0, Math.PI * 2);
                context.strokeStyle = "rgba(107, 24, 43, 0.34)";
                context.stroke();
            }

            context.beginPath();
            context.arc(centerX, centerY, 13, 0, Math.PI * 2);
            context.fillStyle = "#3d141c";
            context.fill();
            context.beginPath();
            context.arc(centerX, centerY, 27, 0, Math.PI * 2);
            context.strokeStyle = "rgba(107, 24, 43, 0.24)";
            context.lineWidth = 1;
            context.stroke();

            context.beginPath();
            context.arc(puckX + 7, puckY + 10, 34, 0, Math.PI * 2);
            context.fillStyle = "rgba(107, 24, 43, 0.16)";
            context.fill();
            context.beginPath();
            context.arc(puckX, puckY, 34, 0, Math.PI * 2);
            context.fillStyle = visualDistance > comfortRadius ? "#d91546" : "#ff6a44";
            context.fill();
            context.beginPath();
            context.arc(puckX, puckY, 13, 0, Math.PI * 2);
            context.strokeStyle = "rgba(255, 255, 255, 0.82)";
            context.lineWidth = 2;
            context.stroke();
            context.restore();

            setText(pullReadout, `${Math.round(rawDistance)} px`);
            setText(resistanceReadout, `${Math.round(resistance)}%`);
            setText(comfortReadout, `${Math.round(comfortRadius)} px`);
        };

        const setFromRaw = (rawX, rawY) => {
            rawTargetX = rawX;
            rawTargetY = rawY;
            rawDistance = Math.hypot(rawX, rawY);
            const mapped = mappedOffset(rawX, rawY);
            const previousX = offsetX;
            const previousY = offsetY;
            offsetX = mapped.x;
            offsetY = mapped.y;
            velocityX = offsetX - previousX;
            velocityY = offsetY - previousY;
            render();
        };

        const update = (delta) => {
            const scale = delta / 16.67;
            velocityX += -offsetX * 0.105 * scale;
            velocityY += -offsetY * 0.105 * scale;
            const damping = Math.pow(0.78, scale);
            velocityX *= damping;
            velocityY *= damping;
            offsetX += velocityX * scale;
            offsetY += velocityY * scale;
            rawDistance = Math.hypot(offsetX, offsetY);
            render();

            const energy = Math.hypot(offsetX, offsetY) + Math.hypot(velocityX, velocityY) * 3;
            stableFrames = energy < 0.32 ? stableFrames + 1 : 0;
            if (stableFrames > 8) {
                offsetX = 0;
                offsetY = 0;
                velocityX = 0;
                velocityY = 0;
                rawTargetX = 0;
                rawTargetY = 0;
                rawDistance = 0;
                springActive = false;
                setText(status, "CENTERED / SPRING REST");
                render();
                return false;
            }
            return true;
        };

        const loop = createLoop(update, () => springActive);

        const launchSpring = () => {
            keyboardPulling = false;
            if (reduceMotion) {
                offsetX = 0;
                offsetY = 0;
                velocityX = 0;
                velocityY = 0;
                rawTargetX = 0;
                rawTargetY = 0;
                rawDistance = 0;
                springActive = false;
                setText(status, "CENTERED / MOTION REDUCED");
                render();
                return;
            }
            if (Math.hypot(offsetX, offsetY) < 0.2) return;
            springActive = true;
            stableFrames = 0;
            setText(status, "REBOUNDING / SPRING LIVE");
            loop.start();
        };

        const reset = () => {
            pointerId = null;
            keyboardPulling = false;
            springActive = false;
            offsetX = 0;
            offsetY = 0;
            velocityX = 0;
            velocityY = 0;
            rawTargetX = 0;
            rawTargetY = 0;
            rawDistance = 0;
            stableFrames = 0;
            loop.stop();
            setGrabState(false);
            setText(status, "READY / COMFORT ZONE");
            render();
        };

        const resize = () => {
            const size = sizeCanvas(canvas, context);
            width = size.width;
            height = size.height;
            centerX = width * 0.5;
            centerY = height * 0.52;
            comfortRadius = clamp(Math.min(width, height) * 0.2, 76, 135);
            reset();
        };

        canvas.addEventListener("pointerdown", (event) => {
            if (pointerId !== null || event.button !== 0) return;
            const point = localPoint(canvas, event);
            const puck = { x: centerX + offsetX, y: centerY + offsetY };
            if (distance(point, puck) > 68) return;
            event.preventDefault();
            loop.stop();
            springActive = false;
            pointerId = event.pointerId;
            lastPointerTime = performance.now();
            velocityX = 0;
            velocityY = 0;
            canvas.setPointerCapture(pointerId);
            setGrabState(true);
            setText(status, "PULLING / RESISTANCE ARMED");
        });

        canvas.addEventListener("pointermove", (event) => {
            if (event.pointerId !== pointerId) return;
            const point = localPoint(canvas, event);
            const now = performance.now();
            const previousX = offsetX;
            const previousY = offsetY;
            setFromRaw(point.x - centerX, point.y - centerY);
            const deltaTime = Math.max(8, now - lastPointerTime);
            velocityX = lerp(velocityX, (offsetX - previousX) / deltaTime * 16.67, 0.45);
            velocityY = lerp(velocityY, (offsetY - previousY) / deltaTime * 16.67, 0.45);
            lastPointerTime = now;
            setText(status, rawDistance > comfortRadius ? "HEAVY PULL / NONLINEAR" : "SOFT PULL / 1:1");
        });

        const release = (event) => {
            if (event.pointerId !== pointerId) return;
            if (event.type === "pointercancel" || performance.now() - lastPointerTime > 100) {
                velocityX = 0;
                velocityY = 0;
            }
            pointerId = null;
            setGrabState(false);
            launchSpring();
        };

        canvas.addEventListener("pointerup", release);
        canvas.addEventListener("pointercancel", release);
        canvas.addEventListener("keydown", (event) => {
            const moves = {
                ArrowLeft: [-20, 0],
                ArrowRight: [20, 0],
                ArrowUp: [0, -20],
                ArrowDown: [0, 20]
            };
            const move = moves[event.key];
            if (!move) return;
            event.preventDefault();
            loop.stop();
            springActive = false;
            keyboardPulling = true;
            setFromRaw(rawTargetX + move[0] * (event.shiftKey ? 2 : 1), rawTargetY + move[1] * (event.shiftKey ? 2 : 1));
            setText(status, rawDistance > comfortRadius ? "KEY PULL / HEAVY ZONE" : "KEY PULL / COMFORT ZONE");
        });
        canvas.addEventListener("keyup", (event) => {
            if (!keyboardPulling || !event.key.startsWith("Arrow")) return;
            launchSpring();
        });
        canvas.addEventListener("blur", () => {
            if (keyboardPulling) launchSpring();
        });

        document.addEventListener("visibilitychange", () => {
            if (!document.hidden || pointerId === null) return;
            pointerId = null;
            setGrabState(false);
            launchSpring();
        });
        resetButton?.addEventListener("click", reset);
        window.addEventListener("resize", resize);
        resize();
    }

    function initPhysicsReorder() {
        const board = document.querySelector("[data-reorder-board]");
        const resetButton = document.querySelector("[data-reset]");
        const status = document.querySelector("[data-status]");
        const orderReadout = document.querySelector("[data-order]");
        const slotReadout = document.querySelector("[data-slot-readout]");
        const velocityReadout = document.querySelector("[data-reorder-velocity]");
        if (!board) return;

        const elements = [...board.querySelectorAll("[data-reorder-item]")];
        const states = elements.map((element, index) => ({
            element,
            id: index + 1,
            y: 0,
            target: 0,
            velocity: 0
        }));
        const originalOrder = states.slice();
        let order = states.slice();
        let rowHeight = 60;
        let pitch = 70;
        const padding = 14;
        let pointerId = null;
        let draggedState = null;
        let keyboardState = null;
        let dragOffset = 0;
        let lastPointerY = 0;
        let lastPointerTime = 0;
        let moving = false;

        const updateTargets = (snapOthers = false) => {
            order.forEach((state, index) => {
                state.target = padding + index * pitch;
                const title = state.element.querySelector(".item-title")?.textContent || `项目 ${state.id}`;
                state.element.setAttribute("aria-label", `${title}，当前位置 ${index + 1}，共 ${order.length} 项`);
                const slot = state.element.querySelector("[data-item-slot]");
                setText(slot, String(index + 1).padStart(2, "0"));
                if (snapOthers && state !== draggedState) {
                    state.y = state.target;
                    state.velocity = 0;
                }
            });
            setText(orderReadout, order.map((state) => String(state.id).padStart(2, "0")).join(" · "));
        };

        const render = () => {
            states.forEach((state) => {
                const rotation = state === draggedState ? clamp(state.velocity * 0.32, -4.5, 4.5) : clamp(state.velocity * 0.18, -2.5, 2.5);
                state.element.style.setProperty("--item-y", `${state.y.toFixed(2)}px`);
                state.element.style.setProperty("--item-rotate", `${rotation.toFixed(2)}deg`);
                state.element.style.setProperty("--item-scale", state === draggedState || state === keyboardState ? "1.025" : "1");
            });
            const active = draggedState || keyboardState;
            if (active) {
                setText(slotReadout, `${String(order.indexOf(active) + 1).padStart(2, "0")} / ${String(order.length).padStart(2, "0")}`);
                setText(velocityReadout, `${active.velocity >= 0 ? "+" : "−"}${Math.abs(active.velocity).toFixed(2)} px/f`);
            } else {
                setText(slotReadout, "— / 06");
                setText(velocityReadout, "0.00 px/f");
            }
        };

        const commitDomOrder = () => {
            order.forEach((state) => board.append(state.element));
        };

        const reorderAt = (state, targetIndex) => {
            const currentIndex = order.indexOf(state);
            const nextIndex = clamp(targetIndex, 0, order.length - 1);
            if (currentIndex === nextIndex) return false;
            order.splice(currentIndex, 1);
            order.splice(nextIndex, 0, state);
            updateTargets(reduceMotion);
            setText(status, `SLOT SHIFT / ${String(nextIndex + 1).padStart(2, "0")}`);
            return true;
        };

        const update = (delta) => {
            const scale = delta / 16.67;
            let unsettled = false;

            states.forEach((state) => {
                if (state === draggedState) return;
                const acceleration = (state.target - state.y) * 0.17 * scale;
                state.velocity = (state.velocity + acceleration) * Math.pow(0.7, scale);
                state.y += state.velocity * scale;
                if (Math.abs(state.target - state.y) > 0.06 || Math.abs(state.velocity) > 0.04) {
                    unsettled = true;
                } else {
                    state.y = state.target;
                    state.velocity = 0;
                }
            });
            render();

            if (draggedState) return true;
            if (!unsettled) {
                moving = false;
                commitDomOrder();
                setText(status, keyboardState ? "KEYBOARD LIFT / USE ↑ ↓" : "SETTLED / ORDER LOCKED");
                render();
                return false;
            }
            return true;
        };

        const loop = createLoop(update, () => moving || draggedState !== null);

        const measure = (snap = true) => {
            rowHeight = elements[0]?.offsetHeight || 60;
            pitch = rowHeight + 10;
            updateTargets(snap);
            render();
        };

        const beginPointerDrag = (state, event) => {
            if (pointerId !== null || keyboardState || event.button !== 0) return;
            event.preventDefault();
            pointerId = event.pointerId;
            draggedState = state;
            dragOffset = event.clientY - board.getBoundingClientRect().top - state.y;
            lastPointerY = event.clientY;
            lastPointerTime = performance.now();
            state.velocity = 0;
            moving = true;
            state.element.classList.add("is-dragging");
            state.element.setPointerCapture(pointerId);
            setGrabState(true);
            setText(status, `LIFTED / ITEM ${String(state.id).padStart(2, "0")}`);
            render();
            if (!reduceMotion) loop.start();
        };

        const movePointerDrag = (state, event) => {
            if (state !== draggedState || event.pointerId !== pointerId) return;
            const now = performance.now();
            const boardTop = board.getBoundingClientRect().top;
            const nextY = clamp(event.clientY - boardTop - dragOffset, padding - rowHeight * 0.35, padding + (order.length - 1) * pitch + rowHeight * 0.35);
            const deltaTime = Math.max(8, now - lastPointerTime);
            state.velocity = lerp(state.velocity, (event.clientY - lastPointerY) / deltaTime * 16.67, 0.6);
            state.y = nextY;
            lastPointerY = event.clientY;
            lastPointerTime = now;
            reorderAt(state, Math.round((state.y - padding) / pitch));
            render();
        };

        const endPointerDrag = (state, event) => {
            if (state !== draggedState || event.pointerId !== pointerId) return;
            const useInertia = event.type !== "pointercancel" && performance.now() - lastPointerTime <= 100;
            if (!useInertia) state.velocity = 0;
            const projectedY = state.y + state.velocity * 4.2;
            reorderAt(state, Math.round((projectedY - padding) / pitch));
            pointerId = null;
            draggedState = null;
            state.element.classList.remove("is-dragging");
            setGrabState(false);
            if (reduceMotion) {
                state.y = state.target;
                state.velocity = 0;
                updateTargets(true);
                commitDomOrder();
                moving = false;
                setText(status, "PLACED / MOTION REDUCED");
                render();
            } else {
                moving = true;
                setText(status, "RELEASED / INERTIAL DROP");
                loop.start();
            }
        };

        const dropKeyboardState = () => {
            if (!keyboardState) return;
            keyboardState.element.classList.remove("is-dragging");
            keyboardState = null;
            setText(status, "KEYBOARD DROP / SETTLING");
            moving = states.some((state) => Math.abs(state.target - state.y) > 0.06);
            if (moving && !reduceMotion) loop.start();
            else {
                updateTargets(true);
                commitDomOrder();
                render();
            }
        };

        states.forEach((state) => {
            state.element.addEventListener("pointerdown", (event) => beginPointerDrag(state, event));
            state.element.addEventListener("pointermove", (event) => movePointerDrag(state, event));
            state.element.addEventListener("pointerup", (event) => endPointerDrag(state, event));
            state.element.addEventListener("pointercancel", (event) => endPointerDrag(state, event));
            state.element.addEventListener("keydown", (event) => {
                if (event.key === " " || event.key === "Enter") {
                    event.preventDefault();
                    if (keyboardState === state) {
                        dropKeyboardState();
                    } else if (!keyboardState && pointerId === null) {
                        keyboardState = state;
                        state.element.classList.add("is-dragging");
                        setText(status, `KEYBOARD LIFT / ITEM ${String(state.id).padStart(2, "0")}`);
                        render();
                    }
                    return;
                }
                if (event.key === "Escape" && keyboardState === state) {
                    event.preventDefault();
                    dropKeyboardState();
                    return;
                }
                if (keyboardState !== state || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
                event.preventDefault();
                const direction = event.key === "ArrowUp" ? -1 : 1;
                const nextIndex = order.indexOf(state) + direction;
                if (!reorderAt(state, nextIndex)) return;
                if (reduceMotion) {
                    updateTargets(true);
                    commitDomOrder();
                    render();
                } else {
                    moving = true;
                    state.velocity += direction * 1.8;
                    loop.start();
                }
            });
        });

        const reset = () => {
            loop.stop();
            pointerId = null;
            if (draggedState) draggedState.element.classList.remove("is-dragging");
            if (keyboardState) keyboardState.element.classList.remove("is-dragging");
            draggedState = null;
            keyboardState = null;
            order = originalOrder.slice();
            states.forEach((state) => {
                state.velocity = 0;
            });
            moving = false;
            setGrabState(false);
            updateTargets(true);
            commitDomOrder();
            setText(status, "RESET / ORIGINAL ORDER");
            render();
        };

        document.addEventListener("visibilitychange", () => {
            if (!document.hidden || !draggedState) return;
            const interruptedState = draggedState;
            interruptedState.element.classList.remove("is-dragging");
            draggedState = null;
            pointerId = null;
            setGrabState(false);
            if (reduceMotion) {
                reorderAt(interruptedState, Math.round((interruptedState.y - padding) / pitch));
                states.forEach((state) => {
                    state.velocity = 0;
                });
                updateTargets(true);
                commitDomOrder();
                moving = false;
                setText(status, "PLACED / MOTION REDUCED");
                render();
            } else {
                moving = true;
            }
        });
        resetButton?.addEventListener("click", reset);
        window.addEventListener("resize", () => measure(true));
        measure(true);
        commitDomOrder();
        setText(status, "READY / LIFT AN ITEM");
    }

    const initializers = {
        "rope-constraint": initRopeConstraint,
        "collision-drag": initCollisionDrag,
        "orbital-drag": initOrbitalDrag,
        "rubber-band-drag": initRubberBandDrag,
        "physics-reorder": initPhysicsReorder
    };

    initializers[effect]?.();
})();
