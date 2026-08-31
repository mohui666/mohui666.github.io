(() => {
    const stage = document.querySelector("[data-trail-stage]");
    const field = document.querySelector("[data-trail-field]");
    const cards = Array.from(document.querySelectorAll("[data-trail-card]"));
    const pointerOrbit = document.querySelector("[data-pointer-orbit]");
    const prompt = document.querySelector("[data-trail-prompt]");
    const liveState = document.querySelector("[data-live-state]");
    const coordinateX = document.querySelector("[data-coordinate-x]");
    const coordinateY = document.querySelector("[data-coordinate-y]");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!stage || !field || cards.length === 0) {
        return;
    }

    if (reduceMotion) {
        prompt.textContent = "已按系统偏好显示静态图像序列";
        liveState.textContent = "STATIC SEQUENCE";
        return;
    }

    let cardIndex = 0;
    let layerIndex = 10;
    let lastPoint = null;
    let pointerDown = false;
    let hasUserInput = false;

    const threshold = () => Math.max(28, Math.min(48, window.innerWidth * 0.035));

    const setPointerPosition = (x, y) => {
        pointerOrbit.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
        stage.style.setProperty("--pointer-x", `${x}px`);
        stage.style.setProperty("--pointer-y", `${y}px`);
        coordinateX.textContent = String(Math.round(x)).padStart(3, "0");
        coordinateY.textContent = String(Math.round(y)).padStart(3, "0");
    };

    const emitCard = (x, y, angle, speed) => {
        const card = cards[cardIndex];
        const spread = Math.min(24, speed * 0.09);
        const perpendicular = cardIndex % 2 === 0 ? -spread : spread;
        const radians = (angle * Math.PI) / 180;
        const offsetX = -Math.sin(radians) * perpendicular;
        const offsetY = Math.cos(radians) * perpendicular;
        const rotation = Math.max(-16, Math.min(16, angle * 0.075)) + (cardIndex % 3 - 1) * 3;

        card.getAnimations().forEach((animation) => animation.cancel());
        card.style.left = `${x + offsetX}px`;
        card.style.top = `${y + offsetY}px`;
        card.style.zIndex = String(layerIndex);
        card.style.setProperty("--card-rotate", `${rotation}deg`);

        card.animate(
            [
                {
                    opacity: 0,
                    transform: `translate(-50%, -50%) translate3d(${-Math.cos(radians) * 26}px, ${-Math.sin(radians) * 26}px, 0) scale(0.68) rotate(${rotation - 5}deg)`
                },
                {
                    opacity: 1,
                    transform: `translate(-50%, -50%) translate3d(0, 0, 0) scale(1) rotate(${rotation}deg)`,
                    offset: 0.18
                },
                {
                    opacity: 0.94,
                    transform: `translate(-50%, -50%) translate3d(${Math.cos(radians) * 8}px, ${Math.sin(radians) * 8}px, 0) scale(1.01) rotate(${rotation + 1}deg)`,
                    offset: 0.74
                },
                {
                    opacity: 0,
                    transform: `translate(-50%, -50%) translate3d(${Math.cos(radians) * 18}px, ${Math.sin(radians) * 18}px, 0) scale(1.04) rotate(${rotation + 2}deg)`
                }
            ],
            {
                duration: 1180,
                easing: "cubic-bezier(0.22, 0.9, 0.3, 1)",
                fill: "both"
            }
        );

        cardIndex = (cardIndex + 1) % cards.length;
        layerIndex += 1;
        if (layerIndex > 1000) {
            layerIndex = 10;
        }
    };

    const tracePath = (point) => {
        if (!lastPoint) {
            lastPoint = point;
            emitCard(point.x, point.y, 0, threshold());
            return;
        }

        const deltaX = point.x - lastPoint.x;
        const deltaY = point.y - lastPoint.y;
        const distance = Math.hypot(deltaX, deltaY);
        const spacing = threshold();

        if (distance < spacing) {
            return;
        }

        const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
        const steps = Math.floor(distance / spacing);

        for (let step = 1; step <= steps; step += 1) {
            const progress = (spacing * step) / distance;
            emitCard(
                lastPoint.x + deltaX * progress,
                lastPoint.y + deltaY * progress,
                angle,
                distance
            );
        }

        lastPoint = {
            x: lastPoint.x + deltaX * ((spacing * steps) / distance),
            y: lastPoint.y + deltaY * ((spacing * steps) / distance)
        };
    };

    const activate = () => {
        if (hasUserInput) {
            return;
        }

        hasUserInput = true;
        stage.classList.add("has-input");
        prompt.textContent = "继续移动，让画面沿路径叠放";
        liveState.textContent = "SAMPLING PATH";
    };

    field.addEventListener("pointerenter", (event) => {
        if (event.pointerType === "mouse") {
            stage.classList.add("is-tracking");
            setPointerPosition(event.clientX, event.clientY);
        }
    });

    field.addEventListener("pointerleave", () => {
        if (!pointerDown) {
            stage.classList.remove("is-tracking");
            lastPoint = null;
        }
    });

    field.addEventListener("pointerdown", (event) => {
        pointerDown = true;
        field.setPointerCapture(event.pointerId);
        stage.classList.add("is-tracking");
        setPointerPosition(event.clientX, event.clientY);
        tracePath({ x: event.clientX, y: event.clientY });
        activate();
    });

    field.addEventListener("pointermove", (event) => {
        const isMouse = event.pointerType === "mouse";
        if (!isMouse && !pointerDown) {
            return;
        }

        setPointerPosition(event.clientX, event.clientY);
        tracePath({ x: event.clientX, y: event.clientY });
        activate();
    });

    const releasePointer = (event) => {
        pointerDown = false;
        lastPoint = null;
        if (event.pointerType !== "mouse") {
            stage.classList.remove("is-tracking");
        }
    };

    field.addEventListener("pointerup", releasePointer);
    field.addEventListener("pointercancel", releasePointer);

    const introPoints = [
        { x: 0.61, y: 0.32 },
        { x: 0.69, y: 0.41 },
        { x: 0.76, y: 0.52 },
        { x: 0.68, y: 0.64 }
    ];

    window.addEventListener("load", () => {
        introPoints.forEach((point, index) => {
            window.setTimeout(() => {
                if (!hasUserInput) {
                    emitCard(window.innerWidth * point.x, window.innerHeight * point.y, 28 + index * 13, 70);
                }
            }, 160 + index * 110);
        });
    });
})();
