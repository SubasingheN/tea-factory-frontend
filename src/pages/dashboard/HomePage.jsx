import React from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, TrendingUp, Leaf, LayoutDashboard } from "lucide-react";

export default function HomePage() {
  const navigate = useNavigate();

  const modules = [
    {
      title: "Tea Quantity Prediction",
      description:
        "Predict total production quantity using year, month, rainfall, and humidity data.",
      icon: <BarChart3 size={28} />,
      path: "/tea-quantity-prediction",
    },
    {
      title: "Tea Demand Forecasting",
      description:
        "Forecast tea demand to support factory planning, stock control, and scheduling.",
      icon: <TrendingUp size={28} />,
      path: "/tea-demand-forecasting",
    },
    {
      title: "Tea Leaves Grading",
      description:
        "Analyze tea leaf images and classify tea quality using machine learning.",
      icon: <Leaf size={28} />,
      path: "/tea-leaves-grading",
    },
  ];

  return (
    <div className="home-page">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-title">
            <LayoutDashboard size={28} />
            <h1>Tea Factory Management System</h1>
          </div>

          <button className="secondary-btn" onClick={() => navigate("/login")}>
            Logout
          </button>
        </div>
      </header>

      <main className="home-content">
        <section className="hero-with-image">
          <div className="hero-text">
            <h2>Welcome to the Tea Factory Dashboard</h2>
            <p>
              This system integrates Tea Quantity Prediction, Tea Demand Forecasting,
              and Tea Leaves Grading into one intelligent decision-support platform.
            </p>
          </div>

          <div className="hero-image-box">
            <img src="/images/images.jpg" alt="Tea plantation" className="hero-image" />
          </div>
        </section>

        <section className="module-grid">
          {modules.map((module, index) => (
            <div key={index} className="module-card">
              <div className="module-icon">{module.icon}</div>
              <h3>{module.title}</h3>
              <p>{module.description}</p>
              <button
                className="primary-btn"
                onClick={() => navigate(module.path)}
              >
                Open Module
              </button>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}