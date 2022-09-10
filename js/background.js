var bodyBgs = [];    //创建一个数组变量来存储背景图片的路径

bodyBgs[0] = "../images/background0.png";

var randomBgIndex = Math.round( Math.random() * 0);

document.write('<style>body{background:url(' + bodyBgs[randomBgIndex] + '); background-position:center; background-size:cover; background-attachment:fixed;}</style>');