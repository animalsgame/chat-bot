const {Socket} = require('net');
const NetCmd={FRIEND:1,MSG:2,MSG_BINARY:3};
const numBytes=4+4+1+1+4;

function getCurrentTime(){
var date=new Date();
var strhour=date.getHours();
var strmin=date.getMinutes();
var strsec=date.getSeconds();
if(date.getHours()<10)strhour='0'+date.getHours();
if(date.getMinutes()<10)strmin='0'+date.getMinutes();
if(date.getSeconds()<10)strsec='0'+date.getSeconds();
return [strhour,strmin,strsec].join(':');
}

function log(){
console.log(...[getCurrentTime(), ...arguments]);
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
if(client.isLog)log('[packet '+packid+']','[send] ->',str);
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
if(client.isLog)log('[packet binary '+packid+']','[send] ->',str,data,'['+data.length+' bytes]');
}
}


function readBuffer(socket, data, cb){
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
log('сервер ->','давай!');
log('клиент ->','передаю токен.');

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
var err=(obj.data) ? JSON.stringify(obj.data) : null;
var eventType=(obj.data) ? obj.data.type : null;
if(typeof eventType=='string' && eventType in socket.eventsObj)socket.eventsObj[eventType](obj.data);
log('[packet '+packid+']','[error] ->',err);
resObj={error:obj.data};
}else if(obj.cmd=='auth' && obj.data){
resObj=null;
socket.botInfo=obj.data.bot;
if(cb)cb(socket.botInfo);
//resObj=obj.data;
}else{
if(isEvent)obj=obj.data;
if(socket.isLog)log('[packet '+packid+']','['+nm+'] ->',JSON.stringify(obj));
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
var spl=null;
if(msg && userObj){
spl=msg.split(' ');
var cmdName=spl.shift();

if('message' in socket.eventsObj)socket.eventsObj.message(userObj,msg);

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

if(cbObj2){
if(!spl)spl=[];
var res=cbObj2.cb(userObj,spl);
if(res){
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
if(socket.isLog)log('[packet binary '+packid+']','[data] ->',JSON.stringify(objData),binData,'['+binData.length+' bytes]');
if('file' in socket.eventsObj)socket.eventsObj.file(objData,binData);
}

}

}
}while(checkFlag);
}


class Client{

constructor(token){
if(typeof token=='undefined' && process.argv.length>2)token=process.argv[2];
this.client=null;
this.botInfo=null;
this.isLog=true;
this.isConnected=false;
this.token=token;
this.connectHost='ag6.ru';
this.connectPort=8000;
this.reconnect=false;
this.chunkInfo={messageSize:0, cmdType:0, packetID:0, buffer:Buffer.alloc(0)};
this.callbacks={};
this.eventsObj={};
this.cmdsObj={};
if(process.argv.length>3 && process.argv[3]=='local')this.connectHost='127.0.0.1';
this.log=log;
}

event(type, cb){
if(type && typeof cb=='function')this.eventsObj[type]=cb;
}

cmd(name, cb){
if(typeof cb=='function'){
this.cmdsObj[name]={cb:cb};
}
}

api(method, props, cb){
if(this.client){
if(!props)props={};
sendData(this,0,{...props,method:method,cmd:'api'},cb);
}
}

sendGift(userid, itemid, cb){
this.api('bot.sendGift',{userid:userid,itemid:itemid},cb);
}

sendMessage(userid, msg, props, cb){
if(!props)props={};
sendData(this,0,{...props,cmd:'message',userid:userid,msg:msg},cb);
}

sendFile(userid, info, data, cb){
if(!info)info={};
if(data && data instanceof Buffer){
sendBinaryData(this,{...info,userid:userid},data,cb);
}
}

sendFileName(userid, name, data, cb){
if(data && data instanceof Buffer){
sendBinaryData(this,{name:name,userid:userid},data,cb);
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
log(txt);
th.isConnected=false;
if(th.reconnect){
setTimeout(()=>{
th.client=null;
th.run(cb);
}, 5000);
}
});
sock.on('data', (data)=>{readBuffer(th,data,cb)});

log('клиент ->','подключение к серверу...');

sock.connect(th.connectPort,th.connectHost,()=>{
th.isConnected=true;
log('клиент ->','сервер, давай дружить?');
sendPacket(th,0,NetCmd.FRIEND);
});
th.client=sock;
}

}

module.exports={Bot:Client, log:log};