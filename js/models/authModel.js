export default class AuthModel {
  static async login(email, password) {
    try {
      const response = await fetch("https://story-api.dicoding.dev/v1/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || "Invalid email or password");
      }

      return responseData;
    } catch (error) {
      console.error("Login failed in Model:", error.message);

      return {
        error: true,
        message: error.message || "Login failed due to an unexpected error.",
      };
    }
  }

  static async register(name, email, password) {
    try {
      const response = await fetch(
        "https://story-api.dicoding.dev/v1/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(
          responseData.message ||
            "Registration failed. Please check your input."
        );
      }

      return responseData;
    } catch (error) {
      console.error("Registration failed in Model:", error.message);

      return {
        error: true,
        message:
          error.message || "Registration failed due to an unexpected error.",
      };
    }
  }
}
