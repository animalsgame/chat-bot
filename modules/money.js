// модуль для создания своей валюты + покупки, например за звёзды

// важно, в магазине не может быть много товаров, длина смс ограничена, чем короче названия товаров, тем больше поместится

// в основной файл вставьте код ниже, /* */ копировать не надо

/*
const Money = require('./modules/money');
const myMoney = new Money({name:'звёзды', icon:'*em43*', filename:'stars'});

bot.cmd(myMoney.name, myMoney.handler.bind(myMoney, bot));

// функция addItem принимает параметры, id (не должен повторяться), имя, цена, объект с id подарка, либо функция (если это не подарок)

// добавление подарка без курса валюты (в игре) будет стоить например 3 звезды, в giftid нужно указать id подарка из игры

myMoney.addItem(1, 'Подарок', 3, {giftid:1});

// добавление товара с учётом курса валюты, функция getPrice переводит игровую валюту в валюту магазина (курс тоже настраивается)

myMoney.addItem(2, 'Подарок', myMoney.getPrice(100), {giftid:1});

// добавление товара с обработкой

myMoney.addItem(10, 'Спасибо', 1, (user)=>{
bot.sendMessage(user.id, 'Спасибо, отправляю тебе смайлик *em3*');
});

*/

/*
в свойстве config хранятся настройки

myMoney.config.moneyCourse = 500; // курс валюты
myMoney.config.farm.time = 5; // сколько минут ждать до следующего фарма
myMoney.config.farm.money = 5; // сколько выдаётся валюты за фарм (минимум 1)
*/

const Storage = require('./storage');
const {checkDrug, checkAdmin, getTimeStr} = require('./utils');

class Money{

constructor(props){
this.props = props || {};
this.storage = null;
this.userPrefix = 'user_';
this.name = this.props.name;
this.filename = this.props.filename;
this.bot = null;
this.cmdsObj = {};
this.shopItems = [];
this.config = {moneyCourse:500};
this.config.farm = {time:5, money:5};
if(!this.name)throw new Error('Не указано название валюты');
if(!this.filename)throw new Error('Не указано имя файла');

var defColor = ['#f1a0b3'];

this.cmd('баланс', (user, words)=>{
if(words.length == 0){
var money = this.getMoney(user.id);
return {msg:'Баланс'+' '+this.getMoneyStr(money), color:defColor};
}
});

this.cmd('фарм', (user, words)=>{
if(words.length == 0){
var uid = user.id;
var info = this.getUserInfo(uid, true);
if(info){
var ts = Math.floor(Date.now() / 1000);
var tm = info.farmTime || 0;
if(ts<tm){
var seconds = tm - ts;
return {msg:'Нужно ещё подождать '+getTimeStr(seconds), color:defColor};
}
info.farmTime = ts + (60 * this.config.farm.time);
var rndMoney = Math.floor(Math.random() * this.config.farm.money) + 1;
var curMoney = this.plusMoney(uid, rndMoney);
this.storage.set(this.userPrefix + uid, info);
return {msg:'Получено '+this.getMoneyStr(rndMoney)+' Текущий баланс '+this.getMoneyStr(curMoney), color:defColor};
}

}
});

this.cmd('топ', (user, words)=>{
if(words.length == 0){
var maxUsers = 3;
var users = this.getTopUsers(maxUsers);
if(users.length == 0)return {msg:'Ещё никого нет в топе', color:defColor};
var arr = users.map((el, i) => (i+1)+': @id'+el.id+' -> '+this.getMoneyStr(el.money));
return {msg:'Топ '+maxUsers+':\n'+arr.join('\n'), color:['#FFFFFF']};
}
});

this.cmd('магазин', (user, words)=>{
if(words.length == 0){
var arr = this.shopItems.map(item => 'ID '+item.id+': "'+item.name+'" Цена '+item.price);
if(arr.length == 0)return {msg:'Ещё нет товаров', color:defColor};
var iconStr = this.props.icon || '';
var msg = 'Товары за '+this.name+iconStr+'\n'+arr.join('\n')+'\n';
msg += 'Для покупки "'+this.name+' магазин купить ID"';
return {msg:msg, color:defColor};
}

if(words.length > 0){
if(words[0] == 'купить'){
var itemid = 0;
var bot = this.bot;
var uid = user.id;
if(!checkDrug(bot, user))return 'Чтобы покупать товары, добавь меня в друзья';
if(words.length>1)itemid = parseInt(words[1]) || 0;
var item = this.getItem(itemid);
if(!item)return {msg:'Товар не найден', color:defColor};

// логика покупок такая
var price = item.price; // цена товара (в валюте магазина)
var money = this.getMoney(uid); // текущий баланс покупателя
if(money > 0 && price > 0 && money >= price){ // проверяем что достаточно валюты для покупки
var giftid = (item.o && 'giftid' in item.o) ? item.o.giftid : 0;
money -= price; // списываем валюту, но не обновляем в хранилище
if(typeof item.callback == 'function'){ // если товар не подарок, и имеется функция
this.updateMoney(uid, money); // обновляем валюту сразу (до вызова функции) считается что если функция вызвана, значит товар куплен, а что там будет в функции не важно, хоть текст, хоть передача файла 
item.callback(user); // вызываем функцию
}else if(giftid > 0){ // если подарок, логика чуть другая
// сначала обновляем валюту, это нужно чтобы покупатель много раз не запросил подарок, отправка запроса отнимает время, поэтому надёжней вернуть валюту если после отправки запроса произошла ошибка, например у бота недостаточно валюты для отправки подарка
this.updateMoney(uid, money); // обновляем валюту в хранилище
var s1 = 'Ваш баланс '+this.getMoneyStr(money);
bot.sendGift(uid,giftid,(res)=>{
if(res.ok){
// всё хорошо
bot.sendMessage(uid,'Вы купили "'+item.name+'". '+s1,{color:defColor});
}else{
// произошла ошибка
var errText = (res.error && res.error.msg) ? ' '+res.error.msg : '';
this.updateMoney(uid, money + price); // возвращаем валюту 
bot.sendMessage(uid,'Не удалось выдать подарок.'+errText,{color:defColor});
}
});
}
}else{
return {msg:'Недостаточно валюты для покупки', color:defColor};
}
}
}

});

}

// подсчёт цены по курсу
getPrice(v){
return Math.floor(v / this.config.moneyCourse);
}

getItem(id){
return this.shopItems.find(item => id == item.id);
}

addItem(id, name, price, o, callback){
if(o){
id = id || 0;
var callback = null;
if(typeof o == 'function'){
callback = o;
o = null;
}
var item = this.getItem(id);
if(item){
console.log('Товар с id '+id+' уже существует');
}else{
this.shopItems.push({id, name, price, o, callback});
}
}
}

cmd(name, cb){
this.cmdsObj[name] = cb;
}

getMoneyStr(v){
var iconStr = this.props.icon || '';
return v + iconStr;
}

getUserInfo(userid, isAdd){
if(this.storage){
var info = this.storage.get(this.userPrefix + userid);
if(!info && isAdd){
this.updateMoney(userid, 0);
return this.getUserInfo(userid);
}
return info;
}
return null;
}

getTopUsers(count){
var arr = [];
var data = (this.storage) ? this.storage.data : null;
if(data && typeof data == 'object'){
for(var n in data){
if(n.indexOf(this.userPrefix) == 0){
var val = data[n];
var userid = parseInt(n.substr(this.userPrefix.length)) || 0;
if(userid > 0 && val.money > 0)arr.push({id:userid, money:val.money});
}
}
}
arr.sort((a,b)=>b.money - a.money);
if(arr.length > count)arr = arr.slice(0,count);
return arr;
}

// получить валюту по id игрока
getMoney(userid){
if(this.storage){
var obj = this.storage.get(this.userPrefix + userid);
if(obj)return obj.money || 0;
}
return 0;
}

// добавить валюту по id игрока
plusMoney(userid, value){
if(value > 0){
var money = this.getMoney(userid) + value;
this.updateMoney(userid, money);
return money;
}
return 0;
}

// отнять валюту по id игрока
minusMoney(userid, value){
if(value > 0){
var money = this.getMoney(userid) - value;
this.updateMoney(userid, money);
return money;
}
return 0;
}

// сохранить валюту
updateMoney(userid, value){
if(this.storage){
var obj = this.storage.get(this.userPrefix+userid) || {};
if(!('money' in obj))obj.money = 0;
obj.money = value;
this.storage.set(this.userPrefix + userid, obj);
return true;
}
return false;
}

// обработчик
handler(bot, user, words){
var defColor = ['#f1a0b3'];
var appid = (bot.botInfo) ? bot.botInfo.app : 0;
if(words.length == 0){
var iconStr = this.props.icon || '';
//var cmds = ['баланс', 'фарм', 'топ'].map(v=>this.name+' '+v);
var cmds = Object.keys(this.cmdsObj);//.map(v=>this.name+' '+v);
return {msg:'Валюта "'+this.name+'"'+iconStr+'. Доступные команды: '+this.name+' '+cmds.join(' | '), color:defColor};
}

if(!this.storage){
var prefixFile = 'app'+appid; // префикс для имени файла, бот может работать в нескольких проектах, поэтому чтобы корректно обрабатывать сохранения нужно получить id приложения
this.storage = new Storage(prefixFile+'_'+this.filename);
}
if(!this.bot)this.bot = bot;
var uid = user.id;
var type = words[0];

if(checkAdmin(bot, user)){

if(type.length > 2 && type.substr(0,2) == 'id'){
var userid = parseInt(type.substr(2)) || 0;
if(userid>0){
var info = this.getUserInfo(userid);
var resMoney = 0;
if(words.length > 1){
var v1 = words[1];
if(v1 && v1.length > 1){
var t1 = v1.substr(0, 1);
var val = parseInt(v1.substr(1));
var isChange = false;
if(isNaN(val))return {msg:'Некорректная сумма', color:defColor};
if(val <= 0)return {msg:'Сумма должна быть больше 0', color:defColor};
if(t1 == '+'){ // добавить
resMoney = this.plusMoney(userid, val);
isChange = true;
}else if(t1 == '-'){ // отнять
resMoney = this.minusMoney(userid, val);
isChange = true;
}else if(t1 == '='){ // установить
this.updateMoney(userid, val);
resMoney = val;
isChange = true;
}

if(isChange)return {msg:'Баланс для id '+userid+' изменён, текущий баланс '+resMoney, color:defColor};
}
return;
}

if(!info)return {msg:'Игрок с id '+userid+' не найден', color:defColor};
return {msg:'Баланс @id'+userid+' '+(info.money || 0), color:defColor};
}
}

}

if(type in this.cmdsObj)return this.cmdsObj[type].call(this, user, words.slice(1));
}

}

module.exports = Money;