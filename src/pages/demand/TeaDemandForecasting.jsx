import React from "react";

import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  Home,
  Database,
  LineChart,
  AlertTriangle,
  CircleHelp,
  History,
  FileText,
  ArrowLeft,
} from "lucide-react";

export default function TeaDemandForecasting() {
  const navigate = useNavigate();
  const location = useLocation();

  const isAuctionResearch =
    location.pathname.endsWith("/auction-research");

  const navItems = [
    {
      label: "Home",
      path: "/tea-demand-forecasting",
      icon: Home,
      end: true,
    },
    {
      label: "Weekly Data Entry",
      path: "/tea-demand-forecasting/weekly-data",
      icon: Database,
    },
    {
      label: "Demand Forecast",
      path: "/tea-demand-forecasting/forecast",
      icon: LineChart,
    },
    {
      label: "Alerts & Recommendations",
      path: "/tea-demand-forecasting/alerts",
      icon: AlertTriangle,
    },
    {
      label: "Why This Forecast?",
      path: "/tea-demand-forecasting/explainability",
      icon: CircleHelp,
    },
    {
      label: "Forecast History",
      path: "/tea-demand-forecasting/history",
      icon: History,
    },
    {
      label: "Reports",
      path: "/tea-demand-forecasting/reports",
      icon: FileText,
    },
    {
      label: "Auction Research",
      path: "/tea-demand-forecasting/auction-research",
      icon: LineChart,
    },
  ];

  return (
    <div className="demand-app-layout">
      <aside className="demand-sidebar">
        <div className="demand-sidebar-brand">
          <h2>Tea Demand</h2>
          <p>Forecasting System</p>
        </div>

        <nav className="demand-sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `demand-nav-link ${isActive ? "active" : ""}`
                }
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="demand-sidebar-bottom">
          <button
            type="button"
            className="demand-back-btn"
            onClick={() => navigate("/home")}
          >
            <ArrowLeft size={18} />
            <span>Back to Main System</span>
          </button>
        </div>
      </aside>

      <main className="demand-main-content">
        {!isAuctionResearch && (
          <div className="demand-research-notice" role="status">
            <strong>Research prototype</strong>
            <span>
              Five-grade forecasts use a model trained on generated data.
              Accuracy on real factory demand has not been established.
            </span>
          </div>
        )}

        <Outlet />
      </main>
    </div>
  );
}