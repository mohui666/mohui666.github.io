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

class FakeImage {
    constructor() {
        this.onload = null;
        this.naturalWidth = 1280;
        this.naturalHeight = 720;
        this.complete = true;
        this._src = "";
    }
    set src(value) {
        this._src = value;
        if (this.onload) this.onload();
    }
    get src() { return this._src; }
}

class FakeAudioContext {
    constructor() {
        this.sampleRate = 8000;
        this.currentTime = 0;
        this.state = "running";
        this.destination = {};
    }
    resume() { this.state = "running"; return Promise.resolve(); }
    createBuffer(channels, length) {
        const data = Array.from({ length: channels }, () => new Float32Array(length));
        return { getChannelData(channel) { return data[channel]; } };
    }
    createBufferSource() {
        return {
            buffer: null,
            onended: null,
            connect(node) { return node; },
            start() {},
            stop() { if (this.onended) this.onended(); }
        };
    }
    createGain() {
        const gain = {
            value: 1,
            cancelScheduledValues() {},
            setValueAtTime(value) { this.value = value; },
            linearRampToValueAtTime(value) { this.value = value; }
        };
        return { gain, connect(node) { return node; } };
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
    Image: FakeImage,
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
load("flagship-ui.js");
load("flagship-simulations.js");
load("flagship-interactions-02.js");
load("flagship-labs-02.js");

const audioActions = new Set(["granular-synthesis", "karplus-strong", "hrtf-spatialization", "shepard-risset-glissando"]);
const flagshipSlugs = new Set([
    "predictive-back", "semantic-zoom", "marking-menu", "voronoi-tessellation", "svg-lighting-filter",
    "recursive-portal-rendering", "stable-fluids", "xpbd-cloth", "wave-function-collapse", "stft-spectrogram",
    "explode-transition", "bubble-cursor", "edge-scrolling", "marching-squares", "seam-carving",
    "arcball-manipulation", "fabrik-inverse-kinematics", "interactive-evolution", "brushing-and-linking", "karplus-strong"
]);
const secondBatchSlugs = new Set([
    "explode-transition", "bubble-cursor", "edge-scrolling", "marching-squares", "seam-carving",
    "arcball-manipulation", "fabrik-inverse-kinematics", "interactive-evolution", "brushing-and-linking", "karplus-strong"
]);

function keyEvent(key) {
    return {
        key,
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }
    };
}

for (const mobile of [false, true]) for (const study of studies) for (const preview of secondBatchSlugs.has(study.slug) ? [true, false] : [true]) {
    const canvas = fakeCanvas();
    const fakeAudio = !preview && study.slug === "karplus-strong" ? new FakeAudioContext() : null;
    const env = {
        API: windowObject.MotionStudy,
        study,
        canvas,
        dom: fakeNode(),
        pointer: { x: 0.6, y: 0.5, px: 0.59, py: 0.49, vx: 0.1, vy: 0.1, down: false, inside: true, pressure: 0.5, type: "mouse" },
        preview,
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
        audio() {
            if (fakeAudio) return fakeAudio;
            throw new Error(`unexpected audio during handler smoke: ${study.slug}`);
        }
    };
    const factory = windowObject.MotionStudy.registry[study.slug];
    const effect = factory(env);
    if (effect.resize) effect.resize(env.width, env.height, env.dpr);
    if (preview && effect.demo) effect.demo(1.25, 1.25);
    if (effect.pointerDown) { env.pointer.down = true; effect.pointerDown(env.pointer, null); }
    env.pointer.x = 0.72; env.pointer.y = 0.63; env.pointer.vx = 1.2; env.pointer.vy = 0.45;
    if (effect.pointerMove) effect.pointerMove(env.pointer, null);
    if (effect.pointerUp) { env.pointer.down = false; effect.pointerUp(env.pointer, null); }
    if (effect.pointerCancel) {
        env.pointer.down = true;
        if (effect.pointerDown) effect.pointerDown(env.pointer, null);
        env.pointer.x = 0.68; env.pointer.y = 0.58;
        if (effect.pointerMove) effect.pointerMove(env.pointer, null);
        env.pointer.down = false;
        effect.pointerCancel(env.pointer, null);
    }
    if (effect.wheel) effect.wheel(12, 72, null);
    if (effect.keyDown) {
        effect.keyDown(keyEvent("ArrowRight"));
        if (flagshipSlugs.has(study.slug)) {
            effect.keyDown(keyEvent(" "));
            effect.keyDown(keyEvent("Enter"));
            effect.keyDown(keyEvent("Escape"));
        }
    }
    if (effect.action && !audioActions.has(study.slug)) effect.action();
    if (study.slug === "marching-squares") {
        const touch = (pointerId) => ({ pointerId, pointerType: "touch", pressure: 0.5 });
        for (const pointerId of [11, 12, 13]) effect.pointerDown(env.pointer, touch(pointerId));
        effect.pointerUp(env.pointer, touch(12));
        effect.pointerMove(env.pointer, touch(11));
        effect.pointerCancel(env.pointer, touch(11));
        effect.pointerCancel(env.pointer, touch(13));
    }
    for (let frame = 0; frame < 4; frame += 1) {
        env.time += env.dt;
        if (effect.update) effect.update(env.dt, env.time);
        if (effect.draw) effect.draw(env.time, env.dt);
    }
    if (effect.destroy) effect.destroy();
}

console.log(`Exercised desktop/mobile preview paths for all ${studies.length} handlers plus live paths for 10 flagship studies without a runtime exception.`);
