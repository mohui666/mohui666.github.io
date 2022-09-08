divText = document.getElementById("clock");

showTime();

timer = setInterval(showTime, 1000);

function showTime() {

	var today = new Date();

	var date = today.getDate();

	var day = today.getDay();

	var month = today.getMonth() + 1;

	var year = today.getFullYear();

	var hour = addZero(today.getHours());

	var min = addZero(today.getMinutes());

	var sec = addZero(today.getSeconds());

	var week = "";

	if (true) {};

	if (day == 0) week = '星期日';

	if (day == 1) week = '星期一';

	if (day == 2) week = '星期二';

	if (day == 3) week = '星期三';

	if (day == 4) week = '星期四';

	if (day == 5) week = '星期五';

	if (day == 6) week = '星期六';

	divText.innerHTML = "当前时间：" + year + "年" + month + "月" + date + "日 " + week + " " + "(" + hour + ":" + min + ":" + sec + ")";

}

function addZero(num) {

	if (num <= 9) {

		return "0" + num;

	} else {

		return num;

	}

}
