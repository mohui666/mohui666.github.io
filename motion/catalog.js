(function () {
    "use strict";

    var Data = window.MotionFieldData;
    var TAU = Math.PI * 2;
    var catalog = document.querySelector("[data-catalog]");
    var search = document.querySelector("[data-search]");
    var filter = document.querySelector("[data-filter]");
    var result = document.querySelector("[data-result]");
    var empty = document.querySelector("[data-empty]");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var mounted = new Map();
    var visibleCards = new Set();
    var cards = [];
    var reconcileFrame = 0;

    if (!Data || !catalog) return;

    function pad(value) { return String(value).padStart(3, "0"); }

    function createCard(effect) {
        var card = document.createElement("article");
        card.className = "experiment-card live-card";
        card.dataset.card = "";
        card.dataset.effectId = effect.id;
        card.dataset.section = effect.sectionId;
        card.dataset.src = effect.slug + "/?preview=1";
        card.style.setProperty("--preview-accent", effect.palette[0]);
        card.style.setProperty("--preview-secondary", effect.palette[1]);
        var sectionInfo = Data.sections[effect.sectionId];
        card._searchText = [effect.titleEn, effect.titleZh, effect.modeLabel, effect.sectionId, sectionInfo[0], sectionInfo[1], sectionInfo[2], effect.algorithmKey || "", effect.algorithmNote || "", effect.interaction || ""].join(" ").toLocaleLowerCase();
        card.innerHTML = '<div class="card-visual live-preview" aria-hidden="true">' +
            '<div class="preview-ambient"><i></i><i></i><b>' + pad(effect.id) + '</b></div>' +
            '<p class="preview-loading"><span></span> LIVE PAGE / ' + pad(effect.id) + '</p>' +
            '<div class="preview-mount" data-preview-mount></div>' +
            '</div>' +
            '<div class="card-meta"><span class="card-number">' + pad(effect.id) + '</span><div><h3>' + effect.titleEn + '</h3><p>' + effect.titleZh + ' · ' + effect.modeLabel + '</p></div><span class="card-arrow" aria-hidden="true">↗</span></div>' +
            '<a class="card-overlay" href="' + effect.slug + '/" aria-label="打开实验 ' + pad(effect.id) + '：' + effect.titleZh + '"></a>';
        card._effect = effect;
        return card;
    }

    function buildCatalog() {
        var sectionIds = [];
        Data.effects.forEach(function (effect) { if (!sectionIds.includes(effect.sectionId)) sectionIds.push(effect.sectionId); });
        var fragment = document.createDocumentFragment();
        sectionIds.forEach(function (sectionId) {
            var info = Data.sections[sectionId];
            var effects = Data.effects.filter(function (effect) { return effect.sectionId === sectionId; });
            var section = document.createElement("section");
            section.className = "lexicon-block live-section";
            section.dataset.sectionBlock = sectionId;
            section.innerHTML = '<div class="lexicon-heading"><div><p>' + info[2] + '</p><h2>' + info[1] + '<small>' + info[0] + '</small></h2></div><span>' + pad(effects[0].id) + '—' + pad(effects[effects.length - 1].id) + '</span></div><div class="experiment-grid section-grid" data-grid></div>';
            var grid = section.querySelector("[data-grid]");
            effects.forEach(function (effect) { var card = createCard(effect); cards.push(card); grid.appendChild(card); });
            fragment.appendChild(section);

            var option = document.createElement("option");
            option.value = sectionId;
            option.textContent = info[1] + " · " + info[0];
            filter.appendChild(option);
        });
        catalog.appendChild(fragment);
    }

    function updateScale(card) {
        var mount = card.querySelector("[data-preview-mount]");
        var width = mount.clientWidth || 1;
        var height = mount.clientHeight || 1;
        var mobile = window.innerWidth <= 760;
        var previewWidth = mobile ? 390 : 1280;
        var previewHeight = mobile ? 844 : 720;
        mount.style.setProperty("--preview-width", previewWidth + "px");
        mount.style.setProperty("--preview-height", previewHeight + "px");
        mount.style.setProperty("--preview-scale", Math.max(width / previewWidth, height / previewHeight).toFixed(5));
    }

    function prepareLegacyPreview(frame) {
        var childDocument = frame.contentDocument;
        if (!childDocument || childDocument.getElementById("motion-catalog-preview-style")) return;
        childDocument.documentElement.classList.add("motion-catalog-preview");
        var style = childDocument.createElement("style");
        style.id = "motion-catalog-preview-style";
        style.textContent = "html.motion-catalog-preview header,html.motion-catalog-preview footer,html.motion-catalog-preview nav,html.motion-catalog-preview .skip-link,html.motion-catalog-preview .fluid-content,html.motion-catalog-preview .scroll-cue,html.motion-catalog-preview .progress-rail,html.motion-catalog-preview .hero-copy,html.motion-catalog-preview .lab-note,html.motion-catalog-preview .interaction-dock,html.motion-catalog-preview .lab-copy,html.motion-catalog-preview .physics-copy,html.motion-catalog-preview .scene-copy,html.motion-catalog-preview .next-link,html.motion-catalog-preview .motion-next,html.motion-catalog-preview [class$='-next'],html.motion-catalog-preview [class$='-reset'],html.motion-catalog-preview .field-next,html.motion-catalog-preview .experiment-end,html.motion-catalog-preview .lab-controls,html.motion-catalog-preview .physics-controls{display:none!important}html.motion-catalog-preview .physics-lab{display:block!important;width:100vw!important;height:100vh!important;min-height:100vh!important;margin:0!important;padding:0!important}html.motion-catalog-preview .physics-stage{position:absolute!important;inset:0!important;width:100vw!important;height:100vh!important;min-height:0!important;margin:0!important;border-radius:0!important}";
        childDocument.head.appendChild(style);
    }

    function driveLegacyPreview(card, frame) {
        var effect = card._effect;
        if (!effect.legacy || reduceMotion) return;
        var started = performance.now();
        var lastAction = started;
        var actionIndex = 0;
        var pointerDown = false;
        var pointerInside = false;
        var enteredTarget = null;
        var downTarget = null;

        function dispatchPointer(childWindow, target, type, x, y, buttons) {
            var EventType = childWindow.PointerEvent || childWindow.MouseEvent;
            var eventInit = { bubbles: type !== "pointerenter" && type !== "pointerleave", clientX: x, clientY: y, pointerId: 91, pointerType: "mouse", buttons: buttons, button: type === "pointerdown" || type === "pointerup" ? 0 : -1, pressure: buttons ? 0.62 : 0 };
            if (type === "pointerenter" || type === "pointerleave") {
                var node = target;
                while (node && node.dispatchEvent) {
                    node.dispatchEvent(new EventType(type, eventInit));
                    node = node.parentElement;
                }
                return;
            }
            target.dispatchEvent(new EventType(type, eventInit));
        }

        function tick(now) {
            var entry = mounted.get(card);
            if (!entry || entry.frame !== frame || card.hidden) return;
            try {
                var childWindow = frame.contentWindow;
                var childDocument = frame.contentDocument;
                var cycle = ((now - started) % 5200) / 5200;
                var x = childWindow.innerWidth * (0.22 + cycle * 0.58);
                var y = childWindow.innerHeight * (0.48 + Math.sin(cycle * TAU + effect.id) * 0.2);
                var hoverTarget = childDocument.elementFromPoint(x, y) || childDocument.body;
                if (hoverTarget !== enteredTarget) {
                    if (enteredTarget) dispatchPointer(childWindow, enteredTarget, "pointerleave", x, y, 0);
                    dispatchPointer(childWindow, hoverTarget, "pointerenter", x, y, 0);
                    enteredTarget = hoverTarget;
                    pointerInside = true;
                }
                if (cycle < 0.12 && !pointerDown) {
                    downTarget = childDocument.querySelector("[data-physics-object], [data-reorder-item], [data-drag-item], [data-drag-puck], [data-card], .physics-object, .draggable") || hoverTarget;
                    var targetRect = downTarget.getBoundingClientRect();
                    x = targetRect.left + targetRect.width * 0.5;
                    y = targetRect.top + targetRect.height * 0.5;
                    dispatchPointer(childWindow, downTarget, "pointerdown", x, y, 1);
                    pointerDown = true;
                } else if (cycle < 0.76 && pointerDown) {
                    dispatchPointer(childWindow, downTarget || hoverTarget, "pointermove", x, y, 1);
                } else if (pointerDown) {
                    dispatchPointer(childWindow, downTarget || hoverTarget, "pointerup", x, y, 0);
                    pointerDown = false;
                    downTarget = null;
                } else {
                    dispatchPointer(childWindow, hoverTarget, "pointermove", x, y, 0);
                }
                if (cycle > 0.94 && pointerInside) {
                    dispatchPointer(childWindow, enteredTarget || hoverTarget, "pointerleave", x, y, 0);
                    enteredTarget = null;
                    pointerInside = false;
                }
                var scrollRange = Math.max(0, childDocument.documentElement.scrollHeight - childWindow.innerHeight);
                if (scrollRange > 80) childWindow.scrollTo(0, (0.5 - 0.5 * Math.cos((now - started) * 0.00038)) * scrollRange);
                if (now - lastAction > 3400) {
                    var actions = Array.from(childDocument.querySelectorAll("[data-action], [data-toggle], [data-morph], button:not([data-reset]):not([disabled])"));
                    var action = actions.length ? actions[actionIndex % actions.length] : null;
                    if (action && !action.closest("a")) { action.click(); actionIndex += 1; }
                    lastAction = now;
                }
            } catch (error) {
                entry.driver = 0;
                return;
            }
            entry.driver = requestAnimationFrame(tick);
        }
        var entry = mounted.get(card);
        if (entry) entry.driver = requestAnimationFrame(tick);
    }

    function mountPreview(card) {
        if (mounted.has(card)) {
            window.clearTimeout(mounted.get(card).removeTimer);
            mounted.get(card).removeTimer = 0;
            return;
        }
        if (card.hidden) return;
        var mount = card.querySelector("[data-preview-mount]");
        var frame = document.createElement("iframe");
        frame.className = "preview-frame";
        frame.title = "实验 " + pad(card._effect.id) + " 的实时页面预览";
        frame.tabIndex = -1;
        frame.setAttribute("aria-hidden", "true");
        frame.src = card.dataset.src;
        var entry = { frame: frame, driver: 0, removeTimer: 0 };
        mounted.set(card, entry);
        updateScale(card);
        frame.addEventListener("load", function () {
            if (!mounted.has(card)) return;
            card.classList.add("is-preview-ready");
            if (card._effect.legacy) prepareLegacyPreview(frame);
            driveLegacyPreview(card, frame);
        }, { once: true });
        mount.appendChild(frame);
    }

    function unmountPreview(card, immediate) {
        var entry = mounted.get(card);
        if (!entry) return;
        window.clearTimeout(entry.removeTimer);
        function remove() {
            if (entry.driver) cancelAnimationFrame(entry.driver);
            entry.frame.remove();
            mounted.delete(card);
            card.classList.remove("is-preview-ready");
        }
        if (immediate) remove(); else entry.removeTimer = window.setTimeout(remove, 420);
    }

    buildCatalog();

    function reconcilePreviews() {
        reconcileFrame = 0;
        var viewportCenter = window.innerHeight * 0.5;
        var limit = window.innerWidth <= 760 ? 2 : 4;
        var candidates = Array.from(visibleCards).filter(function (card) { return !card.hidden; }).sort(function (a, b) {
            var ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
            return Math.abs(ar.top + ar.height * 0.5 - viewportCenter) - Math.abs(br.top + br.height * 0.5 - viewportCenter);
        });
        var allowed = new Set(candidates.slice(0, limit));
        Array.from(mounted.keys()).forEach(function (card) { if (!allowed.has(card)) unmountPreview(card, true); });
        allowed.forEach(mountPreview);
    }

    function scheduleReconcile() {
        if (!reconcileFrame) reconcileFrame = requestAnimationFrame(reconcilePreviews);
    }

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            entry.target.classList.toggle("is-preview-active", entry.isIntersecting);
            if (entry.isIntersecting) visibleCards.add(entry.target); else visibleCards.delete(entry.target);
        });
        scheduleReconcile();
    }, { rootMargin: "120px 0px", threshold: 0.01 });

    cards.forEach(function (card) { observer.observe(card); });

    var resizeObserver = new ResizeObserver(function (entries) {
        entries.forEach(function (entry) { if (mounted.has(entry.target)) updateScale(entry.target); });
        scheduleReconcile();
    });
    cards.forEach(function (card) { resizeObserver.observe(card); });

    function applyFilter() {
        var query = search.value.trim().toLocaleLowerCase();
        var family = filter.value;
        var count = 0;
        cards.forEach(function (card) {
            var visible = (family === "all" || card.dataset.section === family) && (!query || card._searchText.includes(query));
            card.hidden = !visible;
            if (visible) count += 1; else unmountPreview(card, true);
        });
        document.querySelectorAll("[data-section-block]").forEach(function (section) {
            section.hidden = !Array.from(section.querySelectorAll("[data-card]")).some(function (card) { return !card.hidden; });
        });
        result.textContent = count + " / " + Data.total;
        empty.hidden = count !== 0;
        scheduleReconcile();
    }

    search.addEventListener("input", applyFilter);
    filter.addEventListener("change", applyFilter);
    window.addEventListener("resize", scheduleReconcile, { passive: true });

    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        cards.forEach(function (card) {
            var frame = 0, pointerX = 0, pointerY = 0;
            card.addEventListener("pointermove", function (event) {
                pointerX = event.clientX; pointerY = event.clientY;
                if (frame) return;
                frame = requestAnimationFrame(function () {
                    var rect = card.getBoundingClientRect();
                    card.style.setProperty("--mx", ((pointerX - rect.left) / rect.width * 100).toFixed(1) + "%");
                    card.style.setProperty("--my", ((pointerY - rect.top) / rect.height * 100).toFixed(1) + "%");
                    frame = 0;
                });
            }, { passive: true });
        });
    }
}());
