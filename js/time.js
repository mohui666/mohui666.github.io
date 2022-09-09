function date() {

    var date = new Date();

    var year = date.getFullYear();

    var month = date.getMonth() + 1;

    var day = date.getDate();

    var hour = "00" + date.getHours();

    hour = hour.substr(hour.length - 2);

    var minute = "00" + date.getMinutes();

    minute = minute.substr(minute.length - 2);

    var second = "00" + date.getSeconds();

    second = second.substr(second.length - 2);

    var week = date.getDay();

    switch (week) {

        case 1:

            week = "星期一 ";

            break;

        case 2:

            week = "星期二 ";

            break;

        case 3:

            week = "星期三 ";

            break;

        case 4:

            week = "星期四 ";

            break;

        case 5:

            week = "星期五 ";

            break;

        case 6:

            week = "星期六 ";

            break;

        case 0:

            week = "星期日 ";

            break;

        default:

            week = "";

            break;

    }

    document.getElementById("divBottom").innerHTML = year + "年" + month + "月" + day + "日" + " " + hour + ":" + minute + ":" + second + " " + week;

}

setInterval("date()", 1000);
