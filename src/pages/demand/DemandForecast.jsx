import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Save,
  CheckCircle2,
} from "lucide-react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import {
  getWeeklyForecast,
  getLatestOperationalForecast,
  generateDemoForecast,
  saveGeneratedForecast,
} from "../../services/demandService";


export default function DemandForecast() {
  const [
    forecastData,
    setForecastData,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    saved,
    setSaved,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    saveMessage,
    setSaveMessage,
  ] = useState("");

  const [
    forecastSource,
    setForecastSource,
  ] = useState("");


  const loadForecast = async () => {
    try {
      setLoading(true);
      setError("");


      /*
       * First use a forecast that was
       * generated during the current
       * browser session.
       */
      const storedForecast =
        sessionStorage.getItem(
          "latestDemoForecast"
        );


      if (storedForecast) {
        try {
          const parsedForecast =
            JSON.parse(
              storedForecast
            );


          if (
            parsedForecast &&
            Array.isArray(
              parsedForecast.forecasts
            )
          ) {
            setForecastData(
              parsedForecast
            );

            setForecastSource(
              "weekly-input"
            );

            return;
          }


        } catch (parseError) {
          console.error(
            "Unable to read stored forecast:",
            parseError
          );


          sessionStorage.removeItem(
            "latestDemoForecast"
          );
        }
      }


      /*
       * Recover the latest permanently
       * saved forecast when browser
       * session data is unavailable.
       */
      try {
        const latestOperational =
          await getLatestOperationalForecast();


        if (
          latestOperational &&
          latestOperational.forecast &&
          Array.isArray(
            latestOperational
              .forecast
              .forecasts
          )
        ) {
          setForecastData(
            latestOperational.forecast
          );

          setForecastSource(
            "database"
          );

          return;
        }


      } catch (databaseError) {
        console.warn(
          "No saved forecast available:",
          databaseError
        );
      }


      /*
       * Final fallback.
       */
      const data =
        await getWeeklyForecast();


      setForecastData(
        data
      );

      setForecastSource(
        "backend"
      );


    } catch (error) {
      console.error(
        "Failed to load forecast:",
        error
      );


      setError(
        error.message ||
        "Failed to load demand forecast."
      );


    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadForecast();
  }, []);


  const forecasts =
    forecastData?.forecasts ?? [];


  const forecastHorizon =
    forecastData
      ?.forecast_horizon_weeks ??
    forecastData
      ?.forecast_horizon ??
    4;


  const chartData =
    useMemo(() => {
      if (!forecasts.length) {
        return [];
      }


      const weekMap = {};


      forecasts.forEach(
        (tea) => {

          tea.forecasts.forEach(
            (week) => {

              const key =
                week.week;


              if (!weekMap[key]) {
                weekMap[key] = {
                  week:
                    `Week ${week.week}`,

                  date:
                    week
                      .week_start_date,
                };
              }


              weekMap[key][
                tea.tea_type
              ] =
                week
                  .median_demand_kg;

            }
          );

        }
      );


      return Object.values(
        weekMap
      );

    }, [forecasts]);


  const formatKg = (
    value
  ) => {
    if (
      value === null ||
      value === undefined
    ) {
      return "-";
    }


    return `${Number(
      value
    ).toLocaleString(
      undefined,
      {
        maximumFractionDigits: 0,
      }
    )} kg`;
  };


  const getTrendIcon = (
    trend
  ) => {
    if (
      trend === "Increasing"
    ) {
      return (
        <TrendingUp
          size={17}
        />
      );
    }


    if (
      trend === "Decreasing"
    ) {
      return (
        <TrendingDown
          size={17}
        />
      );
    }


    return (
      <Minus
        size={17}
      />
    );
  };


  const handleRefresh =
    async () => {

      try {
        setRefreshing(true);
        setError("");
        setSaveMessage("");
        setSaved(false);


        /*
         * Regenerate using the latest
         * weekly input when it is still
         * available in this session.
         */
        const storedInput =
          sessionStorage.getItem(
            "latestDemoInput"
          );


        if (storedInput) {
          const weeklyInput =
            JSON.parse(
              storedInput
            );


          const response =
            await generateDemoForecast(
              weeklyInput
            );


          sessionStorage.setItem(
            "latestDemoForecast",
            JSON.stringify(
              response
            )
          );


          setForecastData(
            response
          );

          setForecastSource(
            "weekly-input"
          );

          return;
        }


        /*
         * Otherwise reload the latest
         * permanently saved forecast.
         */
        try {
          const latestOperational =
            await getLatestOperationalForecast();


          if (
            latestOperational &&
            latestOperational.forecast &&
            Array.isArray(
              latestOperational
                .forecast
                .forecasts
            )
          ) {
            setForecastData(
              latestOperational.forecast
            );

            setForecastSource(
              "database"
            );

            return;
          }


        } catch (databaseError) {
          console.warn(
            "No saved forecast available:",
            databaseError
          );
        }


        /*
         * Final fallback.
         */
        const data =
          await getWeeklyForecast();


        setForecastData(
          data
        );

        setForecastSource(
          "backend"
        );


      } catch (error) {
        console.error(
          "Failed to refresh forecast:",
          error
        );


        setError(
          error.message ||
          "Failed to refresh demand forecast."
        );


      } finally {
        setRefreshing(false);
      }
    };


  const handleSaveForecast =
    async () => {

      if (
        forecastSource !==
        "weekly-input"
      ) {
        setSaveMessage(
          "Generate a new forecast from Weekly Data Entry before saving another forecast."
        );

        return;
      }


      if (
        !forecastData ||
        !Array.isArray(
          forecastData.forecasts
        ) ||
        !forecastData
          .forecasts.length
      ) {
        setSaveMessage(
          "No forecast is available to save."
        );

        return;
      }


      try {
        setSaving(true);
        setSaveMessage("");


        const response =
          await saveGeneratedForecast(
            forecastData
          );


        setSaved(true);


        setSaveMessage(
          response.message ||
          "Forecast saved successfully."
        );


      } catch (error) {
        console.error(
          "Failed to save forecast:",
          error
        );


        setSaved(false);


        setSaveMessage(
          error.message ||
          "Failed to save forecast."
        );


      } finally {
        setSaving(false);
      }
    };


  if (loading) {
    return (
      <div className="demand-page">

        <div className="demand-panel">

          <h2>
            Loading Demand Forecast...
          </h2>


          <p>
            Loading the latest
            4-week demand forecast.
          </p>

        </div>

      </div>
    );
  }


  if (error) {
    return (
      <div className="demand-page">

        <div className="demand-page-header">

          <span className="demand-page-label">
            Demand Forecast
          </span>


          <h1>
            4-Week Demand Forecast
          </h1>

        </div>


        <div className="demand-panel">

          <div className="dashboard-warning-box">

            <AlertTriangle
              size={22}
            />


            <div>

              <h3>
                Unable to load forecast
              </h3>


              <p>
                {error}
              </p>


              <button
                type="button"
                className="forecast-refresh-btn"
                onClick={
                  handleRefresh
                }
                disabled={
                  refreshing
                }
              >

                <RefreshCw
                  size={17}
                />

                Try Again

              </button>

            </div>

          </div>

        </div>

      </div>
    );
  }


  return (
    <div className="demand-page">

      <div className="demand-page-header-row">

        <div className="demand-page-header">

          <span className="demand-page-label">
            Demand Forecast
          </span>


          <h1>
            4-Week Demand Forecast
          </h1>


          <p>
            Expected tea demand for the
            ongoing week and the following
            three weeks.
          </p>

        </div>


        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >

          {forecastSource ===
            "weekly-input" && (

            <button
              type="button"
              className="forecast-refresh-btn"
              onClick={
                handleSaveForecast
              }
              disabled={
                saving ||
                saved
              }
            >

              {saved ? (
                <CheckCircle2
                  size={17}
                />
              ) : (
                <Save
                  size={17}
                />
              )}


              {saving
                ? "Saving..."
                : saved
                  ? "Saved"
                  : "Save Forecast"}

            </button>

          )}


          <button
            type="button"
            className="forecast-refresh-btn"
            onClick={
              handleRefresh
            }
            disabled={
              refreshing
            }
          >

            <RefreshCw
              size={17}
              className={
                refreshing
                  ? (
                    "forecast-refresh-icon " +
                    "spinning"
                  )
                  : "forecast-refresh-icon"
              }
            />


            {refreshing
              ? "Refreshing..."
              : "Refresh Forecast"}

          </button>

        </div>

      </div>


      {forecastSource ===
        "weekly-input" && (

        <div className="demand-success-message">

          <CheckCircle2
            size={19}
          />


          <span>
            Forecast generated from the
            latest weekly data.
          </span>

        </div>

      )}


      {forecastSource ===
        "database" && (

        <div className="demand-success-message">

          <CheckCircle2
            size={19}
          />


          <span>
            Latest saved forecast loaded.
          </span>

        </div>

      )}


      {saveMessage && (

        <div
          className={
            saved
              ? "demand-success-message"
              : "dashboard-warning-box"
          }
          style={{
            marginBottom: "20px",
          }}
        >

          {saved ? (
            <CheckCircle2
              size={19}
            />
          ) : (
            <AlertTriangle
              size={19}
            />
          )}


          <span>
            {saveMessage}
          </span>

        </div>

      )}


      <div className="demand-panel">

        <div className="demand-panel-header">

          <div>

            <h2>
              Forecast Overview
            </h2>


            <p>
              Summary of the latest
              tea demand forecast.
            </p>

          </div>

        </div>


        <div className="forecast-type-grid">

          <div className="forecast-type-card">

            <span>
              Forecast Period
            </span>


            <h3>
              {forecastHorizon} Weeks
            </h3>

          </div>


          <div className="forecast-type-card">

            <span>
              Tea Types
            </span>


            <h3>
              {
                forecastData
                  ?.tea_type_count ??
                forecasts.length
              }
            </h3>

          </div>


          <div className="forecast-type-card">

            <span>
              Based on Week
            </span>


            <h3>
              {
                forecastData
                  ?.input_week_start_date
                || "Latest Data"
              }
            </h3>

          </div>

        </div>

      </div>


      <div
        className="
          demand-panel
          forecast-chart-panel
        "
      >

        <div className="forecast-chart-header">

          <div>

            <h2>
              Expected Demand Forecast
            </h2>


            <p>
              Expected demand for all five
              tea types across the four
              forecast weeks.
            </p>

          </div>

        </div>


        <div className="forecast-chart-container">

          <ResponsiveContainer
            width="100%"
            height={360}
          >

            <LineChart
              data={
                chartData
              }
              margin={{
                top: 10,
                right: 20,
                left: 10,
                bottom: 10,
              }}
            >

              <CartesianGrid
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey="week"
              />

              <YAxis />


              <Tooltip
                formatter={(
                  value
                ) =>
                  formatKg(
                    value
                  )
                }
                labelFormatter={(
                  label,
                  payload
                ) => {

                  const date =
                    payload?.[0]
                      ?.payload
                      ?.date;


                  if (date) {
                    return (
                      `${label} - ${date}`
                    );
                  }


                  return label;
                }}
              />


              <Legend />


              <Line
                type="monotone"
                dataKey="BOP"
                stroke="#2563eb"
                strokeWidth={2}
                activeDot={{
                  r: 6,
                }}
              />


              <Line
                type="monotone"
                dataKey="BOPF"
                stroke="#16a34a"
                strokeWidth={2}
              />


              <Line
                type="monotone"
                dataKey="Dust"
                stroke="#dc2626"
                strokeWidth={2}
              />


              <Line
                type="monotone"
                dataKey="OP"
                stroke="#9333ea"
                strokeWidth={2}
              />


              <Line
                type="monotone"
                dataKey="Pekoe"
                stroke="#ea580c"
                strokeWidth={2}
              />

            </LineChart>

          </ResponsiveContainer>

        </div>

      </div>


      <div className="forecast-type-grid">

        {forecasts.map(
          (tea) => (

            <div
              key={
                tea.tea_type
              }
              className="forecast-type-card"
            >

              <div className="forecast-type-header">

                <div>

                  <span>
                    Tea Type
                  </span>


                  <h3>
                    {
                      tea.tea_type
                    }
                  </h3>

                </div>


                <div className="forecast-trend">

                  {
                    getTrendIcon(
                      tea.trend
                    )
                  }


                  <span>
                    {
                      tea.trend
                    }
                  </span>

                </div>

              </div>


              <div className="forecast-week-list">

                {
                  tea.forecasts.map(
                    (week) => (

                      <div
                        key={
                          week.week
                        }
                        className="forecast-week-row"
                      >

                        <div className="forecast-week-name">

                          <strong>
                            Week {
                              week.week
                            }
                          </strong>


                          <span>
                            {
                              week
                                .week_start_date
                            }
                          </span>

                        </div>


                        <div className="forecast-week-value">

                          <span>
                            Expected Demand
                          </span>


                          <strong>
                            {
                              formatKg(
                                week
                                  .median_demand_kg
                              )
                            }
                          </strong>

                        </div>


                        <div className="forecast-week-range">

                          <span>
                            Expected Range
                          </span>


                          <strong>
                            {
                              week
                                .demand_range
                            }
                          </strong>

                        </div>

                      </div>

                    )
                  )
                }

              </div>

            </div>

          )
        )}

      </div>


      <div className="demand-panel">

        <div className="forecast-insight-panel">

          <TrendingUp
            size={25}
          />


          <div>

            <h3>
              Understanding the Forecast
            </h3>


            <p>
              Expected Demand shows the
              main forecast for each week.
              Expected Range shows the
              likely demand range around
              that forecast.
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}