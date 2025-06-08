export default class AuthView {
  constructor() {
    this.loginButton = document.querySelector(".login-button");
    this.textkonfirmasiLogin = document.querySelector(".text-konfirmasi");
    this.registerButton = document.querySelector(".register-button");
    this.textkonfirmasiRegister = document.querySelector(".notif-regis");
  }

  bindLoginForm(submitHandler) {
    const form = document.querySelector(".login-input-form");
    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        const email = document.querySelector("#email").value;
        const password = document.querySelector("#password").value;
        submitHandler(email, password);
      });
    }
  }

  bindRegisterForm(submitHandler) {
    const form = document.querySelector(".register-input-form");
    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        const name = document.querySelector("#name").value;
        const email = document.querySelector("#email").value;
        const password = document.querySelector("#password").value;
        submitHandler(name, email, password);
      });
    }
  }

  showConfirmation(type = "register") {
    if (
      type === "register" &&
      this.textkonfirmasiRegister &&
      this.registerButton
    ) {
      this.textkonfirmasiRegister.style.display = "block";
      this.registerButton.style.display = "none";
    } else if (type === "login" && this.textkonfirmasiLogin) {
      this.textkonfirmasiLogin.style.display = "block";
    }
  }

  hideConfirmation(type = "register") {
    if (
      type === "register" &&
      this.textkonfirmasiRegister &&
      this.registerButton
    ) {
      this.textkonfirmasiRegister.style.display = "none";
      this.registerButton.style.display = "inline-block";
    } else if (type === "login" && this.textkonfirmasiLogin) {
      this.textkonfirmasiLogin.style.display = "none";
    }
  }

  redirectToLogin() {
    location.replace("#/login");
  }

  redirectToApp() {
    location.replace("/index.html");
  }
}
