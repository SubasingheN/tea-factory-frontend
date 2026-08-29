import React from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  Database,
  LineChart,
} from "lucide-react";


export default function DemandHome() {
  const navigate =
    useNavigate();


  return (
    <div className="demand-home-page">

      <section className="demand-hero">

        <div className="demand-hero-overlay">

          <div className="demand-hero-content">

            <span className="demand-hero-label">
              Tea Demand Forecasting
            </span>


            <h1>
              Forecast Tea Demand
              for the Next 4 Weeks
            </h1>


            <p>
              Enter the latest completed
              week's factory and market
              data to forecast demand for
              BOP, BOPF, Dust, OP and
              Pekoe tea.
            </p>


            <div className="demand-hero-actions">

              <button
                type="button"
                className="demand-hero-primary"
                onClick={() =>
                  navigate(
                    "/tea-demand-forecasting/weekly-data"
                  )
                }
              >

                <Database
                  size={19}
                />

                Enter Weekly Data

              </button>


              <button
                type="button"
                className="demand-hero-secondary"
                onClick={() =>
                  navigate(
                    "/tea-demand-forecasting/forecast"
                  )
                }
              >

                <LineChart
                  size={19}
                />

                View Latest Forecast

              </button>

            </div>

          </div>

        </div>

      </section>

    </div>
  );
}