"use strict";

const fs = require("node:fs");
const path = require("node:path");
const data = require("../motion/effects-data.js");

const projectRoot = path.resolve(__dirname, "..");
const motionRoot = path.join(projectRoot, "motion");

function check(condition, message) {
    if (!condition) throw new Error(message);
}

function localTarget(pageDirectory, rawUrl) {
    const cleanUrl = rawUrl.split("#")[0].split("?")[0];
    if (!cleanUrl || /^(?:[a-z]+:|\/\/|#)/i.test(cleanUrl)) return null;
    return path.resolve(pageDirectory, decodeURIComponent(cleanUrl));
}

check(data.total === 45, `manifest total is ${data.total}, expected 45`);
check(data.maxId === 45, `manifest max id is ${data.maxId}, expected 45`);
check(data.handAuthoredCount === 45 && data.generatedCount === 0, "manifest must contain only 45 handcrafted effects");
check(data.effects.every((effect, index) => effect.id === index + 1), "effect ids must be continuous from 1 to 45");
check(new Set(data.effects.map((effect) => effect.slug)).size === 45, "effect slugs must be unique");

const expectedSlugs = data.effects.map((effect) => effect.slug).sort();
const actualSlugs = fs.readdirSync(motionRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(motionRoot, entry.name, "index.html")))
    .map((entry) => entry.name)
    .sort();
check(JSON.stringify(actualSlugs) === JSON.stringify(expectedSlugs), "standalone page directories do not exactly match the 45-page manifest");

check(!fs.existsSync(path.join(motionRoot, "generated-engine.js")), "generated-engine.js must stay deleted");
check(!fs.existsSync(path.join(projectRoot, "scripts", "generate-motion-pages.cjs")), "generated page script must stay deleted");

for (const effect of data.effects) {
    const pageDirectory = path.join(motionRoot, effect.slug);
    const filename = path.join(pageDirectory, "index.html");
    const html = fs.readFileSync(filename, "utf8");
    const next = data.byId[effect.id === data.maxId ? 1 : effect.id + 1];
    const nextLabel = String(next.id).padStart(2, "0");

    check(html.includes(`共 45 个`), `total aria label missing: ${effect.slug}`);
    check((html.match(/\/ 45/g) || []).length >= 2, `visible total count missing: ${effect.slug}`);
    check(html.includes(`href="../${next.slug}/"`), `next-page route is wrong: ${effect.slug}`);
    check(html.includes(`NEXT · ${nextLabel} / 45`), `next-page count is wrong: ${effect.slug}`);
    check(!/\b(?:545)\b/.test(html), `stale 545 count remains: ${effect.slug}`);
    check(!html.includes(`data-effect="generated-effect"`), `generated page runner remains: ${effect.slug}`);

    for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
        const target = localTarget(pageDirectory, match[1]);
        if (target) check(fs.existsSync(target), `missing local reference in ${effect.slug}: ${match[1]}`);
    }
}

const catalogHtml = fs.readFileSync(path.join(motionRoot, "index.html"), "utf8");
check(catalogHtml.includes("45 EFFECTS / 45 PAGES"), "catalog total copy is stale");
check(!/\b545\b/.test(catalogHtml), "catalog still contains the old total");

console.log("Validated exactly 45 handcrafted motion pages, the complete next-page loop, count labels, and local references.");
