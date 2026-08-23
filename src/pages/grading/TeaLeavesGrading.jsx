import React from "react";
import { useNavigate } from "react-router-dom";

export default function TeaLeavesGrading() {
  const navigate = useNavigate();

  return (
    <div className="module-page">
      <div className="module-page-card">
        <h2>Tea Leaves Grading</h2>
        <p>
          This page is for grading tea leaves using image processing
          and machine learning classification.
        </p>

        <div className="info-box">
          <h3>Current Scope</h3>
          <ul>
            <li>Tea leaf image upload</li>
            <li>Feature extraction and classification</li>
            <li>Quality grade prediction</li>
          </ul>
        </div>

        <button className="primary-btn" onClick={() => navigate("/home")}>
          Back to Home
        </button>
      </div>
    </div>
  );
}