## 这是一个毕业设计项目，存在许多不足之处。
## 本项目是一个多人实时协作的白板系统。
### 使用方法：
1.首先在计算机上安装Node.js       Node.js官网：https://nodejs.org/zh-cn
2.克隆项目到本地
3.项目使用SQL Server数据库，请将server.js中的数据库配置修改为您的数据库配置，然后执行以下SQL语句：
```
--创建Canvas数据库
create database Canvas
--使用Canvas数据库
Use Canvas
--创建用户数据表
Create table Users(
    Id int primary key not null,
    username varchar(255) unique not null,
    password varchar(255) not null
);
```
4.在终端上输入node server.js，即可启动项目。
5.在任意浏览器上访问http://localhost:5500即可进入首页。
