var bodyBgs = [];    //创建一个数组变量来存储背景图片的路径

bodyBgs[0] = "../images/bg0.png";
bodyBgs[1] = "../images/bg1.png";
bodyBgs[2] = "../images/bg2.png";
bodyBgs[3] = "../images/bg3.png";
bodyBgs[4] = "../images/bg4.png";
bodyBgs[5] = "../images/bg5.png";
bodyBgs[6] = "../images/bg6.png";
bodyBgs[7] = "../images/bg7.png";
bodyBgs[8] = "../images/bg8.png";
bodyBgs[9] = "../images/bg9.png";
bodyBgs[10] = "../images/bg10.png";
bodyBgs[11] = "../images/bg11.png";
bodyBgs[12] = "../images/bg12.png";
bodyBgs[13] = "../images/bg13.png";
bodyBgs[14] = "../images/bg14.png";

var randomBgIndex = Math.round( Math.random() * 14);

document.write('<style>body{background:url(' + bodyBgs[randomBgIndex] + '); background-position:center; background-size:cover; background-attachment:fixed;}</style>');