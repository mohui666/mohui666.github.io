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

for (const effect of data.effects) {
    const filename = path.join(motionRoot, effect.slug, "index.html");
    check(fs.existsSync(filename), `missing page: ${effect.slug}`);
    if (!fs.existsSync(filename)) continue;
    const html = fs.readFileSync(filename, "utf8");
    check(html.includes(`/ ${data.total}`), `stale or missing total count: ${effect.slug}`);
    if (effect.id >= 46) {
        check(html.includes(`data-effect-id="${effect.id}"`), `wrong effect id: ${effect.slug}`);
        check(html.includes(`data-effect="generated-effect"`), `generated runner missing: ${effect.slug}`);
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

console.log(`Validated ${data.total} standalone pages, 500 unique new signatures, next-page chain, and local asset references.`);
