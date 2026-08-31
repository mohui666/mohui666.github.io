(function () {
    "use strict";

    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    document.querySelectorAll("[data-card]").forEach(function (card) {
        card.addEventListener("pointermove", function (event) {
            var rect = card.getBoundingClientRect();
            card.style.setProperty("--mx", (((event.clientX - rect.left) / rect.width) * 100).toFixed(1) + "%");
            card.style.setProperty("--my", (((event.clientY - rect.top) / rect.height) * 100).toFixed(1) + "%");
        }, { passive: true });

        card.addEventListener("pointerleave", function () {
            card.style.setProperty("--mx", "50%");
            card.style.setProperty("--my", "50%");
        });
    });
}());
