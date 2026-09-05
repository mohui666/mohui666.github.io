(function () {
    "use strict";

    var weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    var clock = document.getElementById("divBottom");
    var timer = null;

    function updateClock() {
        var now = new Date();
        var time = [now.getHours(), now.getMinutes(), now.getSeconds()]
            .map(function (value) { return String(value).padStart(2, "0"); })
            .join(":");
        clock.textContent = now.getFullYear() + "年" + (now.getMonth() + 1) + "月"
            + now.getDate() + "日 " + time + " " + weekdays[now.getDay()] + " ";
    }

    function syncClock() {
        if (timer !== null) {
            window.clearInterval(timer);
            timer = null;
        }
        if (!document.hidden) {
            updateClock();
            timer = window.setInterval(updateClock, 1000);
        }
    }

    document.addEventListener("visibilitychange", syncClock);
    syncClock();
})();
