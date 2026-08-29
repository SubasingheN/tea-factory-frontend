import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BrainCircuit,
  History,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

import {
  getExplainabilitySummary,
  getExplainabilityFromWeeklyInput,
  getLatestOperationalWeeklyInput,
} from "../../services/demandService";


export default function DemandExplainability() {
  const [
    explainabilityData,
    setExplainabilityData,
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

  const [
    inputWeek,
    setInputWeek,
  ] = useState("");


  useEffect(() => {
    loadExplainability();
  }, []);


  async function generateExplanation(
    weeklyInput,
    source
  ) {
    const data =
      await getExplainabilityFromWeeklyInput(
        weeklyInput
      );


    setExplainabilityData(
      data.summary
    );


    setInputWeek(
      data.input_week_start_date ||
      weeklyInput.week_start_date ||
      ""
    );


    setDataSource(
      source
    );
  }


  async function loadExplainability() {
    try {
      setLoading(true);
      setError("");


      /*
       * First use weekly input from
       * the current browser session.
       */
      const savedInput =
        sessionStorage.getItem(
          "latestDemoInput"
        );


      if (savedInput) {
        try {
          const weeklyInput =
            JSON.parse(
              savedInput
            );


          if (
            weeklyInput &&
            weeklyInput.week_start_date &&
            Array.isArray(
              weeklyInput.records
            )
          ) {
            await generateExplanation(
              weeklyInput,
              "latest"
            );

            return;
          }


        } catch (sessionError) {
          console.error(
            "Unable to use current weekly input:",
            sessionError
          );


          sessionStorage.removeItem(
            "latestDemoInput"
          );
        }
      }


      /*
       * If the browser session is
       * unavailable, recover the
       * latest saved weekly input.
       */
      try {
        const savedResponse =
          await getLatestOperationalWeeklyInput();


        const weeklyInput =
          savedResponse
            ?.weekly_input;


        if (
          weeklyInput &&
          weeklyInput.week_start_date &&
          Array.isArray(
            weeklyInput.records
          )
        ) {
          /*
           * Restore it to the browser
           * session so other pages can
           * reuse the same latest input.
           */
          sessionStorage.setItem(
            "latestDemoInput",
            JSON.stringify({
              week_start_date:
                weeklyInput
                  .week_start_date,

              records:
                weeklyInput
                  .records,
            })
          );


          await generateExplanation(
            {
              week_start_date:
                weeklyInput
                  .week_start_date,

              records:
                weeklyInput
                  .records,
            },
            "saved"
          );


          return;
        }


      } catch (savedInputError) {
        console.warn(
          "No saved weekly input available:",
          savedInputError
        );
      }


      /*
       * Final fallback to the existing
       * research explanation.
       */
      const data =
        await getExplainabilitySummary();


      setExplainabilityData(
        data.summary
      );


      setDataSource(
        "fallback"
      );


      setInputWeek("");


    } catch (error) {
      console.error(
        "Failed to load forecast explanation:",
        error
      );


      setError(
        error.message ||
        "Failed to load forecast explanation."
      );


    } finally {
      setLoading(false);
    }
  }


  const encoderVariables =
    explainabilityData
      ?.encoder_variable_importance ??
    [];


  const decoderVariables =
    explainabilityData
      ?.decoder_variable_importance ??
    [];


  const staticVariables =
    explainabilityData
      ?.static_variable_importance ??
    [];


  const topEncoder =
    encoderVariables[0];


  const topDecoder =
    decoderVariables[0];


  const topStatic =
    staticVariables[0];


  const encoderTopFive =
    useMemo(
      () =>
        encoderVariables.slice(
          0,
          5
        ),
      [encoderVariables]
    );


  const decoderTopFive =
    useMemo(
      () =>
        decoderVariables.slice(
          0,
          5
        ),
      [decoderVariables]
    );


  const staticTopFour =
    useMemo(
      () =>
        staticVariables.slice(
          0,
          4
        ),
      [staticVariables]
    );


  function formatVariableName(
    name
  ) {
    if (!name) {
      return "-";
    }


    const friendlyNames = {
      demand_kg:
        "Demand",

      production_kg:
        "Production",

      inventory_kg:
        "Inventory",

      colombo_auction_price_lkr:
        "Auction Price",

      auction_price_lag1w:
        "Recent Auction Price",

      auction_price_lag4w:
        "Previous Auction Price",

      rainfall_index:
        "Rainfall",

      usd_lkr_rate:
        "USD/LKR Rate",

      festival_flag:
        "Festival Period",

      global_commodity_shock:
        "Commodity Market Change",

      demand_rolling4w_avg:
        "Recent Demand Average",

      demand_rolling12w_avg:
        "Long-Term Demand Average",

      week_of_year:
        "Time of Year",

      month:
        "Month",

      year:
        "Year",

      series_id:
        "Tea Type",

      grade:
        "Tea Type",
    };


    if (friendlyNames[name]) {
      return friendlyNames[name];
    }


    return name
      .replaceAll("_", " ")
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase()
      );
  }


  function formatPercentage(
    value
  ) {
    if (
      value === undefined ||
      value === null
    ) {
      return "-";
    }


    return `${value}%`;
  }


  function renderImportanceList(
    items
  ) {
    if (!items.length) {
      return (
        <p>
          No influence information
          is available.
        </p>
      );
    }


    return (
      <div className="importance-list">

        {items.map(
          (item) => (

            <div
              key={
                item.variable
              }
              className="importance-row"
            >

              <div className="importance-label">

                <span>
                  {
                    formatVariableName(
                      item.variable
                    )
                  }
                </span>


                <strong>
                  {
                    formatPercentage(
                      item
                        .importance_percentage
                    )
                  }
                </strong>

              </div>


              <div className="importance-track">

                <div
                  className="importance-fill"
                  style={{
                    width:
                      `${Math.min(
                        Number(
                          item
                            .importance_percentage
                        ) || 0,
                        100
                      )}%`,
                  }}
                />

              </div>

            </div>

          )
        )}

      </div>
    );
  }


  if (loading) {
    return (
      <div className="demand-page">

        <div className="demand-panel">

          <h2>
            Loading Forecast Explanation...
          </h2>


          <p>
            Identifying the main
            factors influencing the
            latest demand forecast.
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
            Forecast Explanation
          </span>


          <h1>
            Why This Forecast?
          </h1>

        </div>


        <div className="demand-panel">

          <div className="dashboard-warning-box">

            <AlertTriangle
              size={22}
            />


            <div>

              <h3>
                Unable to load
                forecast explanation
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
          Forecast Explanation
        </span>


        <h1>
          Why This Forecast?
        </h1>


        <p>
          See the main factors the
          forecasting system considered
          when producing the latest
          demand forecast.
        </p>

      </div>


      {(dataSource === "latest" ||
        dataSource === "saved") && (

        <div className="demand-success-message">

          <CheckCircle2
            size={19}
          />


          <span>
            Explanation based on the
            latest weekly data
            {inputWeek
              ? ` from the week starting ${inputWeek}`
              : ""}
            .
          </span>

        </div>

      )}


      <div className="explain-summary-grid">

        <div className="explain-summary-card">

          <BrainCircuit
            size={23}
          />


          <div>

            <span>
              Main Overall Factor
            </span>


            <h3>
              {
                formatVariableName(
                  topEncoder
                    ?.variable
                )
              }
            </h3>


            <p>
              {
                formatPercentage(
                  topEncoder
                    ?.importance_percentage
                )
              }
            </p>

          </div>

        </div>


        <div className="explain-summary-card">

          <History
            size={23}
          />


          <div>

            <span>
              Main Past Factor
            </span>


            <h3>
              {
                formatVariableName(
                  topEncoder
                    ?.variable
                )
              }
            </h3>


            <p>
              {
                formatPercentage(
                  topEncoder
                    ?.importance_percentage
                )
              }
            </p>

          </div>

        </div>


        <div className="explain-summary-card">

          <CalendarDays
            size={23}
          />


          <div>

            <span>
              Main Upcoming Factor
            </span>


            <h3>
              {
                formatVariableName(
                  topDecoder
                    ?.variable
                )
              }
            </h3>


            <p>
              {
                formatPercentage(
                  topDecoder
                    ?.importance_percentage
                )
              }
            </p>

          </div>

        </div>

      </div>


      <div className="explain-grid">

        <div className="demand-panel">

          <h2>
            Past Factors
          </h2>


          <p>
            Historical information that
            had the strongest influence
            on the forecast.
          </p>


          {
            renderImportanceList(
              encoderTopFive
            )
          }

        </div>


        <div className="demand-panel">

          <h2>
            Upcoming Factors
          </h2>


          <p>
            Information about upcoming
            periods that influenced the
            forecast.
          </p>


          {
            renderImportanceList(
              decoderTopFive
            )
          }

        </div>

      </div>


      {staticTopFour.length > 0 && (

        <div className="demand-panel">

          <h2>
            Tea Type Influence
          </h2>


          <p>
            Information used to
            distinguish the demand
            behaviour of different
            tea types.
          </p>


          {
            renderImportanceList(
              staticTopFour
            )
          }

        </div>

      )}


      <div className="demand-panel">

        <h2>
          Main Influences
        </h2>


        <p>
          The strongest factor from
          each group used in the
          forecast.
        </p>


        <div className="dashboard-forecast-table">

          <div className="dashboard-table-row header">

            <span>
              Information
            </span>


            <span>
              Main Factor
            </span>


            <span>
              Influence
            </span>


            <span>
              Meaning
            </span>

          </div>


          <div className="dashboard-table-row">

            <strong>
              Past Data
            </strong>


            <span>
              {
                formatVariableName(
                  topEncoder
                    ?.variable
                )
              }
            </span>


            <span>
              {
                formatPercentage(
                  topEncoder
                    ?.importance_percentage
                )
              }
            </span>


            <span>
              Strongest influence
              from recent and
              historical information
            </span>

          </div>


          <div className="dashboard-table-row">

            <strong>
              Upcoming Data
            </strong>


            <span>
              {
                formatVariableName(
                  topDecoder
                    ?.variable
                )
              }
            </span>


            <span>
              {
                formatPercentage(
                  topDecoder
                    ?.importance_percentage
                )
              }
            </span>


            <span>
              Strongest influence
              from known upcoming
              information
            </span>

          </div>


          {topStatic && (

            <div className="dashboard-table-row">

              <strong>
                Tea Type
              </strong>


              <span>
                {
                  formatVariableName(
                    topStatic
                      ?.variable
                  )
                }
              </span>


              <span>
                {
                  formatPercentage(
                    topStatic
                      ?.importance_percentage
                  )
                }
              </span>


              <span>
                Information used to
                distinguish tea demand
                behaviour
              </span>

            </div>

          )}

        </div>

      </div>


      <div className="demand-panel">

        <div className="explain-note">

          <BrainCircuit
            size={22}
          />


          <div>

            <h3>
              What do these percentages mean?
            </h3>


            <p>
              A higher percentage means
              the forecasting system
              relied more strongly on
              that factor when producing
              the forecast. These values
              show model influence and
              do not prove that a factor
              directly caused a change
              in tea demand.
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}