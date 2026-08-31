(() => {
    "use strict";

    const effect = document.body.dataset.effect;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
    const lerp = (from, to, amount) => from + (to - from) * amount;
    const easeOut = (value) => 1 - Math.pow(1 - clamp(value), 3);
    const progressThrough = (element) => {
        const rect = element.getBoundingClientRect();
        return clamp(-rect.top / Math.max(1, element.offsetHeight - window.innerHeight));
    };
    const onFrame = (callback) => {
        let queued = false;
        return () => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => {
                queued = false;
                callback();
            });
        };
    };

    const setGrabState = (active) => document.body.classList.toggle("is-grabbing", active);

    function initInfiniteCanvas() {
        const viewport = document.querySelector("[data-infinite-viewport]");
        const sourcePlane = document.querySelector("[data-infinite-plane]");
        const status = document.querySelector("[data-infinite-status]");
        const readoutX = document.querySelector("[data-canvas-x]");
        const readoutY = document.querySelector("[data-canvas-y]");
        if (!viewport || !sourcePlane) return;

        let virtualX = 0;
        let virtualY = 0;
        let pointerId = null;
        let lastX = 0;
        let lastY = 0;
        let periodX = 1600;
        let periodY = 980;
        let planes = [sourcePlane];

        const signed = (value) => `${value >= 0 ? "+" : "−"}${String(Math.abs(Math.round(value))).padStart(3, "0")}`;
        const wrap = (value, span) => ((value + span / 2) % span + span) % span - span / 2;

        const buildField = () => {
            planes.slice(1).forEach((plane) => plane.remove());
            periodX = sourcePlane.offsetWidth + 64;
            periodY = sourcePlane.offsetHeight + 64;
            planes = [sourcePlane];

            for (let row = -1; row <= 1; row += 1) {
                for (let column = -1; column <= 1; column += 1) {
                    if (row === 0 && column === 0) continue;
                    const clone = sourcePlane.cloneNode(true);
                    clone.removeAttribute("data-infinite-plane");
                    clone.querySelectorAll("img").forEach((image) => image.setAttribute("alt", ""));
                    clone.style.setProperty("--replica-x", `${column * periodX}px`);
                    clone.style.setProperty("--replica-y", `${row * periodY}px`);
                    viewport.append(clone);
                    planes.push(clone);
                }
            }
            render();
        };

        const render = () => {
            const visualX = wrap(virtualX, periodX);
            const visualY = wrap(virtualY, periodY);
            planes.forEach((plane) => {
                plane.style.setProperty("--pan-x", `calc(${visualX}px + var(--replica-x, 0px))`);
                plane.style.setProperty("--pan-y", `calc(${visualY}px + var(--replica-y, 0px))`);
            });
            viewport.style.setProperty("--grid-x", `${wrap(virtualX, 56)}px`);
            viewport.style.setProperty("--grid-y", `${wrap(virtualY, 56)}px`);
            if (readoutX) readoutX.textContent = `X ${signed(virtualX)}`;
            if (readoutY) readoutY.textContent = `Y ${signed(virtualY)}`;
        };

        const move = (deltaX, deltaY) => {
            virtualX += deltaX;
            virtualY += deltaY;
            render();
        };

        viewport.addEventListener("pointerdown", (event) => {
            pointerId = event.pointerId;
            lastX = event.clientX;
            lastY = event.clientY;
            viewport.setPointerCapture(pointerId);
            setGrabState(true);
            if (status) status.textContent = "PANNING THE FIELD";
        });

        viewport.addEventListener("pointermove", (event) => {
            if (event.pointerId !== pointerId) return;
            move(event.clientX - lastX, event.clientY - lastY);
            lastX = event.clientX;
            lastY = event.clientY;
        });

        const endDrag = (event) => {
            if (event.pointerId !== pointerId) return;
            pointerId = null;
            setGrabState(false);
            if (status) status.textContent = "DRAG / WHEEL / ARROW KEYS";
        };

        viewport.addEventListener("pointerup", endDrag);
        viewport.addEventListener("pointercancel", endDrag);
        viewport.addEventListener("wheel", (event) => {
            event.preventDefault();
            move(-event.deltaX - event.deltaY * 0.42, -event.deltaY * 0.78);
            if (status) status.textContent = "WHEEL NAVIGATION";
        }, { passive: false });

        viewport.addEventListener("keydown", (event) => {
            const moves = {
                ArrowLeft: [72, 0],
                ArrowRight: [-72, 0],
                ArrowUp: [0, 72],
                ArrowDown: [0, -72]
            };
            const delta = moves[event.key];
            if (!delta) return;
            event.preventDefault();
            move(delta[0], delta[1]);
            if (status) status.textContent = "KEYBOARD NAVIGATION";
        });

        window.addEventListener("resize", onFrame(buildField));
        buildField();
    }

    function initInertialDrag() {
        const arena = document.querySelector("[data-inertia-arena]");
        const puck = document.querySelector("[data-drag-puck]");
        const stateLabel = document.querySelector("[data-puck-state]");
        const velocityX = document.querySelector("[data-velocity-x]");
        const velocityY = document.querySelector("[data-velocity-y]");
        const energy = document.querySelector("[data-energy]");
        if (!arena || !puck) return;

        let x = 0;
        let y = 0;
        let vx = 0;
        let vy = 0;
        let pointerId = null;
        let lastX = 0;
        let lastY = 0;
        let lastTime = 0;
        let frame = 0;
        let previousFrameTime = 0;

        const bounds = () => ({
            x: Math.max(0, (arena.clientWidth - puck.offsetWidth) / 2 - 12),
            y: Math.max(0, (arena.clientHeight - puck.offsetHeight) / 2 - 12)
        });

        const render = () => {
            puck.style.setProperty("--puck-x", `${x}px`);
            puck.style.setProperty("--puck-y", `${y}px`);
            puck.style.setProperty("--puck-rotate", `${clamp(vx * 0.32, -11, 11)}deg`);
            const speed = Math.hypot(vx, vy);
            if (velocityX) velocityX.textContent = vx.toFixed(2);
            if (velocityY) velocityY.textContent = vy.toFixed(2);
            if (energy) energy.textContent = `${Math.round(clamp(speed / 34) * 100)}%`;
        };

        const stopFrame = () => {
            cancelAnimationFrame(frame);
            frame = 0;
            previousFrameTime = 0;
        };

        const animate = (time) => {
            const delta = previousFrameTime ? Math.min(32, time - previousFrameTime) : 16.67;
            previousFrameTime = time;
            const scale = delta / 16.67;
            const limit = bounds();

            x += vx * scale;
            y += vy * scale;
            if (x < -limit.x || x > limit.x) {
                x = clamp(x, -limit.x, limit.x);
                vx *= -0.72;
            }
            if (y < -limit.y || y > limit.y) {
                y = clamp(y, -limit.y, limit.y);
                vy *= -0.72;
            }

            const friction = Math.pow(0.94, scale);
            vx *= friction;
            vy *= friction;
            render();

            if (Math.hypot(vx, vy) > 0.12) {
                frame = requestAnimationFrame(animate);
            } else {
                vx = 0;
                vy = 0;
                render();
                frame = 0;
                previousFrameTime = 0;
                if (stateLabel) stateLabel.textContent = "RESTING";
            }
        };

        const launch = () => {
            stopFrame();
            if (reduceMotion) {
                vx = 0;
                vy = 0;
                render();
                if (stateLabel) stateLabel.textContent = "PLACED";
                return;
            }
            if (Math.hypot(vx, vy) > 0.12) {
                if (stateLabel) stateLabel.textContent = "COASTING";
                frame = requestAnimationFrame(animate);
            }
        };

        puck.addEventListener("pointerdown", (event) => {
            stopFrame();
            pointerId = event.pointerId;
            lastX = event.clientX;
            lastY = event.clientY;
            lastTime = performance.now();
            vx = 0;
            vy = 0;
            puck.setPointerCapture(pointerId);
            setGrabState(true);
            if (stateLabel) stateLabel.textContent = "GRABBED";
        });

        puck.addEventListener("pointermove", (event) => {
            if (event.pointerId !== pointerId) return;
            const now = performance.now();
            const deltaTime = Math.max(8, now - lastTime);
            const deltaX = event.clientX - lastX;
            const deltaY = event.clientY - lastY;
            const limit = bounds();
            x = clamp(x + deltaX, -limit.x, limit.x);
            y = clamp(y + deltaY, -limit.y, limit.y);
            vx = lerp(vx, deltaX / deltaTime * 16.67, 0.62);
            vy = lerp(vy, deltaY / deltaTime * 16.67, 0.62);
            lastX = event.clientX;
            lastY = event.clientY;
            lastTime = now;
            render();
        });

        const release = (event) => {
            if (event.pointerId !== pointerId) return;
            pointerId = null;
            setGrabState(false);
            launch();
        };

        puck.addEventListener("pointerup", release);
        puck.addEventListener("pointercancel", release);
        puck.addEventListener("keydown", (event) => {
            const pushes = {
                ArrowLeft: [-7, 0],
                ArrowRight: [7, 0],
                ArrowUp: [0, -7],
                ArrowDown: [0, 7]
            };
            const push = pushes[event.key];
            if (!push) return;
            event.preventDefault();
            vx += push[0];
            vy += push[1];
            launch();
        });

        window.addEventListener("resize", onFrame(() => {
            const limit = bounds();
            x = clamp(x, -limit.x, limit.x);
            y = clamp(y, -limit.y, limit.y);
            render();
        }));
        render();
    }

    function initDragCarousel() {
        const viewport = document.querySelector("[data-carousel-window]");
        const track = document.querySelector("[data-carousel-track]");
        const cards = [...document.querySelectorAll("[data-carousel-card]")];
        const meter = document.querySelector("[data-carousel-meter]");
        const status = document.querySelector("[data-carousel-status]");
        if (!viewport || !track || !cards.length) return;

        let x = 0;
        let velocity = 0;
        let pointerId = null;
        let lastX = 0;
        let lastTime = 0;
        let frame = 0;
        let previousTime = 0;

        const minX = () => Math.min(0, viewport.clientWidth - track.scrollWidth);
        const render = () => {
            x = clamp(x, minX(), 0);
            track.style.setProperty("--carousel-x", `${x}px`);
            const range = Math.max(1, -minX());
            const progress = clamp(-x / range);
            if (meter) meter.style.setProperty("--meter", `${progress * 100}%`);

            const viewportCenter = viewport.clientWidth / 2;
            cards.forEach((card) => {
                const rect = card.getBoundingClientRect();
                const distance = clamp((rect.left + rect.width / 2 - viewportCenter) / viewport.clientWidth, -1.3, 1.3);
                card.style.setProperty("--card-rotate", `${distance * -8}deg`);
                card.style.setProperty("--image-shift", `${-9 - distance * 7}%`);
                card.style.setProperty("--index-shift", `${distance * 25}px`);
            });
        };

        const stop = () => {
            cancelAnimationFrame(frame);
            frame = 0;
            previousTime = 0;
        };

        const coast = (time) => {
            const delta = previousTime ? Math.min(32, time - previousTime) : 16.67;
            previousTime = time;
            x += velocity * delta / 16.67;
            velocity *= Math.pow(0.92, delta / 16.67);
            const edge = x <= minX() || x >= 0;
            render();
            if (Math.abs(velocity) > 0.1 && !edge) {
                frame = requestAnimationFrame(coast);
            } else {
                frame = 0;
                if (status) status.textContent = "DRAG THE ARCHIVE";
            }
        };

        const release = (event) => {
            if (event.pointerId !== pointerId) return;
            pointerId = null;
            setGrabState(false);
            if (!reduceMotion && Math.abs(velocity) > 0.1) {
                if (status) status.textContent = "INERTIA / COASTING";
                frame = requestAnimationFrame(coast);
            } else if (status) {
                status.textContent = "DRAG THE ARCHIVE";
            }
        };

        viewport.addEventListener("pointerdown", (event) => {
            stop();
            pointerId = event.pointerId;
            lastX = event.clientX;
            lastTime = performance.now();
            velocity = 0;
            viewport.setPointerCapture(pointerId);
            setGrabState(true);
            if (status) status.textContent = "PARALLAX / ACTIVE";
        });

        viewport.addEventListener("pointermove", (event) => {
            if (event.pointerId !== pointerId) return;
            const now = performance.now();
            const deltaX = event.clientX - lastX;
            const deltaTime = Math.max(8, now - lastTime);
            x = clamp(x + deltaX, minX(), 0);
            velocity = lerp(velocity, deltaX / deltaTime * 16.67, 0.55);
            lastX = event.clientX;
            lastTime = now;
            render();
        });

        viewport.addEventListener("pointerup", release);
        viewport.addEventListener("pointercancel", release);
        viewport.addEventListener("keydown", (event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            x += event.key === "ArrowLeft" ? 180 : -180;
            render();
            if (status) status.textContent = "KEYBOARD / STEP";
        });

        window.addEventListener("resize", onFrame(render));
        render();
    }

    function initHorizontalScroll() {
        const lab = document.querySelector("[data-horizontal-lab]");
        const track = document.querySelector("[data-horizontal-track]");
        const progressBar = document.querySelector("[data-horizontal-progress]");
        const percent = document.querySelector("[data-horizontal-percent]");
        const images = [...document.querySelectorAll(".horizontal-panel > img")];
        if (!lab || !track || reduceMotion) return;

        const update = () => {
            const progress = progressThrough(lab);
            const travel = Math.max(0, track.scrollWidth - window.innerWidth);
            track.style.setProperty("--horizontal-x", `${-travel * progress}px`);
            if (progressBar) progressBar.style.setProperty("--horizontal-progress", `${progress * 100}%`);
            if (percent) percent.textContent = `${String(Math.round(progress * 100)).padStart(3, "0")}%`;

            images.forEach((image) => {
                const panel = image.parentElement;
                const panelProgress = clamp((window.innerWidth - panel.getBoundingClientRect().left) / (window.innerWidth * 2));
                image.style.setProperty("--panel-image-x", `${(panelProgress - 0.5) * 12}%`);
            });
        };

        const queueUpdate = onFrame(update);
        window.addEventListener("scroll", queueUpdate, { passive: true });
        window.addEventListener("resize", queueUpdate);
        update();
    }

    function initDepthScroll() {
        const lab = document.querySelector("[data-depth-lab]");
        const layers = [...document.querySelectorAll("[data-depth-layer]")];
        const value = document.querySelector("[data-depth-value]");
        const meter = document.querySelector("[data-depth-meter]");
        if (!lab || !layers.length || reduceMotion) return;

        const update = () => {
            const progress = progressThrough(lab);
            const travel = Math.min(window.innerHeight * 0.42, 340);
            layers.forEach((layer) => {
                const depth = Number(layer.dataset.depthLayer);
                const y = (0.5 - progress) * travel * depth;
                layer.style.setProperty("--depth-y", `${y}px`);
            });
            if (value) value.textContent = `Z ${String(Math.round(progress * 999)).padStart(3, "0")}`;
            if (meter) meter.style.setProperty("--depth-meter", `${progress * 100}%`);
        };

        const queueUpdate = onFrame(update);
        window.addEventListener("scroll", queueUpdate, { passive: true });
        window.addEventListener("resize", queueUpdate);
        update();
    }

    function initZoomScroll() {
        const lab = document.querySelector("[data-zoom-lab]");
        const stage = lab?.querySelector(".zoom-sticky");
        const frames = [...document.querySelectorAll("[data-zoom-frame]")];
        const percent = document.querySelector("[data-zoom-percent]");
        const label = document.querySelector("[data-zoom-label]");
        const meter = document.querySelector("[data-zoom-meter]");
        const labels = ["SURFACE", "CURRENT", "CORE", "BEYOND"];
        const baseScales = [1, 0.32, 0.105, 0.034];
        if (!lab || !stage || !frames.length || reduceMotion) return;

        const update = () => {
            const progress = progressThrough(lab);
            const phase = progress * frames.length;
            const zoomFactor = Math.pow(3.12, phase);

            frames.forEach((frame, index) => {
                const scale = baseScales[index] * zoomFactor;
                const local = phase - index;
                const opacity = index === frames.length - 1 ? 1 : 1 - clamp((local - 0.7) / 0.32);
                frame.style.setProperty("--frame-scale", scale.toFixed(4));
                frame.style.setProperty("--frame-opacity", opacity.toFixed(3));
            });

            stage.style.setProperty("--zoom-copy-scale", `${1 + progress * 2.4}`);
            stage.style.setProperty("--zoom-copy-opacity", `${1 - clamp(progress / 0.18)}`);
            if (percent) percent.textContent = `${String(Math.round(progress * 100)).padStart(3, "0")}%`;
            if (label) label.textContent = labels[Math.min(labels.length - 1, Math.floor(progress * labels.length))];
            if (meter) meter.style.setProperty("--zoom-meter", `${progress * 100}%`);
        };

        const queueUpdate = onFrame(update);
        window.addEventListener("scroll", queueUpdate, { passive: true });
        window.addEventListener("resize", queueUpdate);
        update();
    }

    function initScrollStack() {
        const lab = document.querySelector("[data-stack-lab]");
        const cards = [...document.querySelectorAll("[data-stack-card]")];
        const count = document.querySelector("[data-stack-count]");
        const meter = document.querySelector("[data-stack-meter]");
        if (!lab || !cards.length || reduceMotion) return;

        const finalPositions = [
            [-74, 40, -90, -10],
            [-42, 20, -65, 7],
            [-15, 4, -40, -4],
            [18, -9, -15, 5],
            [50, -22, 10, -5],
            [78, -36, 35, 3]
        ];

        const update = () => {
            const progress = progressThrough(lab);
            const phase = progress * (cards.length + 0.65);
            let arrived = 0;

            cards.forEach((card, index) => {
                const local = clamp((phase - index) / 0.9);
                const eased = easeOut(local);
                const [endX, endY, endZ, endRotate] = finalPositions[index];
                const startX = index % 2 ? 210 : -210;
                const startY = 150 + index * 10;
                card.style.setProperty("--stack-x", `${lerp(startX, endX, eased)}px`);
                card.style.setProperty("--stack-y", `${lerp(startY, endY, eased)}px`);
                card.style.setProperty("--stack-z", `${lerp(-1050, endZ, eased)}px`);
                card.style.setProperty("--stack-rx", `${lerp(38, 0, eased)}deg`);
                card.style.setProperty("--stack-ry", `${lerp(index % 2 ? 32 : -32, 0, eased)}deg`);
                card.style.setProperty("--stack-rz", `${lerp(index % 2 ? 24 : -24, endRotate, eased)}deg`);
                card.style.setProperty("--stack-opacity", clamp(local * 2).toFixed(3));
                if (local > 0.76) arrived += 1;
            });

            if (count) count.textContent = String(arrived).padStart(2, "0");
            if (meter) meter.style.setProperty("--stack-meter", `${progress * 100}%`);
        };

        const queueUpdate = onFrame(update);
        window.addEventListener("scroll", queueUpdate, { passive: true });
        window.addEventListener("resize", queueUpdate);
        update();
    }

    function initSvgMorph() {
        const lab = document.querySelector("[data-morph-lab]");
        const stage = lab?.querySelector(".morph-sticky");
        const path = document.querySelector("[data-morph-path]");
        const echo = document.querySelector("[data-morph-echo]");
        const label = document.querySelector("[data-morph-label]");
        const percent = document.querySelector("[data-morph-percent]");
        const meter = document.querySelector("[data-morph-meter]");
        const turbulence = document.querySelector("[data-turbulence]");
        const displacement = document.querySelector("[data-displacement]");
        if (!lab || !stage || !path || !echo || !turbulence || !displacement) return;

        const labels = ["CALM", "DRIFT", "CHURN", "BURST"];

        const render = (progress) => {
            const eased = clamp(progress);
            const frequencyX = lerp(0.006, 0.031, eased);
            const frequencyY = lerp(0.012, 0.006, eased);
            turbulence.setAttribute("baseFrequency", `${frequencyX.toFixed(4)} ${frequencyY.toFixed(4)}`);
            turbulence.setAttribute("numOctaves", String(2 + Math.floor(eased * 2)));
            turbulence.setAttribute("seed", String(7 + Math.floor(eased * 19)));
            displacement.setAttribute("scale", lerp(18, 142, Math.sin(eased * Math.PI * 0.5)).toFixed(1));
            path.style.strokeWidth = lerp(22, 8, eased).toFixed(2);
            echo.style.opacity = lerp(0.2, 0.72, eased).toFixed(3);
            stage.style.setProperty("--morph-rotation", `${progress * 52}deg`);
            stage.style.setProperty("--morph-light-x", `${65 + Math.sin(progress * Math.PI * 2) * 9}%`);
            stage.style.setProperty("--morph-light-y", `${44 + Math.cos(progress * Math.PI * 2) * 7}%`);
            if (label) label.textContent = labels[Math.min(labels.length - 1, Math.floor(progress * labels.length))];
            if (percent) percent.textContent = `${String(Math.round(progress * 100)).padStart(3, "0")}%`;
            if (meter) meter.style.setProperty("--morph-meter", `${progress * 100}%`);
        };

        if (reduceMotion) {
            render(0);
            return;
        }

        const update = () => render(progressThrough(lab));
        const queueUpdate = onFrame(update);
        window.addEventListener("scroll", queueUpdate, { passive: true });
        window.addEventListener("resize", queueUpdate);
        update();
    }

    const initializers = {
        "infinite-canvas": initInfiniteCanvas,
        "inertial-drag": initInertialDrag,
        "drag-parallax-carousel": initDragCarousel,
        "horizontal-scroll": initHorizontalScroll,
        "parallax-depth-scroll": initDepthScroll,
        "layered-zoom-scroll": initZoomScroll,
        "scroll-3d-stack": initScrollStack,
        "scroll-svg-morph": initSvgMorph
    };

    initializers[effect]?.();
})();
