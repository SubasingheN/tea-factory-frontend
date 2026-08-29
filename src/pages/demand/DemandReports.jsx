import React, {
  useEffect,
  useState,
} from "react";

import {
  FileText,
  Download,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import {
  downloadGeneratedForecastReport,
  getLatestOperationalForecast,
} from "../../services/demandService";


export default function DemandReports() {
  const [
    forecastData,
    setForecastData,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    downloading,
    setDownloading,
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
    loadLatestForecast();
  }, []);


  async function loadLatestForecast() {
    try {
      setLoading(true);
      setError("");


      /*
       * First use the forecast from
       * the current browser session.
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
            ) &&
            parsedForecast
              .forecasts.length > 0
          ) {
            setForecastData(
              parsedForecast
            );

            return;
          }


        } catch (sessionError) {
          console.error(
            "Unable to read current forecast:",
            sessionError
          );


          sessionStorage.removeItem(
            "latestDemoForecast"
          );
        }
      }


      /*
       * If the browser session is
       * unavailable, recover the
       * latest saved forecast.
       */
      try {
        const response =
          await getLatestOperationalForecast();


        const latestForecast =
          response?.forecast;


        if (
          latestForecast &&
          Array.isArray(
            latestForecast.forecasts
          ) &&
          latestForecast
            .forecasts.length > 0
        ) {
          setForecastData(
            latestForecast
          );


          sessionStorage.setItem(
            "latestDemoForecast",
            JSON.stringify(
              latestForecast
            )
          );


          return;
        }


      } catch (savedForecastError) {
        console.warn(
          "No saved forecast available:",
          savedForecastError
        );
      }


      setForecastData(
        null
      );


    } catch (error) {
      console.error(
        "Failed to load latest forecast:",
        error
      );


      setError(
        error.message ||
        "Failed to load the latest forecast."
      );


    } finally {
      setLoading(false);
    }
  }


  const handleDownload =
    async () => {

      if (
        !forecastData ||
        !Array.isArray(
          forecastData.forecasts
        ) ||
        !forecastData
          .forecasts.length
      ) {
        setError(
          "No forecast is available. Enter the latest completed week's data and generate a forecast first."
        );

        setMessage("");

        return;
      }


      try {
        setDownloading(true);
        setError("");
        setMessage("");


        const result =
          await downloadGeneratedForecastReport(
            forecastData
          );


        setMessage(
          `Report downloaded successfully: ${result.filename}`
        );


      } catch (error) {
        console.error(
          "Failed to download report:",
          error
        );


        setError(
          error.message ||
          "Failed to download forecast report."
        );


      } finally {
        setDownloading(false);
      }
    };


  const teaTypeCount =
    forecastData
      ?.tea_type_count ??
    forecastData
      ?.forecasts
      ?.length ??
    5;


  const forecastHorizon =
    forecastData
      ?.forecast_horizon_weeks ??
    forecastData
      ?.forecast_horizon ??
    4;


  const inputWeek =
    forecastData
      ?.input_week_start_date;


  const forecastAvailable =
    Boolean(
      forecastData &&
      Array.isArray(
        forecastData.forecasts
      ) &&
      forecastData
        .forecasts.length
    );


  if (loading) {
    return (
      <div className="demand-page">

        <div className="demand-panel">

          <h2>
            Loading Reports...
          </h2>


          <p>
            Checking the latest
            demand forecast.
          </p>

        </div>

      </div>
    );
  }


  return (
    <div className="demand-page">

      <div className="demand-page-header">

        <span className="demand-page-label">
          Reports
        </span>


        <h1>
          Forecast Reports
        </h1>


        <p>
          Download the latest 4-week
          tea demand forecast as a
          PDF report.
        </p>

      </div>


      {forecastAvailable ? (

        <div className="demand-success-message">

          <CheckCircle2
            size={19}
          />


          <span>
            Latest demand forecast
            is ready for reporting
            {inputWeek
              ? ` based on the week starting ${inputWeek}.`
              : "."}
          </span>

        </div>

      ) : (

        <div
          className="dashboard-warning-box"
          style={{
            marginBottom:
              "20px",
          }}
        >

          <AlertTriangle
            size={21}
          />


          <div>

            <h3>
              No forecast available
            </h3>


            <p>
              Enter the latest
              completed week's data
              and generate a demand
              forecast before
              downloading a report.
            </p>

          </div>

        </div>

      )}


      {message && (

        <div
          className="demand-success-message"
          style={{
            marginBottom:
              "20px",
          }}
        >

          <CheckCircle2
            size={19}
          />


          <span>
            {message}
          </span>

        </div>

      )}


      {error && (

        <div
          className="dashboard-warning-box"
          style={{
            marginBottom:
              "20px",
          }}
        >

          <AlertTriangle
            size={21}
          />


          <div>

            <h3>
              Unable to download report
            </h3>


            <p>
              {error}
            </p>

          </div>

        </div>

      )}


      <div className="reports-summary-grid">

        <div className="reports-summary-card">

          <FileText
            size={23}
          />


          <div>

            <span>
              Report Format
            </span>


            <h3>
              PDF
            </h3>

          </div>

        </div>


        <div className="reports-summary-card">

          <CalendarDays
            size={23}
          />


          <div>

            <span>
              Forecast Period
            </span>


            <h3>
              {forecastHorizon} Weeks
            </h3>

          </div>

        </div>


        <div className="reports-summary-card">

          <CheckCircle2
            size={23}
          />


          <div>

            <span>
              Tea Types
            </span>


            <h3>
              {teaTypeCount}
            </h3>

          </div>

        </div>

      </div>


      <div className="demand-panel report-main-card">

        <div className="report-icon-box">

          <FileText
            size={34}
          />

        </div>


        <div className="report-main-content">

          <span className="report-label">
            Latest Forecast
          </span>


          <h2>
            Tea Demand Forecast Report
          </h2>


          <p>
            Download a summary of
            expected demand for BOP,
            BOPF, Dust, OP and Pekoe
            for the next four weeks.
          </p>


          <div className="report-details">

            <div>

              <span>
                Format
              </span>


              <strong>
                PDF Document
              </strong>

            </div>


            <div>

              <span>
                Forecast Period
              </span>


              <strong>
                {forecastHorizon}
                {" "}Weeks
              </strong>

            </div>


            <div>

              <span>
                Tea Types
              </span>


              <strong>
                {teaTypeCount}
              </strong>

            </div>


            <div>

              <span>
                Based on Week
              </span>


              <strong>
                {
                  inputWeek ||
                  "Not Available"
                }
              </strong>

            </div>

          </div>


          <button
            type="button"
            className="report-download-btn"
            onClick={
              handleDownload
            }
            disabled={
              downloading ||
              !forecastAvailable
            }
          >

            <Download
              size={18}
            />


            {downloading
              ? "Preparing PDF..."
              : "Download Latest Report"}

          </button>

        </div>

      </div>


      <div className="demand-panel">

        <h2>
          Report Contents
        </h2>


        <p>
          The PDF provides the key
          information needed to review
          and plan for upcoming tea
          demand.
        </p>


        <div className="report-content-list">

          <div>

            <CheckCircle2
              size={18}
            />


            <span>
              4-week demand forecast
              for all five tea types
            </span>

          </div>


          <div>

            <CheckCircle2
              size={18}
            />


            <span>
              Expected demand for
              each forecast week
            </span>

          </div>


          <div>

            <CheckCircle2
              size={18}
            />


            <span>
              Expected demand ranges
            </span>

          </div>


          <div>

            <CheckCircle2
              size={18}
            />


            <span>
              Demand trend information
            </span>

          </div>


          <div>

            <CheckCircle2
              size={18}
            />


            <span>
              Week used to prepare
              the forecast
            </span>

          </div>


          <div>

            <CheckCircle2
              size={18}
            />


            <span>
              Report preparation
              date and time
            </span>

          </div>

        </div>

      </div>

    </div>
  );
}