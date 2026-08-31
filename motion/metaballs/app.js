(() => {
    const stage = document.querySelector("[data-stage]");
    const canvas = document.querySelector("#gooey-canvas");
    const prompt = document.querySelector("[data-prompt]");
    const stateLabel = document.querySelector("[data-state]");
    const pointerOrbit = document.querySelector("[data-pointer-orbit]");
    const scatterButton = document.querySelector("[data-scatter]");

    if (!stage || !canvas || !prompt || !stateLabel || !pointerOrbit || !scatterButton) {
        return;
    }

    const context = canvas.getContext("2d");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const colors = ["#65ebff", "#7768ff", "#ff66ba", "#b9ff7d", "#548cff"];
    const blobs = [];
    const pointer = {
        x: 0,
        y: 0,
        active: false,
        down: false,
        type: "mouse",
        holdUntil: 0
    };

    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let animationFrame = 0;
    let lastTime = 0;
    let reducedMotion = motionQuery.matches;

    const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);

    function makeBlob(index) {
        const scale = Math.min(width, height);
        const radius = scale * (0.055 + (index % 5) * 0.014);
        const angle = (index / 12) * Math.PI * 2 + Math.random() * 0.5;
        const spreadX = width * (0.14 + Math.random() * 0.22);
        const spreadY = height * (0.12 + Math.random() * 0.25);

        return {
            x: width * 0.69 + Math.cos(angle) * spreadX,
            y: height * 0.5 + Math.sin(angle) * spreadY,
            vx: (Math.random() - 0.5) * 1.2,
            vy: (Math.random() - 0.5) * 1.2,
            radius,
            phase: Math.random() * Math.PI * 2,
            phaseSpeed: 0.006 + Math.random() * 0.008,
            color: colors[index % colors.length]
        };
    }

    function resize() {
        const previousWidth = width || stage.clientWidth;
        const previousHeight = height || stage.clientHeight;
        width = stage.clientWidth;
        height = stage.clientHeight;
        pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);

        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        if (blobs.length === 0) {
            for (let index = 0; index < 12; index += 1) {
                blobs.push(makeBlob(index));
            }
        } else {
            const ratioX = width / previousWidth;
            const ratioY = height / previousHeight;
            const scale = Math.min(width, height);

            blobs.forEach((blob, index) => {
                blob.x *= ratioX;
                blob.y *= ratioY;
                blob.radius = scale * (0.055 + (index % 5) * 0.014);
            });
        }

        draw();
    }

    function draw() {
        context.clearRect(0, 0, width, height);
        context.globalCompositeOperation = "screen";

        blobs.forEach((blob) => {
            context.fillStyle = blob.color;
            context.beginPath();
            context.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
            context.fill();
        });

        context.globalCompositeOperation = "source-over";
    }

    function separateFrom(originX, originY, strength = 3.8) {
        blobs.forEach((blob) => {
            const deltaX = blob.x - originX;
            const deltaY = blob.y - originY;
            const distance = Math.hypot(deltaX, deltaY) || 1;
            const impulse = strength * (0.55 + Math.random() * 0.7);
            blob.vx += (deltaX / distance) * impulse;
            blob.vy += (deltaY / distance) * impulse;
        });
    }

    function update(time) {
        const delta = lastTime ? Math.min((time - lastTime) / 16.667, 2) : 1;
        lastTime = time;

        if (!pointer.down && time > pointer.holdUntil) {
            pointer.active = false;
            pointerOrbit.classList.remove("is-pulling");
        }

        for (let first = 0; first < blobs.length; first += 1) {
            const blob = blobs[first];
            blob.phase += blob.phaseSpeed * delta;
            blob.vx += Math.cos(blob.phase * 1.7 + first) * 0.014 * delta;
            blob.vy += Math.sin(blob.phase * 1.3 - first) * 0.014 * delta;

            if (pointer.active) {
                const deltaX = pointer.x - blob.x;
                const deltaY = pointer.y - blob.y;
                const distance = Math.hypot(deltaX, deltaY) || 1;
                const reach = Math.max(width, height) * 0.76;
                const pull = Math.max(0, 1 - distance / reach) * (pointer.down ? 0.062 : 0.035);
                blob.vx += (deltaX / distance) * pull * delta;
                blob.vy += (deltaY / distance) * pull * delta;
                blob.vx += (-deltaY / distance) * pull * 0.12 * delta;
                blob.vy += (deltaX / distance) * pull * 0.12 * delta;
            }

            for (let second = first + 1; second < blobs.length; second += 1) {
                const other = blobs[second];
                const deltaX = other.x - blob.x;
                const deltaY = other.y - blob.y;
                const distance = Math.hypot(deltaX, deltaY) || 1;
                const restingDistance = (blob.radius + other.radius) * 0.52;

                if (!pointer.active && distance < restingDistance) {
                    const push = (restingDistance - distance) * 0.0009 * delta;
                    const normalX = deltaX / distance;
                    const normalY = deltaY / distance;
                    blob.vx -= normalX * push;
                    blob.vy -= normalY * push;
                    other.vx += normalX * push;
                    other.vy += normalY * push;
                }
            }

            const speed = Math.hypot(blob.vx, blob.vy);
            const speedLimit = pointer.active ? 5.2 : 2.4;
            if (speed > speedLimit) {
                blob.vx = (blob.vx / speed) * speedLimit;
                blob.vy = (blob.vy / speed) * speedLimit;
            }

            blob.vx *= pointer.active ? 0.994 : 0.997;
            blob.vy *= pointer.active ? 0.994 : 0.997;
            blob.x += blob.vx * delta;
            blob.y += blob.vy * delta;

            const margin = blob.radius * 0.3;
            if (blob.x < margin || blob.x > width - margin) {
                blob.x = clamp(blob.x, margin, width - margin);
                blob.vx *= -0.88;
            }
            if (blob.y < margin || blob.y > height - margin) {
                blob.y = clamp(blob.y, margin, height - margin);
                blob.vy *= -0.88;
            }
        }

        draw();
        animationFrame = requestAnimationFrame(update);
    }

    function setPointerPosition(event) {
        const bounds = stage.getBoundingClientRect();
        pointer.x = clamp(event.clientX - bounds.left, 0, bounds.width);
        pointer.y = clamp(event.clientY - bounds.top, 0, bounds.height);
        pointer.type = event.pointerType;
        pointerOrbit.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
        pointerOrbit.classList.add("is-visible");
    }

    function beginPull(event) {
        if (reducedMotion || event.target.closest("a, button")) {
            return;
        }

        setPointerPosition(event);
        pointer.down = true;
        pointer.active = true;
        pointer.holdUntil = Number.POSITIVE_INFINITY;
        stage.setPointerCapture(event.pointerId);
        pointerOrbit.classList.add("is-pulling");
        stateLabel.textContent = "FIELD ATTRACTING";
        prompt.textContent = "拖动聚合，松手让融球分离";
    }

    function movePointer(event) {
        if (reducedMotion || (event.pointerType !== "mouse" && !pointer.down)) {
            return;
        }

        setPointerPosition(event);
        pointer.active = true;

        if (!pointer.down) {
            pointer.holdUntil = performance.now() + 720;
            stateLabel.textContent = "FIELD FOLLOWING";
            prompt.textContent = "继续移动，把相邻轮廓拉到一起";
        }
    }

    function endPull(event) {
        if (!pointer.down) {
            return;
        }

        setPointerPosition(event);
        pointer.down = false;
        pointer.active = false;
        pointer.holdUntil = 0;
        pointerOrbit.classList.remove("is-pulling");
        separateFrom(pointer.x, pointer.y);
        stateLabel.textContent = "FIELD RELEASED";
        prompt.textContent = "已释放：融球正在重新分离";

        if (stage.hasPointerCapture(event.pointerId)) {
            stage.releasePointerCapture(event.pointerId);
        }
    }

    function scatter() {
        if (reducedMotion) {
            return;
        }

        const originX = pointerOrbit.classList.contains("is-visible") ? pointer.x : width * 0.67;
        const originY = pointerOrbit.classList.contains("is-visible") ? pointer.y : height * 0.5;
        pointer.active = false;
        pointer.down = false;
        separateFrom(originX, originY, 5.6);
        stateLabel.textContent = "FIELD SCATTERED";
        prompt.textContent = "场域已打散，移动指针再次聚合";
    }

    function startAnimation() {
        cancelAnimationFrame(animationFrame);
        lastTime = 0;

        if (reducedMotion || document.hidden) {
            draw();
            return;
        }

        animationFrame = requestAnimationFrame(update);
    }

    function applyMotionPreference() {
        reducedMotion = motionQuery.matches;
        stage.classList.toggle("reduced-motion", reducedMotion);
        stage.classList.toggle("is-live", !reducedMotion);
        scatterButton.disabled = reducedMotion;
        stateLabel.textContent = reducedMotion ? "STATIC FIELD" : "FIELD DRIFTING";
        prompt.textContent = reducedMotion
            ? "已按系统偏好显示静态融球"
            : "移动鼠标；触屏请按住拖动";
        startAnimation();
    }

    stage.addEventListener("pointerdown", beginPull);
    stage.addEventListener("pointermove", movePointer);
    stage.addEventListener("pointerup", endPull);
    stage.addEventListener("pointercancel", endPull);
    stage.addEventListener("pointerleave", () => {
        if (!pointer.down) {
            pointer.active = false;
            pointerOrbit.classList.remove("is-visible", "is-pulling");
        }
    });
    scatterButton.addEventListener("pointerdown", (event) => event.stopPropagation());
    scatterButton.addEventListener("click", scatter);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", startAnimation);
    motionQuery.addEventListener("change", applyMotionPreference);

    resize();
    applyMotionPreference();
})();
