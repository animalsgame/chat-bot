// всякие функции которые будут использоваться

const https = require('https'); // модуль для работы с https запросами

// является ли отправитель другом, без добавления в друзья бот не может дарить подарки, отправлять сообщения в любое время
function checkDrug(bot, user){
if(bot.botInfo){
if(user.id == bot.botInfo.owner || user.botDrug)return true;
}
return false;
}

// проверка прав админа (владелец бота)
function checkAdmin(bot, user){
if(bot.botInfo && user.id == bot.botInfo.owner)return true;
return false;
}

// сколько осталось времени, передаются только секунды, эта функция высчитывает не только минуты и секунды, но и даже дни!
function getTimeStr(seconds){
var arr = [];
if(seconds>0){
var timesArr = [['мес', 60 * 60 * 24 * 30], ['нед', 60 * 60 * 24 * 7], ['дн', 60 * 60 * 24], ['ч', 60 * 60], ['мин', 60], ['сек', 1]];
for (var i = 0; i < timesArr.length; i++) {
var el = timesArr[i];
var vv = Math.floor(seconds / el[1]);
if(el[1] != 1)seconds -= vv*el[1];
if(vv > 0)arr.push(vv+' '+el[0]+'.');
}
}
return arr.join(' ');
}

// скачивание файла по ссылке
function downloadFile(url, cb){
var chunks = [];
var isErrors = false;
var isClose = false;
var result = {status:0, data:null};
var client = https.get(url, res=>{
result.status = res.statusCode;
res.on('data', chunk=>chunks.push(chunk));
});

client.on('error', e=>{
if(!isErrors){
isErrors = true;
if(cb)cb(result);
}
});

client.setTimeout(5000, ()=>{
client.destroy();
isClose = true;
});

client.on('close', ()=>{
if(isErrors || isClose)return;
result.data = Buffer.concat(chunks);
if(cb)cb(result);
});

client.end();
}

module.exports = {checkDrug, checkAdmin, getTimeStr, downloadFile};