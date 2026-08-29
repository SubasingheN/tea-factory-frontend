const API_BASE_URL =
  "http://127.0.0.1:8000";


async function request(
  endpoint,
  options = {}
) {
  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    }
  );


  if (!response.ok) {
    let errorMessage =
      "Request failed.";


    try {
      const errorData =
        await response.json();

      errorMessage =
        errorData.detail ||
        errorData.message ||
        errorMessage;

    } catch {
      errorMessage =
        `Request failed with status ${response.status}`;
    }


    throw new Error(
      errorMessage
    );
  }


  return response.json();
}


// ======================================================
// WEEKLY DATA
// ======================================================

export function getDemoLatestWeek() {
  return request(
    "/demo/latest-week"
  );
}


export function getLatestOperationalWeeklyInput() {
  return request(
    "/demo/weekly-input/latest"
  );
}


export function submitDemoWeeklyData(
  weeklyData
) {
  return request(
    "/demo/weekly-input",
    {
      method: "POST",
      body: JSON.stringify(
        weeklyData
      ),
    }
  );
}


// ======================================================
// FORECAST
// ======================================================

export function getWeeklyForecast() {
  return request(
    "/forecast/weekly"
  );
}


export function getLatestOperationalForecast() {
  return request(
    "/forecast/latest-operational"
  );
}


export function generateDemoForecast(
  weeklyData
) {
  return request(
    "/demo/forecast",
    {
      method: "POST",
      body: JSON.stringify(
        weeklyData
      ),
    }
  );
}


/*
 * Saves an already-generated
 * operational forecast.
 *
 * This does not regenerate or
 * retrain the TFT model.
 */
export function saveGeneratedForecast(
  forecastData
) {
  return request(
    "/forecast/save-from-generated",
    {
      method: "POST",
      body: JSON.stringify({
        input_week_start_date:
          forecastData
            .input_week_start_date,

        forecasts:
          forecastData.forecasts,
      }),
    }
  );
}


// ======================================================
// DEMAND ALERTS
// ======================================================

export function getDemandAlerts() {
  return request(
    "/alerts/demand"
  );
}


export function getDemandAlertsFromForecast(
  forecasts
) {
  return request(
    "/alerts/demand/from-forecast",
    {
      method: "POST",
      body: JSON.stringify({
        forecasts,
      }),
    }
  );
}


// ======================================================
// RECOMMENDATIONS
// ======================================================

export function getDemandRecommendations() {
  return request(
    "/recommendations/demand"
  );
}


export function getDemandRecommendationsFromForecast(
  forecasts
) {
  return request(
    "/recommendations/demand/from-forecast",
    {
      method: "POST",
      body: JSON.stringify({
        forecasts,
      }),
    }
  );
}


// ======================================================
// EXPLAINABILITY
// ======================================================

export function getExplainabilitySummary() {
  return request(
    "/explainability/summary"
  );
}


export function getExplainabilityFromWeeklyInput(
  weeklyData
) {
  return request(
    "/explainability/from-weekly-input",
    {
      method: "POST",
      body: JSON.stringify(
        weeklyData
      ),
    }
  );
}


// ======================================================
// FORECAST HISTORY
// ======================================================

export function getForecastHistory() {
  return request(
    "/forecast/history"
  );
}


export function getForecastComparison(
  forecastId
) {
  return request(
    `/forecast/history/${forecastId}/comparison`
  );
}


// ======================================================
// REPORTS
// ======================================================

/*
 * Download a PDF report using the
 * already-generated operational
 * forecast.
 *
 * The endpoint returns PDF binary
 * data instead of JSON, therefore
 * this function does not use the
 * normal request() helper.
 */
export async function downloadGeneratedForecastReport(
  forecastData
) {
  const response = await fetch(
    `${API_BASE_URL}` +
      "/forecast/report/" +
      "download-from-generated",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        input_week_start_date:
          forecastData
            .input_week_start_date,

        forecasts:
          forecastData.forecasts,
      }),
    }
  );


  if (!response.ok) {
    let errorMessage =
      "Unable to download forecast report.";


    try {
      const errorData =
        await response.json();

      errorMessage =
        errorData.detail ||
        errorData.message ||
        errorMessage;

    } catch {
      errorMessage =
        `Report download failed with status ${response.status}`;
    }


    throw new Error(
      errorMessage
    );
  }


  const blob =
    await response.blob();


  let filename =
    "tea_demand_forecast_report.pdf";


  const contentDisposition =
    response.headers.get(
      "content-disposition"
    );


  if (contentDisposition) {
    const filenameMatch =
      contentDisposition.match(
        /filename="?([^"]+)"?/
      );


    if (
      filenameMatch &&
      filenameMatch[1]
    ) {
      filename =
        filenameMatch[1];
    }
  }


  const downloadUrl =
    window.URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );


  link.href =
    downloadUrl;

  link.download =
    filename;


  document.body.appendChild(
    link
  );


  link.click();


  document.body.removeChild(
    link
  );


  window.URL.revokeObjectURL(
    downloadUrl
  );


  return {
    status: "success",
    filename,
  };
}