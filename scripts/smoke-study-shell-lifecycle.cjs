"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class EventHub {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(listener);
    }
    dispatch(type, event = {}) {
        event.type = type;
        event.target ||= this;
        for (const listener of this.listeners.get(type) || []) listener(event);
    }
}

function makeNode() {
    const node = new EventHub();
    node.style = { setProperty() {} };
    node.classList = { add() {}, remove() {} };
    node.textContent = "";
    node.innerHTML = "";
    return node;
}

const stage = makeNode();
stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 500 });
stage.focus = () => {};
stage.setPointerCapture = () => {};
const canvas = makeNode();
const dom = makeNode();
const state = makeNode();
const prompt = makeNode();
const action = makeNode();
const meter = makeNode();
action.click = () => action.dispatch("click", { target: action });

const nodes = new Map([
    ["[data-study-stage]", stage],
    ["[data-study-canvas]", canvas],
    ["[data-study-dom]", dom],
    ["[data-study-state]", state],
    ["[data-study-prompt]", prompt],
    ["[data-study-action]", action],
    ["[data-study-meter]", meter]
]);

const documentHub = new EventHub();
documentHub.body = makeNode();
documentHub.body.dataset = { study: "shell-lifecycle-test" };
documentHub.documentElement = makeNode();
documentHub.querySelector = (selector) => nodes.get(selector);
documentHub.hidden = false;

const windowHub = new EventHub();
const cancellations = [];
let destroyCount = 0;
const API = {
    clamp(value, min, max) { return Math.max(min, Math.min(max, value)); },
    registry: {
        "shell-lifecycle-test": () => ({
            pointerCancel(pointer, event) { cancellations.push({ id: event.pointerId, type: event.type, down: pointer.down }); },
            destroy() { destroyCount += 1; }
        })
    }
};
const manifest = [{ slug: "shell-lifecycle-test", id: 1, modeLabel: "TEST", interaction: "Lifecycle" }];
const windowObject = { MotionStudy: API, MotionStudyManifest: manifest };
let frameId = 0;

const shellContext = vm.createContext({
    window: windowObject,
    document: documentHub,
    location: { search: "" },
    URLSearchParams,
    Set,
    Map,
    console,
    performance: { now: () => 1000 },
    matchMedia: () => ({ matches: false }),
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    requestAnimationFrame: () => ++frameId,
    cancelAnimationFrame: () => {},
    ResizeObserver: class { constructor(callback) { this.callback = callback; } observe() {} },
    addEventListener: windowHub.addEventListener.bind(windowHub)
});

const shellPath = path.resolve(__dirname, "..", "motion", "study-shell.js");
vm.runInContext(fs.readFileSync(shellPath, "utf8"), shellContext, { filename: "study-shell.js" });

function pointer(pointerId) {
    return { pointerId, pointerType: "touch", pressure: 0.5, clientX: 320, clientY: 220 };
}

stage.dispatch("pointerdown", pointer(7));
stage.dispatch("lostpointercapture", pointer(7));
stage.dispatch("pointercancel", pointer(7));
assert.deepEqual(cancellations, [{ id: 7, type: "lostpointercapture", down: false }]);

stage.dispatch("pointerdown", pointer(8));
windowHub.dispatch("blur");
stage.dispatch("lostpointercapture", pointer(8));
assert.deepEqual(cancellations.slice(1), [{ id: 8, type: "window-blur", down: false }]);

stage.dispatch("pointerdown", pointer(9));
documentHub.hidden = true;
documentHub.dispatch("visibilitychange");
assert.deepEqual(cancellations.at(-1), { id: 9, type: "visibility-hidden", down: false });

documentHub.hidden = false;
stage.dispatch("pointerdown", pointer(10));
windowHub.dispatch("pagehide", { persisted: false });
assert.deepEqual(cancellations.at(-1), { id: 10, type: "pagehide", down: false });
assert.equal(destroyCount, 1);

console.log("Verified study shell pointer cancellation across lost capture, blur, visibility, and pagehide.");
