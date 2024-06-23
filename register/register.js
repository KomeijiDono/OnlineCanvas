const regform = document.getElementById("register-form");
regform.addEventListener("submit", checkForm);
async function checkForm(event) {
    // 注册表单提交事件处理   
    event.preventDefault();
    const username = document.getElementById("registerUserName").value;
    const password = document.getElementById("registerPassword").value;
    const repeatPassword = document.getElementById("repeatPassword").value;
        
    const result = await fetch("/api/register",{
        method: "POST",
        headers:{
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username,
            password,
            repeatPassword
        })
    }).then((res) => res.json())    
        
    if (result.status === "ok") {
        // 在这里可以处理注册成功后的逻辑
        document.getElementById("registerSuccessMessage").innerText = "注册成功!";
        // 清空注册失败消息
        document.getElementById("registerErrorMessage").innerText = "";
    } else {
        // 在注册失败时显示错误消息
        document.getElementById("registerErrorMessage").innerText = result.error;
        // 清空注册成功消息
        document.getElementById("registerSuccessMessage").innerText = "";
        //alert("注册失败", result.error);
    }
};

// 切换登录和注册表单的显示
function toggleForms() {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    if (loginForm.style.display === "none") {
        loginForm.style.display = "block";
        registerForm.style.display = "none";
    } else {
        loginForm.style.display = "none";
        registerForm.style.display = "block";
    }
}
