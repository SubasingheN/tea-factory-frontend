import React from "react";
import { useNavigate } from "react-router-dom";

export default function TeaDemandForecasting() {
  const navigate = useNavigate();

  return (
    <div className="module-page">
      <div className="module-page-card">
        <h2>Tea Demand Forecasting</h2>
        <p>
          This page is for forecasting future tea demand to support
          production planning and resource allocation.
        </p>

        <div className="info-box">
          <h3>Current Scope</h3>
          <ul>
            <li>Historical demand analysis</li>
            <li>Seasonal demand forecasting</li>
            <li>Planning support for tea factory production</li>
          </ul>
        </div>

        <button className="primary-btn" onClick={() => navigate("/home")}>
          Back to Home
        </button>
      </div>
    </div>
  );
}