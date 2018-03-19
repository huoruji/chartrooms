var socketio = require('socket.io');

var io;
var guestNumber = 1;
var nickNames = {};
var nameUsed = [];
var currentRoom = {};

exports.listen = function(server){
	//启动socketio服务器
	io = socketio.listen(server);

	io.set('log level',1);

	io.sockets.on('connection',function(socket){
		//在用户连接上来时赋予其一个访客名
		guestNumber = assignGuestName(socket,guestNumber,nickNames,nameUsed);

		//在用户连接上来时把他放入聊天室Lobby
		joinRoom(socket,'Lobby');

		//处理用户的消息,更名，以及聊天室的创建和变更
		handleMessageBroadcasting(socket,nickNames);

		handleNameChangeAttempts(socket,nickNames,nameUsed);

		handleRoomJoining(socket);

		socket.on('rooms',function(){
			//用户发出请求时，向其提供以及被占用的聊天室的列表
			socket.emit('rooms',io.sockets.manager.rooms);
		});

		//定义用户断开连接后的清除逻辑
		handleClientDisconnection(socket,nickNames,nameUsed);
	});

	//分配访客名称
	function assignGuestName(socket,guestNumber,nickNames,nameUsed){
		var name = 'Guest'+guestNumber;//生成新的昵称
		nickNames[socket.id] = name;
		socket.emit('nameResult',{//让用户知道他们的昵称
			success:true,
			name:name
		});
		nameUsed.push(name);//存放已经被占用的昵称
		return guestNumber +1;//增加用来生成昵称的计数器
	}

	//进入聊天室
	function joinRoom(socket,room){
		socket.join(room);//让用户进入房间
		currentRoom[socket.id] = room;//记录用户当前所处的房间
		socket.emit('joinResult',{room,room});//让用户知道让他们进入了新的房间
		socket.broadcast.to(room).emit('message',{//让房间里的其他用户知道有新用户进入了房间
			text:nickNames[socket.id] +' has joined '+ room+'.'
		});

		var userInRoom = io.sockets.clients(room);//确定有哪些用户在这个房间
		if(userInRoom.length>1){
			var usersInRoomSummary = 'Users currently in '+room+':';
			for (var index in userInRoom) {
				var userSocketId = userInRoom[index].id;
				if(userSocketId!=socket.id){
					if(index>0){
						usersInRoomSummary +=',';
					}
				}
				usersInRoomSummary += nickNames[userSocketId] + ' ';
			}
		}
		usersInRoomSummary += '.';
		socket.emit('message',{text:usersInRoomSummary});//将房间里其他用户的汇总发送给用户
	}

	//更名请求处理逻辑
	function handleNameChangeAttempts(socket,nickNames,nameUsed){
		socket.on('nameAttempt',function(name){
			if(name.indexOf('Guest')==0){//不能将昵称改为Guest开头
				socket.emit('nameResult',{
					success:false,
					message:'Names cannot begine with "Guest".'
				});
			}else{
				if(nameUsed.indexOf(name)==0){//如果昵称被占用
					socket.emit('nameResult',{
						success:false,
						message:'That name is already in use.'
					});
				}else{
					var previousName = nickNames[socket.id];
					var previousNameIndex = nameUsed.indexOf(previousName);
					nameUsed.push(name);
					delete nameUsed[previousNameIndex];
					nickNames[socket.id] = name;
					socket.emit('nameResult',{
						success:true,
						name:name
					});

					socket.broadcast.to(currentRoom[socket.id]).emit('message',{
						message: previousName + 'is now know as '+name+'.'
					});
				}
			}
		});
	}

	//发送聊天消息
	function handleMessageBroadcasting(socket){
		socket.on('message',function(message){
			socket.broadcast.to(message.room).emit('message',{
				text:nickNames[socket.id] +':'+message.text
			});
		});
	} 

	//创建房间
	function handleRoomJoining(socket){
		socket.on('join',function(room){
			socket.leave(currentRoom[socket.id]);
			joinRoom(socket,room.newRoom);
		});
	}

	//用户断开连接
	function handleClientDisconnection(socket){
		socket.on('disconnect',function(){
			var nameIndex = nameUsed.indexOf(nickNames[socket.id]);
			delete nameUsed[nameIndex];
			delete nickNames[socket.id];
		});
	}

}