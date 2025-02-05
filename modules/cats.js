// модуль для получения изображения с котиком
// важно: скачивание и отправка файлов будет расходовать ваш интернет трафик, убедитесь что у вас безлимитный интернет

// в основной файл вставьте код ниже (4 строчки), /* */ копировать не надо

/*
const cats = require('./modules/cats');
bot.cmd('котик',(user,words)=>{
if(words.length==0)return cats.handler(bot,user);
});
*/

const {downloadFile, checkDrug} = require('./utils');

const sitesURL = ['https://genrandom.com/api/cat', 'https://cataas.com/cat']; // список сайтов откуда будем получать котиков, сайт должен вернуть именно изображение

const cacheObj = {};

function handler(bot, user, words){

if(!checkDrug(bot, user))return {msg:'Я не могу отправить котика, добавь меня в друзья!', color:['#f1a0b3','#FFFF00']};

var uid = user.id;
var ts = Math.floor(Date.now()/1000);
var cacheName = 'app'+bot.botInfo.app+'_'+uid;
var tm = cacheObj[cacheName] || 0;
if(ts >= tm+20){
cacheObj[cacheName] = ts;
downloadFile(sitesURL.random(), result=>{
delete cacheObj[cacheName];
var buf = null;
if(result && result.status == 200)buf = result.data;
if(buf && buf.length > 1024){
bot.sendMessage(uid, 'Уже отправляю!', {color:['#FFFFFF']});
bot.sendFile(uid, {name:'Котик.jpg'}, buf);
}else{
bot.sendMessage(uid, 'Не удалось найти котика, попробуй позднее.', {color:['#FFFFFF']});
}
});

var colorsArr = [['#f1a0b3','#FFFF00','#54EFF7'], ['#FFFFFF','#FD92FE','#54EFF7']];

var smilesArr = ['*em10*', '*em46*', '*em32*', '*em60*', '*em43*'];

return {msg:'Ищу котика'+smilesArr.random(), color:colorsArr.random()};
}
return {msg:'Я уже обрабатываю запрос', color:['#FFFFFF']};
}

module.exports = {handler};