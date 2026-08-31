(() => {
    "use strict";

    const stage = document.querySelector(".lab-stage");
    const effect = document.body.dataset.effect;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const liveState = document.querySelector("[data-live-state]");

    const setLiveState = (text) => {
        if (liveState) liveState.textContent = text;
    };

    const magnetic = () => {
        const magnets = [...document.querySelectorAll("[data-magnet]")];
        const cursor = document.querySelector("[data-magnetic-cursor]");

        const reset = () => magnets.forEach((magnet) => {
            magnet.style.setProperty("--tx", "0px");
            magnet.style.setProperty("--ty", "0px");
        });

        if (!reducedMotion) {
            stage.addEventListener("pointermove", (event) => {
                const bounds = stage.getBoundingClientRect();
                const x = event.clientX - bounds.left;
                const y = event.clientY - bounds.top;
                cursor.style.left = `${x}px`;
                cursor.style.top = `${y}px`;
                stage.classList.add("is-active");

                magnets.forEach((magnet) => {
                    const rect = magnet.getBoundingClientRect();
                    const dx = event.clientX - (rect.left + rect.width / 2);
                    const dy = event.clientY - (rect.top + rect.height / 2);
                    const distance = Math.hypot(dx, dy);
                    const pull = Math.max(0, 1 - distance / 280) * 0.34;
                    magnet.style.setProperty("--tx", `${dx * pull}px`);
                    magnet.style.setProperty("--ty", `${dy * pull}px`);
                });
                setLiveState("MAGNETIC FIELD ACTIVE");
            });

            stage.addEventListener("pointerleave", () => {
                stage.classList.remove("is-active");
                reset();
                setLiveState("MOVE TO ATTRACT");
            });
        }

        magnets.forEach((magnet) => magnet.addEventListener("click", () => {
            magnet.classList.remove("is-pulsing");
            void magnet.offsetWidth;
            magnet.classList.add("is-pulsing");
            setLiveState(`${magnet.textContent.trim()} CAPTURED`);
        }));
    };

    const crosshair = () => {
        const xReadout = document.querySelector("[data-cross-x]");
        const yReadout = document.querySelector("[data-cross-y]");
        let x = 72;
        let y = 48;
        let locked = false;

        const render = () => {
            stage.style.setProperty("--x", `${x}%`);
            stage.style.setProperty("--y", `${y}%`);
            xReadout.textContent = String(Math.round(x * 10)).padStart(3, "0");
            yReadout.textContent = String(Math.round(y * 10)).padStart(3, "0");
        };

        stage.addEventListener("pointermove", (event) => {
            if (locked || reducedMotion) return;
            const rect = stage.getBoundingClientRect();
            x = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
            y = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
            render();
            setLiveState("TRACKING COORDINATES");
        });

        const toggleLock = () => {
            locked = !locked;
            stage.classList.toggle("is-locked", locked);
            setLiveState(locked ? "TARGET LOCKED" : "TRACKING COORDINATES");
        };

        stage.addEventListener("pointerdown", (event) => {
            if (event.pointerType !== "mouse") {
                const rect = stage.getBoundingClientRect();
                x = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
                y = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
                render();
                setLiveState("TRACKING COORDINATES");
                return;
            }
            toggleLock();
        });
        stage.addEventListener("keydown", (event) => {
            const step = event.shiftKey ? 5 : 1;
            if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)) event.preventDefault();
            if (event.key === "ArrowLeft") x = clamp(x - step, 0, 100);
            if (event.key === "ArrowRight") x = clamp(x + step, 0, 100);
            if (event.key === "ArrowUp") y = clamp(y - step, 0, 100);
            if (event.key === "ArrowDown") y = clamp(y + step, 0, 100);
            if (event.key === " ") toggleLock();
            render();
        });
        render();
    };

    const directionAwareReveal = () => {
        const tiles = [...document.querySelectorAll("[data-reveal-tile]")];
        const directionFromEvent = (event, tile) => {
            const rect = tile.getBoundingClientRect();
            const x = event.clientX - rect.left - rect.width / 2;
            const y = event.clientY - rect.top - rect.height / 2;
            const angle = Math.atan2(y * rect.width, x * rect.height) * 180 / Math.PI;
            if (angle >= -45 && angle < 45) return "right";
            if (angle >= 45 && angle < 135) return "bottom";
            if (angle >= -135 && angle < -45) return "top";
            return "left";
        };

        tiles.forEach((tile) => {
            tile.addEventListener("pointerenter", (event) => {
                tile.dataset.enter = directionFromEvent(event, tile);
                if (event.pointerType === "mouse") requestAnimationFrame(() => tile.classList.add("is-revealed"));
                setLiveState(`ENTER FROM ${tile.dataset.enter.toUpperCase()}`);
            });
            tile.addEventListener("pointerleave", (event) => {
                if (event.pointerType === "mouse") tile.classList.remove("is-revealed");
            });
            tile.addEventListener("focus", () => {
                tile.dataset.enter = "bottom";
                tile.classList.add("is-revealed");
            });
            tile.addEventListener("blur", () => tile.classList.remove("is-revealed"));
            tile.addEventListener("pointerdown", (event) => {
                if (event.pointerType !== "mouse") tile.classList.toggle("is-revealed");
            });
        });
    };

    const directionAwareMarquee = () => {
        const bands = [...document.querySelectorAll("[data-marquee-band]")];
        const activate = (band, direction) => {
            band.dataset.direction = direction;
            band.classList.add("is-running");
            setLiveState(`MARQUEE RUNNING ${direction.toUpperCase()}`);
        };

        bands.forEach((band) => {
            band.addEventListener("pointerenter", (event) => {
                const rect = band.getBoundingClientRect();
                activate(band, event.clientX < rect.left + rect.width / 2 ? "right" : "left");
            });
            band.addEventListener("pointerleave", () => band.classList.remove("is-running"));
            band.addEventListener("focus", () => activate(band, band.dataset.direction || "left"));
            band.addEventListener("blur", () => band.classList.remove("is-running"));
            band.addEventListener("click", () => {
                const next = band.dataset.direction === "left" ? "right" : "left";
                activate(band, next);
            });
            band.addEventListener("keydown", (event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    event.preventDefault();
                    activate(band, event.key === "ArrowLeft" ? "left" : "right");
                }
            });
        });
    };

    const tiltHover = () => {
        const cards = [...document.querySelectorAll("[data-tilt-card]")];
        const render = (card, x, y) => {
            card.style.setProperty("--rx", `${-(y - 0.5) * 16}deg`);
            card.style.setProperty("--ry", `${(x - 0.5) * 20}deg`);
            card.style.setProperty("--gx", `${x * 100}%`);
            card.style.setProperty("--gy", `${y * 100}%`);
        };
        const reset = (card) => render(card, 0.5, 0.5);

        cards.forEach((card) => {
            if (!reducedMotion) {
                card.addEventListener("pointermove", (event) => {
                    const rect = card.getBoundingClientRect();
                    render(card, clamp((event.clientX - rect.left) / rect.width, 0, 1), clamp((event.clientY - rect.top) / rect.height, 0, 1));
                    setLiveState("PERSPECTIVE MAPPED");
                });
                card.addEventListener("pointerleave", () => reset(card));
            }
            card.addEventListener("keydown", (event) => {
                const values = { ArrowLeft: [0.15, 0.5], ArrowRight: [0.85, 0.5], ArrowUp: [0.5, 0.15], ArrowDown: [0.5, 0.85] };
                if (values[event.key]) {
                    event.preventDefault();
                    render(card, ...values[event.key]);
                }
                if (event.key === "Escape") reset(card);
            });
            card.addEventListener("blur", () => reset(card));
        });
    };

    const pathMorphing = () => {
        const shape = document.querySelector("[data-morph-shape]");
        const label = document.querySelector("[data-morph-label]");
        const buttons = [...document.querySelectorAll("[data-morph-mode]")];
        const shapes = {
            orbit: "M 180 40 C 257 40 320 103 320 180 C 320 257 257 320 180 320 C 103 320 40 257 40 180 C 40 103 103 40 180 40 Z",
            tide: "M 180 48 C 286 12 348 126 308 210 C 264 304 160 352 66 298 C -12 252 34 138 88 92 C 124 62 146 68 180 48 Z",
            pulse: "M 180 24 C 205 112 313 74 334 180 C 248 198 286 314 180 336 C 155 250 47 286 26 180 C 112 155 74 47 180 24 Z",
            prism: "M 180 28 C 236 90 276 126 332 180 C 270 238 234 278 180 332 C 122 274 86 236 28 180 C 88 126 128 84 180 28 Z"
        };
        const template = shapes.orbit;
        const numbers = (path) => path.match(/-?\d*\.?\d+/g).map(Number);
        let current = numbers(template);
        let activeIndex = 0;
        let animationFrame = 0;

        const format = (values) => {
            let index = 0;
            return template.replace(/-?\d*\.?\d+/g, () => values[index++].toFixed(2));
        };

        const morphTo = (name) => {
            cancelAnimationFrame(animationFrame);
            const from = [...current];
            const target = numbers(shapes[name]);
            const duration = reducedMotion ? 1 : 720;
            const started = performance.now();
            label.textContent = name;
            buttons.forEach((button, index) => {
                const selected = button.dataset.morphMode === name;
                button.setAttribute("aria-pressed", String(selected));
                if (selected) activeIndex = index;
            });

            const tick = (now) => {
                const linear = clamp((now - started) / duration, 0, 1);
                const eased = 1 - Math.pow(1 - linear, 3);
                current = from.map((value, index) => value + (target[index] - value) * eased);
                shape.setAttribute("d", format(current));
                if (linear < 1) animationFrame = requestAnimationFrame(tick);
            };
            animationFrame = requestAnimationFrame(tick);
            setLiveState(`${name.toUpperCase()} GEOMETRY`);
        };

        buttons.forEach((button) => button.addEventListener("click", () => morphTo(button.dataset.morphMode)));
        stage.addEventListener("keydown", (event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            activeIndex = (activeIndex + (event.key === "ArrowRight" ? 1 : buttons.length - 1)) % buttons.length;
            morphTo(buttons[activeIndex].dataset.morphMode);
        });
    };

    const strokeDrawing = () => {
        const paths = [...document.querySelectorAll("[data-draw-path]")];
        const slider = document.querySelector("[data-stroke-slider]");
        const percent = document.querySelector("[data-stroke-percent]");
        const playButton = document.querySelector("[data-stroke-play]");
        let playing = false;
        let frame = 0;
        let started = 0;

        paths.forEach((path) => {
            const length = path.getTotalLength();
            path.dataset.length = length;
            path.style.strokeDasharray = length;
        });

        const draw = (value) => {
            const progress = Number(value) / 100;
            paths.forEach((path, index) => {
                const staggered = clamp(progress * 1.24 - index * 0.08, 0, 1);
                path.style.strokeDashoffset = Number(path.dataset.length) * (1 - staggered);
            });
            slider.value = value;
            percent.textContent = `${Math.round(value)}%`;
            setLiveState(value >= 100 ? "DRAWING COMPLETE" : "STROKE IN PROGRESS");
        };

        const stop = () => {
            playing = false;
            cancelAnimationFrame(frame);
            playButton.textContent = "PLAY";
            playButton.setAttribute("aria-pressed", "false");
        };

        const tick = (now) => {
            if (!started) started = now - Number(slider.value) * 24;
            const value = clamp((now - started) / 24, 0, 100);
            draw(value);
            if (value < 100 && playing) frame = requestAnimationFrame(tick);
            else stop();
        };

        const play = () => {
            if (playing) return stop();
            if (reducedMotion) {
                draw(100);
                stop();
                return;
            }
            if (Number(slider.value) >= 100) draw(0);
            playing = true;
            started = 0;
            playButton.textContent = "PAUSE";
            playButton.setAttribute("aria-pressed", "true");
            frame = requestAnimationFrame(tick);
        };

        slider.addEventListener("input", () => {
            stop();
            draw(Number(slider.value));
        });
        playButton.addEventListener("click", play);
        stage.addEventListener("keydown", (event) => {
            if (event.key === " ") {
                event.preventDefault();
                play();
            }
        });
        draw(reducedMotion ? 100 : 0);
        if (!reducedMotion) play();
    };

    const maskReveal = () => {
        const frame = document.querySelector("[data-mask-frame]");
        const circle = document.querySelector("[data-mask-circle]");
        const ring = document.querySelector("[data-mask-ring]");
        const readout = document.querySelector("[data-mask-readout]");
        let x = 62;
        let y = 48;
        let radius = reducedMotion ? 310 : 150;

        const render = () => {
            circle.setAttribute("cx", x * 10);
            circle.setAttribute("cy", y * 7);
            circle.setAttribute("r", radius);
            ring.style.left = `${x}%`;
            ring.style.top = `${y}%`;
            ring.style.width = `${radius * 2 / 10}%`;
            ring.style.height = `${radius * 2 / 7}%`;
            readout.textContent = `X ${Math.round(x * 10)} · Y ${Math.round(y * 7)} · R ${Math.round(radius)}`;
        };

        frame.addEventListener("pointermove", (event) => {
            if (reducedMotion) return;
            const rect = frame.getBoundingClientRect();
            x = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
            y = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
            render();
            setLiveState("MASK FOLLOWS POINTER");
        });
        frame.addEventListener("pointerdown", () => {
            radius = radius < 230 ? 310 : 150;
            render();
            setLiveState(radius > 230 ? "APERTURE EXPANDED" : "APERTURE FOCUSED");
        });
        stage.addEventListener("keydown", (event) => {
            const step = event.shiftKey ? 5 : 2;
            if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-"].includes(event.key)) event.preventDefault();
            if (event.key === "ArrowLeft") x = clamp(x - step, 0, 100);
            if (event.key === "ArrowRight") x = clamp(x + step, 0, 100);
            if (event.key === "ArrowUp") y = clamp(y - step, 0, 100);
            if (event.key === "ArrowDown") y = clamp(y + step, 0, 100);
            if (event.key === "+" || event.key === "=") radius = clamp(radius + 15, 70, 360);
            if (event.key === "-") radius = clamp(radius - 15, 70, 360);
            render();
        });
        render();
    };

    const motionPath = () => {
        const map = document.querySelector("[data-orbit-map]");
        const slider = document.querySelector("[data-speed-slider]");
        const toggle = document.querySelector("[data-path-toggle]");
        let paused = reducedMotion;

        const render = () => {
            const duration = 14 - Number(slider.value);
            map.style.setProperty("--duration", `${duration}s`);
            map.classList.toggle("is-paused", paused);
            toggle.textContent = paused ? "PLAY" : "PAUSE";
            toggle.setAttribute("aria-pressed", String(paused));
            setLiveState(paused ? "ROUTE PAUSED" : `VELOCITY ${slider.value} / 10`);
        };

        const togglePlayback = () => {
            paused = !paused;
            render();
        };
        slider.addEventListener("input", render);
        toggle.addEventListener("click", togglePlayback);
        stage.addEventListener("keydown", (event) => {
            if (event.key === " ") {
                event.preventDefault();
                togglePlayback();
            }
        });
        render();
    };

    const splitText = () => {
        const display = document.querySelector("[data-split-text]");
        const modeButtons = [...document.querySelectorAll("[data-split-mode]")];
        const replayButton = document.querySelector("[data-split-replay]");
        const phraseButton = document.querySelector("[data-split-phrase]");
        const phrases = ["BREAK THE SILENCE", "TYPE MAKES TIME", "WORDS FIND MOTION"];
        let phraseIndex = 0;
        let mode = "word";

        const unitsFor = (text) => {
            if (mode === "char") return [...text].map((value) => ({ value, space: value === " " }));
            if (mode === "line") {
                const words = text.split(" ");
                const midpoint = Math.ceil(words.length / 2);
                return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")].filter(Boolean).map((value) => ({ value, space: false, line: true }));
            }
            return text.split(" ").flatMap((value, index, values) => [{ value, space: false }, ...(index < values.length - 1 ? [{ value: " ", space: true }] : [])]);
        };

        const replay = () => {
            const text = phrases[phraseIndex];
            display.textContent = "";
            display.setAttribute("aria-label", text);
            unitsFor(text).forEach((unit, index) => {
                if (unit.space) {
                    const space = document.createElement("span");
                    space.className = "split-space";
                    space.setAttribute("aria-hidden", "true");
                    display.append(space);
                    return;
                }
                const mask = document.createElement("span");
                const inner = document.createElement("span");
                mask.className = "split-unit";
                if (unit.line) mask.style.display = "block";
                mask.setAttribute("aria-hidden", "true");
                inner.textContent = unit.value;
                mask.append(inner);
                display.append(mask);
                inner.animate([
                    { transform: "translateY(115%) rotate(3deg)", opacity: 0 },
                    { transform: "translateY(0) rotate(0)", opacity: 1 }
                ], { duration: reducedMotion ? 1 : 760, delay: reducedMotion ? 0 : index * (mode === "char" ? 32 : 105), easing: "cubic-bezier(.22,.9,.3,1)", fill: "both" });
            });
            setLiveState(`${mode.toUpperCase()} REVEAL PLAYING`);
        };

        const selectMode = (nextMode) => {
            mode = nextMode;
            modeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.splitMode === mode)));
            replay();
        };

        modeButtons.forEach((button) => button.addEventListener("click", () => selectMode(button.dataset.splitMode)));
        replayButton.addEventListener("click", replay);
        phraseButton.addEventListener("click", () => {
            phraseIndex = (phraseIndex + 1) % phrases.length;
            replay();
        });
        stage.addEventListener("keydown", (event) => {
            if (event.key === " ") {
                event.preventDefault();
                replay();
            }
            if (["1", "2", "3"].includes(event.key)) selectMode(["char", "word", "line"][Number(event.key) - 1]);
        });
        replay();
    };

    const flipLayout = () => {
        const grid = document.querySelector("[data-flip-grid]");
        const cards = [...document.querySelectorAll("[data-flip-card]")];
        const layoutButtons = [...document.querySelectorAll("[data-flip-layout]")];
        const shuffleButton = document.querySelector("[data-flip-shuffle]");

        const runFlip = (mutate) => {
            const first = new Map(cards.map((card) => [card, card.getBoundingClientRect()]));
            mutate();
            cards.forEach((card) => {
                const before = first.get(card);
                const after = card.getBoundingClientRect();
                const dx = before.left - after.left;
                const dy = before.top - after.top;
                const sx = before.width / after.width;
                const sy = before.height / after.height;
                card.animate([
                    { transformOrigin: "top left", transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
                    { transformOrigin: "top left", transform: "none" }
                ], { duration: reducedMotion ? 1 : 680, easing: "cubic-bezier(.22,.9,.3,1)" });
            });
            setLiveState("FLIP GEOMETRY UPDATED");
        };

        layoutButtons.forEach((button) => button.addEventListener("click", () => runFlip(() => {
            grid.dataset.layout = button.dataset.flipLayout;
            cards.forEach((card) => card.classList.remove("is-featured"));
            layoutButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
        })));

        shuffleButton.addEventListener("click", () => runFlip(() => {
            const shuffled = [...cards].sort(() => Math.random() - 0.5);
            shuffled.forEach((card) => grid.append(card));
        }));

        cards.forEach((card) => card.addEventListener("click", () => runFlip(() => {
            const wasFeatured = card.classList.contains("is-featured");
            cards.forEach((item) => item.classList.remove("is-featured"));
            if (!wasFeatured && grid.dataset.layout !== "list") card.classList.add("is-featured");
        })));
    };

    const sharedElement = () => {
        const cards = [...document.querySelectorAll("[data-shared-card]")];
        const dialog = document.querySelector("[data-shared-dialog]");
        const detailImage = dialog.querySelector("[data-detail-image]");
        const detailTitle = dialog.querySelector("[data-detail-title]");
        const detailIndex = dialog.querySelector("[data-detail-index]");
        const closeButton = dialog.querySelector("[data-dialog-close]");
        let activeCard = null;

        const animateClone = (from, to, source, done) => {
            if (reducedMotion) {
                done();
                return;
            }
            const clone = document.createElement("img");
            clone.className = "shared-clone";
            clone.src = source;
            Object.assign(clone.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
            document.body.append(clone);
            const animation = clone.animate([
                { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, borderRadius: "18px" },
                { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`, borderRadius: "0px" }
            ], { duration: 720, easing: "cubic-bezier(.22,.9,.3,1)", fill: "forwards" });
            animation.addEventListener("finish", () => {
                clone.remove();
                done();
            }, { once: true });
        };

        const open = (card) => {
            activeCard = card;
            const sourceImage = card.querySelector("img");
            detailImage.src = sourceImage.src;
            detailImage.alt = sourceImage.alt;
            detailTitle.textContent = card.dataset.title;
            detailIndex.textContent = card.dataset.index;
            dialog.hidden = false;
            detailImage.style.opacity = "0";
            const from = sourceImage.getBoundingClientRect();
            const to = detailImage.getBoundingClientRect();
            animateClone(from, to, sourceImage.src, () => {
                detailImage.style.opacity = "1";
                closeButton.focus();
            });
            setLiveState("SHARED ELEMENT EXPANDED");
        };

        const close = () => {
            if (!activeCard) return;
            const targetImage = activeCard.querySelector("img");
            const from = detailImage.getBoundingClientRect();
            const to = targetImage.getBoundingClientRect();
            detailImage.style.opacity = "0";
            animateClone(from, to, detailImage.src, () => {
                dialog.hidden = true;
                activeCard.focus();
                activeCard = null;
            });
            setLiveState("SHARED ELEMENT RETURNED");
        };

        cards.forEach((card) => card.addEventListener("click", () => open(card)));
        closeButton.addEventListener("click", close);
        dialog.addEventListener("pointerdown", (event) => {
            if (event.target === dialog) close();
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !dialog.hidden) close();
        });
    };

    const effects = {
        magnetic,
        crosshair,
        reveal: directionAwareReveal,
        marquee: directionAwareMarquee,
        tilt: tiltHover,
        morph: pathMorphing,
        stroke: strokeDrawing,
        mask: maskReveal,
        "motion-path": motionPath,
        split: splitText,
        flip: flipLayout,
        shared: sharedElement
    };

    if (stage && effects[effect]) effects[effect]();
})();
