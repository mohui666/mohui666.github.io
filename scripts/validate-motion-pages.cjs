"use strict";

const fs = require("node:fs");
const path = require("node:path");
const data = require("../motion/effects-data.js");

const projectRoot = path.resolve(__dirname, "..");
const motionRoot = path.join(projectRoot, "motion");
const failures = [];

function check(condition, message) {
    if (!condition) failures.push(message);
}

check(data.total === 545, `manifest total is ${data.total}, expected 545`);
check(data.maxId === 545, `manifest max id is ${data.maxId}, expected 545`);
check(data.originalCount === 44 && data.handAuthoredCount === 45 && data.generatedCount === 500, "manifest source counts are inconsistent");
check(new Set(data.effects.map((item) => item.slug)).size === data.total, "manifest contains duplicate slugs");
check(new Set(data.effects.map((item) => item.signature)).size === data.total, "manifest contains duplicate effect signatures");
check(new Set(data.effects.filter((item) => item.id >= 46).map((item) => item.signature)).size === 500, "new effect signatures are not unique");

const generated = data.effects.filter((item) => item.id >= 46);
check(data.families.length === 25 && data.families.every((family) => family.algorithms.length === 20), "canonical term catalog must contain 25 families of 20 terms");
check(new Set(generated.map((item) => item.canonicalTerm)).size === 500, "canonical terms are not unique");
check(new Set(generated.map((item) => item.algorithmKey)).size === 500, "canonical term keys are not unique");
check(new Set(generated.map((item) => item.structuralSignature)).size === 500, "structural mechanism signatures are not unique");
check(new Set(generated.map((item) => item.effectiveSignature)).size === 500, "effective mechanism signatures are not unique");

const runtimeGraph = (effect) => [
    effect.familyId,
    effect.mechanism.solver,
    effect.algorithmIndex,
    effect.mechanism.driver,
    effect.mechanism.topology,
    effect.mechanism.update,
    effect.mechanism.boundary,
    effect.mechanism.visualizer
].join("/");
check(new Set(generated.map(runtimeGraph)).size === 500, "generated pages do not have 500 distinct runtime graphs");

for (const effect of generated) {
    const mechanism = effect.mechanism;
    check(mechanism && mechanism.schemaVersion === 2, `missing mechanism schema: ${effect.slug}`);
    check(data.mechanismOps.drivers.includes(mechanism.driver), `unknown driver: ${effect.slug}`);
    check(data.mechanismOps.topologies.includes(mechanism.topology), `unknown topology: ${effect.slug}`);
    check(data.mechanismOps.updates.includes(mechanism.update), `unknown update: ${effect.slug}`);
    check(data.mechanismOps.boundaries.includes(mechanism.boundary), `unknown boundary: ${effect.slug}`);
    check(data.mechanismOps.visualizers.includes(mechanism.visualizer), `unknown visualizer: ${effect.slug}`);
    check(effect.stateModel && effect.interactionLaw && effect.visualEncoding && effect.differenceClaim, `incomplete canonical specification: ${effect.slug}`);
}

const engineSource = fs.readFileSync(path.join(motionRoot, "generated-engine.js"), "utf8");
for (const operation of Object.values(data.mechanismOps).flat()) {
    check(engineSource.includes(`"${operation}"`), `runtime handler missing: ${operation}`);
}
check(!engineSource.includes("applyRecipeComposition"), "generic recipe compositor still exists");
check(engineSource.includes("solverRegistry[definition.mechanism.solver]"), "generated runtime does not dispatch by canonical solver key");
check(!engineSource.includes("var drawer = drawers[definition.familyId]"), "generated runtime still falls back to family-only dispatch");

let generatedFactory;
global.window = {
    MotionFieldData: data,
    MotionExtended: {
        helpers: { clamp: (value, min, max) => Math.max(min, Math.min(max, value)) },
        register(handlers) { generatedFactory = handlers["generated-effect"]; }
    }
};
function fakeContext() {
    const gradient = { addColorStop() {} };
    const target = {
        createRadialGradient: () => gradient,
        createLinearGradient: () => gradient,
        measureText: (text) => ({ width: String(text).length * 8 }),
        getImageData: (x, y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4) })
    };
    return new Proxy(target, {
        get(object, key) {
            if (!(key in object)) object[key] = function () {};
            return object[key];
        },
        set(object, key, value) { object[key] = value; return true; }
    });
}
global.document = {
    addEventListener() {},
    createElement() { return { width: 0, height: 0, getContext: () => fakeContext() }; }
};
require(path.join(motionRoot, "generated-engine.js"));
const solverRegistry = global.window.MotionSolverRegistry;
check(solverRegistry && Object.keys(solverRegistry).length === 500, `runtime registered ${solverRegistry ? Object.keys(solverRegistry).length : 0} term solvers, expected 500`);
for (const effect of generated) {
    const handler = solverRegistry && solverRegistry[effect.algorithmKey];
    check(handler && handler.key === effect.algorithmKey, `canonical solver is not registered: ${effect.algorithmKey}`);
    check(handler && typeof handler.step === "function" && typeof handler.draw === "function", `canonical solver is incomplete: ${effect.algorithmKey}`);
}
check(typeof generatedFactory === "function", "generated-effect factory was not registered");
const runtimeCases = new Map();
for (const effect of generated) runtimeCases.set(`${effect.familyId}/${effect.algorithmIndex}`, effect);
for (const effect of runtimeCases.values()) {
    const context = fakeContext();
    const api = {
        body: { dataset: { effectId: String(effect.id) } },
        canvas: { width: 160, height: 90 },
        size: { width: 320, height: 180, dpr: 0.5 },
        pointers: new Map(),
        isPreview: true,
        useCanvas() { return context; },
        setState() {}, setPrompt() {}, setAction() {}
    };
    try {
        const renderer = generatedFactory(api);
        renderer.frame(1200, 41.667, false);
    } catch (error) {
        check(false, `runtime smoke failed for ${effect.familyId}/${effect.algorithmIndex}: ${error.message}`);
    }
}
delete global.window;
delete global.document;

for (const effect of data.effects) {
    const filename = path.join(motionRoot, effect.slug, "index.html");
    check(fs.existsSync(filename), `missing page: ${effect.slug}`);
    if (!fs.existsSync(filename)) continue;
    const html = fs.readFileSync(filename, "utf8");
    check(html.includes(`/ ${data.total}`), `stale or missing total count: ${effect.slug}`);
    if (effect.id >= 46) {
        check(html.includes(`data-effect-id="${effect.id}"`), `wrong effect id: ${effect.slug}`);
        check(html.includes(`data-effect="generated-effect"`), `generated runner missing: ${effect.slug}`);
        check(html.includes(`data-mechanism-key="${effect.mechanismKey}"`), `mechanism key missing: ${effect.slug}`);
        check(html.includes(effect.titleEn.replaceAll("&", "&amp;")), `canonical term title missing: ${effect.slug}`);
        const next = data.byId[effect.id === data.maxId ? 1 : effect.id + 1];
        check(html.includes(`href="../${next.slug}/"`), `next route mismatch: ${effect.slug}`);
    }
}

const htmlFiles = [path.join(motionRoot, "index.html"), ...data.effects.map((effect) => path.join(motionRoot, effect.slug, "index.html"))];
for (const filename of htmlFiles) {
    const html = fs.readFileSync(filename, "utf8");
    for (const match of html.matchAll(/(?:href|src)="([^"#?]+)(?:\?[^"#]*)?"/g)) {
        const reference = match[1];
        if (/^(?:https?:|data:|mailto:|javascript:)/.test(reference)) continue;
        let target = path.resolve(path.dirname(filename), reference);
        if (reference.endsWith("/")) target = path.join(target, "index.html");
        check(fs.existsSync(target), `broken local reference in ${path.relative(projectRoot, filename)}: ${reference}`);
    }
}

if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
}

console.log(`Validated ${data.total} standalone pages, 500 canonical terms, 500 registered term solvers, ${runtimeCases.size} core runtime smoke cases, next-page chain, and local assets.`);
