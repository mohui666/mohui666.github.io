"use strict";

const fs = require("node:fs");
const path = require("node:path");
const data = require("../motion/effects-data.js");
const studies = require("../motion/study-manifest.js");

const projectRoot = path.resolve(__dirname, "..");
const motionRoot = path.join(projectRoot, "motion");
const bundleFiles = ["choreography", "hci", "temporal", "geometry", "image", "spatial", "physics-sim", "generative", "data", "signal"];

function check(condition, message) {
    if (!condition) throw new Error(message);
}

function localTarget(pageDirectory, rawUrl) {
    const cleanUrl = rawUrl.split("#")[0].split("?")[0];
    if (!cleanUrl || /^(?:[a-z]+:|\/\/|#)/i.test(cleanUrl)) return null;
    return path.resolve(pageDirectory, decodeURIComponent(cleanUrl));
}

check(data.total === 145, `manifest total is ${data.total}, expected 145`);
check(data.maxId === 145, `manifest max id is ${data.maxId}, expected 145`);
check(data.handAuthoredCount === 145 && data.generatedCount === 0, "manifest must describe 145 authored effects and no generated mechanism family");
check(data.effects.every((effect, index) => effect.id === index + 1), "effect ids must be continuous from 1 to 145");
check(new Set(data.effects.map((effect) => effect.slug)).size === 145, "effect slugs must be unique");
check(studies.length === 100 && studies[0].id === 46 && studies.at(-1).id === 145, "study manifest must cover ids 46 through 145 exactly");
for (const field of ["slug", "titleEn", "titleZh", "mechanism", "interaction", "differentiator"]) {
    check(new Set(studies.map((study) => study[field])).size === 100, `study ${field} values must be unique`);
}
check(studies.every((study) => study.mechanism && study.interaction && study.differentiator && Number.isInteger(study.complexity)), "every study needs mechanism, interaction, differentiator, and complexity assessment");

const expectedSlugs = data.effects.map((effect) => effect.slug).sort();
const actualSlugs = fs.readdirSync(motionRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(motionRoot, entry.name, "index.html")))
    .map((entry) => entry.name)
    .sort();
check(JSON.stringify(actualSlugs) === JSON.stringify(expectedSlugs), "standalone page directories do not exactly match the 145-page manifest");

check(!fs.existsSync(path.join(motionRoot, "generated-engine.js")), "generated-engine.js must stay deleted");
check(!fs.existsSync(path.join(projectRoot, "scripts", "generate-motion-pages.cjs")), "generated page script must stay deleted");
check(!fs.existsSync(path.join(projectRoot, "scripts", "_sync-motion-study-pages.cjs")), "temporary study page sync script must not ship");

const registrations = new Map();
for (const bundle of bundleFiles) {
    const filename = path.join(motionRoot, `study-${bundle}.js`);
    const source = fs.readFileSync(filename, "utf8");
    for (const match of source.matchAll(/M\.register\("([^"]+)"/g)) {
        check(!registrations.has(match[1]), `duplicate handler registration: ${match[1]}`);
        registrations.set(match[1], bundle);
    }
}
check(registrations.size === 100, `found ${registrations.size} exact study handlers, expected 100`);
check(studies.every((study) => registrations.get(study.slug) === study.bundle), "every study must map to one exact handler in its declared bundle");

const shellSource = fs.readFileSync(path.join(motionRoot, "study-shell.js"), "utf8");
check(shellSource.includes('throw new Error("Missing exact motion study handler: " + slug)'), "study shell must fail loudly when an exact handler is absent");
check(!/registry\[slug\]\s*\|\||fallback/i.test(shellSource), "study shell must not contain a family fallback");
check(shellSource.includes("motion-preview-active") && shellSource.includes("previewDrive"), "study shell must pause catalog previews and demo the same page handler");

for (const effect of data.effects) {
    const pageDirectory = path.join(motionRoot, effect.slug);
    const filename = path.join(pageDirectory, "index.html");
    const html = fs.readFileSync(filename, "utf8");
    const next = data.byId[effect.id === data.maxId ? 1 : effect.id + 1];
    const nextLabel = String(next.id).padStart(2, "0");

    check(html.includes("共 145 个"), `total aria label missing: ${effect.slug}`);
    check((html.match(/\/ 145/g) || []).length >= 2, `visible total count missing: ${effect.slug}`);
    check(html.includes(`href="../${next.slug}/"`), `next-page route is wrong: ${effect.slug}`);
    check(html.includes(`NEXT · ${nextLabel} / 145`), `next-page count is wrong: ${effect.slug}`);
    check(!/\b(?:545)\b/.test(html), `stale generated total remains: ${effect.slug}`);
    check(!html.includes('data-effect="generated-effect"'), `generated page runner remains: ${effect.slug}`);

    if (effect.id >= 46) {
        check(html.includes(`data-study="${effect.slug}"`), `exact study slug missing from route: ${effect.slug}`);
        check(html.includes(`src="../study-${effect.bundle}.js`), `declared bundle is not loaded: ${effect.slug}`);
        check(html.includes("study-shell.css") && html.includes("study-shell.js"), `shared authored shell is missing: ${effect.slug}`);
        check(html.includes(effect.summaryZh) && html.includes(effect.algorithmNote), `mechanism assessment copy is missing: ${effect.slug}`);
    }

    for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
        const target = localTarget(pageDirectory, match[1]);
        if (target) check(fs.existsSync(target), `missing local reference in ${effect.slug}: ${match[1]}`);
    }
}

const catalogHtml = fs.readFileSync(path.join(motionRoot, "index.html"), "utf8");
check(catalogHtml.includes("145 EFFECTS / 145 PAGES"), "catalog total copy is stale");
check(catalogHtml.indexOf("study-manifest.js") < catalogHtml.indexOf("effects-data.js"), "catalog must load the study manifest before combining effect data");
check(!/\b545\b/.test(catalogHtml), "catalog still contains the removed generated total");

console.log("Validated 145 exact routes, 100 unique named-study handlers, complete next-page loop, real preview wiring, counts, and local references.");
