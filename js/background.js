var bodyBgs = [
    "images/BackGround/bg0.png",
    "images/BackGround/bg1.png",
    "images/BackGround/bg2.png",
    "images/BackGround/bg3.png",
    "images/BackGround/bg4.png",
    "images/BackGround/bg5.png",
    "images/BackGround/bg6.png",
    "images/BackGround/bg7.png",
    "images/BackGround/bg8.png",
    "images/BackGround/bg9.png",
    "images/BackGround/bg10.png",
    "images/BackGround/bg11.png",
    "images/BackGround/bg12.png",
    "images/BackGround/bg13.png",
    "images/BackGround/bg14.png"
];

function applyRandomBackground() {
    var randomBgIndex = Math.floor(Math.random() * bodyBgs.length);
    var backgroundUrl = new URL(bodyBgs[randomBgIndex], document.baseURI).href;

    document.documentElement.style.setProperty("--page-bg-image", "url(\"" + backgroundUrl + "\")");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyRandomBackground);
} else {
    applyRandomBackground();
}
