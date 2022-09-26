var bodyBgs = [];    //创建一个数组变量来存储背景图片的路径

bodyBgs[0] = "../images/BackGround/bg0.png";
bodyBgs[1] = "../images/BackGround/bg1.png";
bodyBgs[2] = "../images/BackGround/bg2.png";
bodyBgs[3] = "../images/BackGround/bg3.png";
bodyBgs[4] = "../images/BackGround/bg4.png";
bodyBgs[5] = "../images/BackGround/bg5.png";
bodyBgs[6] = "../images/BackGround/bg6.png";
bodyBgs[7] = "../images/BackGround/bg7.png";
bodyBgs[8] = "../images/BackGround/bg8.png";
bodyBgs[9] = "../images/BackGround/bg9.png";
bodyBgs[10] = "../images/BackGround/bg10.png";
bodyBgs[11] = "../images/BackGround/bg11.png";
bodyBgs[12] = "../images/BackGround/bg12.png";
bodyBgs[13] = "../images/BackGround/bg13.png";
bodyBgs[14] = "../images/BackGround/bg14.png";

var randomBgIndex = Math.round( Math.random() * 14);

document.write('<style>body{background:url(' + bodyBgs[randomBgIndex] + '); background-position:center; background-size:cover; background-attachment:fixed;}</style>');