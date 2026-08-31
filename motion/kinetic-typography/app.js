(() => {
    "use strict";

    const chapters = Array.from(document.querySelectorAll("[data-chapter]"));
    const progressFill = document.querySelector("[data-progress-fill]");
    const progressNumber = document.querySelector("[data-progress-number]");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
    const ease = (value) => value * value * (3 - 2 * value);
    let frameRequested = false;

    document.documentElement.classList.add("js");

    function chapterProgress(chapter) {
        const rect = chapter.getBoundingClientRect();
        const stage = chapter.querySelector(".stage");
        const stickyHeight = stage ? stage.getBoundingClientRect().height : window.innerHeight;
        const distance = Math.max(1, chapter.offsetHeight - stickyHeight);
        return clamp(-rect.top / distance);
    }

    function applyVelocity(chapter, progress) {
        const lines = chapter.querySelectorAll("[data-motion-line]");
        const eased = ease(progress);
        const directions = [-1, 1, -1];
        const distances = [82, 56, 72];

        lines.forEach((line, index) => {
            const shift = (0.5 - eased) * distances[index] * directions[index];
            const turn = (eased - 0.5) * (index === 1 ? -5 : 3.5);
            line.style.transform = `translate3d(${shift}vw, 0, 0) rotate(${turn}deg)`;
            line.style.opacity = String(0.48 + Math.sin(progress * Math.PI) * 0.52);
        });
    }

    function applyTension(chapter, progress) {
        const lines = chapter.querySelectorAll("[data-motion-line]");
        const meter = chapter.querySelector("[data-axis-meter]");
        const value = chapter.querySelector("[data-axis-value]");
        const wave = Math.sin(progress * Math.PI);
        const widths = [0.52 + wave * 0.82, 1.38 - wave * 0.56, 0.64 + wave * 0.66];
        const vertical = [1.18 - wave * 0.18, 0.82 + wave * 0.24, 1.12 - wave * 0.12];

        lines.forEach((line, index) => {
            const drift = (progress - 0.5) * (index === 1 ? -18 : 12);
            line.style.transform = `translate3d(${drift}vw, 0, 0) scale(${widths[index]}, ${vertical[index]})`;
            line.style.letterSpacing = `${-0.075 + wave * (index === 1 ? 0.09 : 0.045)}em`;
        });

        if (meter) meter.style.transform = `scaleX(${0.24 + wave * 0.76})`;
        if (value) value.textContent = String(Math.round(52 + wave * 86)).padStart(3, "0");
    }

    function applyScatter(chapter, progress) {
        const words = chapter.querySelectorAll("[data-scatter-word]");
        const orbit = chapter.querySelector(".orbit-mark");
        const eased = ease(progress);
        const disperse = Math.sin(progress * Math.PI);
        const settle = clamp((progress - 0.63) / 0.37);
        const finalX = [-31, 1, 31];

        words.forEach((word, index) => {
            const x = Number(word.dataset.x) * disperse * (1 - settle) + finalX[index] * settle;
            const y = Number(word.dataset.y) * disperse * (1 - settle);
            const rotation = Number(word.dataset.r) * disperse + (index - 1) * 2 * settle;
            const scale = 0.7 + disperse * 0.42 + settle * 0.18;
            word.style.transform = `translate(-50%, -50%) translate3d(${x}vw, ${y}vh, 0) rotate(${rotation}deg) scale(${scale})`;
            word.style.opacity = String(0.5 + Math.min(1, eased * 2) * 0.5);
        });

        if (orbit) orbit.style.transform = `translate(-50%, -50%) rotate(${progress * 115}deg) scale(${0.76 + disperse * 0.3})`;
    }

    function applyRhythm(chapter, progress) {
        const words = chapter.querySelectorAll("[data-rhythm-word]");
        const eased = ease(progress);
        const arc = Math.sin(progress * Math.PI);
        const targetX = [-31, -13, 13, 35];
        const targetY = [-18, 17, -9, 19];

        words.forEach((word, index) => {
            const angle = index * (Math.PI * 2 / words.length) - Math.PI / 2 + progress * Math.PI;
            const orbitX = Math.cos(angle) * (25 + index * 2) * (1 - eased);
            const orbitY = Math.sin(angle) * 23 * (1 - eased);
            const x = orbitX + targetX[index] * eased;
            const y = orbitY + targetY[index] * eased;
            const rotation = (index % 2 ? 1 : -1) * (1 - eased) * 38 + (index - 1.5) * eased * 2.5;
            const scale = 0.62 + arc * 0.25 + eased * 0.28;
            word.style.transform = `translate(-50%, -50%) translate3d(${x}vw, ${y}vh, 0) rotate(${rotation}deg) scale(${scale})`;
            word.style.opacity = String(0.42 + Math.min(1, progress * 2 + index * 0.08) * 0.58);
        });
    }

    function updateProgress() {
        const scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const pageProgress = clamp(window.scrollY / scrollRange);
        const percentage = Math.round(pageProgress * 100);

        if (progressFill) progressFill.style.transform = `scaleY(${pageProgress})`;
        if (progressNumber) progressNumber.textContent = String(percentage).padStart(3, "0");
    }

    function update() {
        updateProgress();

        if (!reducedMotion) {
            chapters.forEach((chapter) => {
                const progress = chapterProgress(chapter);
                const variant = chapter.dataset.variant;

                if (variant === "velocity") applyVelocity(chapter, progress);
                if (variant === "tension") applyTension(chapter, progress);
                if (variant === "scatter") applyScatter(chapter, progress);
                if (variant === "rhythm") applyRhythm(chapter, progress);
            });
        }

        frameRequested = false;
    }

    function requestUpdate() {
        if (frameRequested) return;
        frameRequested = true;
        window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    update();
})();
