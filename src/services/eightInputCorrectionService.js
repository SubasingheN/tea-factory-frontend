
/**
 * Tea Demand Forecasting
 * Factory Weekly Observation Correction Service
 *
 * Handles corrections to previously saved
 * factory weekly observations.
 *
 * Original historical records remain protected
 * by the backend.
 */

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const CORRECTION_ENDPOINT =
  `${API_BASE}/factory/eight-input/observations`;

const SUPPORTED_GRADES = [
  "BOP",
  "BOPF",
  "Dust",
  "OP",
  "Pekoe",
];

const REQUIRED_FIELDS = [
  "demand_kg",
  "production_kg",
  "inventory_kg",
  "usd_lkr_rate",
  "festival_flag",
  "auction_price_high_lkr",
  "auction_price_medium_lkr",
  "auction_price_low_lkr",
];

async function readApiResponse(response) {
  const contentType =
    response.headers.get("content-type") || "";

  let payload;

  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    let message = "The operation failed.";

    if (
      payload &&
      typeof payload === "object"
    ) {
      if (typeof payload.detail === "string") {
        message = payload.detail;
      } else if (Array.isArray(payload.detail)) {
        message = payload.detail
          .map((item) => item.msg || "Invalid value")
          .join("; ");
      } else if (typeof payload.message === "string") {
        message = payload.message;
      }
    } else if (
      typeof payload === "string" &&
      payload.trim()
    ) {
      message = payload;
    }

    throw new Error(message);
  }

  return payload;
}

function validateCorrectionInput(
  weekStartDate,
  record,
  reason
) {
  if (
    typeof weekStartDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)
  ) {
    throw new Error(
      "A valid reporting week is required."
    );
  }

  const parsedDate = new Date(
    `${weekStartDate}T12:00:00Z`
  );

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !==
      weekStartDate ||
    parsedDate.getUTCDay() !== 1
  ) {
    throw new Error(
      "The reporting week must begin on Monday."
    );
  }

  if (!record || typeof record !== "object") {
    throw new Error(
      "Weekly observation data is required."
    );
  }

  if (
    !SUPPORTED_GRADES.includes(record.tea_type)
  ) {
    throw new Error(
      "Select a valid tea grade."
    );
  }

  const normalizedRecord = {
    tea_type: record.tea_type,
  };

  for (const field of REQUIRED_FIELDS) {
    if (
      record[field] === "" ||
      record[field] === null ||
      record[field] === undefined
    ) {
      throw new Error(
        `${field} is required.`
      );
    }

    const value = Number(record[field]);

    if (!Number.isFinite(value)) {
      throw new Error(
        `${field} must be a valid number.`
      );
    }

    normalizedRecord[field] = value;
  }

  if (
    typeof reason !== "string" ||
    reason.trim().length < 3
  ) {
    throw new Error(
      "Enter a correction reason of at least 3 characters."
    );
  }

  if (reason.trim().length > 500) {
    throw new Error(
      "The correction reason cannot exceed 500 characters."
    );
  }

  return {
    batch: {
      week_start_date: weekStartDate,
      records: [normalizedRecord],
    },
    reason: reason.trim(),
  };
}

/**
 * Correct one previously saved observation.
 *
 * The backend handles:
 * - Historical data protection
 * - Shared weekly value synchronization
 * - Correction history
 * - Atomic MongoDB updates
 *
 * @param {string} weekStartDate
 * @param {object} record
 * @param {string} reason
 * @returns {Promise<object>}
 */
export async function updateEightInputObservation(
  weekStartDate,
  record,
  reason
) {
  const requestBody = validateCorrectionInput(
    weekStartDate,
    record,
    reason
  );

  let response;

  try {
    response = await fetch(
      CORRECTION_ENDPOINT,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );
  } catch {
    throw new Error(
      "Cannot connect to the factory API."
    );
  }

  return readApiResponse(response);
}

/**
 * Check whether correction writes are enabled.
 *
 * This status is informational.
 * The backend remains responsible for enforcement.
 */
export async function getEightInputCorrectionStatus() {
  let response;

  try {
    response = await fetch(
      `${API_BASE}/factory/eight-input/status`
    );
  } catch {
    throw new Error(
      "Cannot connect to the factory API."
    );
  }

  const result = await readApiResponse(response);

  return {
    enabled: result.corrections_enabled === true,
    authenticationConfigured:
      result.authentication_configured === true,
  };
}
