export default class AuthPresenter {
  constructor(view, model) {
    this.view = view;
    this.model = model;
    this.view.bindLoginForm(this.handleLogin.bind(this));
    this.view.bindRegisterForm(this.handleRegister.bind(this));
  }

  async handleLogin(email, password) {
    this.view.showConfirmation("login");
    try {
      const response = await this.model.login(email, password);

      if (
        response &&
        !response.error &&
        response.loginResult &&
        response.loginResult.token
      ) {
        localStorage.setItem("token", response.loginResult.token);

        this.view.redirectToApp();
      } else {
        const errorMessage =
          response && response.message
            ? response.message
            : "Unknown login error. Please check your credentials.";
        console.error("Login failed in Presenter:", errorMessage);
      }
    } catch (error) {
      console.error("Critical error during login:", error);
    } finally {
      this.view.hideConfirmation("login");
    }
  }

  async handleRegister(name, email, password) {
    this.view.showConfirmation("register");
    try {
      const response = await this.model.register(name, email, password);

      if (response && !response.error) {
        this.view.redirectToLogin();
      } else {
        const errorMessage =
          response && response.message
            ? response.message
            : "Unknown registration error. Please try again.";
        console.error("Error registering in Presenter:", errorMessage);
      }
    } catch (error) {
      console.error("Critical error during registration:", error);
    } finally {
      this.view.hideConfirmation("register");
    }
  }
}
