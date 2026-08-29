import React, {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  getDemoLatestWeek,
  getLatestOperationalWeeklyInput,
  submitDemoWeeklyData,
  generateDemoForecast,
} from "../../services/demandService";


export default function WeeklyDataEntry() {
  const navigate =
    useNavigate();


  const teaTypes = [
    "BOP",
    "BOPF",
    "Dust",
    "OP",
    "Pekoe",
  ];


  const createEmptyRecord = (
    teaType
  ) => ({
    tea_type:
      teaType,

    demand_kg:
      "",

    production_kg:
      "",

    inventory_kg:
      "",

    colombo_auction_price_lkr:
      "",

    rainfall_index:
      "",

    usd_lkr_rate:
      "",

    festival_flag:
      "0",

    global_commodity_shock:
      "",
  });


  const [
    weekStartDate,
    setWeekStartDate,
  ] = useState("");


  const [
    weekEndDate,
    setWeekEndDate,
  ] = useState("");


  const [
    forecastStartDate,
    setForecastStartDate,
  ] = useState("");


  const [
    records,
    setRecords,
  ] = useState(
    teaTypes.map(
      createEmptyRecord
    )
  );


  const [
    loadingWeek,
    setLoadingWeek,
  ] = useState(true);


  const [
    submitting,
    setSubmitting,
  ] = useState(false);


  const [
    message,
    setMessage,
  ] = useState("");


  const [
    error,
    setError,
  ] = useState("");


  useEffect(() => {
    loadCompletedWeek();
  }, []);


  function convertSavedRecords(
    savedRecords
  ) {
    return teaTypes.map(
      (teaType) => {

        const savedRecord =
          savedRecords.find(
            (record) =>
              record.tea_type ===
              teaType
          );


        if (!savedRecord) {
          return createEmptyRecord(
            teaType
          );
        }


        return {
          tea_type:
            teaType,

          demand_kg:
            String(
              savedRecord.demand_kg
            ),

          production_kg:
            String(
              savedRecord
                .production_kg
            ),

          inventory_kg:
            String(
              savedRecord
                .inventory_kg
            ),

          colombo_auction_price_lkr:
            String(
              savedRecord
                .colombo_auction_price_lkr
            ),

          rainfall_index:
            String(
              savedRecord
                .rainfall_index
            ),

          usd_lkr_rate:
            String(
              savedRecord
                .usd_lkr_rate
            ),

          festival_flag:
            String(
              savedRecord
                .festival_flag
            ),

          global_commodity_shock:
            String(
              savedRecord
                .global_commodity_shock
            ),
        };
      }
    );
  }


  async function loadCompletedWeek() {
    try {
      setLoadingWeek(true);
      setError("");


      const data =
        await getDemoLatestWeek();


      const completedWeek =
        data
          .completed_week_start_date;


      setWeekStartDate(
        completedWeek
      );


      setWeekEndDate(
        data
          .completed_week_end_date
      );


      setForecastStartDate(
        data
          .forecast_start_date
      );


      try {
        const savedResponse =
          await getLatestOperationalWeeklyInput();


        const savedWeeklyInput =
          savedResponse
            ?.weekly_input;


        /*
         * Restore saved values only
         * when they belong to the
         * completed week currently
         * shown on the form.
         */
        if (
          savedWeeklyInput &&
          savedWeeklyInput
            .week_start_date ===
            completedWeek &&
          Array.isArray(
            savedWeeklyInput.records
          )
        ) {
          setRecords(
            convertSavedRecords(
              savedWeeklyInput.records
            )
          );


          setMessage(
            "Data previously saved for this completed week has been loaded."
          );


          sessionStorage.setItem(
            "latestDemoInput",
            JSON.stringify({
              week_start_date:
                savedWeeklyInput
                  .week_start_date,

              records:
                savedWeeklyInput
                  .records,
            })
          );
        }


      } catch (savedInputError) {
        console.warn(
          "No saved data is available for the completed week:",
          savedInputError
        );
      }


    } catch (err) {
      setError(
        err.message ||
        "Unable to load the completed week."
      );


    } finally {
      setLoadingWeek(
        false
      );
    }
  }


  function handleInputChange(
    teaType,
    field,
    value
  ) {
    setRecords(
      (currentRecords) =>
        currentRecords.map(
          (record) =>
            record.tea_type ===
            teaType
              ? {
                  ...record,
                  [field]:
                    value,
                }
              : record
        )
    );


    setMessage("");
    setError("");
  }


  function fillSampleData() {
    const sampleData = [
      {
        tea_type:
          "BOP",

        demand_kg:
          "4250",

        production_kg:
          "4900",

        inventory_kg:
          "1750",

        colombo_auction_price_lkr:
          "1525",

        rainfall_index:
          "28",

        usd_lkr_rate:
          "303",

        festival_flag:
          "0",

        global_commodity_shock:
          "0.02",
      },

      {
        tea_type:
          "BOPF",

        demand_kg:
          "4650",

        production_kg:
          "5200",

        inventory_kg:
          "1900",

        colombo_auction_price_lkr:
          "1480",

        rainfall_index:
          "28",

        usd_lkr_rate:
          "303",

        festival_flag:
          "0",

        global_commodity_shock:
          "0.02",
      },

      {
        tea_type:
          "Dust",

        demand_kg:
          "7200",

        production_kg:
          "7800",

        inventory_kg:
          "2350",

        colombo_auction_price_lkr:
          "1385",

        rainfall_index:
          "28",

        usd_lkr_rate:
          "303",

        festival_flag:
          "0",

        global_commodity_shock:
          "0.02",
      },

      {
        tea_type:
          "OP",

        demand_kg:
          "2300",

        production_kg:
          "2800",

        inventory_kg:
          "1100",

        colombo_auction_price_lkr:
          "1435",

        rainfall_index:
          "28",

        usd_lkr_rate:
          "303",

        festival_flag:
          "0",

        global_commodity_shock:
          "0.02",
      },

      {
        tea_type:
          "Pekoe",

        demand_kg:
          "1700",

        production_kg:
          "2100",

        inventory_kg:
          "850",

        colombo_auction_price_lkr:
          "1580",

        rainfall_index:
          "28",

        usd_lkr_rate:
          "303",

        festival_flag:
          "0",

        global_commodity_shock:
          "0.02",
      },
    ];


    setRecords(
      sampleData
    );


    setMessage(
      "Sample data has been filled. You can edit any value before generating the forecast."
    );


    setError("");
  }


  function clearForm() {
    setRecords(
      teaTypes.map(
        createEmptyRecord
      )
    );


    setMessage("");
    setError("");
  }


  function validateForm() {
    if (!weekStartDate) {
      return (
        "Completed week start date is required."
      );
    }


    for (
      const record
      of records
    ) {
      if (
        record.demand_kg === "" ||
        record.production_kg === "" ||
        record.inventory_kg === "" ||
        record
          .colombo_auction_price_lkr ===
          "" ||
        record.rainfall_index === "" ||
        record.usd_lkr_rate === "" ||
        record
          .global_commodity_shock ===
          ""
      ) {
        return (
          `Please complete all inputs for ` +
          `${record.tea_type}.`
        );
      }


      if (
        Number(
          record.demand_kg
        ) < 0 ||
        Number(
          record.production_kg
        ) < 0 ||
        Number(
          record.inventory_kg
        ) < 0 ||
        Number(
          record
            .colombo_auction_price_lkr
        ) <= 0 ||
        Number(
          record.rainfall_index
        ) < 0 ||
        Number(
          record.usd_lkr_rate
        ) <= 0
      ) {
        return (
          `Please check the values entered ` +
          `for ${record.tea_type}.`
        );
      }


      if (
        Number(
          record
            .global_commodity_shock
        ) < -10 ||
        Number(
          record
            .global_commodity_shock
        ) > 10
      ) {
        return (
          `Commodity Shock for ` +
          `${record.tea_type} must be ` +
          `between -10 and 10.`
        );
      }
    }


    return null;
  }


  function buildPayload() {
    return {
      week_start_date:
        weekStartDate,

      records:
        records.map(
          (record) => ({
            tea_type:
              record.tea_type,

            demand_kg:
              Number(
                record.demand_kg
              ),

            production_kg:
              Number(
                record
                  .production_kg
              ),

            inventory_kg:
              Number(
                record
                  .inventory_kg
              ),

            colombo_auction_price_lkr:
              Number(
                record
                  .colombo_auction_price_lkr
              ),

            rainfall_index:
              Number(
                record
                  .rainfall_index
              ),

            usd_lkr_rate:
              Number(
                record
                  .usd_lkr_rate
              ),

            festival_flag:
              Number(
                record
                  .festival_flag
              ),

            global_commodity_shock:
              Number(
                record
                  .global_commodity_shock
              ),
          })
        ),
    };
  }


  async function handleSubmit(
    event
  ) {
    event.preventDefault();


    setMessage("");
    setError("");


    const validationError =
      validateForm();


    if (validationError) {
      setError(
        validationError
      );

      return;
    }


    const payload =
      buildPayload();


    try {
      setSubmitting(
        true
      );


      /*
       * Save the completed week's
       * actual factory and market
       * data.
       */
      await submitDemoWeeklyData(
        payload
      );


      /*
       * Use that completed week as
       * the latest input to forecast
       * the ongoing week and the
       * following three weeks.
       */
      const response =
        await generateDemoForecast(
          payload
        );


      sessionStorage.setItem(
        "latestDemoForecast",
        JSON.stringify(
          response
        )
      );


      sessionStorage.setItem(
        "latestDemoInput",
        JSON.stringify(
          payload
        )
      );


      navigate(
        "/tea-demand-forecasting/forecast"
      );


    } catch (err) {
      setError(
        err.message ||
        "Unable to generate the demand forecast."
      );


    } finally {
      setSubmitting(
        false
      );
    }
  }


  return (
    <div className="demand-page">

      <div className="demand-page-header">

        <span className="demand-page-label">
          Weekly Update
        </span>


        <h1>
          Weekly Data Entry
        </h1>


        <p>
          Enter the factory and market
          data collected during the most
          recently completed week.
        </p>

      </div>


      {error && (
        <div className="demand-error-message">
          {error}
        </div>
      )}


      {message && (
        <div className="demand-success-message">
          {message}
        </div>
      )}


      <form onSubmit={handleSubmit}>

        <div className="demand-panel">

          <div className="weekly-form-top">

            <div>

              <label>
                Completed Week Starting
              </label>


              <input
                type="date"
                className="demand-input"
                value={
                  weekStartDate
                }
                readOnly
              />

            </div>


            <div className="weekly-note">

              <strong>
                Data Period
              </strong>


              <span>
                {loadingWeek
                  ? "Loading completed week..."
                  : weekStartDate &&
                    weekEndDate
                  ? (
                    <>
                      {
                        weekStartDate
                      }
                      {" to "}
                      {
                        weekEndDate
                      }
                    </>
                  )
                  : "Completed week information unavailable."}
              </span>


              {!loadingWeek &&
                forecastStartDate && (
                  <span>
                    Forecast begins:{" "}
                    {
                      forecastStartDate
                    }
                  </span>
                )}

            </div>

          </div>

        </div>


        <div className="weekly-submit-area">

          <button
            type="button"
            className="demand-secondary-btn"
            onClick={
              fillSampleData
            }
            disabled={
              loadingWeek ||
              submitting
            }
          >
            Fill Sample Data
          </button>


          <button
            type="button"
            className="demand-secondary-btn"
            onClick={
              clearForm
            }
            disabled={
              submitting
            }
          >
            Clear
          </button>

        </div>


        <div className="weekly-tea-grid">

          {records.map(
            (record) => (

              <div
                className="weekly-tea-card"
                key={
                  record.tea_type
                }
              >

                <div className="weekly-tea-title">

                  <h2>
                    {
                      record.tea_type
                    }
                  </h2>

                </div>


                <div className="weekly-input-grid">

                  <div>

                    <label>
                      Demand (kg)
                    </label>

                    <input
                      type="number"
                      min="0"
                      max="100000"
                      step="0.01"
                      className="demand-input"
                      placeholder="e.g. 4200"
                      value={
                        record.demand_kg
                      }
                      onChange={(e) =>
                        handleInputChange(
                          record.tea_type,
                          "demand_kg",
                          e.target.value
                        )
                      }
                    />

                  </div>


                  <div>

                    <label>
                      Production (kg)
                    </label>

                    <input
                      type="number"
                      min="0"
                      max="100000"
                      step="0.01"
                      className="demand-input"
                      placeholder="e.g. 5000"
                      value={
                        record
                          .production_kg
                      }
                      onChange={(e) =>
                        handleInputChange(
                          record.tea_type,
                          "production_kg",
                          e.target.value
                        )
                      }
                    />

                  </div>


                  <div>

                    <label>
                      Inventory (kg)
                    </label>

                    <input
                      type="number"
                      min="0"
                      max="100000"
                      step="0.01"
                      className="demand-input"
                      placeholder="e.g. 1800"
                      value={
                        record
                          .inventory_kg
                      }
                      onChange={(e) =>
                        handleInputChange(
                          record.tea_type,
                          "inventory_kg",
                          e.target.value
                        )
                      }
                    />

                  </div>


                  <div>

                    <label>
                      Auction Price (LKR)
                    </label>

                    <input
                      type="number"
                      min="0.01"
                      max="100000"
                      step="0.01"
                      className="demand-input"
                      placeholder="e.g. 1500"
                      value={
                        record
                          .colombo_auction_price_lkr
                      }
                      onChange={(e) =>
                        handleInputChange(
                          record.tea_type,
                          "colombo_auction_price_lkr",
                          e.target.value
                        )
                      }
                    />

                  </div>


                  <div>

                    <label>
                      Rainfall Index
                    </label>

                    <input
                      type="number"
                      min="0"
                      max="10000"
                      step="0.01"
                      className="demand-input"
                      placeholder="e.g. 28"
                      value={
                        record
                          .rainfall_index
                      }
                      onChange={(e) =>
                        handleInputChange(
                          record.tea_type,
                          "rainfall_index",
                          e.target.value
                        )
                      }
                    />

                  </div>


                  <div>

                    <label>
                      USD/LKR Rate
                    </label>

                    <input
                      type="number"
                      min="0.01"
                      max="10000"
                      step="0.01"
                      className="demand-input"
                      placeholder="e.g. 303"
                      value={
                        record
                          .usd_lkr_rate
                      }
                      onChange={(e) =>
                        handleInputChange(
                          record.tea_type,
                          "usd_lkr_rate",
                          e.target.value
                        )
                      }
                    />

                  </div>


                  <div>

                    <label>
                      Festival Week
                    </label>

                    <select
                      className="demand-input"
                      value={
                        record
                          .festival_flag
                      }
                      onChange={(e) =>
                        handleInputChange(
                          record.tea_type,
                          "festival_flag",
                          e.target.value
                        )
                      }
                    >

                      <option value="0">
                        No
                      </option>

                      <option value="1">
                        Yes
                      </option>

                    </select>

                  </div>


                  <div>

                    <label>
                      Commodity Shock
                    </label>

                    <input
                      type="number"
                      min="-10"
                      max="10"
                      step="0.01"
                      className="demand-input"
                      placeholder="e.g. 0.02"
                      value={
                        record
                          .global_commodity_shock
                      }
                      onChange={(e) =>
                        handleInputChange(
                          record.tea_type,
                          "global_commodity_shock",
                          e.target.value
                        )
                      }
                    />

                  </div>

                </div>

              </div>

            )
          )}

        </div>


        <div className="weekly-submit-area">

          <button
            type="submit"
            className="demand-save-btn"
            disabled={
              submitting ||
              loadingWeek ||
              !weekStartDate
            }
          >

            {submitting
              ? "Generating Forecast..."
              : "Generate 4-Week Forecast"}

          </button>

        </div>

      </form>

    </div>
  );
}