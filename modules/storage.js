// модуль для хранения данных (хранилище)

/*
const Storage = require('./modules/storage');
var storage = new Storage('my_storage');
storage.set('test', 1);
var result = storage.get('test');
*/

const fs = require('fs');

class Storage{

constructor(filename){
if(!filename)throw new Error('Не указано имя файла');
this.filename = filename;
this.fileExt = 'txt';
this.filePath = this.filename+'.'+this.fileExt;
this.saveTimer = -1;
this.saveInterval = 3; // через сколько секунд сохраняются данные (чтобы не мучать жёсткий диск каждый раз)
this.data = {};
this.reload();
}

get(key){
return this.data[key];
}

set(key, value){
if(typeof value!='function'){
this.data[key] = value;
this.checkSave();
}
}

reload(){
try{
this.data = JSON.parse(fs.readFileSync(this.filePath).toString());
}catch(e){
}
}

checkSave(){
var th = this;
if(th.saveInterval > 0){
if(th.saveTimer == -1){
th.saveTimer = setTimeout(()=>{
th.saveTimer = -1;
var isSave = th.save();
if(!isSave)th.checkSave();
}, th.saveInterval * 1000);
}
}else{
th.save();
}
}

save(){
try{
fs.writeFileSync(this.filePath, JSON.stringify(this.data));
return true;
}catch(e){
}
return false;
}

}

module.exports = Storage;