"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const studies = require("../motion/study-manifest.js");

class FakeImageData {
    constructor(dataOrWidth, widthOrHeight, maybeHeight) {
        if (typeof dataOrWidth === "number") {
            this.width = dataOrWidth;
            this.height = widthOrHeight;
            this.data = new Uint8ClampedArray(this.width * this.height * 4);
        } else {
            this.data = dataOrWidth;
            this.width = widthOrHeight;
            this.height = maybeHeight;
        }
    }
}

function fakeNode() {
    return {
        style: {}, className: "", textContent: "", innerHTML: "",
        setAttribute() {}, remove() {}, appendChild() {}, replaceWith() {},
        querySelector() { return fakeNode(); },
        querySelectorAll() { return [fakeNode(), fakeNode(), fakeNode()]; }
    };
}

function fakeContext(canvas) {
    const gradient = { addColorStop() {} };
    const methods = new Set([
        "setTransform", "clearRect", "fillRect", "strokeRect", "beginPath", "closePath", "moveTo", "lineTo", "arc", "arcTo",
        "bezierCurveTo", "quadraticCurveTo", "fill", "stroke", "save", "restore", "translate", "scale", "rotate", "clip",
        "fillText", "strokeText", "drawImage", "putImageData", "setLineDash"
    ]);
    const target = {
        canvas,
        createLinearGradient() { return gradient; },
        createRadialGradient() { return gradient; },
        createImageData(width, height) { return new FakeImageData(width, height); },
        getImageData(x, y, width, height) { return new FakeImageData(width, height); },
        measureText(text) { return { width: String(text).length * 8 }; }
    };
    return new Proxy(target, {
        get(object, key) {
            if (key in object) return object[key];
            if (methods.has(key)) return (...args) => {
                if (args.some((value) => typeof value === "number" && !Number.isFinite(value))) {
                    throw new Error(`non-finite canvas argument in ${String(key)}`);
                }
            };
            return typeof key === "string" ? () => {} : object[key];
        },
        set(object, key, value) {
            if (typeof value === "number" && !Number.isFinite(value)) throw new Error(`non-finite canvas property ${String(key)}`);
            object[key] = value;
            return true;
        }
    });
}

function fakeCanvas() {
    const canvas = { width: 1, height: 1, style: {} };
    const context = fakeContext(canvas);
    canvas.getContext = () => context;
    return canvas;
}

const windowObject = {};
const context = vm.createContext({
    window: windowObject,
    document: {
        createElement(tag) { return tag === "canvas" ? fakeCanvas() : fakeNode(); },
        createElementNS() { return fakeNode(); }
    },
    ImageData: FakeImageData,
    console,
    Math,
    performance: { now: () => 0 },
    setTimeout,
    clearTimeout
});
context.globalThis = context;

const motionRoot = path.resolve(__dirname, "..", "motion");
function load(filename) {
    vm.runInContext(fs.readFileSync(path.join(motionRoot, filename), "utf8"), context, { filename });
}

load("study-core.js");
for (const bundle of ["choreography", "hci", "temporal", "geometry", "image", "spatial", "physics-sim", "generative", "data", "signal"]) {
    load(`study-${bundle}.js`);
}

const audioActions = new Set(["granular-synthesis", "karplus-strong", "hrtf-spatialization", "shepard-risset-glissando"]);

for (const mobile of [false, true]) for (const study of studies) {
    const canvas = fakeCanvas();
    const env = {
        API: windowObject.MotionStudy,
        study,
        canvas,
        dom: fakeNode(),
        pointer: { x: 0.6, y: 0.5, px: 0.59, py: 0.49, vx: 0.1, vy: 0.1, down: false, inside: true, pressure: 0.5, type: "mouse" },
        preview: true,
        mobile,
        reducedMotion: false,
        width: 960,
        height: 640,
        dpr: 1,
        time: 0,
        dt: 1 / 30,
        accent: "#7dd3fc",
        accent2: "#f0abfc",
        setState() {}, setAction() {}, setMeter() {}, requestFrame() {},
        audio() { throw new Error(`audio started during preview smoke: ${study.slug}`); }
    };
    const factory = windowObject.MotionStudy.registry[study.slug];
    const effect = factory(env);
    if (effect.resize) effect.resize(env.width, env.height, env.dpr);
    if (effect.demo) effect.demo(1.25, 1.25);
    if (effect.pointerDown) { env.pointer.down = true; effect.pointerDown(env.pointer, null); }
    env.pointer.x = 0.72; env.pointer.y = 0.63; env.pointer.vx = 1.2; env.pointer.vy = 0.45;
    if (effect.pointerMove) effect.pointerMove(env.pointer, null);
    if (effect.pointerUp) { env.pointer.down = false; effect.pointerUp(env.pointer, null); }
    if (effect.wheel) effect.wheel(12, 72, null);
    if (effect.keyDown) effect.keyDown({ key: "ArrowRight" });
    if (effect.action && !audioActions.has(study.slug)) effect.action();
    for (let frame = 0; frame < 4; frame += 1) {
        env.time += env.dt;
        if (effect.update) effect.update(env.dt, env.time);
        if (effect.draw) effect.draw(env.time, env.dt);
    }
    if (effect.destroy) effect.destroy();
}

console.log(`Exercised desktop and mobile interaction paths for all ${studies.length} exact study handlers without a runtime exception.`);
