// модуль для обновления клиента, и его модулей, этот модуль подгружается когда запускается бот, когда загружается этот модуль, к боту подключается команда "bot" команды доступны только владельцу бота

// внимание, команда "bot" подключается ДО запуска вашего кода где у вас все команды, поэтому вы в своём коде можете добавить эту команду, но тогда этот модуль работать не будет

/*
bot update client - обновляет клиент бота (файл bot.js)
bot update module имя - обновляет модуль отдельно, вместо имя укажите имя модуля (например cats)
*/

const fs = require('fs');
const {downloadFile, checkAdmin} = require('./utils');
const updateURL = 'https://raw.githubusercontent.com/animalsgame/chat-bot/refs/heads/main';

function handler(bot, user, words){
if(checkAdmin(bot, user)){
var uid = user.id;
if(words.length > 1){
var type = words[0];
if(type == 'update'){

if(words[1] == 'client'){ // обновление клиента
bot.sendMessage(uid, 'Выполняется обновление клиента...');
downloadFile(updateURL+'/bot.js', result=>{
if(result && result.status == 200 && result.data && result.data.length > 0){
try{
fs.writeFileSync('bot.js', result.data);

bot.sendMessage(uid, 'Обновление завершено! Перезапустите бота, я отключаюсь!', {}, ()=>{
process.exit();
});

}catch(e){
bot.sendMessage(uid, 'Ошибка, не удалось сохранить файл');
}
}else{
bot.sendMessage(uid, 'Не удалось выполнить обновление, ответ сервера '+result.status+', нужно 200');
}
});
}else if(words[1] == 'module'){ // обновление модулей
if(words.length > 2){
var name = words[2].replace(/[^\w]+/, '');
if(name && name.length > 40)name = name.substr(0, 40);
bot.sendMessage(uid, 'Выполняется обновление модуля "'+name+'"...');

downloadFile(updateURL+'/modules/'+name+'.js', result=>{
if(result && result.status == 200 && result.data && result.data.length > 0){
try{
fs.writeFileSync('modules/'+name+'.js', result.data);

bot.sendMessage(uid, 'Модуль "'+name+'" обновлён! Возможно нужен перезапуск бота');

}catch(e){
bot.sendMessage(uid, 'Ошибка, не удалось сохранить файл модуля "'+name+'"');
}
}else{
var errText = 'Не удалось выполнить обновление, ответ сервера '+result.status+', нужно 200';
if(result.status == 404)errText = 'Модуль "'+name+'" не найден, убедитесь что имя модуля правильное';
bot.sendMessage(uid, errText);
}
});

}
}

}
}
}
}

module.exports = handler;