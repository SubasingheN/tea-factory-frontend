
import React from "react";

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// Authentication
import LoginPage from "./pages/auth/LoginPage";
import SignInPage from "./pages/auth/SignInPage";

// Main factory dashboard
import HomePage from "./pages/dashboard/HomePage";

// Other factory management components
import TeaQuantityPrediction from "./pages/quantity/TeaQuantityPrediction";
import TeaLeavesGrading from "./pages/grading/TeaLeavesGrading";

// Tea Demand Forecasting layout
import TeaDemandForecasting from "./pages/demand/TeaDemandForecasting";

// Tea Demand Forecasting operational pages
import DemandHome from "./pages/demand/DemandHome";
import WeeklyDataEntry from "./pages/demand/WeeklyDataEntry";
import DemandForecast from "./pages/demand/DemandForecast";
import DemandForecastComparison from "./pages/demand/DemandForecastComparison";
import DemandHistory from "./pages/demand/DemandHistory";
import DemandAlerts from "./pages/demand/DemandAlerts";
import DemandReports from "./pages/demand/DemandReports";

function App() {
  return (
    <Router>
      <Routes>
        {/* Default route */}
        <Route
          path="/"
          element={
            <Navigate to="/login" replace />
          }
        />

        {/* Authentication */}
        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/signin"
          element={<SignInPage />}
        />

        {/* Main Factory Management Dashboard */}
        <Route
          path="/home"
          element={<HomePage />}
        />

        {/* Tea Quantity Prediction */}
        <Route
          path="/tea-quantity-prediction"
          element={<TeaQuantityPrediction />}
        />

        {/* Smart Tea Leaf Grading */}
        <Route
          path="/tea-leaves-grading"
          element={<TeaLeavesGrading />}
        />

        {/* Tea Demand Forecasting */}
        <Route
          path="/tea-demand-forecasting"
          element={<TeaDemandForecasting />}
        >
          {/* Factory Demand Dashboard */}
          <Route
            index
            element={<DemandHome />}
          />

          {/* Dashboard Redirect */}
          <Route
            path="dashboard"
            element={
              <Navigate
                to="/tea-demand-forecasting"
                replace
              />
            }
          />

          {/* Weekly Factory Data Entry */}
          <Route
            path="weekly-data"
            element={<WeeklyDataEntry />}
          />

          {/* Four-Week Demand Forecast */}
          <Route
            path="forecast"
            element={<DemandForecast />}
          />

          {/* Demand Forecast Comparison */}
          <Route
            path="comparison"
            element={<DemandForecastComparison />}
          />

          {/* Redirect Previous Weekly History Route */}
          <Route
            path="weekly-history"
            element={
              <Navigate
                to="/tea-demand-forecasting/comparison"
                replace
              />
            }
          />

          {/* Demand Forecast History */}
          <Route
            path="history"
            element={<DemandHistory />}
          />

          {/* Operational Alerts and Recommendations */}
          <Route
            path="alerts"
            element={<DemandAlerts />}
          />

          {/* Factory Demand Reports */}
          <Route
            path="reports"
            element={<DemandReports />}
          />
        </Route>

        {/* Unknown Routes */}
        <Route
          path="*"
          element={
            <Navigate to="/login" replace />
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
