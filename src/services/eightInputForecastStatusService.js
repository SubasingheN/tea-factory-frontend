
/**
 * Tea Demand Forecasting
 * Finalized Forecast Status Service
 *
 * Supports the nine-input production TFT and
 * previously finalized legacy forecast records.
 *
 * Checks whether a reporting-week origin has
 * a complete five-grade, four-week forecast set.
 *
 * Possible statuses:
 * - finalized
 * - incomplete
 * - not_found
 *
 * Read-only:
 * - Does not generate forecasts
 * - Does not save weekly observations
 * - Does not modify finalized forecasts
 *
 * The historical collection may contain forecasts
 * from different model versions, but different
 * versions cannot be mixed within one origin.
 */

import {
  EIGHT_INPUT_GRADES,
  getEightInputForecastHistory,
} from "./eightInputDataService";

const FORECAST_HORIZON = 4;

function validateWeek(weekStartDate) {
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
      "The reporting week must begin on Monday."
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

function validForecastWeeks(record) {
  if (
    !Array.isArray(record.forecasts) ||
    record.forecasts.length !==
      FORECAST_HORIZON
  ) {
    return false;
  }

  return record.forecasts.every(
    (item, index) => {
      if (
        item === null ||
        typeof item !== "object"
      ) {
        return false;
      }

      const horizon = index + 1;

      if (
        item.horizon !== horizon ||
        item.week !== addWeeks(
          record.forecast_origin,
          horizon
        )
      ) {
        return false;
      }

      const lower = Number(
        item.lower_demand_kg
      );

      const median = Number(
        item.median_demand_kg
      );

      const upper = Number(
        item.upper_demand_kg
      );

      return (
        item.lower_demand_kg != null &&
        item.median_demand_kg != null &&
        item.upper_demand_kg != null &&
        Number.isFinite(lower) &&
        Number.isFinite(median) &&
        Number.isFinite(upper) &&
        lower >= 0 &&
        lower <= median &&
        median <= upper
      );
    }
  );
}

function classifyForecast(record) {
  if (
    record.historical_backfill === true ||
    record.forecast_type ===
      "historical_backfill"
  ) {
    return "historical_backfill";
  }

  if (
    record.operational_forecast === true
  ) {
    return "operational";
  }

  return "legacy";
}

function incompleteStatus(
  origin,
  records,
  reason
) {
  const availableGrades =
    EIGHT_INPUT_GRADES.filter(
      (grade) =>
        records.some(
          (record) =>
            record.tea_type === grade
        )
    );

  const missingGrades =
    EIGHT_INPUT_GRADES.filter(
      (grade) =>
        !availableGrades.includes(grade)
    );

  return {
    status: "incomplete",
    forecast_origin: origin,
    finalized: false,
    available_grades: availableGrades,
    missing_grades: missingGrades,
    forecast_count: records.reduce(
      (count, record) =>
        count +
        (
          Array.isArray(record.forecasts)
            ? record.forecasts.length
            : 0
        ),
      0
    ),
    forecasts: null,
    model: null,
    model_version: null,
    forecast_type: null,
    reason,
  };
}

/**
 * Read the saved forecast status for one
 * reporting-week origin.
 *
 * The backend stores one document per
 * tea grade and forecast origin.
 *
 * Only complete and internally consistent
 * finalized forecast sets are accepted.
 */
export async function getFinalizedForecastStatus(
  weekStartDate
) {
  const origin = validateWeek(
    weekStartDate
  );

  // One request retrieves the full forecast set.
  const response =
    await getEightInputForecastHistory(
      null,
      500
    );

  if (!Array.isArray(response?.forecasts)) {
    throw new Error(
      "Forecast history returned an invalid response."
    );
  }

  const records = response.forecasts.filter(
    (record) =>
      record.forecast_origin === origin
  );

  if (records.length === 0) {
    return {
      status: "not_found",
      forecast_origin: origin,
      finalized: false,
      available_grades: [],
      missing_grades: [
        ...EIGHT_INPUT_GRADES,
      ],
      forecast_count: 0,
      forecasts: null,
      model: null,
      model_version: null,
      forecast_type: null,
      reason: null,
    };
  }

  if (
    records.length !==
    EIGHT_INPUT_GRADES.length
  ) {
    return incompleteStatus(
      origin,
      records,
      "The reporting week does not contain all five forecast documents."
    );
  }

  const byGrade = new Map();

  for (const record of records) {
    if (
      !EIGHT_INPUT_GRADES.includes(
        record.tea_type
      )
    ) {
      return incompleteStatus(
        origin,
        records,
        "Forecast history contains an unsupported tea grade."
      );
    }

    if (
      byGrade.has(record.tea_type)
    ) {
      return incompleteStatus(
        origin,
        records,
        "Duplicate forecast records were found."
      );
    }

    byGrade.set(
      record.tea_type,
      record
    );
  }

  if (
    !EIGHT_INPUT_GRADES.every(
      (grade) =>
        byGrade.has(grade)
    )
  ) {
    return incompleteStatus(
      origin,
      records,
      "One or more tea-grade forecasts are missing."
    );
  }

  const first = records[0];

  const referenceModel =
    first.model;

  const referenceVersion =
    first.model_version ?? null;

  const referenceType =
    classifyForecast(first);

  for (const record of records) {
    if (record.finalized !== true) {
      return incompleteStatus(
        origin,
        records,
        "One or more forecasts are not finalized."
      );
    }

    if (
      record.model !==
        referenceModel ||
      (record.model_version ?? null) !==
        referenceVersion ||
      classifyForecast(record) !==
        referenceType
    ) {
      return incompleteStatus(
        origin,
        records,
        "Forecast records contain inconsistent model versions or record types."
      );
    }

    if (!validForecastWeeks(record)) {
      return incompleteStatus(
        origin,
        records,
        `The four-week forecast for ${record.tea_type} is invalid or incomplete.`
      );
    }
  }

  return {
    status: "finalized",
    forecast_origin: origin,
    finalized: true,

    available_grades: [
      ...EIGHT_INPUT_GRADES,
    ],

    missing_grades: [],

    forecast_count:
      EIGHT_INPUT_GRADES.length *
      FORECAST_HORIZON,

    forecasts: Object.fromEntries(
      EIGHT_INPUT_GRADES.map(
        (grade) => [
          grade,
          byGrade.get(grade).forecasts,
        ]
      )
    ),

    model: referenceModel,
    model_version: referenceVersion,
    forecast_type: referenceType,

    historical_backfill:
      referenceType ===
      "historical_backfill",

    operational_forecast:
      referenceType ===
      "operational",

    reason: null,
  };
}
