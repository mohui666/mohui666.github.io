"use strict";

const fs = require("node:fs");
const path = require("node:path");
const data = require("../motion/effects-data.js");

const projectRoot = path.resolve(__dirname, "..");
const motionRoot = path.join(projectRoot, "motion");

function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

for (const effect of data.effects.filter((item) => item.id >= 46)) {
    const next = data.byId[effect.id === data.maxId ? 1 : effect.id + 1];
    const [algorithmTitle, recipeTitle] = effect.titleEn.split(" — ");
    const layoutMode = effect.recipeIndex === 3 ? "scroll" : "pointer";
    const action = effect.familyId === "audio-spatial" ? "START AUDIO" : effect.recipeIndex === 4 ? "NEXT SIGNAL" : "CHANGE PRESET";
    const html = `<!doctype html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="description" content="${escapeHtml(effect.titleZh)}：${escapeHtml(effect.summaryZh)}">
    <meta name="theme-color" content="#050817">
    <link rel="icon" href="../../images/cover.ico" type="image/x-icon">
    <link rel="stylesheet" href="../extended-lab.css?v=20260901-545">
    <script src="../effects-data.js?v=20260901-545" defer></script>
    <script src="../extended-lab.js?v=20260901-545" defer></script>
    <script src="../generated-engine.js?v=20260901-545" defer></script>
    <title>${escapeHtml(effect.titleEn)} · Motion Field ${effect.id}</title>
</head>
<body data-effect="generated-effect" data-effect-id="${effect.id}" data-mode="${layoutMode}" data-interaction="${effect.interactionMode}" style="--accent:${effect.palette[0]};--accent-2:${effect.palette[1]};--accent-rgb:${effect.palette[2]}">
    <a class="skip-link" href="#experiment">跳到${escapeHtml(effect.titleZh)}实验</a>
    <header class="extended-nav">
        <a href="../" aria-label="返回 Motion Field 总览"><span aria-hidden="true">←</span><span>Motion Field</span></a>
        <p><i aria-hidden="true"></i> ${escapeHtml(algorithmTitle)}</p>
        <b aria-label="第 ${effect.id} 个实验，共 ${data.total} 个">${String(effect.id).padStart(3, "0")} / ${data.total}</b>
    </header>

    <main class="extended-stage" id="experiment" data-stage>
        <div class="extended-sticky" data-surface>
            <section class="extended-copy" aria-labelledby="page-title">
                <p class="extended-eyebrow"><span>${String(effect.id).padStart(3, "0")}</span> ${escapeHtml(data.sections[effect.sectionId][2])}</p>
                <h1 id="page-title">${escapeHtml(algorithmTitle)}<br><em>${escapeHtml(recipeTitle)}.</em></h1>
                <p class="extended-description">${escapeHtml(effect.summaryZh)} ${escapeHtml(effect.instructionZh)}</p>
            </section>

            <section class="effect-zone" data-zone tabindex="0" aria-label="${escapeHtml(effect.titleZh)}。${escapeHtml(effect.instructionZh)}">
                <canvas data-canvas aria-hidden="true"></canvas>
                <div class="dom-layer" data-dom hidden></div>
            </section>

            <div class="extended-controls">
                <p class="extended-state"><i aria-hidden="true"></i><span data-state>${escapeHtml(effect.algorithmKey.toUpperCase().replaceAll("-", " "))} / LIVE<small data-prompt>${escapeHtml(effect.instructionZh)}</small></span></p>
                <button class="extended-action" data-action type="button">${action}</button>
            </div>

            <a class="extended-next" href="../${next.slug}/" aria-label="前往下一个实验：${escapeHtml(next.titleEn)}">
                <span><small>NEXT · ${String(next.id).padStart(3, "0")} / ${data.total}</small>${escapeHtml(next.titleEn)}</span><b aria-hidden="true">↗</b>
            </a>
        </div>
    </main>
    <noscript><p class="no-script">启用 JavaScript 后即可体验${escapeHtml(effect.titleZh)}。</p></noscript>
</body>
</html>
`;
    const directory = path.join(motionRoot, effect.slug);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "index.html"), html);
}

for (const effect of data.effects.filter((item) => item.id <= 44)) {
    const filename = path.join(motionRoot, effect.slug, "index.html");
    let html = fs.readFileSync(filename, "utf8");
    html = html.replaceAll("共 44 个", `共 ${data.total} 个`).replaceAll(" / 44", ` / ${data.total}`).replaceAll("/ 44", `/ ${data.total}`);
    fs.writeFileSync(filename, html);
}

console.log(`Generated ${data.effects.filter((item) => item.id >= 46).length} standalone pages; total manifest count ${data.total}.`);
