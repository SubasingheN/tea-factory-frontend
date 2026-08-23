import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import LoginPage from "./pages/auth/LoginPage";
import SignInPage from "./pages/auth/SignInPage";

import HomePage from "./pages/dashboard/HomePage";

import TeaQuantityPrediction from "./pages/quantity/TeaQuantityPrediction";
import TeaDemandForecasting from "./pages/demand/TeaDemandForecasting";
import TeaLeavesGrading from "./pages/grading/TeaLeavesGrading";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/home" element={<HomePage />} />

        <Route
          path="/tea-quantity-prediction"
          element={<TeaQuantityPrediction />}
        />

        <Route
          path="/tea-demand-forecasting"
          element={<TeaDemandForecasting />}
        />

        <Route
          path="/tea-leaves-grading"
          element={<TeaLeavesGrading />}
        />
      </Routes>
    </Router>
  );
}

export default App;