
import React from "react";

import {
  NavLink,
  Outlet,
  useNavigate,
} from "react-router-dom";

import {
  LayoutDashboard,
  ClipboardPenLine,
  ChartNoAxesCombined,
  GitCompareArrows,
  History,
  AlertTriangle,
  FileText,
  ArrowLeft,
  Leaf,
} from "lucide-react";

const BASE_PATH = "/tea-demand-forecasting";

const navItems = [
  {
    label: "Dashboard",
    path: BASE_PATH,
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: "Weekly Data Entry",
    path: `${BASE_PATH}/weekly-data`,
    icon: ClipboardPenLine,
  },
  {
    label: "Demand Forecast",
    path: `${BASE_PATH}/forecast`,
    icon: ChartNoAxesCombined,
  },
  {
    label: "Demand Forecast Comparison",
    path: `${BASE_PATH}/comparison`,
    icon: GitCompareArrows,
  },
  {
    label: "Demand Forecast History",
    path: `${BASE_PATH}/history`,
    icon: History,
  },
  {
    label: "Alerts & Recommendations",
    path: `${BASE_PATH}/alerts`,
    icon: AlertTriangle,
  },
  {
    label: "Reports",
    path: `${BASE_PATH}/reports`,
    icon: FileText,
  },
];

export default function TeaDemandForecasting() {
  const navigate = useNavigate();

  return (
    <div className="demand-app-layout">
      <aside className="demand-sidebar">
        <div className="demand-sidebar-brand">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 42,
                height: 42,
                borderRadius: 12,
                background: "rgba(255,255,255,0.12)",
              }}
            >
              <Leaf size={23} />
            </div>

            <div>
              <h2>Tea Demand</h2>
              <p>Factory Planning</p>
            </div>
          </div>
        </div>

        <nav
          className="demand-sidebar-nav"
          aria-label="Tea demand navigation"
        >
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `demand-nav-link ${
                    isActive ? "active" : ""
                  }`
                }
              >
                <Icon
                  size={19}
                  aria-hidden="true"
                />

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
            <ArrowLeft
              size={18}
              aria-hidden="true"
            />

            <span>Back to Main System</span>
          </button>
        </div>
      </aside>

      <main className="demand-main-content">
        <Outlet />
      </main>
    </div>
  );
}
