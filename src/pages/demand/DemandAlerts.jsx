import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Lightbulb,
} from "lucide-react";

import {
  getDemandAlerts,
  getDemandAlertsFromForecast,
  getDemandRecommendations,
  getDemandRecommendationsFromForecast,
  getLatestOperationalForecast,
} from "../../services/demandService";


export default function DemandAlerts() {
  const [
    alertsData,
    setAlertsData,
  ] = useState(null);

  const [
    recommendationsData,
    setRecommendationsData,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    dataSource,
    setDataSource,
  ] = useState("");


  useEffect(() => {
    loadData();
  }, []);


  async function generateSupportData(
    forecasts,
    source
  ) {
    const [
      alertsResponse,
      recommendationsResponse,
    ] = await Promise.all([
      getDemandAlertsFromForecast(
        forecasts
      ),

      getDemandRecommendationsFromForecast(
        forecasts
      ),
    ]);


    setAlertsData(
      alertsResponse
    );

    setRecommendationsData(
      recommendationsResponse
    );

    setDataSource(
      source
    );
  }


  async function loadData() {
    try {
      setLoading(true);
      setError("");


      /*
       * First use the forecast that
       * was generated during the
       * current browser session.
       */
      const savedForecast =
        sessionStorage.getItem(
          "latestDemoForecast"
        );


      if (savedForecast) {
        try {
          const parsedForecast =
            JSON.parse(
              savedForecast
            );


          const forecasts =
            parsedForecast
              ?.forecasts;


          if (
            forecasts &&
            Array.isArray(
              forecasts
            ) &&
            forecasts.length > 0
          ) {
            await generateSupportData(
              forecasts,
              "latest"
            );

            return;
          }


        } catch (storageError) {
          console.error(
            "Unable to use stored forecast:",
            storageError
          );


          sessionStorage.removeItem(
            "latestDemoForecast"
          );
        }
      }


      /*
       * If browser session data is
       * unavailable, recover the
       * latest permanently saved
       * forecast.
       */
      try {
        const latestOperational =
          await getLatestOperationalForecast();


        const latestForecast =
          latestOperational
            ?.forecast;


        const forecasts =
          latestForecast
            ?.forecasts;


        if (
          forecasts &&
          Array.isArray(
            forecasts
          ) &&
          forecasts.length > 0
        ) {
          /*
           * Restore it to session
           * storage so the other
           * forecast pages can reuse
           * the same latest forecast.
           */
          sessionStorage.setItem(
            "latestDemoForecast",
            JSON.stringify(
              latestForecast
            )
          );


          await generateSupportData(
            forecasts,
            "saved"
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
       * Final fallback to the existing
       * forecast-based alert and
       * recommendation endpoints.
       */
      const [
        alertsResponse,
        recommendationsResponse,
      ] = await Promise.all([
        getDemandAlerts(),

        getDemandRecommendations(),
      ]);


      setAlertsData(
        alertsResponse
      );

      setRecommendationsData(
        recommendationsResponse
      );

      setDataSource(
        "fallback"
      );


    } catch (error) {
      console.error(
        "Failed to load alerts and recommendations:",
        error
      );


      setError(
        error.message ||
        "Failed to load alerts and recommendations."
      );


    } finally {
      setLoading(false);
    }
  }


  const teaAlerts =
    alertsData?.alerts ?? [];


  const teaRecommendations =
    recommendationsData
      ?.recommendations ?? [];


  const summary =
    useMemo(() => {

      let normalTeaTypes = 0;
      let warningTeaTypes = 0;


      teaAlerts.forEach(
        (tea) => {

          const hasWarning =
            tea.alerts.some(
              (item) =>
                item.alert_level !==
                "Normal"
            );


          if (hasWarning) {
            warningTeaTypes += 1;
          } else {
            normalTeaTypes += 1;
          }

        }
      );


      return {
        normalTeaTypes,
        warningTeaTypes,

        monitoredTeaTypes:
          teaAlerts.length,
      };

    }, [teaAlerts]);


  function getOverallStatus(
    tea
  ) {
    const warning =
      tea.alerts.find(
        (item) =>
          item.alert_level !==
          "Normal"
      );


    return warning
      ? warning.alert_level
      : "Normal";
  }


  function getWeekOnePercentage(
    tea
  ) {
    if (!tea.alerts.length) {
      return "-";
    }


    return tea.alerts[0]
      .percentage_change;
  }


  function getStatusClass(
    alertLevel
  ) {
    return alertLevel === "Normal"
      ? "alert-status-pill normal"
      : "alert-status-pill warning";
  }


  if (loading) {
    return (
      <div className="demand-page">

        <div className="demand-panel">

          <h2>
            Loading Alerts &
            Recommendations...
          </h2>


          <p>
            Checking the latest
            demand forecast.
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
            Demand Planning
          </span>


          <h1>
            Alerts &
            Recommendations
          </h1>

        </div>


        <div className="demand-panel">

          <div className="dashboard-warning-box">

            <AlertTriangle
              size={22}
            />


            <div>

              <h3>
                Unable to load alerts
              </h3>


              <p>
                {error}
              </p>

            </div>

          </div>

        </div>

      </div>
    );
  }


  return (
    <div className="demand-page">

      <div className="demand-page-header">

        <span className="demand-page-label">
          Demand Planning
        </span>


        <h1>
          Alerts &
          Recommendations
        </h1>


        <p>
          Review important demand
          changes and suggested actions
          for the next four weeks.
        </p>

      </div>


      {(dataSource === "latest" ||
        dataSource === "saved") && (

        <div className="demand-success-message">

          <CheckCircle2
            size={19}
          />


          <span>
            Alerts and recommendations
            are based on the latest
            demand forecast.
          </span>

        </div>

      )}


      <div className="alerts-summary-grid">

        <div className="alert-summary-card">

          <CheckCircle2
            size={23}
          />


          <div>

            <span>
              Normal
            </span>


            <h3>
              {
                summary
                  .normalTeaTypes
              }
            </h3>

          </div>

        </div>


        <div className="alert-summary-card">

          <AlertTriangle
            size={23}
          />


          <div>

            <span>
              Need Attention
            </span>


            <h3>
              {
                summary
                  .warningTeaTypes
              }
            </h3>

          </div>

        </div>


        <div className="alert-summary-card">

          <TrendingDown
            size={23}
          />


          <div>

            <span>
              Tea Types
            </span>


            <h3>
              {
                summary
                  .monitoredTeaTypes
              }
            </h3>

          </div>

        </div>

      </div>


      <div className="demand-panel">

        <h2>
          Demand Alerts
        </h2>


        <p>
          See which tea types may
          require attention based on
          expected demand.
        </p>


        <div className="demand-alert-list">

          {teaAlerts.map(
            (tea) => {

              const status =
                getOverallStatus(
                  tea
                );


              const percentage =
                getWeekOnePercentage(
                  tea
                );


              const isWarning =
                status !== "Normal";


              return (
                <div
                  key={
                    tea.tea_type
                  }
                  className="demand-alert-row"
                >

                  <div className="alert-tea-name">

                    {isWarning ? (
                      <AlertTriangle
                        size={20}
                      />
                    ) : (
                      <CheckCircle2
                        size={20}
                      />
                    )}


                    <div>

                      <strong>
                        {
                          tea.tea_type
                        }
                      </strong>


                      <span>
                        Recent Average:{" "}
                        {Number(
                          tea
                            .baseline_demand_kg
                        ).toLocaleString(
                          undefined,
                          {
                            maximumFractionDigits:
                              0,
                          }
                        )}{" "}
                        kg
                      </span>

                    </div>

                  </div>


                  <div>

                    <span
                      className={
                        getStatusClass(
                          status
                        )
                      }
                    >
                      {status}
                    </span>

                  </div>


                  <div>

                    <strong>
                      {
                        typeof percentage ===
                          "number" &&
                        percentage > 0
                          ? "+"
                          : ""
                      }
                      {percentage}%
                    </strong>


                    <span>
                      Week 1 change
                    </span>

                  </div>

                </div>
              );
            }
          )}

        </div>

      </div>


      <div className="demand-panel">

        <h2>
          Weekly Demand Status
        </h2>


        <p>
          Expected demand changes for
          each of the four forecast weeks.
        </p>


        {teaAlerts.map(
          (tea) => (

            <div
              key={
                tea.tea_type
              }
              className="recommendation-card"
            >

              <div className="recommendation-heading">

                <div>

                  <span className="recommendation-label">
                    Tea Type
                  </span>


                  <h3>
                    {
                      tea.tea_type
                    }
                  </h3>

                </div>


                <span
                  className={
                    getStatusClass(
                      getOverallStatus(
                        tea
                      )
                    )
                  }
                >
                  {
                    getOverallStatus(
                      tea
                    )
                  }
                </span>

              </div>


              <div className="forecast-week-list">

                {tea.alerts.map(
                  (item) => (

                    <div
                      key={
                        `${tea.tea_type}-${item.week}`
                      }
                      className="forecast-week-row"
                    >

                      <div className="forecast-week-name">

                        <strong>
                          Week {
                            item.week
                          }
                        </strong>


                        <span>
                          {
                            item
                              .week_start_date
                          }
                        </span>

                      </div>


                      <div className="forecast-week-value">

                        <span>
                          Expected Demand
                        </span>


                        <strong>
                          {Number(
                            item
                              .median_demand_kg
                          ).toLocaleString(
                            undefined,
                            {
                              maximumFractionDigits:
                                0,
                            }
                          )}{" "}
                          kg
                        </strong>

                      </div>


                      <div className="forecast-week-range">

                        <span>
                          Change
                        </span>


                        <strong>
                          {
                            item
                              .percentage_change >
                            0
                              ? "+"
                              : ""
                          }
                          {
                            item
                              .percentage_change
                          }
                          %
                        </strong>

                      </div>


                      <div>

                        <span
                          className={
                            getStatusClass(
                              item
                                .alert_level
                            )
                          }
                        >
                          {
                            item
                              .alert_level
                          }
                        </span>

                      </div>

                    </div>

                  )
                )}

              </div>

            </div>

          )
        )}

      </div>


      <div className="demand-panel">

        <h2>
          Recommended Actions
        </h2>


        <p>
          Suggested actions for each
          tea type based on expected
          demand changes.
        </p>


        {teaRecommendations.map(
          (tea) => (

            <div
              key={
                tea.tea_type
              }
              className="recommendation-card"
            >

              <div className="recommendation-heading">

                <div>

                  <span className="recommendation-label">
                    Tea Type
                  </span>


                  <h3>
                    {
                      tea.tea_type
                    }
                  </h3>

                </div>


                <Lightbulb
                  size={21}
                />

              </div>


              <div className="report-content-list">

                {
                  tea
                    .weekly_recommendations
                    .map(
                      (week) => (

                        <div
                          key={
                            `${tea.tea_type}-${week.week}`
                          }
                          style={{
                            alignItems:
                              "flex-start",
                          }}
                        >

                          {week.alert_level ===
                          "Normal" ? (
                            <CheckCircle2
                              size={18}
                            />
                          ) : (
                            <AlertTriangle
                              size={18}
                            />
                          )}


                          <div>

                            <strong>
                              Week {
                                week.week
                              } —{" "}
                              {
                                week
                                  .week_start_date
                              }
                            </strong>


                            <p
                              style={{
                                margin:
                                  "4px 0 6px",
                              }}
                            >
                              Status:{" "}
                              <strong>
                                {
                                  week
                                    .alert_level
                                }
                              </strong>
                            </p>


                            {
                              week
                                .recommendations
                                .map(
                                  (
                                    recommendation,
                                    index
                                  ) => (

                                    <p
                                      key={
                                        index
                                      }
                                      style={{
                                        margin:
                                          "5px 0 0",
                                      }}
                                    >
                                      {
                                        recommendation
                                      }
                                    </p>

                                  )
                                )
                            }

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

    </div>
  );
}