const fs = require('fs');
const {Bot, log} = require('./bot');
const bots = [];
const isTestLocal = (process.argv.length > 2 && process.argv[2]=='testlocal') ? true : false;
const fileToken = (isTestLocal) ? 'token_testlocal.txt' : 'token.txt';

var mainFile = 'app.js'; // главный файл
var autoReconnect = false; // переподключение после потери соединения, если нужно включить измените false на true
var tokensList = [];

if(process.argv.length > 3){
var path = process.argv[3]+'.js';
if(fs.existsSync(path))mainFile = path;
}

if(fs.existsSync(fileToken)){
var cnt = fs.readFileSync(fileToken).toString();
if(cnt)tokensList = cnt.replace(/\r/g,'').split('\n').map(v=>v.trim()).filter(v=>!!v);
if(tokensList.length > 5)tokensList = tokensList.slice(0, 5);
}

tokensList.map(v=>run(v));

function reloadBot(bot){
var path = require.resolve('./'+mainFile);
if(path && path in require.cache)delete require.cache[path];
try{
var cb = require('./'+mainFile);
if(cb && typeof cb == 'function'){
if(typeof bot.reset == 'function')bot.reset();
else if(bot.cmdsObj)bot.cmdsObj = {};

try{
var botUpdateFile = 'modules/botupdate';
var path = require.resolve('./'+botUpdateFile);
if(path && path in require.cache)delete require.cache[path];
var botUpdate = require('./modules/botupdate');
bot.cmd('bot', botUpdate.bind(botUpdate, bot));
}catch(e){
}

cb(bot);
bot.isRun = true;
}
}catch(e){
log('\x1b[1;41m', 'ошибка js ', e, '\x1b[0m');
}
}

function run(token){
var findBot = bots.find(o=> token == o.token);
if(findBot){
log('\x1b[1;33m', 'бот с токеном '+token+' уже был добавлен.', '\x1b[0m');
}else{
var bot = new Bot(token);
if(autoReconnect)bot.reconnect = true;
if(isTestLocal)bot.connectHost = '127.0.0.1';
var cbClose = function(){
this.removeListener('close', cbClose);
var activeBots = bots.filter(info => info.bot.isConnected);
if(activeBots.length == 0)process.exit();
};

var _botRun = bot.run;

bot.run((info)=>{
bot.run = (cb)=>{cb(info)};
if(!bot.reconnect)bot.client.on('close', cbClose);
reloadBot(bot);
bot.run = _botRun;
});
bots.push({token, bot});
}
}


function watchFolder(path, cb){
var tm=-1;
try{
fs.watch(path, (eventType, filename)=>{
if(tm == -1){
tm = setTimeout(()=>{
tm = -1;
if(cb)cb(eventType, filename);
}, 100);
}
});
}catch(e){
}
}

watchFolder(__dirname, (eventType, filename)=>{
if(eventType == 'change' && filename == mainFile){
log('\x1b[1;32m', 'файл "'+filename+'" обновлён', '\x1b[0m');
bots.forEach(o=>reloadBot(o.bot));
}
});