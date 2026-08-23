import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Leaf } from "lucide-react";
import teabg from "../../assets/tea images/tea-bg.webp";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();

    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }

    navigate("/home");
  };

  return (
    <div
      className="auth-page"
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url(${teabg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="auth-card glass-card">
        <div className="logo-circle">
          <Leaf size={30} />
        </div>

        <h2>Login</h2>
        <p className="auth-subtitle">Tea Factory Management System</p>

        <form onSubmit={handleLogin} className="auth-form">
          <div>
            <label>Email Address</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="primary-btn">
            Login
          </button>
        </form>

        <p className="auth-footer">
          Don’t have an account? <Link to="/signin">Sign In</Link>
        </p>
      </div>
    </div>
  );
}