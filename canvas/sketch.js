var socket;

// 当前笔画
var current = {
    color: "#000000",
    weight:3 // 初始值要与form里面对应
};

// 获取当前用户名
var username = localStorage.getItem("username");

var pg; // 绘制画布

//鼠标
var prevCursorX = 0;// 记录鼠标按下时的初始位置
var prevCursorY = 0;
var isDragging = false; // 标志位，指示是否正在拖动白板
var offsetX = 0; // 记录鼠标按下时的横向偏移量
var offsetY = 0; // 记录鼠标按下时的纵向偏移量

// 设置绘画模式，默认自由画笔
var drawMode = "line";

function setDrawMode(mode) {
    drawMode = mode;
}

// 定义矩形类
class Rectangle{
    constructor(x, y, color,strokeWeight) {
        this.x = x;
        this.y = y;
        this.width = 0;
        this.height = 0;
        this.color = color;
        this.strokeWeight = strokeWeight;
        this.isActive = false;// 是否激活
    }
    // 更新矩形的大小
    updateSize(x, y) {
        this.width = x;
        this.height = y;
    }
    // 显示矩形
    display() {
        noFill();// 填充颜色,不填充为noFill 注意大小写
        stroke(this.color);// 边框颜色 stroke
        strokeWeight(this.strokeWeight);// 边框线宽
        rect(this.x, this.y, this.width, this.height);
    }
    // 检测是否被选中
    isHit(x0, y0) {
        var { x, y, width, height, strokeWeight} = this;
        // 矩形四条边的线段，端点在中心
        var segments = [
            [x, y, x + width, y],
            [x + width, y, x + width, y + height],
            [x + width, y + height, x, y + height],
            [x, y + height, x, y]
        ];
        for (let i = 0; i < segments.length; i++){
            var segment = segments[i];
            if (
                checkIsAtSegment(x0, y0, segment[0], segment[1], segment[2], segment[3], strokeWeight)
            ) {
                return true;
            }
        }
        return false;
    }
    // 设置矩形为激活状态
    setActive() {
        this.isActive = true;
    }

    // 取消激活状态
    deactive() {
        this.isActive = false;
    }
    // 渲染激活态
    render() {
        if (this.isActive) {
            noFill();
            // 设置原矩形激活后的样式
            //stroke(255, 0, 0);
            //strokeWeight(this.strokeWeight);
            //rect(this.x, this.y, this.width, this.height);
            // 为了不和矩形重叠，虚线框比矩形大一圈
            stroke(255, 0, 0);
            strokeWeight(2);
            let x = this.x - this.strokeWeight / 2 - 5;
            let y = this.y - this.strokeWeight / 2 - 5;
            // this.strokeWeight是一个字符串数据，需要用js的方法parseFloat转换为Number数据否则出现运算错误
            let width = this.width  + parseFloat(this.strokeWeight) + 10;
            let height = this.height  + parseFloat(this.strokeWeight) + 10;
            // 主体的虚线框
            // 在p5.js中可以用drawingContexe调用原生HTML5 canvas功能
            // 使用save把当前的状态推入栈中
            drawingContext.save();
            // 设置虚线
            drawingContext.setLineDash([5, 10]);
            // 从栈中取出最顶部的状态
            rect(x, y, width, height);
            drawingContext.restore();
            // 左上角的操作手柄
            rect(x - 10, y - 10, 10, 10);
            // 右上角的操作手柄
            rect(x + width, y - 10, 10, 10);
            // 右下角的操作手柄
            rect(x + width, y + height, 10, 10);
            // 左下角的操作手柄
            rect(x - 10, y + height, 10, 10);
            // 旋转操作手柄
            //drawCircle(x + width / 2, y - 10, 10);
        } 
    }
}

var rectangles = [];// 用于存储创建的所有矩形
var currentRectangle = null;// 当前正在创建的矩形
//var allElements = [];// 用于存储创建的所有图形
var selectedRectangle = null;// 存储当前被选中的矩形
//var drawingRect = false; // 标记是否正在绘制矩形

// 监听宽度滑动条
var weightSlider = document.getElementById("weight-slider");
weightSlider.addEventListener("change", changeWeight, false);

function changeWeight(e) {
    current.weight = e.target.value;
}

function changeColor(color) {
    current.color = `${color}`;
}

// 只执行一次 p5.js自带
function setup() {
    createCanvas(windowWidth, windowHeight).style("display", "block");
    frameRate(60);// 设置帧率
    //background(130, 200, 200);//背景颜色rgb,不要设置到draw否则画不了线
    pg = createGraphics(windowWidth, windowHeight);
    pg.background(130, 200, 200);//灰度，三个值rgb，引号#十六进制

    // 创建一个连接到服务器，指定使用websocket传输
    socket = io.connect("http://127.0.0.1:5500", { transports: ["websocket"] });
       
    // 监听服务器组创建成功消息
    socket.on("groupCreated", (data) => {
        alert(`组 ${data.groupId} 创建成功！`);
        groupId = data.groupId;
        isAdmin = true;
        document.getElementById('groupSelection').style.display = 'none';
        document.getElementById('whiteboardContainer').style.display = 'block';
    });

    // 监听服务器组加入成功消息
    socket.on("groupJoined", (data) => {
        alert(`成功加入组 ${data.groupId}`);
        groupId = data.groupId;
        isAdmin = data.isAdmin;
        updateGroupInfo(data.members, data.admin);
        document.getElementById('groupSelection').style.display = 'none';
        document.getElementById('whiteboardContainer').style.display = 'block';
    });

    // 监听新用户加入组信息
    socket.on('newMember', (data) => {
        showNotification(`用户 ${data.username} 加入了组`);
        updateGroupInfo(data.members, data.admin);
    });

    // 更新组信息
    function updateGroupInfo(members, admin) {
        const groupInfo = document.getElementById("groupInfo");
        groupInfo.innerHTML = "";
        for (const member in members) {
            const li = document.createElement("li");
            li.textContent = `${member} ${admin === member ? '(管理员)' : ''}`;
            groupInfo.appendChild(li);
        }
    }
    
    // 升起消息提醒窗口
    function showNotification(message) {
        const notification = document.createElement("div");
        notification.classList.add("notification");
        notification.textContent = message;
        document.getElementById("notifications").appendChild(notification);
        setTimeout(() => {
            notification.classList.add("show");
        }, 500); // 过渡时间

        setTimeout(() => {
            notification.classList.remove("show");
            setTimeout(() => {
                notification.remove();
            }, 1000); // 等待时间
        }, 5000); // 通知显示持续时间
    }

    // 监听服务器自由画笔事件
    socket.on("drawing", (data) => {
        //画线之前改变颜色与线宽
        pg.stroke(data.color);
        pg.strokeWeight(data.weight);
        //不要调用drawLine以免重复传递数据到服务器
        pg.line(data.x0 * width, data.y0 * height, data.x1 * width, data.y1 * height);

        // 显示用户名
        /*pg.textAlign(CENTER, BOTTOM);
        pg.textSize(8);
        pg.stroke(130, 200, 200);
        pg.strokeWeight(0);
        pg.fill("#000000");
        pg.text(data.username, data.x1 * width, data.y1 * height);*/
    });

    // 监听服务器绘制矩形事件
    socket.on("drawingRectangle", (data) => {
        // 本地染色
        pg.noFill();
        pg.stroke(data.color);
        pg.strokeWeight(data.weight);
        pg.rect(data.x * width, data.y * height, data.width * width, data.height * height);
    });

    // 监听服务器清屏事件
    socket.on("clearCanvas", () => {
        pg = createGraphics(windowWidth, windowHeight);
        pg.background(130, 200, 200);
        image(pg, 0, 0);
        // 清空自己存储的元素
        rectangles = [];
    })
}

// 自动绘制,循环执行 p5.js自带
function draw() {
    /*// 如果鼠标右键按下并移动，更新偏移量
    if (mouseIsPressed && mouseButton === RIGHT) {
        cursor('grab');
        offsetX -= mouseX - pmouseX;
        offsetY -= mouseY - pmouseY;
        //pg = createGraphics(windowWidth + Math.abs(offsetX), windowHeight + Math.abs(offsetY));
    }
        
    // 使用translate来模拟无限画布效果，要放在绘制所有元素之前
    translate(offsetX, offsetY);*/

    image(pg, 0, 0);// 绘制graphics

    // 显示所有的矩形,遍历数组
    for (var rect of rectangles) {
        rect.display(rect.x, rect.y);
        rect.render(); // 渲染激活状态
    }

    // 显示当前正在绘制的矩形
    if (currentRectangle) {
        currentRectangle.display(startX, startY);
        currentRectangle.render(); // 渲染激活状态
    }
}


// 改变窗口大小时重新画画布 p5.js自带
function windowResized() {
    //防止缩小画布内容消失，增加一个判断
    if (windowWidth > width || windowHeight > height) {
        resizeCanvas(windowWidth, windowHeight);
        var oldPg = pg;
        pg = createGraphics(windowWidth, windowHeight);
        pg.background(130, 200, 200);
        pg.image(oldPg, 0, 0);
    }
}

// 显示组内信息
function showGroupInfo() {
    document.getElementById('groupUsers').style.display = 'block';
}

// 隐藏组内信息
function hideGroupInfo() {
    document.getElementById('groupUsers').style.display = 'none';
}

// 切换组
function showGroupSwitch() {
    document.getElementById('groupSwitch').style.display = 'block';
}

// 加入新组
function joinNewGroup() {
    const newGroupId = document.getElementById('newGroupId').value;
    if (newGroupId) {
        socket.emit('joinGroup', { username: 'currentUserName', groupId: newGroupId });
    }
}

// 清屏
function clearCanvas(){
    pg = createGraphics(windowWidth, windowHeight);
    pg.background(130, 200, 200);
    // 发送清屏消息给服务器
    socket.emit("clearCanvas", {
        username: username,
        groupId: groupId
    });
}

// 自己写一个函数来画线段,实现自由画笔
function drawLine(x0, y0, x1, y1) {
    pg.stroke(current.color);
    pg.strokeWeight(current.weight);
    pg.line(x0, y0, x1, y1);

    // 自己绘画的数据传递到服务器，但不要把服务器的绘画数据传播出去
    socket.emit("mouse", {
        // 保证不会因用户分辨率和屏幕比例不同导致显示错误
        // 百分比位置显示，解决方法可以不同，width，height来自p5.js
        x0: x0 / width,
        y0: y0 / height,
        x1: x1 / width,
        y1: y1 / height,
        color: current.color,
        weight: current.weight,
        username: username,
        groupId: groupId
    });
}

// 检测是否选中了元素
function checkIsHitElement(x, y) {
    var hitElement = null;
    // 从后往前遍历元素，默认认为新的元素在更上层
    for (let i = rectangles.length - 1; i >= 0; i--){
        if (rectangles[i].isHit(x, y)) {
            hitElement = rectangles[i];
            break;
        }
    }
    // 取消之前激活的矩形
    for (let rect of rectangles) {
        rect.deactive();
    }
    if (!hitElement) {
        // 如果没有点击到矩形，取消所有的激活状态
        for (let rect of rectangles) {
            rect.deactive();
        }
    }
    else if (hitElement) {
        hitElement.setActive(); // 激活选中的矩形
        selectedRectangle = hitElement;// 设置选中的矩形
    }else{
        //selectedRectangle = null;// 如果没有点击到矩形，取消选中的矩形
    }
}

// 阻止默认右键行为
document.addEventListener('contextmenu', function (event) {
    event.preventDefault();
});

// 按下鼠标逻辑
function mousePressed(e) {   
    if (mouseButton === LEFT) {
        if (drawMode === "select") {
            // 选择模式
            checkIsHitElement(mouseX, mouseY);
        }
        else if (drawMode === "line") {
            // 绘制线段
            cursor(CROSS);// 设置指针样式
            current.x = mouseX;
            current.y = mouseY;
        }
        else if (drawMode === "rect") {
            if (e.target.tagName === "CANVAS"){
                // 记录矩形的初始位置
                startX = mouseX;
                startY = mouseY;
                // 创建新的矩形类，并将其添加进数组中
                currentRectangle = new Rectangle(startX, startY, current.color, current.weight);
            }
        }
        else if (drawMode === "circle") {
            // 创建圆形
            if (e.target.tagName === "CANVAS") {
                pg.fill(130, 200, 200);
                pg.strokeWeight(current.weight);
                pg.stroke(current.color);
                pg.circle(mouseX, mouseY, 60);
            }
        }
        else if (drawMode === "triangle") {
            // 创建三角形
            if (e.target.tagName === "CANVAS") {
                pg.fill(130, 200, 200);
                pg.strokeWeight(current.weight);
                pg.stroke(current.color);
                pg.triangle(mouseX, mouseY, mouseX + 30, mouseY + 60, mouseX - 30, mouseY + 60);
            }
        }
    } else if (mouseButton === RIGHT) {
        // 在这添加按下鼠标右键后逻辑
    }
}

// 在鼠标抬起时停止绘画
function mouseReleased() {
    if (drawMode === "rect") {
        // 结束当前正在绘制的矩形，并将其添加到数组中
        if (currentRectangle) {
            rectangles.push(currentRectangle);
            currentRectangle = null;
            // 传递矩形数据到服务器
            // 保证不会因用户分辨率和屏幕比例不同导致显示错误
            socket.emit("rectangle", {
                x: startX / width,
                y: startY / height,
                width: (mouseX - startX) / width,
                height: (mouseY - startY) / height,
                color: current.color,
                weight: current.weight,
                username: username,
                groupId: groupId
            });
        }
    }
    // 鼠标松开后，将当前正在创建的矩形清空
    currentRectangle = null;
    if (drawMode === "circle") {
        // 传递圆形数据给服务器
        socket.emit("circle", {
            x: mouseX / width,
            y: mouseY / height,
            diameter: 30,
            color: current.color,
            weight: current.weight
        });
    }
    // 清除指针样式
    cursor();
}

// 按下鼠标开始绘制,每次鼠标移动及滑鼠键正被按下的时候被调用
function mouseDragged(e) {
    if (mouseButton === LEFT) {
        // 判断事件e发生在画布上，才进行绘制
        if (e.target.tagName === "CANVAS") {
            if (drawMode === "line") {
                // 绘制线段
                drawLine(current.x, current.y, mouseX - offsetX, mouseY - offsetY);
                current.x = mouseX - offsetX;
                current.y = mouseY - offsetY;
            }
            else if (drawMode === "rect") {
                // 更新正在绘制的矩形的大小
                if (currentRectangle) {
                    currentRectangle.updateSize(mouseX - startX, mouseY - startY);
                }
            }
            else if (drawMode === "select") {
                // 如果有激活状态的矩形，进行缩放或拉伸
                if (selectedRectangle && selectedRectangle.isActive) {
                    // 检测是否点击到了缩放句柄
                    if (
                        mouseX > selectedRectangle.x + selectedRectangle.width - 10 &&
                        mouseX < selectedRectangle.x + selectedRectangle.width + 10 &&
                        mouseY > selectedRectangle.y + selectedRectangle.height - 10 &&
                        mouseY < selectedRectangle.y + selectedRectangle.height + 10
                    ) {
                        // 缩放矩形
                        selectedRectangle.updateSize(mouseX - selectedRectangle.x, mouseY - selectedRectangle.y);
                    } else {
                        // 移动矩形
                        selectedRectangle.updateSize(mouseX - selectedRectangle.x, mouseY - selectedRectangle.y);
                    }
                }
            }
        }
    }
}

// 触摸画布的时候不触发默认事件
document.addEventListener("touchmove", function (e) {
    if(e.target.tagName === "CANVAS")
    e.preventDefault();
}, { passive: false });