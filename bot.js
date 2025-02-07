const {Socket} = require('net');
const NetCmd = {FRIEND:1, MSG:2, MSG_BINARY:3};
const numBytes = 4+4+1+1+4;
const LogColorsObj = {pink:'\x1b[1;35m', green:'\x1b[1;32m', 'yellow':'\x1b[1;33m'};
var botInstanceID = 1;

function getCurrentTime(){
var date = new Date();
return [date.getHours(), date.getMinutes(), date.getSeconds()].map(v=>{return v<10 ? '0'+v : v}).join(':');
}

function log(){
console.log(...[getCurrentTime(), ...arguments]);
}

function logColor(colorType, ...args){
if(colorType && colorType in LogColorsObj){
console.log(LogColorsObj[colorType], getCurrentTime(), ...args, '\x1b[0m');
}else log(...args);
}

function editJsonStr(s){
if(s){
// заменяем символы чтобы они не обрабатывались в терминале, некоторые символы относятся к управляющим, и если особый символ попадает в терминал - можно вызвать звуковой сигнал...
s=s.replace(/[\u0800-\uFFFF]/g, (chr)=>'\\u'+('0000'+chr.charCodeAt(0).toString(16)).substr(-4));
}
return s;
}

function emptyCB(error){}

function cryptBuffer(client,buf){
if(buf && client.signBuffer){
var len=client.signBuffer.length;
for (var i = 0; i < buf.length; i++)buf[i]^=client.signBuffer[i%len];
}
}

function genCallbackID(client){
var v=0;
do{
v=10+Math.floor(Math.random()*1000000);
}while(client.callbacks[v]);
return v;
}

function sendPacket(client,packetid,type,data,cb){
if(!cb)cb=emptyCB;
if(client.client){
var len=(data) ? data.length : 0;
var buf=Buffer.alloc(numBytes+len);
buf.writeUInt32LE(len);
buf.writeInt32LE(packetid,4);
buf.writeUInt8(type,8);
if(data){
cryptBuffer(client,data);
data.copy(buf,numBytes);
}
client.client.write(buf,cb);
}
}

function sendData(client,packetid,o,cb){
if(o){
var str=JSON.stringify(o);
if(str){
var buf=Buffer.from(str);
var isGenID=packetid==0;
var packid=isGenID ? genCallbackID(client) : packetid;

if(isGenID){
var obj={o:o,ts:Date.now()};
if(typeof cb=='function')obj.cb=cb;
client.callbacks[packid]=obj;
}

sendPacket(client,packid,NetCmd.MSG,buf);
if(client.isLog)log('[botid '+client.getBotID()+']','[packet '+packid+']','[send] ->',editJsonStr(str));
}
}
}

function sendBinaryData(client,o,data,cb){
if(!o)o={};
if(data && data instanceof Buffer){
var str=JSON.stringify(o);
var bufStr=Buffer.from(str);

var buf1=Buffer.alloc(4);
buf1.writeInt32LE(bufStr.length);

var buf=Buffer.concat([buf1,bufStr,data]);

var packid=genCallbackID(client);
var obj={o:o,ts:Date.now()};
if(typeof cb=='function')obj.cb=cb;
client.callbacks[packid]=obj;

sendPacket(client,packid,NetCmd.MSG_BINARY,buf);
if(client.isLog)log('[botid '+client.getBotID()+']','[packet binary '+packid+']','[send] ->',editJsonStr(str),data,'['+data.length+' bytes]');
}
}


async function readBuffer(socket, data, cb){
var checkFlag=false;
var chunkInfo=socket.chunkInfo;
chunkInfo.buffer=Buffer.concat([chunkInfo.buffer, data]);

do{
checkFlag=false;
var cmdType=chunkInfo.cmdType;
if(chunkInfo.messageSize==0 && chunkInfo.buffer.length>=numBytes){
chunkInfo.messageSize=chunkInfo.buffer.readInt32LE(0);
chunkInfo.packetID=chunkInfo.buffer.readInt32LE(4);
chunkInfo.cmdType=cmdType=chunkInfo.buffer.readUInt8(8);
}

if(chunkInfo.messageSize>0 && chunkInfo.buffer.length>=chunkInfo.messageSize+numBytes){
var buffer=chunkInfo.buffer.subarray(numBytes,chunkInfo.messageSize+numBytes);
if(cmdType==NetCmd.FRIEND){
if(buffer && buffer.length>0)socket.signBuffer=buffer;
log('[uniqid '+socket.uniqid+']','сервер ->','давай!');
log('[uniqid '+socket.uniqid+']','клиент ->','передаю токен.');

socket.isLog=false;
sendData(socket,0,{cmd:'auth',token:socket.token});
socket.isLog=true;
}else{
cryptBuffer(socket,buffer);
}

var packid=chunkInfo.packetID;

chunkInfo.messageSize=0;
chunkInfo.cmdType=0;
chunkInfo.packetID=0;
chunkInfo.buffer=chunkInfo.buffer.slice(buffer.length+numBytes);

checkFlag=chunkInfo.buffer.length>0;

if(cmdType==NetCmd.MSG){
var obj=null;
try{
obj=JSON.parse(buffer.toString());
}catch(e){
}

if(obj){
var nm='data';
var isEvent=false;
var resObj=obj;
if(obj.event && obj.data){
isEvent=true;
nm=obj.event;
}
if(obj.event=='data' && resObj.data)resObj=resObj.data;

if(obj.event=='error'){
var err=(obj.data) ? editJsonStr(JSON.stringify(obj.data)) : null;
var eventType=(obj.data) ? obj.data.type : null;
if(typeof eventType=='string' && eventType in socket.eventsObj)socket.eventsObj[eventType](obj.data);
if(socket.isLog){
logColor('pink','[packet '+packid+']','[error] ->',err);
}
resObj={error:obj.data};
}else if(obj.cmd=='auth' && obj.data){
resObj=null;
socket.botInfo=obj.data.bot;
if(cb)cb(socket.botInfo);
//resObj=obj.data;
}else{
if(isEvent)obj=obj.data;
if(socket.isLog){
var clr='';
if(nm=='error')clr='pink';

logColor(clr, '[botid '+socket.getBotID()+']','[packet '+packid+']','['+nm+'] ->',editJsonStr(JSON.stringify(obj)));
}
}

if(packid in socket.callbacks){
var cbObj=socket.callbacks[packid];
delete socket.callbacks[packid];
if(resObj && cbObj.cb)cbObj.cb(resObj);
}

if(isEvent){
var isEmpty=true;
var cbObj2=null;
var msg=obj.msg;
var msgOrig=msg;
var userObj=obj.user;
var stopCmd=false;
var spl=null;
if(msg && userObj){
spl=msg.split(' ');
var cmdName=spl.shift();

if('message' in socket.eventsObj){
var res2=socket.eventsObj.message(userObj,msg);
if(typeof res2=='boolean' && !res2){
// если обработчик возвращает false, останавливаем остальные обработчики команд. Это для особых случаев, например если нужно сделать чс в боте, тогда дублировать код для чс в каждую команду не нужно
stopCmd=true;
}
}

if(!stopCmd){

if(msg in socket.cmdsObj)cbObj2=socket.cmdsObj[msg];

if(!cbObj2){
var msgLower=msg.toLowerCase();
if(msgLower in socket.cmdsObj)cbObj2=socket.cmdsObj[msgLower];
}

if(!cbObj2){
if(cmdName){
cmdName=cmdName.toLowerCase();
msg=spl.join(' ');
if(cmdName in socket.cmdsObj)cbObj2=socket.cmdsObj[cmdName];
}
}

if(!cbObj2){
if('' in socket.cmdsObj){
spl=msgOrig.split(' ');
cbObj2=socket.cmdsObj[''];
}
}

}

if(cbObj2){
if(!spl)spl=[];
var res=cbObj2.cb(userObj,spl);
if(res){
if(typeof res=='object' && res instanceof Promise)res=await res;
var propsV=null;
var typeV=null;
if(typeof res=='object'){
propsV=res;
if(res.type){
typeV=res.type;
delete res.type;
}
if(typeV=='message')typeV=null;
if(!typeV && res && res.msg)res=res.msg;
}else if(typeof res=='number')res=''+res;

if(typeof res!='undefined'){
isEmpty=false;
if(typeof res=='string'){
sendData(socket,packid,{...propsV,cmd:'message',userid:userObj.id,msg:res});
}
}
}
}

if(isEmpty)sendData(socket,packid,{cmd:'ok'});

}
}

}

}else if(cmdType==NetCmd.MSG_BINARY){
var objData=null;
var binData=null;
try{
var strSize=buffer.readUInt32LE(0);
if(strSize>0){
var pos2=4+strSize;
var buffer2=buffer.subarray(4,pos2);
objData=JSON.parse(buffer2.toString());
if(pos2<buffer.length)binData=buffer.subarray(pos2);
}
}catch(e){
}

if(binData && objData && objData.user){
if(socket.isLog)log('[botid '+socket.getBotID()+']','[packet binary '+packid+']','[data] ->',editJsonStr(JSON.stringify(objData)),binData,'['+binData.length+' bytes]');
if('file' in socket.eventsObj)socket.eventsObj.file(objData,binData);
}

}

}
}while(checkFlag);
}


class Bot{

constructor(token){
if(typeof token=='undefined' && process.argv.length>2)token=process.argv[2];
this.uniqid = botInstanceID++;
this.chunkInfo={messageSize:0, cmdType:0, packetID:0, buffer:Buffer.alloc(0)};
Object.assign(this, {client:null, botInfo:null, isLog:true, isConnected:false, token:token, connectHost:'ag6.ru', connectPort:8000, reconnect:false, callbacks:{}, eventsObj:{}, cmdsObj:{}});
if(process.argv.length>3 && process.argv[3]=='local')this.connectHost='127.0.0.1';
this.log=log;
}

getBotID(){
return (this.botInfo) ? this.botInfo.id : 0;
}

event(type, cb){
if(type && typeof cb=='function')this.eventsObj[type]=cb;
}

cmd(name, cb){
this.on(name, cb);
}

on(name, cb){
if(typeof cb=='function')this.cmdsObj[name]={cb:cb};
}

off(name, cb){
if(name && cb){
var v=this.cmdsObj[name];
if(v && v.cb==cb)delete this.cmdsObj[name];
}
}

api(method, props, cb){
if(this.client){
if(!props)props={};
var obj={...props,method:method,cmd:'api'};
if(typeof cb == 'function')sendData(this,0,obj,cb);
else return new Promise(resolve=>sendData(this,0,obj,resolve));
}
}

sendGift(userid, itemid, cb){
return this.api('bot.sendGift',{userid:userid,itemid:itemid},cb);
}

sendMessage(userid, msg, props, cb){
if(!props)props={};
var obj={...props,cmd:'message',userid:userid,msg:msg};
if(typeof cb == 'function')sendData(this,0,obj,cb);
else return new Promise(resolve=>sendData(this,0,obj,resolve));
}

sendFile(userid, info, data, cb){
if(!info)info={};
var obj={...info,userid:userid};
if(data && data instanceof Buffer){
if(typeof cb == 'function')sendBinaryData(this,obj,data,cb);
else return new Promise(resolve=>sendBinaryData(this,obj,data,resolve));
}
}

run(cb){
var th=this;
if(th.client)return;
var sock=new Socket();
sock.on('error', (e)=>{});
sock.on('close', ()=>{
var txt='ошибка подключения';
if(th.isConnected)txt='соединение закрыто';
if(th.isConnected){
logColor('yellow','[botid '+th.getBotID()+']', txt);
}else{
log('[botid '+th.getBotID()+']', txt);
}
th.isConnected=false;
if(th.reconnect){
setTimeout(()=>{
th.client=null;
th.run(cb);
}, 5000);
}
});
sock.on('data', data=>readBuffer(th,data,cb));

log('[uniqid '+th.uniqid+']','клиент ->','подключение к серверу...');

sock.connect(th.connectPort,th.connectHost,()=>{
th.isConnected=true;
log('[uniqid '+th.uniqid+']','клиент ->','сервер, давай дружить?');
sendPacket(th,0,NetCmd.FRIEND);
});
th.client=sock;
}

reset(){
this.cmdsObj={};
this.eventsObj={};
}

}

module.exports={Bot, log, logColor};