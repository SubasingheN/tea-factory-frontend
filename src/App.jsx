
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
import TeaLeavesGrading from "./pages/grading/TeaLeavesGrading";

import TeaDemandForecasting from "./pages/demand/TeaDemandForecasting";
import DemandHome from "./pages/demand/DemandHome";
import WeeklyDataEntry from "./pages/demand/WeeklyDataEntry";
import DemandForecast from "./pages/demand/DemandForecast";
import ResearchTFTForecast from "./pages/demand/ResearchTFTForecast";
import ResearchTFTExplainability from "./pages/demand/ResearchTFTExplainability";
import DemandAlerts from "./pages/demand/DemandAlerts";
import DemandExplainability from "./pages/demand/DemandExplainability";
import DemandHistory from "./pages/demand/DemandHistory";
import DemandReports from "./pages/demand/DemandReports";

function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <Navigate to="/login" replace />
          }
        />

        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/signin"
          element={<SignInPage />}
        />

        <Route
          path="/home"
          element={<HomePage />}
        />

        <Route
          path="/tea-quantity-prediction"
          element={<TeaQuantityPrediction />}
        />

        <Route
          path="/tea-leaves-grading"
          element={<TeaLeavesGrading />}
        />

        <Route
          path="/tea-demand-forecasting"
          element={<TeaDemandForecasting />}
        >
          <Route
            index
            element={<DemandHome />}
          />

          <Route
            path="dashboard"
            element={
              <Navigate
                to="/tea-demand-forecasting"
                replace
              />
            }
          />

          <Route
            path="weekly-data"
            element={<WeeklyDataEntry />}
          />

          <Route
            path="forecast"
            element={<DemandForecast />}
          />

          <Route
            path="research-forecast"
            element={<ResearchTFTForecast />}
          />

          <Route
            path="research-explainability"
            element={<ResearchTFTExplainability />}
          />

          <Route
            path="alerts"
            element={<DemandAlerts />}
          />

          <Route
            path="explainability"
            element={<DemandExplainability />}
          />

          <Route
            path="history"
            element={<DemandHistory />}
          />

          <Route
            path="reports"
            element={<DemandReports />}
          />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
