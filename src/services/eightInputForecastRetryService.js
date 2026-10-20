
/**
 * Tea Demand Forecasting
 * Automatic Forecast Retry Service
 *
 * Compatible with the production nine-input TFT.
 *
 * Retries four-week demand forecasting using
 * factory observations already saved in MongoDB.
 *
 * This service:
 * - Sends only the reporting-week date.
 * - Never submits new observation values.
 * - Never modifies the protected historical data.
 * - Reuses previously finalized forecasts.
 * - Validates all five tea-grade forecasts.
 *
 * The existing function name is preserved
 * for compatibility with React components.
 */

import {
  EIGHT_INPUT_GRADES,
} from "./eightInputDataService";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const RETRY_ENDPOINT =
  `${API_BASE}/factory/eight-input/observations/forecast/retry`;

const FORECAST_HORIZON = 4;

/**
 * Require a valid Monday reporting-week date.
 */
function validateWeekStartDate(weekStartDate) {
  if (
    typeof weekStartDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)
  ) {
    throw new Error(
      "A valid reporting week is required."
    );
  }

  const date = new Date(
    `${weekStartDate}T12:00:00Z`
  );

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !==
      weekStartDate ||
    date.getUTCDay() !== 1
  ) {
    throw new Error(
      "The reporting week must start on Monday."
    );
  }

  return weekStartDate;
}

function addWeeks(origin, weeks) {
  const date = new Date(
    `${origin}T12:00:00Z`
  );

  date.setUTCDate(
    date.getUTCDate() + weeks * 7
  );

  return date.toISOString().slice(0, 10);
}

/**
 * Extract helpful backend error messages.
 */
async function parseResponse(response) {
  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      "The factory API returned an invalid response."
    );
  }

  if (!response.ok) {
    const detail = result?.detail;

    let message =
      "Unable to generate the demand forecast.";

    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail)) {
      message = detail
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }

          return (
            item?.msg ||
            "Invalid request value"
          );
        })
        .join("; ");
    } else if (
      detail &&
      typeof detail.message === "string"
    ) {
      message = detail.message;
    } else if (
      typeof result?.message === "string"
    ) {
      message = result.message;
    }

    const error = new Error(message);

    error.status = response.status;

    throw error;
  }

  return result;
}

/**
 * Validate four consecutive forecast weeks.
 *
 * Ensures the response contains valid,
 * nonnegative and ordered demand estimates.
 */
function validateGradeForecasts(
  forecasts,
  grade,
  origin
) {
  const predictions = forecasts?.[grade];

  if (
    !Array.isArray(predictions) ||
    predictions.length !== FORECAST_HORIZON
  ) {
    throw new Error(
      `The forecast for ${grade} must contain four weeks.`
    );
  }

  predictions.forEach((prediction, index) => {
    const horizon = index + 1;

    if (
      !prediction ||
      typeof prediction !== "object" ||
      prediction.horizon !== horizon ||
      prediction.week !== addWeeks(
        origin,
        horizon
      )
    ) {
      throw new Error(
        `${grade}: forecast week ${horizon} is invalid.`
      );
    }

    const fields = [
      "lower_demand_kg",
      "median_demand_kg",
      "upper_demand_kg",
    ];

    const values = fields.map((field) => {
      const value = prediction[field];

      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        throw new Error(
          `${grade}: missing ${field}.`
        );
      }

      const number = Number(value);

      if (!Number.isFinite(number)) {
        throw new Error(
          `${grade}: invalid ${field}.`
        );
      }

      return number;
    });

    const [lower, median, upper] = values;

    if (
      lower < 0 ||
      lower > median ||
      median > upper
    ) {
      throw new Error(
        `${grade}: forecast demand ranges are invalid.`
      );
    }
  });
}

/**
 * Validate the response after a forecast retry.
 */
function validateRetryResult(result, origin) {
  if (
    !result ||
    typeof result !== "object"
  ) {
    throw new Error(
      "The forecast retry response is invalid."
    );
  }

  if (
    result.week_start_date &&
    result.week_start_date !== origin
  ) {
    throw new Error(
      "Forecast retry returned the wrong reporting week."
    );
  }

  const forecast = result.forecast;

  if (
    !forecast ||
    forecast.finalized !== true
  ) {
    throw new Error(
      forecast?.message ||
      "Forecast finalization could not be confirmed."
    );
  }

  if (
    forecast.forecast_origin !== origin
  ) {
    throw new Error(
      "Forecast origin does not match the requested week."
    );
  }

  const forecasts = forecast.forecasts;

  if (
    !forecasts ||
    typeof forecasts !== "object" ||
    Array.isArray(forecasts)
  ) {
    throw new Error(
      "The forecast response does not contain valid predictions."
    );
  }

  for (const grade of EIGHT_INPUT_GRADES) {
    validateGradeForecasts(
      forecasts,
      grade,
      origin
    );
  }

  if (
    forecast.forecast_count !== undefined &&
    forecast.forecast_count !==
      EIGHT_INPUT_GRADES.length *
        FORECAST_HORIZON
  ) {
    throw new Error(
      "Forecast prediction count is incorrect."
    );
  }

  return result;
}

/**
 * Retry automatic demand forecasting using
 * already saved factory observations.
 *
 * The backend does not insert or update the
 * weekly observations during this operation.
 *
 * @param {string} weekStartDate - Monday (YYYY-MM-DD)
 * @returns {Promise<object>} Validated backend response
 */
export async function retryEightInputForecast(
  weekStartDate
) {
  const origin = validateWeekStartDate(
    weekStartDate
  );

  let response;

  try {
    response = await fetch(
      RETRY_ENDPOINT,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          week_start_date: origin,
        }),
      }
    );
  } catch {
    throw new Error(
      "Cannot connect to the factory API. " +
      "Saved weekly observations were not changed."
    );
  }

  return validateRetryResult(
    await parseResponse(response),
    origin
  );
}
