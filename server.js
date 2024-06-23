const http = require("http");
//在SocketIO文档中，要使用express应用程序设置SocketIO*/
const express = require("express");
const path = require("path")
const socketIO = require("socket.io");
const cors = require("cors");
const bcrypt = require("bcrypt");
const fs = require("fs");

// 用户认证与数据库相关
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const jwt = require("jsonwebtoken");
const tedious = require("tedious");// 连接数据库，也可用mssql模块
//const Connection = require("tedious").Connection;
const { Connection, Request } = tedious;

// 创建Express应用程序
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// 使用CORS中间件,允许所有域名请求
app.use(cors());

// 处理请求之前设置CORS头信息,允许什么可以访问服务器
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Request-Methods", "GET, POST, HEAD");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
})

// 使用 Express 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 使用body-parser中间件
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const host = process.env.HOST || "localhost";
const PORT = process.env.PORT || 5500;
// 启动服务器
server.listen(PORT,() => {
    console.log(`服务器运行，监听端口 ${PORT}`);
});

// 根路径路由处理程序
app.get("/", (req, res) =>{
    res.sendFile(__dirname + "/register/register.html");
});

// 若使用express.static提供静态文件服务,express会自动找到index.html,然后是其他html
app.use(express.static(path.join(__dirname, "/register")));

app.get("/canvas/style.css", (req, res) => {
    const filePath = path.join(__dirname, "canvas", "style.css"); // 根据实际路径修改
    // 读取并发送样式表文件
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.status(500).send("服务器错误");
            return;
        }
        // 设置合适的 Content-Type 头并发送文件
        res.setHeader("Content-Type", "text/css");
        res.send(data);
    });
});

app.get("/canvas/:filename", (req, res) => {
    const filename = req.params.filename; // 获取请求的文件名
    const filePath = path.join(__dirname, "canvas", filename); // 构建文件的完整路径
    console.log(filePath);
    const headers = req.headers;
    const token = headers["authorization"].split(' ')[1];
    if (!token) return res.status(401).json({ message: "未提供token" });
    // 通过流将文件发送给客户端
    const stream = fs.createReadStream(filePath);
    stream.on("error", (err) => {
        res.status(500).send("服务器错误");
        return;
    });

    // 设置合适的 Content-Type 头并发送文件
    res.setHeader("Content-Type", getContentType(filePath));
    stream.pipe(res);
});

app.get("/:filename", (req, res) => {
    const filename = req.params.filename; // 获取请求的文件名
    const filePath = path.join(__dirname, "/", filename); // 构建文件的完整路径
    console.log(filePath);
    const headers = req.headers;
    const token = headers["authorization"].split(' ')[1];
    if (!token) return res.status(401).json({ message: "未提供token" });
    // 通过流将文件发送给客户端
    const stream = fs.createReadStream(filePath);
    stream.on("error", (err) => {
        res.status(500).send("服务器错误");
        return;
    });

    // 设置合适的 Content-Type 头并发送文件
    res.setHeader("Content-Type", getContentType(filePath));
    stream.pipe(res);
});

// 根据文件扩展名获取合适的 Content-Type
function getContentType(filePath) {
    const extname = path.extname(filePath);
    switch (extname) {
        case ".html":
            return "text/html";
        case ".js":
            return "text/javascript";
        case ".css":
            return "text/css";
        // 添加其他需要的 Content-Type
        default:
            return "text/plain";
    }
}

// 设置jwt密钥
const secretKey = "canvas";

// 连接到 SQL Server 数据库,配置数据库连接选项
const config = {
    server: "",
    authentication: {
        type: "default",
        options: {
            userName: "sa",
            password: "",
        },
    },
    options: {
        database: "Canvas",
        encrypt: true,// 是否SSL加密
        trustServerCertificate: true // 信任自签名证书
    },
};

// 创建连接对象
const connection = new Connection(config);
// 打开连接
connection.on("connect", (err) => {
    if (err) {
        console.error("连接到 SQL Server 数据库时发生错误:", err);
    } else {
        console.log("已成功连接到 SQL Server 数据库");
        //executeStatement(); //可以设置初始执行语句
    }
});
// 连接到数据库，勿忘！
connection.connect();

// 创建数组，用于存储绘制的元素
var lines = [];
var rectangles = [];

// 储存所有共享组信息
var groups = {};

// 处理连接事件
io.sockets.on("connection", socket => {
    console.log("有新的用户连接:" + socket.id);

    // 创建组事件
    socket.on("createGroup", data => {
        const { username,token, groupId } = data;
        if (!groups[groupId]) {
            groups[groupId] = {
                admin: username,
                members: { [username]: true },
                lines: [],
                rectangles: []
            };
            socket.join(groupId);
            socket.emit("groupCreated", { groupId });
            console.log(`用户 ${username} 创建了组 ${groupId}`);
        } else {
            socket.emit("error", { message: "组ID已经存在" });
        }
        console.log(groups);
    });

    // 加入组事件
    socket.on("joinGroup", (data) => {
        const { username, token, groupId } = data;
        if (groups[groupId]) {
            socket.join(groupId);
            groups[groupId].members[username] = false; // 默认非管理员
            socket.emit("groupJoined", { groupId, isAdmin: groups[groupId].admin === username, members: groups[groupId].members, admin: groups[groupId].admin });
            // 通知组内所有用户有新成员加入
            io.to(groupId).emit("newMember", { username, members: groups[groupId].members, admin: groups[groupId].admin });
            // 发送存储在组中的所有绘图元素给新用户
            groups[groupId].lines.forEach(line => socket.emit("drawing", line));
            groups[groupId].rectangles.forEach(rect => socket.emit("drawingRectangle", rect));
            console.log(`用户 ${username} 加入了组 ${groupId}`);
        } else {
            socket.emit("error", { message: "组ID不存在" });
        }
        console.log(groups);
    });

    lines.forEach(data => {
        // 根据实际事件名称发送元素数据
        socket.emit("drawing", data);
    });

    // 发送存储的所有矩形元素给新用户
    rectangles.forEach(data => {
        // 根据实际事件名称发送元素数据
        socket.emit("drawingRectangle", data);
    });

    //当用户传递信息，执行：
    socket.on("mouse", data => {
        const { groupId } = data;
        if (groups[groupId]) {
            groups[groupId].lines.push(data);
            socket.to(groupId).emit("drawing", data);
        }
    });

    // 处理绘制矩形事件
    socket.on("rectangle", data => {
        const { groupId } = data;
        if (groups[groupId]) {
            groups[groupId].rectangles.push(data);
            socket.to(groupId).emit("drawingRectangle", data);
        }
    });

    socket.on("circle", data => {
        socket.broadcast.emit("drawingCircle", data);
    });
    
    // 清屏事件
    socket.on("clearCanvas", data => {
        const { groupId, username } = data;
        if (groups[groupId] && groups[groupId].admin === username) {
            groups[groupId].lines = [];
            groups[groupId].rectangles = [];
            io.to(groupId).emit("clearCanvas");
        } else {
            socket.emit("error", { message: "未授权操作或组不存在" });
        }
    })

    // 处理断开连接事件
    socket.on("disconnect", () => {
        console.log("用户断开连接");
        let userGroup = null;
        let username = null;

        for (let groupId in groups) {
            for (let user in groups[groupId].members) {
                if (user === socket.id) {
                    userGroup = groupId;
                    username = user;
                    break;
                }
            }
            if (userGroup) break;
        }

        if (userGroup && username) {
            if (groups[userGroup].admin === username) {
                io.in(userGroup).emit("adminDisconnected", { username, message: "管理员已离线" });
            } else {
                delete groups[userGroup].members[username];
                io.in(userGroup).emit("memberDisconnected", { username, members: groups[userGroup].members });
            }
        }
        console.log(`用户 ${username} 断开连接，并从组 ${userGroup} 中移除`);
    });
    
});

// 注册接口
app.post("/api/register", async (req, res) => {
    // 将密码哈希化
    const { username, password: plainTextPassword, repeatPassword} = req.body;
    const password = await bcrypt.hashSync(plainTextPassword, 10);

    // 检查用户名和密码是否有效
    if (!username || typeof username !== "string") {
        return res.json({ status: "error", error: "用户名输入不规范" })
    }

    if (!password || typeof plainTextPassword !== "string") {
        return res.json({ status: "error", error: "密码字符不规范" })
    }

    if (plainTextPassword.length < 3) {
        return res.json({ status: "error", error: "密码不得小于三位" })
    }

    if (plainTextPassword !== repeatPassword ) {
        return res.json({ status: "error", error: "密码确认错误" })
    }

    try {
        // 在数据库中创建新用户
        const query = `insert into Users (username, password) values ('${username}', '${password}')`;
        const request = new Request(query, (err) => {
            if (err) {
                console.error("在数据库中创建新用户时发生错误:", err.message);
                return res.status(500).json({ status: "error", error: "用户名已存在" });
            } else {
                res.status(201).json({ status: "ok", message: "用户注册成功" });
            }
        });
        connection.execSql(request);
    } catch (error) {
        // 处理错误消息并返回给客户端
        console.log("发生错误:", error);
        res.status(400).json({ status: "error",  error });
    }
});

// 登录接口
app.post("/api/login", async (req, res) => {
    try {
        const { username: plainTextUsername, password: plainTextPassword } = req.body;
        // 在此处验证用户密码是否匹配数据库中的记录
        const query = `select password from Users where username = '${plainTextUsername}'`
        const request = new Request(query, (err, rowCount) => {
            if (err) {
                return res.status(500).json({ status: "error", error: "数据库查询错误" });
            }
            if (rowCount === 0) {
                return res.status(401).json({ status: "error", error: "用户名或密码不正确" });
            }
        });
        connection.execSql(request);

        // 处理查询结果
        request.on('row', (columns) => {
            const password = columns[0].value;
            // 验证密码
            bcrypt.compare(plainTextPassword, password, (err, isMatch) => {
                if (err) {
                    return res.status(500).json({ status: "error", error: "验证失败" });
                }
                if (isMatch) {
                    // 生成token
                    const token = jwt.sign({
                        username: plainTextUsername
                    },
                        secretKey,
                        { expiresIn: "300s" }
                    );
                    return res.json({ status: "ok", token: token, username: plainTextUsername });
                } else {
                    return res.json({ status: "error", error: "用户名或密码不正确" });
                }
            });
        });
    }catch (error) {
        // 处理错误消息并返回给客户端
        console.log("发生错误:", error);
        res.status(400).json({ status: "error", message: error });
    }
});

// 登录后验证token
app.post("/api/afterlogin", (req, res) => {
    const headers = req.headers;
    const token = headers["authorization"].split(' ')[1];
    console.log(token)
    jwt.verify(token, secretKey, (err, payload) => {
        if (err) res.sendStatus(403);
        res.json({ message: "认证成功", payload });
    })
});
