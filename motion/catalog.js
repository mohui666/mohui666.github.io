(function () {
    "use strict";

    var cards = Array.from(document.querySelectorAll("[data-card]"));
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!reduceMotion) {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                entry.target.classList.toggle("is-preview-active", entry.isIntersecting);
            });
        }, { rootMargin: "220px 0px", threshold: 0.01 });

        cards.forEach(function (card) {
            observer.observe(card);
        });
    }

    if (reduceMotion || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    cards.forEach(function (card) {
        var pointerX = 0;
        var pointerY = 0;
        var frame = 0;

        function paintPointer() {
            var rect = card.getBoundingClientRect();
            card.style.setProperty("--mx", (((pointerX - rect.left) / rect.width) * 100).toFixed(1) + "%");
            card.style.setProperty("--my", (((pointerY - rect.top) / rect.height) * 100).toFixed(1) + "%");
            frame = 0;
        }

        card.addEventListener("pointermove", function (event) {
            pointerX = event.clientX;
            pointerY = event.clientY;
            if (!frame) frame = requestAnimationFrame(paintPointer);
        }, { passive: true });

        card.addEventListener("pointerleave", function () {
            if (frame) cancelAnimationFrame(frame);
            frame = 0;
            card.style.setProperty("--mx", "50%");
            card.style.setProperty("--my", "50%");
        });
    });
}());
