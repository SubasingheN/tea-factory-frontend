import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  History,
  CalendarDays,
  GitCompareArrows,
  AlertTriangle,
  Layers3,
  CheckCircle2,
} from "lucide-react";

import {
  getForecastHistory,
  getForecastComparison,
} from "../../services/demandService";


export default function DemandHistory() {
  const [
    historyData,
    setHistoryData,
  ] = useState(null);

  const [
    comparisonData,
    setComparisonData,
  ] = useState(null);

  const [
    selectedForecastId,
    setSelectedForecastId,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    comparisonLoading,
    setComparisonLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    comparisonError,
    setComparisonError,
  ] = useState("");


  const history = useMemo(() => {
    const records =
      historyData?.history ?? [];

    return [...records].reverse();

  }, [historyData]);


  useEffect(() => {
    loadHistory();
  }, []);


  const loadHistory = async () => {
    try {
      setLoading(true);
      setError("");


      const data =
        await getForecastHistory();


      setHistoryData(
        data
      );


      const records =
        data?.history ?? [];


      const latestForecast =
        records.length > 0
          ? records[
              records.length - 1
            ]
          : null;


      if (
        latestForecast?.forecast_id
      ) {
        setSelectedForecastId(
          latestForecast.forecast_id
        );


        await loadComparison(
          latestForecast.forecast_id
        );
      }


    } catch (error) {
      console.error(
        "Failed to load forecast history:",
        error
      );


      setError(
        error.message ||
        "Failed to load forecast history."
      );


    } finally {
      setLoading(false);
    }
  };


  const loadComparison =
    async (
      forecastId
    ) => {

      if (!forecastId) {
        return;
      }


      try {
        setComparisonLoading(
          true
        );

        setComparisonError("");

        setComparisonData(
          null
        );


        const data =
          await getForecastComparison(
            forecastId
          );


        setComparisonData(
          data.comparison
        );


      } catch (error) {
        console.error(
          "Failed to load forecast comparison:",
          error
        );


        setComparisonError(
          error.message ||
          "Failed to load forecast comparison."
        );


      } finally {
        setComparisonLoading(
          false
        );
      }
    };


  const handleSelectForecast =
    async (
      forecastId
    ) => {

      setSelectedForecastId(
        forecastId
      );


      await loadComparison(
        forecastId
      );
    };


  const formatDateTime = (
    dateValue
  ) => {
    if (!dateValue) {
      return "-";
    }


    const date =
      new Date(
        dateValue
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return dateValue;
    }


    return date.toLocaleString();
  };


  const formatDate = (
    dateValue
  ) => {
    if (!dateValue) {
      return "-";
    }


    return dateValue;
  };


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


  const selectedRecord =
    history.find(
      (record) =>
        record.forecast_id ===
        selectedForecastId
    );


  if (loading) {
    return (
      <div className="demand-page">

        <div className="demand-panel">

          <h2>
            Loading Forecast History...
          </h2>


          <p>
            Loading your saved
            demand forecasts.
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
            Saved Forecasts
          </span>


          <h1>
            Forecast History
          </h1>

        </div>


        <div className="demand-panel">

          <div className="dashboard-warning-box">

            <AlertTriangle
              size={22}
            />


            <div>

              <h3>
                Unable to load history
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
          Saved Forecasts
        </span>


        <h1>
          Forecast History
        </h1>


        <p>
          Review previous demand
          forecasts and compare them
          with actual demand when the
          completed weekly data becomes
          available.
        </p>

      </div>


      <div className="history-summary-grid">

        <div className="history-summary-card">

          <History
            size={23}
          />


          <div>

            <span>
              Saved Forecasts
            </span>


            <h3>
              {
                historyData
                  ?.forecast_count ?? 0
              }
            </h3>

          </div>

        </div>


        <div className="history-summary-card">

          <CalendarDays
            size={23}
          />


          <div>

            <span>
              Forecast Period
            </span>


            <h3>
              {history.length > 0
                ? `${
                    history[0]
                      .forecast_horizon_weeks
                  } Weeks`
                : "-"}
            </h3>

          </div>

        </div>


        <div className="history-summary-card">

          <Layers3
            size={23}
          />


          <div>

            <span>
              Tea Types
            </span>


            <h3>
              {history.length > 0
                ? history[0]
                    .tea_type_count
                : "-"}
            </h3>

          </div>

        </div>


        <div className="history-summary-card">

          <CheckCircle2
            size={23}
          />


          <div>

            <span>
              Latest Forecast
            </span>


            <h3>
              {history.length > 0
                ? formatDate(
                    history[0]
                      .input_week_start_date
                  )
                : "-"}
            </h3>

          </div>

        </div>

      </div>


      <div className="demand-panel">

        <h2>
          Previous Forecasts
        </h2>


        <p>
          The newest forecast is shown
          first. Select any forecast to
          view its details and comparison.
        </p>


        {history.length === 0 ? (

          <div className="history-comparison-empty">

            <History
              size={28}
            />


            <div>

              <h3>
                No saved forecasts
              </h3>


              <p>
                Generate and save a
                forecast to create your
                first history record.
              </p>

            </div>

          </div>

        ) : (

          <div className="history-table">

            <div className="history-table-row header">

              <span>
                Forecast
              </span>


              <span>
                Based on Week
              </span>


              <span>
                Forecast Period
              </span>


              <span>
                Saved On
              </span>


              <span>
                Action
              </span>

            </div>


            {history.map(
              (
                record,
                index
              ) => (

                <div
                  key={
                    record.forecast_id
                  }
                  className="history-table-row"
                >

                  <strong>
                    Forecast{" "}
                    {
                      history.length -
                      index
                    }
                  </strong>


                  <span>
                    {
                      formatDate(
                        record
                          .input_week_start_date
                      )
                    }
                  </span>


                  <span>
                    {
                      record
                        .forecast_horizon_weeks
                    }{" "}
                    Weeks
                  </span>


                  <span>
                    {
                      formatDateTime(
                        record
                          .generated_at
                      )
                    }
                  </span>


                  <button
                    type="button"
                    className="forecast-refresh-btn"
                    onClick={() =>
                      handleSelectForecast(
                        record
                          .forecast_id
                      )
                    }
                    disabled={
                      comparisonLoading &&
                      selectedForecastId ===
                        record
                          .forecast_id
                    }
                  >

                    <GitCompareArrows
                      size={16}
                    />


                    {selectedForecastId ===
                    record.forecast_id
                      ? "Selected"
                      : "View"}

                  </button>

                </div>

              )
            )}

          </div>

        )}

      </div>


      {selectedRecord && (

        <div className="demand-panel">

          <h2>
            Selected Forecast
          </h2>


          <p>
            Demand forecast based on
            the completed week starting{" "}
            <strong>
              {
                formatDate(
                  selectedRecord
                    .input_week_start_date
                )
              }
            </strong>
            .
          </p>


          <div className="forecast-type-grid">

            {(
              selectedRecord
                .forecasts ?? []
            ).map(
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


                    <span className="dashboard-status normal">
                      {
                        tea.trend ||
                        "Forecast"
                      }
                    </span>

                  </div>


                  <div className="forecast-week-list">

                    {(
                      tea.forecasts ?? []
                    ).map(
                      (week) => (

                        <div
                          key={
                            week.week
                          }
                          className="forecast-week-row"
                        >

                          <div className="forecast-week-name">

                            <strong>
                              Week{" "}
                              {
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
                                  .demand_range ||
                                `${formatKg(
                                  week
                                    .lower_demand_kg
                                )} - ${formatKg(
                                  week
                                    .upper_demand_kg
                                )}`
                              }
                            </strong>

                          </div>

                        </div>

                      )
                    )}

                  </div>

                </div>

              )
            )}

          </div>

        </div>

      )}


      <div className="demand-panel">

        <h2>
          Forecast vs Actual Demand
        </h2>


        <p>
          Compare expected demand with
          the actual demand recorded
          after each forecast week is
          completed.
        </p>


        {comparisonLoading ? (

          <div className="history-comparison-empty">

            <GitCompareArrows
              size={28}
            />


            <div>

              <h3>
                Loading comparison...
              </h3>

            </div>

          </div>

        ) : comparisonError ? (

          <div className="dashboard-warning-box">

            <AlertTriangle
              size={22}
            />


            <div>

              <h3>
                Unable to load
                comparison
              </h3>


              <p>
                {comparisonError}
              </p>

            </div>

          </div>

        ) : comparisonData ? (

          <>

            <div className="history-summary-grid">

              <div className="history-summary-card">

                <GitCompareArrows
                  size={22}
                />


                <div>

                  <span>
                    Forecast Values
                  </span>


                  <h3>
                    {
                      comparisonData
                        .total_forecast_records
                    }
                  </h3>

                </div>

              </div>


              <div className="history-summary-card">

                <CheckCircle2
                  size={22}
                />


                <div>

                  <span>
                    Actual Values Available
                  </span>


                  <h3>
                    {
                      comparisonData
                        .actual_records_available
                    }
                  </h3>

                </div>

              </div>


              <div className="history-summary-card">

                <CheckCircle2
                  size={22}
                />


                <div>

                  <span>
                    Within Expected Range
                  </span>


                  <h3>
                    {
                      comparisonData
                        .within_range_count
                    }
                  </h3>

                </div>

              </div>


              <div className="history-summary-card">

                <Layers3
                  size={22}
                />


                <div>

                  <span>
                    Range Accuracy
                  </span>


                  <h3>
                    {
                      comparisonData
                        .range_coverage_percentage !==
                      null
                        ? `${
                            comparisonData
                              .range_coverage_percentage
                          }%`
                        : "-"
                    }
                  </h3>

                </div>

              </div>

            </div>


            {comparisonData
              .actual_records_available ===
            0 ? (

              <div className="history-comparison-empty">

                <GitCompareArrows
                  size={30}
                />


                <div>

                  <h3>
                    Actual demand data
                    is not available yet
                    for this forecast.
                  </h3>


                  <p>
                    The comparison will
                    become available after
                    the forecast weeks are
                    completed and their
                    actual weekly demand
                    data is recorded.
                  </p>

                </div>

              </div>

            ) : (

              <div className="history-table">

                <div className="history-table-row header">

                  <span>
                    Tea Type
                  </span>


                  <span>
                    Week
                  </span>


                  <span>
                    Expected Demand
                  </span>


                  <span>
                    Actual Demand
                  </span>


                  <span>
                    Difference
                  </span>

                </div>


                {(
                  comparisonData
                    .comparisons ?? []
                ).map(
                  (
                    item,
                    index
                  ) => (

                    <div
                      key={
                        `${
                          item.tea_type
                        }-${
                          item.week
                        }-${index}`
                      }
                      className="history-table-row"
                    >

                      <strong>
                        {
                          item
                            .tea_type
                        }
                      </strong>


                      <span>
                        Week{" "}
                        {
                          item.week
                        }
                      </span>


                      <span>
                        {
                          formatKg(
                            item
                              .predicted_median_kg
                          )
                        }
                      </span>


                      <span>
                        {
                          formatKg(
                            item
                              .actual_demand_kg
                          )
                        }
                      </span>


                      <span>
                        {
                          formatKg(
                            item
                              .absolute_error_kg
                          )
                        }
                      </span>

                    </div>

                  )
                )}

              </div>

            )}

          </>

        ) : (

          <div className="history-comparison-empty">

            <GitCompareArrows
              size={28}
            />


            <div>

              <h3>
                Select a forecast
              </h3>


              <p>
                Select a previous
                forecast to view its
                comparison with actual
                demand.
              </p>

            </div>

          </div>

        )}

      </div>

    </div>
  );
}