import { useState } from "react";
import "./ChatPage.css";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../store";
import { toast } from "react-toastify";
import { apiClient } from "../../lib/api-client";
import { LOGIN_ROUTE, SIGNUP_ROUTE } from "../../utils/constants";

const AuthPage = () => {
  const navigate = useNavigate();
  const { setUserInfo, setActiveIcon } = useAppStore();

  const [isLogin, setIsLogin] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.warn("Fill all fields");

    const res = await apiClient.post(
      LOGIN_ROUTE,
      { email, password },
      { withCredentials: true },
    );

    if (res.data.user.id) {
      setUserInfo(res.data.user);
      setActiveIcon("chat");
      navigate(res.data.user.profileSetup ? "/chat" : "/profile");
      toast.success("Login successful");
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!email || !password || password !== confirmPassword)
      return toast.warn("Invalid inputs");

    const res = await apiClient.post(
      SIGNUP_ROUTE,
      { email, password },
      { withCredentials: true },
    );

    if (res.status === 201) {
      setUserInfo(res.data.user);
      navigate("/profile");
      toast.success("Signup successful");
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-box">
        {/* LEFT SIDE */}
        <div className="auth-left">
          <h1>Chat App 💬</h1>
          <p>Connect. Chat. Share.</p>

          <button onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Create Account" : "Already have account?"}
          </button>
        </div>

        {/* RIGHT SIDE */}
        <div className="auth-right">
          <h2>{isLogin ? "Login" : "Sign Up"}</h2>

          <form onSubmit={isLogin ? handleLogin : handleSignup}>
            <div className="input-box">
              <input
                type="email"
                required
                onChange={(e) => setEmail(e.target.value)}
              />
              <label>Email</label>
            </div>

            <div className="input-box">
              <input
                type="password"
                required
                onChange={(e) => setPassword(e.target.value)}
              />
              <label>Password</label>
            </div>

            {!isLogin && (
              <div className="input-box">
                <input
                  type="password"
                  required
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <label>Confirm Password</label>
              </div>
            )}

            <button className="auth-btn">
              {isLogin ? "Login" : "Sign Up"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
