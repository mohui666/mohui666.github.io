const dp = new DPlayer({
    container: document.getElementById('dplayer'),
    video: {
        url: "../videos/hamood.mp4",

        autoplay:true,

        playbackSpeed:[0.5, 0.75, 1, 1.25, 1.5, 2]

    }})