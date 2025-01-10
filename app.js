// функция нужна чтобы легко можно было выбирать случайный элемент из массива
Array.prototype.random=function(){
return this[Math.floor(Math.random() * this.length)];
};

// функция возвращает случайное число в диапазоне от min до max, например 10,20 вернёт число от 10 до 20 (включительно)
function randomMinMax(min, max){
return Math.round(min + (max - min) * Math.random());
}

// текущее время (timestamp) в секундах (начиная с 1 января 1970 года)
function time(){
return Math.floor(Date.now() / 1000);
}

const fs=require('fs'); // для работы с файловой системой
const {Bot, log} = require('./bot'); // сам бот
var bot=new Bot();
var adminCmds={};

// является ли отправитель другом, без добавления в друзья бот не может дарить подарки, отправлять сообщения в любое время
function checkDrug(user){
if(bot.botInfo){
if(user.id==bot.botInfo.owner || user.botDrug)return true;
}
return false;
}

// проверка прав админа (владелец бота)
function checkAdmin(user){
var adminIds=[]; // если нужно выдать права админа, укажите список id игроков через запятую, но будьте осторожны, получив управление - игроки смогут менять ник, инфу о себе, и даже кикнуть бота

// проверяем id отправителя с id владельца бота (свойство owner в объекте botInfo)
if(bot.botInfo && user.id==bot.botInfo.owner)return true;

// если не нашли, проверяем id из списка
if(adminIds.indexOf(user.id)>-1)return true;

// если не нашли, значит точно отправитель без прав админа, возвращаем false
return false;
}

// теперь с поддержкой пробелов в команде
function cmdWord(name,value,props){
if(!props)props={};
if(name && value){
var len=name.split(' ').length-1;
bot.cmd(name,(user,words)=>{
if(len>0)words.splice(0,len);
if(words.length==0)return {...props,msg:value,type:'message'};
});
}
}

function addAdminCmd(name, method){
adminCmds[name]={type:'api', v:method};
}

addAdminCmd('ник', 'bot.nickChange');
addAdminCmd('цвет', 'bot.nickColorChange');
addAdminCmd('пол', 'bot.polChange');
addAdminCmd('осебе', 'bot.textInfoChange');
addAdminCmd('друзья','bot.friends');


// добавляем команды которые обрабатывают одно слово, например если ввести пинг, бот отправит ПОНГ, третий параметр это свойства, туда можно передать цвет сообщения

var mainProps={color:['#FFFFFF']}; // FFFFFF в hex формате это белый цвет (255 255 255) 

cmdWord('как дела', 'Хорошо*em3*', mainProps);
cmdWord('пинг', 'ПОНГ', mainProps);
cmdWord('кинг', 'КОНГ', mainProps);
cmdWord('кошка', 'МЫШКА', {color:['#f1a0b3', '#FFFF00']}); // пусть текст МЫШКА будет цветным

// запуск бота
bot.run((info)=>{
// когда авторизация прошла успешно, в info будет передан объект бота, и можно уже начинать работать!
log('бот', info);

// отправляем сообщение владельцу что бот в сети. Владельца мы знаем, в объекте бота есть свойство owner, это и есть id владельца, но можно ввести другой id игрока, если бот в друзьях то сообщение дойдёт!
bot.sendMessage(info.owner, 'Мой владелец, я в сети*em3*', {color:['#f1a0b3', '#FFFF00', '#54EFF7']});
});

// Команды

// когда игрок открыл приват с ботом, это может быть первый раз, а может закрыл приват и открыл опять, но это обычный текст, поэтому игрок может отправить эту команду сам
bot.cmd('/start',(user,words)=>{
if(words.length==0)return {msg:'Привет '+user.nick+'*em3*', color:['#f1a0b3']};
});

bot.cmd('бот',(user,words)=>{

if(words.length==0){ // если только команда бот (и нет больше слов в массиве words)
return {msg:'На месте*em1*', color:['#f1a0b3']};
}

if(checkAdmin(user)){ // если отправитель владелец бота (админ) то разрешаем управление ботом
if(words && words.length>0){
var cmd=words.shift();
var val=words.join(' ');
if(cmd=='кик' && words.length==0){ // кикнуть бота, после выполнения соединение с ботом закрывается
var tm=-1;
var cbExit=()=>{
if(tm!=-1)clearTimeout(tm);
process.exit();
};
tm=setTimeout(cbExit,3000);
bot.sendMessage(user.id,'Пока!',{color:'#FFFFFF'},cbExit);
return true;
}

if(cmd && cmd in adminCmds){
var cmdInfo=adminCmds[cmd];
var methodApi=(cmdInfo.type=='api') ? cmdInfo.v : null;
if(methodApi){
// если найдена админ команда, обращаемся к api
bot.api(methodApi,{v:val},(res)=>{
//console.log('api result',res);
var msgTxt=null;
if(res && res.error && res.error.msg){ // если произошла ошибка и есть текст ошибки, то выбираем его
msgTxt=res.error.msg;
}
else if(res && res.msg){ // если не ошибка, и есть какой-то текст, выбираем его
msgTxt=res.msg;
}
if(cmd=='друзья'){ // если команда друзья (это список id игроков кто добавил бота в друзья) для удобства массив переводим в строку (текст) через .join
if(res && Array.isArray(res)){
if(res.length>0)msgTxt='Всего '+res.length+' - '+res.join(',');
else msgTxt='Нет друзей';
}
}
if(msgTxt){ // если есть текст (может это ошибка от api, а может информация) отправляем этот текст 
bot.sendMessage(user.id, msgTxt, {color:'#FFFFFF'});
}
});
}
return true;
}
}
}
});

bot.cmd('данет',(user,words)=>{
if(words.length>0){
var rnd=Math.random(); // выдаёт случайное число от 0 до 0.99
var txt=words.join(' ');
var v='да'; // по умолчанию "да"
if(rnd>0.5)v='нет'; // если число больше 0.5 тогда будет "нет"
if(rnd>0.9)v='не знаю'; // если число больше 0.9 (оно выпадает не часто) тогда будет "не знаю"
return '"'+txt+'" ('+v+')';
}
});

bot.cmd('выбери',(user,words)=>{
var txt=words.join(' '); // переводим все слова из массива в строку
var spl=txt.split(' или '); // разделяем через " или " например апельсин или яблоко, пробелы обязательно, иначе команда будет работать подругому, вместо "или" может быть любое слово, например гав, тогда логика команды поменяется, нужно будет писать выбери апельсин гав яблоко
if(spl.length>1){ // если в массиве после разделения больше одного слова, тогда можно отправлять результат
return 'Я выбираю: '+spl.random();
}
});

bot.cmd('скажи',(user,words)=>{
var txt=words.join(' '); // переводим все слова из массива в строку
if(txt){
var colorsArr=[ ['#f1a0b3', '#FFFF00'], ['#FFFFFF', '#54EFF7'] ]; // массив, в котором хранятся цвета тоже в виде массива
var color=colorsArr.random(); // выбираем случайный массив
// и отправляем этот же текст, только уже делаем его цветным
return {color:color, msg:txt};
}
});

bot.cmd('рандом',(user,words)=>{
var n1=0;
var n2=0;
if(words.length>0){
if(words.length>1){ // если передано больше 1 числа (от-до)
n1=parseInt(words[0]) || 0;
n2=parseInt(words[1]) || 0;
}else{ // если только одно число
n2=parseInt(words[0]) || 0;
}
if(n1!=n2 && n2>n1){ // если число n1 не равно n2 И ЕСЛИ (&&) второе число больше первого, тогда генерируем случайное число от n1 до n2
return randomMinMax(n1,n2);
}
}
});

// маленький калькулятор, просто складывает два числа, например "плюс 1 3" = 4
bot.cmd('плюс',(user,words)=>{
var a=parseInt(words[0]) || 0;
var b=parseInt(words[1]) || 0;
var result=a+b;
return 'ответ: '+result;
});

// отправка сообщения игрокам, список получателей через запятую разделяется. Пример команды "напиши 1,10 Привет" будет отправлено сообщение "Привет" игроку с id 1 и id 10
bot.cmd('напиши',(user,words)=>{
if(checkAdmin(user)){ // команда только для владельца
if(words.length==0)return;
var idsStr=words.shift(); // получаем список id
var friendsIds=idsStr.split(',').map(Number).filter(id=>!isNaN(id));
var msg=words.join(' ');
if(msg && friendsIds.length>0){
// обращаемся к api чтобы получить список друзей бота
bot.api('bot.friends',{},(friendsData)=>{
if(friendsData.error){
if(friendsData.error.msg)bot.sendMessage(user.id,friendsData.error.msg,{});
}else if(Array.isArray(friendsData)){
friendsIds=friendsIds.filter(id=>friendsData.includes(id) || id==bot.botInfo.owner); // возвращаем новый массив, и убираем из списка тех кого не нашли в друзьях
if(friendsIds.length>0){
// отправляем сообщение
bot.sendMessage(friendsIds,msg,{color:['#f1a0b3', '#FFFF00']},(res)=>{
// проверяем статус доставки сообщения
if(res.error && res.error.msg){ // если произошла ошибка
bot.sendMessage(user.id,res.error.msg,{}); 
}else if(res.status && Array.isArray(res.status)){ // есть статус, значит можно проверять доставлено сообщение или нет
friendsIds=friendsIds.map((item,index)=>(res.status[index]==1) ? item : undefined);
bot.sendMessage(user.id,'Сообщение для ID ['+friendsIds.join(',')+'] доставлено!');
}
});
}else{
bot.sendMessage(user.id,'Нет таких игроков в друзьях у меня.');
}
}
});
}
}
});

bot.cmd('магия',(user,words)=>{
if(words.length==0){
var polStr='женский';
if(user.pol=='м')polStr='мужской';
else if(user.pol=='н')polStr='нло';

var rolesObj={ml_mod:'младший мч', ml_modmaps:'младший мк', mod:'старший мч', modmaps:'старший мк', admin:'админ'};

var rolesArr=[]; // список ролей (должности)
if(user.roles){
for (var i = 0; i < user.roles.length; i++) {
var role=user.roles[i];
if(role && role in rolesObj){
var roleName=rolesObj[role]; // если должность найдена, добавляем в список
rolesArr.push(roleName);
}
}
}

var arr=[
'твой id: '+user.id,
'ник: '+user.nick,
'пол: '+polStr,
'опыт: '+user.opyt,
'уровень: '+user.level,
'уровень популярности: '+user.popularLevel
];

if(rolesArr.length>0){ // если есть хоть одна должность
arr.push('есть должности: '+rolesArr.join(', '));
}

var msg='Вижу вижу... '+arr.join(', ')+'.';

if(user.botDrug){ // если отправитель в друзьях, добавляем ещё такой текст
msg+=' А ещё ты мой друг!';
}

return {msg:msg, color:['#ffdf52', '#FD92FE', '#54EFF7', '#68ff5d']};
}
});

var giftsQueryUsers={}; // здесь храним запросы (от каждого игрока) на получение подарков, нам достаточно только хранить время, чтобы не смогли взять много раз подарок

bot.cmd('хочу подарок',(user,words)=>{
if(checkDrug(user)){
var userid=user.id;
var ts=time(); // текущее время (в секундах)
var timeMinutes=[3,4,5]; // сколько минут будет ждать игрок до следующего подарка
var waitTime=60 * timeMinutes.random(); // в минуте 60 секунд, поэтому 60 умножаем на количество минут
var endTime=giftsQueryUsers[userid] || 0; // проверяем, было обращение от такого игрока (или нет) если да значит получим время когда можно брать следующий подарок, иначе 0 (если 0 тогда тоже разрешит брать подарок, так как текущее время будет больше 0)
if(ts>endTime){ // можно брать подарок
giftsQueryUsers[userid]=ts+waitTime; // берём текущее время и прибавляем время ожидания (сколько будет ждать игрок до следующего подарка)

var ids=[1,4]; // список id подарков, id можно получить в игре (в окне выбора подарка) id нужен чтобы бот мог отправить подарок!

var itemid=ids.random(); // берём случайный id подарка

// отправляем подарок!
bot.sendGift(userid,itemid,(res)=>{
if(res.error){
if(res.error.msg){ // если произошла ошибка и есть текст ошибки (например недостаточно валюты) то отправляем этот текст
bot.sendMessage(userid,res.error.msg,{});
}
}else if(res.ok){ // если всё хорошо
bot.sendMessage(userid,'Держи!',{color:'#FFFFFF'});
}
});
}else{ // если ещё не пришло время получения подарка
var seconds=endTime-ts; // берём время окончания и текущее время, и получаем уже секунды
var minuts=Math.floor(seconds/60); // получаем минуты, секунды делим на 60 (в минуте 60 секунд)
seconds-=minuts*60; // отнимаем кол-во минут, чтобы было корректное значение для секунд

var arr=[];
if(minuts>0)arr.push(minuts+' мин.');
if(seconds>0)arr.push(seconds+' сек.');

var msgsArr=['Я тоже хочу!', 'Хотеть не вредно.'];
var msg=msgsArr.random(); // берём случайный текст из массива
msg+=' Нужно ещё подождать ';
msg+=arr.join(' ');
return {msg:msg, color:['#FFFFFF']};
}
}else{
// если бот не в друзьях у получателя
return {msg:'Я не могу дать подарок, добавь меня в друзья!', color:['#f1a0b3', '#FFFF00']};
}
});

// Обработка событий

// бот может принимать файлы, обработать получение можно в событии file, в этом примере полученный файл сохраняем в папке где и запущен бот, только немного меняем название файла (вместе с файлом приходит объект отправителя где можно узнать id игрока) этот id и берём, так мы будем знать от кого пришёл файл. Обработка файлов теперь по умолчанию отключена, уберите /* */ чтобы включить

/*
bot.event('file',(o,data)=>{
var userid=o.user.id;
var nm='user_'+userid+'_'+o.name;
var rr=/[\/\?<>\\:\*\|"]/g; // запрещённые символы убираем из имени файла (в windows, и не только) иначе файл не сохранится
nm=nm.replace(rr,'');
try{
fs.writeFileSync(nm, data); // сохраняем файл
}catch(e){
// если произошла ошибка
}
});
*/

// если нужно сделать историю сообщений (все сообщения которые пишут боту можно получить в событии message) уберите /* */ ниже, и как только появится сообщение, оно будет добавлено в файл messages.txt (файл будет в папке откуда вы запустили бота)

/*
bot.event('message',(user,text)=>{
try{
fs.appendFileSync('messages.txt', 'id '+user.id+' ('+user.nick+') -> '+text+'\r\n');
}catch(e){
}
});
*/

// ещё один пример, только не запись в файл, а перенаправление сообщений - владельцу, уберите /* */ ниже

/*
bot.event('message',(user,text)=>{
var ownerid=bot.botInfo.owner; // id владельца бота
if(user.id!=ownerid){ // чтобы сообщения владельца игнорировать, а то бот будет писать владельцу то что пишет владелец...
bot.sendMessage(ownerid, 'id '+user.id+' ('+user.nick+') -> '+text, {color:['#FFFFFF']});
}
});
*/