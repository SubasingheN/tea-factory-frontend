import React from "react";

import {
  NavLink,
  Outlet,
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
  const navigate =
    useNavigate();


  const navItems = [
    {
      label:
        "Home",

      path:
        "/tea-demand-forecasting",

      icon:
        Home,

      end:
        true,
    },

    {
      label:
        "Weekly Data Entry",

      path:
        "/tea-demand-forecasting/weekly-data",

      icon:
        Database,
    },

    {
      label:
        "Demand Forecast",

      path:
        "/tea-demand-forecasting/forecast",

      icon:
        LineChart,
    },

    {
      label:
        "Alerts & Recommendations",

      path:
        "/tea-demand-forecasting/alerts",

      icon:
        AlertTriangle,
    },

    {
      label:
        "Why This Forecast?",

      path:
        "/tea-demand-forecasting/explainability",

      icon:
        CircleHelp,
    },

    {
      label:
        "Forecast History",

      path:
        "/tea-demand-forecasting/history",

      icon:
        History,
    },

    {
      label:
        "Reports",

      path:
        "/tea-demand-forecasting/reports",

      icon:
        FileText,
    },
  ];


  return (
    <div className="demand-app-layout">

      <aside className="demand-sidebar">

        <div className="demand-sidebar-brand">

          <h2>
            Tea Demand
          </h2>

          <p>
            Forecasting System
          </p>

        </div>


        <nav className="demand-sidebar-nav">

          {navItems.map(
            (item) => {

              const Icon =
                item.icon;


              return (
                <NavLink
                  key={
                    item.path
                  }

                  to={
                    item.path
                  }

                  end={
                    item.end
                  }

                  className={({
                    isActive,
                  }) =>
                    `demand-nav-link ${
                      isActive
                        ? "active"
                        : ""
                    }`
                  }
                >

                  <Icon
                    size={19}
                  />

                  <span>
                    {
                      item.label
                    }
                  </span>

                </NavLink>
              );
            }
          )}

        </nav>


        <div className="demand-sidebar-bottom">

          <button
            type="button"
            className="demand-back-btn"
            onClick={() =>
              navigate(
                "/home"
              )
            }
          >

            <ArrowLeft
              size={18}
            />

            <span>
              Back to Main System
            </span>

          </button>

        </div>

      </aside>


      <main className="demand-main-content">

        <Outlet />

      </main>

    </div>
  );
}