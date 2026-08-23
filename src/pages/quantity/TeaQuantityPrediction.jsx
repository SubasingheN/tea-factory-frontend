import React from "react";
import { useNavigate } from "react-router-dom";

export default function TeaQuantityPrediction() {
  const navigate = useNavigate();

  return (
    <div className="module-page">
      <div className="module-page-card">
        <h2>Tea Quantity Prediction</h2>
        <p>
          This page is for predicting total production quantity using
          year, month, rainfall, and humidity.
        </p>

        <div className="info-box">
          <h3>Current Scope</h3>
          <ul>
            <li>Input: Year, Month, Rainfall, Humidity</li>
            <li>Output: Total Production Quantity</li>
            <li>Identify high-quantity and low-quantity periods</li>
          </ul>
        </div>

        <button className="primary-btn" onClick={() => navigate("/home")}>
          Back to Home
        </button>
      </div>
    </div>
  );
}