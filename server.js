var http = require('http');
var fs = require('fs');
var path = require('path');
var mime = require('mime');

var chatServer = require('./lib/chat_server.js');

var cache = {};

//发送404错误
function send404(response){
	response.writeHead(404,{'Content-Type':'text/plain'});
	response.write('Error 404:resource not found.');
	response.end();
}

//提供文件数据服务
function sendFile(response,filePath,fileContents){
	response.writeHead(200,{'Content-Type':mime.lookup(path.basename(filePath))});//返回文件头类型
	response.end(fileContents);
}

//提供静态文件服务
function serveStatic(response,cache,absPath){
	if(cache[absPath]){
		sendFile(response,absPath,cache[absPath]);
	}else{
		fs.exists(absPath,function(exists){
			if(exists){
				fs.readFile(absPath,function(err,data){
					if(err){
						send404(response);
					}else{
						cache[absPath] = data;
						sendFile(response,absPath,cache[absPath]);
					}
				});
			}else{
				send404(response);
			}
		});
	}
}

var server = http.createServer(function(request,response){
	var filePath = false;
	if(request.url!=="/favicon.ico"){    //清除第2此访问  
		if(request.url == '/'){
			filePath = 'public/index.htm';
		}else{
			filePath = 'public'+request.url;
		}
		var absPath = './'+filePath;
		serveStatic(response,cache,absPath);
	}
}).listen(3000);

chatServer.listen(server);



